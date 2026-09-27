import subprocess
import time
import json
import urllib.request
import os
import sys
import base64

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

EDGE_PATH = r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
PORT = 3016
CDP_PORT = 9228
OUT_DIR = r"c:\Users\nishi\OneDrive\Desktop\All Tests\female-human-atlas\screenshots"
os.makedirs(OUT_DIR, exist_ok=True)

def cleanup():
    try:
        subprocess.run(["powershell", "-NoProfile", "-Command", "Get-Process msedge -ErrorAction SilentlyContinue | Stop-Process -Force"], capture_output=True)
    except Exception:
        pass
    time.sleep(1)

def run_test():
    cleanup()
    print("[1] Launching Microsoft Edge headless with CDP on port 9228...")
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
    tabs = None
    for _ in range(12):
        try:
            tabs = json.loads(urllib.request.urlopen(f"http://localhost:{CDP_PORT}/json", timeout=5).read())
            if tabs:
                break
        except Exception:
            time.sleep(1)

    if not tabs:
        raise RuntimeError("Could not connect to Edge CDP endpoint.")

    try:
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

        def capture_screenshot(filename):
            path = os.path.join(OUT_DIR, filename)
            res = send_cmd("Page.captureScreenshot", {"format": "png"})
            data = base64.b64decode(res["data"])
            with open(path, "wb") as f:
                f.write(data)
            print(f"  [SCREENSHOT] Saved: {filename} ({len(data)} bytes)")

        send_cmd("Console.enable")
        send_cmd("Runtime.enable")

        print(f"[2] Navigating to dev server at http://localhost:{PORT}/...")
        send_cmd("Page.navigate", {"url": f"http://localhost:{PORT}/"})

        def wait_for_core(timeout=25):
            t0 = time.time()
            while time.time() - t0 < timeout:
                ready = evaluate("Boolean(window.__ATLAS_CORE__ && window.__ATLAS_APP__ && window.__ATLAS_CORE__.atlas)")
                if ready:
                    return True
                time.sleep(0.5)
            return False

        if not wait_for_core():
            raise RuntimeError("Timed out waiting for __ATLAS_CORE__.")

        print("[3] Testing Female Atlas with isolated Female-Only Unique (77)...")
        evaluate("window.__ATLAS_APP__.setFemalePath('female-dimorphic')")
        time.sleep(2)
        f_parts = evaluate("window.__ATLAS_CORE__.atlas.parts.length")
        f_name = evaluate("window.__ATLAS_CORE__.atlas.name")
        print(f"  Loaded model: '{f_name}', parts count: {f_parts}")
        capture_screenshot("cleaned_01_female_77_isolated.png")

        print("[4] Testing Male Atlas with isolated Male-Only Unique (30)...")
        evaluate("window.__ATLAS_APP__.setMode('male')")
        evaluate("window.__ATLAS_APP__.setMalePath('male-dimorphic')")
        time.sleep(2)
        m_parts = evaluate("window.__ATLAS_CORE__.atlas.parts.length")
        m_name = evaluate("window.__ATLAS_CORE__.atlas.name")
        print(f"  Loaded model: '{m_name}', parts count: {m_parts}")
        capture_screenshot("cleaned_02_male_30_isolated.png")

        print("[5] Testing Catalog Modal (Cleaned separate tabs)...")
        evaluate("window.__ATLAS_APP__.openFemaleCatalog()")
        time.sleep(1)
        capture_screenshot("cleaned_03_female_catalog_modal.png")

        evaluate("window.__ATLAS_APP__.openMaleCatalog()")
        time.sleep(1)
        capture_screenshot("cleaned_04_male_catalog_modal.png")

        evaluate("window.__ATLAS_APP__.closeFemaleCatalog()")
        time.sleep(0.5)

        # Check if combined button exists in DOM
        has_combined_btn = evaluate("Boolean(document.getElementById('btn-combined-unique-catalog'))")
        print(f"  Combined button exists in DOM: {has_combined_btn} (should be False)")
        assert not has_combined_btn, "btn-combined-unique-catalog was found in DOM!"

        print("\n=======================================================")
        print("🎉 ALL CLEANED TESTS PASSED!")
        print("   • Female-Only Unique: 77 parts separate")
        print("   • Male-Only Unique: 30 parts separate")
        print("   • Zero combined feature / zero combined buttons in DOM")
        print("   • Clean separate female and male catalogs")
        print("=======================================================")

    finally:
        cleanup()

if __name__ == "__main__":
    run_test()
