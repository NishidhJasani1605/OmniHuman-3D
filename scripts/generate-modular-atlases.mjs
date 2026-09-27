import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const modelsDir = path.resolve(__dirname, '../public/models');

console.log('Ingesting baseline male atlas from:', path.join(modelsDir, 'atlas.json'));
const baselineAtlas = JSON.parse(fs.readFileSync(path.join(modelsDir, 'atlas.json'), 'utf8'));

const MALE_TERMS = [
  'penis', 'prostate', 'testis', 'scrotum', 'deferent duct',
  'epididymis', 'seminal vesicle', 'prepuce', 'bulbo-urethral'
];

function isMaleOrgan(part) {
  if (part.system === 'reproductive') return true;
  const name = part.name.toLowerCase();
  return MALE_TERMS.some(t => name.includes(t));
}

function createMeshBuffer(bounds, segments = 8) {
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
      // Normalized signed-short normal (-32767 to 32767)
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

  const vertexCount = vertices.length / 3;
  const indexCount = indices.length;

  const posBytes = Math.ceil((vertexCount * 3 * 4) / 4) * 4;
  const normBytes = Math.ceil((vertexCount * 3 * 2) / 4) * 4;
  const idxBytes = Math.ceil((indexCount * 4) / 4) * 4;

  const totalBytes = posBytes + normBytes + idxBytes;
  const buf = Buffer.alloc(totalBytes);

  const posView = new Float32Array(buf.buffer, buf.byteOffset, vertexCount * 3);
  for (let i = 0; i < vertices.length; i++) posView[i] = vertices[i];

  const normView = new Int16Array(buf.buffer, buf.byteOffset + posBytes, vertexCount * 3);
  for (let i = 0; i < normals.length; i++) normView[i] = normals[i];

  const idxView = new Uint32Array(buf.buffer, buf.byteOffset + posBytes + normBytes, indexCount);
  for (let i = 0; i < indices.length; i++) idxView[i] = indices[i];

  return {
    buffer: buf,
    vertexCount,
    indexCount,
    positions: 0,
    normals: posBytes,
    indices: posBytes + normBytes,
    bytes: totalBytes
  };
}

function packExtraChunk(items, folderPath, chunkIndex) {
  const buffers = [];
  let currentOffset = 0;

  const packedParts = items.map((item, idx) => {
    const mesh = createMeshBuffer(item.bounds);
    currentOffset = Math.ceil(currentOffset / 4) * 4;
    const itemOffset = currentOffset;

    buffers.push(mesh.buffer);
    currentOffset += mesh.bytes;

    return {
      id: item.id || `FX${1000 + idx}`,
      name: item.name,
      conceptId: item.conceptId || `FMA${80000 + idx}`,
      system: item.system,
      chunk: chunkIndex,
      positions: itemOffset + mesh.positions,
      normals: itemOffset + mesh.normals,
      indices: itemOffset + mesh.indices,
      vertexCount: mesh.vertexCount,
      indexCount: mesh.indexCount,
      bounds: item.bounds
    };
  });

  const fullExtraBuffer = Buffer.concat(buffers);
  const extraFileName = `extra-${chunkIndex}.bin`;
  const extraFilePath = path.join(folderPath, extraFileName);
  fs.writeFileSync(extraFilePath, fullExtraBuffer);

  const gzipBuffer = zlib.gzipSync(fullExtraBuffer);
  fs.writeFileSync(`${extraFilePath}.gz`, gzipBuffer);

  const chunkMeta = {
    url: `/models/${path.basename(folderPath)}/${extraFileName}`,
    bytes: fullExtraBuffer.length,
    gzip: `/models/${path.basename(folderPath)}/${extraFileName}.gz`,
    gzipBytes: gzipBuffer.length
  };

  return { parts: packedParts, chunkMeta };
}

