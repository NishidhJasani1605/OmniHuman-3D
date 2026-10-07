import {flushSync} from 'react-dom';
import {registerAtlasTools} from './agent-tools';
import {useEffect,useMemo,useRef,useState,useCallback} from 'react';
import {Activity,ArrowUpRight,ChevronRight,Eye,Focus,Info,Layers3,Pause,RotateCcw,RotateCw,Search,X,Sparkles,Baby,Clock,User} from 'lucide-react';
import {Button} from '@/components/ui/button';
import {Badge} from '@/components/ui/badge';
import {Slider} from '@/components/ui/slider';
import {Switch} from '@/components/ui/switch';
import {Sheet,SheetContent,SheetTitle,SheetDescription} from '@/components/ui/sheet';
import AnatomyScene from './scene';
import {DEFAULT_VISIBLE,getSystems,EXPLANATIONS,explanation,type Atlas,type Concept,type SceneState,type SystemId,type View,type AtlasMode,type FemalePath,type MalePath,type DimorphicArrangement,type DimorphicFilter} from './anatomy';
import {type CinematicDissector,type DissectorState,type HudInfo} from './cinematic-dissector';

export interface SexUniquePart {
 id: string;
 name: string;
 conceptId?: string;
 system: string;
 category: string;
 homologue?: string;
 description?: string;
 vertexCount: number;
 indexCount: number;
 bounds: [[number, number, number], [number, number, number]];
}
export type FemaleUniquePart = SexUniquePart;
export type MaleUniquePart = SexUniquePart;

const CATEGORY_DESCRIPTIONS: Record<string, string> = {
 vulva: 'External female genitalia and erectile structures (clitoris, vestibular bulbs, Bartholin glands, labia).',
 uterus: 'Internal hollow muscular organ, uterine tubes (salpinges), cervix, and fibro-muscular vaginal canal.',
 mammary: 'Specialized subcutaneous glandular and adipose breast tissue, lactiferous ductal system, and Cooper suspensory ligaments.',
 pelvis: 'True gynecoid pelvic girdle (sacrum, coccyx, ilium, ischium, pubis) optimized for human gestation and parturition.',
 ovary: 'Primary female gonads producing oocytes and endocrine steroids (estrogen, progesterone).',
 bladder: 'Female urinary bladder neck, trigone, and detrusor musculature configured with urethral pelvic floor relations.',
 reproductive: 'Ureteral pelvic entry orifices and uterine cornual bilateral junctions.',
 facial: 'Gracile female cranial soft tissue contouring and cephalometric facial aesthetics.'
};

const MALE_CATEGORY_DESCRIPTIONS: Record<string, string> = {
 genitalia: 'External male genitalia and paired erectile columns (corpus cavernosum, corpus spongiosum, glans penis, and dorsal vasculature).',
 internal_reproductive: 'Male gonads (testes), epididymides, muscular deferent ducts (vas deferens), and accessory seminal vesicles.',
 prostate_urinary: 'Fibromuscular glandular prostate, elongated male urethra (~20 cm), and urinary bladder.',
 pelvis: 'Android pelvic girdle (sacrum, bilateral hip bones) characterized by narrow subpubic angle and heart-shaped pelvic inlet.',
 vasculature: 'Testicular gonadal arteries and pampiniform venous plexus descending from the abdominal retroperitoneum.',
 muscular: 'Superficial perineal musculature providing pelvic floor dynamic support.'
};

const SYNONYMS: Record<string, string[]> = {
 labia: ['labium', 'vulva'],
 labium: ['labia', 'vulva'],
 lips: ['lip', 'oris', 'mouth', 'sphincter'],
 lip: ['lips', 'oris', 'mouth', 'sphincter'],
 mouth: ['oris', 'lip', 'lips'],
 face: ['facial', 'orbicularis', 'mentalis', 'nasalis', 'masseter', 'buccinator', 'zygomaticus', 'frontalis', 'levator', 'depressor'],
 facial: ['face', 'orbicularis', 'mentalis', 'nasalis', 'masseter', 'buccinator', 'zygomaticus', 'frontalis', 'levator', 'depressor'],
 cheeks: ['masseter', 'buccinator', 'zygomaticus'],
 chin: ['mentalis'],
 nose: ['nasalis', 'nasal'],
 eyes: ['oculi', 'orbicularis'],
 clitoris: ['clitoral', 'crus', 'glans', 'prepuce'],
 breast: ['mammary', 'nipple', 'areola', 'lactiferous', 'cooper'],
 breasts: ['mammary', 'nipple', 'areola', 'lactiferous', 'cooper'],
 mammary: ['breast', 'breasts', 'nipple', 'areola', 'lactiferous', 'cooper'],
 womb: ['uterus', 'myometrium', 'endometrium', 'cervix', 'fundus'],
 uterus: ['womb', 'metra', 'myometrium', 'endometrium', 'cervix', 'fundus'],
 metra: ['uterus', 'womb', 'myometrium', 'endometrium'],
 baby: ['fetus', 'placenta', 'umbilical', 'amniotic'],
 fetus: ['fetus', 'placenta', 'umbilical', 'amniotic'],
 pregnancy: ['gravid', 'fetus', 'placenta', 'umbilical', 'amniotic'],
 pregnant: ['gravid', 'fetus', 'placenta', 'umbilical', 'amniotic'],
 hip: ['pelvis', 'ilium', 'ischium', 'pubis', 'sacrum'],
 hips: ['pelvis', 'ilium', 'ischium', 'pubis', 'sacrum'],
 pelvis: ['pelvis', 'ilium', 'ischium', 'pubis', 'sacrum'],
 egg: ['ovary', 'oocyte'],
 ovary: ['ovary', 'fallopian'],
 ovaries: ['ovary', 'fallopian'],
 tubes: ['fallopian', 'uterine tube'],
 fallopian: ['fallopian', 'uterine tube', 'ampulla', 'isthmus', 'fimbria', 'infundibulum'],
 spine: ['vertebra', 'sacrum', 'coccyx', 'intervertebral'],
 kidney: ['renal'],
};

export interface DimorphicPart extends SexUniquePart {
 sex: 'female' | 'male';
 landmark: string;
 exactPos: {
  x: string;
  y: string;
  z: string;
  cx: number;
  cy: number;
  cz: number;
 };
}

function getExactPosition(bounds: [[number, number, number], [number, number, number]]) {
 const cx = ((bounds[0][0] + bounds[1][0]) / 2 * 100);
 const cy = ((bounds[0][1] + bounds[1][1]) / 2 * 100);
 const cz = ((bounds[0][2] + bounds[1][2]) / 2 * 100);
 return {
  x: (cx >= 0 ? '+' : '') + cx.toFixed(1),
  y: cy.toFixed(1),
  z: (cz >= 0 ? '+' : '') + cz.toFixed(1),
  cx: (bounds[0][0] + bounds[1][0]) / 2,
  cy: (bounds[0][1] + bounds[1][1]) / 2,
  cz: (bounds[0][2] + bounds[1][2]) / 2,
 };
}

function getLandmark(p: SexUniquePart, sex: 'female' | 'male'): string {
 const cx = (p.bounds[0][0] + p.bounds[1][0]) / 2;
 const n = p.name.toLowerCase();

 if (p.category === 'facial') return 'Craniofacial / Anterior Soft Tissue';
 if (p.category === 'mammary') return (cx < -0.01 ? 'Right' : cx > 0.01 ? 'Left' : 'Bilateral') + ' Anterior Thoracic Wall (Ribs 2–6)';
 if (p.category === 'vulva') return 'Anterior Perineum / Urogenital Triangle';
 if (p.category === 'uterus') return 'True Pelvic Cavity (Between Bladder & Rectum)';
 if (p.category === 'ovary') return (cx < 0 ? 'Right' : 'Left') + ' Ovarian Fossa (Lateral Pelvic Wall)';
 if (p.category === 'pelvis') return sex === 'female' ? 'Gynecoid Pelvic Girdle (Wide Subpubic Arch)' : 'Android Pelvic Girdle (Narrow Subpubic Arch)';
 if (p.category === 'bladder') return 'Lesser Pelvis / Retropubic Space';
 if (p.category === 'genitalia') return 'Perineum / Penile Shaft & Glans';
 if (p.category === 'internal_reproductive') {
  if (n.includes('testis') || n.includes('epididymis')) return 'Scrotal Sac / External Perineum';
  return 'Posterior Bladder Base / Ampullary Vas';
 }
 if (p.category === 'prostate_urinary') return 'Sub-vesical / Proximal Urethral Neck';
 if (p.category === 'vasculature') return 'Retroperitoneum to Inguinal Canal';
 return 'Pelvic Region';
}

const initial:SceneState={explode:0,visible:DEFAULT_VISIBLE,selected:[],isolate:false,view:'three-quarter',rotate:false,reset:0};

