// ==========================================================================
// OMNI-HUMAN 3D — Master Conductor & Application Engine
// Integrates Macro-Anatomy, Physiology, Biomechanics, Hardware Telemetry,
// Radiology MPR, Cellular World Modeling, and Gemini Clinical Diagnostic AI.
// ==========================================================================

class OmniEngine {
    constructor() {
        this.container = document.getElementById('three-master-canvas');

        // Master Three.js Scene
        this.scene = null;
        this.camera = null;
        this.renderer = null;
        this.controls = null;
        this.clock = new THREE.Clock();

        // Subsystems
        this.audioSynth = null;
        this.macroBuilder = null;
        this.physiologyEngine = null;
        this.kinematicsEngine = null;
        this.telemetryEngine = null;
        this.radiologyMPR = null;
        this.cellularTwin = null;
        this.clinicalAI = null;

        // Interaction
        this.raycaster = new THREE.Raycaster();
        this.mouse = new THREE.Vector2();
        this.hoveredObject = null;
        this.floatingTag = document.getElementById('floating-organ-tag');

        // State
        this.currentTheme = 'jarvis'; // 'jarvis' or 'studio'
    }

    init() {
        console.log("[OmniEngine] Booting OmniHuman-3D Living Digital Twin...");

        // 1. Initialize Master 3D Viewport
        this.initThree();

        // 2. Initialize Subsystems
        this.audioSynth = new AudioStethoscopeSynth();
        window.audioSynth = this.audioSynth;

        this.macroBuilder = new MacroAnatomyBuilder(this.scene);
        this.macroBuilder.init();
        window.macroBuilder = this.macroBuilder;

        this.physiologyEngine = new PhysiologyEngine(this.macroBuilder, this.audioSynth);
        this.physiologyEngine.init();
        window.physiologyEngine = this.physiologyEngine;

        this.kinematicsEngine = new KinematicsEngine(this.macroBuilder);
        this.kinematicsEngine.init();
        window.kinematicsEngine = this.kinematicsEngine;

        this.telemetryEngine = new TelemetryEngine(this.kinematicsEngine);
        this.telemetryEngine.init();
        window.telemetryEngine = this.telemetryEngine;

        this.radiologyMPR = new RadiologyMPRDeck(this.scene, this.macroBuilder);
        this.radiologyMPR.init();
        window.radiologyMPR = this.radiologyMPR;

        this.cellularTwin = new CellularTwinModal();
        this.cellularTwin.init();
        window.cellularTwin = this.cellularTwin;

        this.clinicalAI = new ClinicalAIEngine(
            this.macroBuilder,
            this.physiologyEngine,
            this.kinematicsEngine,
            this.audioSynth
        );
        this.clinicalAI.init();
        window.clinicalAI = this.clinicalAI;

        // 3. Bind UI Events & Interactions
        this.bindGlobalEvents();
        this.bindRaycasting();

        // 4. Start Stethoscope Audio on first user interaction
        const startAudioOnce = () => {
            if (this.audioSynth) this.audioSynth.init();
            window.removeEventListener('click', startAudioOnce);
        };
        window.addEventListener('click', startAudioOnce);

        // 5. Start Master Animation Loop
        this.animate();

        console.log("[OmniEngine] OmniHuman-3D initialized successfully.");
    }

    initThree() {
        if (!this.container) return;

        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x060d17);

        const w = this.container.clientWidth || 800;
        const h = this.container.clientHeight || 700;

        this.camera = new THREE.PerspectiveCamera(40, w / h, 1, 1000);
        this.camera.position.set(0, 48, 140);

        this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
        this.renderer.setSize(w, h);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
        this.renderer.toneMappingExposure = 1.1;
        this.container.appendChild(this.renderer.domElement);

        if (window.THREE.OrbitControls) {
            this.controls = new THREE.OrbitControls(this.camera, this.renderer.domElement);
            this.controls.enableDamping = true;
            this.controls.dampingFactor = 0.06;
            this.controls.target.set(0, 42, 0);
            this.controls.minDistance = 20;
            this.controls.maxDistance = 300;
        }

        // Lighting Architecture
        const ambLight = new THREE.AmbientLight(0xffffff, 0.65);
        this.scene.add(ambLight);

        const keyLight = new THREE.DirectionalLight(0x00f0ff, 1.2);
        keyLight.position.set(60, 80, 80);
        this.scene.add(keyLight);

        const fillLight = new THREE.DirectionalLight(0x3b82f6, 0.8);
        fillLight.position.set(-60, 40, 60);
        this.scene.add(fillLight);

