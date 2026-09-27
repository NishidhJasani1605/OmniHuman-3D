// ==========================================================================
// OMNI-HUMAN 3D — Micro-Scale Virtual Cell Digital Twin & In Silico Perturbation
// 1. 3D Organelle World Model: Nucleus (DNA), ER, RNA Puncta, Golgi, Mitochondria
// 2. High-Content Microscopy Channels (5-Color Multiplexing)
// 3. Multiomic Profiling: Chart.js Radar Phenotyping & Transcript TPM Bars
// 4. In Silico Perturbations: CRISPR Knockouts & Targeted Drug Stress
// ==========================================================================

class CellularTwinModal {
    constructor() {
        this.modal = document.getElementById('cell-modal');
        this.canvasContainer = document.getElementById('cell-three-canvas');

        // Three.js Cell Sub-Engine
        this.scene = null;
        this.camera = null;
        this.renderer = null;
        this.controls = null;
        this.animId = null;

        // Organelle 3D Mesh Groups
        this.organelles = {
            DNA: new THREE.Group(),
            ER: new THREE.Group(),
            RNA: new THREE.Group(),
            AGP: new THREE.Group(),
            MITO: new THREE.Group(),
            membrane: null
        };

        // Chart.js instances
        this.radarChart = null;
        this.barChart = null;

        // Current perturbation state
        this.perturbation = 'CRISPR_TP53';
    }

    init() {
        this.bindModalEvents();
        this.initThreeCellScene();
        this.buildCellOrganelles();
        this.initCharts();
    }

    bindModalEvents() {
        const btnDive = document.getElementById('btn-dive-cellular');
        const btnScaleMicro = document.getElementById('btn-scale-micro');
        const btnClose = document.getElementById('btn-close-cell');
        const btnRunSim = document.getElementById('btn-run-cell-sim');

        if (btnDive) btnDive.addEventListener('click', () => this.openModal());
        if (btnScaleMicro) btnScaleMicro.addEventListener('click', () => this.openModal());
        if (btnClose) btnClose.addEventListener('click', () => this.closeModal());

        if (btnRunSim) {
            btnRunSim.addEventListener('click', () => {
                const select = document.getElementById('cell-perturb-select');
                if (select) this.runPerturbationSimulation(select.value);
            });
        }

        // Organelle channel toggles
        const chanBtns = document.querySelectorAll('.chan-toggle');
        chanBtns.forEach((btn) => {
            btn.addEventListener('click', () => {
                btn.classList.toggle('active');
                const chan = btn.dataset.chan;
                const isActive = btn.classList.contains('active');
                if (this.organelles[chan]) {
                    this.organelles[chan].visible = isActive;
                }
            });
        });
    }

    openModal() {
        if (!this.modal) return;
        this.modal.classList.add('active');
        this.onResize();
        this.startCellAnimation();
    }

    closeModal() {
        if (!this.modal) return;
        this.modal.classList.remove('active');
        if (this.animId) {
            cancelAnimationFrame(this.animId);
            this.animId = null;
        }
    }

    // =========================================================================
    // 3D VIRTUAL CELL SCENE SETUP
    // =========================================================================
    initThreeCellScene() {
        if (!this.canvasContainer) return;

        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x030712);

        const w = this.canvasContainer.clientWidth || 450;
        const h = this.canvasContainer.clientHeight || 450;

        this.camera = new THREE.PerspectiveCamera(45, w / h, 0.1, 1000);
        this.camera.position.set(0, 0, 52);

        this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
        this.renderer.setSize(w, h);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        this.canvasContainer.appendChild(this.renderer.domElement);

        if (window.THREE.OrbitControls) {
            this.controls = new THREE.OrbitControls(this.camera, this.renderer.domElement);
            this.controls.enableDamping = true;
            this.controls.dampingFactor = 0.05;
            this.controls.minDistance = 15;
            this.controls.maxDistance = 120;
        }

        // Lighting
        const ambLight = new THREE.AmbientLight(0xffffff, 0.6);
        this.scene.add(ambLight);

        const pLight1 = new THREE.PointLight(0x00f0ff, 1.2, 100);
        pLight1.position.set(25, 25, 25);
        this.scene.add(pLight1);

