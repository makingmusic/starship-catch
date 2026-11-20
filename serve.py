#!/usr/bin/env python3
"""Serve this folder on every interface.

Relative picture URLs break when the tailnet address is opened without a
trailing slash, because the browser then looks for /media at the host root.
HTML responses get a base URL: /starship-catch/ behind Tailscale, / otherwise.
"""
import os
import socket
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

ROOT = Path(__file__).resolve().parent
PORT = 8911


class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)

    def base_href(self):
        host = self.headers.get("X-Forwarded-Host", "")
        if host.endswith(".ts.net"):
            return "/starship-catch/"
        return "/"

    def send_html(self, path):
        data = Path(path).read_bytes()
        base = self.base_href().encode()
        tag = b'<base href="' + base + b'">'
        if b"<base " not in data.lower() and b"<head>" in data:
            data = data.replace(b"<head>", b"<head>\n  " + tag, 1)
        self.send_response(200)
        self.send_header("Content-Type", "text/html; charset=utf-8")
        self.send_header("Content-Length", str(len(data)))
        self.send_header("Cache-Control", "no-cache")
        self.end_headers()
        self.wfile.write(data)

    def do_GET(self):
        path = self.translate_path(self.path)
        if os.path.isdir(path):
            index = os.path.join(path, "index.html")
            if os.path.isfile(index):
                path = index
        if path.endswith(".html") and os.path.isfile(path):
            self.send_html(path)
            return
        super().do_GET()


class DualStackServer(ThreadingHTTPServer):
    address_family = socket.AF_INET6
    daemon_threads = True
    request_queue_size = 128

    def server_bind(self):
        self.socket.setsockopt(socket.IPPROTO_IPV6, socket.IPV6_V6ONLY, 0)
        super().server_bind()


if __name__ == "__main__":
    DualStackServer(("::", PORT), Handler).serve_forever()
