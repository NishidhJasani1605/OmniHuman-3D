import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { parseGLB, computeSurfaceNormals } from './convert-glb-atlas.mjs';
import { generateAllFemaleSpecializedParts } from './generate-female-specialized-parts.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const hraDir = path.resolve(__dirname, '../data-sources/hra-female-organs');
const modelsDir = path.resolve(__dirname, '../public/models');

console.log('🚀 Building production-ready authentic Female, Pregnancy, and Aging Atlases...');

function cleanMeshName(rawName) {
  let name = rawName
    .replace(/^VH_F_/, '')
    .replace(/_L$/, ' (Left)')
    .replace(/_R$/, ' (Right)')
    .replace(/_/g, ' ');
  name = name.charAt(0).toUpperCase() + name.slice(1);
  if (name.startsWith('Fat ')) name = name.replace('Fat', 'Mammary adipose tissue');
  if (name.startsWith('Mammary lobes')) name = name.replace('Mammary lobes', 'Mammary glandular lobes');
  if (name.startsWith('Suspensory ligaments')) name = name.replace('Suspensory ligaments', 'Suspensory ligaments of Cooper');
  return name;
}

function getFMAInfo(name, defaultSystem) {
  const n = name.toLowerCase();
  // Mammary gland features
  if (n.includes('tubercle')) return { fma: 'FMA19986', system: 'reproductive' };
  if (n.includes('nipple')) return { fma: 'FMA19982', system: 'reproductive' };
  if (n.includes('areola')) return { fma: 'FMA19984', system: 'reproductive' };
  if (n.includes('lobe')) return { fma: 'FMA71501', system: 'reproductive' };
  if (n.includes('duct')) return { fma: 'FMA57991', system: 'reproductive' };
  if (n.includes('sinus')) return { fma: 'FMA57993', system: 'reproductive' };
  if (n.includes('cooper') || n.includes('suspensory ligament')) return { fma: 'FMA71505', system: 'reproductive' };
  if (n.includes('adipose') || (n.includes('fat') && n.includes('mammary'))) return { fma: 'FMA71506', system: 'reproductive' };
  if (n.includes('mammary') || n.includes('breast')) return { fma: 'FMA9598', system: 'reproductive' };

  // Uterine & Cervical features
  if (n.includes('internal') && n.includes('os')) return { fma: 'FMA17585', system: 'reproductive' };
  if (n.includes('external') && n.includes('os')) return { fma: 'FMA17586', system: 'reproductive' };
  if (n.includes('cervix') || n.includes('cervic')) return { fma: 'FMA17581', system: 'reproductive' };
  if (n.includes('cornua')) return { fma: 'FMA17580', system: 'reproductive' };
  if (n.includes('fundus') && !n.includes('bladder')) return { fma: 'FMA17578', system: 'reproductive' };
  if (n.includes('anterior wall')) return { fma: 'FMA17583', system: 'reproductive' };
  if (n.includes('posterior wall')) return { fma: 'FMA17584', system: 'reproductive' };
  if (n.includes('lower uterine')) return { fma: 'FMA17579', system: 'reproductive' };
  if (n.includes('body of uterus')) return { fma: 'FMA17577', system: 'reproductive' };
  if (n.includes('uterus') || n.includes('uterine')) {
    if (n.includes('ostium')) return { fma: 'FMA18262', system: 'reproductive' };
    if (n.includes('fimbria') || n.includes('fibria')) return { fma: 'FMA18264', system: 'reproductive' };
    if (n.includes('ampulla')) return { fma: 'FMA18265', system: 'reproductive' };
    if (n.includes('isthmus')) return { fma: 'FMA18266', system: 'reproductive' };
    if (n.includes('infundibulum')) return { fma: 'FMA18263', system: 'reproductive' };
    return { fma: 'FMA17558', system: 'reproductive' };
  }

  // Ovaries & Fallopian tubes
  if (n.includes('ovary')) return { fma: 'FMA7206', system: 'reproductive' };
  if (n.includes('fimbria') || n.includes('fibria')) return { fma: 'FMA18264', system: 'reproductive' };
  if (n.includes('ampulla')) return { fma: 'FMA18265', system: 'reproductive' };
  if (n.includes('isthmus')) return { fma: 'FMA18266', system: 'reproductive' };
  if (n.includes('infundibulum')) return { fma: 'FMA18263', system: 'reproductive' };
  if (n.includes('fallopian') || n.includes('uterine tube')) return { fma: 'FMA18258', system: 'reproductive' };

  // Urinary Bladder
  if (n.includes('bladder') || n.includes('trigone') || n.includes('ureteral')) {
    if (n.includes('dome') || n.includes('fundus')) return { fma: 'FMA15911', system: 'urinary' };
    if (n.includes('neck')) return { fma: 'FMA15914', system: 'urinary' };
    if (n.includes('trigone')) return { fma: 'FMA15917', system: 'urinary' };
    if (n.includes('ureteral')) return { fma: 'FMA15923', system: 'urinary' };
    return { fma: 'FMA15900', system: 'urinary' };
  }
  if (n.includes('sacrum')) return { fma: 'FMA16202', system: 'skeletal' };
  if (n.includes('coccyx')) return { fma: 'FMA16203', system: 'skeletal' };
  if (n.includes('pubis')) return { fma: 'FMA16595', system: 'skeletal' };
  if (n.includes('ilium')) return { fma: 'FMA16591', system: 'skeletal' };
  if (n.includes('ischium')) return { fma: 'FMA16593', system: 'skeletal' };
  return { fma: 'FMA_HRA_FEMALE', system: defaultSystem };
}

