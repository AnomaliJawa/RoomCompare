"""
Kept so that `python devserver.py [port]` still works. It now starts
server.py, which serves the app and its API: the app needs the API to log in,
so a static server alone can no longer run it.
"""

import sys

import server

if __name__ == "__main__":
    server.main(sys.argv[1:])
