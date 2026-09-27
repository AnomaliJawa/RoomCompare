"""
The server, over real HTTP: accounts, sessions, survey storage, and what it
refuses to serve.

    python -m unittest discover -s tests/server -v

Each test class starts the server on a free port with a throwaway database.
Password hashing runs at 1,000 iterations here instead of 600,000, so the
suite takes seconds, not minutes; the stored format records the count, so
nothing else changes.
"""

import http.cookiejar
import json
import sqlite3
import sys
import tempfile
import threading
import unittest
import urllib.error
import urllib.request
import uuid
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT))

import server  # noqa: E402

# The server logs every refused request; here those refusals are the point.
server.Handler.log_message = lambda self, fmt, *args: None


class Client:
    """One browser: its own cookie jar."""

    def __init__(self, base):
        self.base = base
        self.jar = http.cookiejar.CookieJar()
        self.opener = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(self.jar))

    def call(self, method, path, body=None, headers=None, raw=None):
        data = raw if raw is not None else (json.dumps(body).encode("utf-8") if body is not None else None)
        request = urllib.request.Request(self.base + path, data=data, method=method)
        if body is not None:
            request.add_header("Content-Type", "application/json")
        for key, value in (headers or {}).items():
            request.add_header(key, value)
        try:
            with self.opener.open(request) as response:
                payload = response.read()
                return response.status, (json.loads(payload) if payload and "json" in response.headers.get("Content-Type", "") else payload), response.headers
        except urllib.error.HTTPError as error:
            payload = error.read()
            content_type = error.headers.get("Content-Type", "")
            return error.code, (json.loads(payload) if payload and "json" in content_type else payload), error.headers

    def register(self, email=None, password="correct horse", name="Rahma"):
        email = email or f"{uuid.uuid4().hex[:10]}@example.com"
        status, body, headers = self.call("POST", "/api/register", {"name": name, "email": email, "password": password})
        return status, body, headers, email


class ServerTestCase(unittest.TestCase):
    login_limit = server.LOGIN_LIMIT

    @classmethod
    def setUpClass(cls):
        cls.tmp = tempfile.TemporaryDirectory(ignore_cleanup_errors=True)
        cls.db_path = Path(cls.tmp.name) / "test.sqlite3"
        cls.httpd = server.create_server("127.0.0.1", 0, cls.db_path, iterations=1000, login_limit=cls.login_limit)
        cls.base = f"http://127.0.0.1:{cls.httpd.server_address[1]}"
        cls.thread = threading.Thread(target=cls.httpd.serve_forever, daemon=True)
        cls.thread.start()

    @classmethod
    def tearDownClass(cls):
        cls.httpd.shutdown()
        cls.httpd.server_close()
        cls.tmp.cleanup()

    def client(self):
        return Client(self.base)


def survey(survey_id, name="Kos Melati", created="2026-09-01T08:00:00.000Z"):
    return {"id": survey_id, "status": "draft", "createdAt": created, "updatedAt": created, "kos": {"name": name}}