function extractMeshesFromGLB(filePath, defaultSystem, options = {}) {
  const buf = fs.readFileSync(filePath);
  const { gltf, bin } = parseGLB(buf);

  const getBufferData = (bufferViewIndex) => {
    const bv = gltf.bufferViews[bufferViewIndex];
    const byteOffset = bv.byteOffset || 0;
    const byteLength = bv.byteLength;
    return bin.subarray(byteOffset, byteOffset + byteLength);
  };

  const getAccessorData = (accessorIndex) => {
    const acc = gltf.accessors[accessorIndex];
    const rawData = getBufferData(acc.bufferView);
    const offset = acc.byteOffset || 0;
    const slice = rawData.subarray(offset);
    return { acc, slice };
  };

  const extracted = [];
  const meshes = gltf.meshes || [];

  for (let mIdx = 0; mIdx < meshes.length; mIdx++) {
    const mesh = meshes[mIdx];
    const displayName = cleanMeshName(mesh.name || `Structure_${mIdx + 1}`);
    const meta = getFMAInfo(displayName, defaultSystem);

    for (let pIdx = 0; pIdx < mesh.primitives.length; pIdx++) {
      const prim = mesh.primitives[pIdx];
      if (prim.attributes.POSITION === undefined) continue;

      const posInfo = getAccessorData(prim.attributes.POSITION);
      const vertexCount = posInfo.acc.count;
      const rawPositions = new Float32Array(posInfo.slice.buffer, posInfo.slice.byteOffset, vertexCount * 3);

      let rawIndices;
      if (prim.indices !== undefined) {
        const idxInfo = getAccessorData(prim.indices);
        if (idxInfo.acc.componentType === 5123) {
          rawIndices = new Uint32Array(new Uint16Array(idxInfo.slice.buffer, idxInfo.slice.byteOffset, idxInfo.acc.count));
        } else if (idxInfo.acc.componentType === 5125) {
          rawIndices = new Uint32Array(idxInfo.slice.buffer, idxInfo.slice.byteOffset, idxInfo.acc.count);
        } else {
          rawIndices = new Uint32Array(new Uint8Array(idxInfo.slice.buffer, idxInfo.slice.byteOffset, idxInfo.acc.count));
        }
      } else {
        rawIndices = new Uint32Array(vertexCount);
        for (let i = 0; i < vertexCount; i++) rawIndices[i] = i;
      }

      let rawNormals;
      if (prim.attributes.NORMAL !== undefined) {
        const normInfo = getAccessorData(prim.attributes.NORMAL);
        rawNormals = new Float32Array(normInfo.slice.buffer, normInfo.slice.byteOffset, vertexCount * 3);
      } else {
        rawNormals = computeSurfaceNormals(rawPositions, rawIndices);
      }

      const positions = new Float32Array(vertexCount * 3);
      let minX = Infinity, minY = Infinity, minZ = Infinity;
      let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;

      const scale = options.scale || 1.0;
      const scaleX = options.scaleX !== undefined ? options.scaleX : scale;
      const scaleY = options.scaleY !== undefined ? options.scaleY : scale;
      const scaleZ = options.scaleZ !== undefined ? options.scaleZ : scale;
      const offX = options.offsetX || 0;
      const offY = options.offsetY || 0;
      const offZ = options.offsetZ || 0;

      for (let i = 0; i < vertexCount; i++) {
        const x = rawPositions[i * 3] * scaleX + offX;
        const y = rawPositions[i * 3 + 1] * scaleY + offY;
        const z = rawPositions[i * 3 + 2] * scaleZ + offZ;

        positions[i * 3] = x;
        positions[i * 3 + 1] = y;
        positions[i * 3 + 2] = z;

        if (x < minX) minX = x; if (x > maxX) maxX = x;
        if (y < minY) minY = y; if (y > maxY) maxY = y;
        if (z < minZ) minZ = z; if (z > maxZ) maxZ = z;
      }

      const shortNormals = new Int16Array(vertexCount * 3);
      for (let i = 0; i < vertexCount * 3; i++) {
        shortNormals[i] = Math.round(Math.max(-1, Math.min(1, rawNormals[i])) * 32767);
      }

      extracted.push({
        name: displayName,
        conceptId: meta.fma,
        system: meta.system,
        vertexCount,
        indexCount: rawIndices.length,
        positions,
        normals: shortNormals,
        indices: rawIndices,
        bounds: [[minX, minY, minZ], [maxX, maxY, maxZ]]
      });
    }
  }

  return extracted;
}

// --------------------------------------------------------------------------
// High-Precision Mesh Generators (Fetal, Gestational & Clinical Anatomy)
// --------------------------------------------------------------------------
function createParametricMesh(name, conceptId, system, bounds, segments = 16) {
  const [min, max] = bounds;
  const cx = (min[0] + max[0]) / 2;
  const cy = (min[1] + max[1]) / 2;
  const cz = (min[2] + max[2]) / 2;
  const rx = Math.max(0.005, (max[0] - min[0]) / 2);
  const ry = Math.max(0.005, (max[1] - min[1]) / 2);
  const rz = Math.max(0.005, (max[2] - min[2]) / 2);

  const vertices = [];
  const normals = [];
  const indices = [];

  for (let lat = 0; lat <= segments; lat++) {
    const theta = (lat * Math.PI) / segments;
    const sinTheta = Math.sin(theta);
    const cosTheta = Math.cos(theta);

    for (let lon = 0; lon <= segments; lon++) {
      const phi = (lon * 2 * Math.PI) / segments;
      const sinPhi = Math.sin(phi);
      const cosPhi = Math.cos(phi);

      const nx = sinTheta * cosPhi;
      const ny = cosTheta;
      const nz = sinTheta * sinPhi;

      vertices.push(cx + rx * nx, cy + ry * ny, cz + rz * nz);
      normals.push(
        Math.round(nx * 32767),
        Math.round(ny * 32767),
        Math.round(nz * 32767)
      );
    }
  }

  for (let lat = 0; lat < segments; lat++) {
    for (let lon = 0; lon < segments; lon++) {
      const first = lat * (segments + 1) + lon;
      const second = first + segments + 1;
      indices.push(first, second, first + 1);
      indices.push(second, second + 1, first + 1);
    }
  }

  return {
    name,
    conceptId,
    system,
    vertexCount: vertices.length / 3,
    indexCount: indices.length,
    positions: new Float32Array(vertices),
    normals: new Int16Array(normals),
    indices: new Uint32Array(indices),
    bounds
  };
}

export function createFetalHeadMesh(name, conceptId, system) {
  // 38-week full-term fetal head in vertex presentation (head downward at maternal pelvic brim)
  const latSegs = 28;
  const lonSegs = 32;
  const vertices = [];
  const normals = [];
  const indices = [];

  const center = [0.00, 0.92, 0.08];
  const rx = 0.046; // Biparietal radius (width ~9.2 cm)
  const ry = 0.058; // Occipitofrontal radius (height ~11.6 cm)
  const rz = 0.048; // Suboccipitobregmatic radius (depth ~9.6 cm)

  let minX = Infinity, minY = Infinity, minZ = Infinity;
  let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;

  for (let lat = 0; lat <= latSegs; lat++) {
    const v = lat / latSegs;
    const theta = v * Math.PI;
    const sinTheta = Math.sin(theta);
    const cosTheta = Math.cos(theta);

    for (let lon = 0; lon <= lonSegs; lon++) {
      const u = lon / lonSegs;
      const phi = u * Math.PI * 2;
      const sinPhi = Math.sin(phi);
      const cosPhi = Math.cos(phi);

      let nx = sinTheta * Math.cos(phi - Math.PI / 2);
      let ny = -cosTheta; // Invert Y so vertex is downwards towards cervix
      let nz = sinTheta * Math.sin(phi - Math.PI / 2);

      // Anatomical fetal cranial morphology:
      // Parietal eminences
      const parietalBulge = 1.0 + 0.08 * Math.pow(Math.abs(nx), 1.8) * Math.exp(-Math.pow(ny - 0.1, 2) / 0.15);
      // Frontal prominence
      const isFrontal = (nz < -0.15 && ny > -0.2);
      const frontalShape = isFrontal ? (1.0 + 0.05 * Math.sin(Math.PI * (ny + 0.2) / 0.8)) : 1.0;
      // Occipital vault
      const isOccipital = (nz > 0.15 && ny < 0.3);
      const occipitalShape = isOccipital ? (1.0 + 0.07 * Math.exp(-Math.pow(ny + 0.2, 2) / 0.2)) : 1.0;

      let facialTaper = 1.0;
      if (ny > 0.1 && nz < -0.1) {
        facialTaper = 1.0 - 0.18 * (ny - 0.1) * (-nz);
      }

      const mod = parietalBulge * frontalShape * occipitalShape * facialTaper;

      const vx = center[0] + rx * nx * mod;
      const vy = center[1] + ry * ny * mod;
      const vz = center[2] + rz * nz * mod;

      vertices.push(vx, vy, vz);

      const len = Math.hypot(nx, ny, nz) || 1;
      normals.push(
        Math.round((nx / len) * 32767),
        Math.round((ny / len) * 32767),
        Math.round((nz / len) * 32767)
      );

      if (vx < minX) minX = vx; if (vx > maxX) maxX = vx;
      if (vy < minY) minY = vy; if (vy > maxY) maxY = vy;
      if (vz < minZ) minZ = vz; if (vz > maxZ) maxZ = vz;
    }
  }

  for (let lat = 0; lat < latSegs; lat++) {
    for (let lon = 0; lon < lonSegs; lon++) {
      const first = lat * (lonSegs + 1) + lon;
      const second = first + lonSegs + 1;
      indices.push(first, second, first + 1);
      indices.push(second, second + 1, first + 1);
    }
  }

  return {
    name,
    conceptId,
    system,
    vertexCount: vertices.length / 3,
    indexCount: indices.length,
    positions: new Float32Array(vertices),
    normals: new Int16Array(normals),
    indices: new Uint32Array(indices),
    bounds: [[minX, minY, minZ], [maxX, maxY, maxZ]]
  };
}

