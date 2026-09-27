// ==========================================================================
// OMNI-HUMAN 3D — Macro-Anatomy Procedural & Hierarchical 3D Atlas Builder
// Generates full-body anatomy across all 6 systems:
// 1. Integumentary (Skin envelope)
// 2. Skeletal (Bones, vertebrae, ribs, joints)
// 3. Muscular (Pectorals, abs, lats, quads, deltoids with strain heatmap support)
// 4. Visceral (Heart, lungs, liver, stomach, kidneys, intestines, brain)
// 5. Cardiovascular (Aorta, vena cava, carotids, femorals, coronaries)
// 6. Nervous System (Brain, spinal cord, sciatic nerve, brachial plexus)
// Includes Anatomical Explode Dissection and Organ Isolation Raycasting
// ==========================================================================

class MacroAnatomyBuilder {
    constructor(scene) {
        this.scene = scene;
        this.rootGroup = new THREE.Group();
        this.rootGroup.name = "HumanAtlasRoot";
        this.scene.add(this.rootGroup);

        // System subgroups
        this.groups = {
            skin: new THREE.Group(),
            skeleton: new THREE.Group(),
            muscles: new THREE.Group(),
            viscera: new THREE.Group(),
            cardio: new THREE.Group(),
            nerves: new THREE.Group()
        };

        // Specific animated handles for physiology and kinematics
        this.animatedOrgans = {
            heart: null,
            leftLung: null,
            rightLung: null,
            spineSegments: [],
            discs: [],
            leftArmGroup: null,
            rightArmGroup: null,
            leftLegGroup: null,
            rightLegGroup: null,
            muscleMeshes: []
        };

        // Clickable interactive anatomical parts registry for raycasting
        this.interactiveParts = [];

        // Materials cache
        this.materials = {};
        this.themeMode = 'jarvis'; // 'jarvis' or 'studio'
    }

    init() {
        this.initMaterials();
        
        // Add all sub-system groups to root
        for (const [key, grp] of Object.entries(this.groups)) {
            grp.name = `System_${key}`;
            this.rootGroup.add(grp);
        }

        // Build anatomical components
        this.buildSkeletalSystem();
        this.buildMuscularSystem();
        this.buildVisceralSystem();
        this.buildCardiovascularSystem();
        this.buildNervousSystem();
        this.buildIntegumentarySystem();

        // Center anatomical coordinate frame (feet on y = -90, head at y = +90)
        this.rootGroup.position.set(0, 0, 0);

        console.log(`[MacroAnatomyBuilder] Anatomical systems initialized. Interactive nodes: ${this.interactiveParts.length}`);
    }

    initMaterials() {
        // Base materials that dynamically adapt to theme (Jarvis Cyan/Neon vs Medical Studio Realism)
        this.materials = {
            skinJarvis: new THREE.MeshPhysicalMaterial({
                color: 0x00f0ff,
                transparent: true,
                opacity: 0.18,
                roughness: 0.2,
                metalness: 0.1,
                transmission: 0.7,
                ior: 1.33,
                wireframe: false,
                side: THREE.DoubleSide,
                depthWrite: false
            }),
            skinStudio: new THREE.MeshStandardMaterial({
                color: 0xe0c8b0,
                transparent: true,
                opacity: 0.25,
                roughness: 0.7,
                metalness: 0.05,
                side: THREE.DoubleSide,
                depthWrite: false
            }),
            boneJarvis: new THREE.MeshStandardMaterial({
                color: 0xccf5ff,
                emissive: 0x003344,
                roughness: 0.35,
                metalness: 0.4
            }),
            boneStudio: new THREE.MeshStandardMaterial({
                color: 0xf5f3ea,
                roughness: 0.6,
                metalness: 0.1
            }),
            muscleJarvis: new THREE.MeshStandardMaterial({
                color: 0x00e676, // Greenish safe strain by default
                emissive: 0x002211,
                roughness: 0.4,
                metalness: 0.2
            }),
            muscleStudio: new THREE.MeshStandardMaterial({
                color: 0xa83232,
                roughness: 0.55,
                metalness: 0.15
            }),
            visceraHeart: new THREE.MeshStandardMaterial({
                color: 0xd32f2f,
                roughness: 0.3,
                metalness: 0.2
            }),
            visceraLung: new THREE.MeshStandardMaterial({
                color: 0xec407a,
                roughness: 0.45,
                metalness: 0.1,
                transparent: true,
                opacity: 0.85
            }),
            visceraLiver: new THREE.MeshStandardMaterial({
                color: 0x8d4925,
                roughness: 0.4,
                metalness: 0.15
            }),
            visceraStomach: new THREE.MeshStandardMaterial({
                color: 0xd97757,
                roughness: 0.5,
                metalness: 0.1
            }),
            visceraKidney: new THREE.MeshStandardMaterial({
                color: 0x802a2a,
                roughness: 0.4,
                metalness: 0.2
            }),
            visceraBrain: new THREE.MeshStandardMaterial({
                color: 0xffa07a,
                roughness: 0.6,
                metalness: 0.1
            }),
            visceraIntestines: new THREE.MeshStandardMaterial({
                color: 0xd27d56,
                roughness: 0.5,
                metalness: 0.1
            }),
            artery: new THREE.MeshStandardMaterial({
                color: 0xff1744,
                emissive: 0x550000,
                roughness: 0.25,
                metalness: 0.3
            }),
            vein: new THREE.MeshStandardMaterial({
                color: 0x2979ff,
                emissive: 0x001155,
                roughness: 0.25,
                metalness: 0.3
            }),
            nerve: new THREE.MeshStandardMaterial({
                color: 0xffeb3b,
                emissive: 0x555500,
                roughness: 0.3,
                metalness: 0.2
            })
        };
    }

