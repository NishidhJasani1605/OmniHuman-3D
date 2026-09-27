/**
 * Specialized Anatomical Mesh Generators for Female-Unique Anatomy:
 * 1. External Genitalia (Clitoral erectile network, vestibular bulbs, Bartholin's glands, labia)
 * 2. Internal Vaginal Canal (connecting introitus to cervix)
 * 3. Female Facial Soft-Tissue Aesthetic Contour (smoothing orbit, maxilla, and zygoma)
 */

export function createCurvedTubeMesh(name, conceptId, system, category, pathPoints, radii, segments = 16) {
  const pathSteps = pathPoints.length - 1;
  const radialSegs = segments;
  const vertices = [];
  const normals = [];
  const indices = [];

  let minX = Infinity, minY = Infinity, minZ = Infinity;
  let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;

  for (let i = 0; i <= pathSteps; i++) {
    const p = pathPoints[i];
    const prev = pathPoints[Math.max(0, i - 1)];
    const next = pathPoints[Math.min(pathSteps, i + 1)];
    const dir = [next[0] - prev[0], next[1] - prev[1], next[2] - prev[2]];
    const len = Math.hypot(...dir) || 1;
    const tan = dir.map(v => v / len);

    let up = [0, 0, 1];
    if (Math.abs(tan[2]) > 0.85) up = [0, 1, 0];

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

    const r = Array.isArray(radii) ? radii[i] : radii;
    const rx = typeof r === 'object' && r.x !== undefined ? r.x : r;
    const rz = typeof r === 'object' && r.z !== undefined ? r.z : r;

    for (let j = 0; j <= radialSegs; j++) {
      const phi = (j / radialSegs) * Math.PI * 2;
      const cos = Math.cos(phi);
      const sin = Math.sin(phi);

      const vx = p[0] + rx * cos * n[0] + rz * sin * binorm[0];
      const vy = p[1] + rx * cos * n[1] + rz * sin * binorm[1];
      const vz = p[2] + rx * cos * n[2] + rz * sin * binorm[2];

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

  for (let i = 0; i < pathSteps; i++) {
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
    female_unique: true,
    female_category: category,
    vertexCount: vertices.length / 3,
    indexCount: indices.length,
    positions: new Float32Array(vertices),
    normals: new Int16Array(normals),
    indices: new Uint32Array(indices),
    bounds: [[minX, minY, minZ], [maxX, maxY, maxZ]]
  };
}

export function createEllipticRingMesh(name, conceptId, system, category, center, rx, ry, rz, thickness, segs = 20, tubeSegs = 8) {
  const [cx, cy, cz] = center;
  const vertices = [];
  const normals = [];
  const indices = [];
  let minX = Infinity, minY = Infinity, minZ = Infinity;
  let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;

  for (let i = 0; i <= segs; i++) {
    const theta = (i / segs) * Math.PI * 2;
    const px = cx + rx * Math.cos(theta);
    const py = cy + ry * Math.sin(theta);
    const pz = cz + rz * Math.cos(theta) * 0.4;

    for (let j = 0; j <= tubeSegs; j++) {
      const phi = (j / tubeSegs) * Math.PI * 2;
      const nx = Math.cos(theta) * Math.cos(phi);
      const ny = Math.sin(theta) * Math.cos(phi);
      const nz = Math.sin(phi);

      const vx = px + nx * thickness;
      const vy = py + ny * thickness;
      const vz = pz + nz * thickness;

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

  for (let i = 0; i < segs; i++) {
    for (let j = 0; j < tubeSegs; j++) {
      const a = i * (tubeSegs + 1) + j;
      const b = (i + 1) * (tubeSegs + 1) + j;
      indices.push(a, b, a + 1);
      indices.push(b, b + 1, a + 1);
    }
  }

  return {
    name,
    conceptId,
    system,
    female_unique: true,
    female_category: category,
    vertexCount: vertices.length / 3,
    indexCount: indices.length,
    positions: new Float32Array(vertices),
    normals: new Int16Array(normals),
    indices: new Uint32Array(indices),
    bounds: [[minX, minY, minZ], [maxX, maxY, maxZ]]
  };
}

export function createEllipsoidMesh(name, conceptId, system, category, center, radii, segments = 16) {
  const [cx, cy, cz] = center;
  const [rx, ry, rz] = radii;
  const vertices = [];
  const normals = [];
  const indices = [];

  let minX = Infinity, minY = Infinity, minZ = Infinity;
  let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;

  for (let lat = 0; lat <= segments; lat++) {
    const theta = (lat * Math.PI) / segments;
    const sinTheta = Math.sin(theta);
    const cosTheta = Math.cos(theta);

    for (let lon = 0; lon <= segments; lon++) {
      const phi = (lon * 2 * Math.PI) / segments;
      const nx = sinTheta * Math.cos(phi);
      const ny = cosTheta;
      const nz = sinTheta * Math.sin(phi);

      const vx = cx + rx * nx;
      const vy = cy + ry * ny;
      const vz = cz + rz * nz;

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
    female_unique: true,
    female_category: category,
    vertexCount: vertices.length / 3,
    indexCount: indices.length,
    positions: new Float32Array(vertices),
    normals: new Int16Array(normals),
    indices: new Uint32Array(indices),
    bounds: [[minX, minY, minZ], [maxX, maxY, maxZ]]
  };
}

export function generateAllFemaleSpecializedParts() {
  const parts = [];

  // =========================================================================
  // A. Clitoral Erectile Complex & Vulva
  // =========================================================================

  // 1. Glans clitoridis & Prepuce
  parts.push(createEllipsoidMesh(
    'Glans clitoridis & prepuce',
    'FMA20193',
    'reproductive',
    'vulva',
    [0.000, 0.812, 0.034],
    [0.0055, 0.0065, 0.0065],
    16
  ));

  // 2. Body of clitoris (Corpus clitoridis)
  const bodyPath = [
    [0.000, 0.814, 0.032],
    [0.000, 0.822, 0.027],
    [0.000, 0.828, 0.021],
    [0.000, 0.830, 0.016]
  ];
  parts.push(createCurvedTubeMesh(
    'Body of clitoris (Corpus clitoridis)',
    'FMA20192',
    'reproductive',
    'vulva',
    bodyPath,
    [0.005, 0.0055, 0.0058, 0.006],
    14
  ));

  // 3. Left & Right Crura of clitoris (Crus clitoridis)
  const leftCrusPath = [
    [0.002, 0.830, 0.016],
    [0.008, 0.825, 0.012],
    [0.015, 0.818, 0.008],
    [0.021, 0.808, 0.003]
  ];
  const rightCrusPath = [
    [-0.002, 0.830, 0.016],
    [-0.008, 0.825, 0.012],
    [-0.015, 0.818, 0.008],
    [-0.021, 0.808, 0.003]
  ];
  parts.push(createCurvedTubeMesh(
    'Left crus of clitoris',
    'FMA20194',
    'reproductive',
    'vulva',
    leftCrusPath,
    [0.005, 0.0048, 0.0042, 0.0035],
    14
  ));
  parts.push(createCurvedTubeMesh(
    'Right crus of clitoris',
    'FMA20195',
    'reproductive',
    'vulva',
    rightCrusPath,
    [0.005, 0.0048, 0.0042, 0.0035],
    14
  ));

  // 4. Bulbs of vestibule (Left & Right vestibular bulbs)
  const leftBulbPath = [
    [0.007, 0.814, 0.024],
    [0.011, 0.803, 0.018],
    [0.013, 0.792, 0.012],
    [0.011, 0.782, 0.006]
  ];
  const rightBulbPath = [
    [-0.007, 0.814, 0.024],
    [-0.011, 0.803, 0.018],
    [-0.013, 0.792, 0.012],
    [-0.011, 0.782, 0.006]
  ];
  parts.push(createCurvedTubeMesh(
    'Left bulb of vestibule',
    'FMA19985',
    'reproductive',
    'vulva',
    leftBulbPath,
    [0.0045, 0.0068, 0.0072, 0.0052],
    16
  ));
  parts.push(createCurvedTubeMesh(
    'Right bulb of vestibule',
    'FMA19985',
    'reproductive',
    'vulva',
    rightBulbPath,
    [0.0045, 0.0068, 0.0072, 0.0052],
    16
  ));

  // 5. Greater vestibular glands of Bartholin (Left & Right)
  parts.push(createEllipsoidMesh(
    'Left greater vestibular gland (Bartholin)',
    'FMA19987',
    'reproductive',
    'vulva',
    [0.013, 0.776, 0.006],
    [0.004, 0.005, 0.004],
    14
  ));
  parts.push(createEllipsoidMesh(
    'Right greater vestibular gland (Bartholin)',
    'FMA19987',
    'reproductive',
    'vulva',
    [-0.013, 0.776, 0.006],
    [0.004, 0.005, 0.004],
    14
  ));

  // 6. Labia minora (Left & Right)
  const leftMinoraPath = [
    [0.003, 0.815, 0.030],
    [0.006, 0.802, 0.024],
    [0.007, 0.790, 0.017],
    [0.004, 0.774, 0.009]
  ];
  const rightMinoraPath = [
    [-0.003, 0.815, 0.030],
    [-0.006, 0.802, 0.024],
    [-0.007, 0.790, 0.017],
    [-0.004, 0.774, 0.009]
  ];
  parts.push(createCurvedTubeMesh(
    'Left labium minus',
    'FMA20189',
    'reproductive',
    'vulva',
    leftMinoraPath,
    { x: 0.0022, z: 0.0065 },
    14
  ));
  parts.push(createCurvedTubeMesh(
    'Right labium minus',
    'FMA20189',
    'reproductive',
    'vulva',
    rightMinoraPath,
    { x: 0.0022, z: 0.0065 },
    14
  ));

  // 7. Labia majora (Left & Right)
  const leftMajoraPath = [
    [0.005, 0.822, 0.035],
    [0.013, 0.805, 0.028],
    [0.015, 0.788, 0.020],
    [0.008, 0.768, 0.012]
  ];
  const rightMajoraPath = [
    [-0.005, 0.822, 0.035],
    [-0.013, 0.805, 0.028],
    [-0.015, 0.788, 0.020],
    [-0.008, 0.768, 0.012]
  ];
  parts.push(createCurvedTubeMesh(
    'Left labium majus',
    'FMA20188',
    'reproductive',
    'vulva',
    leftMajoraPath,
    { x: 0.0065, z: 0.0095 },
    16
  ));
  parts.push(createCurvedTubeMesh(
    'Right labium majus',
    'FMA20188',
    'reproductive',
    'vulva',
    rightMajoraPath,
    { x: 0.0065, z: 0.0095 },
    16
  ));

  // =========================================================================
  // B. Vaginal Canal (Connecting Introitus to Uterine Cervix)
  // =========================================================================
  const vaginaPath = [
    [0.000, 0.776, 0.010],
    [0.000, 0.792, 0.002],
    [0.000, 0.810, -0.010],
    [0.000, 0.828, -0.024],
    [-0.002, 0.844, -0.038]
  ];
  parts.push(createCurvedTubeMesh(
    'Vaginal canal (Colpos / Anterior & posterior columns)',
    'FMA19949',
    'reproductive',
    'uterus',
    vaginaPath,
    { x: 0.014, z: 0.009 },
    18
  ));

  // =========================================================================
  // C. Perineal, Vestibular, and Paraurethral Architecture
  // =========================================================================

  // 1. Vaginal Vestibule (FMA20187): Smooth mucosal fossa between labia minora
  parts.push(createEllipsoidMesh(
    'Vaginal vestibule (Fossa navicularis & vestibular cleft)',
    'FMA20187',
    'reproductive',
    'vulva',
    [0.000, 0.792, 0.018],
    [0.006, 0.018, 0.008],
    18
  ));

  // 2. Hymen & Vaginal Introitus (FMA20190): Annular mucosal fold guarding vaginal entrance
  parts.push(createEllipticRingMesh(
    'Hymen & vaginal introitus (Ostium vaginae)',
    'FMA20190',
    'reproductive',
    'vulva',
    [0.000, 0.782, 0.012],
    0.009, // rx
    0.007, // ry
    0.003, // rz
    0.0022, // thickness
    18,
    8
  ));

  // 3. Female Urethra & External Urethral Sphincter (FMA19667): Short 4cm female urinary conduit
  const urethraPath = [
    [0.000, 0.828, 0.032], // Bladder neck / internal urethral orifice
    [0.000, 0.812, 0.026], // Mid-urethra through urogenital diaphragm
    [0.000, 0.798, 0.022]  // External urethral orifice in vestibule
  ];
  parts.push(createCurvedTubeMesh(
    'Female urethra & external urethral sphincter',
    'FMA19667',
    'urinary',
    'bladder',
    urethraPath,
    0.0035,
    14
  ));

  // 4. Left & Right Skene's Paraurethral Glands (FMA19988): Mucus-secreting paraurethral glands
  parts.push(createEllipsoidMesh(
    'Left paraurethral gland (Skene)',
    'FMA19988',
    'reproductive',
    'vulva',
    [0.0048, 0.802, 0.024],
    [0.0022, 0.0035, 0.0025],
    12
  ));
  parts.push(createEllipsoidMesh(
    'Right paraurethral gland (Skene)',
    'FMA19988',
    'reproductive',
    'vulva',
    [-0.0048, 0.802, 0.024],
    [0.0022, 0.0035, 0.0025],
    12
  ));

  return parts;
}
