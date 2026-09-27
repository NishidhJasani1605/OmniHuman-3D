// ==========================================================================
// OMNI-HUMAN 3D — Gemini Clinical Diagnostic Mind & Pathology Orchestrator
// 1. Disease Simulation Dispatcher (STEMI, Herniation, Pneumothorax, Cirrhosis)
// 2. Multimodal Clinical AI Decision Support (Pathology, Mechanics, Treatment)
// 3. Anatomical Dossier & FMA Concept Knowledgebase
// ==========================================================================

class ClinicalAIEngine {
    constructor(macroBuilder, physiologyEngine, kinematicsEngine, audioSynth) {
        this.macroBuilder = macroBuilder;
        this.physiologyEngine = physiologyEngine;
        this.kinematicsEngine = kinematicsEngine;
        this.audioSynth = audioSynth;

        // UI elements
        this.selectDisease = document.getElementById('disease-select');
        this.elConfidence = document.getElementById('ai-confidence');
        this.elDiagTitle = document.getElementById('ai-diag-title');
        this.elDiagBody = document.getElementById('ai-diag-body');
        this.elTreatment = document.getElementById('ai-treatment-content');

        this.elStructName = document.getElementById('struct-name');
        this.elStructFma = document.getElementById('struct-fma');
        this.elStructDesc = document.getElementById('struct-desc');
    }

    init() {
        if (this.selectDisease) {
            this.selectDisease.addEventListener('change', (e) => {
                this.applyPathology(e.target.value);
            });
        }
    }

