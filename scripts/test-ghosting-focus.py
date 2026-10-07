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
PORT = 3033
CDP_PORT = 9235
DIST_DIR = r"D:\OmniHuman-3D\OmniHuman-3D-main\dist"
OUT_DIR = r"D:\OmniHuman-3D\OmniHuman-3D-main\test-screenshots"
os.makedirs(OUT_DIR, exist_ok=True)

def cleanup():
    try:
        subprocess.run(["powershell", "-NoProfile", "-Command", "Get-Process msedge -ErrorAction SilentlyContinue | Stop-Process -Force"], capture_output=True)
    except Exception:
        pass
    time.sleep(1)

def main():
    cleanup()
    print("[1] Starting HTTP server on port 3033 serving dist...")
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
    tabs = None
    for attempt in range(12):
        try:
            tabs = json.loads(urllib.request.urlopen(f"http://localhost:{CDP_PORT}/json", timeout=5).read())
            if tabs:
                break
        except Exception:
            time.sleep(1)

    if not tabs:
        raise RuntimeError("Could not connect to Edge CDP endpoint after 12s.")

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
            print(f"  [SCREENSHOT] {filename} saved ({len(data)} bytes)")

        send_cmd("Console.enable")
        send_cmd("Runtime.enable")

        print("[3] Navigating to http://localhost:3033/...")
        send_cmd("Page.navigate", {"url": f"http://localhost:{PORT}/"})

        print("[4] Waiting for 3D atlas core to be ready...")
        ready = False
        for _ in range(35):
            r = evaluate("Boolean(window.__ATLAS_CORE__ && window.CinematicDissector)")
            if r:
                ready = True
                break
            time.sleep(1)

        if not ready:
            raise RuntimeError("Atlas core failed to initialize within 35s.")

        print("  Atlas core ready!")
        time.sleep(1.5)
        capture_screenshot("01_whole_body_initial.png")

        # Check whole-body initial opacity
        initial_alpha_sample = evaluate("""
            (() => {
                const c = window.__ATLAS_CORE__;
                return {
                    partCount: c.atlas.parts.length,
                    alphaSample0: c.alphaState[0],
                    ghostSample0: c.alphaState[1],
                    targetSample0: c.alphaState[2]
                };
            })()
        """)
        print(f"  Initial whole body check: {initial_alpha_sample}")
        assert initial_alpha_sample["alphaSample0"] == 1.0, "Expected initial alpha 1.0"
        # Check UI layout: only 3 main buttons in top nav bar, drawer completely removed
        ui_layout = evaluate("""
            (() => {
                const nav = document.querySelector('.top-nav-bar');
                const buttons = nav ? Array.from(nav.querySelectorAll('button')).map(b => ({ id: b.id, text: b.textContent.trim() })) : [];
                return {
                    topNavButtonCount: buttons.length,
                    topNavButtons: buttons,
                    hasMaleNav: Boolean(document.getElementById('btn-nav-male')),
                    hasFemaleNav: Boolean(document.getElementById('btn-nav-female')),
                    hasSideBySideNav: Boolean(document.getElementById('btn-nav-side-by-side')),
                    hasOldFemaleUniqueTopBtn: Boolean(document.getElementById('btn-female-unique-catalog')),
                    hasOldMaleUniqueTopBtn: Boolean(document.getElementById('btn-male-unique-catalog')),
                    hasPregnancyNav: Boolean(document.getElementById('btn-nav-pregnancy')),
                    hasAgingNav: Boolean(document.getElementById('btn-nav-aging')),
                    hasShelfDrawer: Boolean(document.querySelector('.dimorphic-shelf-container'))
                };
            })()
        """)
        print(f"  UI layout check: {ui_layout}")
        assert ui_layout["topNavButtonCount"] == 3, f"Top nav should have exactly 3 buttons, found {ui_layout['topNavButtonCount']}"
        assert ui_layout["hasMaleNav"], "Top nav should have #btn-nav-male"
        assert ui_layout["hasFemaleNav"], "Top nav should have #btn-nav-female"
        assert ui_layout["hasSideBySideNav"], "Top nav should have #btn-nav-side-by-side"
        assert not ui_layout["hasOldFemaleUniqueTopBtn"], "Old top female unique catalog button should be removed"
        assert not ui_layout["hasOldMaleUniqueTopBtn"], "Old top male unique catalog button should be removed"
        assert not ui_layout["hasPregnancyNav"], "Pregnancy nav button should be removed"
        assert not ui_layout["hasAgingNav"], "Aging nav button should be removed"
        assert not ui_layout["hasShelfDrawer"], "Bottom shelf drawer should be removed"

        # Test 1: Focus on Femur bone
        print("\n[5] Testing Focus on Right Femur...")
        evaluate("""
            (() => {
                const c = window.__ATLAS_CORE__;
                const femur = c.atlas.parts.find(p => p.name.toLowerCase().includes('right femur') || p.name.toLowerCase().includes('femur'));
                c.selectPart(femur.id);
            })()
        """)
        
        # Wait for smooth transition to complete (state === 'FOCUSED')
        for _ in range(40):
            st = evaluate("window.CinematicDissector.state")
            if st == "FOCUSED":
                break
            time.sleep(0.1)

        capture_screenshot("02_femur_focused_ghosting.png")

        femur_state = evaluate("""
            (() => {
                const d = window.CinematicDissector;
                const c = window.__ATLAS_CORE__;
                const fg = c.scene.getObjectByName('focusGroup');
                const btn = document.getElementById('btn-back-whole-body');
                
                // Find non-target index
                const nonTargetIdx = c.atlas.parts.findIndex((p, i) => !d.targetIndices.includes(i));
                
                return {
                    isFocused: d.isFocused(),
                    state: d.state,
                    targetName: d.targetName,
                    focusGroupMeshCount: fg ? fg.children.length : 0,
                    surroundingAlpha: c.alphaState[nonTargetIdx * 4],
                    surroundingGhost: c.alphaState[nonTargetIdx * 4 + 1],
                    buttonVisible: Boolean(btn && btn.offsetParent !== null),
                    buttonText: btn ? btn.textContent.trim() : ''
                };
            })()
        """)
        print(f"  Femur focus state: {femur_state}")
        assert femur_state["isFocused"], "Dissector should be in focused state"
        assert femur_state["state"] == "FOCUSED", f"State should be FOCUSED, got {femur_state['state']}"
        assert femur_state["focusGroupMeshCount"] > 0, "FocusGroup should have vibrant target mesh"
        assert abs(femur_state["surroundingAlpha"] - 0.10) < 0.05, f"Surrounding alpha should be ~0.10, got {femur_state['surroundingAlpha']}"
        assert abs(femur_state["surroundingGhost"] - 1.0) < 0.05, f"Surrounding ghost factor should be ~1.0, got {femur_state['surroundingGhost']}"
        assert femur_state["buttonVisible"], "Floating 'Back to whole body' button should be visible"
        assert "Back to whole body" in femur_state["buttonText"], f"Button text should contain 'Back to whole body', got {femur_state['buttonText']}"

        # Test 2: Restore via floating button
        print("\n[6] Testing Restore via floating 'Back to whole body' button...")
        evaluate("""
            (() => {
                const btn = document.getElementById('btn-back-whole-body');
                if (btn) btn.click();
            })()
        """)
        
        # Wait for return flight to complete (state === 'IDLE')
        for _ in range(40):
            st = evaluate("window.CinematicDissector.state")
            if st == "IDLE":
                break
            time.sleep(0.1)

        capture_screenshot("03_whole_body_restored_via_btn.png")

        restored_state = evaluate("""
            (() => {
                const d = window.CinematicDissector;
                const c = window.__ATLAS_CORE__;
                const fg = c.scene.getObjectByName('focusGroup');
                const btn = document.getElementById('btn-back-whole-body');
                return {
                    state: d.state,
                    isFocused: d.isFocused(),
                    focusGroupMeshCount: fg ? fg.children.length : 0,
                    alphaSample0: c.alphaState[0],
                    ghostSample0: c.alphaState[1],
                    buttonVisible: Boolean(btn && btn.offsetParent !== null)
                };
            })()
        """)
        print(f"  Restored state: {restored_state}")
        assert restored_state["state"] == "IDLE", "Dissector should be IDLE after restore"
        assert not restored_state["isFocused"], "Should not be focused after restore"
        assert restored_state["focusGroupMeshCount"] == 0, "FocusGroup should be cleared"
        assert abs(restored_state["alphaSample0"] - 1.0) < 0.02, "All parts should be restored to 1.0 solid opacity"
        assert abs(restored_state["ghostSample0"] - 0.0) < 0.02, "Ghost factor should be restored to 0.0"
        assert not restored_state["buttonVisible"], "Floating button should disappear when whole body restored"

        # Test 3: Focus on Stomach & Restore via Empty 3D Canvas Click
        print("\n[7] Testing Focus on Stomach & Empty Canvas Tap Restore...")
        evaluate("""
            (() => {
                const c = window.__ATLAS_CORE__;
                const organ = c.atlas.parts.find(p => p.name.toLowerCase() === 'stomach' || p.name.toLowerCase() === 'left kidney');
                c.selectPart(organ.id);
            })()
        """)
        for _ in range(40):
            st = evaluate("window.CinematicDissector.state")
            if st == "FOCUSED":
                break
            time.sleep(0.1)

        capture_screenshot("04_stomach_focused_ghosting.png")

        stomach_state = evaluate("""
            (() => {
                const d = window.CinematicDissector;
                return { isFocused: d.isFocused(), targetName: d.targetName };
            })()
        """)
        print(f"  Stomach focus state: {stomach_state}")
        assert stomach_state["isFocused"], "Stomach should be focused"

        # Simulate tap on empty background in 3D canvas (where no mesh intersects the ray)
        print("  Clicking empty background in 3D canvas...")
        empty_coords = evaluate("""
            (() => {
                const c = window.__ATLAS_CORE__;
                const canvas = document.querySelector('canvas');
                const rect = canvas.getBoundingClientRect();
                const pointer = new c.THREE.Vector2();
                const raycaster = new c.THREE.Raycaster();
                const worldBox = new c.THREE.Box3();
                const hitPoint = new c.THREE.Vector3();
                const hasSolid = c.atlas.parts.some((p, i) => p.system !== 'integumentary' && c.partState[i * 4 + 3] > 0.5);

                function checkHit(clientX, clientY) {
                    pointer.set(((clientX - rect.left) / rect.width) * 2 - 1, -((clientY - rect.top) / rect.height) * 2 + 1);
                    raycaster.setFromCamera(pointer, c.camera);
                    for (let i = 0; i < c.pickers.length; i++) {
                        const mesh = c.pickers[i];
                        if (!mesh || c.partState[i * 4 + 3] < 0.5 || (hasSolid && c.atlas.parts[i].system === 'integumentary')) continue;
                        worldBox.copy(c.bounds[i]).translate(mesh.position);
                        if (!raycaster.ray.intersectBox(worldBox, hitPoint)) continue;
                        const hits = raycaster.intersectObject(mesh, false);
                        if (hits.length > 0) return true;
                    }
                    return false;
                }

                // Scan grid of candidate screen points that are outside UI panels
                let emptyCoord = null;
                for (let x = 320; x <= 1180; x += 40) {
                    for (let y = 60; y <= 940; y += 40) {
                        const cx = rect.left + x;
                        const cy = rect.top + y;
                        const el = document.elementFromPoint(cx, cy);
                        if (el && el !== canvas) continue;
                        if (!checkHit(cx, cy)) {
                            emptyCoord = { x: cx, y: cy };
                            break;
                        }
                    }
                    if (emptyCoord) break;
                }

                if (!emptyCoord) {
                    emptyCoord = { x: rect.left + 500, y: rect.top + 75 };
                }

                const down = new PointerEvent('pointerdown', { pointerId: 1, clientX: emptyCoord.x, clientY: emptyCoord.y, bubbles: true });
                const up = new PointerEvent('pointerup', { pointerId: 1, clientX: emptyCoord.x, clientY: emptyCoord.y, bubbles: true });
                canvas.dispatchEvent(down);
                canvas.dispatchEvent(up);
                return emptyCoord;
            })()
        """)
        print(f"  Dispatched tap on empty coordinate: {empty_coords}")
        for _ in range(40):
            st = evaluate("window.CinematicDissector.state")
            if st == "IDLE":
                break
            time.sleep(0.1)

        capture_screenshot("05_whole_body_restored_via_empty_tap.png")

        tap_restore_state = evaluate("""
            (() => {
                const d = window.CinematicDissector;
                const c = window.__ATLAS_CORE__;
                return {
                    state: d.state,
                    isFocused: d.isFocused(),
                    alphaSample0: c.alphaState[0]
                };
            })()
        """)
        print(f"  Empty tap restore state: {tap_restore_state}")
        assert tap_restore_state["state"] == "IDLE", "Dissector should be IDLE after tapping empty background"
        assert abs(tap_restore_state["alphaSample0"] - 1.0) < 0.02, "All parts should be restored to 1.0 solid opacity"

        # Test 4: Focus via Search Catalog (Search Modal)
        print("\n[8] Testing Focus via Search Catalog Modal...")
        evaluate("""
            (() => {
                // Open search modal
                const searchBtn = document.getElementById('btn-open-search');
                if (searchBtn) searchBtn.click();
            })()
        """)
        time.sleep(1.0)

        evaluate("""
            (() => {
                // Find first card in search modal and click it
                const card = document.querySelector('.omni-search-card');
                if (card) card.click();
            })()
        """)
        
        # Wait for smooth transition to complete (state === 'FOCUSED')
        for _ in range(40):
            st = evaluate("window.CinematicDissector.state")
            if st == "FOCUSED":
                break
            time.sleep(0.1)

        capture_screenshot("06_search_catalog_focused.png")

        search_focus_state = evaluate("""
            (() => {
                const d = window.CinematicDissector;
                const c = window.__ATLAS_CORE__;
                const fg = c.scene.getObjectByName('focusGroup');
                const btn = document.getElementById('btn-back-whole-body');
                const nonTargetIdx = c.atlas.parts.findIndex((p, i) => !d.targetIndices.includes(i));
                return {
                    isFocused: d.isFocused(),
                    targetName: d.targetName,
                    focusGroupMeshCount: fg ? fg.children.length : 0,
                    surroundingAlpha: c.alphaState[nonTargetIdx * 4],
                    surroundingGhost: c.alphaState[nonTargetIdx * 4 + 1],
                    buttonVisible: Boolean(btn && btn.offsetParent !== null)
                };
            })()
        """)
        print(f"  Search catalog focus state: {search_focus_state}")
        assert search_focus_state["isFocused"], "Should be focused after clicking search catalog card"
        assert search_focus_state["focusGroupMeshCount"] > 0, "Focus group should contain vibrant mesh"
        assert abs(search_focus_state["surroundingAlpha"] - 0.10) < 0.05, f"Surrounding alpha should be ~0.10, got {search_focus_state['surroundingAlpha']}"
        assert abs(search_focus_state["surroundingGhost"] - 1.0) < 0.05, f"Surrounding ghost should be ~1.0, got {search_focus_state['surroundingGhost']}"
        assert search_focus_state["buttonVisible"], "Floating button should be visible"

        # Test 6: Female Atlas sub-toolbar verification
        print("\n[10] Testing Female Atlas navigation and sub-toolbar...")
        evaluate("""
            (() => {
                const btnFemale = document.getElementById('btn-nav-female');
                if (btnFemale) btnFemale.click();
            })()
        """)
        time.sleep(1.2)
        female_toolbar = evaluate("""
            (() => {
                const toolbarTexts = Array.from(document.querySelectorAll('button')).map(b => b.textContent.trim());
                return {
                    hasParity: toolbarTexts.some(t => t.includes('Full-Body Parity')),
                    hasFemaleUnique: toolbarTexts.some(t => t.includes('Female-Only Unique')),
                    hasNihTrunk: toolbarTexts.some(t => t.toLowerCase().includes('nih') || t.toLowerCase().includes('trunk')),
                    hasVhfHybrid: toolbarTexts.some(t => t.toLowerCase().includes('vhf') || t.toLowerCase().includes('hybrid'))
                };
            })()
        """)
        print(f"  Female toolbar check: {female_toolbar}")
        assert female_toolbar["hasParity"], "Should have Full-Body Parity"
        assert female_toolbar["hasFemaleUnique"], "Should have Female-Only Unique"
        assert not female_toolbar["hasNihTrunk"], "NIH HRA Trunk should be removed"
        assert not female_toolbar["hasVhfHybrid"], "VHF Hybrid should be removed"
        capture_screenshot("07_female_atlas_toolbar.png")

        print("\nALL AUTOMATED FOCUS & GHOSTING VERIFICATION TESTS PASSED SUCCESSFULLY!")

    finally:
        server.terminate()
        cleanup()

if __name__ == "__main__":
    main()