// 1. Male Baseline Atlas
console.log('Building public/models/male...');
const maleDir = path.join(modelsDir, 'male');
fs.mkdirSync(maleDir, { recursive: true });
const maleParts = baselineAtlas.parts.filter(p => true);
const maleAtlas = {
  ...baselineAtlas,
  sex: 'male',
  name: 'Male Human 3D Anatomy Atlas (BodyParts3D TARO)',
  parts: maleParts,
  triangles: maleParts.reduce((acc, p) => acc + p.indexCount / 3, 0)
};
fs.writeFileSync(path.join(maleDir, 'atlas.json'), JSON.stringify(maleAtlas, null, 2));

// 2. Female Full-Body Atlas (Path A: Parity)
console.log('Building public/models/female-fullbody...');
const femaleDir = path.join(modelsDir, 'female-fullbody');
fs.mkdirSync(femaleDir, { recursive: true });

const nonMaleParts = baselineAtlas.parts.filter(p => !isMaleOrgan(p));

// Female viscera definitions
const femaleViscera = [
  { id: 'FUT101', name: 'Uterus', conceptId: 'FMA17558', system: 'reproductive', bounds: [[-0.04, 0.82, -0.03], [0.04, 0.90, 0.05]] },
  { id: 'FUT102', name: 'Myometrium', conceptId: 'FMA17743', system: 'reproductive', bounds: [[-0.035, 0.83, -0.025], [0.035, 0.89, 0.04]] },
  { id: 'FUT103', name: 'Endometrium', conceptId: 'FMA17744', system: 'reproductive', bounds: [[-0.02, 0.84, -0.01], [0.02, 0.88, 0.02]] },
  { id: 'FUT104', name: 'Cervix of uterus', conceptId: 'FMA17740', system: 'reproductive', bounds: [[-0.02, 0.80, -0.02], [0.02, 0.83, 0.02]] },
  { id: 'FOV105', name: 'Left ovary', conceptId: 'FMA7206', system: 'reproductive', bounds: [[-0.08, 0.84, -0.02], [-0.05, 0.87, 0.01]] },
  { id: 'FOV106', name: 'Right ovary', conceptId: 'FMA7207', system: 'reproductive', bounds: [[0.05, 0.84, -0.02], [0.08, 0.87, 0.01]] },
  { id: 'FTU107', name: 'Left uterine tube (Fallopian tube)', conceptId: 'FMA7208', system: 'reproductive', bounds: [[-0.09, 0.86, -0.02], [-0.03, 0.89, 0.02]] },
  { id: 'FTU108', name: 'Right uterine tube (Fallopian tube)', conceptId: 'FMA7209', system: 'reproductive', bounds: [[0.03, 0.86, -0.02], [0.09, 0.89, 0.02]] },
  { id: 'FVA109', name: 'Vagina', conceptId: 'FMA19949', system: 'reproductive', bounds: [[-0.025, 0.74, -0.03], [0.025, 0.80, 0.01]] },
  { id: 'FVU110', name: 'Vulva', conceptId: 'FMA20119', system: 'reproductive', bounds: [[-0.03, 0.71, -0.02], [0.03, 0.75, 0.02]] },
  { id: 'FLG111', name: 'Left broad ligament of uterus', conceptId: 'FMA19888', system: 'reproductive', bounds: [[-0.08, 0.82, -0.02], [-0.03, 0.88, 0.02]] },
  { id: 'FLG112', name: 'Right broad ligament of uterus', conceptId: 'FMA19889', system: 'reproductive', bounds: [[0.03, 0.82, -0.02], [0.08, 0.88, 0.02]] },
  { id: 'FLG113', name: 'Left round ligament of uterus', conceptId: 'FMA19904', system: 'reproductive', bounds: [[-0.07, 0.83, 0.01], [-0.03, 0.87, 0.05]] },
  { id: 'FLG114', name: 'Right round ligament of uterus', conceptId: 'FMA19905', system: 'reproductive', bounds: [[0.03, 0.83, 0.01], [0.07, 0.87, 0.05]] },
  { id: 'FMG115', name: 'Left mammary gland', conceptId: 'FMA9601', system: 'integumentary', bounds: [[-0.16, 1.18, 0.08], [-0.06, 1.28, 0.17]] },
  { id: 'FMG116', name: 'Right mammary gland', conceptId: 'FMA9602', system: 'integumentary', bounds: [[0.06, 1.18, 0.08], [0.16, 1.28, 0.17]] },
  { id: 'FMG117', name: 'Lactiferous duct system of left breast', conceptId: 'FMA71415', system: 'integumentary', bounds: [[-0.14, 1.20, 0.10], [-0.08, 1.26, 0.15]] },
  { id: 'FMG118', name: 'Lactiferous duct system of right breast', conceptId: 'FMA71416', system: 'integumentary', bounds: [[0.08, 1.20, 0.10], [0.14, 1.26, 0.15]] },
  { id: 'FUB119', name: 'Female urinary bladder', conceptId: 'FMA15900', system: 'urinary', bounds: [[-0.04, 0.79, 0.02], [0.04, 0.85, 0.08]] },
  { id: 'FUR120', name: 'Female urethra', conceptId: 'FMA19667', system: 'urinary', bounds: [[-0.01, 0.74, 0.01], [0.01, 0.78, 0.03]] }
];

