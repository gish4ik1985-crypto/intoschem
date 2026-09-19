#!/usr/bin/env python3
"""Локальный dev-сервер веб-версии.

Две вещи, обе только для разработки:
  1) Cache-Control: no-store — обычный http.server отдавал 304 на уже
     изменённые файлы, и правки не было видно без ручного шифт-релоада.
  2) POST /_snap — принимает PNG (dataURL в теле) и кладёт в _snap/.
     Нужно потому, что скриншот окна/вкладки в этом окружении не
     работает: единственный способ реально ПОСМОТРЕТЬ на отрисованный
     кадр — попросить страницу отрендерить себя в canvas и прислать
     картинку сюда. См. CLAUDE.md, «Проверка перед готово».
"""
import base64
import functools
import http.server
import os
import pathlib

SNAP_DIR = pathlib.Path(__file__).with_name('_snap')


class DevHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Cache-Control', 'no-store, no-cache, must-revalidate')
        self.send_header('Pragma', 'no-cache')
        self.send_header('Expires', '0')
        super().end_headers()

    def do_POST(self):
        if self.path != '/_snap':
            self.send_error(404)
            return
        length = int(self.headers.get('Content-Length', 0))
        body = self.rfile.read(length).decode('utf-8')
        name, _, data_url = body.partition('\n')
        payload = data_url.split(',', 1)[1]
        SNAP_DIR.mkdir(exist_ok=True)
        out = SNAP_DIR / f'{os.path.basename(name) or "snap"}.png'
        out.write_bytes(base64.b64decode(payload))
        self.send_response(200)
        self.send_header('Content-Type', 'text/plain')
        self.end_headers()
        self.wfile.write(str(out).encode('utf-8'))

    def log_message(self, *args):
        pass


if __name__ == '__main__':
    handler = functools.partial(DevHandler, directory='.')
    http.server.ThreadingHTTPServer(('127.0.0.1', 8791), handler).serve_forever()