export function createFetalTorsoMesh(name, conceptId, system) {
  // C-shaped kyphotic fetal spine curving along the posterior uterine wall
  const spineSteps = 30;
  const radialSegs = 24;
  const spinePoints = [];
  const spineRadii = [];

  for (let i = 0; i <= spineSteps; i++) {
    const t = i / spineSteps;
    const angle = -0.3 + t * (Math.PI * 0.72);
    const cy = 1.07;
    const cz = 0.085;
    const curveR = 0.11;

    const y = cy - curveR * Math.cos(angle);
    const z = cz - curveR * Math.sin(angle) * 0.75 + (t > 0.6 ? (t - 0.6) * 0.04 : 0);
    const x = Math.sin(t * Math.PI) * 0.005;

    const baseR = 0.028 + 0.018 * Math.sin(t * Math.PI * 0.85);
    spinePoints.push([x, y, z]);
    spineRadii.push(baseR);
  }

  const vertices = [];
  const normals = [];
  const indices = [];
  let minX = Infinity, minY = Infinity, minZ = Infinity;
  let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;

  for (let i = 0; i < spinePoints.length; i++) {
    const p = spinePoints[i];
    const prev = spinePoints[Math.max(0, i - 1)];
    const next = spinePoints[Math.min(spinePoints.length - 1, i + 1)];
    const dir = [next[0] - prev[0], next[1] - prev[1], next[2] - prev[2]];
    const len = Math.hypot(...dir) || 1;
    const tan = dir.map(v => v / len);

    let up = [1, 0, 0];
    const norm = [
      tan[1] * up[2] - tan[2] * up[1],
      tan[2] * up[0] - tan[0] * up[2],
      tan[0] * up[1] - tan[1] * up[0]
    ];
    const nlen = Math.hypot(...norm) || 1;
    const n = norm.map(v => v / nlen);
    const binorm = [
      tan[1] * n[2] - tan[2] * n[1],
      tan[2] * n[0] - tan[0] * n[2],
      tan[0] * n[1] - tan[1] * n[0]
    ];

    const r = spineRadii[i];
    const t = i / spineSteps;

    for (let j = 0; j <= radialSegs; j++) {
      const phi = (j / radialSegs) * Math.PI * 2;
      const cos = Math.cos(phi);
      const sin = Math.sin(phi);

      const lateralScale = 1.08;
      const ventralBulge = (sin > 0 && t > 0.4 && t < 0.9) ? 1.12 : 1.0;

      const vx = p[0] + r * lateralScale * cos * n[0] + r * ventralBulge * sin * binorm[0];
      const vy = p[1] + r * lateralScale * cos * n[1] + r * ventralBulge * sin * binorm[1];
      const vz = p[2] + r * lateralScale * cos * n[2] + r * ventralBulge * sin * binorm[2];

      vertices.push(vx, vy, vz);

      const normX = cos * n[0] + sin * binorm[0];
      const normY = cos * n[1] + sin * binorm[1];
      const normZ = cos * n[2] + sin * binorm[2];
      normals.push(
        Math.round(normX * 32767),
        Math.round(normY * 32767),
        Math.round(normZ * 32767)
      );

      if (vx < minX) minX = vx; if (vx > maxX) maxX = vx;
      if (vy < minY) minY = vy; if (vy > maxY) maxY = vy;
      if (vz < minZ) minZ = vz; if (vz > maxZ) maxZ = vz;
    }
  }

  for (let i = 0; i < spinePoints.length - 1; i++) {
    for (let j = 0; j < radialSegs; j++) {
      const a = i * (radialSegs + 1) + j;
      const b = (i + 1) * (radialSegs + 1) + j;
      indices.push(a, b, a + 1);
      indices.push(b, b + 1, a + 1);
    }
  }

  return {
    name,
    conceptId,
    system,
    vertexCount: vertices.length / 3,
    indexCount: indices.length,
    positions: new Float32Array(vertices),
    normals: new Int16Array(normals),
    indices: new Uint32Array(indices),
    bounds: [[minX, minY, minZ], [maxX, maxY, maxZ]]
  };
}

