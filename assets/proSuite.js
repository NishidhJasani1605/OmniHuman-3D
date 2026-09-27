/**
 * JARVIS HOLO-DECK - TONY STARK HOLOGRAPHIC LABORATORY
 * Cinematic Dark Obsidian Space, Luminous Neon Shaders, Flowing Blood Streams,
 * Neural Action Potentials, Ambient Holo-Particles & Streamlined Jarvis HUD.
 */

(function () {
  'use strict';

  let core = null; // window.__ATLAS_CORE__
  let isMuted = false;
  let bioEnergyActive = true;
  let cinematicTourActive = false;
  let tourAngle = 0;
  let lastTrackedPartId = null;

  // Web Audio Context for synthesized sound FX
  let audioCtx = null;
  function getAudioContext() {
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

  function playJarvisChime() {
    playTone(1046.5, 0.12, 'sine', 0.25); // C6
    setTimeout(() => playTone(1568.0, 0.25, 'sine', 0.3), 80); // G6
  }

  function playLubDub() {
    if (isMuted || !bioEnergyActive) return;
    try {
      const ctx = getAudioContext();
      if (!ctx) return;
      const now = ctx.currentTime;
      // S1
      const osc1 = ctx.createOscillator();
      const gain1 = ctx.createGain();
      osc1.frequency.setValueAtTime(80, now);
      osc1.frequency.exponentialRampToValueAtTime(45, now + 0.12);
      gain1.gain.setValueAtTime(0.28, now);
      gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
      osc1.connect(gain1);
      gain1.connect(ctx.destination);
      osc1.start(now);
      osc1.stop(now + 0.12);
      // S2
      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      osc2.frequency.setValueAtTime(110, now + 0.16);
      osc2.frequency.exponentialRampToValueAtTime(60, now + 0.25);
      gain2.gain.setValueAtTime(0.22, now + 0.16);
      gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
      osc2.connect(gain2);
      gain2.connect(ctx.destination);
      osc2.start(now + 0.16);
      osc2.stop(now + 0.25);
    } catch (e) {}
  }

  // =========================================================================
  // 1. HOLO-ENGINE: ENVIRONMENT, SHADERS & LIGHTING
  // =========================================================================
  const HoloEngine = {
    heartParts: [],
    lungParts: [],
    arterialParts: [],
    neuralParts: [],
    heartCentroid: null,
    lungCentroid: null,
    particleMesh: null,
    particlePositions: null,
    particleSpeeds: null,
    time: 0,
    lastBeatTime: 0,

    init() {
      if (!core) return;
      const { renderer, scene, atlas, centers, mats, THREE } = core;

      // 1. Deep Obsidian Sci-Fi Backdrop
      renderer.setClearColor(0x05070e, 1.0);
      scene.background = new THREE.Color(0x05070e);

      // 2. Cinematic Sci-Fi Lighting: re-tune existing lights in scene
      scene.children.forEach(child => {
        if (child.isDirectionalLight) {
          if (child.position.x < 0) {
            child.color.setHex(0x00f0ff);
            child.intensity = 2.8;
          } else {
            child.color.setHex(0xd946ef);
            child.intensity = 2.5;
          }
        } else if (child.isHemisphereLight || child.isAmbientLight) {
          child.color.setHex(0x0a1530);
          child.intensity = 1.4;
        }
      });

      // 3. Cybernetic Pedestal Laser Rings
      this.createPedestalGrid(THREE, scene);

      // 4. Ambient Holo-Particle Swarm
      this.createParticleSwarm(THREE, scene);

      // 5. Bioluminescent Holographic Material Upgrades
      this.upgradeMaterials(mats);

      // 6. Identify Anatomical Systems
      const hParts = [];
      const lParts = [];
      const aParts = [];
      const nParts = [];
      let hSum = { x: 0, y: 0, z: 0 };
      let lSum = { x: 0, y: 0, z: 0 };

      atlas.parts.forEach((p, idx) => {
        const name = p.name.toLowerCase();
        const sys = p.system;
        const c = centers[idx];

        if (sys === 'cardiac' || name.includes('heart') || name.includes('ventricle') || name.includes('atrium') || name.includes('aorta')) {
          hParts.push(idx);
          hSum.x += c.x; hSum.y += c.y; hSum.z += c.z;
        }
        if (sys === 'respiratory' || name.includes('lung') || name.includes('bronch') || name.includes('trachea')) {
          lParts.push(idx);
          lSum.x += c.x; lSum.y += c.y; lSum.z += c.z;
        }
        if (sys === 'arterial' || name.includes('artery') || name.includes('carotid') || name.includes('femoral')) {
          aParts.push(idx);
        }
        if (sys === 'nervous' || name.includes('brain') || name.includes('spinal') || name.includes('nerve')) {
          nParts.push(idx);
        }
      });

      this.heartParts = hParts;
      this.lungParts = lParts;
      this.arterialParts = aParts;
      this.neuralParts = nParts;

      if (hParts.length > 0) {
        this.heartCentroid = {
          x: hSum.x / hParts.length,
          y: hSum.y / hParts.length,
          z: hSum.z / hParts.length
        };
      } else {
        this.heartCentroid = { x: 0.02, y: 1.28, z: -0.01 };
      }

      if (lParts.length > 0) {
        this.lungCentroid = {
          x: lSum.x / lParts.length,
          y: lSum.y / lParts.length,
          z: lSum.z / lParts.length
        };
      } else {
        this.lungCentroid = { x: 0, y: 1.30, z: 0 };
      }

      core.markDirty();
    },

    createPedestalGrid(THREE, scene) {
      const ringGroup = new THREE.Group();
      const ringRadii = [0.45, 0.65, 0.85, 1.05];
      ringRadii.forEach((r, idx) => {
        const pts = [];
        const seg = 64;
        for (let i = 0; i <= seg; i++) {
          const theta = (i / seg) * Math.PI * 2;
          pts.push(Math.cos(theta) * r, 0, Math.sin(theta) * r);
        }
        const geo = new THREE.BufferGeometry();
        geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(pts), 3));
        const mat = new THREE.MeshStandardMaterial({
          color: idx % 2 === 0 ? 0x00f0ff : 0x0ea5e9,
          emissive: idx % 2 === 0 ? 0x00f0ff : 0x0284c7,
          wireframe: true,
          transparent: true,
          opacity: 0.35 - idx * 0.06
        });
        const ring = new THREE.Mesh(geo, mat);
        ring.position.y = 0.002;
        ringGroup.add(ring);
      });
      scene.add(ringGroup);
    },

    createParticleSwarm(THREE, scene) {
      const pCount = 140;
      const positions = new Float32Array(pCount * 3);
      const speeds = new Float32Array(pCount);

      for (let i = 0; i < pCount; i++) {
        const radius = 0.35 + Math.random() * 0.65;
        const theta = Math.random() * Math.PI * 2;
        positions[i * 3] = Math.cos(theta) * radius;
        positions[i * 3 + 1] = Math.random() * 1.85;
        positions[i * 3 + 2] = Math.sin(theta) * radius;
        speeds[i] = 0.08 + Math.random() * 0.15;
      }

      const pGeo = new THREE.BufferGeometry();
      pGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
      const pMat = new THREE.MeshStandardMaterial({
        color: 0x00f0ff,
        emissive: 0x00f0ff,
        wireframe: true,
        transparent: true,
        opacity: 0.65
      });
      this.particleMesh = new THREE.Mesh(pGeo, pMat);
      this.particlePositions = positions;
      this.particleSpeeds = speeds;
      scene.add(this.particleMesh);
    },

    upgradeMaterials(mats) {
      if (!mats) return;
      mats.forEach((mat, system) => {
        if (system === 'cardiac') {
          mat.emissive.setHex(0xff0044);
          mat.emissiveIntensity = 0.45;
          mat.metalness = 0.25;
          mat.roughness = 0.35;
        } else if (system === 'arterial') {
          mat.emissive.setHex(0xff1744);
          mat.emissiveIntensity = 0.55;
        } else if (system === 'nervous') {
          mat.color.setHex(0x00f0ff);
          mat.emissive.setHex(0x00e5ff);
          mat.emissiveIntensity = 0.75;
          mat.roughness = 0.2;
        } else if (system === 'venous') {
          mat.color.setHex(0x2979ff);
          mat.emissive.setHex(0x1565c0);
          mat.emissiveIntensity = 0.35;
        } else if (system === 'skeletal') {
          mat.color.setHex(0x94a3b8);
          mat.metalness = 0.35;
          mat.roughness = 0.3;
        }
        mat.needsUpdate = true;
      });
    },

    update(delta) {
      if (!core) return false;
      const { partState, partStateTexture, centers, camera, controls } = core;
      if (!partState) return false;

      this.time += delta;

      // 0. Auto-Track Selection Changes from Any Source (Canvas Click, UI, etc.)
      const state = core.getState ? core.getState() : null;
      const currentSelectedId = state && state.selected && state.selected.length > 0 ? state.selected[0] : null;
      if (currentSelectedId !== lastTrackedPartId) {
        lastTrackedPartId = currentSelectedId;
        if (currentSelectedId) {
          showOrganHUD(currentSelectedId);
        } else {
          const hud = document.getElementById('jarvis-hud');
          if (hud) hud.classList.add('hidden');
        }
      }

      // 1. Cinematic Tour Camera Drone
      if (cinematicTourActive) {
        tourAngle += delta * 0.25;
        const dist = 2.4;
        const camY = controls.target.y + 0.15 + Math.sin(tourAngle * 1.5) * 0.35;
        camera.position.x = controls.target.x + Math.sin(tourAngle) * dist;
        camera.position.z = controls.target.z + Math.cos(tourAngle) * dist;
        camera.position.y = camY;
        controls.update();
      }

      // 2. Ambient Holo-Particles Animation
      if (this.particlePositions && this.particleMesh) {
        const pCount = this.particlePositions.length / 3;
        for (let i = 0; i < pCount; i++) {
          this.particlePositions[i * 3 + 1] += this.particleSpeeds[i] * delta;
          if (this.particlePositions[i * 3 + 1] > 1.9) {
            this.particlePositions[i * 3 + 1] = 0.05;
          }
        }
        this.particleMesh.geometry.attributes.position.needsUpdate = true;
      }

      // 3. Bio-Energy Flow Animations
      if (bioEnergyActive) {
        // A. Cardiac Pulse & Audio
        const beatPeriod = 60 / 72; // 72 BPM
        const beatProgress = (this.time % beatPeriod) / beatPeriod;

        let systole = 0;
        if (beatProgress >= 0.18 && beatProgress < 0.38) {
          systole = Math.sin((beatProgress - 0.18) / 0.20 * Math.PI);
        }

        if (beatProgress >= 0.18 && this.lastBeatTime !== Math.floor(this.time / beatPeriod)) {
          this.lastBeatTime = Math.floor(this.time / beatPeriod);
          playLubDub();
        }

        if (this.heartParts.length > 0 && this.heartCentroid) {
          const hc = this.heartCentroid;
          const sXZ = -0.12 * systole;
          const sY = 0.05 * systole;
          for (let i = 0; i < this.heartParts.length; i++) {
            const idx = this.heartParts[i];
            const c = centers[idx];
            if (!c) continue;
            const offsetIdx = idx * 4;
            partState[offsetIdx] += (c.x - hc.x) * sXZ * 0.18;
            partState[offsetIdx + 1] += (c.y - hc.y) * sY * 0.18;
            partState[offsetIdx + 2] += (c.z - hc.z) * sXZ * 0.18;
          }
        }

        // B. Flowing Arterial Blood Stream Waves
        for (let i = 0; i < this.arterialParts.length; i++) {
          const idx = this.arterialParts[i];
          const c = centers[idx];
          if (!c) continue;
          const wavePhase = this.time * 5.0 - c.y * 6.0;
          const wave = Math.pow(Math.max(0, Math.sin(wavePhase)), 4.0);
          const offsetIdx = idx * 4;
          partState[offsetIdx + 2] += wave * 0.003;
        }

        // C. Neural Action Potential Electric Sparks
        const sparkPhase = (this.time * 2.0) % 1.5;
        const sparkY = 1.70 - sparkPhase * 0.65;
        for (let i = 0; i < this.neuralParts.length; i++) {
          const idx = this.neuralParts[i];
          const c = centers[idx];
          if (!c) continue;
          if (Math.abs(c.y - sparkY) < 0.12) {
            const offsetIdx = idx * 4;
            partState[offsetIdx] += (Math.random() - 0.5) * 0.002;
          }
        }

        // D. Respiratory Chest Breathing
        const respProgress = (this.time % 4.0) / 4.0;
        const lungScale = 0.05 * ((Math.sin(respProgress * Math.PI * 2) + 1) * 0.5);
        if (this.lungParts.length > 0 && this.lungCentroid) {
          const lc = this.lungCentroid;
          for (let i = 0; i < this.lungParts.length; i++) {
            const idx = this.lungParts[i];
            const c = centers[idx];
            if (!c) continue;
            const offsetIdx = idx * 4;
            partState[offsetIdx] += (c.x - lc.x) * lungScale * 0.1;
            partState[offsetIdx + 1] += (c.y - lc.y) * (lungScale * 0.4) * 0.1;
            partState[offsetIdx + 2] += (c.z - lc.z) * lungScale * 0.1;
          }
        }

        partStateTexture.needsUpdate = true;
      }

      return true;
    }
  };

  // =========================================================================
  // 2. STREAMLINED JARVIS UI & CORNER HUD
  // =========================================================================
  let selectedPartData = null;

  function createJarvisUI() {
    const scanline = document.createElement('div');
    scanline.className = 'holo-scanline-overlay';
    document.body.appendChild(scanline);

    const dock = document.createElement('div');
    dock.id = 'jarvis-dock';
    dock.innerHTML = `
      <div class="jarvis-badge">
        <span class="jarvis-pulse-ring"></span>
        <span>JARVIS // HOLO-DECK</span>
      </div>
      <button class="jarvis-btn" id="btn-tour" title="Toggle Cinematic Drone Camera">
        <span class="btn-icon">🎬</span>
        <span class="btn-text">Cinematic Tour</span>
      </button>
      <button class="jarvis-btn active" id="btn-bio" title="Toggle Circulating Blood & Neural Sparks">
        <span class="btn-icon">⚡</span>
        <span class="btn-text">Bio-Energy</span>
      </button>
      <button class="jarvis-btn" id="btn-knoll" title="Expand into 2,234-Part Knolled Grid">
        <span class="btn-icon">💥</span>
        <span class="btn-text">Cyber-Knoll</span>
      </button>
      <div class="jarvis-divider"></div>
      <button class="jarvis-btn" id="btn-voice" title="Toggle AI Voice Sound">
        <span class="btn-icon" id="voice-icon">🔊</span>
      </button>
    `;
    document.body.appendChild(dock);

    const hud = document.createElement('div');
    hud.id = 'jarvis-hud';
    hud.className = 'hidden';
    hud.innerHTML = `
      <div class="hud-cyber-header">
        <div class="hud-cyber-title">ANATOMICAL TELEMETRY</div>
        <button class="hud-close-btn" id="hud-close">✕</button>
      </div>
      <div class="hud-body">
        <div>
          <div id="hud-name" class="hud-organ-name">Structure</div>
          <div id="hud-system" class="hud-organ-system">Organ System</div>
        </div>
        <div class="hud-telemetry-grid">
          <div class="telemetry-item">
            <span class="telemetry-label">BIO-RHYTHM</span>
            <span class="telemetry-val" id="hud-bpm">72 BPM (NORMAL)</span>
          </div>
          <div class="telemetry-item">
            <span class="telemetry-label">O2 PERFUSION</span>
            <span class="telemetry-val" id="hud-spo2">98.6% SpO2</span>
          </div>
          <div class="telemetry-item">
            <span class="telemetry-label">PART ID</span>
            <span class="telemetry-val" id="hud-part-id">FJ-0012</span>
          </div>
          <div class="telemetry-item">
            <span class="telemetry-label">MESH DENSITY</span>
            <span class="telemetry-val" id="hud-poly-count">2,480 Tris</span>
          </div>
        </div>
        <div id="hud-desc" class="hud-briefing-text">
          Telemetry brief...
        </div>
        <div class="hud-actions">
          <button class="hud-btn primary" id="hud-voice-btn">
            <span>🎙️</span> Jarvis Briefing
          </button>
          <button class="hud-btn" id="hud-stl-btn">
            <span>📥</span> 3D Print STL
          </button>
        </div>
      </div>
    `;
    document.body.appendChild(hud);

    document.getElementById('btn-tour').addEventListener('click', (e) => {
      cinematicTourActive = !cinematicTourActive;
      e.currentTarget.classList.toggle('active', cinematicTourActive);
      playJarvisChime();
    });

    document.getElementById('btn-bio').addEventListener('click', (e) => {
      bioEnergyActive = !bioEnergyActive;
      e.currentTarget.classList.toggle('active', bioEnergyActive);
      playJarvisChime();
    });

    document.getElementById('btn-knoll').addEventListener('click', (e) => {
      if (!core) return;
      const state = core.getState();
      const isKnolled = state.explode > 0.5;
      const slider = document.querySelector('input[type="range"]') || document.querySelector('.explode-bar input');
      if (slider) {
        slider.value = isKnolled ? 0 : 1;
        slider.dispatchEvent(new Event('input', { bubbles: true }));
      }
      e.currentTarget.classList.toggle('active', !isKnolled);
      playJarvisChime();
    });

    document.getElementById('btn-voice').addEventListener('click', () => {
      isMuted = !isMuted;
      document.getElementById('voice-icon').textContent = isMuted ? '🔇' : '🔊';
    });

    document.getElementById('hud-close').addEventListener('click', () => {
      hud.classList.add('hidden');
    });

    document.getElementById('hud-voice-btn').addEventListener('click', () => {
      if (!selectedPartData) return;
      speakJarvis(`${selectedPartData.name}, part of the ${selectedPartData.system} system. ${selectedPartData.desc}`);
    });

    document.getElementById('hud-stl-btn').addEventListener('click', () => {
      if (!selectedPartData || !core) return;
      exportSTL(selectedPartData.id);
    });
  }

  function showOrganHUD(partId) {
    if (!core) return;
    const { atlas, centers, camera, controls } = core;
    const idx = atlas.parts.findIndex(p => p.id === partId);
    if (idx < 0) return;

    const part = atlas.parts[idx];
    const center = centers[idx];

    selectedPartData = {
      id: part.id,
      name: part.name,
      system: part.system,
      desc: getClinicalDescription(part.name)
    };

    const hud = document.getElementById('jarvis-hud');
    if (!hud) return;

    document.getElementById('hud-name').textContent = part.name;
    document.getElementById('hud-system').textContent = `${part.system} system`;
    document.getElementById('hud-part-id').textContent = part.id;
    document.getElementById('hud-poly-count').textContent = `${part.vertexCount || 1800} Tris`;
    document.getElementById('hud-desc').textContent = selectedPartData.desc;

    hud.classList.remove('hidden');
    playJarvisChime();

    // Smooth Camera Focus
    if (center && camera && controls) {
      cinematicTourActive = false;
      const btnTour = document.getElementById('btn-tour');
      if (btnTour) btnTour.classList.remove('active');

      const startCam = camera.position.clone();
      const startTarget = controls.target.clone();
      const targetCam = center.clone().add(new core.THREE.Vector3(0.18, 0.08, 0.42));

      let elapsed = 0;
      const dur = 0.85;
      const anim = () => {
        elapsed += 0.035;
        const t = Math.min(1, elapsed / dur);
        const ease = t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
        camera.position.lerpVectors(startCam, targetCam, ease);
        controls.target.lerpVectors(startTarget, center, ease);
        controls.update();
        core.markDirty();
        if (t < 1) requestAnimationFrame(anim);
      };
      anim();
    }
  }

  function getClinicalDescription(name) {
    const n = (name || '').toLowerCase();
    if (n.includes('heart') || n.includes('ventricle') || n.includes('atrium')) {
      return 'Primary muscular cardiovascular pump. Delivers continuous cardiac output of 5 liters per minute.';
    }
    if (n.includes('brain') || n.includes('cerebr')) {
      return 'Command center of the central nervous system coordinating sensory processing, conscious thought, and homeostasis.';
    }
    if (n.includes('lung') || n.includes('pulmon')) {
      return 'Dual respiratory gas exchange organs facilitating alveolar oxygen transfer into pulmonary circulation.';
    }
    if (n.includes('femur') || n.includes('bone')) {
      return 'High-strength cortical bone structure providing kinetic structural support and locomotion levering.';
    }
    if (n.includes('biceps') || n.includes('muscle')) {
      return 'Skeletal muscle generating active contractile tension to articulate joints and produce locomotion.';
    }
    return 'Integral anatomical structure within the human biomechanical and physiological matrix.';
  }

  function speakJarvis(text) {
    if (!('speechSynthesis' in window) || isMuted) return;
    window.speechSynthesis.cancel();
    const utter = new SpeechSynthesisUtterance(text);
    utter.rate = 1.05;
    utter.pitch = 0.98;
    window.speechSynthesis.speak(utter);
  }

  function exportSTL(partId) {
    if (!core) return;
    const { atlas, pickers } = core;
    const idx = atlas.parts.findIndex(p => p.id === partId);
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

    const headerStr = `Binary STL from Jarvis Holo-Deck - ${part.name.substring(0, 40)}`;
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
    link.download = `Jarvis_Holo_${cleanName}_3DPrint.stl`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    playJarvisChime();
  }

  // =========================================================================
  // 3. BOOTSTRAP HOOK
  // =========================================================================
  function initJarvis(atlasCore) {
    core = atlasCore;
    console.log('🤖 [Jarvis Holo-Deck] Online. Activating obsidian space & bioluminescent shaders...');

    createJarvisUI();
    HoloEngine.init();

    window.__ATLAS_TICK__ = (delta) => {
      return HoloEngine.update(delta);
    };

    const origSelect = core.selectPart;
    core.selectPart = (id) => {
      origSelect(id);
      showOrganHUD(id);
    };

    window.showOrganHUD = showOrganHUD;
    console.log('✨ [Jarvis Holo-Deck] Holographic systems active with 2,234 parts.');
  }

  if (window.__ATLAS_CORE__) {
    initJarvis(window.__ATLAS_CORE__);
  } else {
    window.addEventListener('atlas-ready', (e) => {
      initJarvis(e.detail);
    }, { once: true });
  }

})();
