export type SystemId = 'skeletal'|'muscular'|'arterial'|'venous'|'nervous'|'digestive'|'respiratory'|'urinary'|'reproductive'|'lymphatic'|'endocrine'|'integumentary'|'connective'|'sensory'|'cardiac';

export const SYSTEMS: {id:SystemId;name:string;color:string;description:string}[] = [
 {id:'skeletal',name:'Skeleton',color:'#e2d9ba',description:'Bones form the supporting framework of the body, protect organs, and provide attachment points for muscles. Their internal tissue also stores minerals and produces blood cells.'},
 {id:'muscular',name:'Muscles',color:'#a85b50',description:'Skeletal muscles generate movement by pulling on their attachments. Together with tendons, they move joints, stabilize posture, and produce heat.'},
 {id:'cardiac',name:'Heart',color:'#b96760',description:'The heart is a muscular pump with four chambers. Its valves direct blood forward through the pulmonary and systemic circuits.'},
 {id:'sensory',name:'Sensory organs',color:'#b0c8ce',description:'These structures contribute to special senses, including sight, hearing, and balance. Their specialized tissues detect stimuli and work with the nervous system to convey information.'},
 {id:'arterial',name:'Arteries',color:'#c05245',description:'The heart drives blood through the circulation. Arteries carry blood away from the heart to supply tissues or, in the pulmonary circuit, to the lungs.'},
 {id:'venous',name:'Veins',color:'#527c9f',description:'Veins return blood toward the heart. Superficial and deep networks collect blood from the tissues; the pulmonary veins bring oxygenated blood back from the lungs.'},
 {id:'nervous',name:'Nervous system',color:'#d8b565',description:'The brain, spinal cord, and peripheral nerves carry and process signals. They support sensation, movement, coordination, and automatic regulation of body functions.'},
 {id:'respiratory',name:'Respiratory',color:'#b98991',description:'The airways conduct air to the lungs, where oxygen and carbon dioxide move between air and blood. Breathing depends on pressure changes produced by respiratory muscles.'},
 {id:'digestive',name:'Digestive',color:'#b8916b',description:'The digestive tract breaks down food, absorbs nutrients and water, and moves waste onward. Accessory organs contribute bile and digestive enzymes.'},
 {id:'urinary',name:'Urinary',color:'#b47961',description:'The kidneys filter blood and regulate fluid, electrolyte, and acid–base balance. Urine travels through the ureters to the bladder and exits through the urethra.'},
 {id:'lymphatic',name:'Lymphatic',color:'#879f7c',description:'Lymphatic vessels return excess tissue fluid to the circulation. Lymph nodes and other lymphoid organs support immune surveillance and responses.'},
 {id:'endocrine',name:'Endocrine',color:'#c5a09a',description:'Endocrine organs release hormones into the blood to coordinate processes such as metabolism, growth, stress responses, and reproduction.'},
 {id:'reproductive',name:'Reproductive',color:'#e26d85',description:'Structures responsible for gametogenesis, sex steroid hormone synthesis, and human reproduction.'},
 {id:'integumentary',name:'Body surface',color:'#ba9b7d',description:'The body surface provides an outer anatomical reference. The integumentary system forms a protective barrier and contributes to sensation and temperature regulation.'},
 {id:'connective',name:'Connective tissue',color:'#aec3bb',description:'Cartilage, ligaments, and other connective tissues support, connect, and separate structures. Their roles include stabilizing joints and distributing mechanical loads.'},
];

export function getSystems(sex?: 'male' | 'female' | 'combined') {
  return SYSTEMS.map(s => {
    if (s.id === 'reproductive') {
      return {
        ...s,
        description: sex === 'female'
          ? 'The female reproductive organs include the uterus, ovaries, uterine tubes (Fallopian tubes), vagina, and bilateral mammary glands, facilitating oogenesis, endocrine regulation, fertilization, gestation, and lactation.'
          : sex === 'combined'
          ? 'Comparative sex-dimorphic reproductive structures, showing both female (77) and male (30) sex-unique organs, erectile bodies, gonads, and conduits.'
          : 'The male reproductive structures contribute to sperm production, maturation, transport, and the production of androgenic sex hormones.'
      };
    }
    return s;
  });
}

export type AtlasMode = 'male' | 'female' | 'pregnancy' | 'aging' | 'dimorphic';
export type FemalePath = 'female-fullbody' | 'female-trunk-hra' | 'female-dimorphic' | 'female-hybrid-vhf';
export type MalePath = 'male-fullbody' | 'male-dimorphic';
export type DimorphicArrangement = 'side-by-side' | 'superimposed';
export type DimorphicFilter = 'all' | 'female' | 'male';