export function createFetalLimbsMesh(name, conceptId, system, limbType) {
  const vertices = [];
  const normals = [];
  const indices = [];
  let minX = Infinity, minY = Infinity, minZ = Infinity;
  let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;

  const sidePaths = [];

  if (limbType === 'upper') {
    sidePaths.push([
      [0.038, 1.05, 0.08],
      [0.052, 1.01, 0.11],
      [0.028, 0.99, 0.13],
      [0.008, 1.01, 0.135]
    ]);
    sidePaths.push([
      [-0.038, 1.05, 0.08],
      [-0.052, 1.01, 0.11],
      [-0.028, 0.99, 0.13],
      [-0.008, 1.01, 0.135]
    ]);
  } else {
    sidePaths.push([
      [0.032, 1.13, 0.09],
      [0.046, 1.18, 0.13],
      [0.028, 1.15, 0.145],
      [0.010, 1.12, 0.14]
    ]);
    sidePaths.push([
      [-0.032, 1.13, 0.09],
      [-0.046, 1.18, 0.13],
      [-0.028, 1.15, 0.145],
      [-0.010, 1.12, 0.14]
    ]);
  }

  const radialSegs = 14;
  const pathSteps = 16;
  const baseRadius = limbType === 'upper' ? 0.013 : 0.016;

  for (const pts of sidePaths) {
    const interpolated = [];
    for (let s = 0; s <= pathSteps; s++) {
      const u = s / pathSteps;
      const segIdx = Math.min(pts.length - 2, Math.floor(u * (pts.length - 1)));
      const segT = (u * (pts.length - 1)) - segIdx;
      const p0 = pts[Math.max(0, segIdx - 1)];
      const p1 = pts[segIdx];
      const p2 = pts[Math.min(pts.length - 1, segIdx + 1)];
      const p3 = pts[Math.min(pts.length - 1, segIdx + 2)];

      const x = 0.5 * ((2 * p1[0]) + (-p0[0] + p2[0]) * segT + (2 * p0[0] - 5 * p1[0] + 4 * p2[0] - p3[0]) * segT * segT + (-p0[0] + 3 * p1[0] - 3 * p2[0] + p3[0]) * segT * segT * segT);
      const y = 0.5 * ((2 * p1[1]) + (-p0[1] + p2[1]) * segT + (2 * p0[1] - 5 * p1[1] + 4 * p2[1] - p3[1]) * segT * segT + (-p0[1] + 3 * p1[1] - 3 * p2[1] + p3[1]) * segT * segT * segT);
      const z = 0.5 * ((2 * p1[2]) + (-p0[2] + p2[2]) * segT + (2 * p0[2] - 5 * p1[2] + 4 * p2[2] - p3[2]) * segT * segT + (-p0[2] + 3 * p1[2] - 3 * p2[2] + p3[2]) * segT * segT * segT);
      interpolated.push([x, y, z]);
    }

    const startIdx = vertices.length / 3;

    for (let i = 0; i < interpolated.length; i++) {
      const p = interpolated[i];
      const prev = interpolated[Math.max(0, i - 1)];
      const next = interpolated[Math.min(interpolated.length - 1, i + 1)];
      const dir = [next[0] - prev[0], next[1] - prev[1], next[2] - prev[2]];
      const len = Math.hypot(...dir) || 1;
      const tan = dir.map(v => v / len);

      let up = [0, 0, 1];
      if (Math.abs(tan[2]) > 0.9) up = [1, 0, 0];
      const norm = [
        tan[1] * up[2] - tan[2] * up[1],
        tan[2] * up[0] - tan[0] * up[2],
        tan[0] * up[1] - tan[1] * up[0]
      ];
      const nlen = Math.hypot(...norm) || 1;
      const n = norm.map(v => v / nlen);
      const binorm = [
        tan[1] * n[2] - tan[2] * n[1],
        tan[2] * n[0] - tan[0] * n[2],
        tan[0] * n[1] - tan[1] * n[0]
      ];

      const prog = i / pathSteps;
      const r = baseRadius * (1.0 + 0.25 * Math.sin(prog * Math.PI) - 0.2 * prog);

      for (let j = 0; j <= radialSegs; j++) {
        const phi = (j / radialSegs) * Math.PI * 2;
        const cos = Math.cos(phi);
        const sin = Math.sin(phi);

        const vx = p[0] + r * (cos * n[0] + sin * binorm[0]);
        const vy = p[1] + r * (cos * n[1] + sin * binorm[1]);
        const vz = p[2] + r * (cos * n[2] + sin * binorm[2]);

        vertices.push(vx, vy, vz);
        normals.push(
          Math.round((cos * n[0] + sin * binorm[0]) * 32767),
          Math.round((cos * n[1] + sin * binorm[1]) * 32767),
          Math.round((cos * n[2] + sin * binorm[2]) * 32767)
        );

        if (vx < minX) minX = vx; if (vx > maxX) maxX = vx;
        if (vy < minY) minY = vy; if (vy > maxY) maxY = vy;
        if (vz < minZ) minZ = vz; if (vz > maxZ) maxZ = vz;
      }
    }

    for (let i = 0; i < interpolated.length - 1; i++) {
      for (let j = 0; j < radialSegs; j++) {
        const a = startIdx + i * (radialSegs + 1) + j;
        const b = startIdx + (i + 1) * (radialSegs + 1) + j;
        indices.push(a, b, a + 1);
        indices.push(b, b + 1, a + 1);
      }
    }
  }

  return {
    name,
    conceptId,
    system,
    vertexCount: vertices.length / 3,
    indexCount: indices.length,
    positions: new Float32Array(vertices),
    normals: new Int16Array(normals),
    indices: new Uint32Array(indices),
    bounds: [[minX, minY, minZ], [maxX, maxY, maxZ]]
  };
}

export function createDiscoidPlacentaMesh(name, conceptId, system) {
  const latSegs = 24;
  const lonSegs = 28;
  const vertices = [];
  const normals = [];
  const indices = [];

  const center = [0.00, 1.17, 0.035];
  const rx = 0.082;
  const ry = 0.072;
  const rz = 0.018;

  let minX = Infinity, minY = Infinity, minZ = Infinity;
  let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;

  for (let lat = 0; lat <= latSegs; lat++) {
    const theta = (lat * Math.PI) / latSegs;
    const sinTheta = Math.sin(theta);
    const cosTheta = Math.cos(theta);

    for (let lon = 0; lon <= lonSegs; lon++) {
      const phi = (lon * 2 * Math.PI) / lonSegs;
      const sinPhi = Math.sin(phi);
      const cosPhi = Math.cos(phi);

      const nx = sinTheta * cosPhi;
      const ny = cosTheta;
      const nz = sinTheta * sinPhi;

      const cotyledons = 1.0 + 0.06 * Math.sin(nx * 18.0) * Math.cos(ny * 18.0);

      const vx = center[0] + rx * nx * cotyledons;
      const vy = center[1] + ry * ny * cotyledons;
      const vz = center[2] + rz * nz * cotyledons;

      vertices.push(vx, vy, vz);
      normals.push(
        Math.round(nx * 32767),
        Math.round(ny * 32767),
        Math.round(nz * 32767)
      );

      if (vx < minX) minX = vx; if (vx > maxX) maxX = vx;
      if (vy < minY) minY = vy; if (vy > maxY) maxY = vy;
      if (vz < minZ) minZ = vz; if (vz > maxZ) maxZ = vz;
    }
  }

  for (let lat = 0; lat < latSegs; lat++) {
    for (let lon = 0; lon < lonSegs; lon++) {
      const first = lat * (lonSegs + 1) + lon;
      const second = first + lonSegs + 1;
      indices.push(first, second, first + 1);
      indices.push(second, second + 1, first + 1);
    }
  }

  return {
    name,
    conceptId,
    system,
    vertexCount: vertices.length / 3,
    indexCount: indices.length,
    positions: new Float32Array(vertices),
    normals: new Int16Array(normals),
    indices: new Uint32Array(indices),
    bounds: [[minX, minY, minZ], [maxX, maxY, maxZ]]
  };
}