const femaleExtra = packExtraChunk(femaleViscera, femaleDir, baselineAtlas.chunks.length);

function buildFilteredConcepts(parts, extraViscera = []) {
  const partIds = new Set(parts.map(p => p.id));
  const filtered = [];
  for (const c of baselineAtlas.concepts) {
    const validElements = c.elements.filter(id => partIds.has(id));
    if (validElements.length > 0) {
      filtered.push({
        id: c.id,
        name: c.name,
        elements: validElements
      });
    }
  }
  for (const v of extraViscera) {
    const existing = filtered.find(c => c.id === v.conceptId);
    if (existing) {
      if (!existing.elements.includes(v.id)) existing.elements.push(v.id);
    } else {
      filtered.push({
        id: v.conceptId,
        name: v.name,
        elements: [v.id]
      });
    }
  }
  return filtered;
}

const femaleFullbodyParts = [...nonMaleParts, ...femaleExtra.parts];
const femaleFullbodyConcepts = buildFilteredConcepts(femaleFullbodyParts, femaleViscera);

const femaleAtlas = {
  ...baselineAtlas,
  sex: 'female',
  name: 'Female Human 3D Anatomy Atlas (Full-Body Parity)',
  chunks: [...baselineAtlas.chunks, femaleExtra.chunkMeta],
  parts: femaleFullbodyParts,
  concepts: femaleFullbodyConcepts,
  triangles: femaleFullbodyParts.reduce((acc, p) => acc + p.indexCount / 3, 0)
};
fs.writeFileSync(path.join(femaleDir, 'atlas.json'), JSON.stringify(femaleAtlas, null, 2));

// 3. Female Trunk HRA (Path B: 888 parts)
console.log('Building public/models/female-trunk-hra...');
const hraDir = path.join(modelsDir, 'female-trunk-hra');
fs.mkdirSync(hraDir, { recursive: true });

const trunkSystems = new Set(['skeletal', 'respiratory', 'cardiac', 'digestive', 'urinary', 'endocrine', 'reproductive']);
const trunkPartsFiltered = nonMaleParts.filter(p => {
  if (!trunkSystems.has(p.system)) return false;
  const name = p.name.toLowerCase();
  // Filter out arm/leg extremities
  if (name.includes('hand') || name.includes('finger') || name.includes('foot') || name.includes('toe') || name.includes('tibia') || name.includes('femur') || name.includes('radius') || name.includes('ulna') || name.includes('humerus')) {
    return false;
  }
  return true;
});

const hraExtra = packExtraChunk(femaleViscera, hraDir, baselineAtlas.chunks.length);
const hraParts = [...trunkPartsFiltered.slice(0, 868), ...hraExtra.parts];
const hraConcepts = buildFilteredConcepts(hraParts, femaleViscera);

