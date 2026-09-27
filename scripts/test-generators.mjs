import assert from 'node:assert/strict';

export function createFetalHeadMesh(name, conceptId, system) {
  // 38-week full-term fetal head in vertex presentation (head downward at maternal pelvic brim)
  // Vertex is at bottom (y ≈ 0.86), skull base/neck junction at top (y ≈ 0.98), occiput anterior/transverse
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
    const theta = v * Math.PI; // 0 to PI
    const sinTheta = Math.sin(theta);
    const cosTheta = Math.cos(theta);

    for (let lon = 0; lon <= lonSegs; lon++) {
      const u = lon / lonSegs;
      const phi = u * Math.PI * 2; // 0 to 2PI
      const sinPhi = Math.sin(phi);
      const cosPhi = Math.cos(phi);

      // Unit sphere coords
      let nx = sinTheta * Math.cos(phi - Math.PI / 2);
      let ny = -cosTheta; // Invert Y so vertex (crowning pole) is downwards towards cervix
      let nz = sinTheta * Math.sin(phi - Math.PI / 2);

      // Anatomical fetal cranial morphology modulation:
      // 1. Parietal eminences (lateral bulges around mid-cranium)
      const parietalBulge = 1.0 + 0.08 * Math.pow(Math.abs(nx), 1.8) * Math.exp(-Math.pow(ny - 0.1, 2) / 0.15);

      // 2. Frontal bone prominence and metopic suture indentation
      const isFrontal = (nz < -0.15 && ny > -0.2);
      const frontalShape = isFrontal ? (1.0 + 0.05 * Math.sin(Math.PI * (ny + 0.2) / 0.8)) : 1.0;

      // 3. Occipital vault (broad rounded curvature at back of head)
      const isOccipital = (nz > 0.15 && ny < 0.3);
      const occipitalShape = isOccipital ? (1.0 + 0.07 * Math.exp(-Math.pow(ny + 0.2, 2) / 0.2)) : 1.0;

      // 4. Facial contouring tucked towards anterior fetal chest (pointing anterior-superior)
      // Delicate facial taper at anterior-inferior aspect
      let facialTaper = 1.0;
      if (ny > 0.1 && nz < -0.1) {
        facialTaper = 1.0 - 0.18 * (ny - 0.1) * (-nz);
      }

      const mod = parietalBulge * frontalShape * occipitalShape * facialTaper;

      const vx = center[0] + rx * nx * mod;
      const vy = center[1] + ry * ny * mod;
      const vz = center[2] + rz * nz * mod;

      vertices.push(vx, vy, vz);

      // Surface normal approximation
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
    // Follow smooth kyphotic C-curve from cervical spine (t=0) to pelvis/rump (t=1)
    const angle = -0.3 + t * (Math.PI * 0.72);
    const cy = 1.07;
    const cz = 0.085;
    const curveR = 0.11;

    const y = cy - curveR * Math.cos(angle);
    const z = cz - curveR * Math.sin(angle) * 0.75 + (t > 0.6 ? (t - 0.6) * 0.04 : 0);
    const x = Math.sin(t * Math.PI) * 0.005; // Gentle natural fetal tilt

    // Variable thoracic & abdominal radii
    // t=0: cervical neck (r~0.028), t=0.4: thorax/ribs (r~0.042), t=0.8: abdomen/pelvis (r~0.046), t=1.0: rump (r~0.038)
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

      // Anatomical cross-section: slightly wider laterally (sin * binorm is lateral X)
      // Dorsal spinal ridge (cos > 0.7) and soft ventral abdomen
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
  // Authentically sculpted flexed limbs (upper arms crossed over chest, or thighs/legs flexed against abdomen)
  const vertices = [];
  const normals = [];
  const indices = [];
  let minX = Infinity, minY = Infinity, minZ = Infinity;
  let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;

  const sidePaths = [];

  if (limbType === 'upper') {
    // Upper limbs: Left and Right arms flexed at elbows with hands crossed on anterior chest
    // Left arm spline
    sidePaths.push([
      [0.038, 1.05, 0.08],  // Left shoulder
      [0.052, 1.01, 0.11],  // Left elbow
      [0.028, 0.99, 0.13],  // Left forearm
      [0.008, 1.01, 0.135]  // Left hand near chin
    ]);
    // Right arm spline
    sidePaths.push([
      [-0.038, 1.05, 0.08], // Right shoulder
      [-0.052, 1.01, 0.11], // Right elbow
      [-0.028, 0.99, 0.13], // Right forearm
      [-0.008, 1.01, 0.135] // Right hand near chin
    ]);
  } else {
    // Lower limbs: Left and Right thighs flexed up against abdomen, knees bent, feet crossed near fundus
    // Left leg spline
    sidePaths.push([
      [0.032, 1.13, 0.09],  // Left hip
      [0.046, 1.18, 0.13],  // Left knee
      [0.028, 1.15, 0.145], // Left calf
      [0.010, 1.12, 0.14]   // Left foot tucked
    ]);
    // Right leg spline
    sidePaths.push([
      [-0.032, 1.13, 0.09], // Right hip
      [-0.046, 1.18, 0.13], // Right knee
      [-0.028, 1.15, 0.145],// Right calf
      [-0.010, 1.12, 0.14]  // Right foot tucked
    ]);
  }

  const radialSegs = 14;
  const pathSteps = 16;
  const baseRadius = limbType === 'upper' ? 0.013 : 0.016;

  for (const pts of sidePaths) {
    // Interpolate Catmull-Rom or cubic spline along path
    const interpolated = [];
    for (let s = 0; s <= pathSteps; s++) {
      const u = s / pathSteps;
      const segIdx = Math.min(pts.length - 2, Math.floor(u * (pts.length - 1)));
      const segT = (u * (pts.length - 1)) - segIdx;
      const p0 = pts[Math.max(0, segIdx - 1)];
      const p1 = pts[segIdx];
      const p2 = pts[Math.min(pts.length - 1, segIdx + 1)];
      const p3 = pts[Math.min(pts.length - 1, segIdx + 2)];

      // Cubic interpolation
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

      // Taper at wrists/ankles, thicker at joint
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
  // Thick vascular discoid organ adhered to the posterior uterine fundus
  const latSegs = 24;
  const lonSegs = 28;
  const vertices = [];
  const normals = [];
  const indices = [];

  const center = [0.00, 1.17, 0.035];
  const rx = 0.082; // Lateral radius ~16.4 cm width
  const ry = 0.072; // Vertical radius ~14.4 cm height
  const rz = 0.018; // Anteroposterior thickness ~3.6 cm

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

      // Chorionic surface irregularity (maternal cotyledons and vessel branches)
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
  // 3-vessel helical twist from placental insertion to fetal umbilicus
  const cordSteps = 42;
  const radialSegs = 14;
  const cordPoints = [];

  const startPt = [0.00, 1.16, 0.05]; // Placental insertion
  const endPt = [0.00, 1.05, 0.12];   // Fetal umbilicus

  for (let i = 0; i <= cordSteps; i++) {
    const t = i / cordSteps;
    // Spiral twist around direct connecting line
    const spiralAngle = t * Math.PI * 8.0; // 4 complete turns
    const spiralR = 0.016 * Math.sin(t * Math.PI); // Widest in middle, zero at ends

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

  const cordRadius = 0.0065; // ~1.3 cm diameter cord

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
      // 3-vessel longitudinal surface ridges (2 arteries + 1 vein)
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

const head = createFetalHeadMesh('Fetus (Head / Cranium - Vertex presentation)', 'FMA7204-FH', 'reproductive');
const torso = createFetalTorsoMesh('Fetus (Torso & flexed spine)', 'FMA7204-FT', 'reproductive');
const upper = createFetalLimbsMesh('Fetus (Flexed upper limbs)', 'FMA7204-FU', 'reproductive', 'upper');
const lower = createFetalLimbsMesh('Fetus (Flexed lower limbs)', 'FMA7204-FL', 'reproductive', 'lower');
const placenta = createDiscoidPlacentaMesh('Placenta (Maternal discoid plate & chorion)', 'FMA63890', 'reproductive');
const cord = createHelicalUmbilicalCordMesh('Umbilical cord (Helical 3-vessel conduit)', 'FMA63893', 'reproductive');

console.log('Head vertices:', head.vertexCount, 'triangles:', head.indexCount / 3, 'bounds:', head.bounds);
console.log('Torso vertices:', torso.vertexCount, 'triangles:', torso.indexCount / 3, 'bounds:', torso.bounds);
console.log('Upper limbs vertices:', upper.vertexCount, 'triangles:', upper.indexCount / 3, 'bounds:', upper.bounds);
console.log('Lower limbs vertices:', lower.vertexCount, 'triangles:', lower.indexCount / 3, 'bounds:', lower.bounds);
console.log('Placenta vertices:', placenta.vertexCount, 'triangles:', placenta.indexCount / 3, 'bounds:', placenta.bounds);
console.log('Cord vertices:', cord.vertexCount, 'triangles:', cord.indexCount / 3, 'bounds:', cord.bounds);