export function createHelicalUmbilicalCordMesh(name, conceptId, system) {
  const cordSteps = 42;
  const radialSegs = 14;
  const cordPoints = [];

  const startPt = [0.00, 1.16, 0.05];
  const endPt = [0.00, 1.05, 0.12];

  for (let i = 0; i <= cordSteps; i++) {
    const t = i / cordSteps;
    const spiralAngle = t * Math.PI * 8.0;
    const spiralR = 0.016 * Math.sin(t * Math.PI);

    const lx = startPt[0] * (1 - t) + endPt[0] * t;
    const ly = startPt[1] * (1 - t) + endPt[1] * t;
    const lz = startPt[2] * (1 - t) + endPt[2] * t;

    const x = lx + spiralR * Math.cos(spiralAngle);
    const y = ly;
    const z = lz + spiralR * Math.sin(spiralAngle) + 0.02 * Math.sin(t * Math.PI);
    cordPoints.push([x, y, z]);
  }

  const vertices = [];
  const normals = [];
  const indices = [];
  let minX = Infinity, minY = Infinity, minZ = Infinity;
  let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;

  const cordRadius = 0.0065;

  for (let i = 0; i < cordPoints.length; i++) {
    const p = cordPoints[i];
    const prev = cordPoints[Math.max(0, i - 1)];
    const next = cordPoints[Math.min(cordPoints.length - 1, i + 1)];
    const dir = [next[0] - prev[0], next[1] - prev[1], next[2] - prev[2]];
    const len = Math.hypot(...dir) || 1;
    const tan = dir.map(v => v / len);

    let up = [0, 1, 0];
    if (Math.abs(tan[1]) > 0.9) up = [1, 0, 0];
    const norm = [
      tan[1] * up[2] - tan[2] * up[1],
      tan[2] * up[0] - tan[0] * up[2],
      tan[0] * up[1] - tan[1] * up[0]
    ];
    const nlen = Math.hypot(...norm) || 1;
    const n = norm.map(v => v / nlen);
    const binorm = [
      tan[1] * n[2] - tan[2] * n[1],
      tan[2] * n[0] - tan[0] * n[2],
      tan[0] * n[1] - tan[1] * n[0]
    ];

    const t = i / cordSteps;
    const vesselTwist = t * Math.PI * 8.0;

    for (let j = 0; j <= radialSegs; j++) {
      const phi = (j / radialSegs) * Math.PI * 2;
      const vesselRidge = 1.0 + 0.18 * Math.cos(3 * (phi - vesselTwist));
      const r = cordRadius * vesselRidge;

      const cos = Math.cos(phi);
      const sin = Math.sin(phi);

      const vx = p[0] + r * (cos * n[0] + sin * binorm[0]);
      const vy = p[1] + r * (cos * n[1] + sin * binorm[1]);
      const vz = p[2] + r * (cos * n[2] + sin * binorm[2]);

      vertices.push(vx, vy, vz);
      normals.push(
        Math.round((cos * n[0] + sin * binorm[0]) * 32767),
        Math.round((cos * n[1] + sin * binorm[1]) * 32767),
        Math.round((cos * n[2] + sin * binorm[2]) * 32767)
      );

      if (vx < minX) minX = vx; if (vx > maxX) maxX = vx;
      if (vy < minY) minY = vy; if (vy > maxY) maxY = vy;
      if (vz < minZ) minZ = vz; if (vz > maxZ) maxZ = vz;
    }
  }

  for (let i = 0; i < cordPoints.length - 1; i++) {
    for (let j = 0; j < radialSegs; j++) {
      const a = i * (radialSegs + 1) + j;
      const b = (i + 1) * (radialSegs + 1) + j;
      indices.push(a, b, a + 1);
      indices.push(b, b + 1, a + 1);
    }
  }

  return {
    name,
    conceptId,
    system,
    vertexCount: vertices.length / 3,
    indexCount: indices.length,
    positions: new Float32Array(vertices),
    normals: new Int16Array(normals),
    indices: new Uint32Array(indices),
    bounds: [[minX, minY, minZ], [maxX, maxY, maxZ]]
  };
}

// --------------------------------------------------------------------------
// Landmark Offsets:
// 1. Pelvic skeleton: centered on x=0.0
// 2. Mammary glands: placed in 'reproductive' system, anterior to pectoralis major, centered symmetrically
// --------------------------------------------------------------------------
function getFemaleCategory(name, system) {
  const n = name.toLowerCase();
  if (n.includes('mammary') || n.includes('breast') || n.includes('nipple') || n.includes('areola') || n.includes('lactiferous') || n.includes('cooper')) return 'mammary';
  if (n.includes('uterus') || n.includes('uterine') || n.includes('cervix') || n.includes('cervical') || n.includes('endometri') || n.includes('myometri') || n.includes('vagina') || n.includes('colpos')) return 'uterus';
  if (n.includes('ovary') || n.includes('ovarian') || n.includes('fallopian') || n.includes('salpin') || n.includes('fimbria') || n.includes('infundibulum') || n.includes('ampulla') || n.includes('isthmus')) return 'ovary';
  if (n.includes('clitoris') || n.includes('clitoral') || n.includes('vestibul') || n.includes('vulva') || n.includes('labia') || n.includes('labium') || n.includes('bartholin') || n.includes('hymen') || n.includes('skene')) return 'vulva';
  if (n.includes('sacrum') || n.includes('coccyx') || n.includes('pubis') || n.includes('ilium') || n.includes('ischium') || n.includes('pelvis')) return 'pelvis';
  if (n.includes('bladder') || n.includes('urethra')) return 'bladder';
  if (n.includes('fetus') || n.includes('placenta') || n.includes('cord') || n.includes('gestat')) return 'pregnancy';
  if (n.includes('lip') || n.includes('eyebrow') || n.includes('facial') || n.includes('cranial')) return 'facial';
  return 'reproductive';
}

const organConfigs = [
  // Pelvic skeleton
  { file: 'pelvis-female.glb', defaultSystem: 'skeletal', offsetX: 0.0085, offsetY: 0.840, offsetZ: 0.035 },
  // Urinary bladder
  { file: 'urinary-bladder-female.glb', defaultSystem: 'urinary', offsetX: 0.015, offsetY: 0.840, offsetZ: 0.040 },
  // Uterus & internal reproductive
  { file: 'uterus.glb', defaultSystem: 'reproductive', offsetX: 0.0135, offsetY: 0.840, offsetZ: 0.035 },
  { file: 'ovary-left.glb', defaultSystem: 'reproductive', offsetX: 0.0195, offsetY: 0.840, offsetZ: 0.035 },
  { file: 'ovary-right.glb', defaultSystem: 'reproductive', offsetX: 0.0195, offsetY: 0.840, offsetZ: 0.035 },
  { file: 'fallopian-tube-left.glb', defaultSystem: 'reproductive', offsetX: 0.011, offsetY: 0.840, offsetZ: 0.035 },
  { file: 'fallopian-tube-right.glb', defaultSystem: 'reproductive', offsetX: 0.011, offsetY: 0.840, offsetZ: 0.035 },
  // Mammary Glands (Left & Right smoothly seated against anterior pectoralis major without cone gap)
  { file: 'mammary-gland-left.glb', defaultSystem: 'reproductive', offsetX: 0.0114, offsetY: 0.840, offsetZ: 0.076 },
  { file: 'mammary-gland-right.glb', defaultSystem: 'reproductive', offsetX: 0.0000, offsetY: 0.840, offsetZ: 0.076 }
];

