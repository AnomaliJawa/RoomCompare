"""The server over real HTTP; the account, throttle and survey suites run on SQLite and on Vercel's Redis path."""

import http.client
import http.cookiejar
import http.server
import importlib.util
import json
import os
import socket
import sqlite3
import subprocess
import sys
import tempfile
import threading
import time
import unittest
import urllib.error
import urllib.parse
import urllib.request
import uuid
from pathlib import Path
from unittest import mock

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT))

import server  # noqa: E402
import fake_upstash  # noqa: E402

_spec = importlib.util.spec_from_file_location("vercel_index", ROOT / "api" / "index.py")
vercel = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(vercel)

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

    def call_with_late_body(self, method, path, raw, headers=None):
        """Sends the body 50 ms after the headers, as a slow client would; reads the reply 50 ms later."""
        request = urllib.request.Request(self.base + path, headers=headers or {})
        self.jar.add_cookie_header(request)
        url = urllib.parse.urlsplit(self.base)
        head = [f"{method} {path} HTTP/1.1", f"Host: {url.netloc}", f"Content-Length: {len(raw)}"]
        head += [f"{name}: {value}" for name, value in request.header_items()]
        with socket.create_connection((url.hostname, url.port)) as sock:
            sock.sendall(("\r\n".join(head) + "\r\n\r\n").encode("latin-1"))
            time.sleep(0.05)
            sock.sendall(raw)
            time.sleep(0.05)
            with http.client.HTTPResponse(sock) as response:
                response.begin()
                payload = response.read()
        content_type = response.headers.get("Content-Type", "")
        return response.status, (json.loads(payload) if payload and "json" in content_type else payload), response.headers

    def register(self, email=None, password="correct horse", name="Rahma"):
        email = email or f"{uuid.uuid4().hex[:10]}@example.com"
        status, body, headers = self.call("POST", "/api/register", {"name": name, "email": email, "password": password})
        return status, body, headers, email


def send_raw(address, request):
    """A request exactly as written, which urllib will not send: it writes Content-Length itself."""
    with socket.create_connection(address, timeout=10) as connection:
        connection.sendall(request)
        # Half-closed, so a server that reads to the end of the stream answers instead of waiting.
        connection.shutdown(socket.SHUT_WR)
        reply = b""
        while chunk := connection.recv(65536):
            reply += chunk
    head, _, body = reply.partition(b"\r\n\r\n")
    return int(head.split(b" ", 2)[1]), json.loads(body)


class ServerTestCase(unittest.TestCase):
    login_limit = server.LOGIN_LIMIT

    @classmethod
    def setUpClass(cls):
        cls.httpd = cls.start()
        cls.base = f"http://127.0.0.1:{cls.httpd.server_address[1]}"
        cls.thread = threading.Thread(target=cls.httpd.serve_forever, daemon=True)
        cls.thread.start()

    @classmethod
    def start(cls):
        cls.tmp = tempfile.TemporaryDirectory(ignore_cleanup_errors=True)
        cls.db_path = Path(cls.tmp.name) / "test.sqlite3"
        return server.create_server("127.0.0.1", 0, cls.db_path, iterations=1000, login_limit=cls.login_limit)

    @classmethod
    def tearDownClass(cls):
        cls.httpd.shutdown()
        cls.httpd.server_close()
        cls.stop()

    @classmethod
    def stop(cls):
        cls.tmp.cleanup()

    def client(self):
        return Client(self.base)


    def expire_sessions(self):
        with sqlite3.connect(self.db_path) as db:
            db.execute("UPDATE sessions SET expires_at = '2000-01-01T00:00:00Z'")

    def stored_password_hash(self, email):
        with sqlite3.connect(self.db_path) as db:
            return db.execute("SELECT password_hash FROM users WHERE email = ?", (email,)).fetchone()[0]


