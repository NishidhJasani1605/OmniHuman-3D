import * as T from 'three';
import type {OrbitControls} from 'three/examples/jsm/controls/OrbitControls.js';
import {SYSTEM_DEPTH_LAYERS,type Atlas,type Part,type SystemId} from './anatomy';

// ── State machine ────────────────────────────────────────────────────
export type DissectorState =
 |'IDLE'
 |'ACT_1_ANCHOR'
 |'ACT_2_PEEL'
 |'ACT_3_TRANSECT_ZOOM'
 |'ACT_4_SOLO_LOCK'
 |'ACT_5_RESTORE';

export interface HudInfo {
 stage: string;
 title: string;
}

// ── Phase Timing (matching OmniHuman-3D) ─────────────────────────────
const ACT1_DUR = 0.65; // Phase 1: Full-body context + glowing beacon pulse
const ACT2_DUR = 1.25; // Phase 2: System layer peeling & transection
const ACT3_DUR = 1.80; // Phase 3: Synchronized camera flight + spatial wave culling
const ACT5_DUR = 1.00; // Phase 5: Reconstitution / full body restore

// ── Web Audio Acoustic Telemetry & Chime Synthesizer ─────────────────
class DissectorAudio {
 private ctx: AudioContext | null = null;
 play(freq: number, duration: number, type: OscillatorType = 'sine', gainVal: number = 0.2) {
  try {
   if (typeof window === 'undefined') return;
   if (!this.ctx) {
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (AudioCtx) this.ctx = new AudioCtx();
   }
   if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
   if (!this.ctx) return;
   const osc = this.ctx.createOscillator();
   const gain = this.ctx.createGain();
   osc.type = type;
   osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
   gain.gain.setValueAtTime(gainVal, this.ctx.currentTime);
   gain.gain.exponentialRampToValueAtTime(0.0001, this.ctx.currentTime + duration);
   osc.connect(gain);
   gain.connect(this.ctx.destination);
   osc.start();
   osc.stop(this.ctx.currentTime + duration);
  } catch {}
 }
}

const audio = new DissectorAudio();