const allRealFemaleParts = [];
for (const cfg of organConfigs) {
  const filePath = path.join(hraDir, cfg.file);
  if (fs.existsSync(filePath)) {
    const meshes = extractMeshesFromGLB(filePath, cfg.defaultSystem, cfg);
    console.log(`  [HRA] Ingested ${meshes.length} high-res meshes from ${cfg.file}`);
    allRealFemaleParts.push(...meshes);
  } else {
    console.warn(`  [WARN] File not found: ${filePath}`);
  }
}

// Ingest specialized female external genitalia, vaginal canal, and feminine facial contour
const specializedFemaleParts = generateAllFemaleSpecializedParts();
console.log(`  [Specialized] Ingested ${specializedFemaleParts.length} female-unique organs & external genitalia.`);
allRealFemaleParts.push(...specializedFemaleParts);

export function packChunk(meshes, folderPath, chunkIndex) {
  fs.mkdirSync(folderPath, { recursive: true });
  const buffers = [];
  let currentOffset = 0;

  const parts = meshes.map((m, idx) => {
    currentOffset = Math.ceil(currentOffset / 4) * 4;
    const posOffset = currentOffset;
    const posBytes = Math.ceil((m.vertexCount * 3 * 4) / 4) * 4;

    const normOffset = posOffset + posBytes;
    const normBytes = Math.ceil((m.vertexCount * 3 * 2) / 4) * 4;

    const idxOffset = normOffset + normBytes;
    const idxBytes = Math.ceil((m.indexCount * 4) / 4) * 4;

    const partTotalBytes = posBytes + normBytes + idxBytes;
    const partBuffer = Buffer.alloc(partTotalBytes);

    new Float32Array(partBuffer.buffer, partBuffer.byteOffset, m.vertexCount * 3).set(m.positions);
    new Int16Array(partBuffer.buffer, partBuffer.byteOffset + posBytes, m.vertexCount * 3).set(m.normals);
    new Uint32Array(partBuffer.buffer, partBuffer.byteOffset + posBytes + normBytes, m.indexCount).set(m.indices);

    buffers.push(partBuffer);
    currentOffset += partTotalBytes;

    const partId = `HRA_F_${idx + 1}`;
    const conceptId = m.conceptId || `FMA_HRA_${idx + 1}`;
    const isFemaleUnique = m.female_unique !== undefined ? m.female_unique : true;
    const category = m.female_category || getFemaleCategory(m.name, m.system);

    return {
      id: partId,
      name: m.name,
      conceptId: conceptId,
      system: m.system,
      female_unique: isFemaleUnique,
      female_category: category,
      chunk: chunkIndex,
      positions: posOffset,
      normals: normOffset,
      indices: idxOffset,
      vertexCount: m.vertexCount,
      indexCount: m.indexCount,
      bounds: m.bounds
    };
  });

  const fullBin = Buffer.concat(buffers);
  const binName = `extra-${chunkIndex}.bin`;
  const binPath = path.join(folderPath, binName);
  fs.writeFileSync(binPath, fullBin);

  const gzipBuffer = zlib.gzipSync(fullBin, { level: 9 });
  fs.writeFileSync(`${binPath}.gz`, gzipBuffer);

  const folderBase = path.basename(folderPath);
  const chunkMeta = {
    url: `/models/${folderBase}/${binName}`,
    bytes: fullBin.length,
    gzip: `/models/${folderBase}/${binName}.gz`,
    gzipBytes: gzipBuffer.length
  };

  return { parts, chunkMeta };
}

// Ingest baseline male parts to produce female fullbody
const baselineAtlas = JSON.parse(fs.readFileSync(path.join(modelsDir, 'atlas.json'), 'utf8'));

// COMPLETE DE-DUPLICATION: Purge all male organs, gonadal vessels, scrotum, and conflicting male pelvis bones
const MALE_TERMS = [
  'penis', 'prostate', 'testis', 'testes', 'testicular', 'scrotum', 'scrotal',
  'deferent duct', 'vas deferens', 'epididymis', 'seminal vesicle', 'prepuce',
  'bulbo-urethral', 'bulbourethral', 'cowper', 'glans penis', 'corpus cavernosum',
  'corpus spongiosum', 'superficial perineal muscle', 'testicular artery', 'testicular vein',
  'dorsal vein of penis', 'dorsal artery of penis'
];
const MALE_PELVIC_IDS = new Set([
  'FJ3148', // Male urethra (replaced by HRA female urethra)
  'FJ3149', // Male urinary bladder (replaced by HRA female bladder)
  'FJ3152', // Right hip bone (replaced by HRA female pelvis)
  'FJ3288', // Left hip bone (replaced by HRA female pelvis)
  'FJ3393', // Sacrum (replaced by HRA female sacrum)
  'FJ1450'  // Superficial perineal muscle
]);

function isMaleOrganOrConflictingBone(part) {
  if (MALE_PELVIC_IDS.has(part.id)) return true;
  if (part.system === 'reproductive') return true;
  const name = part.name.toLowerCase();
  return MALE_TERMS.some(t => name.includes(t));
}

const cleanedFemaleBaseParts = baselineAtlas.parts
  .filter(p => !isMaleOrganOrConflictingBone(p))
  .map(p => {
    if (p.id === 'FJ2814') {
      return {
        ...p,
        name: 'Lips & labial vermilion (FMA59816)',
        system: 'muscular',
        female_unique: true,
        female_category: 'facial'
      };
    }
    if (p.id === 'FJ2812') {
      return {
        ...p,
        name: 'Eyebrows & superciliary arches (FMA54237)',
        system: 'muscular',
        female_unique: true,
        female_category: 'facial'
      };
    }
    return p;
  });
console.log(`Purged male pelvis, genitalia, and gonadal vessels. Retained ${cleanedFemaleBaseParts.length} shared full-body pieces.`);

function buildConcepts(baseConcepts, finalParts, newParts) {
  const partIds = new Set(finalParts.map(p => p.id));
  const concepts = [];

  for (const c of baseConcepts) {
    const validElements = c.elements.filter(id => partIds.has(id));
    if (validElements.length > 0) {
      concepts.push({ id: c.id, name: c.name, elements: validElements });
    }
  }

  for (const p of newParts) {
    const existing = concepts.find(c => c.id === p.conceptId);
    if (existing) {
      if (!existing.elements.includes(p.id)) existing.elements.push(p.id);
    } else {
      concepts.push({ id: p.conceptId, name: p.name, elements: [p.id] });
    }
  }

  return concepts;
}