        const rimLight = new THREE.DirectionalLight(0xffffff, 0.9);
        rimLight.position.set(0, 90, -80);
        this.scene.add(rimLight);

        // Ground Grid
        const grid = new THREE.GridHelper(120, 24, 0x00f0ff, 0x003344);
        grid.position.y = -85;
        this.scene.add(grid);

        window.addEventListener('resize', () => this.onWindowResize());
    }

    onWindowResize() {
        if (!this.container || !this.camera || !this.renderer) return;
        const w = this.container.clientWidth;
        const h = this.container.clientHeight;
        if (w > 0 && h > 0) {
            this.camera.aspect = w / h;
            this.camera.updateProjectionMatrix();
            this.renderer.setSize(w, h);
        }
    }

    bindGlobalEvents() {
        // Theme toggle
        const btnTheme = document.getElementById('btn-toggle-theme');
        const themeText = document.getElementById('theme-btn-text');
        if (btnTheme) {
            btnTheme.addEventListener('click', () => {
                if (this.currentTheme === 'jarvis') {
                    this.currentTheme = 'studio';
                    document.body.className = 'theme-studio';
                    this.scene.background = new THREE.Color(0xf1f5f9);
                    if (themeText) themeText.textContent = "Jarvis Mode";
                } else {
                    this.currentTheme = 'jarvis';
                    document.body.className = 'theme-jarvis';
                    this.scene.background = new THREE.Color(0x060d17);
                    if (themeText) themeText.textContent = "Studio Mode";
                }
                if (this.macroBuilder) this.macroBuilder.setTheme(this.currentTheme);
            });
        }

        // Stethoscope Audio toggle
        const btnAudio = document.getElementById('btn-toggle-audio');
        if (btnAudio) {
            btnAudio.addEventListener('click', () => {
                if (!this.audioSynth.ctx) this.audioSynth.init();
                const enabled = this.audioSynth.toggleAudio();
                btnAudio.classList.toggle('active', enabled);
                const audioIcon = document.getElementById('audio-icon');
                if (audioIcon) audioIcon.textContent = enabled ? "🔊" : "🔇";
            });
        }

        // Camera viewpoint presets
        const btnAnt = document.getElementById('btn-view-anterior');
        const btnPost = document.getElementById('btn-view-posterior');
        const btnLat = document.getElementById('btn-view-lateral');
        const btnOrbit = document.getElementById('btn-view-orbit');

        const hudBtns = [btnAnt, btnPost, btnLat, btnOrbit];
        const activateHudBtn = (targetBtn) => {
            hudBtns.forEach((b) => b && b.classList.remove('active'));
            if (targetBtn) targetBtn.classList.add('active');
        };

        if (btnAnt) {
            btnAnt.addEventListener('click', () => {
                activateHudBtn(btnAnt);
                this.animateCameraPosition(new THREE.Vector3(0, 48, 140));
            });
        }
        if (btnPost) {
            btnPost.addEventListener('click', () => {
                activateHudBtn(btnPost);
                this.animateCameraPosition(new THREE.Vector3(0, 48, -140));
            });
        }
        if (btnLat) {
            btnLat.addEventListener('click', () => {
                activateHudBtn(btnLat);
                this.animateCameraPosition(new THREE.Vector3(140, 48, 0));
            });
        }
        if (btnOrbit) {
            btnOrbit.addEventListener('click', () => {
                activateHudBtn(btnOrbit);
            });
        }

        // Sidebar Tabs
        const sideTabs = document.querySelectorAll('.side-tab');
        sideTabs.forEach((tab) => {
            tab.addEventListener('click', () => {
                sideTabs.forEach((t) => t.classList.remove('active'));
                tab.classList.add('active');

                const targetId = tab.dataset.tab;
                document.querySelectorAll('.tab-content').forEach((tc) => tc.classList.remove('active'));
                const activeContent = document.getElementById(targetId);
                if (activeContent) activeContent.classList.add('active');
            });
        });

        // Layer Toggles & Opacity Sliders
        const layers = ['skin', 'muscles', 'skeleton', 'viscera', 'cardio', 'nerves'];
        layers.forEach((layer) => {
            const check = document.getElementById(`check-${layer}`);
            const slider = document.getElementById(`slider-${layer}`);

            if (check) {
                check.addEventListener('change', (e) => {
                    this.macroBuilder.setLayerVisibility(layer, e.target.checked);
                });
            }
            if (slider) {
                slider.addEventListener('input', (e) => {
                    this.macroBuilder.setLayerOpacity(layer, parseFloat(e.target.value));
                });
            }
        });

        // Explode Dissection Slider
        const sliderExplode = document.getElementById('slider-explode');
        const valExplode = document.getElementById('val-explode');
        if (sliderExplode) {
            sliderExplode.addEventListener('input', (e) => {
                const pct = parseInt(e.target.value);
                if (valExplode) valExplode.textContent = `${pct}%`;
                if (this.macroBuilder) this.macroBuilder.setExplodeFactor(pct / 100);
            });
        }

        // Organ Focus Chips
        const organChips = document.querySelectorAll('.organ-chip');
        organChips.forEach((chip) => {
            chip.addEventListener('click', () => {
                organChips.forEach((c) => c.classList.remove('active'));
                chip.classList.add('active');
                if (this.macroBuilder) {
                    this.macroBuilder.focusOrganGroup(chip.dataset.organ);
                }
            });
        });

        // Scale Navigator buttons
        const btnScaleMacro = document.getElementById('btn-scale-macro');
        const btnScaleMeso = document.getElementById('btn-scale-meso');
        const btnScaleMicro = document.getElementById('btn-scale-micro');

        if (btnScaleMacro) {
            btnScaleMacro.addEventListener('click', () => {
                btnScaleMacro.classList.add('active');
                btnScaleMeso.classList.remove('active');
                btnScaleMicro.classList.remove('active');
                this.animateCameraPosition(new THREE.Vector3(0, 48, 140));
            });
        }
        if (btnScaleMeso) {
            btnScaleMeso.addEventListener('click', () => {
                btnScaleMacro.classList.remove('active');
                btnScaleMeso.classList.add('active');
                btnScaleMicro.classList.remove('active');
                // Zoom close to heart/lungs thoracic cage
                this.animateCameraPosition(new THREE.Vector3(0, 48, 55));
            });
        }

        // Reset All button
        const btnReset = document.getElementById('btn-reset-all');
        if (btnReset) {
            btnReset.addEventListener('click', () => {
                location.reload();
            });
        }
    }

    animateCameraPosition(targetPos) {
        if (!this.camera) return;
        const startPos = this.camera.position.clone();
        let t = 0;
        const step = () => {
            t += 0.05;
            this.camera.position.lerpVectors(startPos, targetPos, t);
            if (this.controls) this.controls.target.set(0, 42, 0);
            if (t < 1.0) requestAnimationFrame(step);
        };
        step();
    }

    bindRaycasting() {
        if (!this.container) return;

        this.container.addEventListener('mousemove', (e) => {
            const rect = this.container.getBoundingClientRect();
            this.mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
            this.mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

            if (this.floatingTag) {
                this.floatingTag.style.left = `${e.clientX - rect.left + 15}px`;
                this.floatingTag.style.top = `${e.clientY - rect.top + 15}px`;
            }

            this.checkIntersection();
        });

        this.container.addEventListener('click', () => {
            if (this.hoveredObject && this.clinicalAI) {
                this.clinicalAI.displayOrganDetails(this.hoveredObject);
                if (this.audioSynth) this.audioSynth.playChime();
            }
        });
    }

    checkIntersection() {
        if (!this.macroBuilder || !this.camera) return;

        this.raycaster.setFromCamera(this.mouse, this.camera);
        const intersects = this.raycaster.intersectObjects(this.macroBuilder.interactiveParts, true);

        if (intersects.length > 0) {
            let hit = intersects[0].object;
            // Climb up to interactive part with userData if hit child mesh
            while (hit && (!hit.userData || !hit.userData.name) && hit.parent) {
                hit = hit.parent;
            }

            if (hit && hit.userData && hit.userData.name) {
                this.hoveredObject = hit;
                if (this.floatingTag) {
                    this.floatingTag.textContent = hit.userData.name;
                    this.floatingTag.style.display = 'block';
                }
                document.body.style.cursor = 'pointer';
                return;
            }
        }

        this.hoveredObject = null;
        if (this.floatingTag) this.floatingTag.style.display = 'none';
        document.body.style.cursor = 'default';
    }

    animate() {
        requestAnimationFrame(() => this.animate());

        const delta = this.clock.getDelta();

        if (this.controls) this.controls.update();
        if (this.physiologyEngine) this.physiologyEngine.update(delta);
        if (this.telemetryEngine) this.telemetryEngine.update();

        if (this.renderer && this.scene && this.camera) {
            this.renderer.render(this.scene, this.camera);
        }
    }
}

// Auto-boot when DOM is loaded
window.addEventListener('DOMContentLoaded', () => {
    const engine = new OmniEngine();
    engine.init();
    window.omniEngine = engine;
});