    applyPathology(diseaseKey) {
        if (this.audioSynth) {
            this.audioSynth.playChime();
        }

        // Notify physiology engine
        if (this.physiologyEngine) {
            this.physiologyEngine.setPathology(diseaseKey);
        }

        switch (diseaseKey) {
            case 'stemi':
                this.updateAIDecision(
                    "99.8% Critical",
                    "Pathology: Acute Transmural Anterior STEMI (LAD Occlusion)",
                    "Severe acute occlusion of the Left Anterior Descending (LAD) coronary artery leading to transmural ischemia of the left ventricular anterior wall and septum. Marked hyperacute ST-elevation in precordial leads V1-V4 with reciprocal inferior depressions. Decreased cardiac ejection fraction and acute risk of cardiogenic shock or ventricular fibrillation.",
                    "1. Activate Cardiac Catheterization Lab for immediate Primary Percutaneous Coronary Intervention (PCI, door-to-balloon < 90 min).\n2. Dual Antiplatelet Therapy (DAPT): Aspirin 325 mg chewed + Ticagrelor 180 mg loading dose.\n3. Anticoagulation: Unfractionated Heparin bolus with titrated infusion.\n4. Sublingual nitroglycerin (if systolic BP > 90 mmHg) and high-flow supplemental oxygen if SpO2 < 90%."
                );
                // Highlight heart
                if (this.macroBuilder && this.macroBuilder.animatedOrgans.heart) {
                    this.macroBuilder.animatedOrgans.heart.material.color.setHex(0x990011);
                }
                break;

            case 'herniation':
                this.updateAIDecision(
                    "98.7% High",
                    "Pathology: Posterolateral L4-L5 Lumbar Disc Herniation with S1 Radiculopathy",
                    "Rupture of the annulus fibrosus with extruded nucleus pulposus impinging directly upon the traversing nerve root. Biomechanical telemetry indicates axial compressive force exceeding 1,800 N with protective muscle spasm of the erector spinae and unilateral dermatomal radiating parasthesia.",
                    "1. Lumbar spine MRI (axial and sagittal T1/T2-weighted sequences) to assess canal compromise.\n2. Conservative management: Short-term NSAIDs, muscle relaxants, and physical therapy focused on core stabilization (McKenzie protocol).\n3. Fluoroscopy-guided transforaminal epidural steroid injection (TFESI) if radicular pain persists beyond 6 weeks.\n4. Microdiscectomy surgical decompression indicated if progressive motor deficit or cauda equina syndrome develops."
                );
                // Highlight L4-L5 disc
                if (this.macroBuilder && this.macroBuilder.animatedOrgans.discs[22]) {
                    this.macroBuilder.animatedOrgans.discs[22].material.color.setHex(0xff0033);
                }
                break;

            case 'pneumothorax':
                this.updateAIDecision(
                    "99.9% Emergency",
                    "Pathology: Tension Pneumothorax (Right Hemithorax Collapse)",
                    "One-way valve pleural defect causing progressive air entrapment within the right pleural space. Massive positive intrapleural pressure leads to complete atelectatic collapse of the right lung, contralateral mediastinal shift, compression of the vena cava, and drastic reduction in venous return causing obstructive shock.",
                    "1. Immediate emergency needle decompression: Insert 14-gauge catheter into the 2nd intercostal space in the midclavicular line (or 5th intercostal space anterior axillary line).\n2. Follow immediately with emergent tube thoracostomy (chest drain) with underwater seal.\n3. Continuous supplemental 100% FiO2 oxygen.\n4. Repeat portable chest radiography to confirm re-expansion of pulmonary parenchymal margins."
                );
                break;

            case 'cirrhosis':
                this.updateAIDecision(
                    "97.4% High",
                    "Pathology: Decompensated Hepatic Cirrhosis & Portal Hypertension",
                    "Extensive architectural distortion characterized by bridging fibrosis and regenerative hepatocellular nodules. Splanchnic vasodilation and increased intrahepatic vascular resistance elevate portal venous pressures > 12 mmHg, predisposing to gastroesophageal varices, splenomegaly, and hypoalbuminemia.",
                    "1. Non-selective beta-blockers (Carvedilol / Propranolol) for secondary prophylaxis against variceal bleeding.\n2. Sodium restriction (< 2g/day) with dual diuretic therapy (Spironolactone + Furosemide) for ascites management.\n3. Endoscopic surveillance band ligation for high-risk esophageal varices.\n4. Evaluate for Transjugular Intrahepatic Portosystemic Shunt (TIPS) and orthotopic liver transplantation candidacy."
                );
                break;

            case 'healthy':
            default:
                this.updateAIDecision(
                    "99.4% Optimal",
                    "Pathology: Normal Physiological Equilibrium",
                    "Whole-body physiological parameters are within ideal clinical limits. Cardiac contractility, pulmonary compliance, and musculoskeletal load-distribution demonstrate optimal homeostasis without evidence of structural or ischemic dysfunction.",
                    "Maintain regular aerobic conditioning, core postural stabilization, balanced nutritional intake, and ergonomic spine neutrality during daily sedentary intervals."
                );
                // Reset organ colors
                if (this.macroBuilder && this.macroBuilder.animatedOrgans.heart) {
                    this.macroBuilder.animatedOrgans.heart.material.color.setHex(0xd32f2f);
                }
                break;
        }
    }

    updateAIDecision(confidence, title, body, treatment) {
        if (this.elConfidence) this.elConfidence.textContent = `Confidence: ${confidence}`;
        if (this.elDiagTitle) this.elDiagTitle.textContent = title;
        if (this.elDiagBody) this.elDiagBody.textContent = body;
        if (this.elTreatment) this.elTreatment.textContent = treatment;
    }

    displayOrganDetails(mesh) {
        if (!mesh || !mesh.userData) return;
        const u = mesh.userData;

        if (this.elStructName) this.elStructName.textContent = u.name || "Anatomical Structure";
        if (this.elStructFma) this.elStructFma.textContent = u.fma || "FMA: General";
        if (this.elStructDesc) this.elStructDesc.textContent = u.description || "Anatomical component of the digital human twin.";
    }
}

window.ClinicalAIEngine = ClinicalAIEngine;