    registerInteractivePart(mesh, name, system, fma, organGroup, description, explodeDir = new THREE.Vector3()) {
        mesh.userData = {
            name: name,
            system: system,
            fma: fma,
            organGroup: organGroup,
            description: description,
            explodeDir: explodeDir.clone(),
            originalPos: mesh.position.clone(),
            originalScale: mesh.scale.clone()
        };
        this.interactiveParts.push(mesh);
    }

    // =========================================================================
    // 1. SKELETAL SYSTEM
    // =========================================================================
    buildSkeletalSystem() {
        const boneMat = this.themeMode === 'jarvis' ? this.materials.boneJarvis : this.materials.boneStudio;

        // --- Cranium & Skull ---
        const craniumGeo = new THREE.SphereGeometry(6.5, 24, 24);
        craniumGeo.scale(1.0, 1.25, 1.15);
        const cranium = new THREE.Mesh(craniumGeo, boneMat);
        cranium.position.set(0, 78, 0);
        this.groups.skeleton.add(cranium);
        this.registerInteractivePart(
            cranium, "Cranium & Facial Bones", "skeleton", "FMA:46565", "brain",
            "Neurocranium enclosing the encephalon; composed of frontal, parietal, occipital, temporal, and sphenoid bones.",
            new THREE.Vector3(0, 0.4, 0)
        );

        // Mandible (Jaw)
        const mandibleGeo = new THREE.TorusGeometry(3.5, 0.8, 12, 16, Math.PI);
        mandibleGeo.rotateX(Math.PI / 2);
        const mandible = new THREE.Mesh(mandibleGeo, boneMat);
        mandible.position.set(0, 71, 2.5);
        this.groups.skeleton.add(mandible);

        // --- Vertebral Column (C1 - L5 + Sacrum) ---
        const spineGroup = new THREE.Group();
        spineGroup.name = "VertebralColumn";
        this.groups.skeleton.add(spineGroup);

        const totalVertebrae = 24; // 7 Cervical, 12 Thoracic, 5 Lumbar
        const startY = 67;
        const spacing = 1.6;

        for (let i = 0; i < totalVertebrae; i++) {
            const vY = startY - (i * spacing);
            const isLumbar = i >= 19;
            const isCervical = i < 7;
            const r = isLumbar ? 2.6 : (isCervical ? 1.4 : 2.0);

            // Vertebral Body
            const vGeo = new THREE.CylinderGeometry(r, r * 1.05, 1.1, 16);
            const vMesh = new THREE.Mesh(vGeo, boneMat);
            // Spinal curvature (Lordosis / Kyphosis)
            let zCurve = 0;
            if (isCervical) zCurve = Math.sin((i / 7) * Math.PI) * 0.8;
            else if (i < 19) zCurve = -Math.sin(((i - 7) / 12) * Math.PI) * 1.5;
            else zCurve = Math.sin(((i - 19) / 5) * Math.PI) * 1.2;

            vMesh.position.set(0, vY, zCurve - 1.0);
            spineGroup.add(vMesh);

            // Intervertebral Disc
            const discGeo = new THREE.CylinderGeometry(r * 0.95, r * 0.95, 0.4, 16);
            const discMat = new THREE.MeshStandardMaterial({
                color: isLumbar && i === 22 ? 0xff3d00 : 0x81d4fa, // L4-L5 herniation highlight capability
                roughness: 0.3
            });
            const discMesh = new THREE.Mesh(discGeo, discMat);
            discMesh.position.set(0, vY - 0.75, zCurve - 1.0);
            spineGroup.add(discMesh);

            this.animatedOrgans.spineSegments.push(vMesh);
            this.animatedOrgans.discs.push(discMesh);

            if (i === 22) { // L4-L5 disc
                this.registerInteractivePart(
                    discMesh, "L4-L5 Intervertebral Disc", "skeleton", "FMA:13336", "spine",
                    "Fibrocartilaginous joint absorbing axial compressive loads. Primary locus for posterior-lateral lumbar disc herniation and sciatica.",
                    new THREE.Vector3(0, 0, -0.3)
                );
            }
        }

        // --- Pelvis (Ilium, Ischium, Sacrum) ---
        const pelvisGroup = new THREE.Group();
        pelvisGroup.position.set(0, 27, 0);

        const sacrumGeo = new THREE.ConeGeometry(3.5, 6, 8);
        sacrumGeo.rotateX(Math.PI);
        const sacrum = new THREE.Mesh(sacrumGeo, boneMat);
        sacrum.position.set(0, 0, -2);
        pelvisGroup.add(sacrum);

        // Left & Right Iliac Blades
        const iliumLGeo = new THREE.TorusGeometry(5.5, 1.4, 12, 20, Math.PI * 0.85);
        iliumLGeo.rotateZ(Math.PI / 4);
        const iliumL = new THREE.Mesh(iliumLGeo, boneMat);
        iliumL.position.set(-6, -1, 0);
        pelvisGroup.add(iliumL);

        const iliumRGeo = new THREE.TorusGeometry(5.5, 1.4, 12, 20, Math.PI * 0.85);
        iliumRGeo.rotateZ(-Math.PI / 4);
        iliumRGeo.rotateY(Math.PI);
        const iliumR = new THREE.Mesh(iliumRGeo, boneMat);
        iliumR.position.set(6, -1, 0);
        pelvisGroup.add(iliumR);

        this.groups.skeleton.add(pelvisGroup);
        this.registerInteractivePart(
            sacrum, "Pelvis & Sacral Base", "skeleton", "FMA:16580", "spine",
            "Pelvic girdle supporting visceral weight and transferring upper-body spinal compressive vectors to femoral acetabular joints.",
            new THREE.Vector3(0, -0.2, 0)
        );

        // --- Thoracic Ribcage & Sternum ---
        const ribCageGroup = new THREE.Group();
        ribCageGroup.name = "ThoracicCage";
        ribCageGroup.position.set(0, 52, 0);

        // Sternum (Chest bone)
        const sternumGeo = new THREE.BoxGeometry(2.2, 14, 0.9);
        const sternum = new THREE.Mesh(sternumGeo, boneMat);
        sternum.position.set(0, 0, 7.5);
        ribCageGroup.add(sternum);

        // 10 pairs of ribs
        for (let r = 0; r < 10; r++) {
            const ribY = 6.0 - (r * 1.3);
            const ribRadius = 6.8 + Math.sin((r / 10) * Math.PI) * 3.2;

            // Half-ring curves for left and right rib cages
            const ribGeo = new THREE.TorusGeometry(ribRadius, 0.45, 8, 20, Math.PI * 0.82);
            ribGeo.rotateX(Math.PI / 2.2);

            const ribL = new THREE.Mesh(ribGeo, boneMat);
            ribL.position.set(-0.5, ribY, 0.5);
            ribL.rotation.z = 0.15;
            ribCageGroup.add(ribL);

            const ribR = new THREE.Mesh(ribGeo, boneMat);
            ribR.position.set(0.5, ribY, 0.5);
            ribR.rotation.y = Math.PI;
            ribR.rotation.z = -0.15;
            ribCageGroup.add(ribR);
        }
        this.groups.skeleton.add(ribCageGroup);

        // --- Upper Extremities (Clavicles, Humerus, Forearms) ---
        // Left Arm
        this.animatedOrgans.leftArmGroup = new THREE.Group();
        this.animatedOrgans.leftArmGroup.position.set(13.5, 60, 0);

        const humerusLGeo = new THREE.CylinderGeometry(1.2, 1.4, 21, 16);
        const humerusL = new THREE.Mesh(humerusLGeo, boneMat);
        humerusL.position.set(0, -10.5, 0);
        this.animatedOrgans.leftArmGroup.add(humerusL);

        const forearmLGeo = new THREE.CylinderGeometry(1.0, 1.1, 19, 16);
        const forearmL = new THREE.Mesh(forearmLGeo, boneMat);
        forearmL.position.set(0, -30, 0);
        this.animatedOrgans.leftArmGroup.add(forearmL);
        this.groups.skeleton.add(this.animatedOrgans.leftArmGroup);

        // Right Arm
        this.animatedOrgans.rightArmGroup = new THREE.Group();
        this.animatedOrgans.rightArmGroup.position.set(-13.5, 60, 0);

        const humerusR = new THREE.Mesh(humerusLGeo, boneMat);
        humerusR.position.set(0, -10.5, 0);
        this.animatedOrgans.rightArmGroup.add(humerusR);

        const forearmR = new THREE.Mesh(forearmLGeo, boneMat);
        forearmR.position.set(0, -30, 0);
        this.animatedOrgans.rightArmGroup.add(forearmR);
        this.groups.skeleton.add(this.animatedOrgans.rightArmGroup);

        // --- Lower Extremities (Femur, Tibia, Fibula) ---
        // Left Leg
        this.animatedOrgans.leftLegGroup = new THREE.Group();
        this.animatedOrgans.leftLegGroup.position.set(6.5, 23, 0);

        const femurGeo = new THREE.CylinderGeometry(2.0, 2.3, 34, 16);
        const femurL = new THREE.Mesh(femurGeo, boneMat);
        femurL.position.set(0, -17, 0);
        this.animatedOrgans.leftLegGroup.add(femurL);

        const tibiaGeo = new THREE.CylinderGeometry(1.7, 1.9, 32, 16);
        const tibiaL = new THREE.Mesh(tibiaGeo, boneMat);
        tibiaL.position.set(0, -50, 0);
        this.animatedOrgans.leftLegGroup.add(tibiaL);
        this.groups.skeleton.add(this.animatedOrgans.leftLegGroup);

        // Right Leg
        this.animatedOrgans.rightLegGroup = new THREE.Group();
        this.animatedOrgans.rightLegGroup.position.set(-6.5, 23, 0);

        const femurR = new THREE.Mesh(femurGeo, boneMat);
        femurR.position.set(0, -17, 0);
        this.animatedOrgans.rightLegGroup.add(femurR);

        const tibiaR = new THREE.Mesh(tibiaGeo, boneMat);
        tibiaR.position.set(0, -50, 0);
        this.animatedOrgans.rightLegGroup.add(tibiaR);
        this.groups.skeleton.add(this.animatedOrgans.rightLegGroup);
    }