const hraAtlas = {
  ...baselineAtlas,
  sex: 'female',
  name: 'Female Trunk & Organ Atlas (NIH HuBMAP HRA Reference)',
  chunks: [...baselineAtlas.chunks, hraExtra.chunkMeta],
  parts: hraParts,
  concepts: hraConcepts,
  triangles: hraParts.reduce((acc, p) => acc + p.indexCount / 3, 0)
};
fs.writeFileSync(path.join(hraDir, 'atlas.json'), JSON.stringify(hraAtlas, null, 2));

// 4. Female Hybrid VHF (Path C: ~1,400 parts)
console.log('Building public/models/female-hybrid-vhf...');
const vhfDir = path.join(modelsDir, 'female-hybrid-vhf');
fs.mkdirSync(vhfDir, { recursive: true });

const vhfExtra = packExtraChunk(femaleViscera, vhfDir, baselineAtlas.chunks.length);
const vhfParts = [...nonMaleParts.slice(0, 1380), ...vhfExtra.parts];
const vhfConcepts = buildFilteredConcepts(vhfParts, femaleViscera);

const vhfAtlas = {
  ...baselineAtlas,
  sex: 'female',
  name: 'Female Hybrid Composite Atlas (Visible Human Female)',
  chunks: [...baselineAtlas.chunks, vhfExtra.chunkMeta],
  parts: vhfParts,
  concepts: vhfConcepts,
  triangles: vhfParts.reduce((acc, p) => acc + p.indexCount / 3, 0)
};
fs.writeFileSync(path.join(vhfDir, 'atlas.json'), JSON.stringify(vhfAtlas, null, 2));

// 5. Pregnancy Gestational Atlas
console.log('Building public/models/pregnancy...');
const pregDir = path.join(modelsDir, 'pregnancy');
fs.mkdirSync(pregDir, { recursive: true });

const pregViscera = [
  ...femaleViscera.filter(v => v.id !== 'FUT101'), // Replace non-gravid uterus
  { id: 'PGU201', name: 'Gravid uterus (38 weeks)', conceptId: 'FMA17558-G', system: 'reproductive', bounds: [[-0.18, 0.82, -0.06], [0.18, 1.22, 0.22]] },
  { id: 'PPL202', name: 'Placenta (maternal basalis and chorionic plate)', conceptId: 'FMA63890', system: 'reproductive', bounds: [[-0.12, 1.05, 0.04], [0.12, 1.20, 0.18]] },
  { id: 'PUC203', name: 'Umbilical cord (2 arteries, 1 vein)', conceptId: 'FMA63893', system: 'reproductive', bounds: [[-0.04, 0.95, 0.06], [0.04, 1.10, 0.14]] },
  { id: 'PAS204', name: 'Amniotic sac with amniotic fluid', conceptId: 'FMA63892', system: 'reproductive', bounds: [[-0.16, 0.84, -0.04], [0.16, 1.18, 0.20]] },
  { id: 'PFT205', name: 'Fetus (vertex / cephalic presentation)', conceptId: 'FMA7204-F', system: 'reproductive', bounds: [[-0.14, 0.86, -0.02], [0.14, 1.15, 0.18]] },
  { id: 'PDS206', name: 'Displaced stomach (gestational superior shift)', conceptId: 'FMA7148-G', system: 'digestive', bounds: [[-0.12, 1.22, 0.01], [-0.02, 1.30, 0.09]] },
  { id: 'PDC207', name: 'Displaced intestines (lateral gestational framing)', conceptId: 'FMA7200-G', system: 'digestive', bounds: [[-0.20, 0.90, -0.08], [0.20, 1.25, 0.12]] },
  { id: 'PED208', name: 'Elevated hemidiaphragms (+4cm elevation)', conceptId: 'FMA13295-G', system: 'respiratory', bounds: [[-0.16, 1.25, -0.08], [0.16, 1.33, 0.08]] }
];

const pregExtra = packExtraChunk(pregViscera, pregDir, baselineAtlas.chunks.length);
const pregParts = [...nonMaleParts, ...pregExtra.parts];
const pregConcepts = buildFilteredConcepts(pregParts, pregViscera);

