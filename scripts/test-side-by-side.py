import subprocess, time, json, urllib.request, base64, websocket

CDP_PORT = 9231
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

    # 1. Capture initial view with the new Side-by-Side button in top nav
    ws.send(json.dumps({'id': 1, 'method': 'Page.captureScreenshot', 'params': {'format': 'png'}}))
    res1 = json.loads(ws.recv())
    data1 = base64.b64decode(res1['result']['data'])
    with open('screenshots/side_by_side_01_top_nav.png', 'wb') as f:
        f.write(data1)
    print('Top nav captured! Size:', len(data1))

    # 2. Click / activate Side-by-Side mode
    expr = "window.__ATLAS_APP__.setMode('dimorphic'); window.__ATLAS_APP__.setDimorphicArrangement('side-by-side');"
    ws.send(json.dumps({'id': 2, 'method': 'Runtime.evaluate', 'params': {'expression': expr}}))
    ws.recv()
    time.sleep(3)

    # 3. Capture Side-by-Side Comparative 3D frame
    ws.send(json.dumps({'id': 3, 'method': 'Page.captureScreenshot', 'params': {'format': 'png'}}))
    res2 = json.loads(ws.recv())
    data2 = base64.b64decode(res2['result']['data'])
    with open('screenshots/side_by_side_02_frame_verified.png', 'wb') as f:
        f.write(data2)
    print('Side-by-side 3D frame captured! Size:', len(data2))

    # 4. Verify parts count in 3D scene
    expr2 = "window.__ATLAS_CORE__.atlas.parts.length"
    ws.send(json.dumps({'id': 4, 'method': 'Runtime.evaluate', 'params': {'expression': expr2}}))
    res3 = json.loads(ws.recv())
    parts_count = res3.get('result', {}).get('value')
    print(f'Side-by-side total parts in 3D frame: {parts_count}')

finally:
    p.kill()