    // =========================================================================
    // 2. MUSCULAR SYSTEM (With strain heatmap coloring)
    // =========================================================================
    buildMuscularSystem() {
        const muscleMat = this.themeMode === 'jarvis' ? this.materials.muscleJarvis : this.materials.muscleStudio;

        // Pectoralis Major (Chest)
        const pecLGeo = new THREE.BoxGeometry(7.5, 6.0, 3.2);
        pecLGeo.rotateZ(0.2);
        const pecL = new THREE.Mesh(pecLGeo, muscleMat.clone());
        pecL.position.set(5.5, 54, 6.5);
        this.groups.muscles.add(pecL);
        this.animatedOrgans.muscleMeshes.push(pecL);
        this.registerInteractivePart(
            pecL, "Left Pectoralis Major", "muscles", "FMA:9625", "full",
            "Thick fan-shaped muscle of the anterior chest wall; adducts and medially rotates the humerus.",
            new THREE.Vector3(0.3, 0, 0.4)
        );

        const pecRGeo = new THREE.BoxGeometry(7.5, 6.0, 3.2);
        pecRGeo.rotateZ(-0.2);
        const pecR = new THREE.Mesh(pecRGeo, muscleMat.clone());
        pecR.position.set(-5.5, 54, 6.5);
        this.groups.muscles.add(pecR);
        this.animatedOrgans.muscleMeshes.push(pecR);
        this.registerInteractivePart(
            pecR, "Right Pectoralis Major", "muscles", "FMA:9625", "full",
            "Thick fan-shaped muscle of the anterior chest wall; adducts and medially rotates the humerus.",
            new THREE.Vector3(-0.3, 0, 0.4)
        );

        // Rectus Abdominis (Six-Pack Core)
        const absGeo = new THREE.BoxGeometry(7.0, 15.0, 2.5);
        const absMesh = new THREE.Mesh(absGeo, muscleMat.clone());
        absMesh.position.set(0, 40, 6.2);
        this.groups.muscles.add(absMesh);
        this.animatedOrgans.muscleMeshes.push(absMesh);
        this.registerInteractivePart(
            absMesh, "Rectus Abdominis", "muscles", "FMA:9628", "full",
            "Paired vertical core muscle; flexes the trunk and compresses abdominal viscera during physical exertion.",
            new THREE.Vector3(0, 0, 0.5)
        );

        // Deltoids (Shoulders)
        const deltGeo = new THREE.SphereGeometry(3.6, 16, 16);
        deltGeo.scale(1.1, 1.4, 1.0);

        const deltL = new THREE.Mesh(deltGeo, muscleMat.clone());
        deltL.position.set(13.8, 60, 0);
        this.groups.muscles.add(deltL);
        this.animatedOrgans.muscleMeshes.push(deltL);

        const deltR = new THREE.Mesh(deltGeo, muscleMat.clone());
        deltR.position.set(-13.8, 60, 0);
        this.groups.muscles.add(deltR);
        this.animatedOrgans.muscleMeshes.push(deltR);

        // Quadriceps Femoris (Thighs)
        const quadGeo = new THREE.CylinderGeometry(3.4, 2.8, 25, 16);
        const quadL = new THREE.Mesh(quadGeo, muscleMat.clone());
        quadL.position.set(6.5, 8, 2);
        this.groups.muscles.add(quadL);
        this.animatedOrgans.muscleMeshes.push(quadL);
        this.registerInteractivePart(
            quadL, "Quadriceps Femoris (Rectus Femoris)", "muscles", "FMA:22428", "full",
            "Primary knee extensor and hip flexor; essential for locomotion, squats, and bipedal vertical stance.",
            new THREE.Vector3(0.3, 0, 0.2)
        );

        const quadR = new THREE.Mesh(quadGeo, muscleMat.clone());
        quadR.position.set(-6.5, 8, 2);
        this.groups.muscles.add(quadR);
        this.animatedOrgans.muscleMeshes.push(quadR);

        // Latissimus Dorsi & Trapezius (Back)
        const latGeo = new THREE.BoxGeometry(16, 18, 2.5);
        const latMesh = new THREE.Mesh(latGeo, muscleMat.clone());
        latMesh.position.set(0, 48, -5.5);
        this.groups.muscles.add(latMesh);
        this.animatedOrgans.muscleMeshes.push(latMesh);
        this.registerInteractivePart(
            latMesh, "Latissimus Dorsi & Thoracolumbar Fascia", "muscles", "FMA:9626", "spine",
            "Broadest back muscle providing lumbar spine stability and humerus extension during pulling vectors.",
            new THREE.Vector3(0, 0, -0.4)
        );
    }

