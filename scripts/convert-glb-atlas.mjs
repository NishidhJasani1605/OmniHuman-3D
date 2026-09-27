import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export function parseGLB(glbBuffer) {
  const magic = glbBuffer.readUInt32LE(0);
  if (magic !== 0x46546C67) {
    throw new Error('Not a valid GLB container (invalid magic header 0x' + magic.toString(16) + ')');
  }

  const version = glbBuffer.readUInt32LE(4);
  const totalLength = glbBuffer.readUInt32LE(8);

  let offset = 12;
  let jsonChunk = null;
  let binChunk = null;

  while (offset < totalLength) {
    const chunkLength = glbBuffer.readUInt32LE(offset);
    const chunkType = glbBuffer.readUInt32LE(offset + 4);
    const chunkData = glbBuffer.subarray(offset + 8, offset + 8 + chunkLength);

    if (chunkType === 0x4E4F534A) { // 'JSON'
      jsonChunk = JSON.parse(chunkData.toString('utf8'));
    } else if (chunkType === 0x004E4942) { // 'BIN\0'
      binChunk = chunkData;
    }

    offset += 8 + chunkLength;
  }

  if (!jsonChunk) {
    throw new Error('GLB missing required JSON header chunk');
  }

  return { gltf: jsonChunk, bin: binChunk || Buffer.alloc(0) };
}

export function computeSurfaceNormals(positions, indices) {
  const normals = new Float32Array(positions.length);
  for (let i = 0; i < indices.length; i += 3) {
    const i0 = indices[i] * 3;
    const i1 = indices[i + 1] * 3;
    const i2 = indices[i + 2] * 3;

    const ax = positions[i1] - positions[i0];
    const ay = positions[i1 + 1] - positions[i0 + 1];
    const az = positions[i1 + 2] - positions[i0 + 2];

    const bx = positions[i2] - positions[i0];
    const by = positions[i2 + 1] - positions[i0 + 1];
    const bz = positions[i2 + 2] - positions[i0 + 2];

    const nx = ay * bz - az * by;
    const ny = az * bx - ax * bz;
    const nz = ax * by - ay * bx;

    normals[i0] += nx; normals[i0 + 1] += ny; normals[i0 + 2] += nz;
    normals[i1] += nx; normals[i1 + 1] += ny; normals[i1 + 2] += nz;
    normals[i2] += nx; normals[i2 + 1] += ny; normals[i2 + 2] += nz;
  }

  // Normalize
  for (let i = 0; i < normals.length; i += 3) {
    const len = Math.hypot(normals[i], normals[i + 1], normals[i + 2]);
    if (len > 1e-6) {
      normals[i] /= len;
      normals[i + 1] /= len;
      normals[i + 2] /= len;
    } else {
      normals[i] = 0; normals[i + 1] = 1; normals[i + 2] = 0;
    }
  }

  return normals;
}

