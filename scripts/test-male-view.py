import subprocess, time, json, urllib.request, base64, websocket

CDP_PORT = 9230
edge_cmd = [
    r'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe',
    '--headless=new',
    f'--remote-debugging-port={CDP_PORT}',
    '--remote-allow-origins=*',
    '--window-size=1600,1000',
    '--disable-gpu',
    '--mute-audio',
    '--no-first-run',
    '--no-default-browser-check',
    'http://localhost:3016/'
]
p = subprocess.Popen(edge_cmd)
time.sleep(3)
try:
    tabs = json.loads(urllib.request.urlopen(f'http://localhost:{CDP_PORT}/json').read())
    ws_url = [t for t in tabs if t.get('type') == 'page'][0]['webSocketDebuggerUrl']
    ws = websocket.create_connection(ws_url, timeout=15)
    time.sleep(2)
    # Switch to Male mode and male dimorphic
    expr = "window.__ATLAS_APP__.setMode('male'); window.__ATLAS_APP__.setMalePath('male-dimorphic');"
    ws.send(json.dumps({'id': 1, 'method': 'Runtime.evaluate', 'params': {'expression': expr}}))
    ws.recv()
    time.sleep(3)
    ws.send(json.dumps({'id': 2, 'method': 'Page.captureScreenshot', 'params': {'format': 'png'}}))
    res = json.loads(ws.recv())
    data = base64.b64decode(res['result']['data'])
    with open('screenshots/male_isolated_verified.png', 'wb') as f:
        f.write(data)
    print('Male isolated captured! Size:', len(data))

    # Also open Male Catalog modal
    expr2 = "window.__ATLAS_APP__.openMaleCatalog();"
    ws.send(json.dumps({'id': 3, 'method': 'Runtime.evaluate', 'params': {'expression': expr2}}))
    ws.recv()
    time.sleep(1.5)
    ws.send(json.dumps({'id': 4, 'method': 'Page.captureScreenshot', 'params': {'format': 'png'}}))
    res2 = json.loads(ws.recv())
    data2 = base64.b64decode(res2['result']['data'])
    with open('screenshots/male_catalog_modal_verified.png', 'wb') as f:
        f.write(data2)
    print('Male catalog modal captured! Size:', len(data2))
finally:
    p.kill()
