import {useEffect,useRef} from 'react';
import * as T from 'three';
import {OrbitControls} from 'three/examples/jsm/controls/OrbitControls.js';
import {RoomEnvironment} from 'three/examples/jsm/environments/RoomEnvironment.js';
import {mergeGeometries} from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import {createExplosionLayout} from './explosion-layout';
import {decodeModelResponse} from './model-download';
import {PointerTap} from './pointer-tap';
import {SYSTEMS,type Atlas,type SceneState,type AtlasMode,type FemalePath,type MalePath,type DimorphicArrangement,type DimorphicFilter} from './anatomy';
import {CinematicDissector,type DissectorState,type HudInfo} from './cinematic-dissector';

export type {AtlasMode, FemalePath, MalePath, DimorphicArrangement, DimorphicFilter};

interface Props {
  atlas: Atlas;
  state: SceneState;
  mode?: AtlasMode;
  femalePath?: FemalePath;
  malePath?: MalePath;
  dimorphicArrangement?: DimorphicArrangement;
  dimorphicFilter?: DimorphicFilter;
  pregWeek?: number;
  uterineOpacity?: number;
  ageYear?: number;
  dexaEnabled?: boolean;
  onSelect: (id: string) => void;
  onProgress: (n: number) => void;
  onError: (s: string) => void;
  onCinematicState?: (state: DissectorState) => void;
  onHudUpdate?: (hud: HudInfo | null) => void;
  onCinematicReady?: (dissector: CinematicDissector) => void;
  onRequestRestore?: () => void;
}

