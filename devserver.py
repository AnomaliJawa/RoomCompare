"""
Static dev server for RoomCompare.

Identical to `python -m http.server` except that it tells the browser not to
cache anything. Plain http.server sends only Last-Modified, so browsers apply
heuristic caching and keep serving stale stylesheets and ES modules after an
edit — which looks exactly like a change that did not work.

    python devserver.py [port]
"""

import http.server
import sys

PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 5173


class NoCacheHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0")
        self.send_header("Pragma", "no-cache")
        self.send_header("Expires", "0")
        super().end_headers()

    def log_message(self, fmt, *args):
        # Quieter than one line per asset, but never swallow problems.
        message = fmt % args
        if " 404 " in message or " 500 " in message:
            super().log_message("%s", message)


if __name__ == "__main__":
    # Threading matters: a browser opens several connections at once for the
    # module graph, and a single-threaded server serialises them into a hang.
    http.server.ThreadingHTTPServer.allow_reuse_address = True
    with http.server.ThreadingHTTPServer(("", PORT), NoCacheHandler) as httpd:
        print(f"RoomCompare dev server on http://localhost:{PORT} (caching disabled)")
        httpd.serve_forever()