class OnVercel:
    """The production shape: the Vercel function, Redis, Upstash's REST API."""

    TOKEN = "test-token"

    @classmethod
    def start(cls):
        cls.redis = fake_upstash.FakeRedis()
        cls.upstash, url = fake_upstash.serve(cls.redis, cls.TOKEN)
        send = server.UpstashTransport(url, cls.TOKEN)
        # Plain http in the tests, so no Secure cookie; production sets it.
        vercel._application = server.App(
            server.RedisBackend(send), 1000, False, server.RedisThrottle(send, cls.login_limit, server.LOGIN_WINDOW_SECONDS)
        )
        return http.server.ThreadingHTTPServer(("127.0.0.1", 0), vercel.handler)

    @classmethod
    def stop(cls):
        cls.upstash.shutdown()
        cls.upstash.server_close()
        vercel._application = None

    def expire_sessions(self):
        self.redis.expire("rc:session:")

    def stored_password_hash(self, email):
        user_id = self.redis.data[f"rc:email:{email}"]
        return json.loads(self.redis.data[f"rc:user:{user_id}"])["password_hash"]


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
        self.expire_sessions()
        self.assertEqual(browser.call("GET", "/api/me")[0], 401)

    def test_passwords_are_stored_only_as_salted_hashes(self):
        _, _, _, email = self.client().register(password="a very secret phrase")
        stored = self.stored_password_hash(email)
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

    def test_a_negative_length_is_refused_without_reading_the_body(self):
        # A negative length slipped under MAX_BODY: rfile.read(-1) reads to the end of the stream.
        login = json.dumps({"email": "nobody@example.com", "password": "wrong password"}).encode("utf-8")
        for length in ("-1", "-2"):
            with self.subTest(length=length):
                head = f"POST /api/login HTTP/1.0\r\nContent-Type: application/json\r\nContent-Length: {length}\r\n\r\n"
                status, body = send_raw(self.httpd.server_address, head.encode("ascii") + login)
                self.assertEqual(status, 400)
                self.assertEqual(body["error"], "That request could not be read.")

    def test_writes_from_another_site_are_refused(self):
        browser = self.client()
        _, _, _, email = browser.register(password="right password")
        status, body, _ = self.client().call(
            "POST", "/api/login", {"email": email, "password": "right password"}, headers={"Origin": "http://evil.example"}
        )
        self.assertEqual(status, 403)
        same_site = self.client().call("POST", "/api/login", {"email": email, "password": "right password"}, headers={"Origin": self.base})
        self.assertEqual(same_site[0], 200)

    def test_a_refusal_arrives_even_when_the_body_comes_late(self):
        # Refused before the body was read, the reply was lost to a reset on Windows about one run in three.
        browser = self.client()
        browser.register()
        record = json.dumps({"survey": survey("svy-a")}).encode("utf-8")
        too_big = json.dumps({"survey": survey("svy-a") | {"notes": "x" * 1_100_000}}).encode("utf-8")
        as_json = {"Content-Type": "application/json"}
        cases = [
            (browser, record, as_json | {"Origin": "http://evil.example"}, 403, "Requests from other sites are not accepted."),
            (self.client(), record, as_json, 401, "Log in to continue."),
            (browser, b"id=svy-a", {"Content-Type": "application/x-www-form-urlencoded"}, 415, "Send the request as JSON."),
            (browser, too_big, as_json, 413, "That is too large to save."),
        ]
        for client, raw, headers, status, message in cases:
            with self.subTest(status=status):
                reply = client.call_with_late_body("PUT", "/api/surveys/svy-a", raw, headers)
                self.assertEqual(reply[:2], (status, {"error": message}))


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


# --- The same suites on Vercel ---


class VercelAccounts(OnVercel, Accounts):
    pass


class VercelThrottle(OnVercel, Throttle):
    pass


class VercelSurveys(OnVercel, Surveys):
    pass


class VercelOnly(OnVercel, ServerTestCase):
    login_limit = 2

    def test_the_throttle_counts_each_visitor_by_the_address_vercel_forwards(self):
        _, _, _, email = self.client().register(password="right password")
        wrong = {"email": email, "password": "nope nope"}
        for _ in range(2):
            self.client().call("POST", "/api/login", wrong, headers={"X-Forwarded-For": "203.0.113.7"})
        blocked = self.client().call("POST", "/api/login", wrong, headers={"X-Forwarded-For": "203.0.113.7"})
        self.assertEqual(blocked[0], 429)
        # Another visitor is not held up by the first one's failures.
        other = self.client().call("POST", "/api/login", wrong, headers={"X-Forwarded-For": "198.51.100.4"})
        self.assertEqual(other[0], 401)

    def test_without_storage_it_says_so_instead_of_failing(self):
        kept = vercel._application
        vercel._application = None
        try:
            with mock.patch.dict(os.environ, {}, clear=True):
                # Logging in is the first thing that needs storage; a cookieless who-am-I rightly answers 401.
                status, body, _ = self.client().call("POST", "/api/login", {"email": "a@b.co", "password": "longenough"})
        finally:
            vercel._application = kept
        self.assertEqual(status, 503)
        self.assertIn("storage is not connected", body["error"])

    def test_either_upstash_naming_configures_redis_and_secure_cookies(self):
        for names in (("UPSTASH_REDIS_REST_URL", "UPSTASH_REDIS_REST_TOKEN"), ("KV_REST_API_URL", "KV_REST_API_TOKEN")):
            env = {names[0]: "https://example.upstash.io", names[1]: "token", "ROOMCOMPARE_PBKDF2_ITERATIONS": "1000"}
            with self.subTest(names=names), mock.patch.dict(os.environ, env, clear=True):
                app = server.app_from_env()
                self.assertIsInstance(app.backend, server.RedisBackend)
                self.assertIsInstance(app.throttle, server.RedisThrottle)
                self.assertTrue(app.secure_cookies)
                self.assertEqual(app.backend.send.url, "https://example.upstash.io/pipeline")

    def test_nothing_in_the_function_looks_like_a_wsgi_or_asgi_app(self):
        # Vercel serves a module-level app or application instead of handler; one deploy failed on it.
        for name in ("app", "application"):
            self.assertFalse(hasattr(vercel, name), f"api/index.py defines `{name}`")

    def test_the_redis_client_runs_on_server_pys_own_imports(self):
        # Run in a fresh interpreter: this file's urllib.request import once hid server.py missing it.
        script = (
            "import sys\n"
            "sys.path[:0] = sys.argv[1:3]\n"
            "import server, fake_upstash\n"
            "httpd, url = fake_upstash.serve(fake_upstash.FakeRedis(), 'token')\n"
            "print(server.UpstashTransport(url, 'token')([['SET', 'k', 'v'], ['GET', 'k']]))\n"
            "httpd.shutdown()\n"
        )
        done = subprocess.run(
            [sys.executable, "-c", script, str(ROOT), str(Path(__file__).parent)],
            capture_output=True, text=True, timeout=60,
        )
        self.assertEqual(done.returncode, 0, done.stderr)
        self.assertEqual(done.stdout.strip(), "['OK', 'v']")


if __name__ == "__main__":
    unittest.main()
