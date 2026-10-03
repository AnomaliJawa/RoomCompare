"""server.py's Handler as a Vercel function: Redis storage, and the client address from Vercel's headers."""

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import server  # noqa: E402

# Built on first use and kept: it hashes a decoy password, which is deliberately slow.
_application = None


# Not named app or application: Vercel serves either in place of handler, and every request failed.
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
        # Vercel's edge sets these headers itself, replacing any a client sends.
        forwarded = self.headers.get("X-Forwarded-For", "")
        return self.headers.get("X-Real-IP") or forwarded.split(",")[0].strip() or super().client_ip()
