"""Kept so `python devserver.py [port]` still works: it starts server.py."""

import sys

import server

if __name__ == "__main__":
    server.main(sys.argv[1:])