    // =========================================================================
    // 3. VISCERAL SYSTEM (Internal Organs)
    // =========================================================================
    buildVisceralSystem() {
        // --- Brain ---
        const brainGroup = new THREE.Group();
        brainGroup.position.set(0, 78, 0);

        const hemiGeo = new THREE.SphereGeometry(4.8, 20, 20);
        hemiGeo.scale(0.85, 1.15, 1.25);

        const leftHemi = new THREE.Mesh(hemiGeo, this.materials.visceraBrain);
        leftHemi.position.set(-2.2, 0, 0);
        brainGroup.add(leftHemi);

        const rightHemi = new THREE.Mesh(hemiGeo, this.materials.visceraBrain);
        rightHemi.position.set(2.2, 0, 0);
        brainGroup.add(rightHemi);

        // Cerebellum
        const cerebGeo = new THREE.SphereGeometry(3.0, 16, 16);
        cerebGeo.scale(1.2, 0.7, 0.9);
        const cerebellum = new THREE.Mesh(cerebGeo, this.materials.visceraBrain);
        cerebellum.position.set(0, -3.2, -2.8);
        brainGroup.add(cerebellum);

        this.groups.viscera.add(brainGroup);
        this.registerInteractivePart(
            brainGroup, "Encephalon (Human Brain)", "viscera", "FMA:50801", "brain",
            "Central processing organ consisting of cerebral hemispheres, cerebellum, and brainstem. Contains ~86 billion neurons.",
            new THREE.Vector3(0, 0.5, 0)
        );

        // --- Heart ---
        const heartGroup = new THREE.Group();
        heartGroup.name = "CardiacOrgan";
        heartGroup.position.set(-1.8, 51, 2.5); // Tilted left in mediastinum

        const heartVentGeo = new THREE.ConeGeometry(4.2, 7.5, 20);
        heartVentGeo.rotateX(Math.PI * 0.9);
        heartVentGeo.rotateZ(0.25);
        const heartMesh = new THREE.Mesh(heartVentGeo, this.materials.visceraHeart);
        heartGroup.add(heartMesh);

        // Aortic Arch originating from heart
        const archCurve = new THREE.CatmullRomCurve3([
            new THREE.Vector3(0, 3, 0),
            new THREE.Vector3(0, 6, 0.5),
            new THREE.Vector3(-1.5, 7.5, -0.5),
            new THREE.Vector3(-2.0, 5, -2)
        ]);
        const archGeo = new THREE.TubeGeometry(archCurve, 20, 1.0, 12, false);
        const archMesh = new THREE.Mesh(archGeo, this.materials.artery);
        heartGroup.add(archMesh);

        this.groups.viscera.add(heartGroup);
        this.animatedOrgans.heart = heartMesh; // Animated by physiologyEngine
        this.registerInteractivePart(
            heartGroup, "Heart (Myocardium & Ventricles)", "viscera", "FMA:7088", "heart",
            "Four-chambered muscular pump generating stroke volume of ~70 mL/beat. Primary site of ischemic coronary syndromes (STEMI).",
            new THREE.Vector3(-0.3, 0, 0.5)
        );

        // --- Lungs (Pulmonary) ---
        const lungMat = this.materials.visceraLung;

        // Left Lung (2 lobes, cardiac notch)
        const leftLungGeo = new THREE.SphereGeometry(5.2, 20, 20);
        leftLungGeo.scale(0.8, 1.9, 0.9);
        const leftLung = new THREE.Mesh(leftLungGeo, lungMat);
        leftLung.position.set(6.5, 52, 1.0);
        this.groups.viscera.add(leftLung);
        this.animatedOrgans.leftLung = leftLung;
        this.registerInteractivePart(
            leftLung, "Left Pulmonary Lung (Superior & Inferior Lobes)", "viscera", "FMA:7310", "lungs",
            "Bilateral respiratory organ facilitating alveolar gas exchange; features cardiac impression notch accommodate the pericardium.",
            new THREE.Vector3(0.5, 0, 0.2)
        );

        // Right Lung (3 lobes, larger)
        const rightLungGeo = new THREE.SphereGeometry(5.8, 20, 20);
        rightLungGeo.scale(0.85, 1.9, 0.95);
        const rightLung = new THREE.Mesh(rightLungGeo, lungMat);
        rightLung.position.set(-6.5, 52, 1.0);
        this.groups.viscera.add(rightLung);
        this.animatedOrgans.rightLung = rightLung;
        this.registerInteractivePart(
            rightLung, "Right Pulmonary Lung (Tri-Lobar)", "viscera", "FMA:7309", "lungs",
            "Consists of superior, middle, and inferior lobes separated by horizontal and oblique fissures. Susceptible to pneumothorax collapse.",
            new THREE.Vector3(-0.5, 0, 0.2)
        );

        // --- Liver (Hepatic) ---
        const liverGeo = new THREE.ConeGeometry(8.5, 7.0, 16);
        liverGeo.scale(1.2, 0.8, 0.9);
        liverGeo.rotateZ(Math.PI * 0.4);
        liverGeo.rotateX(-0.3);
        const liverMesh = new THREE.Mesh(liverGeo, this.materials.visceraLiver);
        liverMesh.position.set(-4.0, 41, 2.5);
        this.groups.viscera.add(liverMesh);
        this.registerInteractivePart(
            liverMesh, "Liver (Hepatic Parenchyma)", "viscera", "FMA:7197", "liver",
            "Largest internal organ; central metabolic hub for xenobiotic detoxification, albumin synthesis, bile production, and glycogen storage.",
            new THREE.Vector3(-0.4, 0, 0.4)
        );

        // --- Stomach (Gastric) ---
        const stomachCurve = new THREE.CatmullRomCurve3([
            new THREE.Vector3(0, 43, 1),
            new THREE.Vector3(3.5, 41, 2.5),
            new THREE.Vector3(4.5, 36, 2.5),
            new THREE.Vector3(1.5, 35, 2.0)
        ]);
        const stomachGeo = new THREE.TubeGeometry(stomachCurve, 20, 2.6, 16, false);
        const stomachMesh = new THREE.Mesh(stomachGeo, this.materials.visceraStomach);
        this.groups.viscera.add(stomachMesh);
        this.registerInteractivePart(
            stomachMesh, "Stomach (Gaster & Pyloric Antrum)", "viscera", "FMA:7148", "stomach",
            "J-shaped digestive reservoir performing hydrochloric acid secretion and enzymatic protein denaturation via pepsinogen.",
            new THREE.Vector3(0.4, 0, 0.4)
        );

        // --- Kidneys & Adrenals (Renal) ---
        const kidneyGeo = new THREE.SphereGeometry(2.4, 16, 16);
        kidneyGeo.scale(0.8, 1.4, 0.7);

        const leftKidney = new THREE.Mesh(kidneyGeo, this.materials.visceraKidney);
        leftKidney.position.set(5.2, 38, -2.5);
        this.groups.viscera.add(leftKidney);
        this.registerInteractivePart(
            leftKidney, "Left Kidney (Renal Cortex & Medulla)", "viscera", "FMA:7207", "kidneys",
            "Retroperitoneal filtration unit filtering ~180 L plasma daily via 1 million nephrons to regulate electrolytes and blood pressure.",
            new THREE.Vector3(0.4, 0, -0.3)
        );

        const rightKidney = new THREE.Mesh(kidneyGeo, this.materials.visceraKidney);
        rightKidney.position.set(-5.2, 36.5, -2.5); // Slightly lower due to liver
        this.groups.viscera.add(rightKidney);
        this.registerInteractivePart(
            rightKidney, "Right Kidney", "viscera", "FMA:7206", "kidneys",
            "Regulates renin-angiotensin-aldosterone axis and erythropoietin secretion.",
            new THREE.Vector3(-0.4, 0, -0.3)
        );

        // --- Intestinal Coils ---
        const intestineGeo = new THREE.TorusGeometry(5.0, 2.2, 16, 24);
        intestineGeo.scale(1.1, 0.9, 0.8);
        const intestineMesh = new THREE.Mesh(intestineGeo, this.materials.visceraIntestines);
        intestineMesh.position.set(0, 31, 3.0);
        this.groups.viscera.add(intestineMesh);
        this.registerInteractivePart(
            intestineMesh, "Small & Large Intestines", "viscera", "FMA:7199", "full",
            "Extensive mucosal surface for nutrient absorption, water resorption, and enteric microbiome homeostasis.",
            new THREE.Vector3(0, -0.3, 0.4)
        );
    }

