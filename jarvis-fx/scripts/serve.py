#!/usr/bin/env python3
"""Serve a built JARVIS FX folder (dist/ by default) on http://localhost:8080.

    python scripts/serve.py    # repository: serves ../dist after `npm run build`
    python serve.py            # packaged zip: serves the folder this file sits in
    python serve.py <folder> [port]   (or: python serve.py 9000)

Always sends the right MIME types. On some Windows setups the registry maps .js to text/plain,
and then the browser refuses the module scripts and shows a blank page; this script avoids that.
Stop with Ctrl+C.
"""
import http.server
import os
import socketserver
import sys

HERE = os.path.dirname(os.path.abspath(__file__))


def pick_root():
    # packaged: index.html sits next to this file; repository: the build is in ../dist (or ./dist)
    for c in (HERE, os.path.join(HERE, 'dist'), os.path.join(HERE, '..', 'dist'), os.path.join(os.getcwd(), 'dist')):
        if os.path.isfile(os.path.join(c, 'index.html')):
            return os.path.abspath(c)
    return HERE


ARGS = sys.argv[1:]
PORT = 8080
if ARGS and ARGS[0].isdigit():  # python serve.py 9000
    PORT = int(ARGS.pop(0))
ROOT = os.path.abspath(ARGS[0]) if ARGS else pick_root()
if len(ARGS) > 1:
    PORT = int(ARGS[1])

TYPES = {
    '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.html': 'text/html',
    '.json': 'application/json', '.svg': 'image/svg+xml', '.wav': 'audio/wav', '.mp3': 'audio/mpeg',
    '.jpg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp', '.woff2': 'font/woff2',
    '.woff': 'font/woff', '.ttf': 'font/ttf', '.wasm': 'application/wasm',
}


class Handler(http.server.SimpleHTTPRequestHandler):
    extensions_map = dict(http.server.SimpleHTTPRequestHandler.extensions_map, **TYPES)

    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=ROOT, **kwargs)

    def log_message(self, fmt, *args):  # keep the console quiet
        pass


def main():
    if not os.path.isfile(os.path.join(ROOT, 'index.html')):
        sys.exit('Nie znaleziono index.html w: ' + ROOT + '\nZbuduj aplikację (npm run build) albo podaj folder z buildem.')
    socketserver.ThreadingTCPServer.allow_reuse_address = True
    print('JARVIS FX – serwuję:', ROOT)
    print('Otwórz w przeglądarce: http://localhost:%d/   (Ctrl+C kończy)' % PORT)
    with socketserver.ThreadingTCPServer(('127.0.0.1', PORT), Handler) as httpd:
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print('\nZatrzymano.')


if __name__ == '__main__':
    main()