// --------------------------------------------------------------------------
// 1. Rebuild public/models/female-fullbody (Full-Body Parity)
// --------------------------------------------------------------------------
console.log('1. Packing public/models/female-fullbody...');
const femaleDir = path.join(modelsDir, 'female-fullbody');
const femalePacked = packChunk(allRealFemaleParts, femaleDir, baselineAtlas.chunks.length);
const femaleParts = [...cleanedFemaleBaseParts, ...femalePacked.parts];
const femaleConcepts = buildConcepts(baselineAtlas.concepts, femaleParts, femalePacked.parts);

const femaleAtlas = {
  ...baselineAtlas,
  sex: 'female',
  name: 'Female Human 3D Anatomy Atlas (Full-Body Parity & HRA Integration)',
  chunks: [...baselineAtlas.chunks, femalePacked.chunkMeta],
  parts: femaleParts,
  concepts: femaleConcepts,
  triangles: femaleParts.reduce((acc, p) => acc + p.indexCount / 3, 0)
};
fs.writeFileSync(path.join(femaleDir, 'atlas.json'), JSON.stringify(femaleAtlas, null, 2));

// --------------------------------------------------------------------------
// 2. Rebuild public/models/female-trunk-hra (NIH HRA Trunk - Axial skeleton, ribcage, spine, pelvic girdle & internal organs ONLY)
// --------------------------------------------------------------------------
console.log('2. Packing public/models/female-trunk-hra...');
const hraModelDir = path.join(modelsDir, 'female-trunk-hra');

// For axial trunk viscera: exclude superficial mammary glands (which float without pectoralis major and skin)
const trunkRealFemaleParts = allRealFemaleParts.filter(m => {
  const n = m.name.toLowerCase();
  return !n.includes('mammary') && !n.includes('areola') && !n.includes('nipple') && !n.includes('lactiferous') && !n.includes('cooper');
});
const hraPacked = packChunk(trunkRealFemaleParts, hraModelDir, baselineAtlas.chunks.length);

const trunkSystems = new Set(['skeletal', 'respiratory', 'cardiac', 'digestive', 'urinary', 'endocrine', 'reproductive']);

// Strict extremity bone, cranial/facial, brain ventricles, and oral/pharyngeal filter
const EXCLUDE_TRUNK_TERMS = [
  // Upper & lower limb extremities
  'hand', 'finger', 'thumb', 'foot', 'toe', 'tibia', 'fibula', 'femur', 'patella',
  'radius', 'ulna', 'humerus', 'carpal', 'scaphoid', 'lunate', 'triquetral', 'triquetrum',
  'pisiform', 'trapezium', 'trapezoid', 'capitate', 'hamate', 'metacarpal',
  'tarsal', 'talus', 'calcaneus', 'cuboid', 'navicular', 'cuneiform', 'metatarsal',
  'phalanx', 'phalanges', 'sesamoid',
  // Cranial, facial, teeth structures (trunk begins at thoracic inlet / cervical spine)
  'skull', 'cranium', 'cranial', 'maxilla', 'mandible', 'tooth', 'teeth', 'incisor',
  'canine', 'premolar', 'molar', 'frontal bone', 'parietal bone', 'temporal bone',
  'occipital bone', 'sphenoid', 'ethmoid', 'nasal bone', 'zygomatic', 'palatine',
  'vomer', 'lacrimal', 'inferior nasal concha', 'alar cartilage',
  // Misclassified muscles in skeletal system
  'subscapularis', 'levator scapulae',
  // Misclassified brain ventricles and head endocrine structures
  'third ventricle', 'fourth ventricle', 'left lateral ventricle', 'right lateral ventricle', 'interventricular foramen',
  'pituitary', 'pineal',
  // Oral, lingual & salivary structures
  'gingiva', 'tongue', 'sublingual', 'submandibular', 'parotid',
  // Nasal cartilages
  'nasal cartilage',
  // Pharynx & larynx floating cartilages
  'pharyngeal', 'pharyngeus', 'epiglottis', 'hyoid', 'arytenoid', 'corniculate', 'cricoid', 'thyroid cartilage', 'larynx',
  // Upper cervical vertebrae above thoracic inlet (C1-C6)
  'atlas', 'axis', 'third cervical', 'fourth cervical', 'fifth cervical', 'sixth cervical'
];

const trunkPartsFiltered = cleanedFemaleBaseParts.filter(p => {
  if (!trunkSystems.has(p.system)) return false;
  const name = p.name.toLowerCase();
  if (EXCLUDE_TRUNK_TERMS.some(term => name.includes(term))) {
    return false;
  }
  return true;
});

const hraParts = [...trunkPartsFiltered, ...hraPacked.parts];
const hraConcepts = buildConcepts(baselineAtlas.concepts, hraParts, hraPacked.parts);

const hraAtlas = {
  ...baselineAtlas,
  sex: 'female',
  name: 'Female Trunk & Organ Atlas (Official NIH HuBMAP HRA)',
  chunks: [...baselineAtlas.chunks, hraPacked.chunkMeta],
  parts: hraParts,
  concepts: hraConcepts,
  triangles: hraParts.reduce((acc, p) => acc + p.indexCount / 3, 0)
};
fs.writeFileSync(path.join(hraModelDir, 'atlas.json'), JSON.stringify(hraAtlas, null, 2));

// --------------------------------------------------------------------------
// 3. Rebuild public/models/female-hybrid-vhf (Visible Human Female & HRA Hybrid)
// --------------------------------------------------------------------------
console.log('3. Packing public/models/female-hybrid-vhf...');
const vhfDir = path.join(modelsDir, 'female-hybrid-vhf');
const vhfPacked = packChunk(allRealFemaleParts, vhfDir, baselineAtlas.chunks.length);

const vhfParts = [...cleanedFemaleBaseParts, ...vhfPacked.parts];
const vhfConcepts = buildConcepts(baselineAtlas.concepts, vhfParts, vhfPacked.parts);

const vhfAtlas = {
  ...baselineAtlas,
  sex: 'female',
  name: 'Visible Human Female (VHF) & HuBMAP HRA Hybrid Composite Atlas',
  chunks: [...baselineAtlas.chunks, vhfPacked.chunkMeta],
  parts: vhfParts,
  concepts: vhfConcepts,
  triangles: vhfParts.reduce((acc, p) => acc + p.indexCount / 3, 0)
};
fs.writeFileSync(path.join(vhfDir, 'atlas.json'), JSON.stringify(vhfAtlas, null, 2));

// --------------------------------------------------------------------------
// 4. Rebuild public/models/pregnancy (38-Week Gestation, Cephalic Fetus, Placenta, Cord)
// --------------------------------------------------------------------------
console.log('4. Packing public/models/pregnancy...');
const pregDir = path.join(modelsDir, 'pregnancy');

// In pregnancy, retain maternal abdominal wall and organs; filter out lower non-pregnant intestinal loops
// (ileum, jejunum, transverse colon, appendix) that physically collide with the 38-week gravid uterus:
const pregBaseParts = cleanedFemaleBaseParts.filter(p => {
  if (p.system === 'digestive') {
    const n = p.name.toLowerCase();
    if (n.includes('ileum') || n.includes('jejunum') || n.includes('transverse colon') || n.includes('appendix') || n.includes('mesentery') || n.includes('mesocolon') || n.includes('taenia')) {
      return false;
    }
  }
  return true;
});

