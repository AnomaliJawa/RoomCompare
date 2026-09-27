"""
RoomCompare server: the app's own files, plus a small JSON API for accounts
and survey records.

Python's standard library only, so there is nothing to install. One SQLite
file holds users, sessions and surveys: data/roomcompare.sqlite3, unless
--db or the ROOMCOMPARE_DB environment variable says otherwise.

    python server.py [port] [--host HOST] [--db PATH]

It replaces devserver.py and keeps what that did: every response says
no-store. Plain http.server lets the browser keep serving a stale stylesheet
or module after an edit, which looks exactly like a change that did not work.

Photos are not sent here. They stay in the browser's IndexedDB on the device
that took them; only survey records travel.

http.server is not a hardened production server. This is sized for a
usability study and a classroom demo. docs/ARCHITECTURE.md says what to
change before it faces the open internet.
"""

import argparse
import base64
import functools
import hashlib
import hmac
import http.cookies
import http.server
import json
import os
import posixpath
import re
import secrets
import socket
import sqlite3
import sys
import threading
import time
import urllib.parse
import uuid
from contextlib import contextmanager
from datetime import datetime, timedelta, timezone
from http import HTTPStatus
from pathlib import Path

ROOT = Path(__file__).resolve().parent
DEFAULT_DB = ROOT / "data" / "roomcompare.sqlite3"

SESSION_COOKIE = "rc_session"
SESSION_DAYS = 30

# OWASP's 2023 figure for PBKDF2-HMAC-SHA256. Each hash records its own count,
# so raising this later does not lock anyone out.
DEFAULT_ITERATIONS = 600_000

# A survey record is a few kilobytes; photos never travel through here.
MAX_BODY = 1_000_000
MAX_SURVEY_BYTES = 256_000

NAME_MAX = 60
EMAIL_MAX = 254
PASSWORD_MIN = 8
PASSWORD_MAX = 128
EMAIL_PATTERN = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
SURVEY_ID_PATTERN = re.compile(r"^[A-Za-z0-9][A-Za-z0-9_-]{0,99}$")

LOGIN_LIMIT = 10
LOGIN_WINDOW_SECONDS = 15 * 60

# Only the app's own files are served. Everything else in the project — the
# database, this file, the tests, git metadata — is not for the browser.
STATIC_FILES = {"/", "/index.html", "/favicon.ico", "/site.webmanifest"}
STATIC_PREFIXES = ("/src/", "/styles/", "/icons/", "/seed-photos/", "/design/")

SCHEMA = """
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE COLLATE NOCASE,
  name TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS sessions (
  token_hash TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS surveys (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  id TEXT NOT NULL,
  data TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (user_id, id)
);
"""


def utcnow():
    return datetime.now(timezone.utc)


def stamp(moment):
    # One fixed format, so stored timestamps compare correctly as strings.
    return moment.strftime("%Y-%m-%dT%H:%M:%SZ")


def b64(raw):
    return base64.b64encode(raw).decode("ascii")


def token_digest(token):
    # Only a hash of the session token is stored: a copied database does not
    # hand out working sessions.
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def hash_password(password, iterations):
    salt = secrets.token_bytes(16)
    digest = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt, iterations)
    return f"pbkdf2_sha256${iterations}${b64(salt)}${b64(digest)}"


def verify_password(password, stored):
    try:
        scheme, iterations, salt, digest = stored.split("$")
        if scheme != "pbkdf2_sha256":
            return False
        candidate = hashlib.pbkdf2_hmac(
            "sha256", password.encode("utf-8"), base64.b64decode(salt), int(iterations)
        )
        return hmac.compare_digest(candidate, base64.b64decode(digest))
    except (ValueError, TypeError):
        return False


class ApiError(Exception):
    def __init__(self, status, message, errors=None):
        super().__init__(message)
        self.status = status
        self.message = message
        self.errors = errors


# --- Validation ---------------------------------------------------------------
# The same rules and wording as src/utils/validate.js. The browser checks
# first, so these messages are only seen when something bypasses it.


def check_email(email, errors):
    if not email:
        errors["email"] = "Enter your email address."
    elif len(email) > EMAIL_MAX or not EMAIL_PATTERN.match(email):
        errors["email"] = "Enter an email address like name@example.com."


