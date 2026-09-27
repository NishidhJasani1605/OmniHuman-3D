import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const modelsBaseDir = path.resolve(__dirname, '../public/models');

const targetArg = process.argv[2] ?? 'atlas.json';

// Resolve manifest path
let manifestPath = targetArg;
if (!path.isAbsolute(manifestPath)) {
  if (fs.existsSync(manifestPath)) {
    // Relative to CWD
    manifestPath = path.resolve(manifestPath);
  } else if (fs.existsSync(path.join(modelsBaseDir, manifestPath))) {
    manifestPath = path.join(modelsBaseDir, manifestPath);
  } else if (fs.existsSync(path.join(modelsBaseDir, manifestPath, 'atlas.json'))) {
    manifestPath = path.join(modelsBaseDir, manifestPath, 'atlas.json');
  }
}

if (fs.statSync(manifestPath).isDirectory()) {
  manifestPath = path.join(manifestPath, 'atlas.json');
}

console.log(`Validating atlas manifest: ${manifestPath}`);
const atlas = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));

assert.ok(Array.isArray(atlas.parts) && atlas.parts.length > 0, 'atlas.parts must be a non-empty array');
assert.ok(Array.isArray(atlas.concepts) && atlas.concepts.length > 0, 'atlas.concepts must be a non-empty array');
assert.ok(Array.isArray(atlas.chunks) && atlas.chunks.length > 0, 'atlas.chunks must be a non-empty array');

const ids = new Set(atlas.parts.map(p => p.id));
assert.equal(ids.size, atlas.parts.length, 'Every part ID must be unique');

// Resolve and load binary chunks
const files = atlas.chunks.map((c, chunkIdx) => {
  let chunkPath = null;
  // Try absolute from public dir
  const publicRelative = path.resolve(__dirname, '../public', '.' + c.url);
  if (fs.existsSync(publicRelative)) {
    chunkPath = publicRelative;
  } else {
    // Try manifest directory
    const manifestDir = path.dirname(manifestPath);
    const inManifestDir = path.join(manifestDir, path.basename(c.url));
    if (fs.existsSync(inManifestDir)) {
      chunkPath = inManifestDir;
    } else {
      // Try root models dir
      const inModelsBase = path.join(modelsBaseDir, path.basename(c.url));
      if (fs.existsSync(inModelsBase)) {
        chunkPath = inModelsBase;
      }
    }
  }

  assert.ok(chunkPath && fs.existsSync(chunkPath), `Chunk file not found: ${c.url}`);
  const b = fs.readFileSync(chunkPath);
  assert.equal(b.length, c.bytes, `Chunk ${chunkIdx} (${c.url}) byte length mismatch: expected ${c.bytes}, got ${b.length}`);
  return b;
});

let tris = 0;
for (const p of atlas.parts) {
  assert.ok(p.name && p.name.trim() && p.name !== '-' && !p.name.includes('Bounds('), `Invalid part name: ${p.id}`);
  assert.ok(p.conceptId && p.conceptId !== '-', `Invalid conceptId for ${p.id}`);
  assert.ok(p.system, `Missing system for ${p.id}`);
  assert.ok(p.chunk >= 0 && p.chunk < files.length, `Chunk index out of bounds for ${p.id}: ${p.chunk}`);

  const b = files[p.chunk];
  assert.ok(p.indices + p.indexCount * 4 <= b.length, `Indices exceed buffer for ${p.id}`);
  assert.ok(p.positions + p.vertexCount * 3 * 4 <= b.length, `Positions exceed buffer for ${p.id}`);

  const pos = new Float32Array(b.buffer, b.byteOffset + p.positions, p.vertexCount * 3);
  const indices = new Uint32Array(b.buffer, b.byteOffset + p.indices, p.indexCount);

  assert.ok(indices.length >= 3, `Mesh ${p.id} must have at least 1 triangle`);
  for (const i of indices) {
    assert.ok(i < p.vertexCount, `${p.id}: invalid vertex index ${i} >= ${p.vertexCount}`);
  }
  for (const value of pos) {
    assert.ok(Number.isFinite(value), `${p.id}: non-finite position value`);
  }
  tris += p.indexCount / 3;
}

for (const c of atlas.concepts) {
  assert.ok(c.elements && c.elements.length, `Concept ${c.id} missing elements`);
  for (const id of c.elements) {
    assert.ok(ids.has(id), `${c.id}: missing part ID ${id}`);
  }
}

assert.equal(tris, atlas.triangles, `Triangle count mismatch: computed ${tris}, atlas claims ${atlas.triangles}`);
console.log(`[VALIDATION PASSED] Verified ${ids.size} individually indexed meshes, ${atlas.concepts.length} concepts, ${tris.toLocaleString()} triangles, and all ${files.length} binary chunks.`);
