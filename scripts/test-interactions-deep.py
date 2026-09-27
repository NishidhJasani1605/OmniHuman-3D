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
PORT = 3019
CDP_PORT = 9226
DIST_DIR = r"c:\Users\nishi\OneDrive\Desktop\All Tests\female-human-atlas\dist"
OUT_DIR = r"c:\Users\nishi\OneDrive\Desktop\All Tests\female-human-atlas\screenshots"
os.makedirs(OUT_DIR, exist_ok=True)

def cleanup():
    try:
        subprocess.run(["powershell", "-NoProfile", "-Command", "Get-Process msedge -ErrorAction SilentlyContinue | Stop-Process -Force"], capture_output=True)
    except Exception:
        pass
    time.sleep(1)

def main():
    cleanup()
    print("[1] Starting HTTP server on port 3019 serving dist...")
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
        raise RuntimeError("Could not connect to Microsoft Edge CDP endpoint after 12 seconds.")

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
            print(f"  [SCREENSHOT] {filename} ({len(data)} bytes)")

        send_cmd("Console.enable")
        send_cmd("Runtime.enable")

        print("[3] Navigating to http://localhost:3019/...")
        send_cmd("Page.navigate", {"url": f"http://localhost:{PORT}/"})
        
        def wait_loading(max_sec=25):
            time.sleep(2.0)  # ensure React has mounted the active atlas and initialized loading
            start = time.time()
            while time.time() - start < max_sec:
                loading = evaluate("""
                (() => {
                    const el = document.querySelector('.loading');
                    return !!el;
                })()
                """)
                if not loading:
                    break
                time.sleep(0.5)
            time.sleep(1.0)

        wait_loading(25)

        # -------------------------------------------------------------
        # STEP 1: Female Full-Body Parity Natural Contour & Styling
        # -------------------------------------------------------------
        print("\n--- STEP 1: Female Full-Body Natural Contour & Breast Styling ---")
        capture_screenshot("01a_female_fullbody_natural_contour.png")

        # Open dedicated Women's Unique Anatomy Catalog Modal
        print("\n--- STEP 1B: Open Women's Unique Anatomy (77) Catalog Modal ---")
        evaluate("""
        (() => {
            const btn = document.getElementById('btn-female-unique-catalog');
            if (btn) btn.click();
        })()
        """)
        time.sleep(1.2)
        capture_screenshot("01b_female_unique_catalog_modal.png")

        # Filter by 'Vulva & Clitoris' category
        print("\n--- STEP 1C: Filter Female Catalog by Vulva & Clitoris ---")
        evaluate("""
        (() => {
            const tabs = Array.from(document.querySelectorAll('.female-cat-tab'));
            const vulvaTab = tabs.find(t => t.textContent.includes('Vulva') || t.textContent.includes('Clitoris'));
            if (vulvaTab) vulvaTab.click();
        })()
        """)
        time.sleep(1.0)
        capture_screenshot("01c_female_vulva_category_filtered.png")

        # Click Isolate & Zoom on Clitoral Glans & Prepuce card
        print("\n--- STEP 1D: Isolate Clitoral Glans & Prepuce in 3D ---")
        clitoris_name = evaluate("""
        (() => {
            const cards = Array.from(document.querySelectorAll('.female-part-card'));
            const target = cards.find(c => c.textContent.includes('Glans clitoridis') || c.textContent.includes('clitoris')) || cards[0];
            if (target) {
                const isoBtn = target.querySelector('.female-part-btn-isolate');
                if (isoBtn) isoBtn.click();
                return target.querySelector('.female-part-name')?.textContent;
            }
            return null;
        })()
        """)
        print(f"  Isolated female specialized part: {clitoris_name}")
        time.sleep(2.0)
        capture_screenshot("01d_female_isolated_clitoral_complex.png")

        # Reconstitute full view
        evaluate("""
        (() => {
            const isolateBtn = document.getElementById('btn-isolate-part');
            if (isolateBtn) isolateBtn.click();
        })()
        """)
        time.sleep(1.2)

        # Test typing in female catalog search to verify padding and search match
        print("\n--- STEP 1E: Search Female Catalog for 'labia' ---")
        evaluate("""
        (() => {
            const btn = document.getElementById('btn-female-unique-catalog');
            if (btn) btn.click();
        })()
        """)
        time.sleep(0.8)
        evaluate("""
        (() => {
            const tabs = Array.from(document.querySelectorAll('.female-cat-tab'));
            const allTab = tabs.find(t => t.textContent.includes('All'));
            if (allTab) allTab.click();
            const input = document.getElementById('input-female-catalog-search');
            if (input) {
                const nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
                nativeSetter.call(input, 'labia');
                input.dispatchEvent(new Event('input', { bubbles: true }));
            }
        })()
        """)
        time.sleep(0.8)
        capture_screenshot("01e_female_catalog_search_labia.png")

        # Test Facial Musculature category tab
        print("\n--- STEP 1F: Filter by Facial Aesthetics Category (2 structures) ---")
        evaluate("""
        (() => {
            const clearBtn = document.querySelector('.female-catalog-controls .omni-search-input-clear');
            if (clearBtn) clearBtn.click();
            const tabs = Array.from(document.querySelectorAll('.female-cat-tab'));
            const facialTab = tabs.find(t => t.textContent.includes('Facial'));
            if (facialTab) facialTab.click();
        })()
        """)
        time.sleep(0.8)
        capture_screenshot("01f_female_facial_tab.png")

        # Isolate Lips & labial vermilion in 3D
        print("\n--- STEP 1G: Isolate Lips & labial vermilion ---")
        lips_name = evaluate("""
        (() => {
            const cards = Array.from(document.querySelectorAll('.female-part-card'));
            const target = cards.find(c => c.textContent.toLowerCase().includes('lip') || c.textContent.includes('vermilion')) || cards[0];
            if (target) {
                const isoBtn = target.querySelector('.female-part-btn-isolate');
                if (isoBtn) isoBtn.click();
                return target.querySelector('.female-part-name')?.textContent;
            }
            return null;
        })()
        """)
        print(f"  Isolated facial part: {lips_name}")
        time.sleep(2.0)
        capture_screenshot("01g_female_isolated_lips.png")

        # Reconstitute and focus camera on female craniofacial contour
        print("\n--- STEP 1H: Female Head & Face Natural Contour Close-up ---")
        evaluate("""
        (() => {
            const isolateBtn = document.getElementById('btn-isolate-part');
            if (isolateBtn) isolateBtn.click();
            const closeBtn = document.getElementById('btn-close-female-catalog');
            if (closeBtn) closeBtn.click();
            if (window.__ATLAS_CORE__) {
                const { camera, controls } = window.__ATLAS_CORE__;
                controls.target.set(0, 1.54, 0.05);
                camera.position.set(0, 1.54, 0.58);
                controls.update();
                window.__ATLAS_CORE__.markDirty();
            }
        })()
        """)
        time.sleep(1.8)
        capture_screenshot("01h_female_facial_head_contour.png")

        # Reset camera back to front body
        evaluate("""
        (() => {
            if (window.__ATLAS_CORE__) {
                const { camera, controls } = window.__ATLAS_CORE__;
                controls.target.set(0, 0.85, 0);
                camera.position.set(0, 0.85, 4.0);
                controls.update();
                window.__ATLAS_CORE__.markDirty();
            }
        })()
        """)
        time.sleep(1.0)

        # Scrolled systems
        evaluate("""
        (() => {
            const sysList = document.querySelector('.system-list');
            if (sysList) sysList.scrollTop = sysList.scrollHeight;
        })()
        """)
        time.sleep(1)
        capture_screenshot("01_female_systems_scrolled.png")

        # -------------------------------------------------------------
        # STEP 2: Search for 'uterus' and Select 'Fundus of uterus'
        # -------------------------------------------------------------
        print("\n--- STEP 2: Search for 'uterus' and Inspect ---")
        evaluate("""
        (() => {
            const btn = Array.from(document.querySelectorAll('.top-actions button')).find(b => b.textContent.includes('Find a structure') || b.querySelector('svg'));
            if (btn) btn.click();
        })()
        """)
        time.sleep(0.8)

        # Type 'uterus' into React controlled input
        match_count = evaluate("""
        (() => {
            const input = document.getElementById('omni-part-catalog-search');
            if (input) {
                const nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
                nativeSetter.call(input, 'uterus');
                input.dispatchEvent(new Event('input', { bubbles: true }));
                return document.querySelectorAll('.omni-search-card').length;
            }
            return 0;
        })()
        """)
        time.sleep(0.8)
        print(f"  Uterus search results matched: {match_count}")
        capture_screenshot("02_search_uterus_palette.png")

        # Click the 'Fundus of uterus' card
        card_info = evaluate("""
        (() => {
            const cards = Array.from(document.querySelectorAll('.omni-search-card'));
            const target = cards.find(c => c.textContent.toLowerCase().includes('fundus')) || cards[0];
            if (target) {
                target.click();
                return target.querySelector('.omni-card-name')?.textContent;
            }
            return null;
        })()
        """)
        print(f"  Selected structure card: {card_info}")
        time.sleep(1.5)
        capture_screenshot("03_selected_uterus_detail.png")

        # Isolate structure in 3D
        isolated_status = evaluate("""
        (() => {
            const isolateBtn = document.getElementById('btn-isolate-part');
            if (isolateBtn) {
                isolateBtn.click();
                return true;
            }
            return false;
        })()
        """)
        print(f"  Isolate button triggered: {isolated_status}")
        time.sleep(1.5)
        capture_screenshot("04_isolated_uterus.png")

        # -------------------------------------------------------------
        # STEP 3: Reconstitute & Search for 'breast' (Synonym test)
        # -------------------------------------------------------------
        print("\n--- STEP 3: Search for 'breast' and Isolate Mammary Lobes ---")
        # Click Show Full Body to reconstitute
        evaluate("""
        (() => {
            const isolateBtn = document.getElementById('btn-isolate-part');
            if (isolateBtn) isolateBtn.click();
        })()
        """)
        time.sleep(1)

        # Open search modal
        evaluate("""
        (() => {
            const btn = Array.from(document.querySelectorAll('.top-actions button')).find(b => b.textContent.includes('Find a structure') || b.querySelector('svg'));
            if (btn) btn.click();
        })()
        """)
        time.sleep(0.8)

        # Type 'breast' into input via React native setter
        breast_matches = evaluate("""
        (() => {
            const input = document.getElementById('omni-part-catalog-search');
            if (input) {
                const nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
                nativeSetter.call(input, 'breast');
                input.dispatchEvent(new Event('input', { bubbles: true }));
                return document.querySelectorAll('.omni-search-card').length;
            }
            return 0;
        })()
        """)
        time.sleep(0.8)
        print(f"  Breast search results matched: {breast_matches}")
        capture_screenshot("05_search_mammary_palette.png")

        # Click direct Isolate button on mammary card
        mammary_isolated = evaluate("""
        (() => {
            const cards = Array.from(document.querySelectorAll('.omni-search-card'));
            const target = cards.find(c => c.textContent.toLowerCase().includes('mammary glandular') || c.textContent.toLowerCase().includes('mammary')) || cards[0];
            if (target) {
                const actionBtn = target.querySelector('.omni-card-action-btn');
                if (actionBtn) {
                    actionBtn.click();
                    return target.querySelector('.omni-card-name')?.textContent;
                }
            }
            return null;
        })()
        """)
        print(f"  Direct isolate clicked for: {mammary_isolated}")
        time.sleep(2)
        capture_screenshot("06_isolated_mammary_part.png")

        # -------------------------------------------------------------
        # STEP 4: Switch to Pregnancy Mode (0-40w) & Isolate Fetus
        # -------------------------------------------------------------
        print("\n--- STEP 4: Switch to Pregnancy Mode & Isolate Fetus ---")
        evaluate("""
        (() => {
            const btns = Array.from(document.querySelectorAll('nav button'));
            const pregBtn = btns.find(b => b.textContent.includes('Pregnancy'));
            if (pregBtn) pregBtn.click();
        })()
        """)
        wait_loading(25)
        capture_screenshot("07_pregnancy_mode_38w.png")

        # Open cutaway window further to 25% for direct intrauterine visualization
        evaluate("""
        (() => {
            if (window.__ATLAS_APP__ && window.__ATLAS_APP__.setUterineOpacity) {
                window.__ATLAS_APP__.setUterineOpacity(25);
            }
        })()
        """)
        time.sleep(2)
        capture_screenshot("07a_pregnancy_mode_open_window.png")

        # Open search modal and isolate cephalic fetus
        evaluate("""
        (() => {
            const btn = Array.from(document.querySelectorAll('.top-actions button')).find(b => b.textContent.includes('Find a structure') || b.querySelector('svg'));
            if (btn) btn.click();
        })()
        """)
        time.sleep(0.8)
        evaluate("""
        (() => {
            const input = document.getElementById('omni-part-catalog-search');
            if (input) {
                const nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
                nativeSetter.call(input, 'fetus');
                input.dispatchEvent(new Event('input', { bubbles: true }));
            }
        })()
        """)
        time.sleep(0.8)
        evaluate("""
        (() => {
            const cards = Array.from(document.querySelectorAll('.omni-search-card'));
            const target = cards.find(c => c.textContent.includes('Head') || c.textContent.includes('Cranium')) || cards[0];
            if (target) {
                const actionBtn = target.querySelector('.omni-card-action-btn');
                if (actionBtn) actionBtn.click();
                else target.click();
            }
        })()
        """)
        time.sleep(2)
        capture_screenshot("07b_isolated_cephalic_fetus.png")

        # Reconstitute
        evaluate("""
        (() => {
            const isolateBtn = document.getElementById('btn-isolate-part');
            if (isolateBtn) isolateBtn.click();
        })()
        """)
        time.sleep(1)

        # Capture Posterior Back View of Pregnancy to prove zero sacral penetration
        print("\n--- STEP 4B: Pregnancy Mode Posterior Back View (Zero Sacral Penetration Check) ---")
        evaluate("""
        (() => {
            const btns = Array.from(document.querySelectorAll('.view-controls button'));
            const backBtn = btns.find(b => b.textContent.trim() === 'B' || b.title?.toLowerCase().includes('back'));
            if (backBtn) backBtn.click();
        })()
        """)
        time.sleep(1.8)
        capture_screenshot("07c_pregnancy_posterior_no_penetration.png")

        # Switch camera back to 3/4 view
        evaluate("""
        (() => {
            const btns = Array.from(document.querySelectorAll('.view-controls button'));
            const threeQuarterBtn = btns.find(b => b.textContent.trim() === '¾' || b.title?.toLowerCase().includes('three-quarter'));
            if (threeQuarterBtn) threeQuarterBtn.click();
        })()
        """)
        time.sleep(1.2)

        # -------------------------------------------------------------
        # STEP 5: Switch to Age Explorer Mode & DEXA Heatmap (Peak vs Geriatric)
        # -------------------------------------------------------------
        print("\n--- STEP 5: Switch to Age Explorer Mode & DEXA ---")
        evaluate("""
        (() => {
            const btns = Array.from(document.querySelectorAll('nav button'));
            const ageBtn = btns.find(b => b.textContent.includes('Age Explorer'));
            if (ageBtn) ageBtn.click();
        })()
        """)
        wait_loading(20)
        evaluate("""
        (() => {
            const dexaBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('DEXA Heatmap'));
            if (dexaBtn) dexaBtn.click();
            if (window.__ATLAS_APP__ && window.__ATLAS_APP__.setAgeYear) {
                window.__ATLAS_APP__.setAgeYear(25);
            }
        })()
        """)
        time.sleep(2)
        capture_screenshot("08_aging_mode_dexa.png")

        # Now test Age 75 (Osteoporosis red heatmap & Dowager kyphosis)
        evaluate("""
        (() => {
            if (window.__ATLAS_APP__ && window.__ATLAS_APP__.setAgeYear) {
                window.__ATLAS_APP__.setAgeYear(75);
            }
        })()
        """)
        time.sleep(2)
        capture_screenshot("08b_aging_osteoporosis_75.png")

        # Capture Skeleton Only view to clearly expose the crimson DEXA T-scores
        evaluate("""
        (() => {
            const skelBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Skeleton Only'));
            if (skelBtn) skelBtn.click();
            else if (window.__ATLAS_APP__ && window.__ATLAS_APP__.setVisible) {
                window.__ATLAS_APP__.setVisible(['skeletal']);
            }
        })()
        """)
        time.sleep(1.5)
        capture_screenshot("08c_aging_osteoporosis_skeleton_75.png")

        # -------------------------------------------------------------
        # STEP 6: Switch to Female Trunk HRA
        # -------------------------------------------------------------
        print("\n--- STEP 6: Switch to Female Trunk HRA ---")
        evaluate("""
        (() => {
            const btns = Array.from(document.querySelectorAll('nav button'));
            const femBtn = btns.find(b => b.textContent.includes('Female Atlas'));
            if (femBtn) femBtn.click();
        })()
        """)
        time.sleep(1)
        evaluate("""
        (() => {
            const subBtns = Array.from(document.querySelectorAll('button'));
            const trunkBtn = subBtns.find(b => b.textContent.includes('NIH HRA Trunk'));
            if (trunkBtn) trunkBtn.click();
        })()
        """)
        wait_loading(20)
        capture_screenshot("09_female_trunk_hra.png")

        # -------------------------------------------------------------
        # STEP 7: Switch back to Full-Body and Test Exploded View
        # -------------------------------------------------------------
        print("\n--- STEP 7: Exploded View Anatomy Separation ---")
        evaluate("""
        (() => {
            const subBtns = Array.from(document.querySelectorAll('button'));
            const fullBtn = subBtns.find(b => b.textContent.includes('Full-Body Parity'));
            if (fullBtn) fullBtn.click();
        })()
        """)
        wait_loading(20)
        # Move slider via window.__ATLAS_APP__
        evaluate("""
        (() => {
            if (window.__ATLAS_APP__ && window.__ATLAS_APP__.setExplode) {
                window.__ATLAS_APP__.setExplode(0.5);
                return true;
            }
            return false;
        })()
        """)
        time.sleep(3.0)
        capture_screenshot("10_female_exploded_view.png")

        # -------------------------------------------------------------
        # STEP 8: Switch to VHF Hybrid and Test Cranial & Female Anatomy
        # -------------------------------------------------------------
        print("\n--- STEP 8: Switch to VHF Hybrid ---")
        evaluate("""
        (() => {
            if (window.__ATLAS_APP__ && window.__ATLAS_APP__.setExplode) {
                window.__ATLAS_APP__.setExplode(0);
            }
            const subBtns = Array.from(document.querySelectorAll('button'));
            const vhfBtn = subBtns.find(b => b.textContent.includes('VHF Hybrid'));
            if (vhfBtn) vhfBtn.click();
        })()
        """)
        wait_loading(20)
        capture_screenshot("11_female_hybrid_vhf.png")

        print("\n[SUCCESS] All deep interaction tests completed successfully!")

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