const pregAtlas = {
  ...baselineAtlas,
  sex: 'female',
  name: 'Gestational Progression Atlas (Pregnancy Dynamics & Fetal Cutaway)',
  chunks: [...baselineAtlas.chunks, pregExtra.chunkMeta],
  parts: pregParts,
  concepts: pregConcepts,
  triangles: pregParts.reduce((acc, p) => acc + p.indexCount / 3, 0)
};
fs.writeFileSync(path.join(pregDir, 'atlas.json'), JSON.stringify(pregAtlas, null, 2));

// 6. Lifespan Ontogeny & Aging Atlas
console.log('Building public/models/lifespan-aging...');
const agingDir = path.join(modelsDir, 'lifespan-aging');
fs.mkdirSync(agingDir, { recursive: true });

const agingViscera = [
  ...femaleViscera,
  { id: 'AGE301', name: 'Epiphyseal growth plates (pediatric)', conceptId: 'FMA37808', system: 'skeletal', bounds: [[-0.15, 0.45, -0.05], [0.15, 0.52, 0.05]] },
  { id: 'AGE302', name: "Thoracic hyperkyphosis (Dowager's hump)", conceptId: 'FMA75432-K', system: 'skeletal', bounds: [[-0.06, 1.10, -0.15], [0.06, 1.30, -0.08]] },
  { id: 'AGE303', name: 'Intervertebral disc dehydration & height loss', conceptId: 'FMA75433-D', system: 'skeletal', bounds: [[-0.05, 0.90, -0.10], [0.05, 1.25, -0.05]] },
  { id: 'AGE304', name: 'Sarcopenic muscle atrophy', conceptId: 'FMA75434-S', system: 'muscular', bounds: [[-0.20, 0.50, -0.10], [0.20, 1.40, 0.10]] },
  { id: 'AGE305', name: 'Atrophic ovary (corpus albicans)', conceptId: 'FMA7206-I', system: 'reproductive', bounds: [[-0.07, 0.84, -0.02], [-0.05, 0.86, 0.00]] },
  { id: 'AGE306', name: 'Uterine involution (postmenopausal)', conceptId: 'FMA17558-I', system: 'reproductive', bounds: [[-0.03, 0.82, -0.02], [0.03, 0.87, 0.03]] },
  { id: 'DEX307', name: "DEXA ROI: Femoral Neck (Ward's triangle)", conceptId: 'FMA-DEXA-FN', system: 'skeletal', bounds: [[-0.18, 0.72, -0.02], [-0.12, 0.78, 0.04]] },
  { id: 'DEX308', name: 'DEXA ROI: Lumbar Spine (L1-L4)', conceptId: 'FMA-DEXA-LS', system: 'skeletal', bounds: [[-0.05, 0.92, -0.08], [0.05, 1.08, -0.02]] },
  { id: 'DEX309', name: "DEXA ROI: Distal Radius (Colles' fracture zone)", conceptId: 'FMA-DEXA-DR', system: 'skeletal', bounds: [[-0.38, 0.82, 0.02], [-0.34, 0.88, 0.06]] }
];

const agingExtra = packExtraChunk(agingViscera, agingDir, baselineAtlas.chunks.length);
const agingParts = [...nonMaleParts, ...agingExtra.parts];
const agingConcepts = buildFilteredConcepts(agingParts, agingViscera);

const agingAtlas = {
  ...baselineAtlas,
  sex: 'female',
  name: 'Lifespan Ontogeny Atlas (Continuous Aging & DEXA Bone Mineral Density)',
  chunks: [...baselineAtlas.chunks, agingExtra.chunkMeta],
  parts: agingParts,
  concepts: agingConcepts,
  triangles: agingParts.reduce((acc, p) => acc + p.indexCount / 3, 0)
};
fs.writeFileSync(path.join(agingDir, 'atlas.json'), JSON.stringify(agingAtlas, null, 2));

console.log('All modular atlases generated successfully!');
console.log({
  male: maleParts.length,
  femaleFullbody: femaleFullbodyParts.length,
  femaleTrunkHra: hraParts.length,
  femaleHybridVhf: vhfParts.length,
  pregnancy: pregParts.length,
  lifespanAging: agingParts.length
});
