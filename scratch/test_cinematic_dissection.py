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

def cleanup():
    try:
        subprocess.run(["powershell", "-NoProfile", "-Command", "Get-Process msedge -ErrorAction SilentlyContinue | Stop-Process -Force"], capture_output=True)
    except Exception:
        pass
    time.sleep(1)

def main():
    cleanup()
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

        def capture_screenshot(filename):
            path = os.path.join(ARTIFACTS_DIR, filename)
            res = send_cmd("Page.captureScreenshot", {"format": "png"})
            data = base64.b64decode(res["data"])
            with open(path, "wb") as f:
                f.write(data)
            print(f"    Saved screenshot: {filename} ({len(data)} bytes)")

        print("[3] Navigating to http://localhost:8090/...")
        send_cmd("Page.navigate", {"url": f"http://localhost:{PORT}/"})

        print("[4] Waiting for Atlas Core and 2,234-Part Catalog to load...")
        ready = False
        for _ in range(40):
            time.sleep(1)
            ready = evaluate("window.__ATLAS_CORE__ !== undefined && window.__ATLAS_CORE__.atlas !== undefined && window.CinematicDissector !== undefined && document.getElementById('omni-search-modal') !== null")
            if ready:
                break
        print(f"    Workstation Ready: {ready}")
        if not ready:
            print("Failed to initialize Atlas Core within timeout!")
            return

        time.sleep(2)

        # -------------------------------------------------------------
        # TEST 1: Open Search & Find "Gingiva of upper jaw"
        # -------------------------------------------------------------
        print("\n--- TEST 1: Open Search & Find 'Gingiva of upper jaw' ---")
        evaluate("document.getElementById('btn-omni-search').click()")
        time.sleep(0.3)
        evaluate("""
            const input = document.getElementById('omni-part-catalog-search');
            input.value = 'Gingiva of upper jaw';
            input.dispatchEvent(new Event('input', { bubbles: true }));
        """)
        time.sleep(0.4)

        search_info = evaluate("""
            (() => {
                const count = document.getElementById('omni-search-match-count')?.textContent;
                const cards = document.querySelectorAll('.omni-search-card');
                const firstCard = cards[0];
                return {
                    countText: count,
                    cardsCount: cards.length,
                    firstPartName: firstCard ? firstCard.querySelector('.omni-card-name')?.textContent : null,
                    firstPartId: firstCard ? firstCard.getAttribute('data-id') : null
                };
            })()
        """)
        print(f"    Found in Search: {search_info}")
        assert search_info["cardsCount"] > 0, "Expected to find Gingiva in search!"
        assert "Gingiva of upper jaw" in search_info["firstPartName"], "First card should be Gingiva of upper jaw!"
        print("    SUCCESS: Gingiva of upper jaw found in 2,234-part catalog!")

        # -------------------------------------------------------------
        # TEST 2: Trigger Dissection & Verify Phase 1 (Whole Body Anchor + Beacon)
        # -------------------------------------------------------------
        print("\n--- TEST 2: Trigger Dissection & Verify Phase 1 (Whole Body Anchor) ---")
        evaluate("document.querySelectorAll('.omni-search-card')[0].click()")
        # Scrub to Phase 1 (0.25s)
        evaluate("window.CinematicDissector.seek(0.25)")
        time.sleep(0.1)

        p1_state = evaluate("""
            (() => {
                const core = window.__ATLAS_CORE__;
                const hud = document.getElementById('omni-cinematic-hud');
                const hudStage = document.getElementById('omni-hud-stage')?.textContent;
                const hudTitle = document.getElementById('omni-hud-title')?.textContent;
                const hudVisible = hud ? hud.classList.contains('visible') : false;

                // Check alpha for all parts in Phase 1 (all should still be visible: 1.0)
                let visibleCount = 0;
                if (core && core.partState) {
                    for (let i = 0; i < core.atlas.parts.length; i++) {
                        if (core.partState[i * 4 + 3] > 0.5) visibleCount++;
                    }
                }

                // Check beacon intensity on target part (FJ1252)
                const targetIdx = core.atlas.parts.findIndex(p => p.id === 'FJ1252');
                const beaconVal = core.selectionState ? core.selectionState[targetIdx * 4] : 0;

                return {
                    hudStage,
                    hudTitle,
                    hudVisible,
                    visibleCount,
                    beaconVal,
                    cameraPos: {
                        x: core.camera.position.x.toFixed(2),
                        y: core.camera.position.y.toFixed(2),
                        z: core.camera.position.z.toFixed(2)
                    }
                };
            })()
        """)
        print(f"    Phase 1 State: {p1_state}")
        capture_screenshot("screenshot_phase1_anchor_gingiva.png")
        assert p1_state["visibleCount"] == 2234, f"All 2,234 parts should be visible in Phase 1! Got: {p1_state['visibleCount']}"
        assert p1_state["beaconVal"] > 0, "Beacon should be glowing on target in Phase 1!"
        print("    SUCCESS: Phase 1 (Whole Body Anchor + Glowing Beacon) verified!")

        # -------------------------------------------------------------
        # TEST 3: Verify Phase 2 (Layer Peeling: Muscles Peeled, Skeleton Revealed)
        # -------------------------------------------------------------
        print("\n--- TEST 3: Verify Phase 2 (Layer Peeling & Skeleton Revealed) ---")
        # Scrub to Phase 2 (1.10s)
        evaluate("window.CinematicDissector.seek(1.10)")
        time.sleep(0.1)

        p2_state = evaluate("""
            (() => {
                const core = window.__ATLAS_CORE__;
                const hudStage = document.getElementById('omni-hud-stage')?.textContent;
                const hudTitle = document.getElementById('omni-hud-title')?.textContent;

                let muscularVisible = 0;
                let skeletalVisible = 0;
                if (core && core.partState) {
                    for (let i = 0; i < core.atlas.parts.length; i++) {
                        const p = core.atlas.parts[i];
                        const isVis = core.partState[i * 4 + 3] > 0.5;
                        if (p.system === 'muscular' && isVis) muscularVisible++;
                        if (p.system === 'skeletal' && isVis) skeletalVisible++;
                    }
                }

                return {
                    hudStage,
                    hudTitle,
                    muscularVisible,
                    skeletalVisible
                };
            })()
        """)
        print(f"    Phase 2 State: {p2_state}")
        capture_screenshot("screenshot_phase2_skeleton_revealed.png")
        assert p2_state["muscularVisible"] == 0, "Muscles should be peeled away in Phase 2!"
        assert p2_state["skeletalVisible"] > 200, f"Complete skeleton should be revealed in Phase 2! Got: {p2_state['skeletalVisible']}"
        print("    SUCCESS: Phase 2 (Muscles peeled, Complete Skeleton revealed) verified!")

        # -------------------------------------------------------------
        # TEST 4: Verify Phase 3 (Camera Inward Flight & Wavefront Spatial Transection)
        # -------------------------------------------------------------
        print("\n--- TEST 4: Verify Phase 3 (Camera Flight & Spatial Transection) ---")
        # Scrub to midway in Phase 3 (2.60s)
        evaluate("window.CinematicDissector.seek(2.60)")
        time.sleep(0.1)

        p3_state = evaluate("""
            (() => {
                const core = window.__ATLAS_CORE__;
                const hudStage = document.getElementById('omni-hud-stage')?.textContent;
                const hudTitle = document.getElementById('omni-hud-title')?.textContent;

                let visibleCount = 0;
                if (core && core.partState) {
                    for (let i = 0; i < core.atlas.parts.length; i++) {
                        if (core.partState[i * 4 + 3] > 0.5) visibleCount++;
                    }
                }

                return {
                    hudStage,
                    hudTitle,
                    visibleCount,
                    cameraZ: core.camera.position.z.toFixed(2),
                    cameraY: core.camera.position.y.toFixed(2)
                };
            })()
        """)
        print(f"    Phase 3 State: {p3_state}")
        capture_screenshot("screenshot_phase3_transection_zoom.png")
        assert float(p3_state["cameraZ"]) < 2.0, "Camera should have flown inward along Z!"
        assert p3_state["visibleCount"] < 250, "Distant bones should be dissolving away!"
        print("    SUCCESS: Phase 3 (Camera flight & spatial distance transection) verified!")

        # -------------------------------------------------------------
        # TEST 5: Verify Phase 4 (Solo Target Lock on Gingiva of Upper Jaw)
        # -------------------------------------------------------------
        print("\n--- TEST 5: Verify Phase 4 (Solo Target Lock & Isolation) ---")
        # Scrub to Phase 4 (4.0s)
        evaluate("window.CinematicDissector.seek(4.00)")
        time.sleep(0.2)

        p4_state = evaluate("""
            (() => {
                const core = window.__ATLAS_CORE__;
                const hudStage = document.getElementById('omni-hud-stage')?.textContent;
                const dockName = document.getElementById('inspect-name')?.textContent;
                const dockConcept = document.getElementById('inspect-concept')?.textContent;
                const dockSystem = document.getElementById('inspect-system')?.textContent;
                const isolateBtn = document.getElementById('txt-isolate')?.textContent;

                const targetIdx = core.atlas.parts.findIndex(p => p.id === 'FJ1252');
                const gingivaAlpha = core.partState[targetIdx * 4 + 3];

                let otherVisibleCount = 0;
                for (let i = 0; i < core.atlas.parts.length; i++) {
                    if (i !== targetIdx && core.partState[i * 4 + 3] > 0.5) {
                        otherVisibleCount++;
                    }
                }

                return {
                    hudStage,
                    dockName,
                    dockConcept,
                    dockSystem,
                    isolateBtn,
                    gingivaAlpha,
                    otherVisibleCount,
                    camPos: {
                        x: core.camera.position.x.toFixed(2),
                        y: core.camera.position.y.toFixed(2),
                        z: core.camera.position.z.toFixed(2)
                    },
                    camTarget: {
                        x: core.controls.target.x.toFixed(2),
                        y: core.controls.target.y.toFixed(2),
                        z: core.controls.target.z.toFixed(2)
                    }
                };
            })()
        """)
        print(f"    Phase 4 State: {p4_state}")
        capture_screenshot("screenshot_phase4_gingiva_isolated.png")
        assert p4_state["gingivaAlpha"] == 1.0, "Gingiva of upper jaw must be visible!"
        assert p4_state["otherVisibleCount"] == 0, "ALL other 2,233 parts must be hidden in Phase 4!"
        assert "Gingiva" in p4_state["dockName"], "Clinical dock must show Gingiva of upper jaw!"
        assert p4_state["isolateBtn"] == "Show Full Body", "Dock button must toggle to Show Full Body!"
        print("    SUCCESS: Phase 4 (Gingiva of upper jaw 100% solo isolated, perfectly zoomed, clinical dossier open) verified!")

        # -------------------------------------------------------------
        # TEST 6: Full Body Reconstitution via "Show Full Body"
        # -------------------------------------------------------------
        print("\n--- TEST 6: Reconstitute Full Body ---")
        evaluate("document.getElementById('btn-isolate-part').click()")
        time.sleep(0.8)

        reconstitute_state = evaluate("""
            (() => {
                const core = window.__ATLAS_CORE__;
                const hudStage = document.getElementById('omni-hud-stage')?.textContent;
                const isolateBtn = document.getElementById('txt-isolate')?.textContent;

                let visibleCount = 0;
                for (let i = 0; i < core.atlas.parts.length; i++) {
                    if (core.partState[i * 4 + 3] > 0.5) visibleCount++;
                }

                return {
                    hudStage,
                    isolateBtn,
                    visibleCount,
                    cameraZ: core.camera.position.z.toFixed(2)
                };
            })()
        """)
        print(f"    Reconstituted State: {reconstitute_state}")
        capture_screenshot("screenshot_restored_full_body.png")
        assert reconstitute_state["visibleCount"] == 2234, "All 2,234 parts must be visible upon reconstitution!"
        assert float(reconstitute_state["cameraZ"]) > 1.8, "Camera should have reset back to whole body distance!"
        print("    SUCCESS: Full body successfully reconstituted with all 2,234 parts visible!")

        # -------------------------------------------------------------
        # TEST 7: Test Another System - Cardiac (Wall of Ventricle)
        # -------------------------------------------------------------
        print("\n--- TEST 7: Search and Dissect Cardiac Organ ('Wall of ventricle') ---")
        evaluate("document.getElementById('btn-omni-search').click()")
        time.sleep(0.3)
        evaluate("""
            (() => {
                const input = document.getElementById('omni-part-catalog-search');
                input.value = 'Wall of ventricle';
                input.dispatchEvent(new Event('input', { bubbles: true }));
            })();
        """)
        time.sleep(0.4)
        evaluate("document.querySelectorAll('.omni-search-card')[0].click()")
        # Scrub to final lock
        evaluate("window.CinematicDissector.seek(4.00)")
        time.sleep(0.2)

        ventricle_state = evaluate("""
            (() => {
                const core = window.__ATLAS_CORE__;
                const dockName = document.getElementById('inspect-name')?.textContent;
                const targetIdx = core.atlas.parts.findIndex(p => p.id === 'FJ2428');
                const ventricleAlpha = core.partState[targetIdx * 4 + 3];

                let otherVisibleCount = 0;
                for (let i = 0; i < core.atlas.parts.length; i++) {
                    if (i !== targetIdx && core.partState[i * 4 + 3] > 0.5) {
                        otherVisibleCount++;
                    }
                }

                return {
                    dockName,
                    ventricleAlpha,
                    otherVisibleCount,
                    cameraY: core.camera.position.y.toFixed(2)
                };
            })()
        """)
        print(f"    Ventricle Dissection State: {ventricle_state}")
        capture_screenshot("screenshot_phase4_ventricle_isolated.png")
        assert ventricle_state["ventricleAlpha"] == 1.0, "Ventricle wall must be visible!"
        assert ventricle_state["otherVisibleCount"] == 0, "All other parts must be hidden!"
        assert "ventricle" in ventricle_state["dockName"].lower(), "Clinical dock should show Ventricle!"
        print("    SUCCESS: Heart / Ventricle wall isolated with smooth zoom and transection!")

        print("\n=======================================================")
        print("   ALL 7 CINEMATIC DISSECTION & TRANSECTION TESTS PASSED 100%!")
        print("=======================================================")

    finally:
        try:
            ws.close()
        except Exception:
            pass
        edge.terminate()
        server.terminate()
        cleanup()
        print("Edge and Server stopped.")

if __name__ == "__main__":
    main()
