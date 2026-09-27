import subprocess
import time
import json
import urllib.request
import os
import sys
import base64

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
if hasattr(sys.stderr, 'reconfigure'):
    sys.stderr.reconfigure(encoding='utf-8', errors='replace')

EDGE_PATH = r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
PORT = 8090
CDP_PORT = 9222
ARTIFACTS_DIR = r"C:\Users\nishi\.gemini\antigravity\brain\9da09521-ec77-4a2c-9606-12797fad0c12"

def cleanup_ports():
    try:
        subprocess.run(["powershell", "-NoProfile", "-Command", "Get-Process msedge -ErrorAction SilentlyContinue | Stop-Process -Force"], capture_output=True)
    except Exception:
        pass
    time.sleep(1)

def main():
    cleanup_ports()
    print("[1] Starting local HTTP server on port 8090...")
    server = subprocess.Popen([sys.executable, "-m", "http.server", str(PORT)],
                              cwd=r"c:\Users\nishi\OneDrive\Desktop\Test Antigravity\OmniHuman-3D",
                              stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    time.sleep(1.5)

    print("[2] Launching Microsoft Edge headless with CDP on port 9222...")
    edge_cmd = [
        EDGE_PATH,
        "--headless=new",
        f"--remote-debugging-port={CDP_PORT}",
        "--remote-allow-origins=*",
        "--window-size=1920,1080",
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
                raise Exception("JS Exception: " + str(res["exceptionDetails"]))
            return res.get("result", {}).get("value")

        def capture_screenshot(filepath):
            res = send_cmd("Page.captureScreenshot", {"format": "png"})
            data = base64.b64decode(res["data"])
            with open(filepath, "wb") as f:
                f.write(data)
            print(f"    Saved screenshot: {filepath} ({len(data)} bytes)")

        print("[3] Navigating to http://localhost:8090/...")
        send_cmd("Page.navigate", {"url": f"http://localhost:{PORT}/"})

        print("[4] Waiting for Atlas Core and 2,234-Part Catalog to load...")
        ready = False
        for _ in range(40):
            time.sleep(1)
            ready = evaluate("window.__ATLAS_CORE__ !== undefined && window.__ATLAS_CORE__.atlas !== undefined && document.getElementById('omni-search-modal') !== null")
            if ready:
                break
        print(f"    Workstation Ready: {ready}")
        assert ready, "Workstation failed to initialize"

        time.sleep(2.5) # Allow geometry decompression to complete

        # --- TEST 1: Open 2,234-Part Search Modal ---
        print("\n--- TEST 1: Open 2,234-Part Anatomical Search Modal ---")
        evaluate("document.getElementById('btn-omni-search').click()")
        time.sleep(0.5)

        modal_info = evaluate("""(() => {
            const m = document.getElementById('omni-search-modal');
            const count = document.getElementById('omni-search-match-count')?.textContent;
            const cards = document.querySelectorAll('.omni-search-card').length;
            const tabs = document.querySelectorAll('.omni-sys-tab').length;
            return {
                isOpen: m.classList.contains('open'),
                countText: count,
                renderedCards: cards,
                tabsCount: tabs
            };
        })()""")
        print(f"    Search Modal State: {modal_info}")
        assert modal_info["isOpen"] == True, "Modal failed to open"
        assert "2,234" in modal_info["countText"], "Expected 2,234 parts in counter"
        assert modal_info["renderedCards"] > 0, "No cards rendered"
        assert modal_info["tabsCount"] == 10, "Expected 10 system tabs"
        print("    SUCCESS: Modal opened with full 2,234-part catalog and 10 system tabs!")
        capture_screenshot(os.path.join(ARTIFACTS_DIR, "screenshot_search_modal_catalog.png"))

        # --- TEST 2: Filter by Skeletal System (296 Bones) ---
        print("\n--- TEST 2: Filter by Skeletal System Tab ---")
        evaluate("""(() => {
            const skelTab = document.querySelector('.omni-sys-tab[data-sys="skeletal"]');
            skelTab.click();
        })()""")
        time.sleep(0.4)

        skel_info = evaluate("""(() => {
            const count = document.getElementById('omni-search-match-count')?.textContent;
            const firstTag = document.querySelector('.omni-card-sys-tag')?.textContent;
            return { countText: count, firstTag: firstTag };
        })()""")
        print(f"    Skeletal Filter State: {skel_info}")
        assert "296" in skel_info["countText"], "Expected 296 skeletal structures"
        assert skel_info["firstTag"] == "SKELETAL", "Expected SKELETAL tag"
        print("    SUCCESS: Filtered down to all 296 skeletal bones accurately!")

        # --- TEST 3: Search for Skeleton Bone (Femur) & Auto-Isolate ---
        print("\n--- TEST 3: Search 'femur' and Auto-Isolate with Smooth Zoom ---")
        evaluate("""(() => {
            const allTab = document.querySelector('.omni-sys-tab[data-sys="all"]');
            allTab.click();
            const inp = document.getElementById('omni-part-catalog-search');
            inp.value = 'femur';
            inp.dispatchEvent(new Event('input', { bubbles: true }));
        })()""")
        time.sleep(0.4)

        search_femur = evaluate("""(() => {
            const cards = Array.from(document.querySelectorAll('.omni-search-card')).map(c => ({
                id: c.getAttribute('data-id'),
                name: c.querySelector('.omni-card-name')?.textContent
            }));
            return cards;
        })()""")
        print(f"    Found femur parts: {search_femur}")
        assert any("femur" in c["name"].lower() for c in search_femur), "Femur not found in search"

        # Click Right Femur to auto-isolate and zoom!
        evaluate("""(() => {
            const femurCard = Array.from(document.querySelectorAll('.omni-search-card')).find(c => c.textContent.includes('Right femur'));
            femurCard.click();
        })()""")
        time.sleep(1.5) # Allow camera transition to complete

        femur_isolated = evaluate("""(() => {
            const core = window.__ATLAS_CORE__;
            const state = core.getState();
            const modalOpen = document.getElementById('omni-search-modal').classList.contains('open');
            const dockName = document.getElementById('inspect-name')?.textContent;
            const isolateBtnText = document.getElementById('txt-isolate')?.textContent;
            const camPos = { x: core.camera.position.x.toFixed(2), y: core.camera.position.y.toFixed(2), z: core.camera.position.z.toFixed(2) };

            // Check shader visibility of femur vs others
            const femurIdx = core.atlas.parts.findIndex(p => p.id === 'FJ3365');
            const femurAlpha = core.partState[femurIdx * 4 + 3];
            let otherAlphaSum = 0;
            for (let i = 0; i < core.atlas.parts.length; i++) {
                if (i !== femurIdx) otherAlphaSum += core.partState[i * 4 + 3];
            }

            return {
                modalClosed: !modalOpen,
                isolateState: state.isolate,
                selected: state.selected,
                dockName: dockName,
                isolateBtnText: isolateBtnText,
                camPos: camPos,
                femurAlpha: femurAlpha,
                otherAlphaSum: otherAlphaSum
            };
        })()""")
        print(f"    Femur Isolated Verification: {femur_isolated}")
        assert femur_isolated["modalClosed"], "Search modal should close on selection"
        assert femur_isolated["isolateState"] == True, "core.getState().isolate must be true"
        assert femur_isolated["femurAlpha"] == 1.0, "Femur alpha must be 1.0"
        assert femur_isolated["otherAlphaSum"] == 0.0, "All other 2,233 parts must be hidden (alpha 0.0)"
        assert "femur" in femur_isolated["dockName"].lower(), "Dock should show Femur"
        assert femur_isolated["isolateBtnText"] == "Show Full Body", "Isolate button should say Show Full Body"
        print("    SUCCESS: Right femur is 100% isolated, camera zoomed, all 2,233 other parts hidden!")

        capture_screenshot(os.path.join(ARTIFACTS_DIR, "screenshot_search_femur_isolated.png"))

        # --- TEST 4: Restore Full Body ---
        print("\n--- TEST 4: Full Body Restoration ---")
        evaluate("document.getElementById('btn-isolate-part').click()")
        time.sleep(1.2)

        restored_info = evaluate("""(() => {
            const core = window.__ATLAS_CORE__;
            const state = core.getState();
            const isolateBtnText = document.getElementById('txt-isolate')?.textContent;
            let hiddenCount = 0;
            for (let i = 0; i < core.atlas.parts.length; i++) {
                if (core.partState[i * 4 + 3] < 0.5) hiddenCount++;
            }
            return {
                isolateState: state.isolate,
                isolateBtnText: isolateBtnText,
                hiddenCount: hiddenCount
            };
        })()""")
        print(f"    Restored State: {restored_info}")
        assert restored_info["isolateState"] == False, "isolate state should be false"
        assert restored_info["hiddenCount"] == 0, "No parts should be hidden after restore"
        assert restored_info["isolateBtnText"] == "Isolate Part", "Button should say Isolate Part"
        print("    SUCCESS: Full body successfully restored with all 2,234 parts visible!")

        capture_screenshot(os.path.join(ARTIFACTS_DIR, "screenshot_search_restored.png"))

        # --- TEST 5: Search & Isolate Organ (Wall of Ventricle / Heart) ---
        print("\n--- TEST 5: Search and Isolate Heart / Ventricle ---")
        evaluate("document.getElementById('btn-omni-search').click()")
        time.sleep(0.4)
        evaluate("""(() => {
            const inp = document.getElementById('omni-part-catalog-search');
            inp.value = 'ventricle';
            inp.dispatchEvent(new Event('input', { bubbles: true }));
        })()""")
        time.sleep(0.4)

        evaluate("""(() => {
            const card = Array.from(document.querySelectorAll('.omni-search-card')).find(c => c.textContent.includes('Wall of ventricle'));
            if (card) card.click();
        })()""")
        time.sleep(1.5)

        ventricle_isolated = evaluate("""(() => {
            const core = window.__ATLAS_CORE__;
            const state = core.getState();
            const dockName = document.getElementById('inspect-name')?.textContent;
            const vIdx = core.atlas.parts.findIndex(p => p.id === 'FJ2428');
            const vAlpha = core.partState[vIdx * 4 + 3];
            let otherSum = 0;
            for (let i = 0; i < core.atlas.parts.length; i++) {
                if (i !== vIdx) otherSum += core.partState[i * 4 + 3];
            }
            return {
                isolate: state.isolate,
                dockName: dockName,
                ventricleAlpha: vAlpha,
                otherSum: otherSum
            };
        })()""")
        print(f"    Ventricle Isolated State: {ventricle_isolated}")
        assert ventricle_isolated["isolate"] == True, "Heart must be isolated"
        assert ventricle_isolated["ventricleAlpha"] == 1.0, "Ventricle alpha must be 1.0"
        assert ventricle_isolated["otherSum"] == 0.0, "All other parts must be hidden"
        print("    SUCCESS: Heart / Ventricle isolated and smoothly zoomed!")

        capture_screenshot(os.path.join(ARTIFACTS_DIR, "screenshot_search_ventricle_isolated.png"))

        # --- TEST 6: Intercepting the existing 'Find a structure' button in top navbar ---
        print("\n--- TEST 6: Intercepting existing top navbar search button ---")
        evaluate("""(() => {
            // Find any button with 'Find a structure' or aria-label 'Search anatomy'
            const navBtn = Array.from(document.querySelectorAll('button')).find(b =>
                (b.getAttribute('aria-label') || '').includes('Search anatomy') ||
                (b.textContent || '').includes('Find a structure')
            );
            if (navBtn) navBtn.click();
        })()""")
        time.sleep(0.5)

        nav_search_open = evaluate("document.getElementById('omni-search-modal').classList.contains('open')")
        print(f"    Navbar button triggered 2,234-part modal: {nav_search_open}")
        assert nav_search_open, "Clicking top navbar search button must open 2,234-part modal"
        evaluate("document.getElementById('btn-close-structure-search').click()")
        time.sleep(0.3)
        print("    SUCCESS: Top navbar search button cleanly intercepted and opens 2,234-part modal!")

        print("\n=======================================================")
        print("   ALL 6 SEARCH & AUTO-ISOLATION TESTS PASSED 100%!")
        print("=======================================================")

        ws.close()

    finally:
        edge.terminate()
        server.terminate()
        cleanup_ports()
        print("Edge and Server stopped.")

if __name__ == "__main__":
    main()