export default function AnatomyScene({
  atlas,
  state,
  mode,
  femalePath,
  malePath,
  dimorphicArrangement,
  dimorphicFilter,
  pregWeek,
  uterineOpacity,
  ageYear,
  dexaEnabled,
  onSelect,
  onProgress,
  onError,
  onCinematicState,
  onHudUpdate,
  onCinematicReady,
  onRequestRestore
}: Props) {
  const host = useRef<HTMLDivElement>(null);
  const latest = useRef(state);
  const select = useRef(onSelect);
  const cinematicStateCb = useRef(onCinematicState);
  const hudCb = useRef(onHudUpdate);
  const readyCb = useRef(onCinematicReady);
  const restoreCb = useRef(onRequestRestore);

  const dynamicProps = useRef({
    mode,
    femalePath,
    malePath,
    dimorphicArrangement,
    dimorphicFilter,
    pregWeek,
    uterineOpacity,
    ageYear,
    dexaEnabled
  });
  dynamicProps.current = {
    mode,
    femalePath,
    malePath,
    dimorphicArrangement,
    dimorphicFilter,
    pregWeek,
    uterineOpacity,
    ageYear,
    dexaEnabled
  };

  latest.current = state;
  select.current = onSelect;
  cinematicStateCb.current = onCinematicState;
  hudCb.current = onHudUpdate;
  readyCb.current = onCinematicReady;
  restoreCb.current = onRequestRestore;

  useEffect(() => {
    const el = host.current!;
    let disposed = false, frame = 0, dirty = true, ready = false, lastView = '', lastReset = -1, lastIsolate = '', layoutKey = '', amount = 0;
    let lastState: SceneState | null = null;
    const abort = new AbortController();
    let renderer: T.WebGLRenderer;
    try {
      renderer = new T.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' });
    } catch {
      onError('This browser could not start the 3D viewer. Please try a browser with WebGL enabled.');
      return;
    }
    renderer.setPixelRatio(Math.min(devicePixelRatio, innerWidth < 768 ? 1.5 : 2));
    renderer.setClearColor('#05070e');
    renderer.outputColorSpace = T.SRGBColorSpace;
    renderer.toneMapping = T.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.12;
    el.appendChild(renderer.domElement);
    renderer.domElement.setAttribute('aria-label', 'Interactive human anatomy. Drag to orbit, pinch or scroll to zoom, and tap a structure to inspect it.');

    const isTrunkAtlas = dynamicProps.current.mode === 'female' && dynamicProps.current.femalePath === 'female-trunk-hra';
    const isDimorphicAtlas = dynamicProps.current.mode === 'dimorphic' ||
      dynamicProps.current.femalePath === 'female-dimorphic' ||
      (dynamicProps.current.mode === 'male' && dynamicProps.current.malePath === 'male-dimorphic');

    const scene = new T.Scene(), camera = new T.PerspectiveCamera(34, 1, .005, 100), controls = new OrbitControls(camera, renderer.domElement);
    camera.position.set(
      1.2,
      isTrunkAtlas ? 1.25 : isDimorphicAtlas ? 1.15 : 1.05,
      isTrunkAtlas ? 2.7 : isDimorphicAtlas ? 1.95 : 3.6
    );
    controls.target.set(0, isTrunkAtlas ? 1.12 : isDimorphicAtlas ? 1.02 : .85, 0);
    controls.enableDamping = true;
    controls.dampingFactor = .085;
    controls.minDistance = .07;
    controls.maxDistance = 40;
    controls.maxPolarAngle = Math.PI * .96;
    controls.addEventListener('change', () => { dirty = true; });

    const pmrem = new T.PMREMGenerator(renderer), room = new RoomEnvironment(), env = pmrem.fromScene(room, .04);
    scene.environment = env.texture;
    room.dispose();
    pmrem.dispose();

    scene.add(new T.HemisphereLight(0xe2e8f0, 0x0a1020, 0.95));
    const key = new T.DirectionalLight(0xfffaf4, 1.85);
    key.position.set(-2, 4, 3);
    scene.add(key);
    const rim = new T.DirectionalLight(0x38bdf8, 1.35);
    rim.position.set(2, 2, -3);
    scene.add(rim);

    const ground = new T.Mesh(new T.CircleGeometry(30, 96), new T.MeshStandardMaterial({ color: 0x070b14, roughness: 1 }));
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -.019;
    scene.add(ground);

    const platform = new T.Mesh(new T.CylinderGeometry(.68, .7, .028, 100), new T.MeshStandardMaterial({ color: 0x0c1322, metalness: .2, roughness: .6 }));
    platform.position.y = -.016;
    scene.add(platform);

    const ring = new T.Mesh(new T.RingGeometry(.63, .632, 128), new T.MeshBasicMaterial({ color: 0x00f0ff, transparent: true, opacity: .55, side: T.DoubleSide }));
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = .001;
    scene.add(ring);

    const innerRing = new T.Mesh(new T.RingGeometry(.55, .551, 128), new T.MeshBasicMaterial({ color: 0x38bdf8, transparent: true, opacity: .25, side: T.DoubleSide }));
    innerRing.rotation.x = -Math.PI / 2;
    innerRing.position.y = .001;
    scene.add(innerRing);

    if (isTrunkAtlas || isDimorphicAtlas) {
      ground.visible = platform.visible = ring.visible = innerRing.visible = false;
    }

    const width = T.MathUtils.ceilPowerOfTwo(atlas.parts.length);
    const data = new Float32Array(width * 4);
    const partTexture = new T.DataTexture(data, width, 1, T.RGBAFormat, T.FloatType);
    partTexture.needsUpdate = true;

    const selectedData = new Uint8Array(width * 4);
    const selectionTexture = new T.DataTexture(selectedData, width, 1);
    selectionTexture.needsUpdate = true;

    const alphaData = new Float32Array(width * 4);
    alphaData.fill(1.0);
    const alphaTexture = new T.DataTexture(alphaData, width, 1, T.RGBAFormat, T.FloatType);
    alphaTexture.needsUpdate = true;

    const colorData = new Float32Array(width * 4);
    const colorTexture = new T.DataTexture(colorData, width, 1, T.RGBAFormat, T.FloatType);
    colorTexture.needsUpdate = true;

    const partAlphas = new Float32Array(atlas.parts.length);
    partAlphas.fill(1.0);

    const materials: T.Material[] = [], geometries: T.BufferGeometry[] = [], pickers: (T.Mesh | undefined)[] = [];
    const centers = atlas.parts.map(p => new T.Vector3().fromArray(p.bounds[0]).add(new T.Vector3().fromArray(p.bounds[1])).multiplyScalar(.5));
    const offsets: T.Vector3[] = [], bounds = atlas.parts.map(p => new T.Box3(new T.Vector3().fromArray(p.bounds[0]), new T.Vector3().fromArray(p.bounds[1])));
    let packingWidth = 1, packingHeight = 1;

    const markerPositions = new Float32Array(atlas.parts.length * 3), markerGeometry = new T.BufferGeometry();
    markerGeometry.setAttribute('position', new T.BufferAttribute(markerPositions, 3));
    const markerMaterial = new T.PointsMaterial({ color: 0x64748b, size: 5, sizeAttenuation: false, transparent: true, opacity: .72, depthTest: false });
    markerMaterial.onBeforeCompile = shader => {
      shader.fragmentShader = shader.fragmentShader.replace('#include <clipping_planes_fragment>', '#include <clipping_planes_fragment>\nif (distance(gl_PointCoord, vec2(0.5)) > 0.5) discard;');
    };
    const markers = new T.Points(markerGeometry, markerMaterial);
    markers.frustumCulled = false;
    markers.renderOrder = 10;
    markers.visible = false;
    scene.add(markers);

    const hover = document.createElement('div');
    hover.className = 'part-hover';
    hover.setAttribute('role', 'tooltip');
    hover.hidden = true;
    el.appendChild(hover);

    type Target = { index: number; x: number; y: number; left: number; right: number; top: number; bottom: number };
    let targets: Target[] = [];
    const projected = new T.Vector3();

    const findTarget = (x: number, y: number, radius: number) => {
      let best = -1, score = Infinity;
      for (const t of targets) {
        const dx = Math.max(t.left - x, 0, x - t.right), dy = Math.max(t.top - y, 0, y - t.bottom), distance = Math.hypot(dx, dy);
        if (distance > radius) continue;
        const candidate = distance + Math.hypot(t.x - x, t.y - y) * .025;
        if (candidate < score) { score = candidate; best = t.index; }
      }
      return best;
    };

    const shaderUniformsList: Array<{
      isFemale: { value: number };
      isPregnancy: { value: number };
      isAbdominalWall: { value: number };
      pregProgress: { value: number };
      ageProgress: { value: number };
    }> = [];

    const isFemaleAtlas = atlas.sex === 'female' || (dynamicProps.current.mode !== 'male' && !atlas.name?.toLowerCase().includes('male'));
    const isPregAtlas = dynamicProps.current.mode === 'pregnancy' || !!atlas.name?.toLowerCase().includes('pregnancy') || !!atlas.name?.toLowerCase().includes('gestational');

    const materialFor = (system: string, isEnvelope = false) => {
      const isSurface = system === 'integumentary';
      const isAbdominalSystem = system === 'muscular' || system === 'integumentary';
      const m = new T.MeshStandardMaterial({
        color: SYSTEMS.find(s => s.id === system)?.color ?? '#aebbb8',
        metalness: .08,
        roughness: .53,
        side: T.DoubleSide,
        transparent: true,
        opacity: isSurface ? .1 : 1,
        depthWrite: !isSurface && !isEnvelope
      });

      const isFemUni = { value: isFemaleAtlas ? 1.0 : 0.0 };
      const isPregUni = { value: isPregAtlas ? 1.0 : 0.0 };
      const isAbdomUni = { value: isAbdominalSystem ? 1.0 : 0.0 };
      const pregProgUni = { value: (dynamicProps.current.pregWeek ?? 38) / 40.0 };
      const ageProgUni = { value: (dynamicProps.current.ageYear ?? 25) / 80.0 };
      shaderUniformsList.push({ isFemale: isFemUni, isPregnancy: isPregUni, isAbdominalWall: isAbdomUni, pregProgress: pregProgUni, ageProgress: ageProgUni });

      m.onBeforeCompile = shader => {
        shader.uniforms.partState = { value: partTexture };
        shader.uniforms.selectionState = { value: selectionTexture };
        shader.uniforms.alphaState = { value: alphaTexture };
        shader.uniforms.colorState = { value: colorTexture };
        shader.uniforms.stateWidth = { value: width };
        shader.uniforms.isFemale = isFemUni;
        shader.uniforms.isPregnancy = isPregUni;
        shader.uniforms.isAbdominalWall = isAbdomUni;
        shader.uniforms.pregProgress = pregProgUni;
        shader.uniforms.ageProgress = ageProgUni;

        shader.vertexShader = 'attribute float partIndex; uniform sampler2D partState; uniform sampler2D selectionState; uniform sampler2D alphaState; uniform sampler2D colorState; uniform float stateWidth; uniform float isFemale; uniform float isPregnancy; uniform float isAbdominalWall; uniform float pregProgress; uniform float ageProgress; varying float partVisible; varying float partSelected; varying float partAlpha; varying vec4 partCustomColor;\n' + shader.vertexShader;
        shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>', `
#include <begin_vertex>
vec2 stateUv = vec2((partIndex + 0.5) / stateWidth, 0.5);
vec4 state = texture2D(partState, stateUv);
partSelected = texture2D(selectionState, stateUv).r;
partAlpha = texture2D(alphaState, stateUv).r;
partCustomColor = texture2D(colorState, stateUv);
partVisible = state.w;

vec3 pos = position;

// 1. Feminine anatomical contouring for female reference atlases
if (isFemale > 0.5) {
  // A. Pectoralis softening: slenderize male pectoralis major protrusion
  if (pos.y > 1.18 && pos.y < 1.42 && pos.z > 0.02) {
    float pecFactor = smoothstep(1.18, 1.28, pos.y) * (1.0 - smoothstep(1.28, 1.42, pos.y));
    pos.z -= 0.016 * pecFactor * smoothstep(0.02, 0.12, pos.z);
  }

  // B. Slender female shoulder breadth
  if (pos.y > 1.36 && pos.y < 1.48 && abs(pos.x) > 0.10) {
    pos.x *= 0.94;
  }

  // C. Natural feminine waist tapering (Y: 0.94 to 1.18)
  float waist = smoothstep(0.92, 1.06, pos.y) * (1.0 - smoothstep(1.06, 1.20, pos.y));
  pos.x *= (1.0 - 0.095 * waist);

  // D. Gynecoid pelvic flare (Y: 0.74 to 0.98)
  float hips = smoothstep(0.72, 0.86, pos.y) * (1.0 - smoothstep(0.86, 1.00, pos.y));
  pos.x *= (1.0 + 0.075 * hips);

  // E. Gracile female cranial/facial cephalometrics (Y > 1.48)
  if (pos.y > 1.56 && pos.z > 0.04) {
    pos.z -= 0.006 * smoothstep(1.56, 1.62, pos.y);
  }
  if (pos.y > 1.48 && pos.y < 1.56 && abs(pos.x) > 0.015) {
    pos.x *= 0.95;
  }
}

// 2. Pregnancy maternal abdominal contouring (only expands muscular wall & skin; never internal viscera)
if (isPregnancy > 0.5 && isAbdominalWall > 0.5 && pos.y > 0.80 && pos.y < 1.28 && pos.z > 0.02) {
  float pregFactor = smoothstep(0.80, 1.02, pos.y) * (1.0 - smoothstep(1.02, 1.28, pos.y));
  pos.z += 0.075 * pregFactor * pregProgress;
  pos.x *= (1.0 + 0.045 * pregFactor * pregProgress);
}

// 3. Real-time Lifespan Morphological Aging
if (ageProgress > 0.55) {
  float ageFactor = smoothstep(0.55, 1.0, ageProgress);
  // Thoracic hyperkyphosis (Dowager's hump in T1-T12 vertebrae and dorsal torso)
  if (pos.y > 1.15 && pos.y < 1.44 && pos.z < -0.01) {
    float kyphFactor = smoothstep(1.15, 1.29, pos.y) * (1.0 - smoothstep(1.29, 1.44, pos.y));
    pos.z -= 0.024 * kyphFactor * ageFactor;
  }
  // Anterior cranio-cervical head carriage compensation
  if (pos.y > 1.45) {
    pos.z += 0.012 * ageFactor;
    pos.y -= 0.016 * ageFactor;
  }
  // Disc dehydration stature loss (height loss across spine and torso)
  if (pos.y > 0.85 && pos.y <= 1.45) {
    pos.y -= 0.016 * ((pos.y - 0.85) / 0.60) * ageFactor;
  }
}

transformed = pos + state.xyz;
`);
        shader.fragmentShader = 'varying float partVisible; varying float partSelected; varying float partAlpha; varying vec4 partCustomColor;\n' + shader.fragmentShader;
        shader.fragmentShader = shader.fragmentShader.replace('#include <clipping_planes_fragment>', '#include <clipping_planes_fragment>\nif (partVisible < 0.5 || partAlpha < 0.01) discard;');
        shader.fragmentShader = shader.fragmentShader.replace('#include <color_fragment>', `
#include <color_fragment>
if (partCustomColor.a > 0.05) {
  diffuseColor.rgb = mix(diffuseColor.rgb, partCustomColor.rgb, partCustomColor.a);
}
if (partSelected > 0.5) {
  diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.35, 0.85, 0.82), 0.35) + vec3(0.06, 0.16, 0.16);
}
diffuseColor.a *= partAlpha;
`);
      };
      materials.push(m);
      return m;
    };

    const mats = new Map<string, T.Material>();
    for (const s of SYSTEMS) {
      mats.set(s.id, materialFor(s.id, false));
      mats.set(`${s.id}-envelope`, materialFor(s.id, true));
    }

    const getDexaColor = (age: number, isHighRisk: boolean): [number, number, number] => {
      if (age <= 18) {
        const t = Math.max(0, age / 18);
        return [0.12 + 0.06 * t, 0.70 + 0.08 * t, 0.82 - 0.02 * t]; // Soft pediatric teal
      } else if (age <= 35) {
        const t = (age - 18) / 17;
        return [0.06 + 0.10 * t, 0.78 - 0.04 * t, 0.44 - 0.16 * t]; // Emerald peak bone mass
      } else if (age <= 50) {
        const t = (age - 35) / 15;
        return [0.16 + 0.36 * t, 0.74 + 0.02 * t, 0.28 - 0.18 * t]; // Healthy adult lime
      } else if (age <= 62) {
        const t = (age - 50) / 12;
        const accel = isHighRisk ? 1.3 : 0.85;
        const factor = Math.min(1.0, t * accel);
        return [0.52 + 0.43 * factor, 0.76 - 0.16 * factor, 0.10 - 0.06 * factor]; // Perimenopause amber/gold
      } else {
        const t = Math.min(1.0, (age - 62) / 18);
        const accel = isHighRisk ? 1.35 : 1.0;
        const factor = Math.min(1.0, t * accel);
        return [0.95 - 0.05 * factor, 0.60 - 0.45 * factor, 0.04 + 0.10 * factor]; // Geriatric crimson red
      }
    };

    const updateAnatomicalStyling = () => {
      const curDexa = dynamicProps.current.dexaEnabled ?? false;
      const curAge = dynamicProps.current.ageYear ?? 25;
      const curUterineOp = dynamicProps.current.uterineOpacity ?? 65;

      atlas.parts.forEach((p, i) => {
        const n = p.name.toLowerCase();

        // 1. Mammary Gland Anatomy (Natural Solid PBR & Multi-layer clinical dissection)
        if (n.includes('mammary adipose') || n.includes('fat (left)') || n.includes('fat (right)')) {
          colorData.set([0.88, 0.68, 0.60, 1.0], i * 4); // authentic solid natural subcutaneous skin & fat tone
          partAlphas[i] = 1.0;
        } else if (n.includes('nipple')) {
          colorData.set([0.64, 0.32, 0.35, 1.0], i * 4); // natural pigmented nipple
          partAlphas[i] = 1.0;
        } else if (n.includes('areolar tubercle') || n.includes('areolar tubercles')) {
          colorData.set([0.74, 0.42, 0.44, 1.0], i * 4); // Montgomery tubercles
          partAlphas[i] = 1.0;
        } else if (n.includes('areola')) {
          colorData.set([0.72, 0.40, 0.42, 1.0], i * 4); // natural areola
          partAlphas[i] = 1.0;
        } else if (n.includes('mammary glandular') || n.includes('mammary lobes')) {
          colorData.set([0.86, 0.32, 0.44, 1.0], i * 4); // glandular rose
          partAlphas[i] = 1.0;
        } else if (n.includes('lactiferous duct')) {
          colorData.set([0.74, 0.28, 0.82, 1.0], i * 4); // ductal violet
          partAlphas[i] = 1.0;
        } else if (n.includes('lactiferous sinus')) {
          colorData.set([0.80, 0.38, 0.88, 1.0], i * 4); // sinus lilac
          partAlphas[i] = 1.0;
        } else if (n.includes('cooper') || n.includes('suspensory ligament')) {
          colorData.set([0.92, 0.94, 0.96, 1.0], i * 4); // pearl white ligaments
          partAlphas[i] = 1.0;
        }
        // 2. Specialized Female Vulvar, Clitoral, and Pelvic Soft Tissue Anatomy
        else if (n.includes('glans clitoridis') || n.includes('prepuce') || n.includes('clitoris') || n.includes('clitoral')) {
          colorData.set([0.86, 0.32, 0.44, 1.0], i * 4); // rich vascular clitoral erectile tissue
          partAlphas[i] = 1.0;
        } else if (n.includes('bulb of vestibule')) {
          colorData.set([0.80, 0.28, 0.52, 1.0], i * 4); // erectile vestibular bulbs
          partAlphas[i] = 1.0;
        } else if (n.includes('bartholin') || n.includes('vestibular gland')) {
          colorData.set([0.88, 0.45, 0.42, 1.0], i * 4); // secretory vestibular glands
          partAlphas[i] = 1.0;
        } else if (n.includes('labium minus') || n.includes('labia minora')) {
          colorData.set([0.86, 0.42, 0.46, 1.0], i * 4); // mucosal labia minora
          partAlphas[i] = 1.0;
        } else if (n.includes('labium majus') || n.includes('labia majora')) {
          colorData.set([0.88, 0.68, 0.60, 1.0], i * 4); // natural cutaneous labia majora
          partAlphas[i] = 1.0;
        } else if (n.includes('vaginal canal') || n.includes('vagina') || n.includes('colpos')) {
          colorData.set([0.82, 0.30, 0.42, 1.0], i * 4); // muscular vaginal canal
          partAlphas[i] = 1.0;
        } else if (n.includes('orbicularis oris') || n.includes('lips') || n.includes('oral sphincter')) {
          colorData.set([0.82, 0.40, 0.45, 1.0], i * 4); // authentic vermilion lip tone covering teeth
          partAlphas[i] = 1.0;
        } else if (n.includes('eyebrow') || n.includes('superciliary') || n.includes('corrugator supercilii')) {
          colorData.set([0.35, 0.22, 0.20, 1.0], i * 4); // authentic brunette superciliary tone
          partAlphas[i] = 1.0;
        } else if (n.includes('nasalis') || n.includes('nasal cartilaginous')) {
          colorData.set([0.85, 0.70, 0.65, 1.0], i * 4); // nasal cartilage & soft tissue
          partAlphas[i] = 1.0;
        } else if (n.includes('mentalis')) {
          colorData.set([0.78, 0.35, 0.38, 1.0], i * 4); // mentalis chin pad
          partAlphas[i] = 1.0;
        } else if (
          n.includes('orbicularis oculi') ||
          n.includes('masseter') ||
          n.includes('buccinator') ||
          n.includes('zygomaticus') ||
          n.includes('frontalis') ||
          n.includes('levator labii') ||
          n.includes('depressor anguli')
        ) {
          colorData.set([0.76, 0.32, 0.36, 1.0], i * 4); // rich craniofacial muscular tone covering facial skeleton
          partAlphas[i] = 1.0;
        }
        // 3. Fetal & Gestational Dynamics
        else if (n.includes('fetus (head') || n.includes('fetus (torso') || n.includes('fetus (flexed')) {
          colorData.set([0.84, 0.62, 0.56, 1.0], i * 4); // natural warm rosy fetal skin
          partAlphas[i] = 1.0;
        } else if (n.includes('placenta')) {
          colorData.set([0.60, 0.16, 0.22, 1.0], i * 4); // vascular placenta crimson
          partAlphas[i] = 1.0;
        } else if (n.includes('umbilical cord')) {
          colorData.set([0.25, 0.65, 0.78, 1.0], i * 4); // Wharton's jelly umbilical blue
          partAlphas[i] = 1.0;
        } else if (n.includes('anterior wall of uterus') || n.includes('body of uterus') || n.includes('lower uterine')) {
          colorData.set([0.80, 0.32, 0.40, 1.0], i * 4); // gravid anterior myometrium (cutaway window)
          partAlphas[i] = curUterineOp / 100.0;
        } else if (n.includes('gravid')) {
          colorData.set([0.76, 0.28, 0.36, 1.0], i * 4); // gravid posterior wall and fundus
          partAlphas[i] = Math.max(0.65, curUterineOp / 100.0);
        } else if (isPregAtlas && (
          n.includes('external oblique') ||
          n.includes('internal oblique') ||
          n.includes('rectus abdominis') ||
          n.includes('transversus abdominis') ||
          n.includes('pyramidalis') ||
          n.includes('linea alba')
        )) {
          colorData.set([0.78, 0.34, 0.38, 1.0], i * 4); // maternal abdominal wall
          partAlphas[i] = Math.min(1.0, Math.max(0.08, curUterineOp / 100.0));
        }
        // 4. Female Internal Reproductive Organs & Viscera
        else if (n.includes('uterus') || n.includes('myometrium') || n.includes('endometrium')) {
          colorData.set([0.82, 0.28, 0.38, 1.0], i * 4); // rich uterine muscular myometrium
          partAlphas[i] = 1.0;
        } else if (n.includes('cervix') || n.includes('cervicovaginal')) {
          colorData.set([0.76, 0.32, 0.40, 1.0], i * 4); // cervical tissue
          partAlphas[i] = 1.0;
        } else if (n.includes('ovary')) {
          colorData.set([0.90, 0.68, 0.52, 1.0], i * 4); // ovarian follicular peach
          partAlphas[i] = 1.0;
        } else if (n.includes('fallopian') || n.includes('uterine tube')) {
          colorData.set([0.85, 0.36, 0.46, 1.0], i * 4); // fallopian tube rose
          partAlphas[i] = 1.0;
        } else if (n.includes('urinary bladder')) {
          colorData.set([0.78, 0.44, 0.35, 1.0], i * 4); // bladder detrusor
          partAlphas[i] = 1.0;
        }
        // 5. Male Unique Genital, Erectile, and Reproductive Anatomy
        else if (n.includes('glans penis')) {
          colorData.set([0.76, 0.36, 0.42, 1.0], i * 4); // glans penis
          partAlphas[i] = 1.0;
        } else if (n.includes('corpus cavernosum')) {
          colorData.set([0.28, 0.52, 0.82, 1.0], i * 4); // rich erectile vascular cavernosum
          partAlphas[i] = 1.0;
        } else if (n.includes('corpus spongiosum')) {
          colorData.set([0.34, 0.62, 0.88, 1.0], i * 4); // spongiosum urethral body
          partAlphas[i] = 1.0;
        } else if (n.includes('testis') || n.includes('testicle')) {
          colorData.set([0.86, 0.78, 0.66, 1.0], i * 4); // testicular parenchyma
          partAlphas[i] = 1.0;
        } else if (n.includes('epididymis')) {
          colorData.set([0.84, 0.65, 0.52, 1.0], i * 4); // epididymal duct
          partAlphas[i] = 1.0;
        } else if (n.includes('deferent duct') || n.includes('vas deferens')) {
          colorData.set([0.90, 0.90, 0.94, 1.0], i * 4); // spermatic duct
          partAlphas[i] = 1.0;
        } else if (n.includes('seminal vesicle')) {
          colorData.set([0.88, 0.72, 0.44, 1.0], i * 4); // seminal vesicle
          partAlphas[i] = 1.0;
        } else if (n.includes('prostate')) {
          colorData.set([0.76, 0.48, 0.38, 1.0], i * 4); // prostatic parenchyma
          partAlphas[i] = 1.0;
        } else if (n.includes('dorsal artery of penis') || n.includes('testicular artery')) {
          colorData.set([0.88, 0.22, 0.25, 1.0], i * 4); // arterial supply
          partAlphas[i] = 1.0;
        } else if (n.includes('dorsal vein of penis') || n.includes('testicular vein')) {
          colorData.set([0.20, 0.48, 0.82, 1.0], i * 4); // venous drainage
          partAlphas[i] = 1.0;
        }
        // 6. Clinical Continuous DEXA Bone Mineral Density Heatmap
        else if (p.system === 'skeletal') {
          if (curDexa) {
            const isHip = n.includes('femur') || n.includes('hip') || n.includes('pelvis') || n.includes('ilium') || n.includes('ischium') || n.includes('pubis');
            const isSpine = n.includes('lumbar') || n.includes('thoracic') || n.includes('vertebra') || n.includes('sacrum') || n.includes('disc');
            const isRadius = n.includes('radius');
            const isHighRisk = isHip || isSpine || isRadius;

            const [r, g, b] = getDexaColor(curAge, isHighRisk);
            colorData.set([r, g, b, 1.0], i * 4);
          } else {
            colorData.set([0, 0, 0, 0], i * 4);
          }
        } else {
          if (colorData[i * 4 + 3] !== 0) {
            colorData.set([0, 0, 0, 0], i * 4);
          }
        }
      });

      // Synchronize partAlphas into alphaData buffer for alphaTexture
      for (let j = 0; j < atlas.parts.length; j++) {
        alphaData[j * 4] = partAlphas[j];
        alphaData[j * 4 + 1] = partAlphas[j];
        alphaData[j * 4 + 2] = partAlphas[j];
        alphaData[j * 4 + 3] = partAlphas[j];
      }

      colorTexture.needsUpdate = true;
      alphaTexture.needsUpdate = true;
      dirty = true;
    };

    let loaded = 0;
    const isEnvelopePart = (name: string) => {
      const n = name.toLowerCase();
      return isPregAtlas && (
        n.includes('anterior wall of uterus') ||
        n.includes('body of uterus') ||
        n.includes('lower uterine segment') ||
        n.includes('external oblique') ||
        n.includes('internal oblique') ||
        n.includes('rectus abdominis') ||
        n.includes('transversus abdominis') ||
        n.includes('pyramidalis') ||
        n.includes('linea alba')
      );
    };

    const loadChunk = async (ci: number) => {
      const chunk = atlas.chunks[ci], compressed = !!chunk.gzip && typeof DecompressionStream !== 'undefined';
      const response = await fetch(compressed ? chunk.gzip! : chunk.url, { signal: abort.signal });
      const buffer = await decodeModelResponse(response, chunk.bytes, compressed);
      if (disposed) return;
      const groups = new Map<string, T.BufferGeometry[]>();
      atlas.parts.forEach((p, i) => {
        if (p.chunk !== ci) return;
        const g = new T.BufferGeometry();
        g.setAttribute('position', new T.BufferAttribute(new Float32Array(buffer, p.positions, p.vertexCount * 3), 3));
        g.setAttribute('normal', new T.BufferAttribute(new Int16Array(buffer, p.normals, p.vertexCount * 3), 3, true));
        g.setIndex(new T.BufferAttribute(new Uint32Array(buffer, p.indices, p.indexCount), 1));
        g.boundingBox = bounds[i].clone();
        g.computeBoundingSphere();
        const pick = new T.Mesh(g);
        pick.matrixAutoUpdate = false;
        pickers[i] = pick;
        geometries.push(g);
        g.setAttribute('partIndex', new T.BufferAttribute(new Float32Array(p.vertexCount).fill(i), 1));

        const isEnv = isEnvelopePart(p.name);
        const groupKey = isEnv ? `${p.system}-envelope` : p.system;
        const list = groups.get(groupKey) ?? [];
        list.push(g);
        groups.set(groupKey, list);
      });

      groups.forEach((gs, groupKey) => {
        const geometry = mergeGeometries(gs, false);
        if (!geometry) throw new Error('Could not assemble anatomy geometry.');
        geometries.push(geometry);
        const isEnv = groupKey.endsWith('-envelope');
        const baseSystem = isEnv ? groupKey.replace('-envelope', '') : groupKey;
        const mat = mats.get(groupKey) ?? mats.get(baseSystem)!;
        const mesh = new T.Mesh(geometry, mat);
        mesh.frustumCulled = false;
        mesh.renderOrder = isEnv ? 2 : 1;
        scene.add(mesh);
      });
      lastState = null;
      loaded++;
      onProgress(Math.round(loaded / atlas.chunks.length * 100));
      dirty = true;
    };

    const dissector = new CinematicDissector();
    (async () => {
      try {
        let cursor = 0;
        await Promise.all(Array.from({ length: 3 }, async () => {
          while (cursor < atlas.chunks.length) {
            const i = cursor++;
            await loadChunk(i);
          }
        }));
        if (!disposed) {
          ready = true;
          dirty = true;
          updateAnatomicalStyling();
          dissector.init({
            camera,
            controls,
            atlas,
            partAlphas,
            partData: data,
            alphaData,
            alphaTexture,
            selectionData: selectedData,
            selectionTexture,
            centers,
            bounds,
            hostEl: el,
            onHudUpdate: b => { if (hudCb.current) hudCb.current(b); },
            onStateChange: s => { if (cinematicStateCb.current) cinematicStateCb.current(s); dirty = true; },
            onRequestIsolate: () => { dirty = true; },
            onRequestRestore: () => { dirty = true; if (restoreCb.current) restoreCb.current(); },
            onSelectPart: id => { select.current(id); }
          });
          const beacon = dissector.getBeacon();
          if (beacon) scene.add(beacon);
          if (typeof window !== 'undefined') {
            (window as unknown as Record<string, unknown>).__ATLAS_CORE__ = {
              renderer, scene, camera, controls, atlas, mats, materials, pickers, geometries, bounds, centers, offsets,
              partState: data, partStateTexture: partTexture,
              selectionState: selectedData, selectionTexture,
              alphaState: alphaData, alphaTexture,
              colorState: colorData, colorTexture,
              partAlphas,
              markDirty: () => { dirty = true; },
              selectPart: (id: string) => { select.current(id); dirty = true; },
              getState: () => latest.current,
              updateStyling: updateAnatomicalStyling,
              THREE: T
            };
            window.dispatchEvent(new CustomEvent('atlas-ready', { detail: (window as unknown as Record<string, unknown>).__ATLAS_CORE__ }));
          }
          if (readyCb.current) readyCb.current(dissector);
        }
      } catch (e) {
        if (!disposed) onError(e instanceof Error ? e.message : 'Could not load the anatomy.');
      }
    })();

    const fit = (view: string, extent = 0) => {
      const isTrunk = dynamicProps.current.mode === 'female' && dynamicProps.current.femalePath === 'female-trunk-hra';
      const isDimorphic = dynamicProps.current.mode === 'dimorphic' ||
        dynamicProps.current.femalePath === 'female-dimorphic' ||
        (dynamicProps.current.mode === 'male' && dynamicProps.current.malePath === 'male-dimorphic');
      const aspect = camera.aspect, mobile = el.clientWidth < 768;
      const normalDistance = isTrunk ? (mobile ? 3.0 : 2.7) :
                             isDimorphic ? (mobile ? 2.3 : 1.95) :
                             (mobile ? Math.max(4.5, 1.8 * el.clientHeight / Math.max(160, el.clientHeight - 350) / (2 * Math.tan(T.MathUtils.degToRad(camera.fov / 2)))) : 4);
      const reservedHeight = mobile ? 350 : 270;
      const availableAspect = Math.max(.35, (el.clientWidth - (mobile ? 40 : 340)) / Math.max(160, el.clientHeight - reservedHeight));
      const atlasDistance = Math.max(packingHeight, packingWidth / availableAspect) / (2 * Math.tan(T.MathUtils.degToRad(camera.fov / 2))) * (el.clientHeight / Math.max(160, el.clientHeight - reservedHeight)) * 1.08;
      const distance = T.MathUtils.lerp(normalDistance, Math.max(.2, atlasDistance), extent);
      if (extent > .8) view = 'front';
      const direction = view === 'front' ? new T.Vector3(0, .02, 1) : view === 'back' ? new T.Vector3(0, .02, -1) : view === 'side' ? new T.Vector3(1, .02, 0) : new T.Vector3(.35, .06, 1).normalize();
      const targetY = isTrunk ? (extent > .1 || mobile ? 1.15 : 1.12) :
                      isDimorphic ? (extent > .1 || mobile ? 1.05 : 1.00) :
                      (extent > .1 || mobile ? .85 : .68);
      controls.target.set(extent > .1 && el.clientWidth > 767 ? -packingWidth * .12 : 0, targetY, 0);
      camera.position.copy(controls.target).addScaledVector(direction, distance);
      controls.update();
      dirty = true;
    };

    const resize = () => {
      layoutKey = '';
      lastState = null;
      renderer.setPixelRatio(Math.min(devicePixelRatio, el.clientWidth < 768 || el.clientHeight < 600 ? 1.5 : 2));
      camera.aspect = el.clientWidth / el.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(el.clientWidth, el.clientHeight);
      fit(latest.current.view, amount);
    };
    const observer = new ResizeObserver(resize);
    observer.observe(el);

    const raycaster = new T.Raycaster(), pointer = new T.Vector2(), tap = new PointerTap(), worldBox = new T.Box3(), hitPoint = new T.Vector3();
    const down = (e: PointerEvent) => { hover.hidden = true; tap.down(e.pointerId, e.clientX, e.clientY, e.pointerType === 'touch' ? 12 : 5); };
    const move = (e: PointerEvent) => {
      tap.move(e.pointerId, e.clientX, e.clientY);
      if (e.buttons || amount < .5 || e.pointerType === 'touch') { hover.hidden = true; return; }
      const rect = el.getBoundingClientRect(), x = e.clientX - rect.left, y = e.clientY - rect.top, index = findTarget(x, y, 12);
      hover.hidden = index < 0;
      renderer.domElement.style.cursor = index < 0 ? 'grab' : 'pointer';
      if (index >= 0) {
        hover.textContent = atlas.parts[index].name;
        hover.style.left = `${Math.max(8, Math.min(x + 14, el.clientWidth - 260))}px`;
        hover.style.top = `${Math.max(8, Math.min(y + 18, el.clientHeight - 55))}px`;
      }
    };
    const cancel = (e: PointerEvent) => tap.cancel(e.pointerId);
    const up = (e: PointerEvent) => {
      const validTap = tap.up(e.pointerId, e.clientX, e.clientY);
      if (!validTap || !ready) return;
      const rect = renderer.domElement.getBoundingClientRect();
      pointer.set((e.clientX - rect.left) / rect.width * 2 - 1, -(e.clientY - rect.top) / rect.height * 2 + 1);
      raycaster.setFromCamera(pointer, camera);
      let nearest = Infinity, found = -1;
      const hasSolid = atlas.parts.some((p, i) => p.system !== 'integumentary' && data[i * 4 + 3] > .5);
      pickers.forEach((mesh, i) => {
        if (!mesh || data[i * 4 + 3] < .5 || (hasSolid && atlas.parts[i].system === 'integumentary')) return;
        worldBox.copy(bounds[i]).translate(mesh.position);
        if (!raycaster.ray.intersectBox(worldBox, hitPoint)) return;
        const hits = raycaster.intersectObject(mesh, false);
        if (hits[0] && hits[0].distance < nearest) { nearest = hits[0].distance; found = i; }
      });
      if (found < 0 && amount > .45) found = findTarget(e.clientX - rect.left, e.clientY - rect.top, e.pointerType === 'touch' ? 24 : 16);
      if (found >= 0) { hover.hidden = true; select.current(atlas.parts[found].id); }
    };

    renderer.domElement.addEventListener('pointerdown', down);
    renderer.domElement.addEventListener('pointermove', move);
    renderer.domElement.addEventListener('pointerup', up);
    renderer.domElement.addEventListener('pointercancel', cancel);

    const clock = new T.Clock();
    let lastExtent = -1;
    let lastDexa: boolean | undefined = undefined;
    let lastAge: number | undefined = undefined;
    let lastUterine: number | undefined = undefined;
    let lastPregWeek: number | undefined = undefined;
    let lastArrangement: DimorphicArrangement | undefined = undefined;
    let lastDimFilter: DimorphicFilter | undefined = undefined;

    const animate = () => {
      if (disposed) return;
      frame = requestAnimationFrame(animate);
      const dt = Math.min(clock.getDelta(), .05), s = latest.current;

      // Real-time styling synchronization (DEXA heatmap, uterine cutaway, age changes)
      if (
        lastDexa !== dynamicProps.current.dexaEnabled ||
        lastAge !== dynamicProps.current.ageYear ||
        lastUterine !== dynamicProps.current.uterineOpacity ||
        lastPregWeek !== dynamicProps.current.pregWeek
      ) {
        lastDexa = dynamicProps.current.dexaEnabled;
        lastAge = dynamicProps.current.ageYear;
        lastUterine = dynamicProps.current.uterineOpacity;
        lastPregWeek = dynamicProps.current.pregWeek;
        updateAnatomicalStyling();
        for (const u of shaderUniformsList) {
          u.pregProgress.value = (dynamicProps.current.pregWeek ?? 38) / 40.0;
          u.ageProgress.value = (dynamicProps.current.ageYear ?? 25) / 80.0;
        }
        dirty = true;
      }

      // CinematicDissector frame update
      const cinematicActive = dissector.isActive() || (typeof window !== 'undefined' && Boolean((window as unknown as Record<string, unknown>).__ATLAS_DISSECTING__));
      if (cinematicActive) {
        dissector.update(dt);
        for (let i = 0; i < atlas.parts.length; i++) {
          alphaData[i * 4] = partAlphas[i];
          alphaData[i * 4 + 1] = partAlphas[i];
          alphaData[i * 4 + 2] = partAlphas[i];
          alphaData[i * 4 + 3] = partAlphas[i];
        }
        alphaTexture.needsUpdate = true;
        if (dissector.state === 'ACT_4_SOLO_LOCK' || s.isolate) {
          for (let i = 0; i < atlas.parts.length; i++) {
            selectedData[i * 4] = 0;
          }
        }
        selectionTexture.needsUpdate = true;
        dirty = true;
      }

      const changed = lastState?.visible !== s.visible || lastState?.selected !== s.selected || lastState?.isolate !== s.isolate;
      const arrangementChanged = lastArrangement !== dynamicProps.current.dimorphicArrangement;
      const filterChanged = lastDimFilter !== dynamicProps.current.dimorphicFilter;
      const moving = Math.abs(amount - s.explode) > .0001;
      if (moving) { amount = T.MathUtils.damp(amount, s.explode, 8, dt); dirty = true; }

      if ((changed || moving || arrangementChanged || filterChanged || lastExtent < 0) && !cinematicActive) {
        lastArrangement = dynamicProps.current.dimorphicArrangement;
        lastDimFilter = dynamicProps.current.dimorphicFilter;

        const visible = new Set(s.visible), selection = new Set(s.selected);
        const visibleParts = atlas.parts.filter(p => s.isolate ? selection.has(p.id) : visible.has(p.system) || selection.has(p.id));
        const nextLayoutKey = visibleParts.map(p => p.id).join(',') + ':' + camera.aspect.toFixed(3);
        if (nextLayoutKey !== layoutKey) {
          const layout = createExplosionLayout(visibleParts, camera.aspect);
          packingWidth = layout.width;
          packingHeight = layout.height;
          atlas.parts.forEach((p, i) => {
            const cell = layout.cells.get(p.id);
            offsets[i] = cell ? new T.Vector3(cell.x, cell.y + .85, 0) : centers[i].clone();
          });
          layoutKey = nextLayoutKey;
          if (amount > .05 && !s.isolate) fit(s.view, Math.max(0, (amount - .3) / .7));
        }

        const isSideBySide = dynamicProps.current.mode === 'dimorphic' && dynamicProps.current.dimorphicArrangement === 'side-by-side';
        const dimFilter = dynamicProps.current.dimorphicFilter ?? 'all';

        atlas.parts.forEach((p, i) => {
          const c = centers[i], destination = offsets[i];
          let dx = 0, dy = 0, dz = 0;
          if (amount <= .45) {
            const t = amount / .45;
            const group = SYSTEMS.findIndex(sys => sys.id === p.system);
            const angle = group / SYSTEMS.length * Math.PI * 2;
            dx = Math.sin(angle) * t * .48;
            dy = (c.y - .85) * t * .28;
            dz = Math.cos(angle) * t * .48;
          } else {
            const t = (amount - .45) / .55, group = SYSTEMS.findIndex(sys => sys.id === p.system), angle = group / SYSTEMS.length * Math.PI * 2;
            dx = T.MathUtils.lerp(Math.sin(angle) * .48, destination.x - c.x, t);
            dy = T.MathUtils.lerp((c.y - .85) * .28, destination.y - c.y, t);
            dz = T.MathUtils.lerp(Math.cos(angle) * .48, -c.z, t);
          }

          // Dimorphic layout positioning and sex filter
          let isPartDimVisible = true;
          if (dynamicProps.current.mode === 'dimorphic') {
            const partSex = p.sex ?? (p.id.startsWith('UMLS') ? 'male' : 'female');
            if (dimFilter === 'female' && partSex !== 'female') isPartDimVisible = false;
            if (dimFilter === 'male' && partSex !== 'male') isPartDimVisible = false;

            if (isSideBySide && isPartDimVisible && amount < 0.1) {
              if (partSex === 'female') dx -= 0.22;
              else if (partSex === 'male') dx += 0.22;
            }
          }

          const selected = selection.has(p.id);
          const isPartVisible = (s.isolate ? selected : visible.has(p.system) || selected) && isPartDimVisible;
          data.set([dx, dy, dz, isPartVisible ? 1 : 0], i * 4);
          selectedData[i * 4] = (selected && !s.isolate) ? 255 : 0;
          markerPositions.set(data[i * 4 + 3] > .5 ? [c.x + dx, c.y + dy, c.z + dz] : [10000, 10000, 10000], i * 3);
          const mesh = pickers[i];
          if (mesh) { mesh.position.set(dx, dy, dz); mesh.updateMatrix(); mesh.updateMatrixWorld(true); }
        });
        partTexture.needsUpdate = true;
        selectionTexture.needsUpdate = true;
        markerGeometry.attributes.position.needsUpdate = true;
        lastState = s;
        lastExtent = amount;
        dirty = true;
      }

      if ((s.view !== lastView || s.reset !== lastReset) && !cinematicActive) {
        fit(s.view, amount);
        lastView = s.view;
        lastReset = s.reset;
      }
      if (moving && !s.isolate && !cinematicActive) fit(amount > .5 ? 'front' : s.view, Math.max(0, (amount - .3) / .7));

      const isolateKey = s.isolate && !cinematicActive ? s.selected.join(',') + ':' + s.reset + ':' + s.inspectorOpen + ':' + camera.aspect : '';
      if (isolateKey !== lastIsolate || (s.isolate && moving && !cinematicActive)) {
        if (s.isolate && !cinematicActive) {
          const box = new T.Box3();
          atlas.parts.forEach((p, i) => {
            if (s.selected.includes(p.id)) box.union(bounds[i].clone().translate(new T.Vector3(data[i * 4], data[i * 4 + 1], data[i * 4 + 2])));
          });
          if (!box.isEmpty()) {
            const center = box.getCenter(new T.Vector3()), size = box.getSize(new T.Vector3());
            const w = el.clientWidth, h = el.clientHeight, mobile = w < 768, landscape = w > h && h <= 600;
            let left = 20, right = w - 20, top = mobile ? 175 : 110, bottom = h - 170;
            if (s.inspectorOpen) {
              if (landscape) { right = w - 335; top = 100; bottom = h - 125; }
              else if (mobile) {
                const sheet = document.querySelector('.detail-sheet')?.getBoundingClientRect(), header = document.querySelector('.identity')?.getBoundingClientRect();
                top = (header?.bottom ?? 94) + 16;
                bottom = (sheet?.top ?? h * .58 - 139) - 16;
              } else { right = w - 370; left = w > 1100 ? 285 : 25; }
            }
            const availableWidth = Math.max(150, right - left), availableHeight = Math.max(40, bottom - top);
            camera.setViewOffset(w, h, w / 2 - (left + right) / 2, h / 2 - (top + bottom) / 2, w, h);
            const distance = Math.max(.07, Math.max(size.y * h / availableHeight, size.x * w / availableWidth / camera.aspect, size.z) / (2 * Math.tan(T.MathUtils.degToRad(camera.fov / 2))) * 1.35);
            controls.maxDistance = Math.max(40, distance * 2);
            controls.target.copy(center);
            camera.position.copy(center).add(new T.Vector3(.2, .1, 1).normalize().multiplyScalar(distance));
            controls.update();
            dirty = true;
          }
        } else if (lastIsolate) {
          camera.clearViewOffset();
          fit(s.view, amount);
        }
        lastIsolate = isolateKey;
      }

      if (!cinematicActive) {
        controls.enableRotate = amount < .8;
        controls.mouseButtons.LEFT = amount < .8 ? T.MOUSE.ROTATE : T.MOUSE.PAN;
        controls.touches.ONE = amount < .8 ? T.TOUCH.ROTATE : T.TOUCH.PAN;
        controls.autoRotate = s.rotate && !s.isolate && amount < .4;
        controls.autoRotateSpeed = .65;
        controls.update();
        if (controls.autoRotate) dirty = true;
      }

      const isTrunk = dynamicProps.current.mode === 'female' && dynamicProps.current.femalePath === 'female-trunk-hra';
      const isDimorphic = dynamicProps.current.mode === 'dimorphic' ||
        dynamicProps.current.femalePath === 'female-dimorphic' ||
        (dynamicProps.current.mode === 'male' && dynamicProps.current.malePath === 'male-dimorphic');
      ground.visible = platform.visible = ring.visible = innerRing.visible = !isTrunk && !isDimorphic && amount < .5 && !s.isolate && !cinematicActive;
      markers.visible = amount > .75 && !cinematicActive;

      if (dirty) {
        renderer.render(scene, camera);
        targets = [];
        if (amount > .45) {
          const hasSolid = atlas.parts.some((p, i) => p.system !== 'integumentary' && data[i * 4 + 3] > .5);
          atlas.parts.forEach((p, i) => {
            if (data[i * 4 + 3] < .5 || (hasSolid && p.system === 'integumentary')) return;
            let left = Infinity, right = -Infinity, top = Infinity, bottom = -Infinity;
            for (let corner = 0; corner < 8; corner++) {
              projected.set(p.bounds[(corner & 1) ? 1 : 0][0] + data[i * 4], p.bounds[(corner & 2) ? 1 : 0][1] + data[i * 4 + 1], p.bounds[(corner & 4) ? 1 : 0][2] + data[i * 4 + 2]).project(camera);
              const x = (projected.x + 1) * el.clientWidth / 2, y = (1 - projected.y) * el.clientHeight / 2;
              left = Math.min(left, x); right = Math.max(right, x); top = Math.min(top, y); bottom = Math.max(bottom, y);
            }
            projected.copy(centers[i]).add(new T.Vector3(data[i * 4], data[i * 4 + 1], data[i * 4 + 2])).project(camera);
            if (projected.z < -1 || projected.z > 1) return;
            targets.push({ index: i, x: (projected.x + 1) * el.clientWidth / 2, y: (1 - projected.y) * el.clientHeight / 2, left, right, top, bottom });
          });
        }
        dirty = false;
      }
    };
    animate();

    const contextLost = (e: Event) => {
      e.preventDefault();
      onError('The 3D session was paused by your device. Reload to continue.');
    };
    renderer.domElement.addEventListener('webglcontextlost', contextLost);

    return () => {
      disposed = true;
      abort.abort();
      cancelAnimationFrame(frame);
      observer.disconnect();
      dissector.dispose();
      controls.dispose();
      geometries.forEach(g => g.dispose());
      materials.forEach(m => m.dispose());
      scene.traverse(o => {
        if (o instanceof T.Mesh && !geometries.includes(o.geometry)) {
          o.geometry.dispose();
          const ms = Array.isArray(o.material) ? o.material : [o.material];
          ms.forEach(m => m.dispose());
        }
      });
      env.dispose();
      partTexture.dispose();
      selectionTexture.dispose();
      alphaTexture.dispose();
      colorTexture.dispose();
      markerGeometry.dispose();
      markerMaterial.dispose();
      hover.remove();
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, [atlas]);

  return <div className="scene" ref={host} />;
}
