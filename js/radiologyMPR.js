// ==========================================================================
// OMNI-HUMAN 3D — Radiology Multiplanar Reconstruction (MPR) Deck
// 1. 3D Laser Cutting Plane: Interactive resection plane traversing the body
// 2. Multiplanar Slice Monitors: Synchronized Axial, Coronal, & Sagittal Views
// 3. Clinical Hounsfield Windowing: Soft Tissue, Bone, Lung, Brain, Angio
// ==========================================================================

class RadiologyMPRDeck {
    constructor(scene, macroBuilder) {
        this.scene = scene;
        this.macroBuilder = macroBuilder;

        // Cutting plane 3D mesh
        this.laserPlane = null;
        this.laserVisible = true;
        this.sliceHeightY = 50.0; // Current height in world coordinates (-70 to +85)

        // Window preset
        this.currentWindow = 'soft'; // 'soft', 'bone', 'lung', 'brain', 'angio'

        // Canvases
        this.canvasAxial = document.getElementById('mpr-canvas-axial');
        this.canvasCoronal = document.getElementById('mpr-canvas-coronal');
        this.canvasSagittal = document.getElementById('mpr-canvas-sagittal');

        this.ctxAxial = this.canvasAxial ? this.canvasAxial.getContext('2d') : null;
        this.ctxCoronal = this.canvasCoronal ? this.canvasCoronal.getContext('2d') : null;
        this.ctxSagittal = this.canvasSagittal ? this.canvasSagittal.getContext('2d') : null;

        // UI elements
        this.sliderSlice = document.getElementById('mpr-slice-slider');
        this.valSlice = document.getElementById('mpr-slice-val');
        this.btnToggleLaser = document.getElementById('btn-toggle-mpr-laser');
    }

    init() {
        this.build3DLaserPlane();
        this.bindEvents();
        this.renderAllSlices();
    }

    build3DLaserPlane() {
        const planeGeo = new THREE.PlaneGeometry(38, 28);
        planeGeo.rotateX(Math.PI / 2); // Horizontal axial plane

        const planeMat = new THREE.MeshBasicMaterial({
            color: 0x00f0ff,
            transparent: true,
            opacity: 0.28,
            side: THREE.DoubleSide,
            depthWrite: false
        });

        this.laserPlane = new THREE.Mesh(planeGeo, planeMat);
        this.laserPlane.position.set(0, this.sliceHeightY, 0);

        // Grid wireframe overlay
        const wireGeo = new THREE.WireframeGeometry(planeGeo);
        const wireMat = new THREE.LineBasicMaterial({ color: 0x00f0ff, transparent: true, opacity: 0.6 });
        const wire = new THREE.LineSegments(wireGeo, wireMat);
        this.laserPlane.add(wire);

        this.scene.add(this.laserPlane);
    }

    bindEvents() {
        // Toggle Laser button
        if (this.btnToggleLaser) {
            this.btnToggleLaser.addEventListener('click', () => {
                this.laserVisible = !this.laserVisible;
                if (this.laserPlane) this.laserPlane.visible = this.laserVisible;
                this.btnToggleLaser.classList.toggle('active', this.laserVisible);
                this.btnToggleLaser.textContent = this.laserVisible ? "Hide Radiology Cut Plane" : "Show Radiology Cut Plane";
            });
        }

        // Slice height slider
        if (this.sliderSlice) {
            this.sliderSlice.addEventListener('input', (e) => {
                const norm = parseFloat(e.target.value) / 1000.0; // 0 to 1
                // Map 0..1 to -70..+85 Y height
                this.sliceHeightY = -70 + norm * 155;
                if (this.laserPlane) {
                    this.laserPlane.position.y = this.sliceHeightY;
                }
                if (this.valSlice) {
                    this.valSlice.textContent = `${this.sliceHeightY > 0 ? '+' : ''}${this.sliceHeightY.toFixed(1)} mm`;
                }
                this.renderAllSlices();
            });
        }

        // Window preset buttons
        const presetBtns = document.querySelectorAll('.mpr-preset-group .mpr-btn');
        presetBtns.forEach((btn) => {
            btn.addEventListener('click', () => {
                presetBtns.forEach((b) => b.classList.remove('active'));
                btn.classList.add('active');
                this.currentWindow = btn.dataset.window;
                this.renderAllSlices();
            });
        });
    }

    renderAllSlices() {
        this.renderAxialSlice();
        this.renderCoronalSlice();
        this.renderSagittalSlice();
    }

    // =========================================================================
    // SLICE RENDERING ENGINES
    // =========================================================================