// ── Helpers ──────────────────────────────────────────────────────────
function easeInOutCubic(t: number): number {
 return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

function quadBezier(a: T.Vector3, b: T.Vector3, c: T.Vector3, t: number, out: T.Vector3): T.Vector3 {
 const u = 1 - t;
 out.set(
  u * u * a.x + 2 * u * t * b.x + t * t * c.x,
  u * u * a.y + 2 * u * t * b.y + t * t * c.y,
  u * u * a.z + 2 * u * t * b.z + t * t * c.z,
 );
 return out;
}

// ── Dependencies ─────────────────────────────────────────────────────
export interface DissectorDeps {
 camera: T.PerspectiveCamera;
 controls: OrbitControls;
 atlas: Atlas;
 /** Per-part alpha array – the dissector writes to this each frame. */
 partAlphas: Float32Array;
 /** Existing data-texture array (4 floats per part: dx,dy,dz,visible). */
 partData: Float32Array;
 alphaData?: Float32Array;
 alphaTexture?: T.DataTexture;
 /** Selection texture array for highlighting beacon */
 selectionData?: Uint8Array;
 selectionTexture?: T.DataTexture;
 centers: T.Vector3[];
 bounds: T.Box3[];
 hostEl: HTMLElement;
 onHudUpdate: (hud: HudInfo | null) => void;
 onStateChange: (state: DissectorState) => void;
 onRequestIsolate: (indices: number[]) => void;
 onRequestRestore: () => void;
 onSelectPart?: (id: string) => void;
}

// ── Engine ───────────────────────────────────────────────────────────
export class CinematicDissector {
 state: DissectorState = 'IDLE';
 phase = 0;
 active = false;
 elapsed = 0;

 targetId: string | null = null;
 targetIndex = -1;
 targetIndices: number[] = [];
 targetPart: Part | null = null;
 targetName = '';
 targetSystem: SystemId = 'skeletal';
 targetCentroid = new T.Vector3();
 targetCamPos = new T.Vector3();
 targetBoundingSphere = new T.Sphere();

 partDistances: Float32Array | null = null;
 maxRemainingDist = 1.6;

 private deps!: DissectorDeps;
 private hudHideTimer: ReturnType<typeof setTimeout> | null = null;

 // Act 1: camera anchoring
 private phase1StartCam = new T.Vector3();
 private phase1StartTarget = new T.Vector3();
 private anchorCamPos = new T.Vector3(0.35, 0.95, 2.1);
 private anchorCamTarget = new T.Vector3(0, 0.85, 0);

 // Act 3: flight path
 private flightStartCam = new T.Vector3();
 private flightStartTarget = new T.Vector3();
 private flightMidCam = new T.Vector3();

 // Act 5: restore snapshots
 private restoreCamPos = new T.Vector3();
 private restoreCamTarget = new T.Vector3();
 private restoreAlphas: Float32Array | null = null;

 // Beacon
 private beacon: T.Mesh | null = null;
 private beaconPulseTime = 0;

 // Controls lock snapshot
 private savedControlsEnabled = true;

 // Reference full body camera
 private fullBodyPos = new T.Vector3(1.4, 1.05, 3.6);
 private fullBodyTarget = new T.Vector3(0, 0.85, 0);

 init(deps: DissectorDeps) {
  this.deps = deps;
  this.createBeacon();

  // Expose on window matching OmniHuman-3D
  if (typeof window !== 'undefined') {
   const win = window as unknown as Record<string, unknown>;
   win.CinematicDissector = this;
   win.__ATLAS_DISSECTING__ = false;
  }
 }

 // ── Beacon ───────────────────────────────────────────────────────
 private createBeacon() {
  const geo = new T.SphereGeometry(0.014, 20, 20);
  const mat = new T.MeshBasicMaterial({color: 0x00f0ff, transparent: true, opacity: 0.9, depthTest: false});
  this.beacon = new T.Mesh(geo, mat);
  this.beacon.renderOrder = 20;
  this.beacon.visible = false;

  const ringGeo = new T.RingGeometry(0.020, 0.026, 32);
  const ringMat = new T.MeshBasicMaterial({color: 0x00f0ff, transparent: true, opacity: 0.7, side: T.DoubleSide, depthTest: false});
  const ring = new T.Mesh(ringGeo, ringMat);
  ring.renderOrder = 20;
  this.beacon.add(ring);
 }

 getBeacon() { return this.beacon; }

 private showHud(stage: string, title: string) {
  if (this.hudHideTimer) clearTimeout(this.hudHideTimer);
  this.deps.onHudUpdate({stage, title});
 }

 private hideHud(delayMs = 2500) {
  if (this.hudHideTimer) clearTimeout(this.hudHideTimer);
  this.hudHideTimer = setTimeout(() => {
   this.deps.onHudUpdate(null);
  }, delayMs);
 }

 // ── Start cinematic (Acts 1→4) ──────────────────────────────────
 start(target: number[] | string, partName?: string) {
  if (!this.deps) return;

  let indices: number[] = [];
  if (typeof target === 'string') {
   const idx = this.deps.atlas.parts.findIndex(p => p.id === target);
   if (idx < 0) return;
   indices = [idx];
  } else if (Array.isArray(target) && target.length > 0) {
   indices = target;
  } else {
   return;
  }

  // Prevent re-triggering identical active target
  const firstIdx = indices[0];
  const part = this.deps.atlas.parts[firstIdx];
  if (!part) return;
  if (this.active && this.targetIndex === firstIdx) return;

  // Save full-body camera position if starting from whole body
  if (this.deps.camera.position.z > 1.8) {
   this.fullBodyPos.copy(this.deps.camera.position);
   this.fullBodyTarget.copy(this.deps.controls.target);
  }

  // Mid-transition interrupt: cleanly kill existing and redirect
  if (this.active) {
   this.interrupt();
  }

  this.targetIndices = indices;
  this.targetIndex = firstIdx;
  this.targetPart = part;
  this.targetId = part.id;
  this.targetName = partName || part.name;
  this.targetSystem = part.system || 'skeletal';

  // Compute target centroid and bounding sphere
  const box = new T.Box3();
  for (const i of indices) {
   if (this.deps.bounds[i]) box.union(this.deps.bounds[i]);
  }
  box.getCenter(this.targetCentroid);
  const size = new T.Vector3();
  box.getSize(size);
  const maxDim = Math.max(size.x, size.y, size.z, 0.05);
  this.targetBoundingSphere.set(this.targetCentroid, maxDim * 0.5);

  // Compute close-up camera distance around target bounding box
  const fov = (this.deps.camera.fov || 34) * (Math.PI / 180);
  const dist = Math.max((maxDim / 2) / Math.tan(fov / 2) * 1.55, 0.20);
  let dir = this.deps.camera.position.clone().sub(this.deps.controls.target).normalize();
  if (dir.lengthSq() < 0.05) dir.set(0.18, 0.08, 0.95).normalize();
  dir.y = Math.max(dir.y, 0.12);
  dir.normalize();
  this.targetCamPos = this.targetCentroid.clone().addScaledVector(dir, dist);

  // Precompute distances of all 2,234 parts from the target structure (OmniHuman-3D)
  this.partDistances = new Float32Array(this.deps.atlas.parts.length);
  let maxDist = 0;
  for (let i = 0; i < this.deps.atlas.parts.length; i++) {
   if (this.deps.centers[i]) {
    const d = this.deps.centers[i].distanceTo(this.targetCentroid);
    this.partDistances[i] = d;
    if (d > maxDist) maxDist = d;
   } else {
    this.partDistances[i] = 1.0;
   }
  }
  this.maxRemainingDist = Math.max(maxDist, 1.2);

  // Lock user orbit controls during flight
  this.savedControlsEnabled = this.deps.controls.enabled;
  this.deps.controls.enabled = false;

  // Ensure all 2,234 parts visible at start for whole-body context
  this.deps.partAlphas.fill(1.0);

  // Flag global dissecting state
  if (typeof window !== 'undefined') {
   (window as unknown as Record<string, unknown>).__ATLAS_DISSECTING__ = true;
  }

  this.active = true;
  this.elapsed = 0;

  if (this.deps.onSelectPart && this.targetId) {
   this.deps.onSelectPart(this.targetId);
  }

  this.transitionTo('ACT_1_ANCHOR', 1);
  this.setupAct1();
 }

 // ── Act 5: Restore (Reconstitute) ────────────────────────────────
 restore() {
  this.reconstitute();
 }

 reconstitute() {
  if (!this.deps) return;
  if (this.state !== 'ACT_4_SOLO_LOCK' && this.state !== 'IDLE') {
   this.interrupt();
  }

  // Clear beacon and selection highlight
  if (this.beacon) this.beacon.visible = false;
  if (this.deps.selectionData) {
   for (let i = 0; i < this.deps.atlas.parts.length; i++) {
    this.deps.selectionData[i * 4] = 0;
   }
  }
  if (this.deps.selectionTexture) {
   this.deps.selectionTexture.needsUpdate = true;
  }

  // Restore all 2,234 parts immediately matching OmniHuman-3D
  this.deps.partAlphas.fill(1.0);
  if (this.deps.alphaData) {
   this.deps.alphaData.fill(1.0);
  }
  if (this.deps.alphaTexture) {
   this.deps.alphaTexture.needsUpdate = true;
  }
  if (this.deps.partData) {
   for (let i = 0; i < this.deps.atlas.parts.length; i++) {
    this.deps.partData[i * 4 + 3] = 1.0;
   }
  }

  // Fly / reset camera back to full body overview
  const {camera, controls} = this.deps;
  camera.clearViewOffset?.();
  if (this.fullBodyPos.z < 1.8) {
   this.fullBodyPos.set(1.4, 1.05, 3.6);
  }
  camera.position.copy(this.fullBodyPos);
  controls.target.copy(this.fullBodyTarget);
  controls.enabled = true;
  controls.update();

  this.active = false;
  this.elapsed = 0;
  if (typeof window !== 'undefined') {
   (window as unknown as Record<string, unknown>).__ATLAS_DISSECTING__ = false;
  }
  this.transitionTo('IDLE', 0);
  this.deps.onRequestRestore();
  this.showHud('🌐 WHOLE BODY', 'Full human twin reconstituted with all 2,234 structures.');
  this.hideHud(2200);
  audio.play(523.25, 0.12, 'sine', 0.20);
 }

 // ── Jump directly to solo lock (Instant Finish) ──────────────────
 instantFinish() {
  if (!this.deps || !this.targetPart) return;
  this.elapsed = ACT1_DUR + ACT2_DUR + ACT3_DUR + 0.05;
  this.setupAct4();
  this.transitionTo('ACT_4_SOLO_LOCK', 4);
 }

 // ── Seek to precise timestamp (for automated testing / scrubbing) 
 seek(targetElapsed: number) {
  if (!this.active) return;
  this.elapsed = targetElapsed;
  this.update(0);
 }

 // ── Per-frame update (called from scene animation loop) ───────────
 update(dt: number) {
  if (!this.active || this.state === 'IDLE') return;

  if (this.state === 'ACT_4_SOLO_LOCK') {
   return;
  }

  this.elapsed += dt;

  const tP1 = ACT1_DUR;
  const tP2 = tP1 + ACT2_DUR;
  const tP3 = tP2 + ACT3_DUR;

  if (this.state === 'ACT_5_RESTORE') {
   this.updateAct5(dt);
   return;
  }

  if (this.elapsed <= tP1) {
   if (this.state !== 'ACT_1_ANCHOR') this.transitionTo('ACT_1_ANCHOR', 1);
   this.updateAct1(dt);
  } else if (this.elapsed <= tP2) {
   if (this.state !== 'ACT_2_PEEL') {
    this.transitionTo('ACT_2_PEEL', 2);
    this.setupAct2();
   }
   this.updateAct2(dt);
  } else if (this.elapsed <= tP3) {
   if (this.state !== 'ACT_3_TRANSECT_ZOOM') {
    this.transitionTo('ACT_3_TRANSECT_ZOOM', 3);
    this.setupAct3();
   }
   this.updateAct3(dt);
  } else {
   this.instantFinish();
  }

  // Animate 3D cyan pulsing beacon during Acts 1-3
  if (this.beacon && this.beacon.visible) {
   this.beaconPulseTime += dt;
   const pulse = 0.65 + 0.35 * Math.sin(this.beaconPulseTime * 6);
   const scale = 0.85 + 0.35 * Math.sin(this.beaconPulseTime * 4);
   (this.beacon.material as T.MeshBasicMaterial).opacity = pulse;
   this.beacon.scale.setScalar(scale);
   if (this.beacon.children[0]) {
    this.beacon.children[0].lookAt(this.deps.camera.position);
   }
  }
 }

 // ── Interrupt ────────────────────────────────────────────────────
 interrupt() {
  this.active = false;
  this.phase = 0;
  if (this.hudHideTimer) clearTimeout(this.hudHideTimer);
  if (this.beacon) this.beacon.visible = false;

  if (this.deps) {
   this.deps.controls.enabled = this.savedControlsEnabled;
   this.deps.partAlphas.fill(1.0);
   this.deps.onHudUpdate(null);
  }

  if (typeof window !== 'undefined') {
   (window as unknown as Record<string, unknown>).__ATLAS_DISSECTING__ = false;
  }

  this.transitionTo('IDLE', 0);
 }

 // ── Dispose ─────────────────────────────────────────────────────
 dispose() {
  this.interrupt();
  if (this.beacon) {
   this.beacon.children.forEach(c => {
    if (c instanceof T.Mesh) {
     c.geometry.dispose();
     (c.material as T.Material).dispose();
    }
   });
   this.beacon.geometry.dispose();
   (this.beacon.material as T.Material).dispose();
   this.beacon.removeFromParent();
   this.beacon = null;
  }
  this.restoreAlphas = null;
  this.partDistances = null;
 }

 // ── Private: State Transition ────────────────────────────────────
 private transitionTo(next: DissectorState, phaseNum: number) {
  this.state = next;
  this.phase = phaseNum;
  this.deps?.onStateChange(next);
 }

 // ── ACT 1: Full-Body Anchor ─────────────────────────────────────
 private setupAct1() {
  this.phase1StartCam.copy(this.deps.camera.position);
  this.phase1StartTarget.copy(this.deps.controls.target);

  // Position 3D pulsing cyan beacon at target centroid
  if (this.beacon) {
   this.beacon.position.copy(this.targetCentroid);
   this.beacon.visible = true;
   this.beaconPulseTime = 0;
  }

  this.showHud('🌐 WHOLE BODY', `Locating <span class="omni-hud-target-name">${this.targetName}</span> in human anatomy...`);
  audio.play(880, 0.08, 'sine', 0.15);
 }

 private updateAct1(_dt: number) {
  const p = Math.min(1, this.elapsed / ACT1_DUR);
  const ease = p * p;

  // Smoothly ease camera to full-body anchor perspective
  if (this.phase1StartCam.distanceTo(this.anchorCamPos) > 0.15) {
   this.deps.camera.position.lerpVectors(this.phase1StartCam, this.anchorCamPos, ease * 0.4);
   this.deps.controls.target.lerpVectors(this.phase1StartTarget, this.anchorCamTarget, ease * 0.4);
   this.deps.controls.update();
  }

  // Cyan silhouette pulse on target mesh selection texture
  if (this.deps.selectionData && this.targetIndex >= 0) {
   const pulse = 180 + Math.floor(75 * Math.sin(this.elapsed * 25));
   this.deps.selectionData[this.targetIndex * 4] = pulse;
  }
 }

 // ── ACT 2: Layer Peeling ────────────────────────────────────────
 private setupAct2() {
  let stageBadge = 'TRANSITION';
  let layerDesc = 'Revealing internal anatomy...';

  if (this.targetSystem === 'skeletal') {
   stageBadge = '🦴 SKELETON LAYER';
   layerDesc = 'Peeling muscles & skin to reveal <strong>complete skeleton</strong>...';
  } else if (this.targetSystem === 'cardiac' || this.targetSystem === 'arterial' || this.targetSystem === 'venous') {
   stageBadge = '💓 CARDIOVASCULAR';
   layerDesc = 'Peeling thoracic wall to reveal <strong>cardiovascular tree</strong>...';
  } else if (this.targetSystem === 'muscular') {
   stageBadge = '💪 MUSCULAR LAYER';
   layerDesc = 'Peeling skin to expose <strong>muscular architecture</strong>...';
  } else if (this.targetSystem === 'nervous') {
   stageBadge = '🧠 NERVOUS SYSTEM';
   layerDesc = 'Transecting outer layers to expose <strong>neural pathways</strong>...';
  } else {
   stageBadge = '🥣 VISCERAL LAYER';
   layerDesc = `Transecting body wall to expose <strong>${this.targetSystem} system</strong>...`;
  }

  this.showHud(stageBadge, layerDesc);
  audio.play(659.25, 0.10, 'triangle', 0.15);
 }

 private updateAct2(_dt: number) {
  const peelProgress = Math.min(1, Math.max(0, (this.elapsed - ACT1_DUR) / ACT2_DUR));
  const {atlas, partAlphas} = this.deps;

  // Hierarchical layer peel logic matching OmniHuman-3D
  for (let i = 0; i < atlas.parts.length; i++) {
   if (this.targetIndices.includes(i)) {
    partAlphas[i] = 1.0;
    continue;
   }
   const pSys = atlas.parts[i].system;

   if (this.targetSystem === 'skeletal') {
    // Immediately peel muscles and integumentary in Phase 2
    if (pSys === 'muscular' || pSys === 'integumentary') {
     partAlphas[i] = 0.0;
    } else if (pSys !== 'skeletal') {
     // Peel visceral/vascular/nervous in second half of Phase 2
     partAlphas[i] = peelProgress > 0.45 ? 0.0 : 1.0;
    } else {
     partAlphas[i] = 1.0; // Complete skeleton remains visible (>200 bones)!
    }
   } else if (this.targetSystem === 'cardiac' || this.targetSystem === 'arterial' || this.targetSystem === 'venous') {
    if (pSys === 'muscular' || pSys === 'integumentary') {
     partAlphas[i] = 0.0;
    } else if (pSys === 'skeletal') {
     partAlphas[i] = peelProgress > 0.45 ? 0.0 : 1.0;
    } else {
     partAlphas[i] = 1.0;
    }
   } else if (this.targetSystem === 'muscular') {
    if (pSys === 'integumentary') {
     partAlphas[i] = 0.0;
    } else if (pSys !== 'muscular') {
     partAlphas[i] = peelProgress > 0.45 ? 0.0 : 1.0;
    } else {
     partAlphas[i] = 1.0;
    }
   } else {
    if (pSys === 'integumentary' || pSys === 'muscular') {
     partAlphas[i] = 0.0;
    } else if (pSys !== this.targetSystem) {
     partAlphas[i] = peelProgress > 0.45 ? 0.0 : 1.0;
    } else {
     partAlphas[i] = 1.0;
    }
   }
  }
 }

 // ── ACT 3: Flight Zoom & Distance-Based Transection ─────────────
 private setupAct3() {
  const {camera, controls} = this.deps;
  this.flightStartCam.copy(camera.position);
  this.flightStartTarget.copy(controls.target);

  // Midpoint with elevated curve for dramatic cinematic swooping
  this.flightMidCam.lerpVectors(this.flightStartCam, this.targetCamPos, 0.45);
  this.flightMidCam.y += Math.max(0.35, this.targetBoundingSphere.radius * 2);

  this.showHud('🎯 TRANSECTION & ZOOM', `Zooming inward • Transecting surrounding structures to <span class="omni-hud-target-name">${this.targetName}</span>...`);
 }

 private updateAct3(_dt: number) {
  const flightP = Math.min(1, Math.max(0, (this.elapsed - (ACT1_DUR + ACT2_DUR)) / ACT3_DUR));
  const ease = easeInOutCubic(flightP);
  const {camera, controls, atlas, partAlphas} = this.deps;

  // 1. Fly camera along smooth curved Bezier path
  quadBezier(this.flightStartCam, this.flightMidCam, this.targetCamPos, ease, camera.position);
  controls.target.lerpVectors(this.flightStartTarget, this.targetCentroid, ease);
  controls.update();

  // 2. Spatial Wavefront / Distance-Based Transection (OmniHuman-3D)
  // Parts further from target center peel away progressively as camera approaches!
  const cutoffRadius = this.maxRemainingDist * Math.pow(1.0 - ease, 1.7);

  if (this.partDistances) {
   for (let i = 0; i < atlas.parts.length; i++) {
    if (this.targetIndices.includes(i)) {
     partAlphas[i] = 1.0;
     continue;
    }
    const d = this.partDistances[i];
    if (d > cutoffRadius) {
     partAlphas[i] = 0.0;
    }
   }
  }
 }

 // ── ACT 4: Solo Target Lock ─────────────────────────────────────
 private setupAct4() {
  const {partAlphas, atlas, camera, controls} = this.deps;

  // 1. Hide all non-target meshes completely; only target is visible
  for (let i = 0; i < atlas.parts.length; i++) {
   partAlphas[i] = this.targetIndices.includes(i) ? 1.0 : 0.0;
  }

  // 2. Hide beacon & clear selection highlight so solo target renders in authentic anatomical colors
  if (this.beacon) this.beacon.visible = false;
  if (this.deps.selectionData) {
   for (let i = 0; i < atlas.parts.length; i++) {
    this.deps.selectionData[i * 4] = 0;
   }
  }
  if (this.deps.selectionTexture) {
   this.deps.selectionTexture.needsUpdate = true;
  }

  // 3. Lock camera precisely to target orbit framing
  camera.position.copy(this.targetCamPos);
  controls.target.copy(this.targetCentroid);
  controls.enabled = true; // Re-enable user orbit controls focused on solo target
  controls.update();

  // 4. Update HUD Toast & Clinical Dossier
  this.showHud('🔒 ISOLATED', `<strong>${this.targetName}</strong> (${this.targetPart?.conceptId || 'FMA'}) in solo inspection.`);
  this.hideHud(3000);

  // 5. Audio chime
  audio.play(1318.5, 0.15, 'sine', 0.25);

  // 6. Signal React state isolation
  if (typeof window !== 'undefined') {
   (window as unknown as Record<string, unknown>).__ATLAS_DISSECTING__ = false;
  }
  this.deps.onRequestIsolate(this.targetIndices);
 }

 // ── ACT 5: Restore (Reconstitute) ────────────────────────────────
 private updateAct5(_dt: number) {
  const t = easeInOutCubic(Math.min(1, this.elapsed / ACT5_DUR));
  const {camera, controls, partAlphas, atlas} = this.deps;

  // Fly camera back to full-body overview
  camera.position.lerpVectors(this.restoreCamPos, this.fullBodyPos, t);
  controls.target.lerpVectors(this.restoreCamTarget, this.fullBodyTarget, t);
  controls.update();

  // Sequentially fade and reassemble all 2,234 parts back to 100% opacity
  if (this.restoreAlphas) {
   for (let i = 0; i < atlas.parts.length; i++) {
    partAlphas[i] = T.MathUtils.lerp(this.restoreAlphas[i], 1.0, t);
   }
  }

  if (this.elapsed >= ACT5_DUR) {
   partAlphas.fill(1.0);
   controls.enabled = true;
   this.deps.onRequestRestore();
   this.hideHud(2000);
   this.active = false;
   if (typeof window !== 'undefined') {
    (window as unknown as Record<string, unknown>).__ATLAS_DISSECTING__ = false;
   }
   this.transitionTo('IDLE', 0);
  }
 }

 // ── Query Methods ────────────────────────────────────────────────
 isActive() { return this.active && this.state !== 'IDLE'; }
 isControlsLocked() {
  return this.active && (this.state === 'ACT_1_ANCHOR' || this.state === 'ACT_2_PEEL' || this.state === 'ACT_3_TRANSECT_ZOOM' || this.state === 'ACT_5_RESTORE');
 }
}
