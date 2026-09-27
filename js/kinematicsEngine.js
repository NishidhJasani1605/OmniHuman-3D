// ==========================================================================
// OMNI-HUMAN 3D — Biomechanical Kinematics & Muscle Strain Heatmap Engine
// 1. Forward Kinematics: Spine flexion/extension, lateral bend, shoulder, knee
// 2. Muscle Strain Heatmap Physics: Green (safe) -> Amber (stress) -> Red (failure)
// 3. NIOSH Biomechanical Spine Compressive Force Equation at L4-L5
// ==========================================================================

class KinematicsEngine {
    constructor(macroBuilder) {
        this.macroBuilder = macroBuilder;

        // Kinematic joint angles in degrees
        this.lumbarAngle = 0;   // -25 to +60 deg
        this.latBendAngle = 0;  // -30 to +30 deg
        this.shoulderAngle = 15;// 0 to 170 deg
        this.kneeAngle = 0;     // 0 to 135 deg

        // Calculated biomechanical metrics
        this.discCompressionLoadN = 420; // Baseline standing load ~400-500 N

        // DOM elements
        this.elValLumbar = document.getElementById('val-lumbar');
        this.elValLatBend = document.getElementById('val-lat-bend');
        this.elValShoulder = document.getElementById('val-shoulder');
        this.elValKnee = document.getElementById('val-knee');
        this.elVitalLoad = document.getElementById('vital-load');
    }

    init() {
        // Spine flexion slider
        const sLumbar = document.getElementById('slider-lumbar');
        if (sLumbar) {
            sLumbar.addEventListener('input', (e) => {
                this.lumbarAngle = parseFloat(e.target.value);
                if (this.elValLumbar) this.elValLumbar.innerHTML = `${Math.round(this.lumbarAngle)}&deg;`;
                this.updateKinematics();
            });
        }

        // Lateral bend slider
        const sLatBend = document.getElementById('slider-lat-bend');
        if (sLatBend) {
            sLatBend.addEventListener('input', (e) => {
                this.latBendAngle = parseFloat(e.target.value);
                if (this.elValLatBend) this.elValLatBend.innerHTML = `${Math.round(this.latBendAngle)}&deg;`;
                this.updateKinematics();
            });
        }

        // Shoulder abduction slider
        const sShoulder = document.getElementById('slider-shoulder');
        if (sShoulder) {
            sShoulder.addEventListener('input', (e) => {
                this.shoulderAngle = parseFloat(e.target.value);
                if (this.elValShoulder) this.elValShoulder.innerHTML = `${Math.round(this.shoulderAngle)}&deg;`;
                this.updateKinematics();
            });
        }

        // Knee squat slider
        const sKnee = document.getElementById('slider-knee');
        if (sKnee) {
            sKnee.addEventListener('input', (e) => {
                this.kneeAngle = parseFloat(e.target.value);
                if (this.elValKnee) this.elValKnee.innerHTML = `${Math.round(this.kneeAngle)}&deg;`;
                this.updateKinematics();
            });
        }

        this.updateKinematics();
    }

    updateKinematics() {
        if (!this.macroBuilder) return;

        const radLumbar = THREE.MathUtils.degToRad(this.lumbarAngle);
        const radLatBend = THREE.MathUtils.degToRad(this.latBendAngle);
        const radShoulder = THREE.MathUtils.degToRad(this.shoulderAngle);
        const radKnee = THREE.MathUtils.degToRad(this.kneeAngle);

        // 1. Articulate Spine Segments (progressive bending curve)
        const spineSegs = this.macroBuilder.animatedOrgans.spineSegments;
        const totalSegs = spineSegs.length;
        if (totalSegs > 0) {
            spineSegs.forEach((seg, idx) => {
                // Higher vertebrae bend proportionally more from the base
                const fraction = idx / totalSegs;
                seg.rotation.x = radLumbar * fraction * 0.8;
                seg.rotation.z = radLatBend * fraction * 0.8;
            });
        }

        // 2. Articulate Shoulders (Abduction around Z axis)
        const armL = this.macroBuilder.animatedOrgans.leftArmGroup;
        const armR = this.macroBuilder.animatedOrgans.rightArmGroup;
        if (armL) armL.rotation.z = radShoulder;
        if (armR) armR.rotation.z = -radShoulder;

        // 3. Articulate Knees (Squat around X axis)
        const legL = this.macroBuilder.animatedOrgans.leftLegGroup;
        const legR = this.macroBuilder.animatedOrgans.rightLegGroup;
        if (legL) {
            legL.rotation.x = -radKnee * 0.5;
            legL.position.y = 23 - (this.kneeAngle * 0.08);
        }
        if (legR) {
            legR.rotation.x = -radKnee * 0.5;
            legR.position.y = 23 - (this.kneeAngle * 0.08);
        }

        // 4. Calculate NIOSH Biomechanical Disc Compressive Force at L4-L5
        // F_comp = W_upper * cos(theta) + MuscleMomentArm + LoadMomentArm
        const baseWeightN = 420;
        const flexionMoment = Math.sin(Math.abs(radLumbar)) * 2400; // Erector spinae counter-torque
        const lateralMoment = Math.sin(Math.abs(radLatBend)) * 950;
        const kneeLoadFactor = (this.kneeAngle / 135) * 850;

        this.discCompressionLoadN = Math.round(baseWeightN + flexionMoment + lateralMoment + kneeLoadFactor);

        if (this.elVitalLoad) {
            this.elVitalLoad.innerHTML = `${this.discCompressionLoadN} <small>N</small>`;
            // Warning color if exceeding NIOSH action limit (3400 N)
            if (this.discCompressionLoadN > 3400) {
                this.elVitalLoad.style.color = '#ff1744';
            } else if (this.discCompressionLoadN > 1800) {
                this.elVitalLoad.style.color = '#ffb300';
            } else {
                this.elVitalLoad.style.color = '';
            }
        }

        // 5. Update Muscle Strain Heatmap
        this.updateStrainHeatmaps();
    }

    updateStrainHeatmaps() {
        // Calculate normalized strain index (0.0 to 1.0) based on posture
        const lumbarStrain = Math.min(1.0, Math.abs(this.lumbarAngle) / 60.0);
        const shoulderStrain = Math.min(1.0, this.shoulderAngle / 170.0);
        const kneeStrain = Math.min(1.0, this.kneeAngle / 135.0);
        const maxStrain = Math.max(lumbarStrain, shoulderStrain, kneeStrain);

        // Interpolate color: Green (0x00e676) -> Amber (0xffb300) -> Red (0xff1744)
        let strainColor = new THREE.Color(0x00e676);
        if (maxStrain < 0.5) {
            strainColor.lerp(new THREE.Color(0xffb300), maxStrain * 2);
        } else {
            strainColor = new THREE.Color(0xffb300);
            strainColor.lerp(new THREE.Color(0xff1744), (maxStrain - 0.5) * 2);
        }

        if (this.macroBuilder && this.macroBuilder.animatedOrgans.muscleMeshes) {
            this.macroBuilder.animatedOrgans.muscleMeshes.forEach((mesh) => {
                if (mesh.material && this.macroBuilder.themeMode === 'jarvis') {
                    mesh.material.color.copy(strainColor);
                    mesh.material.emissive.copy(strainColor).multiplyScalar(0.2);
                }
            });
        }
    }
}

window.KinematicsEngine = KinematicsEngine;