    // =========================================================================
    // 4. CARDIOVASCULAR SYSTEM (Arteries & Veins)
    // =========================================================================
    buildCardiovascularSystem() {
        // Thoracic and Abdominal Aorta
        const aortaCurve = new THREE.CatmullRomCurve3([
            new THREE.Vector3(-0.5, 57, -0.5),
            new THREE.Vector3(-0.6, 45, -1.2),
            new THREE.Vector3(-0.4, 34, -1.2),
            new THREE.Vector3(0, 27, -1.0)
        ]);
        const aortaGeo = new THREE.TubeGeometry(aortaCurve, 24, 0.85, 12, false);
        const aortaMesh = new THREE.Mesh(aortaGeo, this.materials.artery);
        this.groups.cardio.add(aortaMesh);
        this.registerInteractivePart(
            aortaMesh, "Descending Thoracic & Abdominal Aorta", "cardio", "FMA:3788", "heart",
            "High-pressure conduit distributing oxygenated stroke volume to visceral arteries and common iliac branches.",
            new THREE.Vector3(0, 0, 0.2)
        );

        // Inferior Vena Cava
        const ivcCurve = new THREE.CatmullRomCurve3([
            new THREE.Vector3(0.8, 55, -0.6),
            new THREE.Vector3(0.9, 44, -1.0),
            new THREE.Vector3(0.7, 33, -1.0),
            new THREE.Vector3(0.2, 27, -0.9)
        ]);
        const ivcGeo = new THREE.TubeGeometry(ivcCurve, 24, 0.95, 12, false);
        const ivcMesh = new THREE.Mesh(ivcGeo, this.materials.vein);
        this.groups.cardio.add(ivcMesh);

        // Common Carotid Arteries (Up to head)
        const carotidLCurve = new THREE.CatmullRomCurve3([
            new THREE.Vector3(-1.5, 59, 0),
            new THREE.Vector3(-2.2, 68, 1.2),
            new THREE.Vector3(-2.5, 75, 1.0)
        ]);
        const carotidL = new THREE.Mesh(new THREE.TubeGeometry(carotidLCurve, 16, 0.45, 8, false), this.materials.artery);
        this.groups.cardio.add(carotidL);

        const carotidRCurve = new THREE.CatmullRomCurve3([
            new THREE.Vector3(1.5, 59, 0),
            new THREE.Vector3(2.2, 68, 1.2),
            new THREE.Vector3(2.5, 75, 1.0)
        ]);
        const carotidR = new THREE.Mesh(new THREE.TubeGeometry(carotidRCurve, 16, 0.45, 8, false), this.materials.artery);
        this.groups.cardio.add(carotidR);

        // Femoral Arteries (Down into legs)
        const femoralLCurve = new THREE.CatmullRomCurve3([
            new THREE.Vector3(0, 27, -1.0),
            new THREE.Vector3(4.5, 20, 0.5),
            new THREE.Vector3(5.5, 0, 0.8),
            new THREE.Vector3(5.0, -25, 0.2)
        ]);
        const femoralL = new THREE.Mesh(new THREE.TubeGeometry(femoralLCurve, 24, 0.6, 8, false), this.materials.artery);
        this.groups.cardio.add(femoralL);

        const femoralRCurve = new THREE.CatmullRomCurve3([
            new THREE.Vector3(0, 27, -1.0),
            new THREE.Vector3(-4.5, 20, 0.5),
            new THREE.Vector3(-5.5, 0, 0.8),
            new THREE.Vector3(-5.0, -25, 0.2)
        ]);
        const femoralR = new THREE.Mesh(new THREE.TubeGeometry(femoralRCurve, 24, 0.6, 8, false), this.materials.artery);
        this.groups.cardio.add(femoralR);
    }

