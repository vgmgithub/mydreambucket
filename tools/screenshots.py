"""Take the website's pictures of the app (site/shot-*.webp) from the real app, filled with the example list.

    python tools/screenshots.py [address of this folder]     (default: http://localhost/mynote-app/bucketlist/)

Starts Chrome without a window (its own empty profile, deleted afterwards), opens app.html?testdb=1 (a separate test
database), puts tools/demo-list.json in it, and photographs each screen as a phone (390 x 844 at 3x) - and the Places
map as a computer screen. The map needs the internet (Leaflet, the map outlines and the map pictures).
Needs Chrome or Edge, and Python's websockets and Pillow.
"""
import asyncio
import base64
import io
import json
import shutil
import subprocess
import sys
import tempfile
import time
import urllib.request
from pathlib import Path

import websockets
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / 'site'
BASE = sys.argv[1] if len(sys.argv) > 1 else 'http://localhost/mynote-app/bucketlist/'
PORT = 9339
BROWSERS = [r'C:\Program Files\Google\Chrome\Application\chrome.exe', r'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe',
            '/usr/bin/google-chrome', '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome']


class Page:
    def __init__(self, ws):
        self.ws, self.n, self.events = ws, 0, []

    async def send(self, method, **params):
        self.n += 1
        my = self.n
        await self.ws.send(json.dumps({'id': my, 'method': method, 'params': params}))
        while True:
            msg = json.loads(await self.ws.recv())
            if msg.get('id') == my:
                if 'error' in msg:
                    raise RuntimeError(method + ': ' + str(msg['error']))
                return msg.get('result', {})
            self.events.append(msg)

    async def js(self, code):
        r = await self.send('Runtime.evaluate', expression=code, awaitPromise=True, returnByValue=True)
        if r.get('exceptionDetails'):
            raise RuntimeError(json.dumps(r['exceptionDetails'])[:400])
        return r.get('result', {}).get('value')

    async def go(self, url, settle=2.5):
        await self.send('Page.navigate', url=url)
        await asyncio.sleep(settle)

    async def shot(self, name, size=None, crop_h=None):
        r = await self.send('Page.captureScreenshot', format='png', captureBeyondViewport=False)
        img = Image.open(io.BytesIO(base64.b64decode(r['data']))).convert('RGB')
        if crop_h:
            img = img.crop((0, 0, img.width, min(img.height, crop_h)))
        if size:
            img = img.resize((size, round(img.height * size / img.width)), Image.LANCZOS)
        img.save(OUT / (name + '.webp'), 'WEBP', quality=86, method=6)
        print('wrote site/' + name + '.webp', img.size)


async def phone(p, scheme='light'):
    await p.send('Emulation.setDeviceMetricsOverride', width=390, height=844, deviceScaleFactor=3, mobile=True)
    await p.send('Emulation.setEmulatedMedia', features=[{'name': 'prefers-color-scheme', 'value': scheme}, {'name': 'prefers-reduced-motion', 'value': 'reduce'}])


async def tab(p, view):
    await p.js("document.querySelector('#bucketBottomNav [data-view=\"%s\"]').click()" % view)
    await asyncio.sleep(1.2)
    await p.js('window.scrollTo(0, 0)')
    await asyncio.sleep(0.3)


async def main():
    exe = next((b for b in BROWSERS if Path(b).exists()), None)
    if not exe:
        sys.exit('Chrome or Edge not found')
    prof = tempfile.mkdtemp(prefix='mdb-shots-')
    proc = subprocess.Popen([exe, '--headless=new', '--remote-debugging-port=%d' % PORT, '--user-data-dir=' + prof, '--no-first-run',
                             '--no-default-browser-check', '--hide-scrollbars', '--force-color-profile=srgb', 'about:blank'],
                            stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    try:
        for _ in range(50):
            try:
                targets = json.loads(urllib.request.urlopen('http://127.0.0.1:%d/json/list' % PORT).read())
                break
            except Exception:
                time.sleep(0.2)
        page = next(t for t in targets if t['type'] == 'page')
        async with websockets.connect(page['webSocketDebuggerUrl'], max_size=64 * 1024 * 1024) as ws:
            p = Page(ws)
            await p.send('Page.enable')
            await phone(p)
            app = BASE + 'app.html?testdb=1'
            await p.go(app)
            demo = (ROOT / 'tools' / 'demo-list.json').read_text(encoding='utf-8')
            await p.js("import('./js/core/db.js').then(({ DB }) => DB.put('meta', { key: 'bucketList', value: %s, updatedAt: new Date().toISOString() }))" % demo)
            await p.go(app, 3)
            await p.shot('shot-list', size=780)
            await tab(p, 'milestones')
            await p.shot('shot-milestones', size=780)
            await tab(p, 'places')
            await p.shot('shot-places', size=780)
            await tab(p, 'insights')
            await p.shot('shot-insights', size=780)
            await p.go(BASE + 'app.html?testdb=1&view=plan', 3)
            await p.shot('shot-plan', size=780)
            # The Places map, as on a computer.
            await p.send('Emulation.setDeviceMetricsOverride', width=1280, height=760, deviceScaleFactor=2, mobile=False)
            await p.send('Emulation.setEmulatedMedia', features=[{'name': 'prefers-color-scheme', 'value': 'light'}, {'name': 'prefers-reduced-motion', 'value': 'reduce'}])
            await p.go(app, 3)
            await tab(p, 'places')
            await p.js("document.querySelector('.bk-map-btn').click()")
            await asyncio.sleep(9)
            await p.shot('shot-map', size=1600)
    finally:
        proc.terminate()
        try:
            proc.wait(10)
        except Exception:
            proc.kill()
        shutil.rmtree(prof, ignore_errors=True)


if __name__ == '__main__':
    asyncio.run(main())
