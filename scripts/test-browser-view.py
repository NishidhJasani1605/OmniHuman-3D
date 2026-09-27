import subprocess
import time
import json
import urllib.request
import os
import sys
import base64

EDGE_PATH = r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
PORT = 3018
CDP_PORT = 9225
DIST_DIR = r"c:\Users\nishi\OneDrive\Desktop\All Tests\female-human-atlas\dist"
OUT_IMG = r"c:\Users\nishi\OneDrive\Desktop\All Tests\female-human-atlas\screenshot_browser_test.png"

def cleanup():
    try:
        subprocess.run(["powershell", "-NoProfile", "-Command", "Get-Process msedge -ErrorAction SilentlyContinue | Stop-Process -Force"], capture_output=True)
    except Exception:
        pass
    time.sleep(1)

def main():
    cleanup()
    print("[1] Starting HTTP server on port 3018 serving dist...")
    server = subprocess.Popen([sys.executable, "-m", "http.server", str(PORT)],
                              cwd=DIST_DIR,
                              stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    time.sleep(1.5)

    print("[2] Launching Microsoft Edge headless with CDP...")
    edge_cmd = [
        EDGE_PATH,
        "--headless=new",
        f"--remote-debugging-port={CDP_PORT}",
        "--remote-allow-origins=*",
        "--window-size=1600,1000",
        "--disable-gpu",
        "--mute-audio",
        "--no-first-run",
        "--no-default-browser-check",
        "about:blank"
    ]
    edge = subprocess.Popen(edge_cmd, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    time.sleep(2.5)

    try:
        tabs = json.loads(urllib.request.urlopen(f"http://localhost:{CDP_PORT}/json").read())
        page_tabs = [t for t in tabs if t.get("type") == "page"]
        target_tab = page_tabs[0] if page_tabs else tabs[0]
        ws_url = target_tab["webSocketDebuggerUrl"]

        import websocket
        ws = websocket.create_connection(ws_url, timeout=30, suppress_origin=True)
        msg_id = 1

        def send_cmd(method, params=None):
            nonlocal msg_id
            mid = msg_id
            msg_id += 1
            payload = {"id": mid, "method": method, "params": params or {}}
            ws.send(json.dumps(payload))
            while True:
                resp = json.loads(ws.recv())
                if resp.get("id") == mid:
                    return resp.get("result", {})

        def evaluate(expr):
            res = send_cmd("Runtime.evaluate", {"expression": expr, "returnByValue": True, "awaitPromise": True})
            if "exceptionDetails" in res:
                print("JS Exception:", res["exceptionDetails"])
            return res.get("result", {}).get("value")

        def capture_screenshot(path):
            res = send_cmd("Page.captureScreenshot", {"format": "png"})
            data = base64.b64decode(res["data"])
            with open(path, "wb") as f:
                f.write(data)
            print(f"Saved screenshot: {path} ({len(data)} bytes)")

        # Enable console and network
        send_cmd("Console.enable")
        send_cmd("Runtime.enable")

        print("[3] Navigating to http://localhost:3018/...")
        send_cmd("Page.navigate", {"url": f"http://localhost:{PORT}/"})

        print("[4] Waiting for WebGL and Atlas to load...")
        time.sleep(6)

        # Check console logs or errors
        core_status = evaluate("""
            (() => {
                const core = window.__ATLAS_CORE__;
                const err = document.querySelector('.error')?.textContent;
                const title = document.querySelector('h1')?.textContent;
                const activeMode = document.querySelector('.identity .eyebrow')?.textContent;
                const partsCount = core?.atlas?.parts?.length;
                const canvas = document.querySelector('canvas') !== null;
                return { err, title, activeMode, partsCount, canvas };
            })()
        """)
        print("Status:", core_status)

        capture_screenshot(OUT_IMG)

    finally:
        try:
            edge.terminate()
        except:
            pass
        try:
            server.terminate()
        except:
            pass
        cleanup()

if __name__ == "__main__":
    main()