    // =========================================================================
    // 5. NERVOUS SYSTEM
    // =========================================================================
    buildNervousSystem() {
        // Spinal Cord running down vertebral canal
        const cordCurve = new THREE.CatmullRomCurve3([
            new THREE.Vector3(0, 72, 0),
            new THREE.Vector3(0, 60, -1.0),
            new THREE.Vector3(0, 45, -2.2),
            new THREE.Vector3(0, 32, -1.0)
        ]);
        const cordGeo = new THREE.TubeGeometry(cordCurve, 32, 0.75, 12, false);
        const cordMesh = new THREE.Mesh(cordGeo, this.materials.nerve);
        this.groups.nerves.add(cordMesh);
        this.registerInteractivePart(
            cordMesh, "Medulla Spinalis (Spinal Cord)", "nerves", "FMA:7647", "spine",
            "Primary cylindrical neurological transmission pathway connecting cerebral motor/sensory cortices to the peripheral nervous system.",
            new THREE.Vector3(0, 0, -0.3)
        );

        // Sciatic Nerves (descending through greater sciatic foramen into dorsal thighs)
        const sciaticLCurve = new THREE.CatmullRomCurve3([
            new THREE.Vector3(1.5, 27, -1.5),
            new THREE.Vector3(5.0, 18, -2.0),
            new THREE.Vector3(5.8, 2, -1.8),
            new THREE.Vector3(5.2, -22, -1.5)
        ]);
        const sciaticL = new THREE.Mesh(new THREE.TubeGeometry(sciaticLCurve, 24, 0.45, 8, false), this.materials.nerve);
        this.groups.nerves.add(sciaticL);
        this.registerInteractivePart(
            sciaticL, "Left Sciatic Nerve (Nervus Ischiadicus)", "nerves", "FMA:19036", "spine",
            "Thickest individual nerve in the human body; subject to compression, radiculopathy, and shooting pain during L4-S1 disc herniations.",
            new THREE.Vector3(0.3, 0, -0.3)
        );

        const sciaticRCurve = new THREE.CatmullRomCurve3([
            new THREE.Vector3(-1.5, 27, -1.5),
            new THREE.Vector3(-5.0, 18, -2.0),
            new THREE.Vector3(-5.8, 2, -1.8),
            new THREE.Vector3(-5.2, -22, -1.5)
        ]);
        const sciaticR = new THREE.Mesh(new THREE.TubeGeometry(sciaticRCurve, 24, 0.45, 8, false), this.materials.nerve);
        this.groups.nerves.add(sciaticR);
    }