export interface Part {
  id: string;
  name: string;
  conceptId: string;
  system: SystemId;
  chunk: number;
  positions: number;
  normals: number;
  indices: number;
  vertexCount: number;
  indexCount: number;
  bounds: [number[], number[]];
  sex?: 'male' | 'female';
  category?: string;
  homologue?: string;
}
export interface Concept {id:string;name:string;elements:string[]}
export interface Atlas {version?:string;sex?:'male'|'female'|'combined';source?:string;scope?:string;name?:string;parts:Part[];concepts:Concept[];chunks:{url:string;bytes:number;gzip?:string;gzipBytes?:number}[];triangles:number}
export type View = 'three-quarter'|'front'|'back'|'side';
export interface SceneState {inspectorOpen?:boolean;explode:number;visible:SystemId[];selected:string[];isolate:boolean;view:View;rotate:boolean;reset:number;cinematicActive?:boolean;hudBanner?:string}
export const DEFAULT_VISIBLE:SystemId[] = ['cardiac','sensory','skeletal','muscular','arterial','venous','nervous','respiratory','digestive','urinary','lymphatic','endocrine','reproductive','connective'];

export const EXPLANATIONS:Record<string,string> = {
 'heart':'A muscular pump in the chest. Its right side sends blood to the lungs; its left side sends blood through the systemic circulation.',
 'liver':'A large organ beneath the right side of the diaphragm. It processes absorbed nutrients, produces bile, and synthesizes many proteins carried in the blood.',
 'brain':'The central organ of the nervous system. Its interconnected regions support perception, movement, memory, language, and the regulation of bodily functions.',
 'stomach':'A muscular chamber between the esophagus and small intestine. It stores and mixes food with acid and enzymes before releasing it into the duodenum.',
 'spleen':'A lymphoid organ in the upper left abdomen. It filters blood, removes aging blood cells, and participates in immune responses.',
 'pancreas':'An abdominal organ with digestive and endocrine roles. It supplies enzymes to the small intestine and releases hormones including insulin and glucagon.',
 'urinary bladder':'A muscular reservoir in the pelvis that stores urine arriving from the kidneys through the ureters.',
 'trachea':'The main airway connecting the larynx to the bronchi. Its cartilage supports keep the airway open during breathing.',
 'diaphragm':'A broad muscle separating the chest and abdomen. When it contracts, it increases chest volume and helps draw air into the lungs.',
 // Female reproductive & mammary organs
 'uterus':'A hollow, thick-walled muscular pelvic organ in females where the fertilized ovum implants and develops during pregnancy.',
 'body of uterus':'The corpus uteri, forming the upper two-thirds of the uterus and housing the expanding gestational cavity during pregnancy.',
 'fundus of uterus':'The dome-shaped superior portion of the uterus located above the entry of the fallopian tubes.',
 'myometrium':'The thick muscular middle layer of the uterine wall, composed of smooth muscle fibers capable of forceful contractions during labor.',
 'endometrium':'The mucosal inner lining of the uterine cavity that thickens and sheds cyclically in response to estrogen and progesterone.',
 'cervix':'The lower cylindrical neck of the uterus connecting the uterine cavity to the vagina through the cervical canal.',
 'cervicovaginal':'The anatomical transition zone between the uterine cervix and the upper vaginal fornix.',
 'cornua':'The lateral angles of the uterine fundus where the fallopian tubes enter.',
 'ovary':'The female primary sex organ (gonad) producing oocytes and secreting steroid hormones including estrogens and progesterone.',
 'fallopian':'Also called uterine tube; paired muscular conduits extending from the uterine cornua to the ovaries where fertilization occurs.',
 'uterine tube':'Also called Fallopian tube; paired conduits extending from uterine horns to ovaries where fertilization normally occurs.',
 'ampulla':'The longest and widest section of the fallopian tube, serving as the typical site of ovum fertilization.',
 'isthmus':'The narrow, thick-walled medial segment of the fallopian tube adjoining the uterine wall.',
 'infundibulum':'The funnel-shaped distal end of the fallopian tube opening into the peritoneal cavity adjacent to the ovary.',
 'fimbria':'Finger-like ciliated projections fringing the infundibulum that sweep the ovulated oocyte into the fallopian tube.',
 'vagina':'A distensible fibromuscular canal extending from the cervix of the uterus to the external genitalia (vulva).',
 'vulva':'The external female genital structures including the labia majora, labia minora, clitoris, and vaginal vestibule.',
 'mammary':'Exocrine gland on the anterior thoracic wall organized into 15–20 glandular lobes embedded in subcutaneous adipose tissue for milk synthesis and lactation.',
 'mammary adipose':'Specialized subcutaneous adipose tissue enveloping mammary glandular parenchyma, determining breast volume and contour.',
 'mammary glandular':'The secretory parenchyma of the breast consisting of compound tubuloalveolar glands that synthesize milk during lactation.',
 'lactiferous duct':'Tubular conduits draining glandular breast lobes toward the lactiferous sinuses and nipple.',
 'lactiferous sinus':'Dilated ampullary reservoirs beneath the areola where milk accumulates prior to ejection during suckling.',
 'suspensory ligament':'Cooper’s ligaments: fibrous connective tissue bands anchoring the mammary gland parenchyma to the overlying dermis and deep pectoral fascia.',
 'nipple':'Cylindrical pigmented projection on the anterior breast containing 15–20 lactiferous duct orifices and smooth muscle fibers for erection.',
 'areola':'Circular pigmented skin zone surrounding the nipple containing sebaceous Montgomery glands (areolar tubercles) that lubricate during nursing.',
 'areolar tubercle':'Small raised cutaneous elevations (Montgomery tubercles) on the areola that secrete protective lipid fluid.',
 // Gestational / Pregnancy dynamics
 'gravid uterus':'The hypertrophied uterus during late pregnancy, expanding from 60g to over 1,100g and rising to the xiphoid process.',
 'placenta':'A vital fetomaternal organ facilitating metabolic transfer, gas exchange, nutrient delivery, and hormone secretion between mother and fetus.',
 'umbilical cord':'The vascular lifeline connecting placenta to fetal umbilicus, containing two umbilical arteries and one umbilical vein.',
 'amniotic sac':'The fluid-filled membranous sac enclosing the developing fetus, providing cushioning and physical space for movement.',
 'fetus (head':'The fetal cranium presenting in vertex cephalic position at the maternal pelvic brim with flexed cervical occiput.',
 'fetus (torso':'The developing fetal trunk showing physiological C-shaped spinal curvature and compact intrauterine flexion.',
 'fetus (flexed':'Flexed fetal limbs tucked securely against the trunk, demonstrating normal neuromuscular intrauterine tone.',
 'fetus':'The developing human organism from the 9th gestational week until birth, seen here in vertex cephalic presentation.',
 'displaced stomach':'During the third trimester, the fundal height of the gravid uterus elevates and compresses the stomach superiorly.',
 'displaced intestines':'Abdominal viscera and intestinal loops are shifted upward and laterally, framing the enlarged uterine fundus.',
 'elevated hemidiaphragms':'The diaphragm is displaced superiorly by up to 4cm in late gestation, with a compensatory widening of the subcostal angle.',
 // Lifespan & aging
 'epiphyseal growth plate':'Cartilaginous plates at long bone metaphyses in children responsible for longitudinal skeletal growth.',
 'thoracic hyperkyphosis':'Exaggerated anterior thoracic spinal curvature (Dowager’s hump) characteristic of osteoporotic wedge collapse.',
 'hyperkyphosis':'Excessive anterior curvature of the thoracic spine (Dowager’s hump), commonly secondary to osteoporotic vertebral wedge microfractures.',
 'intervertebral disc dehydration':'Age-related loss of proteoglycans and nucleus pulposus hydration causing vertebral space narrowing.',
 'intervertebral disc':'Fibrocartilaginous pads between vertebral bodies that lose water content and thickness with age, reducing spinal column length.',
 'sarcopenic':'Age-related involuntary loss of skeletal muscle mass and strength, particularly affecting fast-twitch Type II fibers.',
 'atrophic ovary':'Postmenopausal involution of ovarian tissue into fibrous white scars (corpora albicantia) with cessation of folliculogenesis.',
 'uterine involution':'Postmenopausal regression of uterine muscle mass and endometrial thinning following estrogen withdrawal.',
 'dexa':'Dual-energy X-ray absorptiometry region used clinically to measure bone mineral density and diagnose osteopenia or osteoporosis.'
};

