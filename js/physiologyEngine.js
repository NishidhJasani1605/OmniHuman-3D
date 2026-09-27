// ==========================================================================
// OMNI-HUMAN 3D — Real-Time Physiology & Electrophysiology Engine
// 1. Cardiac Cycle: Ventricular systole/diastole pulsating synced with BPM
// 2. Respiratory Engine: Tidal lung expansion & alveolar compliance
// 3. Real-Time Oscilloscope: 12-Lead ECG Waveform Rendering (P-QRS-T)
// 4. Dynamic Pathological Arrythmia Simulation (STEMI ST-Elevation, Tachycardia)
// ==========================================================================

class PhysiologyEngine {
    constructor(macroBuilder, audioSynth) {
        this.macroBuilder = macroBuilder;
        this.audioSynth = audioSynth;

        // Hemodynamic & Vital Sign Parameters
        this.bpm = 75;
        this.respiratoryRate = 14; // breaths per minute
        this.spo2 = 99;
        this.systolicBP = 120;
        this.diastolicBP = 80;

        // Pathophysiology state
        this.currentPathology = 'healthy'; // 'healthy', 'stemi', 'herniation', 'pneumothorax', 'cirrhosis'

        // ECG Canvas & Buffer
        this.canvas = document.getElementById('ecg-canvas');
        this.ctx = this.canvas ? this.canvas.getContext('2d') : null;
        this.ecgPoints = [];
        this.maxPoints = 320;
        this.ecgX = 0;
        this.time = 0;

        // DOM elements
        this.elHr = document.getElementById('vital-hr');
        this.elBp = document.getElementById('vital-bp');
        this.elSpo2 = document.getElementById('vital-spo2');
        this.elStatus = document.getElementById('ecg-status');

        this.initEcgBuffer();
    }

    init() {
        // Bind HR slider
        const sliderHr = document.getElementById('slider-hr');
        const sliderHrVal = document.getElementById('slider-hr-val');
        if (sliderHr) {
            sliderHr.addEventListener('input', (e) => {
                const newBpm = parseInt(e.target.value);
                this.setBPM(newBpm);
                if (sliderHrVal) sliderHrVal.textContent = `${newBpm} BPM`;
            });
        }
    }

    initEcgBuffer() {
        if (!this.canvas) return;
        this.maxPoints = this.canvas.width;
        this.ecgPoints = new Array(this.maxPoints).fill(this.canvas.height / 2);
    }

    setBPM(bpm) {
        this.bpm = bpm;
        if (this.audioSynth) {
            this.audioSynth.setBPM(bpm);
        }
        if (this.elHr) {
            this.elHr.innerHTML = `${Math.round(this.bpm)} <small>BPM</small>`;
        }
    }

    setPathology(pathology) {
        this.currentPathology = pathology;
        switch (pathology) {
            case 'stemi':
                this.setBPM(112);
                this.systolicBP = 88;
                this.diastolicBP = 56;
                this.spo2 = 91;
                if (this.elStatus) this.elStatus.textContent = "CRITICAL: Anterior ST-Elevation (STEMI)";
                break;
            case 'pneumothorax':
                this.setBPM(138);
                this.respiratoryRate = 32;
                this.systolicBP = 80;
                this.diastolicBP = 50;
                this.spo2 = 82;
                if (this.elStatus) this.elStatus.textContent = "EMERGENCY: Tension Pneumothorax Shock";
                break;
            case 'herniation':
                this.setBPM(88); // Pain-induced tachycardia
                this.systolicBP = 135;
                this.diastolicBP = 88;
                this.spo2 = 98;
                if (this.elStatus) this.elStatus.textContent = "Acute Lumbar Radiculopathy Strain";
                break;
            case 'cirrhosis':
                this.setBPM(92);
                this.systolicBP = 105;
                this.diastolicBP = 65;
                this.spo2 = 95;
                if (this.elStatus) this.elStatus.textContent = "Hyperdynamic Splanchnic Circulation";
                break;
            case 'healthy':
            default:
                this.setBPM(75);
                this.systolicBP = 120;
                this.diastolicBP = 80;
                this.spo2 = 99;
                if (this.elStatus) this.elStatus.textContent = "Normal Sinus Rhythm";
                break;
        }

        if (this.elBp) this.elBp.textContent = `${this.systolicBP}/${this.diastolicBP}`;
        if (this.elSpo2) this.elSpo2.innerHTML = `${this.spo2}% <small>SpO2</small>`;
    }