        const pLight2 = new THREE.PointLight(0xef4444, 1.0, 100);
        pLight2.position.set(-25, -20, 20);
        this.scene.add(pLight2);
    }

    buildCellOrganelles() {
        // 1. Plasma Membrane (Translucent outer sphere)
        const memGeo = new THREE.SphereGeometry(18, 32, 32);
        const memMat = new THREE.MeshPhysicalMaterial({
            color: 0x38bdf8,
            transparent: true,
            opacity: 0.12,
            roughness: 0.1,
            transmission: 0.85,
            side: THREE.DoubleSide,
            depthWrite: false
        });
        this.organelles.membrane = new THREE.Mesh(memGeo, memMat);
        this.scene.add(this.organelles.membrane);

        // 2. DNA / Nucleus (Center Blue)
        const nucGeo = new THREE.SphereGeometry(7.5, 24, 24);
        const nucMat = new THREE.MeshStandardMaterial({
            color: 0x3b82f6,
            emissive: 0x1d4ed8,
            roughness: 0.4,
            wireframe: false
        });
        const nucMesh = new THREE.Mesh(nucGeo, nucMat);
        this.organelles.DNA.add(nucMesh);
        this.scene.add(this.organelles.DNA);

        // 3. Endoplasmic Reticulum (ER Sheets around nucleus - Emerald)
        const erMat = new THREE.MeshStandardMaterial({ color: 0x10b981, roughness: 0.3, transparent: true, opacity: 0.8 });
        for (let i = 0; i < 4; i++) {
            const erGeo = new THREE.TorusGeometry(9.5 + i * 1.4, 0.6, 8, 24, Math.PI * 1.2);
            erGeo.rotateX(0.4 * i);
            erGeo.rotateY(0.3 * i);
            const erMesh = new THREE.Mesh(erGeo, erMat);
            this.organelles.ER.add(erMesh);
        }
        this.scene.add(this.organelles.ER);

        // 4. Mitochondria (Red bean-shaped spheroids)
        const mitoMat = new THREE.MeshStandardMaterial({ color: 0xef4444, roughness: 0.3 });
        for (let m = 0; m < 12; m++) {
            const mitoGeo = new THREE.SphereGeometry(0.9, 12, 12);
            mitoGeo.scale(1.0, 2.2, 1.0);
            const mito = new THREE.Mesh(mitoGeo, mitoMat);

            // Scatter within cytosol
            const angle = Math.random() * Math.PI * 2;
            const dist = 11 + Math.random() * 4.5;
            const z = (Math.random() - 0.5) * 12;
            mito.position.set(Math.cos(angle) * dist, Math.sin(angle) * dist, z);
            mito.rotation.set(Math.random() * 3, Math.random() * 3, Math.random() * 3);
            this.organelles.MITO.add(mito);
        }
        this.scene.add(this.organelles.MITO);

        // 5. AGP / Golgi Complex (Orange stacked folds)
        const agpMat = new THREE.MeshStandardMaterial({ color: 0xf97316, roughness: 0.35 });
        for (let g = 0; g < 3; g++) {
            const gGeo = new THREE.TorusGeometry(3.5, 0.5, 8, 16, Math.PI * 0.7);
            const gMesh = new THREE.Mesh(gGeo, agpMat);
            gMesh.position.set(-10, 5 + g * 1.1, 2);
            gMesh.rotation.z = 0.5;
            this.organelles.AGP.add(gMesh);
        }
        this.scene.add(this.organelles.AGP);

        // 6. RNA Puncta (Yellow molecular particles)
        const rnaGeo = new THREE.BufferGeometry();
        const rnaCount = 200;
        const posArray = new Float32Array(rnaCount * 3);

        for (let p = 0; p < rnaCount * 3; p += 3) {
            const r = 4 + Math.random() * 11;
            const theta = Math.random() * Math.PI * 2;
            const phi = Math.acos(2 * Math.random() - 1);

            posArray[p] = r * Math.sin(phi) * Math.cos(theta);
            posArray[p + 1] = r * Math.sin(phi) * Math.sin(theta);
            posArray[p + 2] = r * Math.cos(phi);
        }
        rnaGeo.setAttribute('position', new THREE.BufferAttribute(posArray, 3));

        const rnaMat = new THREE.PointsMaterial({
            color: 0xfacc15,
            size: 0.75,
            transparent: true,
            opacity: 0.85
        });
        const rnaPoints = new THREE.Points(rnaGeo, rnaMat);
        this.organelles.RNA.add(rnaPoints);
        this.scene.add(this.organelles.RNA);
    }

    startCellAnimation() {
        const loop = () => {
            this.animId = requestAnimationFrame(loop);
            if (this.controls) this.controls.update();

            // Gentle cytosolic rotation
            if (this.organelles.RNA) this.organelles.RNA.rotation.y += 0.003;
            if (this.organelles.MITO) this.organelles.MITO.rotation.z += 0.001;

            if (this.renderer && this.scene && this.camera) {
                this.renderer.render(this.scene, this.camera);
            }
        };
        loop();
    }

    onResize() {
        if (!this.canvasContainer || !this.renderer || !this.camera) return;
        const w = this.canvasContainer.clientWidth;
        const h = this.canvasContainer.clientHeight;
        if (w > 0 && h > 0) {
            this.camera.aspect = w / h;
            this.camera.updateProjectionMatrix();
            this.renderer.setSize(w, h);
        }
    }

    // =========================================================================
    // MULTIOMICS PHENOTYPING & CHARTS
    // =========================================================================
    initCharts() {
        // Radar Chart
        const radarCanvas = document.getElementById('cell-radar-canvas');
        if (radarCanvas && window.Chart) {
            this.radarChart = new Chart(radarCanvas, {
                type: 'radar',
                data: {
                    labels: ['Nuclear Size', 'Mito Potential', 'ER Stress', 'Golgi Integrity', 'RNA Velocity', 'ATP Flux'],
                    datasets: [
                        {
                            label: 'Wild-Type Baseline',
                            data: [80, 85, 20, 90, 75, 88],
                            borderColor: 'rgba(0, 240, 255, 0.4)',
                            backgroundColor: 'rgba(0, 240, 255, 0.1)',
                            borderWidth: 1.5,
                            pointRadius: 2
                        },
                        {
                            label: 'Perturbed Twin',
                            data: [82, 35, 78, 60, 42, 38],
                            borderColor: '#ef4444',
                            backgroundColor: 'rgba(239, 68, 68, 0.25)',
                            borderWidth: 2,
                            pointRadius: 3
                        }
                    ]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    scales: {
                        r: {
                            angleLines: { color: 'rgba(255, 255, 255, 0.08)' },
                            grid: { color: 'rgba(255, 255, 255, 0.08)' },
                            pointLabels: { color: '#94a3b8', font: { size: 9 } },
                            ticks: { display: false, max: 100, min: 0 }
                        }
                    },
                    plugins: {
                        legend: { labels: { color: '#e2e8f0', font: { size: 10 } } }
                    }
                }
            });
        }

        // Bar Chart
        const barCanvas = document.getElementById('cell-bar-canvas');
        if (barCanvas && window.Chart) {
            this.barChart = new Chart(barCanvas, {
                type: 'bar',
                data: {
                    labels: ['TP53', 'MDM2', 'CDKN1A', 'BAX', 'PUMA', 'VEGFA'],
                    datasets: [
                        {
                            label: 'Wild-Type (TPM)',
                            data: [45, 38, 52, 28, 18, 65],
                            backgroundColor: 'rgba(0, 240, 255, 0.5)'
                        },
                        {
                            label: 'Perturbed (TPM)',
                            data: [3, 8, 4, 9, 5, 95], // TP53 knockout profile
                            backgroundColor: '#ef4444'
                        }
                    ]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    scales: {
                        x: { ticks: { color: '#94a3b8', font: { size: 9 } }, grid: { display: false } },
                        y: { ticks: { color: '#94a3b8', font: { size: 9 } }, grid: { color: 'rgba(255, 255, 255, 0.06)' } }
                    },
                    plugins: {
                        legend: { labels: { color: '#e2e8f0', font: { size: 10 } } }
                    }
                }
            });
        }
    }

    runPerturbationSimulation(mode) {
        this.perturbation = mode;
        const statusEl = document.getElementById('cell-status-text');

        let radarData = [];
        let barData = [];
        let message = "";

        switch (mode) {
            case 'CRISPR_TP53':
                radarData = [85, 35, 78, 62, 40, 36];
                barData = [2, 6, 3, 7, 4, 98];
                message = "CRISPR-Cas9 TP53 Knockout active. Loss of cell-cycle G1 arrest checkpoint; marked repression of p21 (CDKN1A) and pro-apoptotic BAX. Hyper-angiogenic VEGFA surge.";
                // Visual change: enlarge nucleus, dim mitochondria
                if (this.organelles.DNA) this.organelles.DNA.scale.set(1.2, 1.2, 1.2);
                break;
            case 'CRISPR_MYC':
                radarData = [95, 90, 65, 80, 98, 92];
                barData = [48, 62, 22, 34, 25, 120];
                message = "c-Myc Proto-Oncogene Transduction. Global transcriptional amplification; nucleolar enlargement and heightened ribosome biogenesis.";
                if (this.organelles.DNA) this.organelles.DNA.scale.set(1.35, 1.35, 1.35);
                break;
            case 'DRUG_SORAFENIB':
                radarData = [65, 25, 85, 45, 30, 22];
                barData = [55, 42, 70, 68, 55, 12];
                message = "Sorafenib Kinase Inhibitor applied (10 \u03BCM). Severe collapse of mitochondrial membrane potential \u0394\u03A8m; profound suppression of VEGFA and activation of intrinsic apoptosis cascade.";
                if (this.organelles.DNA) this.organelles.DNA.scale.set(0.9, 0.9, 0.9);
                break;
            case 'DRUG_DOXORUBICIN':
                radarData = [90, 15, 95, 35, 18, 12];
                barData = [92, 18, 98, 95, 88, 30];
                message = "Doxorubicin Topoisomerase II intercalator applied. Lethal double-strand DNA cleavage with massive p53 hyperphosphorylation, extensive reactive oxygen species (ROS), and mitochondrial permeabilization.";
                if (this.organelles.DNA) this.organelles.DNA.scale.set(1.1, 1.1, 1.1);
                break;
        }

        if (statusEl) statusEl.textContent = message;

        // Update charts
        if (this.radarChart) {
            this.radarChart.data.datasets[1].data = radarData;
            this.radarChart.update();
        }
        if (this.barChart) {
            this.barChart.data.datasets[1].data = barData;
            this.barChart.update();
        }
    }
}

window.CellularTwinModal = CellularTwinModal;