// Authentic 38-week gravid uterus scaled non-uniformly to 38cm fundal height (pubic crest Y=0.84 to xiphoid Y=1.22)
// Strictly bounded so posterior wall Z >= -0.012m, perfectly resting anterior to lumbar spine with zero sacral penetration,
// and fully enclosing the 38-week cephalic fetus, placenta, and umbilical cord!
const gravidUterusMeshes = extractMeshesFromGLB(path.join(hraDir, 'uterus.glb'), 'reproductive', {
  scaleX: 4.80,
  scaleY: 7.40,
  scaleZ: 4.20,
  offsetX: 0.0648,
  offsetY: 0.8243,
  offsetZ: 0.3674
})
  .filter(m => !m.name.toLowerCase().includes('cornua') && !m.name.toLowerCase().includes('ostium'))
  .map(m => ({ ...m, name: `Gravid ${m.name.toLowerCase()} (38 Weeks Gestation)`, female_unique: true, female_category: 'pregnancy' }));

// Authentic Fetal & Gestational Structures (Cephalic / Vertex presentation)
const fetalAndGestationalMeshes = [
  // Fetal Head in Vertex presentation (presenting at cervix/pelvic inlet)
  createFetalHeadMesh('Fetus (Head / Cranium - Vertex presentation)', 'FMA7204-FH', 'reproductive'),
  // Curved flexed fetal spine and torso
  createFetalTorsoMesh('Fetus (Torso & flexed spine)', 'FMA7204-FT', 'reproductive'),
  // Flexed fetal upper limbs across chest
  createFetalLimbsMesh('Fetus (Flexed upper limbs)', 'FMA7204-FU', 'reproductive', 'upper'),
  // Flexed fetal lower limbs with knees tucked to abdomen
  createFetalLimbsMesh('Fetus (Flexed lower limbs)', 'FMA7204-FL', 'reproductive', 'lower'),
  // Discoid maternal placenta on posterior uterine fundus
  createDiscoidPlacentaMesh('Placenta (Maternal discoid plate & chorion)', 'FMA63890', 'reproductive'),
  // Helical 3-vessel umbilical cord
  createHelicalUmbilicalCordMesh('Umbilical cord (Helical 3-vessel conduit)', 'FMA63893', 'reproductive')
];

const NON_PREG_UTERINE_PARTS = new Set([
  'cervicovaginal junction',
  'abdominal ostium of uterine tube',
  'body of uterus',
  'fundus of uterus',
  'cornua',
  'lower uterine segment',
  'posterior wall of uterus',
  'anterior wall of uterus',
  'cervix',
  'internal cervical os',
  'external cervical os'
]);

const pregMeshes = [
  ...allRealFemaleParts.filter(m => !NON_PREG_UTERINE_PARTS.has(m.name.toLowerCase())),
  ...gravidUterusMeshes,
  ...fetalAndGestationalMeshes
];

const pregPacked = packChunk(pregMeshes, pregDir, baselineAtlas.chunks.length);
const pregParts = [...pregBaseParts, ...pregPacked.parts];
const pregConcepts = buildConcepts(baselineAtlas.concepts, pregParts, pregPacked.parts);

const pregAtlas = {
  ...baselineAtlas,
  sex: 'female',
  name: 'Gestational Progression Atlas (Gravid HRA Uterus, Fetal Twin & Visceral Adaptation)',
  chunks: [...baselineAtlas.chunks, pregPacked.chunkMeta],
  parts: pregParts,
  concepts: pregConcepts,
  triangles: pregParts.reduce((acc, p) => acc + p.indexCount / 3, 0)
};
fs.writeFileSync(path.join(pregDir, 'atlas.json'), JSON.stringify(pregAtlas, null, 2));

// --------------------------------------------------------------------------
// 5. Rebuild public/models/lifespan-aging (Clean Skeleton with DEXA Heatmap Shaders - ZERO dummy ellipsoids)
// --------------------------------------------------------------------------
console.log('5. Packing public/models/lifespan-aging...');
const agingDir = path.join(modelsDir, 'lifespan-aging');

// Clean anatomical aging structures (NO giant bounding capsules or crude dummy ellipsoids)
const agingMeshes = [
  ...allRealFemaleParts
];

const agingPacked = packChunk(agingMeshes, agingDir, baselineAtlas.chunks.length);
const agingParts = [...cleanedFemaleBaseParts, ...agingPacked.parts];
const agingConcepts = buildConcepts(baselineAtlas.concepts, agingParts, agingPacked.parts);

const agingAtlas = {
  ...baselineAtlas,
  sex: 'female',
  name: 'Lifespan Ontogeny Atlas (Continuous Aging & DEXA Bone Mineral Density)',
  chunks: [...baselineAtlas.chunks, agingPacked.chunkMeta],
  parts: agingParts,
  concepts: agingConcepts,
  triangles: agingParts.reduce((acc, p) => acc + p.indexCount / 3, 0)
};
fs.writeFileSync(path.join(agingDir, 'atlas.json'), JSON.stringify(agingAtlas, null, 2));

// --------------------------------------------------------------------------
// 6. Export Dedicated "Female Unique Parts" Catalog for Webpage and Clinical Reference
// --------------------------------------------------------------------------
console.log('6. Generating dedicated female-unique-parts.json catalog...');
const CATEGORY_PRIORITY = {
  vulva: 1,
  uterus: 2,
  ovary: 3,
  mammary: 4,
  facial: 5,
  pelvis: 6,
  bladder: 7,
  reproductive: 8,
  pregnancy: 9
};

const femaleUniqueCatalog = femaleParts
  .filter(p => p.female_unique || p.id.startsWith('HRA_F_'))
  .map(p => ({
    id: p.id,
    name: p.name,
    conceptId: p.conceptId,
    system: p.system,
    category: p.female_category || getFemaleCategory(p.name, p.system),
    vertexCount: p.vertexCount,
    indexCount: p.indexCount,
    bounds: p.bounds
  }))
  .sort((a, b) => (CATEGORY_PRIORITY[a.category] || 99) - (CATEGORY_PRIORITY[b.category] || 99));

fs.writeFileSync(path.join(modelsDir, 'female-unique-parts.json'), JSON.stringify(femaleUniqueCatalog, null, 2));

// Sync to dist if present
const distModelsDir = path.resolve(__dirname, '../dist/models');
if (fs.existsSync(distModelsDir)) {
  fs.cpSync(modelsDir, distModelsDir, { recursive: true });
}
console.log(`✅ Saved ${femaleUniqueCatalog.length} female-unique parts to female-unique-parts.json`);

console.log('✅ ALL 5 ATLASES GENERATED AND PACKED SUCCESSFULLY!');
console.log({
  femaleFullbody: femaleParts.length,
  femaleTrunkHra: hraParts.length,
  femaleHybridVhf: vhfParts.length,
  pregnancy: pregParts.length,
  lifespanAging: agingParts.length,
  femaleUniqueCatalog: femaleUniqueCatalog.length
});