    renderAxialSlice() {
        if (!this.ctxAxial || !this.canvasAxial) return;
        const ctx = this.ctxAxial;
        const w = this.canvasAxial.width;
        const h = this.canvasAxial.height;
        const y = this.sliceHeightY;

        ctx.fillStyle = '#02060b';
        ctx.fillRect(0, 0, w, h);

        const centerX = w / 2;
        const centerY = h / 2;

        // Draw cross-section anatomical morphology based on anatomical height
        if (y > 68) {
            // --- CRANIAL / BRAIN SLICE ---
            // Cranial skull bone ring
            ctx.strokeStyle = this.currentWindow === 'bone' ? '#ffffff' : '#888888';
            ctx.lineWidth = 6;
            ctx.beginPath();
            ctx.ellipse(centerX, centerY, 52, 42, 0, 0, Math.PI * 2);
            ctx.stroke();

            // Brain parenchyma
            ctx.fillStyle = this.currentWindow === 'brain' ? '#999999' : '#555555';
            ctx.beginPath();
            ctx.ellipse(centerX, centerY, 47, 37, 0, 0, Math.PI * 2);
            ctx.fill();

            // Lateral ventricles (CSF radiolucency)
            ctx.fillStyle = '#080808';
            ctx.beginPath();
            ctx.arc(centerX - 10, centerY, 6, 0, Math.PI * 2);
            ctx.arc(centerX + 10, centerY, 6, 0, Math.PI * 2);
            ctx.fill();
        } else if (y >= 45 && y <= 68) {
            // --- THORACIC / CARDIOPULMONARY SLICE ---
            // Skin & chest perimeter
            ctx.strokeStyle = '#444444';
            ctx.lineWidth = 4;
            ctx.beginPath();
            ctx.ellipse(centerX, centerY, 68, 44, 0, 0, Math.PI * 2);
            ctx.stroke();

            // Ribs & sternum
            ctx.fillStyle = this.currentWindow === 'bone' ? '#ffffff' : '#aaaaaa';
            // Sternum
            ctx.fillRect(centerX - 8, centerY - 40, 16, 5);
            // Vertebral body
            ctx.beginPath();
            ctx.arc(centerX, centerY + 30, 9, 0, Math.PI * 2);
            ctx.fill();

            // Lungs (Hypodense black / air field)
            ctx.fillStyle = this.currentWindow === 'lung' ? '#182834' : '#050c12';
            // Left lung
            ctx.beginPath();
            ctx.ellipse(centerX + 28, centerY - 2, 22, 26, 0.2, 0, Math.PI * 2);
            ctx.fill();
            // Right lung
            ctx.beginPath();
            ctx.ellipse(centerX - 28, centerY - 2, 24, 26, -0.2, 0, Math.PI * 2);
            ctx.fill();

            // Heart / Mediastinal silhouette
            ctx.fillStyle = this.currentWindow === 'angio' ? '#ff3d00' : '#4a5568';
            ctx.beginPath();
            ctx.ellipse(centerX - 6, centerY - 6, 20, 16, 0.4, 0, Math.PI * 2);
            ctx.fill();

            // Aorta
            ctx.fillStyle = this.currentWindow === 'angio' ? '#ffffff' : '#2d3748';
            ctx.beginPath();
            ctx.arc(centerX + 7, centerY + 18, 5, 0, Math.PI * 2);
            ctx.fill();
        } else if (y >= 25 && y < 45) {
            // --- ABDOMINAL SLICE (Liver, Stomach, Kidneys) ---
            // Outer wall
            ctx.strokeStyle = '#383838';
            ctx.lineWidth = 4;
            ctx.beginPath();
            ctx.ellipse(centerX, centerY, 65, 42, 0, 0, Math.PI * 2);
            ctx.stroke();

            // Vertebral body
            ctx.fillStyle = '#999999';
            ctx.beginPath();
            ctx.arc(centerX, centerY + 26, 10, 0, Math.PI * 2);
            ctx.fill();

            // Liver wedge (Right side)
            ctx.fillStyle = this.currentWindow === 'soft' ? '#5a6275' : '#384252';
            ctx.beginPath();
            ctx.ellipse(centerX - 26, centerY - 2, 24, 22, -0.2, 0, Math.PI * 2);
            ctx.fill();

            // Stomach air bubble (Left side)
            ctx.fillStyle = '#0a1018';
            ctx.beginPath();
            ctx.ellipse(centerX + 22, centerY - 10, 15, 12, 0.3, 0, Math.PI * 2);
            ctx.fill();

            // Bilateral Kidneys
            ctx.fillStyle = '#484e5b';
            ctx.beginPath();
            ctx.ellipse(centerX - 22, centerY + 20, 10, 8, 0, 0, Math.PI * 2);
            ctx.ellipse(centerX + 22, centerY + 20, 10, 8, 0, 0, Math.PI * 2);
            ctx.fill();
        } else {
            // --- PELVIC & LOWER LIMB SLICE ---
            // Bilateral femurs / iliac bones
            ctx.fillStyle = this.currentWindow === 'bone' ? '#ffffff' : '#888888';
            ctx.beginPath();
            ctx.arc(centerX - 35, centerY, 14, 0, Math.PI * 2);
            ctx.arc(centerX + 35, centerY, 14, 0, Math.PI * 2);
            ctx.fill();

            // Bladder
            ctx.fillStyle = '#111b27';
            ctx.beginPath();
            ctx.ellipse(centerX, centerY - 4, 16, 12, 0, 0, Math.PI * 2);
            ctx.fill();
        }

        // Crosshairs & scale grid
        this.drawOverlayHUD(ctx, w, h, 'AX');
    }

