import * as T from 'three';
import type {OrbitControls} from 'three/examples/jsm/controls/OrbitControls.js';
import {SYSTEMS,type Atlas,type Part,type SystemId} from './anatomy';

// ── State machine ────────────────────────────────────────────────────
export type DissectorState =
 |'IDLE'
 |'FLIGHT_TRANSITION'
 |'FOCUSED'
 |'RESTORE_TRANSITION'
 |'ACT_1_ANCHOR'
 |'ACT_2_PEEL'
 |'ACT_3_TRANSECT_ZOOM'
 |'ACT_4_SOLO_LOCK'
 |'ACT_5_RESTORE';

export interface HudInfo {
 stage: string;
 title: string;
}

// ── Timing & Visual Ghosting Constants ──────────────────────────────
const TRANSITION_DUR = 0.80; // Smooth 0.8s cinematic flight & cross-fade
const RESTORE_DUR = 0.80;    // Smooth 0.8s cinematic return flight & cross-fade
const GHOST_OPACITY = 0.10;  // Semi-transparent 10% opacity for ghosted surrounding parts

// ── Web Audio Acoustic Telemetry & Chime Synthesizer ─────────────────
class DissectorAudio {
 private ctx: AudioContext | null = null;
 play(freq: number, duration: number, type: OscillatorType = 'sine', gainVal: number = 0.18) {
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
 scene?: T.Scene;
 pickers?: (T.Mesh | undefined)[];
 materials?: T.Material[];
 /** Per-part alpha array – the dissector writes to this each frame. */
 partAlphas: Float32Array;
 /** Existing data-texture array (4 floats per part: dx,dy,dz,visible). */
 partData: Float32Array;
 alphaData?: Float32Array;
 alphaTexture?: T.DataTexture;
 colorData?: Float32Array;
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

 private deps!: DissectorDeps;
 private hudHideTimer: ReturnType<typeof setTimeout> | null = null;

 // Flight path state
 private startCamPos = new T.Vector3();
 private startCamTarget = new T.Vector3();
 private flightMidCam = new T.Vector3();
 private startGhostAlpha = 1.0;
 private startGhostFactor = 0.0;

 // Full body overview snapshots
 private fullBodyPos = new T.Vector3(1.2, 1.05, 3.6);
 private fullBodyTarget = new T.Vector3(0, 0.85, 0);

 // Controls lock snapshot
 private savedControlsEnabled = true;

 // Dedicated vibrant focus mesh group
 private focusGroup: T.Group | null = null;

 init(deps: DissectorDeps) {
  this.deps = deps;
  if (deps.scene) {
   this.focusGroup = new T.Group();
   this.focusGroup.name = 'focusGroup';
   this.focusGroup.renderOrder = 0;
   deps.scene.add(this.focusGroup);
  }

  // Record initial whole-body camera perspective
  if (deps.camera.position.z > 1.8) {
   this.fullBodyPos.copy(deps.camera.position);
   this.fullBodyTarget.copy(deps.controls.target);
  }

  // Expose on window matching OmniHuman-3D
  if (typeof window !== 'undefined') {
   const win = window as unknown as Record<string, unknown>;
   win.CinematicDissector = this;
   win.__ATLAS_DISSECTING__ = false;
  }
 }

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

 // ── Start Focus Flight (Transitions target into 100% vibrant, ghosting surrounding) ─
 start(target: number[] | string, partName?: string) {
  if (!this.deps) return;

  let indices: number[] = [];
  if (typeof target === 'string') {
   let idx = this.deps.atlas.parts.findIndex(p => p.id === target);
   if (idx < 0) {
    idx = this.deps.atlas.parts.findIndex(p => p.name.toLowerCase() === target.toLowerCase());
   }
   if (idx < 0) return;
   indices = [idx];
  } else if (Array.isArray(target) && target.length > 0) {
   indices = target.filter(i => i >= 0 && i < this.deps.atlas.parts.length);
   if (indices.length === 0) return;
  } else {
   return;
  }

  const firstIdx = indices[0];
  const part = this.deps.atlas.parts[firstIdx];
  if (!part) return;

  // If already focusing or focused on the exact same structure, do not restart
  if ((this.state === 'FOCUSED' || this.state === 'FLIGHT_TRANSITION') && this.targetIndex === firstIdx) return;

  // Save full-body camera position if currently starting from whole body
  if (this.state === 'IDLE' && this.deps.camera.position.z > 1.8) {
   this.fullBodyPos.copy(this.deps.camera.position);
   this.fullBodyTarget.copy(this.deps.controls.target);
  }

  // Snapshot current camera & controls for smooth flight start
  this.startCamPos.copy(this.deps.camera.position);
  this.startCamTarget.copy(this.deps.controls.target);

  // Snapshot starting ghost state
  if (this.state === 'IDLE') {
   this.startGhostAlpha = 1.0;
   this.startGhostFactor = 0.0;
  } else {
   this.startGhostAlpha = this.deps.partAlphas[0] ?? GHOST_OPACITY;
   this.startGhostFactor = this.deps.alphaData ? this.deps.alphaData[1] : 1.0;
  }

  this.targetIndices = indices;
  this.targetIndex = firstIdx;
  this.targetPart = part;
  this.targetId = part.id;
  this.targetName = partName || part.name;
  this.targetSystem = part.system || 'skeletal';

  // Compute unified centroid & bounding box for target indices
  const box = new T.Box3();
  for (const i of indices) {
   if (this.deps.bounds[i]) box.union(this.deps.bounds[i]);
  }
  box.getCenter(this.targetCentroid);
  const size = new T.Vector3();
  box.getSize(size);
  const maxDim = Math.max(size.x, size.y, size.z, 0.035);
  this.targetBoundingSphere.set(this.targetCentroid, maxDim * 0.5);

  // Calculate destination camera framing distance & angle
  const fovRad = (this.deps.camera.fov || 34) * (Math.PI / 180);
  const targetDist = Math.max((maxDim / 2) / Math.tan(fovRad / 2) * 1.55, 0.16);

  // Maintain natural viewing azimuth angle with slight elevation
  let dir = this.startCamPos.clone().sub(this.startCamTarget).normalize();
  if (dir.lengthSq() < 0.02 || isNaN(dir.x)) {
   dir.set(0.25, 0.12, 0.96).normalize();
  }
  dir.y = Math.max(0.08, Math.min(0.65, dir.y));
  dir.normalize();
  this.targetCamPos = this.targetCentroid.clone().addScaledVector(dir, targetDist);

  // Calculate swooping curved Bezier midpoint
  const flightDist = this.startCamPos.distanceTo(this.targetCamPos);
  this.flightMidCam.lerpVectors(this.startCamPos, this.targetCamPos, 0.48);
  if (flightDist > 0.20) {
   const flightDir = this.targetCamPos.clone().sub(this.startCamPos).normalize();
   const upVec = new T.Vector3(0, 1, 0);
   const sideVec = new T.Vector3().crossVectors(flightDir, upVec).normalize();
   this.flightMidCam.addScaledVector(upVec, Math.min(0.20, flightDist * 0.12));
   this.flightMidCam.addScaledVector(sideVec, Math.min(0.16, flightDist * 0.08));
  }

  // Setup dedicated solid vibrant focus mesh(es)
  this.updateFocusGroup(indices);

  // Set merged mesh materials to depthWrite = false during ghosting
  this.deps.materials?.forEach(m => { m.depthWrite = false; });

  // Temporarily lock user orbit controls during flight
  this.savedControlsEnabled = this.deps.controls.enabled;
  this.deps.controls.enabled = false;

  this.active = true;
  this.elapsed = 0;

  if (typeof window !== 'undefined') {
   (window as unknown as Record<string, unknown>).__ATLAS_DISSECTING__ = true;
  }

  this.transitionTo('FLIGHT_TRANSITION', 1);
  this.showHud('🎯 FOCUSING STRUCTURE', `Focusing <span class="omni-hud-target-name">${this.targetName}</span> • Surrounding anatomy ghosted.`);
  audio.play(880, 0.09, 'sine', 0.15);
 }

 // ── Restore (Back to whole body overview) ───────────────────────────
 restore() {
  this.reconstitute();
 }

 reconstitute() {
  if (!this.deps) return;
  if (this.state === 'IDLE') return;

  // Start smooth camera flight back to full body overview
  this.startCamPos.copy(this.deps.camera.position);
  this.startCamTarget.copy(this.deps.controls.target);

  // Calculate return midpoint arc
  const returnDist = this.startCamPos.distanceTo(this.fullBodyPos);
  this.flightMidCam.lerpVectors(this.startCamPos, this.fullBodyPos, 0.5);
  this.flightMidCam.y += Math.min(0.22, returnDist * 0.12);

  // Temporarily lock controls during flight
  this.deps.controls.enabled = false;

  this.active = true;
  this.elapsed = 0;
  this.transitionTo('RESTORE_TRANSITION', 5);
  this.showHud('🌐 WHOLE BODY', 'Restoring complete human atlas to 100% solid opacity...');
  audio.play(523.25, 0.12, 'sine', 0.18);
 }

 // ── Jump directly to solo lock (Instant Finish) ──────────────────────
 instantFinish() {
  if (!this.deps || !this.targetPart) return;
  this.elapsed = TRANSITION_DUR;
  this.finishFocus();
 }

 // ── Seek to precise timestamp (for scrubbing / testing) ─────────────
 seek(targetElapsed: number) {
  if (!this.active) return;
  this.elapsed = targetElapsed;
  this.update(0);
 }

 // ── Per-frame update (called from scene animation loop) ─────────────
 update(dt: number) {
  if (!this.active || this.state === 'IDLE') return;

  if (this.state === 'FOCUSED') {
   return;
  }

  this.elapsed += dt;

  if (this.state === 'FLIGHT_TRANSITION') {
   const p = Math.min(1.0, this.elapsed / TRANSITION_DUR);
   const ease = easeInOutCubic(p);

   const {camera, controls, atlas, alphaData, partAlphas} = this.deps;

   // 1. Smoothly glide camera and controls along curved path
   quadBezier(this.startCamPos, this.flightMidCam, this.targetCamPos, ease, camera.position);
   controls.target.lerpVectors(this.startCamTarget, this.targetCentroid, ease);
   controls.update();

   // 2. Smoothly animate opacity cross-fade & cool X-ray glass tint
   const curGhostAlpha = T.MathUtils.lerp(this.startGhostAlpha, GHOST_OPACITY, ease);
   const curGhostFactor = T.MathUtils.lerp(this.startGhostFactor, 1.0, ease);

   if (alphaData) {
    for (let i = 0; i < atlas.parts.length; i++) {
     if (this.targetIndices.includes(i)) {
      // Target part rendered solid & vibrant in focusGroup; zero on merged mesh to prevent z-fighting
      alphaData[i * 4] = 0.0;
      alphaData[i * 4 + 1] = 0.0;
      alphaData[i * 4 + 2] = 1.0;
      partAlphas[i] = 1.0;
     } else {
      // Surrounding parts smoothly cross-fade into semi-transparent ~18% opacity with cool X-ray tint
      alphaData[i * 4] = curGhostAlpha;
      alphaData[i * 4 + 1] = curGhostFactor;
      alphaData[i * 4 + 2] = 0.0;
      partAlphas[i] = curGhostAlpha;
     }
    }
   }

   if (this.deps.alphaTexture) {
    this.deps.alphaTexture.needsUpdate = true;
   }

   if (p >= 1.0) {
    this.finishFocus();
   }
  } else if (this.state === 'RESTORE_TRANSITION') {
   const p = Math.min(1.0, this.elapsed / RESTORE_DUR);
   const ease = easeInOutCubic(p);

   const {camera, controls, atlas, alphaData, partAlphas} = this.deps;

   // 1. Smoothly glide camera back out to full body overview
   quadBezier(this.startCamPos, this.flightMidCam, this.fullBodyPos, ease, camera.position);
   controls.target.lerpVectors(this.startCamTarget, this.fullBodyTarget, ease);
   controls.update();

   // 2. Smoothly animate opacity cross-fade back to 100% solid opacity
   const curGhostAlpha = T.MathUtils.lerp(GHOST_OPACITY, 1.0, ease);
   const curGhostFactor = T.MathUtils.lerp(1.0, 0.0, ease);

   if (alphaData) {
    for (let i = 0; i < atlas.parts.length; i++) {
     alphaData[i * 4] = curGhostAlpha;
     alphaData[i * 4 + 1] = curGhostFactor;
     alphaData[i * 4 + 2] = 0.0;
     partAlphas[i] = curGhostAlpha;
    }
   }

   if (this.deps.alphaTexture) {
    this.deps.alphaTexture.needsUpdate = true;
   }

   if (p >= 1.0) {
    this.finishRestore();
   }
  }
 }

 private finishFocus() {
  const {camera, controls} = this.deps;
  camera.position.copy(this.targetCamPos);
  controls.target.copy(this.targetCentroid);
  controls.enabled = true; // Unlock orbit controls centered on target
  controls.update();

  this.active = false;
  this.transitionTo('FOCUSED', 4);
  this.showHud('🔒 FOCUSED LOCK', `<strong>${this.targetName}</strong> (${this.targetPart?.conceptId || 'FMA'}) in focused inspection.`);
  this.hideHud(2500);
  audio.play(1318.5, 0.12, 'sine', 0.20);

  if (typeof window !== 'undefined') {
   (window as unknown as Record<string, unknown>).__ATLAS_DISSECTING__ = false;
  }
  this.deps.onRequestIsolate(this.targetIndices);
 }

 private finishRestore() {
  const {controls, atlas, alphaData, partAlphas} = this.deps;
  controls.enabled = true;
  controls.update();

  // Clear focusGroup
  this.clearFocusGroup();

  // Restore depthWrite on merged mesh materials
  this.deps.materials?.forEach(m => { m.depthWrite = true; });

  // Fully restore all parts to 100% solid opacity & natural colors
  partAlphas.fill(1.0);
  if (alphaData) {
   for (let i = 0; i < atlas.parts.length; i++) {
    alphaData[i * 4] = 1.0;
    alphaData[i * 4 + 1] = 0.0;
    alphaData[i * 4 + 2] = 0.0;
    alphaData[i * 4 + 3] = 1.0;
   }
  }
  if (this.deps.alphaTexture) {
   this.deps.alphaTexture.needsUpdate = true;
  }

  this.targetIndices = [];
  this.targetIndex = -1;
  this.targetPart = null;
  this.targetId = null;

  this.active = false;
  this.elapsed = 0;
  if (typeof window !== 'undefined') {
   (window as unknown as Record<string, unknown>).__ATLAS_DISSECTING__ = false;
  }
  this.transitionTo('IDLE', 0);
  this.deps.onRequestRestore();
  this.showHud('🌐 WHOLE BODY', 'Full human atlas restored to 100% solid opacity.');
  this.hideHud(2000);
 }

 // ── Focus Group Management (Solid, vibrant, fully opaque target mesh) 
 private updateFocusGroup(targetIndices: number[]) {
  this.clearFocusGroup();
  if (!this.focusGroup || targetIndices.length === 0) return;

  const {atlas, pickers, colorData} = this.deps;
  for (const idx of targetIndices) {
   const part = atlas.parts[idx];
   const picker = pickers?.[idx];
   if (!part || !picker || !picker.geometry) continue;

   const hasCustomColor = colorData && colorData[idx * 4 + 3] > 0.05;
   const baseColor = hasCustomColor && colorData
    ? new T.Color(colorData[idx * 4], colorData[idx * 4 + 1], colorData[idx * 4 + 2])
    : new T.Color(SYSTEMS.find(s => s.id === part.system)?.color ?? '#aebbb8');

   // Fully opaque, vibrantly lit PBR material with authentic anatomical color
   const focusMat = new T.MeshStandardMaterial({
    color: baseColor,
    metalness: 0.06,
    roughness: 0.36,
    emissive: baseColor.clone().multiplyScalar(0.25), // Vibrant radiance
    transparent: false,
    opacity: 1.0,
    depthWrite: true,
    depthTest: true,
    side: T.DoubleSide
   });

   const mesh = new T.Mesh(picker.geometry, focusMat);
   mesh.position.copy(picker.position);
   mesh.renderOrder = 0;
   this.focusGroup.add(mesh);
  }
 }

 private clearFocusGroup() {
  if (!this.focusGroup) return;
  while (this.focusGroup.children.length > 0) {
   const obj = this.focusGroup.children[0] as T.Mesh;
   this.focusGroup.remove(obj);
   if (obj.material) {
    if (Array.isArray(obj.material)) obj.material.forEach(m => m.dispose());
    else (obj.material as T.Material).dispose();
   }
  }
 }

 getBeacon() { return null; }

 // ── Interrupt ────────────────────────────────────────────────────────
 interrupt() {
  this.active = false;
  this.phase = 0;
  if (this.hudHideTimer) clearTimeout(this.hudHideTimer);
  this.clearFocusGroup();

  if (this.deps) {
   this.deps.controls.enabled = this.savedControlsEnabled;
   this.deps.materials?.forEach(m => { m.depthWrite = true; });
   this.deps.partAlphas.fill(1.0);
   if (this.deps.alphaData) {
    for (let i = 0; i < this.deps.atlas.parts.length; i++) {
     this.deps.alphaData[i * 4] = 1.0;
     this.deps.alphaData[i * 4 + 1] = 0.0;
     this.deps.alphaData[i * 4 + 2] = 0.0;
     this.deps.alphaData[i * 4 + 3] = 1.0;
    }
   }
   if (this.deps.alphaTexture) {
    this.deps.alphaTexture.needsUpdate = true;
   }
   this.deps.onHudUpdate(null);
  }

  if (typeof window !== 'undefined') {
   (window as unknown as Record<string, unknown>).__ATLAS_DISSECTING__ = false;
  }

  this.transitionTo('IDLE', 0);
 }

 // ── Dispose ─────────────────────────────────────────────────────────
 dispose() {
  this.interrupt();
  if (this.focusGroup) {
   this.clearFocusGroup();
   this.focusGroup.removeFromParent();
   this.focusGroup = null;
  }
 }

 // ── Private: State Transition ────────────────────────────────────────
 private transitionTo(next: DissectorState, phaseNum: number) {
  this.state = next;
  this.phase = phaseNum;
  this.deps?.onStateChange(next);
 }

 // ── Query Methods ────────────────────────────────────────────────────
 isFocused() {
  return this.state === 'FOCUSED' || this.state === 'FLIGHT_TRANSITION' || this.state === 'ACT_4_SOLO_LOCK';
 }

 isActive() {
  return this.active || this.state !== 'IDLE';
 }

 isControlsLocked() {
  return this.active && (this.state === 'FLIGHT_TRANSITION' || this.state === 'RESTORE_TRANSITION');
 }
}

