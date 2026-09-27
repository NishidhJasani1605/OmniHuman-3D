import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { parseGLB, computeSurfaceNormals } from './convert-glb-atlas.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const hraDir = path.resolve(__dirname, '../data-sources/hra-female-organs');
const modelsDir = path.resolve(__dirname, '../public/models');

console.log('Ingesting official NIH HuBMAP HRA female organs with anatomical landmark registration...');

function cleanMeshName(rawName) {
  let name = rawName
    .replace(/^VH_F_/, '')
    .replace(/_L$/, ' (Left)')
    .replace(/_R$/, ' (Right)')
    .replace(/_/g, ' ');
  return name.charAt(0).toUpperCase() + name.slice(1);
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

      // Apply specific anatomical landmark registration
      const positions = new Float32Array(vertexCount * 3);
      let minX = Infinity, minY = Infinity, minZ = Infinity;
      let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;

      const scale = options.scale || 1.0;
      const offX = options.offsetX || 0;
      const offY = options.offsetY || 0;
      const offZ = options.offsetZ || 0;

      for (let i = 0; i < vertexCount; i++) {
        const x = rawPositions[i * 3] * scale + offX;
        const y = rawPositions[i * 3 + 1] * scale + offY;
        const z = rawPositions[i * 3 + 2] * scale + offZ;

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
        system: defaultSystem,
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

// Landmark-specific registration offsets:
// Pelvic organs share the pelvic cavity frame aligned to lumbar L5 and femoral heads:
const PELVIC_OFFSET = { offsetX: 0.014, offsetY: 0.875, offsetZ: 0.035 };
// Mammary glands positioned on anterior chest wall on top of pectoralis major fascia:
const MAMMARY_OFFSET = { offsetX: 0.0, offsetY: 0.840, offsetZ: 0.118 };

const organConfigs = [
  { file: 'pelvis-female.glb', system: 'skeletal', ...PELVIC_OFFSET },
  { file: 'urinary-bladder-female.glb', system: 'urinary', ...PELVIC_OFFSET },
  { file: 'uterus.glb', system: 'reproductive', ...PELVIC_OFFSET },
  { file: 'ovary-left.glb', system: 'reproductive', ...PELVIC_OFFSET },
  { file: 'ovary-right.glb', system: 'reproductive', ...PELVIC_OFFSET },
  { file: 'fallopian-tube-left.glb', system: 'reproductive', ...PELVIC_OFFSET },
  { file: 'fallopian-tube-right.glb', system: 'reproductive', ...PELVIC_OFFSET },
  { file: 'mammary-gland-left.glb', system: 'integumentary', ...MAMMARY_OFFSET },
  { file: 'mammary-gland-right.glb', system: 'integumentary', ...MAMMARY_OFFSET }
];

const allRealFemaleParts = [];
for (const cfg of organConfigs) {
  const filePath = path.join(hraDir, cfg.file);
  if (fs.existsSync(filePath)) {
    const meshes = extractMeshesFromGLB(filePath, cfg.system, cfg);
    console.log(`Registered ${meshes.length} high-res meshes from ${cfg.file} (${cfg.system})`);
    allRealFemaleParts.push(...meshes);
  }
}

export function packHighResChunk(meshes, folderPath, chunkIndex) {
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
    const conceptId = `FMA_HRA_${idx + 1}`;

    return {
      id: partId,
      name: m.name,
      conceptId: conceptId,
      system: m.system,
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

// DE-DUPLICATION: Exclude conflicting male pelvic skeleton, male urinary bladder, and male genitalia
const MALE_TERMS = [
  'penis', 'prostate', 'testis', 'scrotum', 'deferent duct',
  'epididymis', 'seminal vesicle', 'prepuce', 'bulbo-urethral'
];
const MALE_PELVIC_IDS = new Set([
  'FJ3149', // Male urinary bladder (replaced by 6 HRA female bladder meshes)
  'FJ3152', // Right hip bone (replaced by 14 HRA female pelvis meshes)
  'FJ3288', // Left hip bone (replaced by 14 HRA female pelvis meshes)
  'FJ3393'  // Sacrum (replaced by HRA female sacrum)
]);

function isMaleOrganOrConflictingBone(part) {
  if (MALE_PELVIC_IDS.has(part.id)) return true;
  if (part.system === 'reproductive') return true;
  const name = part.name.toLowerCase();
  return MALE_TERMS.some(t => name.includes(t));
}

const cleanedFemaleBaseParts = baselineAtlas.parts.filter(p => !isMaleOrganOrConflictingBone(p));
console.log(`Retained ${cleanedFemaleBaseParts.length} full-body structures (male pelvic bones & genitalia purged).`);

// 1. Rebuild female-fullbody with de-duplicated, landmark-registered HRA meshes
console.log('Packing real female anatomical geometry into public/models/female-fullbody...');
const femaleDir = path.join(modelsDir, 'female-fullbody');
const femalePacked = packHighResChunk(allRealFemaleParts, femaleDir, baselineAtlas.chunks.length);

const femaleParts = [...cleanedFemaleBaseParts, ...femalePacked.parts];
const partIds = new Set(femaleParts.map(p => p.id));

const femaleConcepts = [];
for (const c of baselineAtlas.concepts) {
  const validElements = c.elements.filter(id => partIds.has(id));
  if (validElements.length > 0) {
    femaleConcepts.push({ id: c.id, name: c.name, elements: validElements });
  }
}
for (const p of femalePacked.parts) {
  femaleConcepts.push({ id: p.conceptId, name: p.name, elements: [p.id] });
}

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

// 2. Rebuild female-trunk-hra
console.log('Packing real female anatomical geometry into public/models/female-trunk-hra...');
const hraModelDir = path.join(modelsDir, 'female-trunk-hra');
const hraPacked = packHighResChunk(allRealFemaleParts, hraModelDir, baselineAtlas.chunks.length);

const trunkSystems = new Set(['skeletal', 'respiratory', 'cardiac', 'digestive', 'urinary', 'endocrine', 'reproductive']);
const trunkPartsFiltered = cleanedFemaleBaseParts.filter(p => {
  if (!trunkSystems.has(p.system)) return false;
  const name = p.name.toLowerCase();
  if (name.includes('hand') || name.includes('finger') || name.includes('foot') || name.includes('toe') || name.includes('tibia') || name.includes('femur') || name.includes('radius') || name.includes('ulna') || name.includes('humerus')) {
    return false;
  }
  return true;
});

const hraParts = [...trunkPartsFiltered, ...hraPacked.parts];
const hraPartIds = new Set(hraParts.map(p => p.id));
const hraConcepts = [];
for (const c of baselineAtlas.concepts) {
  const validElements = c.elements.filter(id => hraPartIds.has(id));
  if (validElements.length > 0) {
    hraConcepts.push({ id: c.id, name: c.name, elements: validElements });
  }
}
for (const p of hraPacked.parts) {
  hraConcepts.push({ id: p.conceptId, name: p.name, elements: [p.id] });
}

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

// 3. Rebuild pregnancy with late-gestation gravid uterus (scaled 2.3x and elevated)
console.log('Packing real pregnancy geometry into public/models/pregnancy...');
const pregDir = path.join(modelsDir, 'pregnancy');

const gravidUterusMeshes = extractMeshesFromGLB(path.join(hraDir, 'uterus.glb'), 'reproductive', {
  scale: 2.3,
  offsetX: PELVIC_OFFSET.offsetX,
  offsetY: PELVIC_OFFSET.offsetY + 0.12,
  offsetZ: PELVIC_OFFSET.offsetZ + 0.05
}).map(m => ({ ...m, name: `Gravid ${m.name.toLowerCase()} (Late Gestation)` }));

const pregMeshes = [
  ...allRealFemaleParts.filter(m => !m.name.toLowerCase().includes('uterus')),
  ...gravidUterusMeshes
];

const pregPacked = packHighResChunk(pregMeshes, pregDir, baselineAtlas.chunks.length);
const pregParts = [...cleanedFemaleBaseParts, ...pregPacked.parts];
const pregPartIds = new Set(pregParts.map(p => p.id));
const pregConcepts = [];
for (const c of baselineAtlas.concepts) {
  const validElements = c.elements.filter(id => pregPartIds.has(id));
  if (validElements.length > 0) {
    pregConcepts.push({ id: c.id, name: c.name, elements: validElements });
  }
}
for (const p of pregPacked.parts) {
  pregConcepts.push({ id: p.conceptId, name: p.name, elements: [p.id] });
}

const pregAtlas = {
  ...baselineAtlas,
  sex: 'female',
  name: 'Gestational Progression Atlas (Gravid HRA Uterus & Visceral Adaptation)',
  chunks: [...baselineAtlas.chunks, pregPacked.chunkMeta],
  parts: pregParts,
  concepts: pregConcepts,
  triangles: pregParts.reduce((acc, p) => acc + p.indexCount / 3, 0)
};
fs.writeFileSync(path.join(pregDir, 'atlas.json'), JSON.stringify(pregAtlas, null, 2));

console.log('De-duplicated, registered female anatomy successfully built across all models!');
console.log({
  femaleFullbodyParts: femaleParts.length,
  femaleTrunkHraParts: hraParts.length,
  pregnancyParts: pregParts.length
});
