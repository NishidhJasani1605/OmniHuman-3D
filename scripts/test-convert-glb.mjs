import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { convertGLBToAtlas } from './convert-glb-atlas.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Construct a valid minimal test GLB file in memory
function createTestGLB() {
  const positions = new Float32Array([
    -0.1, 0.8, 0.0,
     0.1, 0.8, 0.0,
     0.0, 1.0, 0.0
  ]);
  const indices = new Uint16Array([0, 1, 2]);

  const posBytes = Buffer.from(positions.buffer);
  const idxBytes = Buffer.from(indices.buffer);
  const binData = Buffer.concat([posBytes, idxBytes]);

  const gltfJSON = {
    asset: { version: '2.0', generator: 'TestGLBGen' },
    buffers: [{ byteLength: binData.length }],
    bufferViews: [
      { buffer: 0, byteOffset: 0, byteLength: posBytes.length, target: 34962 },
      { buffer: 0, byteOffset: posBytes.length, byteLength: idxBytes.length, target: 34963 }
    ],
    accessors: [
      { bufferView: 0, byteOffset: 0, componentType: 5126, count: 3, type: 'VEC3', min: [-0.1, 0.8, 0.0], max: [0.1, 1.0, 0.0] },
      { bufferView: 1, byteOffset: 0, componentType: 5123, count: 3, type: 'SCALAR', min: [0], max: [2] }
    ],
    meshes: [
      {
        name: 'Test Uterus Mesh',
        primitives: [{ attributes: { POSITION: 0 }, indices: 1 }]
      }
    ]
  };

  const jsonStr = JSON.stringify(gltfJSON);
  const jsonPaddedLength = Math.ceil(Buffer.byteLength(jsonStr) / 4) * 4;
  const jsonBuf = Buffer.alloc(jsonPaddedLength, 0x20); // space padded
  jsonBuf.write(jsonStr, 0, 'utf8');

  const binPaddedLength = Math.ceil(binData.length / 4) * 4;
  const binBuf = Buffer.alloc(binPaddedLength, 0);
  binData.copy(binBuf);

  const totalLength = 12 + (8 + jsonPaddedLength) + (8 + binPaddedLength);
  const glb = Buffer.alloc(totalLength);

  // Header
  glb.writeUInt32LE(0x46546C67, 0); // 'glTF'
  glb.writeUInt32LE(2, 4);          // version 2
  glb.writeUInt32LE(totalLength, 8); // total length

  // Chunk 0: JSON
  glb.writeUInt32LE(jsonPaddedLength, 12);
  glb.writeUInt32LE(0x4E4F534A, 16); // 'JSON'
  jsonBuf.copy(glb, 20);

  // Chunk 1: BIN
  const binHeaderOffset = 20 + jsonPaddedLength;
  glb.writeUInt32LE(binPaddedLength, binHeaderOffset);
  glb.writeUInt32LE(0x004E4942, binHeaderOffset + 4); // 'BIN\0'
  binBuf.copy(glb, binHeaderOffset + 8);

  return glb;
}

const testGlbPath = path.resolve(__dirname, 'test-sample.glb');
const testOutputDir = path.resolve(__dirname, '../public/models/test-converted');

fs.writeFileSync(testGlbPath, createTestGLB());
console.log('Created synthetic GLB file at:', testGlbPath);

const result = convertGLBToAtlas(testGlbPath, testOutputDir, {
  name: 'Test Converted Female Pelvis Atlas',
  system: 'reproductive',
  sex: 'female'
});

console.log('Result:', result);
if (fs.existsSync(result.manifestPath)) {
  console.log('GLB binary converter end-to-end ingestion test passed!');
  // Clean up test file
  fs.unlinkSync(testGlbPath);
} else {
  console.error('Test failed: manifest not generated');
  process.exit(1);
}
