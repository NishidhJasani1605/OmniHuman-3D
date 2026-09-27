// ==========================================================================
// OMNI-HUMAN 3D — Production Clinical Workstation Orchestrator
// Connects to BodyParts3D authentic 2,234-piece atlas core
// Integrates:
// 1. Bio-Energy Holo-Engine (Cardiac pulsation, arterial waves, neural sparks)
// 2. Real-Time Lead II ECG Oscilloscope & Hemodynamics
// 3. Gemini Clinical Diagnostic Mind (Pathology simulations & treatment protocols)
// 4. Microscopic Virtual Cell Modal (GenBio AIDO Lab 3D Organelles & CRISPR)
// 5. Binary 3D Printable STL Exporter for any of the 2,234 anatomical pieces
// ==========================================================================

(function() {
    'use strict';

    let core = null; // window.__ATLAS_CORE__
    let isMuted = false;
    let bioEnergyActive = true;
    let cinematicTourActive = false;
    let tourAngle = 0;
    let selectedPartData = null;

    // Hemodynamic parameters
    let currentBpm = 75;
    let currentPathology = 'healthy';

    // ECG Buffer
    let ecgCanvas = null;
    let ecgCtx = null;
    let ecgPoints = [];
    let ecgX = 0;
    let ecgTime = 0;

    // Web Audio Synthesizer (respects browser user interaction requirement)
    let audioCtx = null;
    let userInteracted = false;
    window.addEventListener('pointerdown', () => { userInteracted = true; if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume(); }, { once: true });
    window.addEventListener('keydown', () => { userInteracted = true; if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume(); }, { once: true });

    function getAudioContext() {
        if (!userInteracted) return null;
        if (!audioCtx) {
            const AudioContext = window.AudioContext || window.webkitAudioContext;
            if (AudioContext) audioCtx = new AudioContext();
        }
        if (audioCtx && audioCtx.state === 'suspended') {
            audioCtx.resume();
        }
        return audioCtx;
    }

    function playTone(freq, duration, type = 'sine', gainVal = 0.2) {
        if (isMuted) return;
        try {
            const ctx = getAudioContext();
            if (!ctx) return;
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = type;
            osc.frequency.setValueAtTime(freq, ctx.currentTime);
            gain.gain.setValueAtTime(gainVal, ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.start();
            osc.stop(ctx.currentTime + duration);
        } catch (e) {}
    }

    function playLubDub() {
        if (isMuted || !bioEnergyActive) return;
        try {
            const ctx = getAudioContext();
            if (!ctx) return;
            const now = ctx.currentTime;
            // S1 Low frequency
            const osc1 = ctx.createOscillator();
            const gain1 = ctx.createGain();
            osc1.frequency.setValueAtTime(54, now);
            osc1.frequency.exponentialRampToValueAtTime(32, now + 0.12);
            gain1.gain.setValueAtTime(0.28, now);
            gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
            osc1.connect(gain1);
            gain1.connect(ctx.destination);
            osc1.start(now);
            osc1.stop(now + 0.12);
            // S2 Snappy
            const osc2 = ctx.createOscillator();
            const gain2 = ctx.createGain();
            osc2.frequency.setValueAtTime(82, now + 0.22);
            osc2.frequency.exponentialRampToValueAtTime(45, now + 0.32);
            gain2.gain.setValueAtTime(0.22, now + 0.22);
            gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.32);
            osc2.connect(gain2);
            gain2.connect(ctx.destination);
            osc2.start(now + 0.22);
            osc2.stop(now + 0.32);
        } catch (e) {}
    }

    // =========================================================================
    // 1. HOLO-ENGINE (Bioluminescent shaders, particle swarm, bio-energy)
    // =========================================================================
    const HoloEngine = {
        time: 0,
        lastBeatTime: 0,

        init() {
            if (!core) return;
            const { renderer, scene, mats, THREE } = core;

            // 1. Pristine Medical Studio Environment (Clean deep dark obsidian)
            renderer.setClearColor(0x060812, 1.0);
            scene.background = new THREE.Color(0x060812);

            // 2. Surgical Studio Lighting (Balanced Neutral Daylight)
            scene.children.forEach(child => {
                if (child.isDirectionalLight) {
                    if (child.position.x < 0) {
                        child.color.setHex(0xffffff);
                        child.intensity = 2.6;
                    } else {
                        child.color.setHex(0xf8fafc);
                        child.intensity = 2.2;
                    }
                } else if (child.isHemisphereLight || child.isAmbientLight) {
                    child.color.setHex(0xffffff);
                    if (child.groundColor) child.groundColor.setHex(0xb0b8c8);
                    child.intensity = 1.2;
                }
            });

            // 3. Ensure clean, calibrated medical materials without harsh artificial emissives
            if (mats) {
                mats.forEach((mat) => {
                    if (mat && mat.emissive) {
                        mat.emissive.setHex(0x000000);
                        mat.emissiveIntensity = 0.0;
                    }
                });
            }

            // Clean rendering: NO wireframe particles, NO ground rings, NO vertex displacement
            core.markDirty();
        },

        update(delta) {
            if (!core) return false;
            const { camera, controls } = core;

            this.time += delta;

            // 1. Cinematic Tour (smooth camera orbit without mesh distortion)
            if (cinematicTourActive && camera && controls) {
                tourAngle += delta * 0.25;
                const dist = 2.4;
                const camY = controls.target.y + 0.15 + Math.sin(tourAngle * 1.5) * 0.35;
                camera.position.x = controls.target.x + Math.sin(tourAngle) * dist;
                camera.position.z = controls.target.z + Math.cos(tourAngle) * dist;
                camera.position.y = camY;
                controls.update();
                core.markDirty();
            }

            // 2. Auscultation heartbeat sound (timed with heart rate)
            if (bioEnergyActive && !isMuted) {
                const beatPeriod = 60 / currentBpm;
                const beatProgress = (this.time % beatPeriod) / beatPeriod;
                if (beatProgress >= 0.18 && this.lastBeatTime !== Math.floor(this.time / beatPeriod)) {
                    this.lastBeatTime = Math.floor(this.time / beatPeriod);
                    playLubDub();
                }
            }

            return true;
        }
    };

    // =========================================================================
    // 2. LIVE LEAD II ECG OSCILLOSCOPE
    // =========================================================================
    function initECG() {
        ecgCanvas = document.getElementById('ecg-live-canvas');
        if (!ecgCanvas) return;
        ecgCtx = ecgCanvas.getContext('2d');
        ecgPoints = new Array(ecgCanvas.width).fill(ecgCanvas.height / 2);
    }

    function updateECG(delta) {
        if (!ecgCtx || !ecgCanvas) return;
        ecgTime += delta;

        const w = ecgCanvas.width;
        const h = ecgCanvas.height;
        const midY = h / 2;

        const freq = currentBpm / 60;
        const phase = (ecgTime * freq) % 1.0;

        let deflection = 0;
        if (phase > 0.05 && phase < 0.14) {
            deflection = Math.sin(((phase - 0.05) / 0.09) * Math.PI) * 0.22; // P-wave
        } else if (phase >= 0.18 && phase < 0.22) {
            deflection = -0.16; // Q
        } else if (phase >= 0.22 && phase < 0.27) {
            deflection = Math.sin(((phase - 0.22) / 0.05) * Math.PI) * 1.35; // R spike
        } else if (phase >= 0.27 && phase < 0.31) {
            deflection = -0.32; // S
        } else if (phase >= 0.31 && phase < 0.48) {
            deflection = currentPathology === 'stemi' ? 0.62 : 0.0; // ST Elevation
        } else if (phase >= 0.48 && phase < 0.65) {
            const tP = (phase - 0.48) / 0.17;
            deflection = Math.sin(tP * Math.PI) * (currentPathology === 'stemi' ? 0.8 : 0.32); // T
        }

        const baselineNoise = (Math.random() - 0.5) * 0.03;
        const currentY = midY - (deflection + baselineNoise) * (h * 0.38);

        ecgPoints[ecgX] = currentY;
        ecgX = (ecgX + 2) % w;

        // Draw Canvas
        ecgCtx.fillStyle = '#020612';
        ecgCtx.fillRect(0, 0, w, h);

        // ECG grid
        ecgCtx.strokeStyle = 'rgba(0, 240, 255, 0.08)';
        ecgCtx.lineWidth = 1;
        ecgCtx.beginPath();
        for (let x = 0; x < w; x += 15) { ecgCtx.moveTo(x, 0); ecgCtx.lineTo(x, h); }
        for (let y = 0; y < h; y += 15) { ecgCtx.moveTo(0, y); ecgCtx.lineTo(w, y); }
        ecgCtx.stroke();

        // Trace
        ecgCtx.beginPath();
        ecgCtx.lineWidth = 2.0;
        const isAlert = currentPathology === 'stemi' || currentPathology === 'pneumothorax';
        ecgCtx.strokeStyle = isAlert ? '#ff1744' : '#00f0ff';
        ecgCtx.shadowColor = isAlert ? 'rgba(255, 23, 68, 0.8)' : 'rgba(0, 240, 255, 0.8)';
        ecgCtx.shadowBlur = 5;

        for (let i = 0; i < w; i++) {
            if (Math.abs(i - ecgX) < 6) continue;
            const y = ecgPoints[i] || midY;
            if (i === 0) ecgCtx.moveTo(i, y);
            else ecgCtx.lineTo(i, y);
        }
        ecgCtx.stroke();
        ecgCtx.shadowBlur = 0;
    }

    // =========================================================================
    // 3. GEMINI CLINICAL DIAGNOSTIC MIND (Pathology states)
    // =========================================================================
    function setPathology(pathologyKey) {
        currentPathology = pathologyKey;
        playTone(880, 0.15, 'sine', 0.2);

        const elConf = document.getElementById('dock-conf');
        const elHR = document.getElementById('vital-hr');
        const elBP = document.getElementById('vital-bp');
        const elSpO2 = document.getElementById('vital-spo2');
        const elLoad = document.getElementById('vital-load');
        const elEcgStatus = document.getElementById('ecg-live-status');
        const elDiagTitle = document.getElementById('diag-title');
        const elDiagBody = document.getElementById('diag-body');
        const elTreatment = document.getElementById('diag-treatment');

        switch (pathologyKey) {
            case 'stemi':
                currentBpm = 112;
                if (elConf) elConf.textContent = '99.8% CRITICAL';
                if (elHR) elHR.innerHTML = '112 <small>BPM</small>';
                if (elBP) elBP.textContent = '88/56';
                if (elSpO2) elSpO2.innerHTML = '91% <small>SpO2</small>';
                if (elLoad) elLoad.innerHTML = '420 <small>N</small>';
                if (elEcgStatus) { elEcgStatus.textContent = 'ANTERIOR ST-ELEVATION'; elEcgStatus.style.color = '#ff1744'; }
                if (elDiagTitle) elDiagTitle.textContent = 'Pathology: Acute Transmural Anterior STEMI';
                if (elDiagBody) elDiagBody.textContent = 'Severe occlusion of the Left Anterior Descending (LAD) coronary artery resulting in extensive left ventricular transmural ischemia. Precordial leads demonstrate massive tombstone ST elevation. Acute threat of cardiogenic shock.';
                if (elTreatment) elTreatment.textContent = '1. Immediate Emergent Percutaneous Coronary Intervention (PCI, door-to-balloon < 90m).\n2. DAPT: Aspirin 325mg + Ticagrelor 180mg loading dose.\n3. IV Unfractionated Heparin anticoagulation.\n4. Sublingual nitroglycerin & high-flow oxygen.';
                break;

            case 'herniation':
                currentBpm = 88;
                if (elConf) elConf.textContent = '98.6% HIGH';
                if (elHR) elHR.innerHTML = '88 <small>BPM</small>';
                if (elBP) elBP.textContent = '135/88';
                if (elSpO2) elSpO2.innerHTML = '98% <small>SpO2</small>';
                if (elLoad) { elLoad.innerHTML = '2,495 <small>N</small>'; elLoad.style.color = '#ffb300'; }
                if (elEcgStatus) { elEcgStatus.textContent = 'SINUS TACHYCARDIA (PAIN)'; elEcgStatus.style.color = '#38bdf8'; }
                if (elDiagTitle) elDiagTitle.textContent = 'Pathology: L4-L5 Lumbar Disc Herniation';
                if (elDiagBody) elDiagBody.textContent = 'Posterolateral rupture of annulus fibrosus with direct compression upon traversing S1 nerve root. NIOSH compressive disc load exceeds 2,400 N with intense reactive erector spinae paraspinal spasm.';
                if (elTreatment) elTreatment.textContent = '1. Axial & sagittal lumbar spine MRI.\n2. Conservative physical therapy: McKenzie extension protocol.\n3. Fluoroscopy-guided epidural steroid injection if radicular pain persists > 6 weeks.\n4. Microdiscectomy surgical decompression if progressive motor deficit.';
                break;

            case 'pneumothorax':
                currentBpm = 138;
                if (elConf) elConf.textContent = '99.9% EMERGENCY';
                if (elHR) elHR.innerHTML = '138 <small>BPM</small>';
                if (elBP) elBP.textContent = '80/50';
                if (elSpO2) elSpO2.innerHTML = '82% <small>SpO2</small>';
                if (elLoad) elLoad.innerHTML = '420 <small>N</small>';
                if (elEcgStatus) { elEcgStatus.textContent = 'SEVERE SHOCK TACHYCARDIA'; elEcgStatus.style.color = '#ff1744'; }
                if (elDiagTitle) elDiagTitle.textContent = 'Pathology: Tension Pneumothorax (Right Hemithorax)';
                if (elDiagBody) elDiagBody.textContent = 'One-way pleural defect with intrapleural air accumulation causing total right lung collapse and contralateral mediastinal shift. Caval compression severely compromises venous return, inducing obstructive shock.';
                if (elTreatment) elTreatment.textContent = '1. Emergent needle decompression: 14G catheter in 2nd intercostal space midclavicular line.\n2. Immediate tube thoracostomy (chest drain) with underwater seal.\n3. 100% FiO2 oxygenation.\n4. Radiographic verification of lung re-expansion.';
                break;

            case 'cirrhosis':
                currentBpm = 92;
                if (elConf) elConf.textContent = '97.4% HIGH';
                if (elHR) elHR.innerHTML = '92 <small>BPM</small>';
                if (elBP) elBP.textContent = '105/65';
                if (elSpO2) elSpO2.innerHTML = '95% <small>SpO2</small>';
                if (elLoad) elLoad.innerHTML = '420 <small>N</small>';
                if (elEcgStatus) { elEcgStatus.textContent = 'PROLONGED QTc (CIRRHOTIC)'; elEcgStatus.style.color = '#38bdf8'; }
                if (elDiagTitle) elDiagTitle.textContent = 'Pathology: Decompensated Hepatic Cirrhosis';
                if (elDiagBody) elDiagBody.textContent = 'End-stage liver architecture disruption with bridging fibrosis and portal hypertension > 12 mmHg. Splanchnic arterial vasodilation, hyperdynamic circulation, and ascites formation.';
                if (elTreatment) elTreatment.textContent = '1. Non-selective beta-blockers (Carvedilol) for variceal bleeding prophylaxis.\n2. Sodium restriction (<2g/day) + Spironolactone/Furosemide.\n3. Endoscopic surveillance band ligation.\n4. Evaluate for TIPS and liver transplantation.';
                break;

            case 'healthy':
            default:
                currentBpm = 75;
                if (elConf) elConf.textContent = '99.4% OPTIMAL';
                if (elHR) elHR.innerHTML = '75 <small>BPM</small>';
                if (elBP) elBP.textContent = '120/80';
                if (elSpO2) elSpO2.innerHTML = '99% <small>SpO2</small>';
                if (elLoad) { elLoad.innerHTML = '420 <small>N</small>'; elLoad.style.color = '#f8fafc'; }
                if (elEcgStatus) { elEcgStatus.textContent = 'NORMAL SINUS RHYTHM'; elEcgStatus.style.color = '#00f0ff'; }
                if (elDiagTitle) elDiagTitle.textContent = 'Pathology: Normal Physiological Equilibrium';
                if (elDiagBody) elDiagBody.textContent = 'All organ systems are functioning within ideal clinical homeostasis. Cardiac stroke volume, pulmonary tidal compliance, and musculoskeletal axial loading are optimal.';
                if (elTreatment) elTreatment.textContent = 'Maintain regular aerobic exercise, balanced macro-nutritional intake, core stability conditioning, and ergonomic spine neutrality.';
                break;
        }
    }

    // =========================================================================
    // 4. ORGAN SELECTION & SMART UNIVERSAL ISOLATION / 3D PRINTABLE STL
    // =========================================================================
    const CLINICAL_ANATOMY_KNOWLEDGE = {
        heart: 'Primary four-chambered muscular organ of the circulatory system. Myocardium generates rhythmic stroke volume to drive systemic arterial and pulmonary oxygenation circuits.',
        liver: 'Largest internal metabolic organ. Performs biotransformation, bile secretion, gluconeogenesis, plasma albumin synthesis, and clotting factor regulation.',
        brain: 'Master organ of the central nervous system. Integrates sensory perception, motor control, executive cognition, and autonomic homeostatic equilibrium.',
        stomach: 'Muscular hollow organ of the gastrointestinal tract. Mediates enzymatic acid chyme digestion and gastric intrinsic factor secretion.',
        pancreas: 'Dual exocrine and endocrine gland situated in retroperitoneum. Secretes digestive enzymes (trypsin, lipase) and glucose regulatory hormones (insulin, glucagon).',
        spleen: 'Primary secondary lymphoid organ situated in left hypochondrium. Filters blood, recycles senescent erythrocytes, and mounts adaptive immune responses.',
        lung: 'Essential bilateral respiratory organs. Enables passive alveolar gas exchange across the blood-air barrier between atmospheric oxygen and venous carbon dioxide.',
        kidney: 'Paired retroperitoneal nephrological organs. Filter blood plasma to produce urine, maintain electrolyte osmolarity, regulate blood pressure via RAAS, and produce erythropoietin.',
        aorta: 'Main systemic arterial trunk originating from left ventricle. Delivers oxygenated blood under high pressure to all systemic vascular distributions.',
        femur: 'Longest, strongest, and heaviest tubular bone in human skeleton. Transmits axial load forces from pelvis to tibia during bipedal locomotion.',
        skull: 'Bony skeletal framework of head. Encapsulates and protects encephalic neural tissue, sensory organs, and structural architecture of craniofacial anatomy.',
        gallbladder: 'Muscular pear-shaped sac resting in hepatic fossa. Concentrates and stores hepatic bile, releasing it into duodenum upon CCK stimulation during lipid digestion.',
        bladder: 'Distensible extraperitoneal muscular reservoir in pelvis. Collects and stores urine delivered via ureters prior to voluntary micturition.'
    };

    const SYSTEM_COLOR_MAP = {
        cardiac: '#ef4444',
        circulatory: '#ef4444',
        respiratory: '#38bdf8',
        digestive: '#f97316',
        nervous: '#a855f7',
        skeletal: '#e2e8f0',
        muscular: '#f43f5e',
        urinary: '#eab308',
        endocrine: '#06b6d4',
        lymphatic: '#10b981',
        reproductive: '#ec4899'
    };

    function showOrganHUD(partId) {
        if (!core) return;
        const { atlas, centers } = core;
        const idx = atlas.parts.findIndex(p => p.id === partId);
        if (idx < 0) return;

        const part = atlas.parts[idx];
        selectedPartData = part;

        const elName = document.getElementById('inspect-name');
        const elSub = document.getElementById('inspect-sub');
        const elDesc = document.getElementById('inspect-desc');
        const elSystem = document.getElementById('inspect-system');
        const elDot = document.getElementById('inspect-dot');
        const elConcept = document.getElementById('inspect-concept');

        const sysName = (part.system || 'ORGAN').toLowerCase();
        const sysColor = SYSTEM_COLOR_MAP[sysName] || '#00f0ff';

        if (elName) elName.textContent = part.name;
        if (elSub) elSub.textContent = `AUTHENTIC BODYPARTS3D • ${part.conceptId || part.id}`;
        if (elSystem) elSystem.textContent = `${sysName.toUpperCase()} SYSTEM`;
        if (elDot) elDot.style.background = sysColor;
        if (elConcept) elConcept.textContent = part.conceptId || part.id;

        // Determine rich clinical description
        let desc = '';
        const lowerName = part.name.toLowerCase();
        for (const [k, v] of Object.entries(CLINICAL_ANATOMY_KNOWLEDGE)) {
            if (lowerName.includes(k)) {
                desc = v;
                break;
            }
        }
        if (!desc) {
            const reactDesc = document.querySelector('.detail-sheet .detail-scroll')?.textContent?.trim();
            if (reactDesc && reactDesc.length > 15) {
                desc = reactDesc;
            } else {
                desc = `Authentic BodyParts3D clinical structure (${part.vertexCount || 1200} vertices, ${part.indexCount || 3600} indices). Fully mapped to Foundational Model of Anatomy (${part.conceptId || 'FMA'}).`;
            }
        }
        if (elDesc) elDesc.textContent = desc;

        playTone(1046.5, 0.08, 'sine', 0.2);

        // Smooth camera zoom & optimal framing around bounding box
        smoothZoomToPart(idx);

        // Synchronize isolation button text and state
        updateIsolationButtonState();
    }

    let cameraTransition = null;

    function smoothZoomToPart(idx) {
        if (!core) return;
        const { centers, bounds, camera, controls } = core;
        const center = centers[idx];
        const box = bounds[idx];
        if (!center || !camera || !controls) return;

        cinematicTourActive = false;
        const btnTour = document.getElementById('btn-tour');
        if (btnTour) btnTour.classList.remove('active');

        let dist = 0.45;
        if (box) {
            const size = new core.THREE.Vector3();
            box.getSize(size);
            const maxDim = Math.max(size.x, size.y, size.z, 0.05);
            const fov = (camera.fov || 45) * (Math.PI / 180);
            dist = Math.max((maxDim / 2) / Math.tan(fov / 2) * 1.55, 0.20);
        }

        const startCam = camera.position.clone();
        const startTarget = controls.target.clone();

        let dir = camera.position.clone().sub(controls.target).normalize();
        if (dir.lengthSq() < 0.1) dir.set(0.18, 0.08, 0.95).normalize();
        const targetCam = center.clone().add(dir.multiplyScalar(dist));

        cameraTransition = {
            startCam,
            targetCam,
            startTarget,
            targetCenter: center.clone(),
            elapsed: 0,
            dur: 0.5
        };
        core.markDirty();
    }

    function smoothResetCamera() {
        if (!core) return;
        const { camera, controls } = core;
        if (!camera || !controls) return;
        const startCam = camera.position.clone();
        const startTarget = controls.target.clone();
        const targetCenter = new core.THREE.Vector3(0, 0.85, 0);
        const targetCam = new core.THREE.Vector3(0.35, 0.95, 2.1);
        cameraTransition = {
            startCam,
            targetCam,
            startTarget,
            targetCenter,
            elapsed: 0,
            dur: 0.6
        };
        core.markDirty();
    }

    // =========================================================================
    // CINEMATIC ANATOMICAL PEELING & TRANSECTION ENGINE (ALL 2,234 PARTS)
    // =========================================================================
    const CinematicDissector = {
        active: false,
        phase: 0,
        elapsed: 0,
        targetId: null,
        targetIndex: -1,
        targetPart: null,
        targetSystem: null,
        targetCenter: null,
        targetCamPos: null,
        flightStartCam: null,
        flightStartTarget: null,
        phase1StartCam: null,
        phase1StartTarget: null,
        maxRemainingDist: 1.6,
        partDistances: null,
        phaseDurations: {
            anchor: 0.65,     // Phase 1: Full-body context + glowing beacon pulse
            layerPeel: 1.25,  // Phase 2: System layer peeling & transection
            flight: 1.80      // Phase 3: Synchronized camera flight + spatial wave culling
        },
        hudEl: null,
        hudTimeout: null,

        initHUD() {
            if (this.hudEl || document.getElementById('omni-cinematic-hud')) {
                this.hudEl = document.getElementById('omni-cinematic-hud');
                return;
            }
            const hud = document.createElement('div');
            hud.id = 'omni-cinematic-hud';
            hud.innerHTML = `
                <div class="omni-hud-pulse"></div>
                <div class="omni-hud-content">
                    <span class="omni-hud-stage" id="omni-hud-stage">WHOLE BODY</span>
                    <span class="omni-hud-title" id="omni-hud-title">Locating structure...</span>
                </div>
                <button class="omni-hud-skip" id="btn-skip-dissection" title="Skip animation">Skip ⏩</button>
            `;
            document.body.appendChild(hud);
            this.hudEl = hud;

            const btnSkip = document.getElementById('btn-skip-dissection');
            if (btnSkip) {
                btnSkip.addEventListener('click', (e) => {
                    e.stopPropagation();
                    this.instantFinish();
                });
            }
        },

        showHUD(stage, text) {
            this.initHUD();
            const stageEl = document.getElementById('omni-hud-stage');
            const titleEl = document.getElementById('omni-hud-title');
            if (stageEl) stageEl.textContent = stage;
            if (titleEl) titleEl.innerHTML = text;
            if (this.hudEl) this.hudEl.classList.add('visible');
            if (this.hudTimeout) clearTimeout(this.hudTimeout);
        },

        hideHUD(delayMs = 2500) {
            if (this.hudTimeout) clearTimeout(this.hudTimeout);
            this.hudTimeout = setTimeout(() => {
                if (this.hudEl) this.hudEl.classList.remove('visible');
            }, delayMs);
        },

        start(partId) {
            if (!core || !core.atlas || !core.atlas.parts) return;
            const idx = core.atlas.parts.findIndex(p => p.id === partId);
            if (idx < 0) return;

            // Prevent re-triggering for same active target
            if (this.active && this.targetId === partId) return;

            this.initHUD();
            cameraTransition = null;
            cinematicTourActive = false;
            const btnTour = document.getElementById('btn-tour');
            if (btnTour) btnTour.classList.remove('active');

            const part = core.atlas.parts[idx];
            this.targetId = partId;
            this.targetIndex = idx;
            this.targetPart = part;
            this.targetSystem = part.system || 'skeletal';
            selectedPartData = part;

            // Target 3D coordinates & bounding dimensions
            const center = core.centers[idx] ? core.centers[idx].clone() : new core.THREE.Vector3(0, 0.85, 0);
            this.targetCenter = center;

            const box = core.bounds[idx];
            let dist = 0.40;
            if (box) {
                const size = new core.THREE.Vector3();
                box.getSize(size);
                const maxDim = Math.max(size.x, size.y, size.z, 0.05);
                const fov = ((core.camera && core.camera.fov) || 45) * (Math.PI / 180);
                dist = Math.max((maxDim / 2) / Math.tan(fov / 2) * 1.55, 0.18);
            }

            let dir = core.camera.position.clone().sub(core.controls.target).normalize();
            if (dir.lengthSq() < 0.05) dir.set(0.18, 0.08, 0.95).normalize();
            this.targetCamPos = center.clone().add(dir.multiplyScalar(dist));

            // Precompute distances of all 2,234 parts from the target structure
            this.partDistances = new Float32Array(core.atlas.parts.length);
            let maxDist = 0;
            for (let i = 0; i < core.atlas.parts.length; i++) {
                if (core.centers[i]) {
                    const d = core.centers[i].distanceTo(center);
                    this.partDistances[i] = d;
                    if (d > maxDist) maxDist = d;
                } else {
                    this.partDistances[i] = 1.0;
                }
            }
            this.maxRemainingDist = Math.max(maxDist, 1.2);

            // Phase 1 Setup: Make sure ALL 2,234 parts are visible for whole body context
            if (core.partState) {
                for (let i = 0; i < core.atlas.parts.length; i++) {
                    core.partState[i * 4 + 3] = 1.0;
                }
                if (core.partStateTexture) core.partStateTexture.needsUpdate = true;
            }

            // Target structure glowing beacon
            if (core.selectionState) {
                for (let i = 0; i < core.atlas.parts.length; i++) {
                    core.selectionState[i * 4] = (i === idx) ? 255 : 0;
                }
                if (core.selectionTexture) core.selectionTexture.needsUpdate = true;
            }

            // Sync state: keep isolate false during animation, enable __ATLAS_DISSECTING__
            window.__ATLAS_DISSECTING__ = true;
            if (core.getState) {
                const st = core.getState();
                if (st) {
                    st.selected = [partId];
                    st.isolate = false;
                    st.explode = 0;
                    st.rotate = false;
                }
            }

            // Ensure whole body camera framing for Phase 1 Anchor
            const anchorCamPos = new core.THREE.Vector3(0.35, 0.95, 2.1);
            const anchorTarget = new core.THREE.Vector3(0, 0.85, 0);
            if (core.camera && core.controls && core.camera.position.distanceTo(anchorCamPos) > 0.25) {
                core.camera.position.copy(anchorCamPos);
                core.controls.target.copy(anchorTarget);
                core.controls.update();
            }

            // Update clinical dock and button state immediately
            showOrganHUD(partId);
            updateIsolationButtonState();

            this.phase1StartCam = core.camera.position.clone();
            this.phase1StartTarget = core.controls.target.clone();
            this.flightStartCam = core.camera.position.clone();
            this.flightStartTarget = core.controls.target.clone();

            this.active = true;
            this.phase = 1;
            this.startTime = performance.now();
            this.elapsed = 0;

            this.showHUD('🌐 WHOLE BODY', `Locating <span class="omni-hud-target-name">${part.name}</span> in human anatomy...`);
            playTone(880, 0.08, 'sine', 0.15);
            core.markDirty();
        },

        update(delta) {
            if (!this.active || !core) return false;
            const now = performance.now();
            if (!this.startTime) this.startTime = now;
            this.elapsed = (now - this.startTime) / 1000;

            const tP1 = this.phaseDurations.anchor;
            const tP2 = tP1 + this.phaseDurations.layerPeel;
            const tP3 = tP2 + this.phaseDurations.flight;

            // =================================================================
            // ACT 1: Full-Body Spatial Anchor & Beacon Pulse (0 to tP1)
            // =================================================================
            if (this.elapsed <= tP1) {
                this.phase = 1;
                const p = this.elapsed / tP1;
                const ease = p * p;

                // Ensure camera is oriented to full body if not already
                const anchorCamPos = new core.THREE.Vector3(0.35, 0.95, 2.1);
                const anchorTarget = new core.THREE.Vector3(0, 0.85, 0);
                if (this.phase1StartCam.distanceTo(anchorCamPos) > 0.4) {
                    core.camera.position.lerpVectors(this.phase1StartCam, anchorCamPos, ease * 0.4);
                    core.controls.target.lerpVectors(this.phase1StartTarget, anchorTarget, ease * 0.4);
                    core.controls.update();
                }

                // Beacon pulse intensity
                if (core.selectionState) {
                    const pulse = 180 + Math.floor(75 * Math.sin(this.elapsed * 25));
                    core.selectionState[this.targetIndex * 4] = pulse;
                    if (core.selectionTexture) core.selectionTexture.needsUpdate = true;
                }
                core.markDirty();
                return true;
            }

            // =================================================================
            // ACT 2: Anatomical Layer Peeling / System Transection (tP1 to tP2)
            // =================================================================
            if (this.elapsed <= tP2) {
                if (this.phase !== 2) {
                    this.phase = 2;
                    let stageBadge = 'TRANSITION';
                    let layerDesc = 'Revealing internal anatomy...';
                    if (this.targetSystem === 'skeletal') {
                        stageBadge = '🦴 SKELETON LAYER';
                        layerDesc = `Peeling muscles & skin to reveal <strong>complete skeleton</strong>...`;
                    } else if (this.targetSystem === 'cardiac') {
                        stageBadge = '💓 CARDIOVASCULAR';
                        layerDesc = `Peeling thoracic wall to reveal <strong>cardiovascular tree</strong>...`;
                    } else if (this.targetSystem === 'muscular') {
                        stageBadge = '💪 MUSCULAR LAYER';
                        layerDesc = `Peeling skin to expose <strong>muscular architecture</strong>...`;
                    } else if (this.targetSystem === 'nervous') {
                        stageBadge = '🧠 NERVOUS SYSTEM';
                        layerDesc = `Transecting outer layers to expose <strong>neural pathways</strong>...`;
                    } else {
                        stageBadge = '🥣 VISCERAL LAYER';
                        layerDesc = `Transecting body wall to expose <strong>${this.targetSystem} system</strong>...`;
                    }
                    this.showHUD(stageBadge, layerDesc);
                    playTone(659.25, 0.1, 'triangle', 0.15);
                }

                const peelProgress = (this.elapsed - tP1) / (tP2 - tP1);

                // Hierarchical layer peel logic
                if (core.partState) {
                    for (let i = 0; i < core.atlas.parts.length; i++) {
                        if (i === this.targetIndex) {
                            core.partState[i * 4 + 3] = 1.0;
                            continue;
                        }
                        const pSys = core.atlas.parts[i].system;

                        if (this.targetSystem === 'skeletal') {
                            // Immediately peel muscles and integument in Phase 2
                            if (pSys === 'muscular' || pSys === 'integumentary') {
                                core.partState[i * 4 + 3] = 0.0;
                            } else if (pSys !== 'skeletal') {
                                // Peel visceral/vascular/nervous in second half of Phase 2
                                core.partState[i * 4 + 3] = peelProgress > 0.45 ? 0.0 : 1.0;
                            } else {
                                core.partState[i * 4 + 3] = 1.0; // Complete skeleton remains visible!
                            }
                        } else if (this.targetSystem === 'cardiac') {
                            if (pSys === 'muscular' || pSys === 'integumentary') {
                                core.partState[i * 4 + 3] = 0.0;
                            } else if (pSys === 'skeletal') {
                                core.partState[i * 4 + 3] = peelProgress > 0.45 ? 0.0 : 1.0;
                            } else {
                                core.partState[i * 4 + 3] = 1.0;
                            }
                        } else {
                            if (pSys === 'integumentary' || pSys === 'muscular') {
                                core.partState[i * 4 + 3] = 0.0;
                            } else if (pSys !== this.targetSystem) {
                                core.partState[i * 4 + 3] = peelProgress > 0.45 ? 0.0 : 1.0;
                            } else {
                                core.partState[i * 4 + 3] = 1.0;
                            }
                        }
                    }
                    if (core.partStateTexture) core.partStateTexture.needsUpdate = true;
                }

                this.flightStartCam = core.camera.position.clone();
                this.flightStartTarget = core.controls.target.clone();

                core.markDirty();
                return true;
            }

            // =================================================================
            // ACT 3: Camera Flight & Spatial Wavefront / Line-by-Line Transection (tP2 to tP3)
            // =================================================================
            if (this.elapsed <= tP3) {
                if (this.phase !== 3) {
                    this.phase = 3;
                    this.showHUD('🎯 TRANSECTION & ZOOM', `Zooming inward • Transecting surrounding structures to <span class="omni-hud-target-name">${this.targetPart.name}</span>...`);
                }

                const flightP = (this.elapsed - tP2) / (tP3 - tP2);
                // Cubic ease-in-out
                const ease = flightP < 0.5 ? 4 * flightP * flightP * flightP : 1 - Math.pow(-2 * flightP + 2, 3) / 2;

                // 1. Interpolate camera position and target
                core.camera.position.lerpVectors(this.flightStartCam, this.targetCamPos, ease);
                core.controls.target.lerpVectors(this.flightStartTarget, this.targetCenter, ease);
                core.controls.update();

                // 2. Spatial Wavefront / Line-by-Line Transection:
                // Parts further from target center peel away progressively as camera approaches!
                const cutoffRadius = this.maxRemainingDist * Math.pow(1.0 - ease, 1.7);

                if (core.partState && this.partDistances) {
                    for (let i = 0; i < core.atlas.parts.length; i++) {
                        if (i === this.targetIndex) {
                            core.partState[i * 4 + 3] = 1.0;
                            continue;
                        }
                        const d = this.partDistances[i];
                        if (d > cutoffRadius) {
                            core.partState[i * 4 + 3] = 0.0;
                        }
                    }
                    if (core.partStateTexture) core.partStateTexture.needsUpdate = true;
                }

                core.markDirty();
                return true;
            }

            // =================================================================
            // ACT 4: Target Arrival & Pristine Solo Lock (Finished)
            // =================================================================
            this.instantFinish();
            return true;
        },

        instantFinish() {
            if (!core) return;
            this.active = false;
            this.phase = 4;

            // 1. Lock camera to final close-up
            if (this.targetCamPos && this.targetCenter) {
                core.camera.position.copy(this.targetCamPos);
                core.controls.target.copy(this.targetCenter);
                core.controls.update();
            }

            // 2. Hide all other parts completely; only target part is visible
            if (core.partState) {
                for (let i = 0; i < core.atlas.parts.length; i++) {
                    core.partState[i * 4 + 3] = (i === this.targetIndex) ? 1.0 : 0.0;
                }
                if (core.partStateTexture) core.partStateTexture.needsUpdate = true;
            }

            // Target selection highlight
            if (core.selectionState) {
                for (let i = 0; i < core.atlas.parts.length; i++) {
                    core.selectionState[i * 4] = (i === this.targetIndex) ? 255 : 0;
                }
                if (core.selectionTexture) core.selectionTexture.needsUpdate = true;
            }

            // Sync state for isolated mode
            window.__ATLAS_DISSECTING__ = false;
            if (core.getState) {
                const st = core.getState();
                if (st) {
                    st.selected = [this.targetId];
                    st.isolate = true;
                }
            }

            // 3. Update clinical dock and isolation button
            showOrganHUD(this.targetId);
            updateIsolationButtonState();

            // 4. Update HUD Toast
            if (this.targetPart) {
                this.showHUD('🔒 ISOLATED', `<strong>${this.targetPart.name}</strong> (${this.targetPart.conceptId || 'FMA'}) in solo inspection.`);
                this.hideHUD(3000);
            }

            // 5. Audio chime
            playTone(1318.5, 0.15, 'sine', 0.25);
            core.markDirty();
        },

        seek(targetElapsed) {
            if (!this.active) return;
            this.startTime = performance.now() - (targetElapsed * 1000);
            this.elapsed = targetElapsed;
            this.update(0);
        },

        reconstitute() {
            if (!core) return;
            this.active = false;
            this.phase = 0;
            window.__ATLAS_DISSECTING__ = false;

            if (core.getState) {
                const st = core.getState();
                if (st) {
                    st.selected = [];
                    st.isolate = false;
                }
            }

            // Restore all 2,234 parts
            if (core.partState) {
                for (let i = 0; i < core.atlas.parts.length; i++) {
                    core.partState[i * 4 + 3] = 1.0;
                }
                if (core.partStateTexture) core.partStateTexture.needsUpdate = true;
            }

            // Clear beacon
            if (core.selectionState) {
                for (let i = 0; i < core.atlas.parts.length; i++) {
                    core.selectionState[i * 4] = 0;
                }
                if (core.selectionTexture) core.selectionTexture.needsUpdate = true;
            }

            smoothResetCamera();
            this.showHUD('🌐 WHOLE BODY', 'Full human twin reconstituted with all 2,234 structures.');
            this.hideHUD(2200);
            playTone(523.25, 0.12, 'sine', 0.2);
            core.markDirty();
        }
    };
    window.CinematicDissector = CinematicDissector;

    function selectAndIsolatePart(partId) {
        if (!core) return;
        CinematicDissector.start(partId);
    }

    function togglePartIsolation() {
        if (!selectedPartData || !core) return;
        const state = core.getState ? core.getState() : null;
        if (!state) return;

        const willIsolate = !state.isolate;
        state.isolate = willIsolate;

        if (willIsolate) {
            selectAndIsolatePart(selectedPartData.id);
        } else {
            CinematicDissector.reconstitute();
            updateIsolationButtonState();
        }
    }

    function updateIsolationButtonState() {
        const btn = document.getElementById('btn-isolate-part');
        const txt = document.getElementById('txt-isolate');
        if (!btn || !txt) return;

        const isIsolated = document.querySelector('.detail-sheet.is-isolated') !== null ||
                           (core && core.getState && core.getState()?.isolate);

        if (isIsolated) {
            btn.classList.add('active');
            txt.textContent = 'Show Full Body';
            btn.title = 'Restore all surrounding anatomy and organs';
        } else {
            btn.classList.remove('active');
            txt.textContent = 'Isolate Part';
            btn.title = 'Isolate this structure in 3D (hide other parts)';
        }
    }

    function clearSelectionAndReset() {
        CinematicDissector.reconstitute();
        selectedPartData = null;
        if (core && core.selectPart) {
            core.selectPart(null);
        }
        if (core && core.getState) {
            const state = core.getState();
            if (state) {
                state.selected = [];
                state.isolate = false;
            }
        }
        const elName = document.getElementById('inspect-name');
        const elSub = document.getElementById('inspect-sub');
        const elDesc = document.getElementById('inspect-desc');
        const elSystem = document.getElementById('inspect-system');
        const elConcept = document.getElementById('inspect-concept');
        if (elName) elName.textContent = 'Adult Human Organism';
        if (elSub) elSub.textContent = 'BODYPARTS3D • 2,234 AUTHENTIC PIECES';
        if (elDesc) elDesc.textContent = 'Click any 3D organ, muscle, bone, or blood vessel to inspect attachments, surface area, and clinical descriptions.';
        if (elSystem) elSystem.textContent = 'WHOLE BODY';
        if (elConcept) elConcept.textContent = 'ALL';
        updateIsolationButtonState();
        playTone(659.25, 0.1, 'sine', 0.15);
    }


    function exportSelectedSTL() {
        if (!selectedPartData || !core) return;
        const { atlas, pickers } = core;
        const idx = atlas.parts.findIndex(p => p.id === selectedPartData.id);
        if (idx < 0) return;

        const part = atlas.parts[idx];
        const picker = pickers[idx];
        if (!picker || !picker.geometry) return;

        const geom = picker.geometry;
        const posAttr = geom.attributes.position;
        const indexAttr = geom.index;
        const numTriangles = indexAttr ? (indexAttr.count / 3) : (posAttr.count / 3);

        const bufferLength = 84 + numTriangles * 50;
        const buffer = new ArrayBuffer(bufferLength);
        const view = new DataView(buffer);

        const headerStr = `Binary STL from OmniHuman-3D - ${part.name.substring(0, 40)}`;
        for (let i = 0; i < 80; i++) {
            view.setUint8(i, i < headerStr.length ? headerStr.charCodeAt(i) : 32);
        }
        view.setUint32(80, numTriangles, true);

        const scale = 1000.0;
        let offset = 84;
        for (let i = 0; i < numTriangles; i++) {
            let i0 = indexAttr ? indexAttr.getX(i * 3 + 0) : i * 3 + 0;
            let i1 = indexAttr ? indexAttr.getX(i * 3 + 1) : i * 3 + 1;
            let i2 = indexAttr ? indexAttr.getX(i * 3 + 2) : i * 3 + 2;

            const v0x = posAttr.getX(i0) * scale, v0y = posAttr.getY(i0) * scale, v0z = posAttr.getZ(i0) * scale;
            const v1x = posAttr.getX(i1) * scale, v1y = posAttr.getY(i1) * scale, v1z = posAttr.getZ(i1) * scale;
            const v2x = posAttr.getX(i2) * scale, v2y = posAttr.getY(i2) * scale, v2z = posAttr.getZ(i2) * scale;

            const ax = v1x - v0x, ay = v1y - v0y, az = v1z - v0z;
            const bx = v2x - v0x, by = v2y - v0y, bz = v2z - v0z;
            let nx = ay * bz - az * by;
            let ny = az * bx - ax * bz;
            let nz = ax * by - ay * bx;
            const len = Math.hypot(nx, ny, nz);
            if (len > 0) { nx /= len; ny /= len; nz /= len; }

            view.setFloat32(offset + 0, nx, true);
            view.setFloat32(offset + 4, ny, true);
            view.setFloat32(offset + 8, nz, true);
            view.setFloat32(offset + 12, v0x, true);
            view.setFloat32(offset + 16, v0y, true);
            view.setFloat32(offset + 20, v0z, true);
            view.setFloat32(offset + 24, v1x, true);
            view.setFloat32(offset + 28, v1y, true);
            view.setFloat32(offset + 32, v1z, true);
            view.setFloat32(offset + 36, v2x, true);
            view.setFloat32(offset + 40, v2y, true);
            view.setFloat32(offset + 44, v2z, true);
            view.setUint16(offset + 48, 0, true);
            offset += 50;
        }

        const blob = new Blob([buffer], { type: 'application/octet-stream' });
        const cleanName = part.name.replace(/[^a-zA-Z0-9_-]/g, '_');
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `OmniHuman_${cleanName}_3DPrint.stl`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        playTone(1568.0, 0.25, 'sine', 0.25);
    }

    // =========================================================================
    // 5. MICROSCOPIC VIRTUAL CELL DIGITAL TWIN (Multi-Lineage AIDO Lab)
    // =========================================================================
    let cellScene = null, cellCamera = null, cellRenderer = null, cellControls = null;
    let cellOrganelles = { DNA: null, ER: null, RNA: null, AGP: null, MITO: null };
    let cellRadarChart = null, cellBarChart = null;
    let cellAnimId = null;
    let currentCellLineage = 'HEPATIC';

    const CELL_LINEAGES = {
        HEPATIC: {
            name: 'Hepatic Parenchymal Cell (HepG2)',
            system: 'Digestive / Metabolic',
            desc: 'Metabolically dense hepatocyte with rich rough/smooth ER network for plasma protein synthesis, bile salt conjugations, and cytochrome P450 xenobiotic detox.',
            mitoCount: 14,
            dnaColor: 0x3b82f6,
            radarWT: [80, 85, 20, 90, 75, 88],
            radarLabels: ['Nuclear Size', 'Mito Potential', 'ER Stress', 'Golgi Integrity', 'RNA Velocity', 'ATP Flux'],
            barLabels: ['ALB', 'CYP3A4', 'APOB', 'HNF4A', 'PCK1', 'G6PC'],
            barWT: [95, 78, 65, 82, 54, 70]
        },
        CARDIO: {
            name: 'Ventricular Cardiomyocyte',
            system: 'Cardiovascular / Contractile',
            desc: 'Striated, highly energetic cardiac muscle cell packed with dense elongated mitochondria (~40% of cell volume) supporting continuous rhythmic excitation-contraction coupling.',
            mitoCount: 26,
            dnaColor: 0xef4444,
            radarWT: [70, 98, 25, 85, 90, 99],
            radarLabels: ['Sarcomere Align', 'Mito Potential', 'Ca2+ Transient', 'Golgi Integrity', 'T-Tubule Density', 'ATP Flux'],
            barLabels: ['TNNT2', 'MYH7', 'RYR2', 'ATP2A2', 'ACTC1', 'NPPA'],
            barWT: [98, 92, 85, 88, 94, 60]
        },
        NEURON: {
            name: 'Cortical Pyramidal Neuron',
            system: 'Central Nervous System',
            desc: 'Excitable neuro-ectodermal cell with prominent soma, extensive dendritic spines, and axon hillock optimized for fast saltatory action potential propagation.',
            mitoCount: 16,
            dnaColor: 0xa855f7,
            radarWT: [65, 88, 30, 92, 95, 85],
            radarLabels: ['Soma Diameter', 'Synaptic Density', 'Axon Caliber', 'Golgi Integrity', 'Vesicle Pool', 'Action Potential'],
            barLabels: ['SNAP25', 'SYN1', 'NEFL', 'MAP2', 'GRIN1', 'SLC17A7'],
            barWT: [94, 90, 88, 96, 75, 84]
        },
        ALVEOLAR: {
            name: 'Type II Alveolar Pneumocyte',
            system: 'Respiratory / Alveolar',
            desc: 'Cuboidal pulmonary epithelial cell containing characteristic lamellar bodies for surfactant synthesis, lowering alveolar surface tension and preventing atelectasis.',
            mitoCount: 12,
            dnaColor: 0x38bdf8,
            radarWT: [75, 80, 22, 88, 70, 78],
            radarLabels: ['Lamellar Density', 'Mito Potential', 'ER Turnover', 'Golgi Export', 'Lipid Flux', 'Surfactant Output'],
            barLabels: ['SFTPC', 'SFTPB', 'SFTPA1', 'ABCA3', 'LAMP3', 'NKX2-1'],
            barWT: [98, 95, 85, 90, 80, 75]
        },
        OSTEO: {
            name: 'Cortical Osteocyte',
            system: 'Skeletal / Mineralized',
            desc: 'Star-shaped mechanosensory bone cell entombed within mineralized lacunar-canalicular network, coordinating bone remodeling via sclerostin signaling.',
            mitoCount: 10,
            dnaColor: 0xe2e8f0,
            radarWT: [60, 75, 18, 70, 65, 72],
            radarLabels: ['Canaliculi Ext.', 'Mito Potential', 'Mechanosensing', 'Golgi Matrix', 'Collagen I', 'Mineral Load'],
            barLabels: ['SOST', 'DMP1', 'MEPE', 'PHEX', 'COL1A1', 'BGLAP'],
            barWT: [96, 92, 85, 88, 94, 78]
        }
    };

    const ORGANELLE_DEEP_DIVE = {
        DNA: {
            title: '🧬 Nucleus & Chromatin',
            desc: 'Master genomic library. Houses 3.2 Gbp diploid DNA packaged around histone octamers. Controls mRNA transcription, ribosomal RNA assembly in the nucleolus, and genome maintenance.',
            atp: '12.4 nmol/min',
            vol: '18.5% Total'
        },
        MITO: {
            title: '⚡ Mitochondria & Cristae',
            desc: 'Cellular powerhouse. Houses the respiratory electron transport chain (Complexes I-IV) and ATP Synthase. Generates > 90% of cellular ATP via oxidative phosphorylation.',
            atp: '86.2 nmol/min (Yield)',
            vol: '24.0% Total'
        },
        ER: {
            title: '🕸️ Endoplasmic Reticulum',
            desc: 'Interconnected membrane network. Rough ER synthesizes transmembrane and secretable proteins via bound ribosomes; smooth ER regulates lipid biosynthesis and calcium sequestration.',
            atp: '18.6 nmol/min',
            vol: '14.2% Total'
        },
        AGP: {
            title: '🥞 Golgi Apparatus',
            desc: 'Post-translational sorting station. Mediates N-linked oligosaccharide maturation, core protein glycosylation, and targeted vesicle trafficking to plasma membrane or lysosomes.',
            atp: '8.3 nmol/min',
            vol: '7.8% Total'
        },
        RNA: {
            title: '🟡 Ribosomes & RNA Puncta',
            desc: 'Active 80S ribonucleoprotein translating machinery. Reads 5\' to 3\' messenger RNA codons, synthesizing polypeptide chains at 6-9 amino acids per second.',
            atp: '22.1 nmol/min',
            vol: '5.2% Total'
        }
    };

    function inspectOrganelle(key) {
        const info = ORGANELLE_DEEP_DIVE[key];
        if (!info) return;

        const titleEl = document.getElementById('c-org-title');
        const descEl = document.getElementById('c-org-desc');
        const atpEl = document.getElementById('c-org-atp');
        const volEl = document.getElementById('c-org-vol');

        if (titleEl) titleEl.textContent = info.title;
        if (descEl) descEl.textContent = info.desc;
        if (atpEl) atpEl.textContent = info.atp;
        if (volEl) volEl.textContent = info.vol;

        playTone(1318.5, 0.08, 'sine', 0.15);
    }

    function switchCellLineage(lineageKey) {
        const lin = CELL_LINEAGES[lineageKey];
        if (!lin) return;

        currentCellLineage = lineageKey;

        // Update header & narrative
        const cellTypeEl = document.querySelector('.c-cell-type');
        if (cellTypeEl) cellTypeEl.textContent = lin.name;

        const narrative = document.getElementById('cell-status-narrative');
        if (narrative) narrative.textContent = lin.desc;

        // Update button states
        document.querySelectorAll('.c-lineage-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.lineage === lineageKey);
        });

        // Rebuild / scale mitochondria & nucleus
        if (cellOrganelles.MITO && window.THREE) {
            const THREE = window.THREE;
            while (cellOrganelles.MITO.children.length > 0) {
                cellOrganelles.MITO.remove(cellOrganelles.MITO.children[0]);
            }
            const mitoMat = new THREE.MeshStandardMaterial({ color: 0xef4444, roughness: 0.3, emissive: 0x450a0a });
            for (let m = 0; m < lin.mitoCount; m++) {
                const mGeo = new THREE.SphereGeometry(0.85, 12, 12);
                mGeo.scale(1.0, 2.3, 1.0);
                const mito = new THREE.Mesh(mGeo, mitoMat);
                const angle = (m / lin.mitoCount) * Math.PI * 2 + Math.random() * 0.4;
                const dist = 10 + Math.random() * 5.0;
                mito.position.set(Math.cos(angle) * dist, Math.sin(angle) * dist, (Math.random() - 0.5) * 12);
                cellOrganelles.MITO.add(mito);
            }
        }

        if (cellOrganelles.DNA && cellOrganelles.DNA.children[0]) {
            cellOrganelles.DNA.children[0].material.color.setHex(lin.dnaColor);
        }

        // Update charts
        if (cellRadarChart) {
            cellRadarChart.data.labels = lin.radarLabels;
            cellRadarChart.data.datasets[0].data = lin.radarWT;
            cellRadarChart.data.datasets[1].data = lin.radarWT.map(v => Math.max(15, v - 20));
            cellRadarChart.update();
        }

        if (cellBarChart) {
            cellBarChart.data.labels = lin.barLabels;
            cellBarChart.data.datasets[0].data = lin.barWT;
            cellBarChart.data.datasets[1].data = lin.barWT.map((v, i) => i === 0 ? Math.round(v * 0.1) : Math.round(v * 1.3));
            cellBarChart.update();
        }

        playTone(987.77, 0.1, 'sine', 0.2);
    }

    function initMicroCell() {
        const modal = document.getElementById('cell-modal');
        const container = document.getElementById('cell-three-viewport');
        const btnOpen = document.getElementById('btn-micro-cell');
        const btnClose = document.getElementById('btn-close-cell');
        const btnRun = document.getElementById('btn-run-sim');

        if (btnOpen) {
            btnOpen.addEventListener('click', () => {
                if (modal) modal.classList.add('open');
                if (!cellRenderer) setupCell3D(container);
                if (!cellRadarChart) setupCellCharts();
                startCellLoop();
            });
        }

        if (btnClose) {
            btnClose.addEventListener('click', () => {
                if (modal) modal.classList.remove('open');
                if (cellAnimId) cancelAnimationFrame(cellAnimId);
            });
        }

        if (btnRun) {
            btnRun.addEventListener('click', () => {
                const sel = document.getElementById('cell-perturb-select');
                if (sel) runCellPerturbation(sel.value);
            });
        }

        // Channel filters & organelle inspection
        const chanBtns = document.querySelectorAll('.c-chan-btn');
        chanBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                btn.classList.toggle('active');
                const chan = btn.dataset.chan;
                const active = btn.classList.contains('active');
                if (cellOrganelles[chan]) cellOrganelles[chan].visible = active;
                inspectOrganelle(chan);
            });
        });

        // Cell Lineage Switcher
        document.querySelectorAll('.c-lineage-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                switchCellLineage(btn.dataset.lineage);
            });
        });
    }

    function setupCell3D(container) {
        if (!container || !window.THREE) return;
        const THREE = window.THREE;

        cellScene = new THREE.Scene();
        cellScene.background = new THREE.Color(0x03060c);

        const w = container.clientWidth || 500;
        const h = container.clientHeight || 500;

        cellCamera = new THREE.PerspectiveCamera(45, w / h, 0.1, 1000);
        cellCamera.position.set(0, 0, 48);

        cellRenderer = new THREE.WebGLRenderer({ antialias: true });
        cellRenderer.setSize(w, h);
        cellRenderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        container.appendChild(cellRenderer.domElement);

        if (THREE.OrbitControls) {
            cellControls = new THREE.OrbitControls(cellCamera, cellRenderer.domElement);
            cellControls.enableDamping = true;
            cellControls.dampingFactor = 0.05;
        }

        // Lighting
        const amb = new THREE.AmbientLight(0xffffff, 0.7);
        cellScene.add(amb);
        const p1 = new THREE.PointLight(0x00f0ff, 1.2, 100);
        p1.position.set(20, 20, 20);
        cellScene.add(p1);

        // Membrane
        const memGeo = new THREE.SphereGeometry(18, 32, 32);
        const memMat = new THREE.MeshPhysicalMaterial({
            color: 0x38bdf8,
            transparent: true,
            opacity: 0.12,
            transmission: 0.85,
            side: THREE.DoubleSide,
            depthWrite: false
        });
        cellScene.add(new THREE.Mesh(memGeo, memMat));

        // Nucleus
        cellOrganelles.DNA = new THREE.Group();
        const nucGeo = new THREE.SphereGeometry(7.5, 24, 24);
        const nucMat = new THREE.MeshStandardMaterial({ color: 0x3b82f6, emissive: 0x1d4ed8, roughness: 0.4 });
        cellOrganelles.DNA.add(new THREE.Mesh(nucGeo, nucMat));
        cellScene.add(cellOrganelles.DNA);

        // ER
        cellOrganelles.ER = new THREE.Group();
        const erMat = new THREE.MeshStandardMaterial({ color: 0x10b981, roughness: 0.3, transparent: true, opacity: 0.8 });
        for (let i = 0; i < 4; i++) {
            const erGeo = new THREE.TorusGeometry(9.5 + i * 1.4, 0.6, 8, 24, Math.PI * 1.2);
            erGeo.rotateX(0.4 * i);
            erGeo.rotateY(0.3 * i);
            cellOrganelles.ER.add(new THREE.Mesh(erGeo, erMat));
        }
        cellScene.add(cellOrganelles.ER);

        // Mitochondria
        cellOrganelles.MITO = new THREE.Group();
        const mitoMat = new THREE.MeshStandardMaterial({ color: 0xef4444, roughness: 0.3, emissive: 0x450a0a });
        for (let m = 0; m < 14; m++) {
            const mGeo = new THREE.SphereGeometry(0.85, 12, 12);
            mGeo.scale(1.0, 2.2, 1.0);
            const mito = new THREE.Mesh(mGeo, mitoMat);
            const angle = Math.random() * Math.PI * 2;
            const dist = 11 + Math.random() * 4.5;
            mito.position.set(Math.cos(angle) * dist, Math.sin(angle) * dist, (Math.random() - 0.5) * 12);
            cellOrganelles.MITO.add(mito);
        }
        cellScene.add(cellOrganelles.MITO);

        // Golgi
        cellOrganelles.AGP = new THREE.Group();
        const agpMat = new THREE.MeshStandardMaterial({ color: 0xf97316, roughness: 0.35 });
        for (let g = 0; g < 3; g++) {
            const gGeo = new THREE.TorusGeometry(3.5, 0.5, 8, 16, Math.PI * 0.7);
            const gm = new THREE.Mesh(gGeo, agpMat);
            gm.position.set(-10, 5 + g * 1.1, 2);
            cellOrganelles.AGP.add(gm);
        }
        cellScene.add(cellOrganelles.AGP);

        // RNA puncta
        cellOrganelles.RNA = new THREE.Group();
        const rnaGeo = new THREE.BufferGeometry();
        const rCount = 180;
        const posArr = new Float32Array(rCount * 3);
        for (let p = 0; p < rCount * 3; p += 3) {
            const r = 4 + Math.random() * 11;
            const th = Math.random() * Math.PI * 2;
            const ph = Math.acos(2 * Math.random() - 1);
            posArr[p] = r * Math.sin(ph) * Math.cos(th);
            posArr[p + 1] = r * Math.sin(ph) * Math.sin(th);
            posArr[p + 2] = r * Math.cos(ph);
        }
        rnaGeo.setAttribute('position', new THREE.BufferAttribute(posArr, 3));
        const rnaMat = new THREE.PointsMaterial({ color: 0xfacc15, size: 0.75 });
        cellOrganelles.RNA.add(new THREE.Points(rnaGeo, rnaMat));
        cellScene.add(cellOrganelles.RNA);
    }

    function startCellLoop() {
        const loop = () => {
            cellAnimId = requestAnimationFrame(loop);
            if (cellControls) cellControls.update();
            if (cellOrganelles.RNA) cellOrganelles.RNA.rotation.y += 0.003;
            if (cellOrganelles.MITO) cellOrganelles.MITO.rotation.z += 0.001;
            if (cellRenderer && cellScene && cellCamera) {
                cellRenderer.render(cellScene, cellCamera);
            }
        };
        loop();
    }

    function setupCellCharts() {
        const radarCanvas = document.getElementById('cell-radar-canvas');
        const barCanvas = document.getElementById('cell-bar-canvas');
        if (!window.Chart) return;

        if (radarCanvas) {
            cellRadarChart = new Chart(radarCanvas, {
                type: 'radar',
                data: {
                    labels: ['Nuclear Size', 'Mito Potential', 'ER Stress', 'Golgi Integrity', 'RNA Velocity', 'ATP Flux'],
                    datasets: [
                        { label: 'Wild-Type', data: [80, 85, 20, 90, 75, 88], borderColor: 'rgba(0, 240, 255, 0.4)', backgroundColor: 'rgba(0, 240, 255, 0.1)' },
                        { label: 'Perturbed', data: [85, 35, 78, 62, 40, 36], borderColor: '#ef4444', backgroundColor: 'rgba(239, 68, 68, 0.25)' }
                    ]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    scales: { r: { ticks: { display: false, max: 100, min: 0 }, grid: { color: 'rgba(255,255,255,0.06)' }, pointLabels: { color: '#94a3b8', font: { size: 9 } } } },
                    plugins: { legend: { labels: { color: '#cbd5e1', font: { size: 10 } } } }
                }
            });
        }

        if (barCanvas) {
            cellBarChart = new Chart(barCanvas, {
                type: 'bar',
                data: {
                    labels: ['TP53', 'MDM2', 'CDKN1A', 'BAX', 'PUMA', 'VEGFA'],
                    datasets: [
                        { label: 'Wild-Type (TPM)', data: [45, 38, 52, 28, 18, 65], backgroundColor: 'rgba(0, 240, 255, 0.5)' },
                        { label: 'Perturbed (TPM)', data: [2, 6, 3, 7, 4, 98], backgroundColor: '#ef4444' }
                    ]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    scales: {
                        x: { ticks: { color: '#94a3b8', font: { size: 9 } }, grid: { display: false } },
                        y: { ticks: { color: '#94a3b8', font: { size: 9 } }, grid: { color: 'rgba(255,255,255,0.06)' } }
                    },
                    plugins: { legend: { labels: { color: '#cbd5e1', font: { size: 10 } } } }
                }
            });
        }
    }

    function runCellPerturbation(mode) {
        const textEl = document.getElementById('cell-status-narrative');
        let rData = [], bData = [], msg = '';

        if (mode === 'CRISPR_TP53') {
            rData = [85, 35, 78, 62, 40, 36];
            bData = [2, 6, 3, 7, 4, 98];
            msg = 'CRISPR-Cas9 TP53 Knockout executed. Loss of G1 arrest checkpoint; marked repression of p21 (CDKN1A) and pro-apoptotic BAX. Hyper-angiogenic VEGFA surge.';
            if (cellOrganelles.DNA) cellOrganelles.DNA.scale.set(1.25, 1.25, 1.25);
        } else if (mode === 'CRISPR_MYC') {
            rData = [95, 90, 65, 80, 98, 92];
            bData = [48, 62, 22, 34, 25, 120];
            msg = 'c-Myc Proto-Oncogene Transduction. Global transcriptional amplification; nucleolar enlargement and heightened ribosome biogenesis.';
            if (cellOrganelles.DNA) cellOrganelles.DNA.scale.set(1.4, 1.4, 1.4);
        } else if (mode === 'DRUG_SORAFENIB') {
            rData = [65, 25, 85, 45, 30, 22];
            bData = [55, 42, 70, 68, 55, 12];
            msg = 'Sorafenib Kinase Inhibitor applied (10 \u03BCM). Severe collapse of mitochondrial membrane potential \u0394\u03A8m; suppression of VEGFA and activation of intrinsic apoptosis cascade.';
            if (cellOrganelles.DNA) cellOrganelles.DNA.scale.set(0.9, 0.9, 0.9);
        } else if (mode === 'DRUG_DOXORUBICIN') {
            rData = [90, 15, 95, 35, 18, 12];
            bData = [92, 18, 98, 95, 88, 30];
            msg = 'Doxorubicin Topoisomerase II intercalator applied. Lethal double-strand DNA cleavage with massive p53 hyperphosphorylation and mitochondrial permeabilization.';
            if (cellOrganelles.DNA) cellOrganelles.DNA.scale.set(1.1, 1.1, 1.1);
        }

        if (textEl) textEl.textContent = msg;
        if (cellRadarChart) { cellRadarChart.data.datasets[1].data = rData; cellRadarChart.update(); }
        if (cellBarChart) { cellBarChart.data.datasets[1].data = bData; cellBarChart.update(); }
        playTone(1200, 0.2, 'sine', 0.2);
    }


    // =========================================================================
    // 5.5. 3D MULTIPLANAR MRI / CT SCANNER SUITE
    // =========================================================================
    const MRIScannerSuite = {
        isOpen: false,
        sliceNorm: 0.65, // 0 = feet (0.08m), 1 = cranium (1.70m)
        currentSeq: 'T1', // 'T1', 'T2', 'ANGIO', 'BONE'
        autoScan: false,
        autoDir: 1,
        images: {},
        laserGroup: null,
        laserPlane: null,
        laserEdges: null,
        canvases: {},
        ctxs: {},
        crosshairs: {
            axial: { x: 0.5, y: 0.5 },
            coronal: { x: 0.5, y: 0.5 },
            sagittal: { x: 0.5, y: 0.5 }
        },

        init() {
            this.loadAssets();
            this.init3DLaserPlane();
            this.bindEvents();
            console.log('📡 [OmniHuman-3D] 3D Multiplanar MRI & CT Scanner Suite Online.');
        },

        loadAssets() {
            const assetList = [
                { key: 'axial_card', src: './assets/mri_slices/axial_card_001.png' },
                { key: 'axial_kidney', src: './assets/mri_slices/axial_kidney_highlight.png' },
                { key: 'axial_clean', src: './assets/mri_slices/axial_scan_clean.png' },
                { key: 'coronal_card', src: './assets/mri_slices/coronal_card_001.png' },
                { key: 'coronal_kidney', src: './assets/mri_slices/coronal_kidney_highlight.png' },
                { key: 'coronal_clean', src: './assets/mri_slices/coronal_scan_clean.png' },
                { key: 'sagittal_card', src: './assets/mri_slices/sagittal_card_001.png' },
                { key: 'sagittal_kidney', src: './assets/mri_slices/sagittal_kidney_highlight.png' },
                { key: 'sagittal_clean', src: './assets/mri_slices/sagittal_scan_clean.png' },
                { key: 'oblique_stomach', src: './assets/mri_slices/oblique_stomach_clean.png' },
                { key: 'oblique_spleen', src: './assets/mri_slices/oblique_spleen_clean.png' },
                { key: 'oblique_kidney', src: './assets/mri_slices/oblique_kidney_clean.png' }
            ];

            assetList.forEach(item => {
                const img = new Image();
                img.onload = () => {
                    this.images[item.key] = img;
                    if (this.isOpen) this.renderAll();
                };
                img.src = item.src;
            });
        },

        init3DLaserPlane() {
            if (!core) return;
            const scene = core.scene;
            const THREE = window.THREE || core.THREE;
            if (!THREE || !THREE.Group || !scene) return;

            this.laserGroup = new THREE.Group();
            this.laserGroup.name = 'mri_laser_scanner';

            // Semi-transparent cutting plane
            const planeGeo = new THREE.PlaneGeometry(0.85, 0.55);
            const planeMat = new THREE.MeshBasicMaterial({
                color: 0x00f0ff,
                transparent: true,
                opacity: 0.16,
                side: THREE.DoubleSide,
                depthWrite: false
            });
            this.laserPlane = new THREE.Mesh(planeGeo, planeMat);
            this.laserPlane.rotation.x = -Math.PI / 2;
            this.laserGroup.add(this.laserPlane);

            // Glowing cyan laser boundary
            const edgeGeo = new THREE.EdgesGeometry(planeGeo);
            const edgeMat = new THREE.LineBasicMaterial({
                color: 0x00f0ff,
                linewidth: 2,
                transparent: true,
                opacity: 0.9
            });
            this.laserEdges = new THREE.LineSegments(edgeGeo, edgeMat);
            this.laserEdges.rotation.x = -Math.PI / 2;
            this.laserGroup.add(this.laserEdges);

            // Cross laser line reticle
            const crossPts = [
                new THREE.Vector3(-0.42, 0, 0), new THREE.Vector3(0.42, 0, 0),
                new THREE.Vector3(0, 0, -0.27), new THREE.Vector3(0, 0, 0.27)
            ];
            const crossGeo = new THREE.BufferGeometry().setFromPoints(crossPts);
            const crossMat = new THREE.LineBasicMaterial({
                color: 0x38bdf8,
                transparent: true,
                opacity: 0.5
            });
            const crossMesh = new THREE.LineSegments(crossGeo, crossMat);
            this.laserGroup.add(crossMesh);

            this.laserGroup.position.set(0, 1.25, 0);
            this.laserGroup.visible = false;
            scene.add(this.laserGroup);
        },

        bindEvents() {
            // Canvases
            ['axial', 'coronal', 'sagittal'].forEach(plane => {
                const cv = document.getElementById(`mri-${plane}-canvas`);
                if (cv) {
                    this.canvases[plane] = cv;
                    this.ctxs[plane] = cv.getContext('2d');

                    // Interactive crosshair & HU tracking
                    cv.addEventListener('mousemove', (e) => {
                        const r = cv.getBoundingClientRect();
                        const nx = Math.max(0, Math.min(1, (e.clientX - r.left) / r.width));
                        const ny = Math.max(0, Math.min(1, (e.clientY - r.top) / r.height));
                        this.crosshairs[plane] = { x: nx, y: ny };
                        this.updateHUReadout(plane, nx, ny);
                        this.renderViewport(plane);
                    });
                }
            });

            // Elevation slider
            const slider = document.getElementById('mri-z-slider');
            if (slider) {
                slider.addEventListener('input', (e) => {
                    this.autoScan = false;
                    this.updateAutoScanBtn();
                    this.setElevation(parseFloat(e.target.value) / 100);
                });
            }

            // Landmarks
            document.querySelectorAll('.mri-preset-btn[data-z]').forEach(btn => {
                btn.addEventListener('click', () => {
                    this.autoScan = false;
                    this.updateAutoScanBtn();
                    const zVal = parseFloat(btn.dataset.z) / 100;
                    this.setElevation(zVal);
                    document.querySelectorAll('.mri-preset-btn[data-z]').forEach(b => b.classList.remove('active'));
                    btn.classList.add('active');
                    playTone(987.77, 0.08, 'sine', 0.15);
                });
            });

            // Sequences
            document.querySelectorAll('.mri-preset-btn[data-seq]').forEach(btn => {
                btn.addEventListener('click', () => {
                    this.setSequence(btn.dataset.seq);
                    document.querySelectorAll('.mri-preset-btn[data-seq]').forEach(b => b.classList.remove('active'));
                    btn.classList.add('active');
                    playTone(1174.66, 0.08, 'sine', 0.15);
                });
            });

            // In-Scanner Structure Quick Search
            const searchInput = document.getElementById('mri-part-search');
            if (searchInput) {
                searchInput.addEventListener('input', (e) => {
                    const q = e.target.value.trim().toLowerCase();
                    if (q.length < 2 || !core || !core.atlas) return;

                    const matchIdx = core.atlas.parts.findIndex(p => p.name.toLowerCase().includes(q));
                    if (matchIdx >= 0) {
                        const center = core.centers[matchIdx];
                        if (center) {
                            const targetNorm = Math.max(0, Math.min(1, (center.y - 0.08) / 1.62));
                            this.setElevation(targetNorm);
                            if (core.selectPart) core.selectPart(core.atlas.parts[matchIdx].id);
                        }
                    }
                });
            }

            // Auto scan
            const btnAuto = document.getElementById('btn-mri-autoscan');
            if (btnAuto) {
                btnAuto.addEventListener('click', () => {
                    this.autoScan = !this.autoScan;
                    this.updateAutoScanBtn();
                    playTone(1046.5, 0.1, 'sine', 0.2);
                });
            }

            // Close
            const btnClose = document.getElementById('btn-close-mri');
            if (btnClose) {
                btnClose.addEventListener('click', () => this.close());
            }

            // Open from Top Dock
            const btnOpen = document.getElementById('btn-mri-scan');
            if (btnOpen) {
                btnOpen.addEventListener('click', () => this.open());
            }
        },

        updateAutoScanBtn() {
            const btnAuto = document.getElementById('btn-mri-autoscan');
            if (btnAuto) {
                btnAuto.textContent = this.autoScan ? '⏸ Pause Scan' : '▶ Auto Scan (Cine Sweep)';
                btnAuto.classList.toggle('active', this.autoScan);
            }
        },

        getIntersectingParts(elevationNorm) {
            if (!core || !core.atlas || !core.bounds) return [];
            const yMin = 0.08;
            const yMax = 1.70;
            const sliceY = yMin + elevationNorm * (yMax - yMin);
            const tolerance = 0.022; // 22mm slice tolerance

            const results = [];
            core.atlas.parts.forEach((p, idx) => {
                const b = core.bounds[idx];
                if (b && (b.min.y - tolerance) <= sliceY && (b.max.y + tolerance) >= sliceY) {
                    results.push({
                        id: p.id,
                        name: p.name,
                        system: p.system || 'organ',
                        conceptId: p.conceptId || p.id,
                        center: core.centers[idx],
                        bounds: b,
                        idx: idx
                    });
                }
            });
            return results;
        },

        updateTransectedParts() {
            const container = document.getElementById('mri-transected-chips');
            const countEl = document.getElementById('mri-transected-count');
            if (!container) return;

            const parts = this.getIntersectingParts(this.sliceNorm);
            if (countEl) countEl.textContent = `(${parts.length} Structures)`;

            container.innerHTML = '';
            const displayParts = parts.slice(0, 36);
            displayParts.forEach(p => {
                const chip = document.createElement('button');
                chip.className = 'mri-part-chip';
                chip.title = `${p.name} • ${p.system.toUpperCase()} (${p.conceptId})`;
                chip.innerHTML = `<span>●</span> ${p.name.length > 20 ? p.name.substring(0, 18) + '…' : p.name}`;

                chip.addEventListener('click', () => {
                    if (core && core.selectPart) core.selectPart(p.id);
                    document.querySelectorAll('.mri-part-chip').forEach(c => c.classList.remove('active'));
                    chip.classList.add('active');
                    playTone(1174.66, 0.08, 'sine', 0.2);
                });
                container.appendChild(chip);
            });
            if (parts.length > 36) {
                const moreChip = document.createElement('span');
                moreChip.style.fontSize = '9px';
                moreChip.style.color = '#64748b';
                moreChip.style.alignSelf = 'center';
                moreChip.textContent = `+${parts.length - 36} more`;
                container.appendChild(moreChip);
            }
        },

        open() {
            this.isOpen = true;
            const modal = document.getElementById('mri-scan-modal');
            if (modal) modal.classList.add('open');
            if (this.laserGroup) this.laserGroup.visible = true;
            if (core) core.markDirty();
            this.setElevation(this.sliceNorm);
            this.updateTransectedParts();
            playTone(880, 0.15, 'sine', 0.2);
        },

        close() {
            this.isOpen = false;
            this.autoScan = false;
            this.updateAutoScanBtn();
            const modal = document.getElementById('mri-scan-modal');
            if (modal) modal.classList.remove('open');
            if (this.laserGroup) this.laserGroup.visible = false;
            if (core) core.markDirty();
        },

        setElevation(norm) {
            this.sliceNorm = Math.max(0, Math.min(1, norm));
            const y = 0.08 + this.sliceNorm * (1.70 - 0.08); // Y from 0.08m (feet) to 1.70m (head)

            if (this.laserGroup) {
                this.laserGroup.position.y = y;
                if (core) core.markDirty();
            }

            // Calculate anatomical mm relative to mid-abdomen (Z = 0)
            const zMm = Math.round((this.sliceNorm - 0.5) * 800);
            const elevText = document.getElementById('mri-elev-text');
            if (elevText) elevText.textContent = `${zMm >= 0 ? '+' : ''}${zMm} mm`;

            const slider = document.getElementById('mri-z-slider');
            if (slider && !this.autoScan) {
                slider.value = Math.round(this.sliceNorm * 100);
            }

            this.updateMetrics(zMm);
            this.updateTransectedParts();
            this.renderAll();
        },

        setSequence(seq) {
            this.currentSeq = seq;
            const label = document.getElementById('mri-active-seq-label');
            if (label) {
                const names = {
                    T1: 'T1 Fast Spin Echo (Spin-Lattice)',
                    T2: 'T2 High-Resolution (Spin-Spin)',
                    ANGIO: 'Magnetic Resonance Angiography (MRA Flow)',
                    BONE: 'Bone Window CT (1600 HU Scale)',
                    XRAY: 'Digital Plain Radiography (X-Ray Attenuation)'
                };
                label.textContent = names[seq] || seq;
            }
            this.renderAll();
        },

        updateMetrics(zMm) {
            const statusBox = document.getElementById('mri-status-box');
            const coordAx = document.getElementById('mri-coord-axial');
            const coordCor = document.getElementById('mri-coord-coronal');
            const coordSag = document.getElementById('mri-coord-sagittal');
            const findings = document.getElementById('mri-findings-text');

            if (coordAx) coordAx.textContent = `Z: ${zMm >= 0 ? '+' : ''}${zMm}mm`;
            if (coordCor) coordCor.textContent = `Y: 0mm (Mid-Coronal)`;
            if (coordSag) coordSag.textContent = `X: 0mm (Mid-Sagittal)`;

            let levelStr = '', regionStr = '', huStr = '', findingsStr = '';

            if (this.sliceNorm > 0.85) {
                levelStr = 'Cranial Vault (C1 - Cranium)';
                regionStr = 'Cerebral Cortex & Basal Ganglia';
                huStr = '+32 HU (Brain Parenchyma)';
                findingsStr = 'Normal cerebral mantle thickness. Ventricles are symmetric and non-dilated. Grey-white matter differentiation is preserved with no midline shift.';
            } else if (this.sliceNorm > 0.58) {
                levelStr = 'Thoracic Cavity (T4 - T9)';
                regionStr = 'Heart Chambers & Pulmonary Vasculature';
                huStr = '+42 HU (Myocardium & Blood)';
                if (currentPathology === 'stemi') {
                    findingsStr = 'ALERT: Acute myocardial hypoperfusion noted in anterior apical wall corresponding to LAD occlusion. Pericardial space clear.';
                } else if (currentPathology === 'pneumothorax') {
                    findingsStr = 'ALERT: Massive hyperlucent air accumulation in right hemithorax with total right lung parenchymal atelectasis and contralateral tracheal shift.';
                } else {
                    findingsStr = 'Cardiothoracic ratio normal (< 0.5). Pulmonary arterial tree intact without embolus. Clear pleural spaces bilaterally.';
                }
            } else if (this.sliceNorm > 0.40) {
                levelStr = 'Upper Abdomen (T11 - L2)';
                regionStr = 'Hepatic Lobes, Kidneys & Spleen';
                huStr = '+55 HU (Hepatic Parenchyma)';
                if (currentPathology === 'cirrhosis') {
                    findingsStr = 'ALERT: Coarse micronodular hepatic contour with blunted margins. Portal vein dilated (> 13mm) indicative of severe portal hypertension. Free peritoneal ascites.';
                } else {
                    findingsStr = 'Hepatic attenuation homogeneous. Renal cortical thickness bilaterally symmetric (approx 10.5cm bipolar length). Spleen normal in volume.';
                }
            } else if (this.sliceNorm > 0.25) {
                levelStr = 'Lumbar Spine & Pelvis (L3 - S1)';
                regionStr = 'Vertebral Bodies, Thecal Sac & Iliac Bifurcation';
                huStr = '+450 HU (Spine Cortical / Cancellous)';
                if (currentPathology === 'herniation') {
                    findingsStr = 'ALERT: L4-L5 posterior paracentral intervertebral disc extrusion (6.2mm) with marked effacement of traversing L5 nerve root sheath.';
                } else {
                    findingsStr = 'Lumbar lordosis preserved. Disc heights intact without posterior herniation or canal stenosis. Sacroiliac joints unremarkable.';
                }
            } else {
                levelStr = 'Lower Extremity (Femur / Tibia)';
                regionStr = 'Musculoskeletal & Deep Femoral Vessels';
                huStr = '+1100 HU (Cortical Femoral Shaft)';
                findingsStr = 'Intact cortical bone margins. No cortical fracture, periosteal reaction, or deep venous thrombosis.';
            }

            if (statusBox) {
                statusBox.innerHTML = `
                    Level: <strong>${levelStr}</strong><br>
                    Active Region: <strong>${regionStr}</strong><br>
                    Mean Density: <strong>${huStr}</strong><br>
                    Laser Position: <strong>Y = ${(0.08 + this.sliceNorm * 1.62).toFixed(2)}m (Synchronized)</strong>
                `;
            }

            if (findings) findings.textContent = findingsStr;
        },

        updateHUReadout(plane, nx, ny) {
            const huEl = document.getElementById(`mri-hu-${plane}`);
            if (!huEl) return;

            let hu = 0;
            const d = Math.hypot(nx - 0.5, ny - 0.5);

            if (this.currentSeq === 'BONE') {
                hu = d < 0.15 ? 1250 : (d < 0.35 ? 420 : (d < 0.45 ? 45 : -1000));
            } else if (this.sliceNorm > 0.58 && this.sliceNorm <= 0.85) {
                if (d < 0.2) hu = 45;
                else if (d < 0.42) hu = -680;
                else if (d < 0.46) hu = 750;
                else hu = -1000;
            } else {
                hu = d < 0.38 ? Math.round(35 + (1 - d) * 25) : (d < 0.44 ? 900 : -1000);
            }

            huEl.textContent = `HU: ${hu >= 0 ? '+' : ''}${hu}`;
        },

        renderAll() {
            ['axial', 'coronal', 'sagittal'].forEach(plane => this.renderViewport(plane));
        },

        renderViewport(plane) {
            const cv = this.canvases[plane];
            const ctx = this.ctxs[plane];
            if (!cv || !ctx) return;

            const w = cv.parentElement.clientWidth || 320;
            const h = cv.parentElement.clientHeight || 240;
            const dpr = Math.min(window.devicePixelRatio || 1, 2);
            if (cv.width !== w * dpr || cv.height !== h * dpr) {
                cv.width = w * dpr;
                cv.height = h * dpr;
            }

            ctx.save();
            ctx.scale(dpr, dpr);

            // Background
            ctx.fillStyle = '#02050c';
            ctx.fillRect(0, 0, w, h);

            // Pick source image
            let imgKey = '';
            if (plane === 'axial') {
                imgKey = (this.sliceNorm > 0.55) ? 'axial_card' : 'axial_kidney';
            } else if (plane === 'coronal') {
                imgKey = (this.sliceNorm > 0.55) ? 'coronal_card' : 'coronal_kidney';
            } else {
                imgKey = (this.sliceNorm > 0.55) ? 'sagittal_card' : 'sagittal_kidney';
            }

            const img = this.images[imgKey] || this.images[`${plane}_clean`];

            if (img && img.complete && img.naturalWidth > 0) {
                const s = Math.min((w - 20) / img.width, (h - 20) / img.height);
                const dw = img.width * s;
                const dh = img.height * s;
                const dx = (w - dw) / 2;
                const dy = (h - dh) / 2;

                if (this.currentSeq === 'T2') {
                    ctx.filter = 'contrast(160%) brightness(125%)';
                } else if (this.currentSeq === 'ANGIO') {
                    ctx.filter = 'contrast(240%) brightness(130%) hue-rotate(170deg) saturate(220%)';
                } else if (this.currentSeq === 'BONE') {
                    ctx.filter = 'contrast(300%) grayscale(100%) brightness(140%)';
                } else if (this.currentSeq === 'XRAY') {
                    ctx.filter = 'contrast(260%) invert(100%) grayscale(100%) brightness(120%)';
                } else {
                    ctx.filter = 'contrast(120%) brightness(110%)';
                }

                ctx.drawImage(img, dx, dy, dw, dh);
                ctx.filter = 'none';
            } else {
                this.drawProceduralSlice(ctx, plane, w, h);
            }

            // Coronal / Sagittal Horizontal Laser Slice Position Line
            if (plane === 'coronal' || plane === 'sagittal') {
                const laserY = h * (1.0 - this.sliceNorm);
                ctx.strokeStyle = '#00f0ff';
                ctx.lineWidth = 1.5;
                ctx.setLineDash([4, 4]);
                ctx.beginPath();
                ctx.moveTo(10, laserY);
                ctx.lineTo(w - 10, laserY);
                ctx.stroke();
                ctx.setLineDash([]);

                ctx.fillStyle = 'rgba(0, 240, 255, 0.85)';
                ctx.font = 'bold 9px monospace';
                ctx.fillText(`LASER ELEVATION: ${(this.sliceNorm * 100).toFixed(0)}%`, 14, Math.max(14, laserY - 4));
            }

            // Crosshairs
            const ch = this.crosshairs[plane] || { x: 0.5, y: 0.5 };
            const cx = ch.x * w;
            const cy = ch.y * h;

            ctx.strokeStyle = 'rgba(0, 240, 255, 0.4)';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(cx, 0); ctx.lineTo(cx, h);
            ctx.moveTo(0, cy); ctx.lineTo(w, cy);
            ctx.stroke();

            // Center target reticle
            ctx.strokeStyle = '#00f0ff';
            ctx.beginPath();
            ctx.arc(cx, cy, 6, 0, Math.PI * 2);
            ctx.stroke();

            // Orientation Markers
            ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
            ctx.font = 'bold 10px monospace';
            if (plane === 'axial') {
                ctx.fillText('R', 8, h / 2);
                ctx.fillText('L', w - 16, h / 2);
                ctx.fillText('A', w / 2 - 3, 16);
                ctx.fillText('P', w / 2 - 3, h - 8);
            } else if (plane === 'coronal') {
                ctx.fillText('R', 8, h / 2);
                ctx.fillText('L', w - 16, h / 2);
                ctx.fillText('S', w / 2 - 3, 16);
                ctx.fillText('I', w / 2 - 3, h - 8);
            } else if (plane === 'sagittal') {
                ctx.fillText('A', 8, h / 2);
                ctx.fillText('P', w - 16, h / 2);
                ctx.fillText('S', w / 2 - 3, 16);
                ctx.fillText('I', w / 2 - 3, h - 8);
            }

            ctx.restore();
        },

        drawProceduralSlice(ctx, plane, w, h) {
            const cx = w / 2;
            const cy = h / 2;
            const r = Math.min(w, h) * 0.38;

            ctx.strokeStyle = '#38bdf8';
            ctx.fillStyle = '#0a101f';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.ellipse(cx, cy, r * 1.1, r * 0.85, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();

            ctx.fillStyle = '#cbd5e1';
            ctx.beginPath();
            ctx.ellipse(cx, cy + r * 0.45, r * 0.22, r * 0.18, 0, 0, Math.PI * 2);
            ctx.fill();

            if (this.sliceNorm > 0.55) {
                ctx.fillStyle = '#0f172a';
                ctx.beginPath();
                ctx.ellipse(cx - r * 0.55, cy - r * 0.1, r * 0.35, r * 0.45, 0, 0, Math.PI * 2);
                ctx.fill();

                ctx.beginPath();
                ctx.ellipse(cx + r * 0.55, cy - r * 0.1, r * 0.35, r * 0.45, 0, 0, Math.PI * 2);
                ctx.fill();

                ctx.fillStyle = '#475569';
                ctx.beginPath();
                ctx.ellipse(cx - r * 0.08, cy - r * 0.15, r * 0.32, r * 0.28, -0.2, 0, Math.PI * 2);
                ctx.fill();
            } else {
                ctx.fillStyle = '#334155';
                ctx.beginPath();
                ctx.ellipse(cx - r * 0.4, cy - r * 0.1, r * 0.45, r * 0.38, 0.2, 0, Math.PI * 2);
                ctx.fill();

                ctx.fillStyle = '#475569';
                ctx.beginPath();
                ctx.ellipse(cx - r * 0.45, cy + r * 0.32, r * 0.18, r * 0.14, 0, 0, Math.PI * 2);
                ctx.ellipse(cx + r * 0.45, cy + r * 0.32, r * 0.18, r * 0.14, 0, 0, Math.PI * 2);
                ctx.fill();
            }
        },

        update(delta) {
            if (this.autoScan) {
                this.sliceNorm += this.autoDir * delta * 0.14;
                if (this.sliceNorm >= 0.98) {
                    this.sliceNorm = 0.98;
                    this.autoDir = -1;
                } else if (this.sliceNorm <= 0.04) {
                    this.sliceNorm = 0.04;
                    this.autoDir = 1;
                }
                this.setElevation(this.sliceNorm);
            }

            if (this.laserPlane && this.isOpen) {
                const pulse = 0.14 + 0.05 * Math.sin(Date.now() * 0.006);
                this.laserPlane.material.opacity = pulse;
            }
        }
    };

    // =========================================================================
    // 6. UI CREATION & EVENT WIRING
    // =========================================================================
    function createOmniUI() {
        // Top Floating Dock
        const topDock = document.createElement('div');
        topDock.id = 'omni-top-dock';
        topDock.innerHTML = `
            <div class="omni-brand-badge">
                <span class="omni-pulse-ring"></span>
                <span>OMNI-HUMAN 3D</span>
            </div>
            <select class="omni-pathology-select" id="omni-pathology">
                <option value="healthy">Healthy Baseline</option>
                <option value="stemi">Acute Anterior STEMI</option>
                <option value="herniation">L4-L5 Disc Herniation</option>
                <option value="pneumothorax">Tension Pneumothorax</option>
                <option value="cirrhosis">Hepatic Cirrhosis</option>
            </select>
            <div class="omni-divider"></div>
            <button class="omni-dock-btn" id="btn-tour" title="Cinematic Drone Camera">
                <span>🎬</span> Tour
            </button>
            <button class="omni-dock-btn active" id="btn-bio" title="Biological Pulse & Blood Stream">
                <span>⚡</span> Bio-Energy
            </button>
            <button class="omni-dock-btn" id="btn-knoll" title="Explode 2,234 Parts">
                <span>💥</span> Explode
            </button>
            <button class="omni-dock-btn highlight" id="btn-omni-search" title="Find Any of 2,234 Parts (Auto-Isolate & Zoom)">
                <span>🔍</span> Find Part (2,234)
            </button>
            <button class="omni-dock-btn highlight" id="btn-mri-scan" title="3D Multiplanar MRI & CT Scanner">
                <span>📡</span> 3D Scan
            </button>
            <button class="omni-dock-btn highlight" id="btn-micro-cell" title="Zoom to Virtual Cell World Model">
                <span>🔬</span> Micro Cell
            </button>
            <div class="omni-divider"></div>
            <button class="omni-dock-btn" id="btn-audio-mute" title="Toggle Stethoscope Auscultation">
                <span id="audio-icon">🔊</span>
            </button>
        `;
        document.body.appendChild(topDock);

        // Right Clinical Dock
        const clinicalDock = document.createElement('div');
        clinicalDock.id = 'omni-clinical-dock';
        clinicalDock.innerHTML = `
            <div class="dock-header">
                <div style="display:flex; align-items:center; gap:8px;">
                    <span class="dock-title">GEMINI MEDICAL MIND</span>
                    <span class="dock-conf-badge" id="dock-conf">99.4% OPTIMAL</span>
                </div>
                <button class="dock-min-btn" id="btn-collapse-clinical-dock" title="Minimize Clinical Monitor" aria-label="Minimize Clinical Monitor">—</button>
            </div>

            <!-- Vitals Grid -->
            <div class="vitals-compact-grid">
                <div class="vital-compact-card">
                    <span class="v-comp-label">HEART RATE</span>
                    <span class="v-comp-val" id="vital-hr">75 <small>BPM</small></span>
                </div>
                <div class="vital-compact-card">
                    <span class="v-comp-label">BLOOD PRESS.</span>
                    <span class="v-comp-val" id="vital-bp">120/80</span>
                </div>
                <div class="vital-compact-card">
                    <span class="v-comp-label">O2 SAT.</span>
                    <span class="v-comp-val" id="vital-spo2">99%</span>
                </div>
                <div class="vital-compact-card">
                    <span class="v-comp-label">L4-L5 LOAD</span>
                    <span class="v-comp-val" id="vital-load">420 <small>N</small></span>
                </div>
            </div>

            <!-- Real-Time Lead II ECG Oscilloscope -->
            <div class="ecg-card">
                <div class="ecg-card-head">
                    <span>Lead II ECG</span>
                    <span class="ecg-card-status" id="ecg-live-status">NORMAL SINUS RHYTHM</span>
                </div>
                <canvas id="ecg-live-canvas" width="300" height="65"></canvas>
            </div>

            <!-- Gemini Clinical Decision -->
            <div class="ai-diagnosis-card">
                <div class="ai-card-title" id="diag-title">Pathology: Normal Physiological Equilibrium</div>
                <div class="ai-card-body" id="diag-body">
                    All physiological parameters are within ideal clinical limits. Cardiac contractility, pulmonary compliance, and musculoskeletal balance demonstrate optimal homeostasis.
                </div>
                <div class="ai-treatment-card">
                    <div class="ai-treatment-head">Clinical Management Protocol</div>
                    <div id="diag-treatment">Maintain regular aerobic exercise, balanced macro-nutritional intake, core stability conditioning, and ergonomic spine neutrality.</div>
                </div>
            </div>

            <!-- Selected Organ Inspector -->
            <div class="organ-inspect-card">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:4px;">
                    <span class="organ-inspect-badge" id="inspect-badge">
                        <span class="organ-system-dot" id="inspect-dot"></span>
                        <span id="inspect-system">WHOLE BODY</span>
                    </span>
                    <span style="font-size:9px; font-family:monospace; color:#64748b;" id="inspect-concept">ALL</span>
                </div>
                <div class="organ-inspect-name" id="inspect-name">Adult Human Organism</div>
                <div class="organ-inspect-sub" id="inspect-sub">BODYPARTS3D • 2,234 AUTHENTIC PIECES</div>
                <div class="organ-inspect-desc" id="inspect-desc">
                    Click any 3D organ, muscle, bone, or blood vessel to inspect attachments, surface area, and clinical descriptions.
                </div>
                <div class="organ-inspect-actions-grid">
                    <button class="organ-inspect-btn" id="btn-isolate-part" title="Isolate this structure in 3D">
                        <span>🎯</span> <span id="txt-isolate">Isolate Part</span>
                    </button>
                    <button class="organ-inspect-btn" id="btn-focus-part" title="Center camera smoothly on this organ">
                        <span>🔍</span> Focus & Zoom
                    </button>
                    <button class="organ-inspect-btn highlight" id="btn-mri-part" title="Open 3D Scanner at this organ's height">
                        <span>📡</span> 3D Scan Slice
                    </button>
                    <button class="organ-inspect-btn" id="btn-export-stl" title="Export 3D printable binary STL">
                        <span>📥</span> 3D Print STL
                    </button>
                    <button class="organ-inspect-btn full-width" id="btn-clear-part" title="Reset selection to full body">
                        <span>❌</span> Clear Selection & Reset Body
                    </button>
                </div>
            </div>
        `;
        document.body.appendChild(clinicalDock);

        // Floating Restore Clinical Dock Button
        const restoreBtn = document.createElement('button');
        restoreBtn.id = 'btn-restore-clinical-dock';
        restoreBtn.title = 'Restore Gemini Clinical Monitor';
        restoreBtn.innerHTML = '<span>🩺</span> Gemini Mind';
        document.body.appendChild(restoreBtn);

        const collapseBtn = document.getElementById('btn-collapse-clinical-dock');
        if (collapseBtn) {
            collapseBtn.addEventListener('click', () => {
                clinicalDock.classList.add('collapsed');
                restoreBtn.classList.add('visible');
                playTone(880, 0.08, 'sine', 0.15);
            });
        }
        restoreBtn.addEventListener('click', () => {
            clinicalDock.classList.remove('collapsed');
            restoreBtn.classList.remove('visible');
            playTone(1046.5, 0.08, 'sine', 0.15);
        });

        // 3D Multiplanar MRI / CT Scanner Modal
        const mriModal = document.createElement('div');
        mriModal.id = 'mri-scan-modal';
        mriModal.className = 'mri-scan-modal';
        mriModal.innerHTML = `
            <div class="mri-modal-shell">
                <header class="mri-modal-head">
                    <div class="mri-head-title">
                        <span class="mri-badge">3D SCANNER</span>
                        <span class="mri-title-text">BodyParts3D Multiplanar MRI & CT Tomography Suite</span>
                        <span class="mri-sub-tag">Synchronized 3D Laser Slicing • Real-Time MPR</span>
                    </div>
                    <button class="mri-close-btn" id="btn-close-mri">&times; Close Scanner</button>
                </header>

                <div class="mri-modal-content">
                    <!-- Left: Controls & Slice Height -->
                    <div class="mri-left-controls">
                        <!-- In-Scanner Structure Quick Search -->
                        <div class="mri-part-search-box">
                            <input type="text" id="mri-part-search" placeholder="🔍 Search any of 2,234 parts (e.g. Heart, Spleen, Femur)..." autocomplete="off">
                        </div>

                        <div class="mri-ctrl-group">
                            <div class="mri-ctrl-label">
                                <span>Slice Elevation (Z)</span>
                                <span id="mri-elev-text">+120 mm</span>
                            </div>
                            <div class="mri-slider-box">
                                <input type="range" class="mri-slider" id="mri-z-slider" min="0" max="100" value="65" step="1">
                            </div>
                        </div>

                        <div class="mri-ctrl-group">
                            <div class="mri-ctrl-label">Anatomical Landmarks</div>
                            <div class="mri-preset-grid">
                                <button class="mri-preset-btn" data-z="92">Brain / Head</button>
                                <button class="mri-preset-btn active" data-z="65">Thorax / Heart</button>
                                <button class="mri-preset-btn" data-z="48">Abdomen / Liver</button>
                                <button class="mri-preset-btn" data-z="35">Kidneys / Spine</button>
                                <button class="mri-preset-btn" data-z="22">Pelvis / Bladder</button>
                                <button class="mri-preset-btn" data-z="8">Lower Extremity</button>
                            </div>
                        </div>

                        <!-- Live Cross-Section Parts List -->
                        <div class="mri-ctrl-group">
                            <div class="mri-transected-container">
                                <div class="mri-transected-head">
                                    <span>Transected Structures at Slice</span>
                                    <span id="mri-transected-count" style="font-size:9px; color:#94a3b8;">(0 Structures)</span>
                                </div>
                                <div class="mri-transected-chips" id="mri-transected-chips"></div>
                            </div>
                        </div>

                        <div class="mri-ctrl-group">
                            <div class="mri-ctrl-label">Radiologic Sequence</div>
                            <div class="mri-preset-grid">
                                <button class="mri-preset-btn seq-btn active" data-seq="T1">T1 Anatomy</button>
                                <button class="mri-preset-btn seq-btn" data-seq="T2">T2 Fluid/Edema</button>
                                <button class="mri-preset-btn seq-btn" data-seq="ANGIO">MR Angiography</button>
                                <button class="mri-preset-btn seq-btn" data-seq="BONE">Bone CT Window</button>
                                <button class="mri-preset-btn seq-btn" data-seq="XRAY">🩻 X-Ray Mode</button>
                            </div>
                        </div>

                        <div class="mri-ctrl-group">
                            <button class="mri-auto-btn" id="btn-mri-autoscan">▶ Auto Scan (Cine Sweep)</button>
                        </div>

                        <div class="mri-ctrl-group" style="margin-top:auto;">
                            <div class="mri-ctrl-label">Live Slicing Metrics</div>
                            <div class="c-status-narrative" id="mri-status-box" style="font-size:10px; line-height:1.5;">
                                Level: <strong>Thoracic Cavity (T5-T8)</strong><br>
                                Active Region: <strong>Heart & Pericardium</strong><br>
                                Mean Density: <strong>+42 HU (Soft Tissue)</strong><br>
                                Laser Sync: <strong>Connected (3D Core)</strong>
                            </div>
                        </div>
                    </div>

                    <!-- Right: Multiplanar Viewports Grid -->
                    <div class="mri-viewports-grid">
                        <!-- Axial Viewport -->
                        <div class="mri-viewport-card">
                            <div class="mri-vp-header">
                                <span class="mri-vp-tag">AXIAL (TRANSVERSE)</span>
                                <span class="mri-vp-coord" id="mri-coord-axial">Z: +120mm</span>
                                <span class="mri-vp-coord" id="mri-hu-axial">HU: +42</span>
                            </div>
                            <canvas id="mri-axial-canvas" class="mri-canvas"></canvas>
                        </div>

                        <!-- Coronal Viewport -->
                        <div class="mri-viewport-card">
                            <div class="mri-vp-header">
                                <span class="mri-vp-tag">CORONAL (FRONTAL)</span>
                                <span class="mri-vp-coord" id="mri-coord-coronal">Y: 0mm</span>
                                <span class="mri-vp-coord" id="mri-hu-coronal">HU: +38</span>
                            </div>
                            <canvas id="mri-coronal-canvas" class="mri-canvas"></canvas>
                        </div>

                        <!-- Sagittal Viewport -->
                        <div class="mri-viewport-card">
                            <div class="mri-vp-header">
                                <span class="mri-vp-tag">SAGITTAL (LATERAL)</span>
                                <span class="mri-vp-coord" id="mri-coord-sagittal">X: 0mm</span>
                                <span class="mri-vp-coord" id="mri-hu-sagittal">HU: +45</span>
                            </div>
                            <canvas id="mri-sagittal-canvas" class="mri-canvas"></canvas>
                        </div>

                        <!-- Live Diagnostic Summary & HU Analysis -->
                        <div class="mri-viewport-card" style="padding:14px; background: rgba(8,14,28,0.85); overflow-y:auto;">
                            <div class="c-section-title" style="margin-bottom:8px;">Radiologic Evaluation & Findings</div>
                            <div id="mri-findings-text" style="font-size:11px; color:#cbd5e1; line-height:1.6; margin-bottom:12px;">
                                Multiplanar examination confirms anatomical symmetry. Cardiac silhouettes and pulmonary vasculature are unremarkable. No acute consolidation or pleural effusion.
                            </div>
                            <div class="c-section-title" style="margin-bottom:8px;">Tissue Density Calibration</div>
                            <div style="display:grid; grid-template-columns: repeat(2, 1fr); gap:6px; font-size:10px;">
                                <div style="background:rgba(255,255,255,0.04); padding:6px; border-radius:4px;"><span style="color:#94a3b8;">Air:</span> <strong style="color:#38bdf8;">-1000 HU</strong></div>
                                <div style="background:rgba(255,255,255,0.04); padding:6px; border-radius:4px;"><span style="color:#94a3b8;">Lung:</span> <strong style="color:#38bdf8;">-650 HU</strong></div>
                                <div style="background:rgba(255,255,255,0.04); padding:6px; border-radius:4px;"><span style="color:#94a3b8;">Water/CSF:</span> <strong style="color:#38bdf8;">0 HU</strong></div>
                                <div style="background:rgba(255,255,255,0.04); padding:6px; border-radius:4px;"><span style="color:#94a3b8;">Muscle:</span> <strong style="color:#38bdf8;">+40 HU</strong></div>
                                <div style="background:rgba(255,255,255,0.04); padding:6px; border-radius:4px;"><span style="color:#94a3b8;">Contrast/Blood:</span> <strong style="color:#38bdf8;">+120 HU</strong></div>
                                <div style="background:rgba(255,255,255,0.04); padding:6px; border-radius:4px;"><span style="color:#94a3b8;">Cortical Bone:</span> <strong style="color:#38bdf8;">+1200 HU</strong></div>
                            </div>
                        </div>

                        <!-- Bottom Bar -->
                        <div class="mri-diag-summary">
                            <div class="mri-diag-item">
                                <span class="mri-diag-k">Field Strength</span>
                                <span class="mri-diag-v">3.0 Tesla Superconducting</span>
                            </div>
                            <div class="mri-diag-item">
                                <span class="mri-diag-k">Reconstruction Matrix</span>
                                <span class="mri-diag-v">512 &times; 512 &times; 1.25mm</span>
                            </div>
                            <div class="mri-diag-item">
                                <span class="mri-diag-k">Active Sequence</span>
                                <span class="mri-diag-v" id="mri-active-seq-label">T1 Fast Spin Echo</span>
                            </div>
                            <div class="mri-diag-item">
                                <span class="mri-diag-k">3D Laser Slicer</span>
                                <span class="mri-diag-v" style="color:#00f0ff;">Synchronized</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
        document.body.appendChild(mriModal);

        // Microscopic Virtual Cell Modal Shell
        const cellModal = document.createElement('div');
        cellModal.id = 'cell-modal';
        cellModal.className = 'cell-twin-modal';
        cellModal.innerHTML = `
            <div class="cell-modal-shell">
                <header class="cell-modal-head">
                    <div class="c-head-brand">
                        <span class="c-badge">MICRO SCALE</span>
                        <span class="c-title">Organelle Digital Twin &bull; In Silico Molecular Simulator</span>
                        <span class="c-cell-type">Hepatic Parenchymal Cell (HepG2)</span>
                    </div>
                    <button class="c-close-btn" id="btn-close-cell">&times; Close Cell View</button>
                </header>

                <div class="cell-modal-content">
                    <!-- Left: In Silico Perturbations & Lineages -->
                    <div class="cell-left-pane">
                        <div class="c-section-title">Cell Lineage</div>
                        <div class="c-lineage-grid">
                            <button class="c-lineage-btn active" data-lineage="HEPATIC">🍽️ Liver</button>
                            <button class="c-lineage-btn" data-lineage="CARDIO">🫀 Heart</button>
                            <button class="c-lineage-btn" data-lineage="NEURON">🧠 Brain</button>
                            <button class="c-lineage-btn" data-lineage="ALVEOLAR">🫁 Lung</button>
                            <button class="c-lineage-btn" data-lineage="OSTEO">🦴 Bone</button>
                        </div>

                        <div class="c-section-title">In Silico Perturbation</div>
                        <div class="c-select-box">
                            <select id="cell-perturb-select">
                                <option value="CRISPR_TP53">CRISPR-Cas9 TP53 Knockout</option>
                                <option value="CRISPR_MYC">c-Myc Proto-Oncogene Overexpression</option>
                                <option value="DRUG_SORAFENIB">Sorafenib Kinase Inhibitor Stress</option>
                                <option value="DRUG_DOXORUBICIN">Doxorubicin Chemotherapeutic Stress</option>
                            </select>
                        </div>
                        <button class="c-sim-btn" id="btn-run-sim">Run Simulation</button>
                        <div class="c-status-narrative" id="cell-status-narrative">
                            Observing basal transcriptomic and metabolic steady-state.
                        </div>

                        <!-- Organelle Multiplexing Channels -->
                        <div class="c-section-title" style="margin-top: 8px;">Organelle Channels</div>
                        <div class="c-channel-grid">
                            <button class="c-chan-btn active" data-chan="DNA" style="--cc:#3b82f6;">DNA (Nucleus)</button>
                            <button class="c-chan-btn active" data-chan="ER" style="--cc:#10b981;">ER (Reticulum)</button>
                            <button class="c-chan-btn active" data-chan="RNA" style="--cc:#eab308;">RNA (Puncta)</button>
                            <button class="c-chan-btn active" data-chan="AGP" style="--cc:#f97316;">AGP (Golgi)</button>
                            <button class="c-chan-btn active" data-chan="MITO" style="--cc:#ef4444;">MITO (Mitochondria)</button>
                        </div>

                        <!-- Interactive Organelle Deep-Dive HUD -->
                        <div class="c-organelle-card" id="cell-organelle-card">
                            <div class="c-organelle-title" id="c-org-title">🧬 Nucleus & Chromatin</div>
                            <div class="c-organelle-desc" id="c-org-desc">
                                Double-membrane organelle housing the linear 3.2 Gbp diploid genome. Regulates RNA transcription, splicing, and cell-cycle progression.
                            </div>
                            <div class="c-organelle-metrics">
                                <div class="c-org-metric-item">
                                    <span class="c-org-m-label">ATP Flux</span>
                                    <span class="c-org-m-val" id="c-org-atp">12.4 nmol/min</span>
                                </div>
                                <div class="c-org-metric-item">
                                    <span class="c-org-m-label">Cell Volume</span>
                                    <span class="c-org-m-val" id="c-org-vol">18.5% Total</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- Center: 3D Virtual Cell Viewport -->
                    <div class="cell-center-viewport">
                        <div id="cell-three-viewport"></div>
                        <div class="cell-viewport-hint">Drag to rotate 3D cell &bull; Scroll to zoom into organelles</div>
                    </div>

                    <!-- Right: Multiomics Phenotyping & Expression -->
                    <div class="cell-right-pane">
                        <div class="c-section-title">Morphological Phenotyping</div>
                        <div style="height: 180px;"><canvas id="cell-radar-canvas"></canvas></div>
                        <div class="c-section-title" style="margin-top: 8px;">Top Expressed Transcripts (TPM)</div>
                        <div style="height: 160px;"><canvas id="cell-bar-canvas"></canvas></div>
                    </div>
                </div>
            </div>
        `;
        document.body.appendChild(cellModal);

        // 2,234-Part Anatomical Search & Auto-Isolation Explorer Modal
        const searchModal = document.createElement('div');
        searchModal.id = 'omni-search-modal';
        searchModal.className = 'omni-search-modal';
        searchModal.style.display = 'none';
        searchModal.innerHTML = `
            <div class="omni-search-backdrop" id="omni-search-backdrop"></div>
            <div class="omni-search-shell">
                <header class="omni-search-head">
                    <div class="omni-search-title-wrap">
                        <span class="omni-search-badge">2,234 CLINICAL STRUCTURES</span>
                        <div class="omni-search-heading">Find & Isolate Anatomical Part</div>
                        <div class="omni-search-sub">Authentic BodyParts3D 4.0 • Instant Solo Isolation & Cinematic Camera Framing</div>
                    </div>
                    <button class="omni-search-close-btn" id="btn-close-structure-search" title="Close (Esc)">&times;</button>
                </header>

                <div class="omni-search-controls">
                    <!-- Search Input Bar -->
                    <div class="omni-search-input-box">
                        <span class="omni-search-input-icon">🔍</span>
                        <input type="text" id="omni-part-catalog-search" placeholder="Search any of 2,234 parts (e.g. Femur, Ventricle, Biceps, Cranial Nerve, Aorta)..." autocomplete="off">
                        <button id="btn-clear-catalog-search" class="omni-search-input-clear" title="Clear search">&times;</button>
                    </div>

                    <!-- System Filter Tabs Bar -->
                    <div class="omni-search-system-tabs" id="omni-search-system-tabs">
                        <button class="omni-sys-tab active" data-sys="all">All (2,234)</button>
                        <button class="omni-sys-tab" data-sys="skeletal">🦴 Skeleton (296)</button>
                        <button class="omni-sys-tab" data-sys="muscular">💪 Muscles (402)</button>
                        <button class="omni-sys-tab" data-sys="arterial">❤️ Arteries (639)</button>
                        <button class="omni-sys-tab" data-sys="venous">🩸 Veins (404)</button>
                        <button class="omni-sys-tab" data-sys="nervous">🧠 Nerves (139)</button>
                        <button class="omni-sys-tab" data-sys="respiratory">🫁 Respiratory (119)</button>
                        <button class="omni-sys-tab" data-sys="digestive">🥣 Digestive (97)</button>
                        <button class="omni-sys-tab" data-sys="cardiac">💓 Heart (23)</button>
                        <button class="omni-sys-tab" data-sys="other">🟡 Other Systems (115)</button>
                    </div>

                    <!-- Status Bar -->
                    <div class="omni-search-status-bar">
                        <span id="omni-search-match-count">Showing 2,234 structures</span>
                        <span class="omni-search-instruction">Click any part to isolate in 3D and zoom in</span>
                    </div>
                </div>

                <!-- Virtualized / Scrollable Parts List -->
                <div class="omni-search-results-grid" id="omni-search-results-grid"></div>
            </div>
        `;
        document.body.appendChild(searchModal);

        // Bind Top Controls
        const pathologySelect = document.getElementById('omni-pathology');
        if (pathologySelect) {
            pathologySelect.addEventListener('change', (e) => setPathology(e.target.value));
        }

        const btnTour = document.getElementById('btn-tour');
        if (btnTour) {
            btnTour.addEventListener('click', () => {
                cinematicTourActive = !cinematicTourActive;
                btnTour.classList.toggle('active', cinematicTourActive);
                playTone(1046.5, 0.12, 'sine', 0.2);
            });
        }

        const btnBio = document.getElementById('btn-bio');
        if (btnBio) {
            btnBio.addEventListener('click', () => {
                bioEnergyActive = !bioEnergyActive;
                btnBio.classList.toggle('active', bioEnergyActive);
                playTone(1046.5, 0.12, 'sine', 0.2);
            });
        }

        const btnKnoll = document.getElementById('btn-knoll');
        if (btnKnoll) {
            btnKnoll.addEventListener('click', () => {
                if (!core) return;
                const state = core.getState();
                const isKnolled = state.explode > 0.5;
                const slider = document.querySelector('input[type="range"]') || document.querySelector('.explode-bar input');
                if (slider) {
                    slider.value = isKnolled ? 0 : 1;
                    slider.dispatchEvent(new Event('input', { bubbles: true }));
                }
                btnKnoll.classList.toggle('active', !isKnolled);
                playTone(1318.5, 0.15, 'sine', 0.2);
            });
        }

        const btnMute = document.getElementById('btn-audio-mute');
        if (btnMute) {
            btnMute.addEventListener('click', () => {
                isMuted = !isMuted;
                const icon = document.getElementById('audio-icon');
                if (icon) icon.textContent = isMuted ? '🔇' : '🔊';
            });
        }

        const btnStl = document.getElementById('btn-export-stl');
        if (btnStl) {
            btnStl.addEventListener('click', () => exportSelectedSTL());
        }

        const btnIsolate = document.getElementById('btn-isolate-part');
        if (btnIsolate) {
            btnIsolate.addEventListener('click', () => togglePartIsolation());
        }

        const btnFocus = document.getElementById('btn-focus-part');
        if (btnFocus) {
            btnFocus.addEventListener('click', () => {
                if (!selectedPartData || !core) return;
                selectAndIsolatePart(selectedPartData.id);
            });
        }

        const btnMriPart = document.getElementById('btn-mri-part');
        if (btnMriPart) {
            btnMriPart.addEventListener('click', () => {
                MRIScannerSuite.open();
                if (selectedPartData && core) {
                    const idx = core.atlas.parts.findIndex(p => p.id === selectedPartData.id);
                    if (idx >= 0 && core.centers[idx]) {
                        const targetNorm = Math.max(0, Math.min(1, (core.centers[idx].y - 0.08) / 1.62));
                        MRIScannerSuite.setElevation(targetNorm);
                    }
                }
            });
        }

        const btnClear = document.getElementById('btn-clear-part');
        if (btnClear) {
            btnClear.addEventListener('click', () => clearSelectionAndReset());
        }

        // Initialize Micro Cell, ECG, MRI Suite, and 2,234-Part Search
        initMicroCell();
        initECG();
        MRIScannerSuite.init();
        init2234PartSearchModal();
        CinematicDissector.initHUD();
    }

    // =========================================================================
    // 2,234-PART COMPREHENSIVE ANATOMY SEARCH & AUTO-ISOLATION ENGINE
    // =========================================================================
    function init2234PartSearchModal() {
        const modal = document.getElementById('omni-search-modal');
        const searchInput = document.getElementById('omni-part-catalog-search');
        const clearBtn = document.getElementById('btn-clear-catalog-search');
        const closeBtn = document.getElementById('btn-close-structure-search');
        const backdrop = document.getElementById('omni-search-backdrop');
        const grid = document.getElementById('omni-search-results-grid');
        const tabs = document.querySelectorAll('.omni-sys-tab');

        if (!modal || !searchInput || !grid) return;

        let activeSystem = 'all';
        let currentQuery = '';
        let filteredList = [];
        let renderedIndex = 0;
        const BATCH_SIZE = 80;

        function escapeHTML(str) {
            if (!str) return '';
            return String(str).replace(/[&<>'"]/g, tag => ({
                '&': '&amp;',
                '<': '&lt;',
                '>': '&gt;',
                "'": '&#39;',
                '"': '&quot;'
            }[tag] || tag));
        }

        function openSearchModal() {
            modal.classList.add('open');
            searchInput.value = '';
            currentQuery = '';
            filterAndRender();
            setTimeout(() => searchInput.focus(), 60);
            playTone(880, 0.08, 'sine', 0.15);
        }

        function closeSearchModal() {
            modal.classList.remove('open');
        }

        function filterAndRender() {
            if (!core || !core.atlas || !core.atlas.parts) return;
            const q = currentQuery.toLowerCase().trim();

            filteredList = core.atlas.parts.filter(p => {
                if (activeSystem !== 'all') {
                    if (activeSystem === 'other') {
                        const mainSystems = ['skeletal', 'muscular', 'arterial', 'venous', 'nervous', 'respiratory', 'digestive', 'cardiac'];
                        if (mainSystems.includes(p.system)) return false;
                    } else if (p.system !== activeSystem) {
                        return false;
                    }
                }
                if (!q) return true;
                return p.name.toLowerCase().includes(q) ||
                       (p.conceptId && p.conceptId.toLowerCase().includes(q)) ||
                       (p.id && p.id.toLowerCase().includes(q)) ||
                       (p.system && p.system.toLowerCase().includes(q));
            });

            const countEl = document.getElementById('omni-search-match-count');
            if (countEl) {
                countEl.textContent = `Showing ${filteredList.length.toLocaleString()} structures`;
            }

            grid.innerHTML = '';
            renderedIndex = 0;
            renderBatch();
        }

        function renderBatch() {
            const nextBatch = filteredList.slice(renderedIndex, renderedIndex + BATCH_SIZE);
            if (nextBatch.length === 0 && renderedIndex === 0) {
                grid.innerHTML = `
                    <div class="omni-search-empty">
                        <div style="font-size: 28px; margin-bottom: 8px;">🔍</div>
                        <div style="color: #ffffff; font-weight: 700;">No anatomical structures found matching "${currentQuery}"</div>
                        <div style="font-size: 11px; color: #64748b; margin-top: 6px;">Try searching for generic terms like "bone", "artery", "cranial", or switch system tabs.</div>
                    </div>
                `;
                return;
            }

            const frag = document.createDocumentFragment();
            for (const part of nextBatch) {
                const card = document.createElement('div');
                card.className = 'omni-search-card';
                card.setAttribute('data-id', part.id);
                const sysColor = SYSTEM_COLOR_MAP[part.system] || '#00f0ff';

                card.innerHTML = `
                    <div class="omni-card-left">
                        <span class="omni-card-dot" style="background: ${sysColor}; box-shadow: 0 0 8px ${sysColor}88;"></span>
                        <div class="omni-card-titles">
                            <span class="omni-card-name">${escapeHTML(part.name)}</span>
                            <div class="omni-card-meta">
                                <span class="omni-card-sys-tag" style="color: ${sysColor}; border-color: ${sysColor}44;">${(part.system || 'ORGAN').toUpperCase()}</span>
                                <span class="omni-card-fma">${part.conceptId || part.id}</span>
                                <span class="omni-card-verts">${(part.vertexCount || 0).toLocaleString()} verts</span>
                            </div>
                        </div>
                    </div>
                    <button class="omni-card-action-btn" title="Isolate in 3D and zoom camera">
                        <span>🎯 Isolate & Zoom</span>
                    </button>
                `;

                card.addEventListener('click', () => {
                    selectAndIsolatePart(part.id);
                    closeSearchModal();
                });

                frag.appendChild(card);
            }
            grid.appendChild(frag);
            renderedIndex += nextBatch.length;
        }

        // Infinite scroll for smooth virtual rendering
        grid.addEventListener('scroll', () => {
            if (grid.scrollTop + grid.clientHeight >= grid.scrollHeight - 160) {
                if (renderedIndex < filteredList.length) {
                    renderBatch();
                }
            }
        });

        // Input search filtering
        searchInput.addEventListener('input', (e) => {
            currentQuery = e.target.value;
            filterAndRender();
        });

        // Clear button
        if (clearBtn) {
            clearBtn.addEventListener('click', () => {
                searchInput.value = '';
                currentQuery = '';
                filterAndRender();
                searchInput.focus();
            });
        }

        // System tabs
        tabs.forEach(tab => {
            tab.addEventListener('click', () => {
                tabs.forEach(t => t.classList.remove('active'));
                tab.classList.add('active');
                activeSystem = tab.getAttribute('data-sys');
                filterAndRender();
            });
        });

        // Close handlers
        if (closeBtn) closeBtn.addEventListener('click', closeSearchModal);
        if (backdrop) backdrop.addEventListener('click', closeSearchModal);

        // Keyboard navigation
        window.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && modal.classList.contains('open')) {
                closeSearchModal();
                return;
            }
            if (e.key === '/' && !(e.target instanceof HTMLInputElement) && !(e.target instanceof HTMLTextAreaElement)) {
                e.preventDefault();
                openSearchModal();
            }
            if (e.key === 'Enter' && modal.classList.contains('open') && document.activeElement === searchInput) {
                if (filteredList.length > 0) {
                    selectAndIsolatePart(filteredList[0].id);
                    closeSearchModal();
                }
            }
        });

        // Top dock search button
        const btnTopSearch = document.getElementById('btn-omni-search');
        if (btnTopSearch) {
            btnTopSearch.addEventListener('click', openSearchModal);
        }

        // Intercept any click on existing "Find a structure" button
        document.addEventListener('click', (e) => {
            const target = e.target.closest('button');
            if (target) {
                const aria = target.getAttribute('aria-label') || '';
                const text = target.textContent || '';
                if (aria.includes('Search anatomy') || text.includes('Find a structure')) {
                    e.preventDefault();
                    e.stopPropagation();
                    openSearchModal();
                }
            }
        }, true);
    }

    // =========================================================================
    // 7. BOOTSTRAP HOOK
    // =========================================================================
    function initOmniClinicalSuite(atlasCore) {
        core = atlasCore;
        console.log('[OmniHuman-3D] Connected to authentic BodyParts3D Atlas Core.');

        createOmniUI();
        HoloEngine.init();

        window.__ATLAS_TICK__ = (delta) => {
            if (CinematicDissector.active) {
                CinematicDissector.update(delta);
            } else if (cameraTransition && core && core.camera && core.controls) {
                const now = performance.now();
                if (!cameraTransition.startTime) cameraTransition.startTime = now;
                const durMs = (cameraTransition.dur || 0.6) * 1000;
                const t = Math.min(1, (now - cameraTransition.startTime) / durMs);
                const ease = t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
                core.camera.position.lerpVectors(cameraTransition.startCam, cameraTransition.targetCam, ease);
                core.controls.target.lerpVectors(cameraTransition.startTarget, cameraTransition.targetCenter, ease);
                core.controls.update();
                if (t >= 1) {
                    core.camera.position.copy(cameraTransition.targetCam);
                    core.controls.target.copy(cameraTransition.targetCenter);
                    core.controls.update();
                    cameraTransition = null;
                }
                core.markDirty();
            }
            HoloEngine.update(delta);
            updateECG(delta);
            MRIScannerSuite.update(delta);
            return true;
        };

        const origSelect = core.selectPart;
        core.selectPart = (id) => {
            origSelect(id);
            if (id) {
                selectAndIsolatePart(id);
            }
        };

        // Auto-track selections from React
        setInterval(() => {
            if (!core) return;
            const state = core.getState ? core.getState() : null;
            if (state && state.selected && state.selected.length > 0) {
                const selId = state.selected[0];
                if ((!selectedPartData || selectedPartData.id !== selId) && (!CinematicDissector.active || CinematicDissector.targetId !== selId)) {
                    selectAndIsolatePart(selId);
                }
            }
        }, 300);

        console.log('✨ [OmniHuman-3D] Production Clinical Workstation Online with 2,234 authentic parts.');
    }

    if (window.__ATLAS_CORE__) {
        initOmniClinicalSuite(window.__ATLAS_CORE__);
    } else {
        window.addEventListener('atlas-ready', (e) => {
            initOmniClinicalSuite(e.detail);
        }, { once: true });
    }

})();