export default function Home(){
 const detailTitle=useRef<HTMLHeadingElement>(null);
 const [mode, setMode] = useState<AtlasMode>('female');
 const [femalePath, setFemalePath] = useState<FemalePath>('female-fullbody');
 const [malePath, setMalePath] = useState<MalePath>('male-fullbody');
 const [dimorphicArrangement, setDimorphicArrangement] = useState<DimorphicArrangement>('side-by-side');
 const [dimorphicFilter, setDimorphicFilter] = useState<DimorphicFilter>('all');
 const [pregWeek, setPregWeek] = useState(38);
 const [uterineOpacity, setUterineOpacity] = useState(65);
 const [ageYear, setAgeYear] = useState(25);
 const [dexaEnabled, setDexaEnabled] = useState(false);

 const [femaleCatalogOpen, setFemaleCatalogOpen] = useState(false);
 const [sexCatalogTab, setSexCatalogTab] = useState<'female' | 'male'>('female');
 const [femaleUniqueParts, setFemaleUniqueParts] = useState<FemaleUniquePart[]>([]);
 const [femaleCategoryFilter, setFemaleCategoryFilter] = useState<string>('all');
 const [femaleSearchQuery, setFemaleSearchQuery] = useState<string>('');

 const [maleUniqueParts, setMaleUniqueParts] = useState<MaleUniquePart[]>([]);
 const [maleCategoryFilter, setMaleCategoryFilter] = useState<string>('all');
 const [maleSearchQuery, setMaleSearchQuery] = useState<string>('');
 const [pendingPart, setPendingPart] = useState<{ id: string; shouldIsolate: boolean } | null>(null);

 const [leftPanelTab, setLeftPanelTab] = useState<'systems' | 'dimorphic'>('systems');
 const [dimorphicSearch, setDimorphicSearch] = useState<string>('');
 const [spatialTarget, setSpatialTarget] = useState<{
  name: string;
  sex: 'female' | 'male';
  x: string;
  y: string;
  z: string;
  landmark: string;
  homologue?: string;
 } | null>(null);

 const [atlas,setAtlas]=useState<Atlas|null>(null);
 const [state,setState]=useState(initial);
 const [progress,setProgress]=useState(0);
 const [error,setError]=useState('');
 const [panel,setPanel]=useState<'layers'|'search'|null>(null);
 const [details,setDetails]=useState(false);
 const [about,setAbout]=useState(false);
 const [query,setQuery]=useState('');
 const [chosen,setChosen]=useState<Concept|null>(null);
 const [hudData,setHudData]=useState<HudInfo|null>(null);
 const [cinematicState,setCinematicState]=useState<DissectorState>('IDLE');
 const [searchSys,setSearchSys]=useState<string>('all');
 const [searchLimit,setSearchLimit]=useState(80);
 const dissectorRef=useRef<CinematicDissector|null>(null);

 const activeManifest = useMemo(() => {
  if (mode === 'dimorphic') return '/models/combined-dimorphic/atlas.json';
  if (mode === 'male') {
   if (malePath === 'male-dimorphic') return '/models/male-dimorphic/atlas.json';
   return '/models/male/atlas.json';
  }
  if (mode === 'female') return `/models/${femalePath}/atlas.json`;
  if (mode === 'pregnancy') return '/models/pregnancy/atlas.json';
  return '/models/lifespan-aging/atlas.json';
 }, [mode, femalePath, malePath]);

 useEffect(() => {
  const abort = new AbortController();
  setProgress(0);
  setError('');
  setAtlas(null);
  setChosen(null);
  setDetails(false);
  setState({ ...initial, visible: DEFAULT_VISIBLE });

  fetch(activeManifest, { signal: abort.signal })
   .then(r => {
    if (!r.ok) throw new Error(`Could not load ${activeManifest}`);
    return r.json();
   })
   .then(data => setAtlas(data as Atlas))
   .catch(e => {
    if (e.name !== 'AbortError') setError(e.message);
   });

  return () => abort.abort();
 }, [activeManifest]);

 useEffect(() => {
  const key = (e: KeyboardEvent) => {
   if (e.key === '/' && !(e.target instanceof HTMLInputElement) && !(e.target instanceof HTMLTextAreaElement)) {
    e.preventDefault();
    setPanel('search');
    setDetails(false);
   } else if (e.key === 'Escape') {
    setPanel(null);
    setFemaleCatalogOpen(false);
   }
  };
  window.addEventListener('keydown', key);
  return () => window.removeEventListener('keydown', key);
 }, []);

 useEffect(() => {
  fetch('/models/female-unique-parts.json')
   .then(r => r.json())
   .then((data: unknown) => setFemaleUniqueParts(data as FemaleUniquePart[]))
   .catch(err => console.error('Could not load female unique parts:', err));

  fetch('/models/male-unique-parts.json')
   .then(r => r.json())
   .then((data: unknown) => setMaleUniqueParts(data as MaleUniquePart[]))
   .catch(err => console.error('Could not load male unique parts:', err));
 }, []);

 const femaleCategoryTabs = useMemo(() => {
  const cCounts: Record<string, number> = {};
  femaleUniqueParts.forEach(p => { cCounts[p.category] = (cCounts[p.category] || 0) + 1; });
  return [
   { id: 'all', label: `🌸 All Parts (${femaleUniqueParts.length || 77})` },
   { id: 'vulva', label: `🌺 Vulva & Clitoris (${cCounts['vulva'] || 16})` },
   { id: 'uterus', label: `🧬 Uterus & Salpinges (${cCounts['uterus'] || 17})` },
   { id: 'mammary', label: `🍈 Mammary Glands (${cCounts['mammary'] || 16})` },
   { id: 'facial', label: `✨ Facial Aesthetics (${cCounts['facial'] || 2})` },
   { id: 'pelvis', label: `🦴 Gynecoid Pelvis (${cCounts['pelvis'] || 14})` },
   { id: 'ovary', label: `🪺 Ovaries (${cCounts['ovary'] || 4})` },
   { id: 'bladder', label: `💧 Bladder & Urethra (${cCounts['bladder'] || 5})` },
   { id: 'reproductive', label: `🫀 Cornua/Ureteral (${cCounts['reproductive'] || 3})` },
  ];
 }, [femaleUniqueParts]);

 const filteredFemaleParts = useMemo(() => {
  const q = femaleSearchQuery.toLowerCase().trim();
  const syns = SYNONYMS[q] || [];
  return femaleUniqueParts.filter(p => {
   if (femaleCategoryFilter !== 'all' && p.category !== femaleCategoryFilter) return false;
   if (!q) return true;
   const name = p.name.toLowerCase();
   const cid = (p.conceptId || '').toLowerCase();
   const sys = p.system.toLowerCase();
   if (name.includes(q) || cid.includes(q) || sys.includes(q)) return true;
   return syns.some(s => name.includes(s) || cid.includes(s));
  });
 }, [femaleUniqueParts, femaleCategoryFilter, femaleSearchQuery]);

 const maleCategoryTabs = useMemo(() => {
  const cCounts: Record<string, number> = {};
  maleUniqueParts.forEach(p => { cCounts[p.category] = (cCounts[p.category] || 0) + 1; });
  return [
   { id: 'all', label: `⚡ All Parts (${maleUniqueParts.length || 30})` },
   { id: 'genitalia', label: `🍆 External Genitalia (${cCounts['genitalia'] || 11})` },
   { id: 'internal_reproductive', label: `🧬 Testes & Tract (${cCounts['internal_reproductive'] || 8})` },
   { id: 'prostate_urinary', label: `💧 Prostate & Urethra (${cCounts['prostate_urinary'] || 3})` },
   { id: 'pelvis', label: `🦴 Android Pelvis (${cCounts['pelvis'] || 3})` },
   { id: 'vasculature', label: `🩸 Gonadal Vessels (${cCounts['vasculature'] || 4})` },
   { id: 'muscular', label: `💪 Muscular (${cCounts['muscular'] || 1})` },
  ];
 }, [maleUniqueParts]);

 const filteredMaleParts = useMemo(() => {
  const q = maleSearchQuery.toLowerCase().trim();
  const syns = SYNONYMS[q] || [];
  return maleUniqueParts.filter(p => {
   if (maleCategoryFilter !== 'all' && p.category !== maleCategoryFilter) return false;
   if (!q) return true;
   const name = p.name.toLowerCase();
   const cid = (p.conceptId || '').toLowerCase();
   const sys = p.system.toLowerCase();
   const hom = (p.homologue || '').toLowerCase();
   if (name.includes(q) || cid.includes(q) || sys.includes(q) || hom.includes(q)) return true;
   return syns.some(s => name.includes(s) || cid.includes(s) || hom.includes(s));
  });
 }, [maleUniqueParts, maleCategoryFilter, maleSearchQuery]);

 const allDimorphicParts: DimorphicPart[] = useMemo(() => {
  const f: DimorphicPart[] = femaleUniqueParts.map(p => ({
   ...p,
   sex: 'female',
   landmark: getLandmark(p, 'female'),
   exactPos: getExactPosition(p.bounds)
  }));
  const m: DimorphicPart[] = maleUniqueParts.map(p => ({
   ...p,
   sex: 'male',
   landmark: getLandmark(p, 'male'),
   exactPos: getExactPosition(p.bounds)
  }));
  return [...f, ...m];
 }, [femaleUniqueParts, maleUniqueParts]);

 const filteredDimorphicParts = useMemo(() => {
  const q = dimorphicSearch.toLowerCase().trim();
  const syns = SYNONYMS[q] || [];
  return allDimorphicParts.filter(p => {
   if (mode === 'female' && p.sex !== 'female') return false;
   if (mode === 'male' && p.sex !== 'male') return false;
   if (!q) return true;
   const name = p.name.toLowerCase();
   const cid = (p.conceptId || '').toLowerCase();
   const sys = p.system.toLowerCase();
   const hom = (p.homologue || '').toLowerCase();
   const lmk = p.landmark.toLowerCase();
   if (name.includes(q) || cid.includes(q) || sys.includes(q) || hom.includes(q) || lmk.includes(q)) return true;
   return syns.some(s => name.includes(s) || cid.includes(s) || hom.includes(s));
  });
 }, [allDimorphicParts, mode, dimorphicSearch]);

 const systems = useMemo(() => getSystems(atlas?.sex), [atlas?.sex]);
 const parts = useMemo(() => new Map(atlas?.parts.map(p => [p.id, p])), [atlas]);
 const counts = useMemo(() => Object.fromEntries(systems.map(s => [s.id, atlas?.parts.filter(p => p.system === s.id).length ?? 0])), [atlas, systems]);
 const activeSystems = useMemo(() => systems.filter(s => (counts[s.id] || 0) > 0), [systems, counts]);
 const selectedParts = state.selected.map(id => parts.get(id)).filter(p => !!p);
 const selected = selectedParts[0];
 const system = systems.find(s => s.id === selected?.system);
 const visibleCount = atlas?.parts.filter(p => state.isolate ? state.selected.includes(p.id) : state.visible.includes(p.system) || state.selected.includes(p.id)).length ?? 0;

 const sysTabs = useMemo(() => [
  { id: 'all', label: `All (${atlas ? atlas.parts.length.toLocaleString() : '2,234'})` },
  { id: 'skeletal', label: `🦴 Skeleton (${counts['skeletal'] || 0})` },
  { id: 'muscular', label: `💪 Muscles (${counts['muscular'] || 0})` },
  { id: 'reproductive', label: `🧬 Reproductive (${counts['reproductive'] || 0})` },
  { id: 'arterial', label: `❤️ Arteries (${counts['arterial'] || 0})` },
  { id: 'venous', label: `🩸 Veins (${counts['venous'] || 0})` },
  { id: 'nervous', label: `🧠 Nerves (${counts['nervous'] || 0})` },
  { id: 'respiratory', label: `🫁 Respiratory (${counts['respiratory'] || 0})` },
  { id: 'digestive', label: `🥣 Digestive (${counts['digestive'] || 0})` },
  { id: 'cardiac', label: `💓 Heart (${counts['cardiac'] || 0})` },
  { id: 'other', label: `🟡 Other (${(counts['sensory'] || 0) + (counts['urinary'] || 0) + (counts['lymphatic'] || 0) + (counts['endocrine'] || 0) + (counts['integumentary'] || 0) + (counts['connective'] || 0)})` },
 ], [atlas, counts]);


 const filteredParts = useMemo(() => {
  if (!atlas) return [];
  const q = query.toLowerCase().trim();
  const syns = SYNONYMS[q] || [];
  return atlas.parts.filter(p => {
   if (searchSys !== 'all') {
    if (searchSys === 'other') {
     const main = ['skeletal', 'muscular', 'reproductive', 'arterial', 'venous', 'nervous', 'respiratory', 'digestive', 'cardiac'];
     if (main.includes(p.system)) return false;
    } else if (p.system !== searchSys) {
     return false;
    }
   }
   if (!q) return true;
   const name = p.name.toLowerCase();
   const cid = (p.conceptId || '').toLowerCase();
   const pid = (p.id || '').toLowerCase();
   const psys = (p.system || '').toLowerCase();
   if (name.includes(q) || cid.includes(q) || pid.includes(q) || psys.includes(q)) return true;
   return syns.some(s => name.includes(s) || cid.includes(s));
  });
 }, [atlas, query, searchSys, SYNONYMS]);

 const displayedParts = useMemo(() => filteredParts.slice(0, searchLimit), [filteredParts, searchLimit]);

 const choose = (c: Concept) => {
  setChosen(c);
  setState(s => ({ ...s, selected: c.elements, isolate: false, rotate: false, explode: 0 }));
  setDetails(true);
  setPanel(null);
  if (dissectorRef.current && atlas) {
   const indices = c.elements.map(id => atlas.parts.findIndex(p => p.id === id)).filter(i => i >= 0);
   if (indices.length > 0) dissectorRef.current.start(indices, c.name);
  }
 };

 useEffect(() => {
  if (!atlas) return;
  return registerAtlasTools(atlas, c => flushSync(() => choose(c)));
 }, [atlas]);

 const choosePart = (id: string) => {
  const p = parts.get(id);
  if (!p) return;
  setChosen({ id: p.conceptId, name: p.name, elements: [id] });
  setState(s => ({ ...s, selected: [id], isolate: true, rotate: false, explode: 0 }));
  setDetails(true);
  setPanel(null);
  if (dissectorRef.current && atlas) {
   const idx = atlas.parts.findIndex(pp => pp.id === id);
   if (idx >= 0) dissectorRef.current.start([idx], p.name);
  }
 };

 const isolatePart = (id: string) => {
  choosePart(id);
 };

 const handleSelectFemalePart = (p: FemaleUniquePart, shouldIsolate = true) => {
  const pos = getExactPosition(p.bounds);
  setSpatialTarget({
   name: p.name,
   sex: 'female',
   x: pos.x,
   y: pos.y,
   z: pos.z,
   landmark: getLandmark(p, 'female'),
   homologue: p.homologue
  });
  if (mode !== 'female') {
   setMode('female');
   setPendingPart({ id: p.id, shouldIsolate });
  } else {
   const found = atlas?.parts.find(pt => pt.id === p.id || pt.name.toLowerCase() === p.name.toLowerCase());
   if (found) {
    if (shouldIsolate) isolatePart(found.id);
    else choosePart(found.id);
   } else {
    if (femalePath !== 'female-fullbody') setFemalePath('female-fullbody');
    setPendingPart({ id: p.id, shouldIsolate });
   }
  }
  setFemaleCatalogOpen(false);
 };

 const handleSelectMalePart = (p: MaleUniquePart, shouldIsolate = true) => {
  const pos = getExactPosition(p.bounds);
  setSpatialTarget({
   name: p.name,
   sex: 'male',
   x: pos.x,
   y: pos.y,
   z: pos.z,
   landmark: getLandmark(p, 'male'),
   homologue: p.homologue
  });
  if (mode !== 'male') {
   setMode('male');
   setPendingPart({ id: p.id, shouldIsolate });
  } else {
   const found = atlas?.parts.find(pt => pt.id === p.id || pt.name.toLowerCase() === p.name.toLowerCase());
   if (found) {
    if (shouldIsolate) isolatePart(found.id);
    else choosePart(found.id);
   } else {
    setPendingPart({ id: p.id, shouldIsolate });
   }
  }
  setFemaleCatalogOpen(false);
 };

 const handleSelectDimorphicPart = (p: DimorphicPart, shouldIsolate = true) => {
  setSpatialTarget({
   name: p.name,
   sex: p.sex,
   x: p.exactPos.x,
   y: p.exactPos.y,
   z: p.exactPos.z,
   landmark: p.landmark,
   homologue: p.homologue
  });
  if (p.sex === 'female') {
   handleSelectFemalePart(p, shouldIsolate);
  } else {
   handleSelectMalePart(p, shouldIsolate);
  }
 };

 useEffect(() => {
  if (pendingPart && atlas) {
   const found = atlas.parts.find(pt => pt.id === pendingPart.id || pt.name.toLowerCase() === pendingPart.id.toLowerCase());
   if (found) {
    if (pendingPart.shouldIsolate) {
     isolatePart(found.id);
    } else {
     choosePart(found.id);
    }
    setPendingPart(null);
   }
  }
 }, [atlas, pendingPart]);

 useEffect(() => {
  if (typeof window !== 'undefined') {
   (window as unknown as Record<string, unknown>).__ATLAS_APP__ = {
    setExplode: (v: number) => setState(s => ({ ...s, explode: v, rotate: false })),
    getState: () => state,
    setMode: (m: AtlasMode) => setMode(m),
    setFemalePath: (p: FemalePath) => setFemalePath(p),
    setMalePath: (p: MalePath) => setMalePath(p),
    setAgeYear: (y: number) => setAgeYear(y),
    setDexaEnabled: (d: boolean) => setDexaEnabled(d),
    setPregWeek: (w: number) => setPregWeek(w),
    setUterineOpacity: (o: number) => setUterineOpacity(o),
    setIsolate: (iso: boolean) => setState(s => ({ ...s, isolate: iso })),
    setVisible: (vis: SystemId[]) => setState(s => ({ ...s, visible: vis })),
    openFemaleCatalog: () => { setSexCatalogTab('female'); setFemaleCatalogOpen(true); setPanel(null); },
    openMaleCatalog: () => { setSexCatalogTab('male'); setFemaleCatalogOpen(true); setPanel(null); },
    openCombinedCatalog: () => { setSexCatalogTab(mode === 'male' ? 'male' : 'female'); setFemaleCatalogOpen(true); setPanel(null); },
    closeFemaleCatalog: () => setFemaleCatalogOpen(false),
    getFemaleUniqueParts: () => femaleUniqueParts,
    getMaleUniqueParts: () => maleUniqueParts,
    getAllDimorphicParts: () => allDimorphicParts,
    isolateFemalePart: (idOrName: string) => {
     const p = femaleUniqueParts.find(x => x.id === idOrName || x.name.toLowerCase() === idOrName.toLowerCase());
     if (p) handleSelectFemalePart(p, true);
    },
    isolateMalePart: (idOrName: string) => {
     const p = maleUniqueParts.find(x => x.id === idOrName || x.name.toLowerCase() === idOrName.toLowerCase());
     if (p) handleSelectMalePart(p, true);
    },
    isolateDimorphicPart: (idOrName: string) => {
     const p = allDimorphicParts.find(x => x.id === idOrName || x.name.toLowerCase() === idOrName.toLowerCase());
     if (p) handleSelectDimorphicPart(p, true);
    },
   };
  }
 }, [state, femaleUniqueParts, maleUniqueParts, atlas, mode, femalePath, malePath, dimorphicArrangement, dimorphicFilter]);

 const toggle = (id: SystemId) => {
  setDetails(false);
  if (dissectorRef.current) dissectorRef.current.interrupt();
  setState(s => ({ ...s, selected: [], isolate: false, visible: s.visible.includes(id) ? s.visible.filter(x => x !== id) : [...s.visible, id] }));
 };

 const reset = () => {
  if (dissectorRef.current) dissectorRef.current.reconstitute();
  setState(s => ({ ...initial, visible: DEFAULT_VISIBLE, reset: s.reset + 1 }));
  setChosen(null);
  setDetails(false);
  setPanel(null);
  setHudData(null);
 };

 const openPanel = (next: 'layers' | 'search') => {
  setDetails(false);
  setPanel(p => p === next ? null : next);
 };

 const meshMetrics = useMemo(() => {
  const verts = selectedParts.reduce((n, p) => n + p.vertexCount, 0);
  const faces = selectedParts.reduce((n, p) => n + Math.floor(p.indexCount / 3), 0);
  return { vertices: verts, faces };
 }, [selectedParts]);

 const handleRestoreWholeBody = useCallback(() => {
  if (dissectorRef.current) {
   dissectorRef.current.restore();
  }
  setState(s => ({ ...s, selected: [], isolate: false }));
  setDetails(false);
 }, []);

 const handleIsolateToggle = useCallback(() => {
  if (state.isolate || (dissectorRef.current && dissectorRef.current.isFocused())) {
   handleRestoreWholeBody();
  } else if (selected && atlas) {
   choosePart(selected.id);
  }
 }, [state.isolate, selected, atlas, handleRestoreWholeBody]);

 return (
  <main className="studio">
   {/* Top Navigation Tab Bar */}
   <nav className="top-nav-bar" style={{
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: '46px',
    background: 'rgba(15, 23, 42, 0.78)',
    backdropFilter: 'blur(16px)',
    borderBottom: '1px solid rgba(255, 255, 255, 0.12)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '12px',
    zIndex: 100,
    padding: '0 16px'
   }}>
    <button
     type="button"
     id="btn-nav-male"
     onClick={() => setMode('male')}
     style={{
      background: mode === 'male' ? 'rgba(56, 189, 248, 0.16)' : 'transparent',
      color: mode === 'male' ? '#38bdf8' : '#94a3b8',
      border: mode === 'male' ? '1px solid rgba(56, 189, 248, 0.4)' : '1px solid transparent',
      borderRadius: '6px',
      padding: '6px 16px',
      fontSize: '13px',
      fontWeight: mode === 'male' ? 600 : 500,
      cursor: 'pointer',
      transition: 'all 0.15s ease'
     }}
    >
     👨 Male Atlas
    </button>

    <button
     type="button"
     id="btn-nav-female"
     onClick={() => setMode('female')}
     style={{
      background: mode === 'female' ? 'rgba(244, 114, 182, 0.16)' : 'transparent',
      color: mode === 'female' ? '#f472b6' : '#94a3b8',
      border: mode === 'female' ? '1px solid rgba(244, 114, 182, 0.4)' : '1px solid transparent',
      borderRadius: '6px',
      padding: '6px 16px',
      fontSize: '13px',
      fontWeight: mode === 'female' ? 600 : 500,
      cursor: 'pointer',
      transition: 'all 0.15s ease'
     }}
    >
     👩 Female Atlas
    </button>

    <div style={{ width: '1px', height: '24px', background: 'rgba(255,255,255,0.15)', margin: '0 4px' }} />

    <button
     type="button"
     id="btn-nav-side-by-side"
     onClick={() => {
      setMode('dimorphic');
      setDimorphicArrangement('side-by-side');
     }}
     style={{
      background: mode === 'dimorphic'
       ? 'linear-gradient(135deg, rgba(236, 72, 153, 0.4), rgba(56, 189, 248, 0.4))'
       : 'linear-gradient(135deg, rgba(236, 72, 153, 0.18), rgba(56, 189, 248, 0.18))',
      color: mode === 'dimorphic' ? '#ffffff' : '#f1f5f9',
      border: mode === 'dimorphic' ? '1px solid rgba(255, 255, 255, 0.65)' : '1px solid rgba(255, 255, 255, 0.22)',
      borderRadius: '6px',
      padding: '6px 16px',
      fontSize: '13px',
      fontWeight: mode === 'dimorphic' ? 700 : 600,
      cursor: 'pointer',
      display: 'flex',
      alignItems: 'center',
      gap: '8px',
      boxShadow: mode === 'dimorphic' ? '0 0 16px rgba(236, 72, 153, 0.4), 0 0 16px rgba(56, 189, 248, 0.4)' : 'none',
      transition: 'all 0.15s ease'
     }}
     title="Display both Female (Left) and Male (Right) separate sex-unique parts side-by-side in the same frame"
    >
     <span>↔️</span>
     <span>Side-by-Side (Female &amp; Male)</span>
     <span style={{ fontSize: '10px', background: 'rgba(255,255,255,0.2)', padding: '1px 6px', borderRadius: '10px' }}>
      77 🌸 + 30 ⚡
     </span>
    </button>
   </nav>

   {/* Contextual Sub-Toolbar */}
   {mode === 'male' && (
    <div style={{
     position: 'absolute',
     top: '47px',
     left: 0,
     right: 0,
     height: '36px',
     background: 'rgba(15, 23, 42, 0.72)',
     backdropFilter: 'blur(10px)',
     borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
     display: 'flex',
     alignItems: 'center',
     justifyContent: 'center',
     gap: '8px',
     zIndex: 99
    }}>
     <span style={{ fontSize: '11px', color: '#94a3b8', marginRight: '6px' }}>Male Models:</span>
     <button
      type="button"
      id="btn-model-male-fullbody"
      onClick={() => setMalePath('male-fullbody')}
      style={{
       background: malePath === 'male-fullbody' ? 'rgba(56, 189, 248, 0.25)' : 'rgba(255,255,255,0.04)',
       color: malePath === 'male-fullbody' ? '#fff' : '#cbd5e1',
       border: malePath === 'male-fullbody' ? '1px solid #38bdf8' : '1px solid rgba(255,255,255,0.06)',
       borderRadius: '4px',
       padding: '2px 8px',
       fontSize: '11px',
       fontWeight: malePath === 'male-fullbody' ? 600 : 400,
       cursor: 'pointer'
      }}
     >
      ⚡ Full-Body Reference (2,234)
     </button>
     <button
      type="button"
      id="btn-model-male-dimorphic"
      onClick={() => setMalePath('male-dimorphic')}
      style={{
       background: malePath === 'male-dimorphic' ? 'rgba(6, 182, 212, 0.35)' : 'rgba(255,255,255,0.04)',
       color: malePath === 'male-dimorphic' ? '#38bdf8' : '#cbd5e1',
       border: malePath === 'male-dimorphic' ? '1px solid #38bdf8' : '1px solid rgba(255,255,255,0.06)',
       borderRadius: '4px',
       padding: '2px 8px',
       fontSize: '11px',
       fontWeight: 700,
       cursor: 'pointer',
       boxShadow: malePath === 'male-dimorphic' ? '0 0 10px rgba(56, 189, 248, 0.35)' : 'none'
      }}
      title="Display ONLY the 30 Male-Unique anatomical structures isolated in 3D WebGL (like NIH HRA Trunk)"
     >
      ⚡ Male-Only Unique (30)
     </button>

     <button
      type="button"
      id="btn-sub-male-catalog"
      onClick={() => { setSexCatalogTab('male'); setFemaleCatalogOpen(true); setPanel(null); }}
      style={{
       background: 'rgba(14, 165, 233, 0.28)',
       color: '#bae6fd',
       border: '1px solid #38bdf8',
       borderRadius: '4px',
       padding: '2px 10px',
       fontSize: '11px',
       fontWeight: 700,
       cursor: 'pointer',
       display: 'flex',
       alignItems: 'center',
       gap: '4px',
       marginLeft: '4px'
      }}
     >
      ⚡ Men&apos;s Catalog (30)
     </button>
    </div>
   )}

   {mode === 'female' && (
    <div style={{
     position: 'absolute',
     top: '47px',
     left: 0,
     right: 0,
     height: '36px',
     background: 'rgba(15, 23, 42, 0.72)',
     backdropFilter: 'blur(10px)',
     borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
     display: 'flex',
     alignItems: 'center',
     justifyContent: 'center',
     gap: '8px',
     zIndex: 99
    }}>
     <span style={{ fontSize: '11px', color: '#94a3b8', marginRight: '6px' }}>Female Models:</span>
     {(['female-fullbody', 'female-dimorphic'] as FemalePath[]).map(p => (
      <button
       key={p}
       type="button"
       id={p === 'female-dimorphic' ? 'btn-model-female-dimorphic' : undefined}
       onClick={() => setFemalePath(p)}
       style={{
        background: femalePath === p ? 'rgba(244, 114, 182, 0.28)' : 'rgba(255,255,255,0.04)',
        color: femalePath === p ? '#fff' : '#cbd5e1',
        border: femalePath === p ? '1px solid #f472b6' : '1px solid rgba(255,255,255,0.06)',
        borderRadius: '4px',
        padding: '2px 8px',
        fontSize: '11px',
        fontWeight: femalePath === p ? 700 : 400,
        cursor: 'pointer',
        boxShadow: femalePath === p && p === 'female-dimorphic' ? '0 0 10px rgba(244, 114, 182, 0.4)' : 'none'
       }}
       title={p === 'female-dimorphic' ? 'Display ONLY the 77 Female-Unique anatomical structures isolated in 3D WebGL' : undefined}
      >
        {p === 'female-fullbody' ? '✨ Full-Body Parity (2,279)' : '🌸 Female-Only Unique (77)'}
      </button>
     ))}

     <button
      type="button"
      id="btn-sub-female-catalog"
      onClick={() => { setSexCatalogTab('female'); setFemaleCatalogOpen(true); setPanel(null); }}
      style={{
       background: 'rgba(236, 72, 153, 0.28)',
       color: '#fbcfe8',
       border: '1px solid #f472b6',
       borderRadius: '4px',
       padding: '2px 10px',
       fontSize: '11px',
       fontWeight: 700,
       cursor: 'pointer',
       display: 'flex',
       alignItems: 'center',
       gap: '4px',
       marginLeft: '4px'
      }}
     >
      🌸 Women&apos;s Catalog (77)
     </button>
    </div>
   )}

   {mode === 'dimorphic' && (
    <div style={{
     position: 'absolute',
     top: '47px',
     left: 0,
     right: 0,
     height: '36px',
     background: 'rgba(15, 23, 42, 0.85)',
     backdropFilter: 'blur(12px)',
     borderBottom: '1px solid rgba(255, 255, 255, 0.12)',
     display: 'flex',
     alignItems: 'center',
     justifyContent: 'center',
     gap: '12px',
     zIndex: 99
    }}>
     <span style={{ fontSize: '12px', color: '#f8fafc', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px' }}>
      <span>↔️</span>
      <span>Side-by-Side Comparative Frame:</span>
     </span>
     <span style={{ fontSize: '11px', color: '#f472b6', fontWeight: 600, background: 'rgba(236, 72, 153, 0.15)', padding: '2px 8px', borderRadius: '4px', border: '1px solid rgba(244, 114, 182, 0.3)' }}>
      🌸 77 Female Organs (Left)
     </span>
     <span style={{ color: '#64748b', fontSize: '12px' }}>vs</span>
     <span style={{ fontSize: '11px', color: '#38bdf8', fontWeight: 600, background: 'rgba(56, 189, 248, 0.15)', padding: '2px 8px', borderRadius: '4px', border: '1px solid rgba(56, 189, 248, 0.3)' }}>
      ⚡ 30 Male Organs (Right)
     </span>

     <div style={{ width: '1px', height: '18px', background: 'rgba(255,255,255,0.18)', margin: '0 6px' }} />

     <button
      type="button"
      id="btn-sub-dimorphic-catalog"
      onClick={() => { setSexCatalogTab('female'); setFemaleCatalogOpen(true); setPanel(null); }}
      style={{
       background: 'rgba(255,255,255,0.1)',
       color: '#ffffff',
       border: '1px solid rgba(255,255,255,0.25)',
       borderRadius: '4px',
       padding: '2px 10px',
       fontSize: '11px',
       fontWeight: 600,
       cursor: 'pointer'
      }}
     >
      📋 Browse Parts Catalog
     </button>
    </div>
   )}

   {atlas && (
    <AnatomyScene
     atlas={atlas}
     state={{ ...state, inspectorOpen: details && selectedParts.length > 0 }}
     mode={mode}
     femalePath={femalePath}
     malePath={malePath}
     dimorphicArrangement={dimorphicArrangement}
     dimorphicFilter={dimorphicFilter}
     pregWeek={pregWeek}
     uterineOpacity={uterineOpacity}
     ageYear={ageYear}
     dexaEnabled={dexaEnabled}
     onSelect={choosePart}
     onProgress={n => { setProgress(n); if (n === 100) setError(''); }}
     onError={setError}
     onCinematicState={s => {
      setCinematicState(s);
      if (s === 'FOCUSED' || s === 'ACT_4_SOLO_LOCK') {
       setState(st => ({ ...st, isolate: true, explode: 0 }));
       setDetails(true);
      } else if (s === 'IDLE') {
       setState(st => ({ ...st, isolate: false }));
      }
     }}
     onHudUpdate={setHudData}
     onCinematicReady={d => { dissectorRef.current = d; }}
     onRequestRestore={() => { setState(s => ({ ...s, isolate: false, selected: [] })); setDetails(false); }}
    />
   )}

   {/* Floating "↺ Back to whole body" Button */}
   {Boolean(state.selected.length > 0 || cinematicState === 'FOCUSED' || cinematicState === 'FLIGHT_TRANSITION' || (dissectorRef.current?.isFocused())) && (
    <button
     type="button"
     id="btn-back-whole-body"
     className="floating-back-button"
     onClick={handleRestoreWholeBody}
     title="Restore all parts to 100% solid opacity and return to whole body overview (or click empty background)"
    >
     <RotateCcw size={15} />
     <span>↺ Back to whole body</span>
    </button>
   )}

   <div className="vignette" />

   {hudData && (
    <div id="omni-cinematic-hud" className="hud-banner visible" role="status" aria-live="polite">
     <div className="omni-hud-pulse" />
     <div className="omni-hud-content">
      <span className="omni-hud-stage" id="omni-hud-stage">{hudData.stage}</span>
      <span className="omni-hud-title" id="omni-hud-title" dangerouslySetInnerHTML={{ __html: hudData.title }} />
     </div>
     {cinematicState !== 'IDLE' && cinematicState !== 'ACT_4_SOLO_LOCK' && (
      <button type="button" className="omni-hud-skip" id="btn-skip-dissection" onClick={() => dissectorRef.current?.instantFinish()} title="Skip animation">Skip ⏩</button>
     )}
    </div>
    )}

   {spatialTarget && (
    <div
     id="spatial-telemetry-hud"
     className={`glass ${spatialTarget.sex === 'female' ? 'female-theme' : ''}`}
     role="region"
     aria-label="Exact Anatomical Position Telemetry"
    >
     <div className="spatial-hud-header">
      <div className="flex items-center gap-2">
       <span className={`dimorphic-sex-badge ${spatialTarget.sex}`}>
        {spatialTarget.sex === 'female' ? '🌸 Female Only' : '⚡ Male Only'}
       </span>
       <span className="text-[10px] text-slate-400 font-mono">EXACT 3D POSITION</span>
      </div>
      <button
       type="button"
       className="text-slate-400 hover:text-white text-xs px-1 cursor-pointer"
       onClick={() => setSpatialTarget(null)}
       title="Dismiss telemetry"
      >
       ✕
      </button>
     </div>
     <div className="spatial-hud-title">{spatialTarget.name}</div>
     <div className="spatial-hud-coords-row">
      <div className="spatial-hud-coord-pill">
       <span className="spatial-hud-coord-label">X (Lateral)</span>
       <span className={`spatial-hud-coord-val ${spatialTarget.sex}`}>{spatialTarget.x} cm</span>
      </div>
      <div className="spatial-hud-coord-pill">
       <span className="spatial-hud-coord-label">Y (Elevation)</span>
       <span className={`spatial-hud-coord-val ${spatialTarget.sex}`}>{spatialTarget.y} cm</span>
      </div>
      <div className="spatial-hud-coord-pill">
       <span className="spatial-hud-coord-label">Z (A-P)</span>
       <span className={`spatial-hud-coord-val ${spatialTarget.sex}`}>{spatialTarget.z} cm</span>
      </div>
     </div>
     <div className="spatial-hud-landmark">
      <strong>Landmark:</strong> {spatialTarget.landmark}
     </div>
     {spatialTarget.homologue && (
      <div className="homologue-pill mt-1">
       🧬 Homologue: {spatialTarget.homologue}
      </div>
     )}
    </div>
   )}

   <header className="identity" style={{ top: '94px' }}>
    <div className="eyebrow">
     <span className="status-dot" style={mode === 'dimorphic' ? { background: '#ec4899', boxShadow: '0 0 8px #ec4899' } : undefined} />{' '}
     {mode === 'dimorphic' ? 'SIDE-BY-SIDE DIMORPHIC COMPARISON (107 STRUCTURES)' :
      mode === 'female' ? (femalePath === 'female-dimorphic' ? 'FEMALE-ONLY UNIQUE ANATOMY (77)' : 'FEMALE 3D ATLAS') :
      mode === 'male' ? (malePath === 'male-dimorphic' ? 'MALE-ONLY UNIQUE ANATOMY (30)' : 'MALE 3D ATLAS') :
      mode === 'pregnancy' ? 'GESTATIONAL DYNAMICS' :
      'LIFESPAN ONTOGENY'}
    </div>
    <h1>
     {mode === 'dimorphic' ? 'Side-by-Side Frame' :
      mode === 'female' ? 'OmniWoman' :
      mode === 'male' ? 'OmniMan' :
      'Human Atlas'}
     <Badge variant="outline" className="edition" style={mode === 'dimorphic' ? { borderColor: '#ec4899', color: '#f472b6' } : undefined}>
      {mode === 'dimorphic' ? '107' : '3D'}
     </Badge>
    </h1>
    <div className="identity-meta">
     {atlas ? atlas.parts.length.toLocaleString() : '2,234'} modeled structures{' '}
     <span>·</span>{' '}
     {mode === 'dimorphic' ? '77 Female (Left) + 30 Male (Right) displayed in same frame' : (atlas?.name || 'Human Anatomy')}
    </div>
   </header>

   <nav className="top-actions" style={{ top: '96px' }} aria-label="Explorer panels">
    <Button
     variant="ghost"
     id="btn-toggle-dimorphic-side"
     className={panel === 'layers' && leftPanelTab === 'dimorphic' ? 'active' : ''}
     onClick={() => {
      setLeftPanelTab('dimorphic');
      setPanel(p => (p === 'layers' && leftPanelTab === 'dimorphic') ? null : 'layers');
     }}
     aria-label="Sex-Unique Anatomy Sidebar"
     style={{
      border: mode === 'dimorphic' ? '1px solid rgba(255, 255, 255, 0.45)' : mode === 'male' ? '1px solid rgba(56, 189, 248, 0.4)' : '1px solid rgba(244, 114, 182, 0.4)',
      background: mode === 'dimorphic' ? 'linear-gradient(135deg, rgba(236,72,153,0.22), rgba(56,189,248,0.22))' : mode === 'male' ? 'rgba(56, 189, 248, 0.16)' : 'rgba(236, 72, 153, 0.16)',
      color: '#f8fafc',
      fontWeight: 700,
      display: 'flex',
      alignItems: 'center',
      gap: '6px'
     }}
     title={mode === 'dimorphic' ? "Toggle 107 Sex-Unique Anatomy in Left Panel" : mode === 'male' ? "Toggle 30 Men's Unique Anatomy in Left Panel" : "Toggle 77 Women's Unique Anatomy in Left Panel"}
    >
     <span>{mode === 'dimorphic' ? '↔️' : mode === 'male' ? '⚡' : '🌸'}</span>
     <span>{mode === 'dimorphic' ? "Side-by-Side (107)" : mode === 'male' ? "Men's Unique (30)" : "Women's Unique (77)"}</span>
    </Button>
    <Button variant="ghost" id="btn-open-search" className={panel === 'search' ? 'active' : ''} onClick={() => openPanel('search')} aria-label="Search anatomy">
     <Search size={18} /><span>Find a structure</span><kbd>/</kbd>
    </Button>
    <Button variant="ghost" className="icon-button" aria-label="About this atlas" onClick={() => { setDetails(false); setPanel(null); setAbout(true); }}>
     <Info size={18} />
    </Button>
   </nav>

   <section className={`layers-panel glass ${panel === 'layers' ? 'mobile-open' : ''}`} aria-label="Anatomical layers">
    <div className="dimorphic-panel-tab-bar">
     <button
      type="button"
      className={`dimorphic-panel-tab ${leftPanelTab === 'systems' ? 'active' : ''}`}
      onClick={() => setLeftPanelTab('systems')}
     >
      🧬 Systems
     </button>
     <button
      type="button"
      className={`dimorphic-panel-tab dimorphic-tab-btn ${leftPanelTab === 'dimorphic' ? 'active' : ''}`}
      onClick={() => setLeftPanelTab('dimorphic')}
     >
      {mode === 'dimorphic' ? "↔️ Side-by-Side (107)" : mode === 'male' ? "⚡ Male-Unique (30)" : "🌸 Female-Unique (77)"}
     </button>
    </div>

    {leftPanelTab === 'dimorphic' ? (
     <div className="flex flex-col flex-1 min-h-0">
      <div className="dimorphic-search-input-wrap" style={{ marginTop: '8px' }}>
       <span className="dimorphic-search-icon">🔍</span>
       <input
        type="text"
        className="dimorphic-search-input"
        placeholder={mode === 'dimorphic' ? "Filter 107 parts (Female & Male)..." : mode === 'male' ? "Filter 30 men's unique parts..." : "Filter 77 women's unique parts..."}
        value={dimorphicSearch}
        onChange={e => setDimorphicSearch(e.target.value)}
       />
      </div>
      <div className="dimorphic-panel-list">
       {filteredDimorphicParts.map(p => (
        <div key={`${p.sex}-${p.id}`} className={`dimorphic-panel-item ${p.sex}-item`}>
         <div className="dimorphic-item-head">
          <span className="dimorphic-item-name" title={p.name}>{p.name}</span>
          <span className={`dimorphic-sex-badge ${p.sex}`}>
           {p.sex === 'female' ? '🌸 Female' : '⚡ Male'}
          </span>
         </div>
         <div className="dimorphic-exact-coords">
          <span>📍</span>
          <span>X: {p.exactPos.x}</span>
          <span>Y: {p.exactPos.y}</span>
          <span>Z: {p.exactPos.z} cm</span>
         </div>
         <div className="dimorphic-landmark-badge">
          <span>🏷️ {p.landmark}</span>
         </div>
         {p.homologue && (
          <div className="homologue-pill text-[9px]">
           🧬 Homologue: {p.homologue}
          </div>
         )}
         <div className="dimorphic-item-actions">
          <button
           type="button"
           className={`dimorphic-btn-focus ${p.sex}-btn`}
           onClick={() => handleSelectDimorphicPart(p, true)}
           title="Fly camera to exact position, isolate part and zoom in"
          >
           🎯 Isolate &amp; Zoom
          </button>
          <button
           type="button"
           className="female-part-btn-view text-[10px] py-1 px-2"
           onClick={() => handleSelectDimorphicPart(p, false)}
           title="Select part in anatomical context"
          >
           👁️ Context
          </button>
         </div>
        </div>
       ))}
       {filteredDimorphicParts.length === 0 && (
        <div className="text-center text-xs text-slate-400 py-6">
         No sex-unique parts matching &quot;{dimorphicSearch}&quot;
        </div>
       )}
      </div>
      <div className="panel-foot">
       <span>{filteredDimorphicParts.length} of {mode === 'dimorphic' ? allDimorphicParts.length : mode === 'male' ? maleUniqueParts.length : femaleUniqueParts.length} parts</span>
       <Button variant="ghost" onClick={() => setDimorphicSearch('')}>
        Reset
       </Button>
      </div>
     </div>
    ) : (
     <>
      <div className="panel-heading">
       <span>Systems</span>
       <Button variant="ghost" className="mobile-only icon-button" onClick={() => setPanel(null)} aria-label="Close systems"><X size={18} /></Button>
       <Badge variant="secondary" className="desktop-only small-number">{activeSystems.length}</Badge>
      </div>
      <div className="layer-presets">
       <Button variant="ghost" aria-pressed={activeSystems.every(x => state.visible.includes(x.id))} onClick={() => setState(s => ({ ...s, selected: [], isolate: false, visible: activeSystems.map(x => x.id) }))}>All</Button>
       <Button variant="ghost" aria-pressed={state.visible.length === 1 && state.visible[0] === 'skeletal'} onClick={() => setState(s => ({ ...s, selected: [], isolate: false, visible: ['skeletal'] }))}>Skeleton</Button>
       <Button variant="ghost" aria-pressed={state.visible.length >= 6 && ['cardiac', 'respiratory', 'digestive', 'urinary', 'reproductive'].every(id => state.visible.includes(id as SystemId))} onClick={() => setState(s => ({ ...s, selected: [], isolate: false, visible: ['cardiac', 'respiratory', 'digestive', 'urinary', 'reproductive'] }))}>Organs</Button>
      </div>
      <div className="system-list">
       {activeSystems.map(s => (
        <div className={`system-row ${state.visible.includes(s.id) ? 'enabled' : ''}`} key={s.id}>
         <Button variant="ghost" className="system-name" title={`Show only ${s.name.toLowerCase()}`} onClick={() => setState(v => ({ ...v, visible: [s.id], isolate: false, selected: [] }))}>
          <span className="system-dot" style={{ background: s.color }} />{s.name}<span className="system-count">{counts[s.id] || 0}</span>
         </Button>
         <Switch checked={state.visible.includes(s.id)} onCheckedChange={() => toggle(s.id)} aria-label={`Show ${s.name.toLowerCase()}`} />
        </div>
       ))}
      </div>
      <div className="panel-foot">
       <span>{visibleCount.toLocaleString()} pieces visible</span>
       <Button variant="ghost" onClick={() => setState(s => ({ ...s, visible: [], selected: [], isolate: false }))}>Hide all</Button>
      </div>
     </>
    )}
   </section>

   {panel === 'search' && atlas && (
    <div className="omni-search-modal open" id="omni-search-modal" role="dialog" aria-modal="true" aria-label="Find and isolate anatomical structure">
     <div className="omni-search-backdrop" id="omni-search-backdrop" onClick={() => setPanel(null)} />
     <div className="omni-search-shell">
      <header className="omni-search-head">
       <div className="omni-search-title-wrap">
        <span className="omni-search-badge">{atlas.parts.length.toLocaleString()} CLINICAL STRUCTURES</span>
        <div className="omni-search-heading">Find &amp; Isolate Anatomical Part</div>
        <div className="omni-search-sub">{atlas.name || 'OmniHuman-3D Reference Anatomy'} · Solo Isolation &amp; Dissection</div>
       </div>
       <button type="button" className="omni-search-close-btn" id="btn-close-structure-search" title="Close (Esc)" onClick={() => setPanel(null)}>&times;</button>
      </header>
      <div className="omni-search-controls">
       <div className="omni-search-input-box">
        <span className="omni-search-input-icon">🔍</span>
        <input
         type="text"
         id="omni-part-catalog-search"
         autoFocus
         placeholder="Search any part (e.g. Uterus, Ovary, Placenta, Femur, Biceps, Aorta)..."
         value={query}
         onChange={e => { setQuery(e.target.value); setSearchLimit(80); }}
         autoComplete="off"
        />
        {query && (
         <button type="button" id="btn-clear-catalog-search" className="omni-search-input-clear" title="Clear search" onClick={() => { setQuery(''); setSearchLimit(80); }}>&times;</button>
        )}
       </div>
       <div className="omni-search-system-tabs" id="omni-search-system-tabs">
        {sysTabs.map(t => (
         <button
          key={t.id}
          type="button"
          className={`omni-sys-tab ${searchSys === t.id ? 'active' : ''}`}
          data-sys={t.id}
          onClick={() => { setSearchSys(t.id); setSearchLimit(80); }}
         >
          {t.label}
         </button>
        ))}
       </div>
       <div className="omni-search-status-bar">
        <span id="omni-search-match-count">Showing {filteredParts.length.toLocaleString()} structures</span>
        <span className="omni-search-instruction">Click any part to isolate in 3D and zoom in</span>
       </div>
      </div>
      <div
       className="omni-search-results-grid"
       id="omni-search-results-grid"
       onScroll={e => {
        const el = e.currentTarget;
        if (el.scrollTop + el.clientHeight >= el.scrollHeight - 250) {
         setSearchLimit(l => Math.min(filteredParts.length, l + 80));
        }
       }}
      >
       {displayedParts.length === 0 ? (
        <div className="omni-search-empty">
         <div style={{ fontSize: 28, marginBottom: 8 }}>🔍</div>
         <div style={{ color: '#ffffff', fontWeight: 700 }}>No anatomical structures found matching &ldquo;{query}&rdquo;</div>
         <div style={{ fontSize: 11, color: '#64748b', marginTop: 6 }}>Try searching for &ldquo;uterus&rdquo;, &ldquo;ovary&rdquo;, &ldquo;placenta&rdquo;, &ldquo;bone&rdquo;, or select a system tab.</div>
        </div>
       ) : (
        displayedParts.map(p => {
         const sObj = systems.find(s => s.id === p.system);
         const color = sObj?.color || '#00f0ff';
         return (
          <div
           key={p.id}
           className="omni-search-card"
           data-id={p.id}
           onClick={() => { choosePart(p.id); setPanel(null); }}
          >
           <div className="omni-card-left">
            <span className="omni-card-dot" style={{ background: color, boxShadow: `0 0 8px ${color}88` }} />
            <div className="omni-card-titles">
             <span className="omni-card-name">{p.name}</span>
             <div className="omni-card-meta">
              <span className="omni-card-sys-tag" style={{ color, borderColor: `${color}44` }}>{(p.system || 'ORGAN').toUpperCase()}</span>
              <span className="omni-card-fma">{p.conceptId || p.id}</span>
              <span className="omni-card-verts">{p.vertexCount.toLocaleString()} verts</span>
             </div>
            </div>
           </div>
           <button
            type="button"
            className="omni-card-action-btn"
            title="Isolate in 3D and zoom camera"
            onClick={(e) => { e.stopPropagation(); isolatePart(p.id); }}
           >
            <span>🎯 Isolate &amp; Zoom</span>
           </button>
          </div>
         );
        })
       )}
      </div>
     </div>
    </div>
   )}

   {femaleCatalogOpen && (
    <div className="female-catalog-modal" id="female-catalog-modal" role="dialog" aria-modal="true" aria-label="Sex-Specific Unique Anatomy Catalog">
     <div className="female-catalog-backdrop" id="female-catalog-backdrop" onClick={() => setFemaleCatalogOpen(false)} />
     <div className="female-catalog-shell" style={{
      borderColor: sexCatalogTab === 'female'
       ? 'rgba(244, 114, 182, 0.4)'
       : 'rgba(56, 189, 248, 0.4)'
     }}>
      {/* Sex-Specific Catalog Switcher Tabs */}
      <div style={{
       display: 'flex',
       gap: '8px',
       padding: '12px 24px 0 24px',
       background: 'rgba(9, 14, 28, 0.98)',
       borderBottom: '1px solid rgba(255, 255, 255, 0.08)'
      }}>
       <button
        type="button"
        id="tab-toggle-female"
        onClick={() => setSexCatalogTab('female')}
        style={{
         flex: 1,
         padding: '10px 16px',
         borderRadius: '8px 8px 0 0',
         fontSize: '13px',
         fontWeight: 700,
         cursor: 'pointer',
         background: sexCatalogTab === 'female' ? 'linear-gradient(135deg, rgba(236,72,153,0.35), rgba(219,39,119,0.45))' : 'rgba(255,255,255,0.03)',
         color: sexCatalogTab === 'female' ? '#f472b6' : '#94a3b8',
         borderTop: sexCatalogTab === 'female' ? '2px solid #f472b6' : '1px solid rgba(255,255,255,0.08)',
         borderLeft: sexCatalogTab === 'female' ? '1px solid rgba(244,114,182,0.4)' : '1px solid rgba(255,255,255,0.08)',
         borderRight: sexCatalogTab === 'female' ? '1px solid rgba(244,114,182,0.4)' : '1px solid rgba(255,255,255,0.08)',
         borderBottom: 'none',
         display: 'flex',
         alignItems: 'center',
         justifyContent: 'center',
         gap: '8px',
         transition: 'all 0.15s ease'
        }}
       >
        🌸 Women&apos;s Unique Anatomy ({femaleUniqueParts.length || 77})
       </button>
       <button
        type="button"
        id="tab-toggle-male"
        onClick={() => setSexCatalogTab('male')}
        style={{
         flex: 1,
         padding: '10px 16px',
         borderRadius: '8px 8px 0 0',
         fontSize: '13px',
         fontWeight: 700,
         cursor: 'pointer',
         background: sexCatalogTab === 'male' ? 'linear-gradient(135deg, rgba(6,182,212,0.35), rgba(14,165,233,0.45))' : 'rgba(255,255,255,0.03)',
         color: sexCatalogTab === 'male' ? '#38bdf8' : '#94a3b8',
         borderTop: sexCatalogTab === 'male' ? '2px solid #38bdf8' : '1px solid rgba(255,255,255,0.08)',
         borderLeft: sexCatalogTab === 'male' ? '1px solid rgba(56,189,248,0.4)' : '1px solid rgba(255,255,255,0.08)',
         borderRight: sexCatalogTab === 'male' ? '1px solid rgba(56,189,248,0.4)' : '1px solid rgba(255,255,255,0.08)',
         borderBottom: 'none',
         display: 'flex',
         alignItems: 'center',
         justifyContent: 'center',
         gap: '8px',
         transition: 'all 0.15s ease'
        }}
       >
        ⚡ Men&apos;s Unique Anatomy ({maleUniqueParts.length || 30})
       </button>
      </div>

      <header className="female-catalog-head" style={{
       background: sexCatalogTab === 'female'
        ? 'linear-gradient(180deg, rgba(236, 72, 153, 0.14) 0%, rgba(9, 14, 28, 0) 100%)'
        : 'linear-gradient(180deg, rgba(14, 165, 233, 0.14) 0%, rgba(9, 14, 28, 0) 100%)'
      }}>
       {sexCatalogTab === 'female' ? (
        <div>
         <span className="female-catalog-badge">🌸 77 VERIFIED FEMALE STRUCTURES SAVED SEPARATELY</span>
         <div className="female-catalog-heading">Women&apos;s Unique Anatomy &amp; Specialized Parity Catalog</div>
         <div className="female-catalog-sub">
          Comprehensive female anatomical inventory: Gynecoid Pelvis, Clitoral-Vestibular Complex, Uterovaginal Architecture, Multilayer Mammary Dissection, and Cranial Aesthetics.
         </div>
        </div>
       ) : (
        <div>
         <span className="male-catalog-badge">⚡ 30 VERIFIED MALE STRUCTURES SAVED SEPARATELY</span>
         <div className="female-catalog-heading" style={{ color: '#e0f2fe' }}>Men&apos;s Unique Anatomy &amp; Specialized Parity Catalog</div>
         <div className="female-catalog-sub">
          Dedicated male anatomical inventory: Android Pelvis, Erectile Penile Bodies, Testicular &amp; Spermatic Conduit Architecture, Prostate Gland, and Gonadal Vasculature.
         </div>
        </div>
       )}
       <div className="female-catalog-head-actions">
        {sexCatalogTab === 'female' ? (
         <a
          href="/models/female-unique-parts.json"
          download="female-unique-parts.json"
          className="female-catalog-export-btn"
          id="btn-export-female-json"
          title="Download saved female-unique parts JSON file"
         >
          💾 Download JSON ({femaleUniqueParts.length || 77})
         </a>
        ) : (
         <a
          href="/models/male-unique-parts.json"
          download="male-unique-parts.json"
          className="male-catalog-export-btn"
          id="btn-export-male-json"
          title="Download saved male-unique parts JSON file"
         >
          💾 Download JSON ({maleUniqueParts.length || 30})
         </a>
        )}
        <button
         type="button"
         className="female-catalog-close-btn"
         id="btn-close-female-catalog"
         onClick={() => setFemaleCatalogOpen(false)}
         title="Close (Esc)"
        >
         &times;
        </button>
       </div>
      </header>

      {sexCatalogTab === 'female' ? (
       <div className="female-catalog-controls">
        <div className="omni-search-input-box">
         <span className="omni-search-input-icon">🔍</span>
         <input
          type="text"
          id="input-female-catalog-search"
          autoFocus
          placeholder="Search female-unique structures (e.g. Clitoris, Labia, Uterus, Mammary, Pelvis, Ovary)..."
          value={femaleSearchQuery}
          onChange={e => setFemaleSearchQuery(e.target.value)}
          autoComplete="off"
         />
         {femaleSearchQuery && (
          <button
           type="button"
           className="omni-search-input-clear"
           onClick={() => setFemaleSearchQuery('')}
           title="Clear search"
          >
           &times;
          </button>
         )}
        </div>

        <div className="omni-search-system-tabs">
         {femaleCategoryTabs.map(t => (
          <button
           key={t.id}
           type="button"
           className={`female-cat-tab ${femaleCategoryFilter === t.id ? 'active' : ''}`}
           onClick={() => setFemaleCategoryFilter(t.id)}
          >
           {t.label}
          </button>
         ))}
        </div>

        <div className="omni-search-status-bar">
         <span style={{ color: '#f472b6', fontWeight: 700 }}>
          Showing {filteredFemaleParts.length} of {femaleUniqueParts.length} women&apos;s unique anatomical parts
         </span>
         <span className="omni-search-instruction">
          Click &ldquo;Isolate &amp; Zoom&rdquo; to isolate in 3D and zoom in
         </span>
        </div>
       </div>
      ) : (
       <div className="female-catalog-controls">
        <div className="omni-search-input-box">
         <span className="omni-search-input-icon">🔍</span>
         <input
          type="text"
          id="input-male-catalog-search"
          autoFocus
          placeholder="Search men&apos;s unique structures (e.g. Prostate, Penis, Testis, Scrotum, Epididymis)..."
          value={maleSearchQuery}
          onChange={e => setMaleSearchQuery(e.target.value)}
          autoComplete="off"
         />
         {maleSearchQuery && (
          <button
           type="button"
           className="omni-search-input-clear"
           onClick={() => setMaleSearchQuery('')}
           title="Clear search"
          >
           &times;
          </button>
         )}
        </div>

        <div className="omni-search-system-tabs">
         {maleCategoryTabs.map(t => (
          <button
           key={t.id}
           type="button"
           className={`male-cat-tab ${maleCategoryFilter === t.id ? 'active' : ''}`}
           onClick={() => setMaleCategoryFilter(t.id)}
          >
           {t.label}
          </button>
         ))}
        </div>

        <div className="omni-search-status-bar">
         <span style={{ color: '#38bdf8', fontWeight: 700 }}>
          Showing {filteredMaleParts.length} of {maleUniqueParts.length} men&apos;s unique anatomical parts
         </span>
         <span className="omni-search-instruction">
          Click &ldquo;Isolate &amp; Zoom&rdquo; to switch to Male Atlas and focus in 3D
         </span>
        </div>
       </div>
      )}

      {sexCatalogTab === 'female' ? (
       <div className="female-catalog-grid" id="female-catalog-grid">
        {filteredFemaleParts.length === 0 ? (
         <div className="omni-search-empty">
          <div style={{ fontSize: 28, marginBottom: 8 }}>🌸</div>
          <div style={{ color: '#ffffff', fontWeight: 700 }}>No women&apos;s unique structures found matching &ldquo;{femaleSearchQuery}&rdquo;</div>
          <div style={{ fontSize: 11, color: '#64748b', marginTop: 6 }}>Try searching for &ldquo;clitoris&rdquo;, &ldquo;uterus&rdquo;, &ldquo;mammary&rdquo;, &ldquo;sacrum&rdquo;, or select a category tab.</div>
         </div>
        ) : (
         filteredFemaleParts.map(p => {
          const desc = CATEGORY_DESCRIPTIONS[p.category] || 'Dedicated female anatomical structure.';
          return (
           <div key={p.id} className="female-part-card" data-part-id={p.id}>
            <div>
             <div className="female-part-card-head">
              <span className="female-part-name">{p.name}</span>
              <span className="female-part-badge">{p.category}</span>
             </div>
             <p className="female-part-desc" style={{ marginTop: 6 }}>{desc}</p>
            </div>
            <div>
             <div className="female-part-meta">
              <span>{p.conceptId || p.id}</span>
              <span>•</span>
              <span>{p.system.toUpperCase()}</span>
              <span>•</span>
              <span>{p.vertexCount.toLocaleString()} verts</span>
             </div>
             <div className="female-part-actions">
              <button
               type="button"
               className="female-part-btn-isolate"
               title="Isolate in 3D and zoom in"
               onClick={() => handleSelectFemalePart(p, true)}
              >
               🎯 Isolate &amp; Zoom
              </button>
              <button
               type="button"
               className="female-part-btn-view"
               title="Select in full atlas context"
               onClick={() => handleSelectFemalePart(p, false)}
              >
               👁️ View in Context
              </button>
             </div>
            </div>
           </div>
          );
         })
        )}
       </div>
      ) : (
       <div className="female-catalog-grid" id="male-catalog-grid">
        {filteredMaleParts.length === 0 ? (
         <div className="omni-search-empty">
          <div style={{ fontSize: 28, marginBottom: 8 }}>⚡</div>
          <div style={{ color: '#ffffff', fontWeight: 700 }}>No men&apos;s unique structures found matching &ldquo;{maleSearchQuery}&rdquo;</div>
          <div style={{ fontSize: 11, color: '#64748b', marginTop: 6 }}>Try searching for &ldquo;prostate&rdquo;, &ldquo;penis&rdquo;, &ldquo;testis&rdquo;, &ldquo;sacrum&rdquo;, or select a category tab.</div>
         </div>
        ) : (
         filteredMaleParts.map(p => {
          const desc = MALE_CATEGORY_DESCRIPTIONS[p.category] || p.description || 'Dedicated male anatomical structure.';
          return (
           <div key={p.id} className="male-part-card" data-part-id={p.id}>
            <div>
             <div className="female-part-card-head">
              <span className="female-part-name" style={{ color: '#e0f2fe' }}>{p.name}</span>
              <span className="male-part-badge">{p.category.replace('_', ' ')}</span>
             </div>
             <p className="female-part-desc" style={{ marginTop: 6 }}>{desc}</p>
             {p.homologue && (
              <div className="homologue-pill" title="Embryological female homologue">
               <span>🔄 Homologue:</span>
               <strong style={{ color: '#38bdf8' }}>{p.homologue}</strong>
              </div>
             )}
            </div>
            <div>
             <div className="female-part-meta">
              <span>{p.conceptId || p.id}</span>
              <span>•</span>
              <span>{p.system.toUpperCase()}</span>
              <span>•</span>
              <span>{p.vertexCount.toLocaleString()} verts</span>
             </div>
             <div className="female-part-actions">
              <button
               type="button"
               className="male-part-btn-isolate"
               title="Switch to Male Atlas, isolate in 3D and zoom in"
               onClick={() => handleSelectMalePart(p, true)}
              >
               🎯 Isolate &amp; Zoom
              </button>
              <button
               type="button"
               className="female-part-btn-view"
               title="Select in full male atlas context"
               onClick={() => handleSelectMalePart(p, false)}
              >
               👁️ View in Context
              </button>
             </div>
            </div>
           </div>
          );
         })
        )}
       </div>
      )}
     </div>
    </div>
   )}


   <nav className="view-controls glass" aria-label="Camera controls">
    {(['three-quarter', 'front', 'side', 'back'] as View[]).map((v, i) => (
     <Button variant="ghost" key={v} className={state.view === v ? 'active' : ''} aria-pressed={state.view === v} disabled={state.explode > 0.8 && v !== 'front'} onClick={() => setState(s => ({ ...s, view: v, reset: s.reset + 1, rotate: false }))} title={`${v} view`} aria-label={`${v} view`}>
      <span>{['¾', 'F', 'S', 'B'][i]}</span>
     </Button>
    ))}
    <i />
    <Button variant="ghost" disabled={state.explode >= 0.4} aria-label={state.rotate ? 'Pause rotation' : 'Rotate body'} title="Auto rotate" className={state.rotate ? 'active' : ''} onClick={() => setState(s => ({ ...s, rotate: !s.rotate }))}>
     {state.rotate ? <Pause size={17} /> : <RotateCw size={18} />}
    </Button>
    <Button variant="ghost" aria-label="Reset view and layers" title="Reset" onClick={reset}>
     <RotateCcw size={17} />
    </Button>
   </nav>

   <div className="scene-caption">
    <span className="caption-line" />
    <span>{state.isolate ? (chosen?.name ?? 'SELECTED STRUCTURE') : state.explode > 0.95 ? 'ANATOMICAL INVENTORY' : state.explode > 0.05 ? 'SEPARATED STRUCTURES' : `${(atlas?.sex || 'human').toUpperCase()} 3D ANATOMY · ${mode.toUpperCase()}`}</span>
    <span className="caption-line" />
   </div>

   <div className="bottom-dock glass">
    <Button variant="ghost" className="mobile-only dock-layers" onClick={() => openPanel('layers')} aria-label="Open system layers">
     <Layers3 size={20} /><span>Systems</span>
    </Button>
    <div className="explode-control">
     <div className="explode-label">
      <label id="explode-label">Explode anatomy</label>
      <output>{Math.round(state.explode * 100)}<span>%</span></output>
     </div>
     <Slider aria-labelledby="explode-label" min={0} max={100} step={1} value={[state.explode * 100]} onValueChange={v => setState(s => ({ ...s, explode: (Array.isArray(v) ? v[0] : v) / 100, view: (Array.isArray(v) ? v[0] : v) > 80 ? 'front' : s.view, rotate: false }))} />
     <div className="slider-endpoints"><span>Assembled</span><span>Every piece</span></div>
    </div>
    <Button variant="ghost" className="dock-reset" onClick={reset} aria-label="Assemble and reset">
     <RotateCcw size={18} /><span>Reset</span>
    </Button>
   </div>

   <footer className="studio-footer">
    <span>{state.explode > 0.8 ? 'Drag to pan' : 'Drag to orbit'} <b>·</b> Pinch to zoom <b>·</b> Tap to inspect</span>
    <Button variant="ghost" onClick={() => { setDetails(false); setPanel(null); setAbout(true); }}>Source & credits <ArrowUpRight size={12} /></Button>
   </footer>

   {progress < 100 && !error && (
    <div className="loading glass" role="status">
     <Activity size={18} />
     <div>
      <strong>Preparing the anatomy</strong>
      <span>{progress}% · Loading {atlas?.parts.length.toLocaleString() ?? '2,234'} pieces</span>
      <div className="loading-track"><i style={{ width: `${progress}%` }} /></div>
     </div>
    </div>
   )}

   {error && (
    <div className="loading glass error" role="alert">
     <p>{error}</p>
     <Button variant="ghost" onClick={() => location.reload()}>Reload viewer</Button>
    </div>
   )}

   <Sheet open={details && selectedParts.length > 0} modal={false} disablePointerDismissal onOpenChange={setDetails}>
    <SheetContent initialFocus={detailTitle} className={`detail-sheet glass ${state.isolate ? 'is-isolated' : ''}`} showCloseButton={true}>
     <div className="detail-header">
      <div className="detail-accent" style={{ background: system?.color }} />
      <div className="eyebrow">{state.isolate ? 'CLINICAL DIAGNOSTIC PANEL' : (system?.name ?? 'ANATOMY')}</div>
      <SheetTitle ref={detailTitle} tabIndex={-1} className="structure-title">{chosen?.name}</SheetTitle>
     </div>
     <div className="detail-scroll" key={`${chosen?.id}-${state.isolate}`}>
      <SheetDescription className="structure-description">{chosen && selected ? explanation(chosen.name, selected.system) : ''}</SheetDescription>
      {chosen && !EXPLANATIONS[chosen.name.toLowerCase()] && <span className="context-note">System overview · structure identified from source anatomy</span>}
      <div className="structure-meta"><span>FMA ID<strong>{chosen?.id}</strong></span><span>Pieces<strong>{state.selected.length.toLocaleString()}</strong></span></div>
      <div className="structure-meta"><span>Vertices<strong>{meshMetrics.vertices.toLocaleString()}</strong></span><span>Faces<strong>{meshMetrics.faces.toLocaleString()}</strong></span></div>
      {selectedParts.length > 1 && (
       <div className="member-list">
        <h3>Included structures</h3>
        {selectedParts.slice(0, 50).map(p => (
         <Button variant="ghost" key={p.id} onClick={() => choosePart(p.id)}>
          <span>{p.name}</span><ChevronRight size={14} />
         </Button>
        ))}
        {selectedParts.length > 50 && <p>And {selectedParts.length - 50} more modeled pieces.</p>}
       </div>
      )}
      <a className="source-link" href="https://lifesciencedb.jp/bp3d/" target="_blank" rel="noreferrer">View anatomical source <ArrowUpRight size={14} /></a>
     </div>
     <div className="detail-actions">
      <Button className={`primary-action ${state.isolate ? 'active' : ''}`} id="btn-isolate-part" onClick={handleIsolateToggle}>
       {state.isolate ? <><Eye size={18} /><span id="txt-isolate">[ ↺ Back to whole body ]</span></> : <><Focus size={18} /><span id="txt-isolate">Focus structure</span><ChevronRight size={16} /></>}
      </Button>
      <Button variant="ghost" className="secondary-action" onClick={handleRestoreWholeBody}>
       ↺ Back to whole body
      </Button>
     </div>
    </SheetContent>
   </Sheet>

   <Sheet open={about} onOpenChange={setAbout}>
    <SheetContent className="about-sheet glass">
     <div className="eyebrow">SOURCE & SCOPE</div>
     <SheetTitle className="structure-title">{atlas?.name || 'Human 3D Anatomy Atlas'}</SheetTitle>
     <SheetDescription>Explore the human reference anatomy in real-time WebGL.</SheetDescription>
     <div className="about-copy">
      <p><strong>{atlas?.name}</strong><br />{atlas?.parts.length.toLocaleString()} individual meshes across 15 anatomical systems.</p>
      <p>This reference contains male and female full-body anatomy, gestational changes during pregnancy (0–40 weeks), and lifespan ontogeny across 0–80 years.</p>
      <h3>Sources</h3>
      <p>BodyParts3D, © The Database Center for Life Science (CC-BY 4.0).<br />NIH HuBMAP Human Reference Atlas (HRA) Female Organ Set.</p>
      <a href="https://dbarchive.biosciencedbc.jp/en/bodyparts3d/lic.html" target="_blank" rel="noreferrer">Dataset license <ArrowUpRight size={14} /></a>
     </div>
    </SheetContent>
   </Sheet>
  </main>
 );
}