    update(deltaSeconds) {
        this.time += deltaSeconds;

        // 1. Cardiac Ventricular Pulsation
        const cardiacFrequency = this.bpm / 60; // Hz
        const cardiacPhase = (this.time * cardiacFrequency) % 1.0;

        // Systolic contraction spike followed by diastolic filling
        let ventricularScale = 1.0;
        if (cardiacPhase < 0.15) {
            // Isovolumetric contraction & rapid ejection
            ventricularScale = 1.0 + Math.sin((cardiacPhase / 0.15) * Math.PI) * 0.18;
        } else if (cardiacPhase < 0.35) {
            // Rapid filling
            ventricularScale = 1.0 + Math.sin(((cardiacPhase - 0.15) / 0.20) * Math.PI) * 0.08;
        }

        if (this.macroBuilder && this.macroBuilder.animatedOrgans.heart) {
            const h = this.macroBuilder.animatedOrgans.heart;
            h.scale.set(ventricularScale, ventricularScale * 1.05, ventricularScale);
        }

        // 2. Respiratory Pulmonary Tidal Expansion
        const respFreq = this.respiratoryRate / 60;
        const breathPhase = Math.sin(this.time * respFreq * Math.PI * 2);
        const lungScale = 1.0 + (breathPhase * 0.09);

        if (this.macroBuilder) {
            const lL = this.macroBuilder.animatedOrgans.leftLung;
            const rL = this.macroBuilder.animatedOrgans.rightLung;

            // In pneumothorax, the right lung is collapsed (atelectasis)
            if (this.currentPathology === 'pneumothorax') {
                if (lL) lL.scale.set(lungScale * 1.15, lungScale * 1.15, lungScale * 1.15); // Compensatory hyperinflation
                if (rL) rL.scale.set(0.35, 0.35, 0.35); // Collapsed lung
            } else {
                if (lL) lL.scale.set(lungScale, lungScale, lungScale);
                if (rL) rL.scale.set(lungScale, lungScale, lungScale);
            }
        }

        // 3. Render ECG Oscilloscope Waveform
        this.renderECG(cardiacPhase);
    }

    renderECG(cardiacPhase) {
        if (!this.ctx || !this.canvas) return;

        const w = this.canvas.width;
        const h = this.canvas.height;
        const midY = h / 2;

        // Calculate electrical deflection voltage Y based on cardiac electrophysiology
        let deflection = 0; // -1 to +1

        if (cardiacPhase > 0.05 && cardiacPhase < 0.15) {
            // P-Wave (Atrial Depolarization)
            const pPhase = (cardiacPhase - 0.05) / 0.10;
            deflection = Math.sin(pPhase * Math.PI) * 0.22;
        } else if (cardiacPhase > 0.18 && cardiacPhase < 0.22) {
            // Q-Wave (Septal Depolarization)
            deflection = -0.18;
        } else if (cardiacPhase >= 0.22 && cardiacPhase < 0.28) {
            // R-Wave (Ventricular Depolarization Spike)
            const rPhase = (cardiacPhase - 0.22) / 0.06;
            deflection = Math.sin(rPhase * Math.PI) * 1.35;
        } else if (cardiacPhase >= 0.28 && cardiacPhase < 0.32) {
            // S-Wave
            deflection = -0.32;
        } else if (cardiacPhase >= 0.32 && cardiacPhase < 0.50) {
            // ST-Segment
            if (this.currentPathology === 'stemi') {
                // Significant ST-Elevation (Tombstone MI pattern)
                deflection = 0.58;
            } else {
                deflection = 0.0; // Isoelectric baseline
            }
        } else if (cardiacPhase >= 0.50 && cardiacPhase < 0.68) {
            // T-Wave (Ventricular Repolarization)
            const tPhase = (cardiacPhase - 0.50) / 0.18;
            if (this.currentPathology === 'stemi') {
                // Peaked hyperacute T-wave
                deflection = Math.sin(tPhase * Math.PI) * 0.75 + 0.35;
            } else {
                deflection = Math.sin(tPhase * Math.PI) * 0.32;
            }
        }

        // Add micro-physiological biological noise / wander
        const baselineWander = Math.sin(this.time * 1.8) * 0.04 + (Math.random() - 0.5) * 0.02;
        const currentY = midY - (deflection + baselineWander) * (h * 0.38);

        // Store into rolling oscilloscope buffer
        this.ecgPoints[this.ecgX] = currentY;
        this.ecgX = (this.ecgX + 2) % w;

        // Draw Canvas Grid & Waveform
        this.ctx.fillStyle = '#060d17';
        this.ctx.fillRect(0, 0, w, h);

        // Medical ECG mm grid lines
        this.ctx.strokeStyle = 'rgba(0, 240, 255, 0.08)';
        this.ctx.lineWidth = 1;
        this.ctx.beginPath();
        for (let x = 0; x < w; x += 15) {
            this.ctx.moveTo(x, 0);
            this.ctx.lineTo(x, h);
        }
        for (let y = 0; y < h; y += 15) {
            this.ctx.moveTo(0, y);
            this.ctx.lineTo(w, y);
        }
        this.ctx.stroke();

        // Draw dynamic ECG trace
        this.ctx.beginPath();
        this.ctx.lineWidth = 2.2;
        this.ctx.strokeStyle = this.currentPathology === 'stemi' ? '#ff1744' : '#00f0ff';
        this.ctx.shadowColor = this.currentPathology === 'stemi' ? 'rgba(255, 23, 68, 0.8)' : 'rgba(0, 240, 255, 0.8)';
        this.ctx.shadowBlur = 6;

        for (let i = 0; i < w; i++) {
            // Gap before sweeping head
            if (Math.abs(i - this.ecgX) < 8) continue;

            const y = this.ecgPoints[i] || midY;
            if (i === 0) this.ctx.moveTo(i, y);
            else this.ctx.lineTo(i, y);
        }
        this.ctx.stroke();
        this.ctx.shadowBlur = 0;

        // Draw sweep head dot
        this.ctx.fillStyle = '#ffffff';
        this.ctx.beginPath();
        this.ctx.arc(this.ecgX, this.ecgPoints[this.ecgX] || midY, 3, 0, Math.PI * 2);
        this.ctx.fill();
    }
}

window.PhysiologyEngine = PhysiologyEngine;