export function convertGLBToAtlas(inputPath, outputDir, options = {}) {
  const glbBuffer = fs.readFileSync(inputPath);
  const { gltf, bin } = parseGLB(glbBuffer);

  const parts = [];
  const concepts = [];
  const buffers = [];
  let currentOffset = 0;

  fs.mkdirSync(outputDir, { recursive: true });

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

    // Return slice aligned to buffer
    const slice = rawData.subarray(offset);
    return { acc, slice };
  };

  const meshes = gltf.meshes || [];
  let partIndex = 0;

  for (let mIdx = 0; mIdx < meshes.length; mIdx++) {
    const mesh = meshes[mIdx];
    const meshName = mesh.name || `Structure_${mIdx + 1}`;

    for (let pIdx = 0; pIdx < mesh.primitives.length; pIdx++) {
      const prim = mesh.primitives[pIdx];
      if (prim.attributes.POSITION === undefined) continue;

      const posInfo = getAccessorData(prim.attributes.POSITION);
      const vertexCount = posInfo.acc.count;
      const positions = new Float32Array(posInfo.slice.buffer, posInfo.slice.byteOffset, vertexCount * 3);

      let indices;
      if (prim.indices !== undefined) {
        const idxInfo = getAccessorData(prim.indices);
        if (idxInfo.acc.componentType === 5123) { // UNSIGNED_SHORT
          const raw = new Uint16Array(idxInfo.slice.buffer, idxInfo.slice.byteOffset, idxInfo.acc.count);
          indices = new Uint32Array(raw);
        } else if (idxInfo.acc.componentType === 5125) { // UNSIGNED_INT
          indices = new Uint32Array(idxInfo.slice.buffer, idxInfo.slice.byteOffset, idxInfo.acc.count);
        } else {
          const raw = new Uint8Array(idxInfo.slice.buffer, idxInfo.slice.byteOffset, idxInfo.acc.count);
          indices = new Uint32Array(raw);
        }
      } else {
        indices = new Uint32Array(vertexCount);
        for (let i = 0; i < vertexCount; i++) indices[i] = i;
      }

      let normals;
      if (prim.attributes.NORMAL !== undefined) {
        const normInfo = getAccessorData(prim.attributes.NORMAL);
        normals = new Float32Array(normInfo.slice.buffer, normInfo.slice.byteOffset, vertexCount * 3);
      } else {
        normals = computeSurfaceNormals(positions, indices);
      }

      // Compute bounding box
      let minX = Infinity, minY = Infinity, minZ = Infinity;
      let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;
      for (let i = 0; i < positions.length; i += 3) {
        const x = positions[i], y = positions[i + 1], z = positions[i + 2];
        if (x < minX) minX = x; if (x > maxX) maxX = x;
        if (y < minY) minY = y; if (y > maxY) maxY = y;
        if (z < minZ) minZ = z; if (z > maxZ) maxZ = z;
      }

      const shortNormals = new Int16Array(vertexCount * 3);
      for (let i = 0; i < normals.length; i++) {
        shortNormals[i] = Math.round(Math.max(-1, Math.min(1, normals[i])) * 32767);
      }

      // 4-byte aligned pack
      currentOffset = Math.ceil(currentOffset / 4) * 4;
      const partPositionsOffset = 0;
      const posBytes = Math.ceil((vertexCount * 3 * 4) / 4) * 4;
      const partNormalsOffset = posBytes;
      const normBytes = Math.ceil((vertexCount * 3 * 2) / 4) * 4;
      const partIndicesOffset = posBytes + normBytes;
      const idxBytes = Math.ceil((indices.length * 4) / 4) * 4;

      const partTotalBytes = posBytes + normBytes + idxBytes;
      const partBuffer = Buffer.alloc(partTotalBytes);

      new Float32Array(partBuffer.buffer, partBuffer.byteOffset, vertexCount * 3).set(positions);
      new Int16Array(partBuffer.buffer, partBuffer.byteOffset + partNormalsOffset, vertexCount * 3).set(shortNormals);
      new Uint32Array(partBuffer.buffer, partBuffer.byteOffset + partIndicesOffset, indices.length).set(indices);

      const partId = `GLB_${partIndex + 1}`;
      const conceptId = `FMA_GLB_${partIndex + 1}`;

      parts.push({
        id: partId,
        name: meshName,
        conceptId: conceptId,
        system: options.system || 'reproductive',
        chunk: 0,
        positions: currentOffset + partPositionsOffset,
        normals: currentOffset + partNormalsOffset,
        indices: currentOffset + partIndicesOffset,
        vertexCount: vertexCount,
        indexCount: indices.length,
        bounds: [[minX, minY, minZ], [maxX, maxY, maxZ]]
      });

      concepts.push({
        id: conceptId,
        name: meshName,
        elements: [partId]
      });

      buffers.push(partBuffer);
      currentOffset += partTotalBytes;
      partIndex++;
    }
  }

  const fullBin = Buffer.concat(buffers);
  const binName = 'converted-0.bin';
  const binPath = path.join(outputDir, binName);
  fs.writeFileSync(binPath, fullBin);

  const gzipBuffer = zlib.gzipSync(fullBin);
  fs.writeFileSync(`${binPath}.gz`, gzipBuffer);

  const folderBase = path.basename(outputDir);
  const atlas = {
    sex: options.sex || 'female',
    name: options.name || 'Converted GLB Anatomy Atlas',
    triangles: parts.reduce((acc, p) => acc + p.indexCount / 3, 0),
    chunks: [
      {
        url: `/models/${folderBase}/${binName}`,
        bytes: fullBin.length,
        gzip: `/models/${folderBase}/${binName}.gz`,
        gzipBytes: gzipBuffer.length
      }
    ],
    parts,
    concepts
  };

  const manifestPath = path.join(outputDir, 'atlas.json');
  fs.writeFileSync(manifestPath, JSON.stringify(atlas, null, 2));

  console.log(`Converted ${parts.length} meshes from ${path.basename(inputPath)} into ${manifestPath}`);
  return { manifestPath, partsCount: parts.length, triangles: atlas.triangles };
}

// CLI execution
if (process.argv[1] && process.argv[1].endsWith('convert-glb-atlas.mjs')) {
  const input = process.argv[2];
  const output = process.argv[3] || path.join(modelsBaseDir, 'converted-glb');
  if (!input) {
    console.log('Usage: node scripts/convert-glb-atlas.mjs <input.glb> [outputDir]');
  } else {
    convertGLBToAtlas(input, output);
  }
}