def check_registration(body):
    errors = {}
    name = str(body.get("name") or "").strip()
    email = str(body.get("email") or "").strip().lower()
    password = body.get("password")
    if not name:
        errors["name"] = "Enter your name."
    elif len(name) > NAME_MAX:
        errors["name"] = f"Use {NAME_MAX} characters or fewer."
    check_email(email, errors)
    if not isinstance(password, str) or len(password) < PASSWORD_MIN:
        errors["password"] = f"Use at least {PASSWORD_MIN} characters."
    elif len(password) > PASSWORD_MAX:
        errors["password"] = f"Use {PASSWORD_MAX} characters or fewer."
    return errors, name, email, password


def check_login(body):
    errors = {}
    email = str(body.get("email") or "").strip().lower()
    password = body.get("password")
    check_email(email, errors)
    if not isinstance(password, str) or not password:
        errors["password"] = "Enter your password."
    return errors, email, password


def first_error(errors):
    return next(iter(errors.values()))


# --- Storage ------------------------------------------------------------------


class Store:
    """SQLite, one short-lived connection per request.

    The server handles each request on its own thread, and a sqlite3
    connection must not be shared between threads.
    """

    def __init__(self, path):
        self.path = str(path)
        Path(self.path).parent.mkdir(parents=True, exist_ok=True)
        with self.transaction() as db:
            # WAL lets a read and a write overlap instead of queueing.
            db.execute("PRAGMA journal_mode = WAL")
            db.executescript(SCHEMA)

    def connect(self):
        db = sqlite3.connect(self.path, timeout=5)
        db.row_factory = sqlite3.Row
        db.execute("PRAGMA foreign_keys = ON")
        return db

    @contextmanager
    def transaction(self):
        db = self.connect()
        try:
            yield db
            db.commit()
        except Exception:
            db.rollback()
            raise
        finally:
            db.close()


class LoginThrottle:
    """Refuses further logins after too many failures for one address and email.

    Held in memory: a restart forgets it, which is fine at this scale.
    """

    def __init__(self, limit, window):
        self.limit = limit
        self.window = window
        self.failures = {}
        self.lock = threading.Lock()

    def _recent(self, key):
        cutoff = time.monotonic() - self.window
        recent = [moment for moment in self.failures.get(key, []) if moment > cutoff]
        self.failures[key] = recent
        return recent

    def blocked(self, key):
        with self.lock:
            return len(self._recent(key)) >= self.limit

    def fail(self, key):
        with self.lock:
            self._recent(key).append(time.monotonic())

    def reset(self, key):
        with self.lock:
            self.failures.pop(key, None)


class App:
    def __init__(self, store, iterations, secure_cookies, throttle):
        self.store = store
        self.iterations = iterations
        self.secure_cookies = secure_cookies
        self.throttle = throttle
        # Checked against when the email is unknown, so a wrong address takes
        # as long to refuse as a wrong password and does not reveal which
        # emails have accounts.
        self.decoy_hash = hash_password(secrets.token_hex(16), iterations)


# --- HTTP ---------------------------------------------------------------------


def clean_path(raw_path):
    path = urllib.parse.unquote(urllib.parse.urlsplit(raw_path).path)
    return posixpath.normpath(path) if path else "/"


def static_allowed(path):
    if path in STATIC_FILES:
        return True
    return any(path.startswith(prefix) for prefix in STATIC_PREFIXES)