    renderCoronalSlice() {
        if (!this.ctxCoronal || !this.canvasCoronal) return;
        const ctx = this.ctxCoronal;
        const w = this.canvasCoronal.width;
        const h = this.canvasCoronal.height;

        ctx.fillStyle = '#02060b';
        ctx.fillRect(0, 0, w, h);

        const cx = w / 2;
        const cy = h / 2;

        // Frontal silhouette
        ctx.strokeStyle = '#383838';
        ctx.lineWidth = 2;
        ctx.strokeRect(cx - 35, 10, 70, 100);

        // Lungs
        ctx.fillStyle = this.currentWindow === 'lung' ? '#1a2632' : '#080d14';
        ctx.fillRect(cx - 30, 30, 24, 35);
        ctx.fillRect(cx + 6, 30, 24, 35);

        // Heart
        ctx.fillStyle = this.currentWindow === 'angio' ? '#ff3d00' : '#4a5568';
        ctx.beginPath();
        ctx.arc(cx - 4, 52, 12, 0, Math.PI * 2);
        ctx.fill();

        // Spine column
        ctx.fillStyle = this.currentWindow === 'bone' ? '#ffffff' : '#888888';
        ctx.fillRect(cx - 3, 20, 6, 80);

        // Slice indicator line
        const normY = (85 - this.sliceHeightY) / 155;
        const lineY = Math.max(5, Math.min(h - 5, normY * h));
        ctx.strokeStyle = '#00f0ff';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(0, lineY);
        ctx.lineTo(w, lineY);
        ctx.stroke();

        this.drawOverlayHUD(ctx, w, h, 'COR');
    }

    renderSagittalSlice() {
        if (!this.ctxSagittal || !this.canvasSagittal) return;
        const ctx = this.ctxSagittal;
        const w = this.canvasSagittal.width;
        const h = this.canvasSagittal.height;

        ctx.fillStyle = '#02060b';
        ctx.fillRect(0, 0, w, h);

        const cx = w / 2;

        // Lateral silhouette
        ctx.strokeStyle = '#383838';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(cx - 20, 15);
        ctx.lineTo(cx + 25, 45); // Chest anterior
        ctx.lineTo(cx + 20, 75); // Abdomen
        ctx.lineTo(cx - 25, 105);
        ctx.stroke();

        // S-shaped vertebral column
        ctx.fillStyle = this.currentWindow === 'bone' ? '#ffffff' : '#888888';
        for (let i = 0; i < 18; i++) {
            const vy = 20 + i * 4.5;
            const vz = cx - 12 + Math.sin(i / 3) * 6;
            ctx.fillRect(vz, vy, 8, 3.5);
        }

        // Slice indicator line
        const normY = (85 - this.sliceHeightY) / 155;
        const lineY = Math.max(5, Math.min(h - 5, normY * h));
        ctx.strokeStyle = '#00f0ff';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(0, lineY);
        ctx.lineTo(w, lineY);
        ctx.stroke();

        this.drawOverlayHUD(ctx, w, h, 'SAG');
    }

    drawOverlayHUD(ctx, w, h, label) {
        ctx.fillStyle = '#00f0ff';
        ctx.font = '10px monospace';
        ctx.fillText(label, 8, 14);

        ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
        ctx.fillText(`W:${this.currentWindow.toUpperCase()}`, w - 50, 14);
    }
}

window.RadiologyMPRDeck = RadiologyMPRDeck;
