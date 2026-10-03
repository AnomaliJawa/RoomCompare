"""An in-memory Upstash Redis behind its REST API, so the tests exercise the real UpstashTransport."""

import http.server
import json
import threading
import time


class FakeRedis:
    def __init__(self):
        self.data = {}
        self.expires = {}
        self.lock = threading.Lock()

    def __call__(self, commands):
        with self.lock:
            return [self.run(*command) for command in commands]

    def live(self, key):
        if key in self.expires and self.expires[key] <= time.monotonic():
            self.data.pop(key, None)
            self.expires.pop(key, None)
        return key in self.data

    def run(self, name, *args):
        name = name.upper()
        if name == "SET":
            key, value, *options = args
            options = [str(option).upper() for option in options]
            if "NX" in options and self.live(key):
                return None
            self.data[key] = str(value)
            self.expires.pop(key, None)
            if "EX" in options:
                self.expires[key] = time.monotonic() + int(options[options.index("EX") + 1])
            return "OK"
        if name == "GET":
            (key,) = args
            return self.data[key] if self.live(key) else None
        if name == "DEL":
            return sum(1 for key in args if self.live(key) and self.data.pop(key, None) is not None)
        if name == "HSET":
            key, field, value = args
            fields = self.data.setdefault(key, {})
            new = field not in fields
            fields[field] = str(value)
            return int(new)
        if name == "HGET":
            key, field = args
            return self.data.get(key, {}).get(field) if self.live(key) else None
        if name == "HDEL":
            key, *fields = args
            table = self.data.get(key, {})
            return sum(1 for field in fields if table.pop(field, None) is not None)
        if name == "HGETALL":
            (key,) = args
            table = self.data.get(key, {}) if self.live(key) else {}
            return [item for pair in table.items() for item in pair]
        if name == "INCR":
            (key,) = args
            value = int(self.data.get(key, 0) if self.live(key) else 0) + 1
            self.data[key] = str(value)
            return value
        if name == "EXPIRE":
            key, seconds = args
            if not self.live(key):
                return 0
            self.expires[key] = time.monotonic() + int(seconds)
            return 1
        raise ValueError(f"ERR unknown command '{name}'")

    def expire(self, prefix):
        """Let every key under a prefix run out, as if its time had passed."""
        with self.lock:
            for key in [key for key in self.data if key.startswith(prefix)]:
                self.expires[key] = 0


def serve(fake, token):
    """Upstash's REST API in front of `fake`. Returns (httpd, url)."""

    class Upstash(http.server.BaseHTTPRequestHandler):
        def do_POST(self):
            if self.headers.get("Authorization") != f"Bearer {token}":
                return self.reply(401, {"error": "Unauthorized"})
            if self.path != "/pipeline":
                return self.reply(404, {"error": "Not found"})
            commands = json.loads(self.rfile.read(int(self.headers["Content-Length"])))
            replies = []
            for command in commands:
                try:
                    replies.append({"result": fake([command])[0]})
                except ValueError as error:
                    replies.append({"error": str(error)})
            self.reply(200, replies)

        def reply(self, status, payload):
            body = json.dumps(payload).encode("utf-8")
            self.send_response(status)
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)

        def log_message(self, fmt, *args):
            pass

    httpd = http.server.ThreadingHTTPServer(("127.0.0.1", 0), Upstash)
    threading.Thread(target=httpd.serve_forever, daemon=True).start()
    return httpd, f"http://127.0.0.1:{httpd.server_address[1]}"