class Handler(http.server.SimpleHTTPRequestHandler):
    server_version = "RoomCompare"

    @property
    def app(self):
        return self.server.app

    # --- Static files ---------------------------------------------------------

    def end_headers(self):
        self.send_header("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0")
        self.send_header("Pragma", "no-cache")
        self.send_header("Expires", "0")
        self.send_header("X-Content-Type-Options", "nosniff")
        # Not "same-origin": OpenStreetMap's tile and Nominatim policies refuse
        # browser requests that arrive without a Referer, and the map would
        # stop loading. This is the browser default, stated explicitly.
        self.send_header("Referrer-Policy", "strict-origin-when-cross-origin")
        self.send_header("X-Frame-Options", "DENY")
        super().end_headers()

    def list_directory(self, path):
        # No directory listings: the allowlist decides what is visible.
        self.send_error(HTTPStatus.NOT_FOUND)
        return None

    def do_GET(self):
        path = clean_path(self.path)
        if path.startswith("/api/"):
            return self.api("GET", path)
        if not static_allowed(path):
            return self.send_error(HTTPStatus.NOT_FOUND)
        return super().do_GET()

    def do_HEAD(self):
        path = clean_path(self.path)
        if path.startswith("/api/") or not static_allowed(path):
            return self.send_error(HTTPStatus.NOT_FOUND)
        return super().do_HEAD()

    def do_POST(self):
        self.api("POST", clean_path(self.path))

    def do_PUT(self):
        self.api("PUT", clean_path(self.path))

    def do_DELETE(self):
        self.api("DELETE", clean_path(self.path))

    def log_message(self, fmt, *args):
        # Quieter than a line per asset, but never swallow problems. A 401 is
        # not one: it is how every logged-out visit begins. Request bodies are
        # never logged: they hold passwords.
        message = fmt % args
        if re.search(r'" (?!401 )[45]\d\d ', message):
            super().log_message("%s", message)

    # --- API plumbing -----------------------------------------------------------

    def api(self, method, path):
        try:
            if not path.startswith("/api/"):
                raise ApiError(HTTPStatus.METHOD_NOT_ALLOWED, "That is not something this server does.")
            if method != "GET":
                self.refuse_cross_site()
            self.route(method, path)
        except ApiError as error:
            payload = {"error": error.message}
            if error.errors:
                payload["errors"] = error.errors
            self.send_json(error.status, payload)
        except Exception as error:  # pragma: no cover - a last resort, logged
            self.log_error("API failure on %s %s: %r", method, path, error)
            self.send_json(HTTPStatus.INTERNAL_SERVER_ERROR, {"error": "The server could not complete that. Try again."})

    def route(self, method, path):
        if path == "/api/register" and method == "POST":
            return self.register()
        if path == "/api/login" and method == "POST":
            return self.login()
        if path == "/api/logout" and method == "POST":
            return self.logout()
        if path == "/api/me" and method == "GET":
            return self.send_json(HTTPStatus.OK, {"user": self.require_user()})
        if path == "/api/surveys" and method == "GET":
            return self.list_surveys(self.require_user())
        if path.startswith("/api/surveys/"):
            survey_id = path[len("/api/surveys/"):]
            if not SURVEY_ID_PATTERN.match(survey_id):
                raise ApiError(HTTPStatus.NOT_FOUND, "There is no survey at that address.")
            if method == "PUT":
                return self.put_survey(self.require_user(), survey_id)
            if method == "DELETE":
                return self.delete_survey(self.require_user(), survey_id)
        raise ApiError(HTTPStatus.NOT_FOUND, "That is not something this server does.")

    def refuse_cross_site(self):
        """Writes must come from this site's own pages.

        The session cookie is SameSite=Lax and writes only accept JSON, which a
        plain cross-site form cannot send. This is a third check on top.
        """
        origin = self.headers.get("Origin")
        if origin is None:
            return
        if urllib.parse.urlsplit(origin).netloc != self.headers.get("Host"):
            raise ApiError(HTTPStatus.FORBIDDEN, "Requests from other sites are not accepted.")

    def read_json(self):
        if self.headers.get_content_type() != "application/json":
            raise ApiError(HTTPStatus.UNSUPPORTED_MEDIA_TYPE, "Send the request as JSON.")
        try:
            length = int(self.headers.get("Content-Length", "0"))
        except ValueError:
            raise ApiError(HTTPStatus.BAD_REQUEST, "That request could not be read.")
        if length > MAX_BODY:
            raise ApiError(HTTPStatus.REQUEST_ENTITY_TOO_LARGE, "That is too large to save.")
        try:
            body = json.loads(self.rfile.read(length) or b"{}")
        except (ValueError, UnicodeDecodeError):
            raise ApiError(HTTPStatus.BAD_REQUEST, "That request could not be read.")
        if not isinstance(body, dict):
            raise ApiError(HTTPStatus.BAD_REQUEST, "That request could not be read.")
        return body

    def send_json(self, status, payload=None, cookie=None):
        body = b"" if payload is None else json.dumps(payload).encode("utf-8")
        self.send_response(status)
        if cookie:
            self.send_header("Set-Cookie", cookie)
        if status != HTTPStatus.NO_CONTENT:
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        if body:
            self.wfile.write(body)

    # --- Sessions ---------------------------------------------------------------

    def session_token(self):
        try:
            cookies = http.cookies.SimpleCookie(self.headers.get("Cookie", ""))
        except http.cookies.CookieError:
            return None
        morsel = cookies.get(SESSION_COOKIE)
        return morsel.value if morsel and morsel.value else None

    def cookie(self, value, max_age):
        parts = [f"{SESSION_COOKIE}={value}", "Path=/", "HttpOnly", "SameSite=Lax", f"Max-Age={max_age}"]
        # Secure is set whenever the page arrived over HTTPS. Plain http on
        # localhost has to work without it.
        if self.app.secure_cookies or self.headers.get("X-Forwarded-Proto") == "https":
            parts.append("Secure")
        return "; ".join(parts)

    def start_session(self, db, user_id):
        token = secrets.token_urlsafe(32)
        now = utcnow()
        db.execute("DELETE FROM sessions WHERE expires_at <= ?", (stamp(now),))
        db.execute(
            "INSERT INTO sessions (token_hash, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)",
            (token_digest(token), user_id, stamp(now), stamp(now + timedelta(days=SESSION_DAYS))),
        )
        return self.cookie(token, SESSION_DAYS * 24 * 60 * 60)

    def current_user(self):
        token = self.session_token()
        if not token:
            return None
        with self.app.store.transaction() as db:
            row = db.execute(
                "SELECT users.id, users.email, users.name, sessions.expires_at FROM sessions"
                " JOIN users ON users.id = sessions.user_id WHERE sessions.token_hash = ?",
                (token_digest(token),),
            ).fetchone()
            if row is None:
                return None
            if row["expires_at"] <= stamp(utcnow()):
                db.execute("DELETE FROM sessions WHERE token_hash = ?", (token_digest(token),))
                return None
            return {"id": row["id"], "email": row["email"], "name": row["name"]}

    def require_user(self):
        user = self.current_user()
        if user is None:
            raise ApiError(HTTPStatus.UNAUTHORIZED, "Log in to continue.")
        return user

    # --- Accounts ---------------------------------------------------------------

    def register(self):
        errors, name, email, password = check_registration(self.read_json())
        if errors:
            raise ApiError(HTTPStatus.BAD_REQUEST, first_error(errors), errors)
        user = {"id": uuid.uuid4().hex, "email": email, "name": name}
        password_hash = hash_password(password, self.app.iterations)
        try:
            with self.app.store.transaction() as db:
                db.execute(
                    "INSERT INTO users (id, email, name, password_hash, created_at) VALUES (?, ?, ?, ?, ?)",
                    (user["id"], email, name, password_hash, stamp(utcnow())),
                )
                cookie = self.start_session(db, user["id"])
        except sqlite3.IntegrityError:
            message = "An account with that email already exists. Log in instead."
            raise ApiError(HTTPStatus.CONFLICT, message, {"email": message})
        self.send_json(HTTPStatus.CREATED, {"user": user}, cookie=cookie)

    def login(self):
        errors, email, password = check_login(self.read_json())
        if errors:
            raise ApiError(HTTPStatus.BAD_REQUEST, first_error(errors), errors)
        key = f"{self.client_address[0]}|{email}"
        if self.app.throttle.blocked(key):
            raise ApiError(HTTPStatus.TOO_MANY_REQUESTS, "Too many attempts. Wait a few minutes, then try again.")
        with self.app.store.transaction() as db:
            row = db.execute("SELECT id, email, name, password_hash FROM users WHERE email = ?", (email,)).fetchone()
            matched = verify_password(password, row["password_hash"] if row else self.app.decoy_hash)
            if row is None or not matched:
                self.app.throttle.fail(key)
                # One message for both cases: which half was wrong is not the
                # server's to say.
                raise ApiError(HTTPStatus.UNAUTHORIZED, "Email or password is incorrect.")
            cookie = self.start_session(db, row["id"])
        self.app.throttle.reset(key)
        self.send_json(HTTPStatus.OK, {"user": {"id": row["id"], "email": row["email"], "name": row["name"]}}, cookie=cookie)

    def logout(self):
        token = self.session_token()
        if token:
            with self.app.store.transaction() as db:
                db.execute("DELETE FROM sessions WHERE token_hash = ?", (token_digest(token),))
        self.send_json(HTTPStatus.NO_CONTENT, cookie=self.cookie("", 0))

    # --- Surveys ----------------------------------------------------------------
    # Records are stored as the app sends them. Validation belongs to the app,
    # which knows a draft from a published survey; the server only makes sure
    # each account sees and changes nothing but its own.

    def list_surveys(self, user):
        with self.app.store.transaction() as db:
            rows = db.execute(
                "SELECT data FROM surveys WHERE user_id = ? ORDER BY created_at DESC, rowid DESC",
                (user["id"],),
            ).fetchall()
        self.send_json(HTTPStatus.OK, {"surveys": [json.loads(row["data"]) for row in rows]})

    def put_survey(self, user, survey_id):
        survey = self.read_json().get("survey")
        if not isinstance(survey, dict) or survey.get("id") != survey_id:
            raise ApiError(HTTPStatus.BAD_REQUEST, "The survey sent does not match its address.")
        data = json.dumps(survey, separators=(",", ":"), ensure_ascii=False)
        if len(data.encode("utf-8")) > MAX_SURVEY_BYTES:
            raise ApiError(HTTPStatus.REQUEST_ENTITY_TOO_LARGE, "That survey is too large to save.")
        now = stamp(utcnow())
        created = survey.get("createdAt") if isinstance(survey.get("createdAt"), str) else now
        with self.app.store.transaction() as db:
            db.execute(
                "INSERT INTO surveys (user_id, id, data, created_at, updated_at) VALUES (?, ?, ?, ?, ?)"
                " ON CONFLICT (user_id, id) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at",
                (user["id"], survey_id, data, created, now),
            )
        self.send_json(HTTPStatus.NO_CONTENT)

    def delete_survey(self, user, survey_id):
        # Deleting what is already gone succeeds: a retried delete after a
        # dropped connection must not look like a failure.
        with self.app.store.transaction() as db:
            db.execute("DELETE FROM surveys WHERE user_id = ? AND id = ?", (user["id"], survey_id))
        self.send_json(HTTPStatus.NO_CONTENT)