class Accounts(ServerTestCase):
    def test_register_logs_in_with_a_cookie_scripts_cannot_read(self):
        browser = self.client()
        status, body, headers, email = browser.register()
        self.assertEqual(status, 201)
        self.assertEqual(body["user"]["email"], email)
        self.assertEqual(body["user"]["name"], "Rahma")
        cookie = headers["Set-Cookie"]
        self.assertIn("HttpOnly", cookie)
        self.assertIn("SameSite=Lax", cookie)
        # Plain http on localhost: a Secure cookie would never be sent back.
        self.assertNotIn("Secure", cookie)

        status, body, _ = browser.call("GET", "/api/me")
        self.assertEqual(status, 200)
        self.assertEqual(body["user"]["email"], email)

    def test_an_email_holds_one_account_whatever_its_case(self):
        email = f"{uuid.uuid4().hex[:8]}@Example.com"
        self.assertEqual(self.client().register(email=email)[0], 201)
        status, body, _, _ = self.client().register(email=email.upper())
        self.assertEqual(status, 409)
        self.assertIn("already exists", body["errors"]["email"])

    def test_registration_says_what_to_fix(self):
        cases = [
            ({"name": "", "email": "a@b.co", "password": "longenough"}, "name", "Enter your name."),
            ({"name": "R", "email": "not-an-email", "password": "longenough"}, "email", "Enter an email address like name@example.com."),
            ({"name": "R", "email": "a@b.co", "password": "short"}, "password", "Use at least 8 characters."),
        ]
        for body, field, message in cases:
            status, reply, _ = self.client().call("POST", "/api/register", body)
            self.assertEqual(status, 400)
            self.assertEqual(reply["errors"][field], message)

    def test_login_does_not_say_which_half_was_wrong(self):
        browser = self.client()
        _, _, _, email = browser.register(password="right password")
        wrong_password = self.client().call("POST", "/api/login", {"email": email, "password": "wrong password"})
        unknown_email = self.client().call("POST", "/api/login", {"email": "nobody@example.com", "password": "wrong password"})
        self.assertEqual(wrong_password[0], 401)
        self.assertEqual(unknown_email[0], 401)
        self.assertEqual(wrong_password[1]["error"], unknown_email[1]["error"])

        status, body, headers = self.client().call("POST", "/api/login", {"email": email.upper(), "password": "right password"})
        self.assertEqual(status, 200)
        self.assertEqual(body["user"]["email"], email)
        self.assertIn("rc_session=", headers["Set-Cookie"])

    def test_logout_ends_the_session(self):
        browser = self.client()
        browser.register()
        self.assertEqual(browser.call("POST", "/api/logout")[0], 204)
        self.assertEqual(browser.call("GET", "/api/me")[0], 401)

    def test_an_expired_session_is_refused(self):
        browser = self.client()
        browser.register()
        with sqlite3.connect(self.db_path) as db:
            db.execute("UPDATE sessions SET expires_at = '2000-01-01T00:00:00Z'")
        self.assertEqual(browser.call("GET", "/api/me")[0], 401)

    def test_passwords_are_stored_only_as_salted_hashes(self):
        _, _, _, email = self.client().register(password="a very secret phrase")
        with sqlite3.connect(self.db_path) as db:
            stored = db.execute("SELECT password_hash FROM users WHERE email = ?", (email,)).fetchone()[0]
        self.assertTrue(stored.startswith("pbkdf2_sha256$1000$"))
        self.assertNotIn("a very secret phrase", stored)


class Throttle(ServerTestCase):
    login_limit = 3

    def test_repeated_failures_are_refused_for_a_while(self):
        browser = self.client()
        _, _, _, email = browser.register(password="right password")
        for _ in range(3):
            self.assertEqual(self.client().call("POST", "/api/login", {"email": email, "password": "nope nope"})[0], 401)
        status, body, _ = self.client().call("POST", "/api/login", {"email": email, "password": "right password"})
        self.assertEqual(status, 429)
        self.assertIn("Too many attempts", body["error"])


