#!/usr/bin/env python3
# -*- coding: utf-8 -*-
# 本地预览服务：禁用一切缓存，强制浏览器每次都拉最新文件
import http.server
import socketserver
import os

PORT = 8020
ROOT = os.path.dirname(os.path.abspath(__file__))


class NoCacheHandler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=ROOT, **kwargs)

    def end_headers(self):
        self.send_header("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0")
        self.send_header("Pragma", "no-cache")
        self.send_header("Expires", "0")
        super().end_headers()

    def log_message(self, fmt, *args):
        pass  # 静默


class ReusableTCPServer(socketserver.ThreadingTCPServer):
    # 多线程：单线程会在拉取 23MB 视频时阻塞 tracks.json 等并发请求
    allow_reuse_address = True
    daemon_threads = True


if __name__ == "__main__":
    with ReusableTCPServer(("127.0.0.1", PORT), NoCacheHandler) as httpd:
        print(f"[preview] serving {ROOT} on http://127.0.0.1:{PORT} (no-cache, threaded)")
        httpd.serve_forever()