class Server(http.server.ThreadingHTTPServer):
    # Threading matters: a browser opens several connections at once for the
    # module graph, and a single-threaded server serialises them into a hang.
    daemon_threads = True
    allow_reuse_address = True


class DualStackServer(Server):
    """Listens on IPv6 and IPv4 at once.

    On Windows "localhost" resolves to ::1 first. A server listening on IPv4
    alone makes every request to it wait for that attempt to fail — about two
    seconds per request from Python, a few hundred milliseconds in a browser.
    `python -m http.server` avoids it the same way.
    """

    address_family = socket.AF_INET6

    def server_bind(self):
        try:
            self.socket.setsockopt(socket.IPPROTO_IPV6, socket.IPV6_V6ONLY, 0)
        except (AttributeError, OSError):
            pass
        return super().server_bind()


def create_server(host="", port=5173, db_path=None, *, iterations=None, secure_cookies=None, login_limit=LOGIN_LIMIT, root=ROOT):
    """Build the server without starting it; the tests start it on port 0."""
    db_path = db_path or os.environ.get("ROOMCOMPARE_DB") or DEFAULT_DB
    iterations = iterations or int(os.environ.get("ROOMCOMPARE_PBKDF2_ITERATIONS", DEFAULT_ITERATIONS))
    if secure_cookies is None:
        secure_cookies = os.environ.get("ROOMCOMPARE_SECURE_COOKIES") == "1"
    app = App(Store(db_path), iterations, secure_cookies, LoginThrottle(login_limit, LOGIN_WINDOW_SECONDS))
    handler = functools.partial(Handler, directory=str(root))
    # Every interface by default, both address families, so "localhost" is
    # fast and a phone on the same network can still reach the app.
    if host in ("", "::") and socket.has_ipv6:
        httpd = DualStackServer(("::", port), handler)
    else:
        httpd = Server((host, port), handler)
    httpd.app = app
    return httpd


def main(argv=None):
    parser = argparse.ArgumentParser(description="RoomCompare: the app and its API.")
    parser.add_argument("port", nargs="?", type=int, default=5173)
    # Every interface by default, as devserver.py did, so a phone on the same
    # network can open the app for testing.
    parser.add_argument("--host", default="")
    parser.add_argument("--db", default=None, help="SQLite file (default: data/roomcompare.sqlite3)")
    args = parser.parse_args(argv)

    httpd = create_server(args.host, args.port, args.db)
    print(f"RoomCompare on http://localhost:{args.port} (API at /api, data in {httpd.app.store.path})")
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        httpd.server_close()


if __name__ == "__main__":
    main(sys.argv[1:])