class Surveys(ServerTestCase):
    def test_every_survey_call_needs_a_session(self):
        anonymous = self.client()
        self.assertEqual(anonymous.call("GET", "/api/surveys")[0], 401)
        self.assertEqual(anonymous.call("PUT", "/api/surveys/svy-a", {"survey": survey("svy-a")})[0], 401)
        self.assertEqual(anonymous.call("DELETE", "/api/surveys/svy-a")[0], 401)

    def test_save_list_update_delete(self):
        browser = self.client()
        browser.register()
        self.assertEqual(browser.call("PUT", "/api/surveys/svy-old", {"survey": survey("svy-old", created="2026-08-01T08:00:00.000Z")})[0], 204)
        self.assertEqual(browser.call("PUT", "/api/surveys/svy-new", {"survey": survey("svy-new", created="2026-09-01T08:00:00.000Z")})[0], 204)

        status, body, _ = browser.call("GET", "/api/surveys")
        self.assertEqual(status, 200)
        self.assertEqual([s["id"] for s in body["surveys"]], ["svy-new", "svy-old"])

        changed = survey("svy-old", name="Kos Melati Residence", created="2026-08-01T08:00:00.000Z")
        browser.call("PUT", "/api/surveys/svy-old", {"survey": changed})
        names = {s["id"]: s["kos"]["name"] for s in browser.call("GET", "/api/surveys")[1]["surveys"]}
        self.assertEqual(names["svy-old"], "Kos Melati Residence")

        self.assertEqual(browser.call("DELETE", "/api/surveys/svy-old")[0], 204)
        # A retried delete after a dropped connection must not look like a failure.
        self.assertEqual(browser.call("DELETE", "/api/surveys/svy-old")[0], 204)
        self.assertEqual([s["id"] for s in browser.call("GET", "/api/surveys")[1]["surveys"]], ["svy-new"])

    def test_accounts_see_and_change_only_their_own(self):
        rahma, budi = self.client(), self.client()
        rahma.register(name="Rahma")
        budi.register(name="Budi")
        rahma.call("PUT", "/api/surveys/svy-shared-id", {"survey": survey("svy-shared-id", name="Rahma's kos")})

        self.assertEqual(budi.call("GET", "/api/surveys")[1]["surveys"], [])
        budi.call("PUT", "/api/surveys/svy-shared-id", {"survey": survey("svy-shared-id", name="Budi's kos")})
        budi.call("DELETE", "/api/surveys/svy-shared-id")

        mine = rahma.call("GET", "/api/surveys")[1]["surveys"]
        self.assertEqual([s["kos"]["name"] for s in mine], ["Rahma's kos"])

    def test_a_survey_must_match_its_address(self):
        browser = self.client()
        browser.register()
        status, body, _ = browser.call("PUT", "/api/surveys/svy-a", {"survey": survey("svy-b")})
        self.assertEqual(status, 400)
        self.assertIn("does not match", body["error"])

    def test_size_and_format_limits(self):
        browser = self.client()
        browser.register()
        too_big = json.dumps({"survey": survey("svy-big") | {"notes": "x" * 1_100_000}}).encode("utf-8")
        self.assertEqual(browser.call("PUT", "/api/surveys/svy-big", raw=too_big, headers={"Content-Type": "application/json"})[0], 413)
        not_json = browser.call("PUT", "/api/surveys/svy-a", raw=b"id=svy-a", headers={"Content-Type": "application/x-www-form-urlencoded"})
        self.assertEqual(not_json[0], 415)

    def test_writes_from_another_site_are_refused(self):
        browser = self.client()
        _, _, _, email = browser.register(password="right password")
        status, body, _ = self.client().call(
            "POST", "/api/login", {"email": email, "password": "right password"}, headers={"Origin": "http://evil.example"}
        )
        self.assertEqual(status, 403)
        same_site = self.client().call("POST", "/api/login", {"email": email, "password": "right password"}, headers={"Origin": self.base})
        self.assertEqual(same_site[0], 200)


class StaticFiles(ServerTestCase):
    def test_the_app_is_served_without_caching(self):
        browser = self.client()
        status, body, headers = browser.call("GET", "/index.html")
        self.assertEqual(status, 200)
        self.assertIn(b"RoomCompare", body)
        self.assertIn("no-store", headers["Cache-Control"])
        self.assertEqual(browser.call("GET", "/src/main.js")[0], 200)
        self.assertEqual(browser.call("GET", "/styles/tokens.css")[0], 200)

    def test_nothing_outside_the_app_is_served(self):
        browser = self.client()
        for path in ["/server.py", "/data/roomcompare.sqlite3", "/tests/server/test_server.py", "/.git/config",
                     "/package.json", "/src/", "/src/../server.py", "/src/%2e%2e/server.py", "/docs/PRD.md"]:
            with self.subTest(path=path):
                self.assertEqual(browser.call("GET", path)[0], 404)


if __name__ == "__main__":
    unittest.main()
