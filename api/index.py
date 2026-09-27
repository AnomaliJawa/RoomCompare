"""
RoomCompare's API as a Vercel function.

Every /api/* request is rewritten here (vercel.json), and served by the same
Handler that server.py runs locally, so the routes, checks and messages are
the same code. What differs is set up below: storage is Redis rather than a
SQLite file (app_from_env), and the visitor's address comes from the headers
Vercel's edge sets. The app's own files are served by Vercel directly.
"""

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import server  # noqa: E402

# Built on first use and kept while this instance lives: it opens nothing, but
# it hashes a decoy password, which is deliberately slow.
_application = None


# Named neither `app` nor `application`: Vercel's Python runtime serves either
# name in preference to `handler`, as a WSGI or ASGI app, and this is neither.
# The first deploy used `application` and every /api request failed.
def configured_app():
    global _application
    if _application is None:
        _application = server.app_from_env()
    return _application


class handler(server.Handler):
    @property
    def app(self):
        return configured_app()

    def client_ip(self):
        # The connection comes from Vercel's edge, not the visitor. Vercel sets
        # these headers itself, replacing any a client sends.
        forwarded = self.headers.get("X-Forwarded-For", "")
        return self.headers.get("X-Real-IP") or forwarded.split(",")[0].strip() or super().client_ip()