    // =========================================================================
    // 6. INTEGUMENTARY SYSTEM (Skin Translucent Envelope)
    // =========================================================================
    buildIntegumentarySystem() {
        const skinMat = this.themeMode === 'jarvis' ? this.materials.skinJarvis : this.materials.skinStudio;

        // Torso & Pelvis Capsule
        const torsoGeo = new THREE.CylinderGeometry(11.5, 9.8, 48, 24);
        torsoGeo.scale(1.15, 1.0, 0.75);
        const torsoSkin = new THREE.Mesh(torsoGeo, skinMat);
        torsoSkin.position.set(0, 45, 0);
        this.groups.skin.add(torsoSkin);

        // Head & Neck
        const headGeo = new THREE.SphereGeometry(7.5, 24, 24);
        headGeo.scale(1.0, 1.3, 1.15);
        const headSkin = new THREE.Mesh(headGeo, skinMat);
        headSkin.position.set(0, 77, 0);
        this.groups.skin.add(headSkin);

        const neckGeo = new THREE.CylinderGeometry(4.2, 5.0, 8, 20);
        const neckSkin = new THREE.Mesh(neckGeo, skinMat);
        neckSkin.position.set(0, 67, 0);
        this.groups.skin.add(neckSkin);

        // Arms Skin
        const armGeo = new THREE.CylinderGeometry(2.4, 1.8, 48, 16);
        const armSkinL = new THREE.Mesh(armGeo, skinMat);
        armSkinL.position.set(14.5, 38, 0);
        this.groups.skin.add(armSkinL);

        const armSkinR = new THREE.Mesh(armGeo, skinMat);
        armSkinR.position.set(-14.5, 38, 0);
        this.groups.skin.add(armSkinR);

        // Legs Skin
        const legGeo = new THREE.CylinderGeometry(4.2, 2.6, 68, 20);
        const legSkinL = new THREE.Mesh(legGeo, skinMat);
        legSkinL.position.set(6.5, -12, 0);
        this.groups.skin.add(legSkinL);

        const legSkinR = new THREE.Mesh(legGeo, skinMat);
        legSkinR.position.set(-6.5, -12, 0);
        this.groups.skin.add(legSkinR);
    }

