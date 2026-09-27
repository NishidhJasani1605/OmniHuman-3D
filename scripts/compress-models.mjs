import fs from 'node:fs';
import path from 'node:path';
import { gzipSync } from 'node:zlib';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const modelsBaseDir = path.resolve(__dirname, '../public/models');

const targetArg = process.argv[2];
const targets = [];

if (targetArg) {
  let targetPath = path.isAbsolute(targetArg) ? targetArg : path.join(modelsBaseDir, targetArg);
  if (fs.existsSync(targetPath)) {
    if (fs.statSync(targetPath).isDirectory()) {
      targetPath = path.join(targetPath, 'atlas.json');
    }
    targets.push(targetPath);
  } else {
    console.error(`Target not found: ${targetArg}`);
    process.exit(1);
  }
} else {
  // Find all atlas.json files recursively
  const findAtlasFiles = (dir) => {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        findAtlasFiles(fullPath);
      } else if (entry.name === 'atlas.json') {
        targets.push(fullPath);
      }
    }
  };
  findAtlasFiles(modelsBaseDir);
}

for (const manifestPath of targets) {
  const atlas = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  const relName = path.relative(modelsBaseDir, manifestPath);
  let totalBytes = 0;

  for (const c of atlas.chunks) {
    let chunkPath = path.resolve(__dirname, '../public', '.' + c.url);
    if (!fs.existsSync(chunkPath)) {
      chunkPath = path.join(path.dirname(manifestPath), path.basename(c.url));
    }
    if (!fs.existsSync(chunkPath)) {
      chunkPath = path.join(modelsBaseDir, path.basename(c.url));
    }

    if (fs.existsSync(chunkPath)) {
      const uncompressed = fs.readFileSync(chunkPath);
      const compressed = gzipSync(uncompressed, { level: 9 });
      const gzPath = `${chunkPath}.gz`;
      fs.writeFileSync(gzPath, compressed);
      c.gzip = c.url + '.gz';
      c.gzipBytes = compressed.length;
      totalBytes += compressed.length;
    }
  }

  fs.writeFileSync(manifestPath, JSON.stringify(atlas, null, 2));
  console.log(`${relName}: ${(totalBytes / 1e6).toFixed(2)} MB compressed`);
}