export function explanation(name:string, system:SystemId){
  const lower = name.toLowerCase();
  for (const [key, desc] of Object.entries(EXPLANATIONS)) {
    if (lower.includes(key)) return desc;
  }
  return SYSTEMS.find(s => s.id === system)?.description ?? '';
}

/** Depth ordering for layer peeling: 0 = most superficial, 5 = deepest. */
export const SYSTEM_DEPTH_LAYERS:Record<SystemId,number> = {
 integumentary:0, muscular:1, connective:1,
 arterial:2, venous:2, lymphatic:2,
 nervous:3,
 cardiac:4, respiratory:4, digestive:4,
 urinary:4, endocrine:4, reproductive:4,
 skeletal:5, sensory:5,
};

export const SYSTEM_HUD_LABELS:Record<SystemId,string> = {
 skeletal:'🦴 SKELETON LAYER',muscular:'💪 MUSCULAR LAYER',connective:'🔗 CONNECTIVE LAYER',
 arterial:'❤️ ARTERIAL LAYER',venous:'💙 VENOUS LAYER',lymphatic:'🟢 LYMPHATIC LAYER',
 nervous:'⚡ NERVOUS LAYER',cardiac:'❤️ CARDIAC LAYER',respiratory:'🫁 RESPIRATORY LAYER',
 digestive:'🫃 DIGESTIVE LAYER',urinary:'🫘 URINARY LAYER',endocrine:'🧬 ENDOCRINE LAYER',
 reproductive:'🧬 REPRODUCTIVE LAYER',integumentary:'🧤 BODY SURFACE',sensory:'👁️ SENSORY LAYER',
};