    // =========================================================================
    // CONTROLS & INTERACTIONS
    // =========================================================================

    setLayerVisibility(layerKey, visible) {
        if (this.groups[layerKey]) {
            this.groups[layerKey].visible = visible;
        }
    }

    setLayerOpacity(layerKey, opacity) {
        if (!this.groups[layerKey]) return;
        this.groups[layerKey].traverse((child) => {
            if (child.isMesh && child.material) {
                child.material.transparent = opacity < 1.0;
                child.material.opacity = opacity;
                child.material.needsUpdate = true;
            }
        });
    }

    setExplodeFactor(factor0to1) {
        // Dissects organs radially outward based on their anatomical vector
        const distanceMultiplier = 28.0 * factor0to1;
        this.interactiveParts.forEach((part) => {
            const dir = part.userData.explodeDir;
            if (dir) {
                part.position.x = part.userData.originalPos.x + dir.x * distanceMultiplier;
                part.position.y = part.userData.originalPos.y + dir.y * distanceMultiplier;
                part.position.z = part.userData.originalPos.z + dir.z * distanceMultiplier;
            }
        });
    }

    focusOrganGroup(organGroup) {
        if (organGroup === "full") {
            // Restore all
            for (const key of Object.keys(this.groups)) {
                this.groups[key].visible = true;
            }
            this.interactiveParts.forEach((part) => {
                if (part.material) {
                    part.material.wireframe = false;
                    part.visible = true;
                }
            });
            return;
        }

        // Highlight targeted group, ghost the rest
        this.interactiveParts.forEach((part) => {
            const matches = part.userData.organGroup === organGroup;
            if (part.material) {
                if (matches) {
                    part.visible = true;
                    if (part.material.opacity !== undefined) part.material.opacity = 1.0;
                } else {
                    part.visible = false;
                }
            }
        });

        // Always keep skeletal spine visible if focusing on spine
        if (organGroup === "spine") {
            this.groups.skeleton.visible = true;
            this.groups.nerves.visible = true;
        }
    }

    setTheme(themeName) {
        this.themeMode = themeName;
        const isJarvis = themeName === 'jarvis';

        // Update skin
        this.groups.skin.traverse((child) => {
            if (child.isMesh) child.material = isJarvis ? this.materials.skinJarvis : this.materials.skinStudio;
        });

        // Update skeleton
        this.groups.skeleton.traverse((child) => {
            if (child.isMesh && !child.name.includes("disc")) {
                child.material = isJarvis ? this.materials.boneJarvis : this.materials.boneStudio;
            }
        });

        // Update muscles
        this.animatedOrgans.muscleMeshes.forEach((mesh) => {
            mesh.material = isJarvis ? this.materials.muscleJarvis.clone() : this.materials.muscleStudio.clone();
        });
    }
}

window.MacroAnatomyBuilder = MacroAnatomyBuilder;
