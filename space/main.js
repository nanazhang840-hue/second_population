/* 第二人口 · 空间化物体库（对照参考图重做的渲染层）
   管线要点：程序化环境贴图（PMREM）+ 金属度/粗糙度分离 + 湿地面反射 + 指数雾 + ACES。
   单 renderer、单 rAF；闲置降帧。 */
import * as THREE from '../integration/vendor/three-r170.module.js';
import { geometryFor, MATERIAL_SPEC } from './objects.js';
import { buildHall, makeGlowTexture, makeContactTexture } from './hall.js';
import { OBJECTS, CLASS_META, FOOT, HERO_ID, PLINTH } from './layout.js';
import { universeModels } from '../integration/universe-models.js';

const qs = new URLSearchParams(location.search);
const canvas = document.getElementById('spaceCanvas');
const observation = qs.get('mode') === 'observation';
const requestedRecord = observation ? qs.get('record') : null;
const requestedKind = observation ? kindOf(qs.get('kind')) : null;
if(observation) document.body.classList.add('observation-mode');

/* ── 渲染器 ── */
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.40;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const scene = new THREE.Scene();
scene.background = new THREE.Color('#04060a');

const CAM = { pos: [2.2, 2.55, 4.6], target: [-0.4, 1.15, -11.0], fov: 44 };
if(observation) {
  CAM.pos = [9.5, 10.5, 18.0];
  CAM.target = [0, 0.6, -5];
  const aspect=window.innerWidth/window.innerHeight;
  const horizontalFov=aspect<1?45:52;
  CAM.fov = THREE.MathUtils.clamp(2*Math.atan(Math.tan(THREE.MathUtils.degToRad(horizontalFov)/2)/aspect)*180/Math.PI,30,85);
  scene.background.set('#151517');
}
if (qs.get('cam')) {
  const v = qs.get('cam').split(',').map(Number);
  if (v.length === 7 && v.every(n => Number.isFinite(n))) {
    CAM.pos = v.slice(0, 3); CAM.target = v.slice(3, 6); CAM.fov = v[6];
  }
}

const camera = new THREE.PerspectiveCamera(CAM.fov, window.innerWidth / window.innerHeight, 0.1, 220);
camera.position.set(...CAM.pos);
const lookTarget = new THREE.Vector3(...CAM.target);
camera.lookAt(lookTarget);

/* ── 深场环境 ── */
const hall = buildHall(scene, renderer);
if(observation) {
  hall.group.visible = false;
  scene.fog = null;
  renderer.shadowMap.enabled = false;
  renderer.toneMappingExposure = 1.16;
}

/* ── 光：一座主光 + 一盏冷补 + 一道轮廓光 + 车灯暖光 ── */
const key = new THREE.DirectionalLight('#efe4d2', 3.05);
key.position.set(-8.5, 11.0, 11.0);
key.target.position.set(-0.4, 0.7, -9);
key.castShadow = true;
key.shadow.mapSize.set(2048, 2048);
key.shadow.camera.near = 1;
key.shadow.camera.far = 52;
key.shadow.camera.left = -16;
key.shadow.camera.right = 16;
key.shadow.camera.top = 11;
key.shadow.camera.bottom = -6;
key.shadow.bias = -0.0006;
key.shadow.normalBias = 0.02;
scene.add(key, key.target);

const fill = new THREE.DirectionalLight('#8fa9c0', 0.85);
fill.position.set(10, 5.2, 7);
scene.add(fill);

const rim = new THREE.DirectionalLight('#a3bacb', 0.55);
rim.position.set(-2, 4.6, -22);
scene.add(rim);

/* 远景弱洗光：让第 5、6 排在雾里仍有轮廓，而不是全黑 */
const backWash = new THREE.PointLight('#8ea6b6', 40, 46, 2);
backWash.position.set(0, 5.4, -19);
scene.add(backWash);

/* 环境补光：半球光只抬暗部，不参与高光，避免"平" */
const hemi = new THREE.HemisphereLight('#7e94a6', '#0a0d10', 0.55);
scene.add(hemi);
if(observation){
  key.intensity=3.4;
  fill.intensity=1.15;
  hemi.intensity=.82;
}

/* 车灯：暖点光落在车前地面上，配合两枚柔光晕 */
const heroLamp = new THREE.PointLight('#ffd9a4', 1.10, 5.0, 2);
heroLamp.position.set(-0.2, 0.72, -3.4);
scene.add(heroLamp);

/* ── 展台与接触阴影 ── */
const glassList = [];
const edgeList = [];
const lowList = [];
const shadowList = [];

const observationObjects = [
  {id:'field-target',cls:'vehicles',kind:requestedKind||'suv',x:1.7,z:1.25,ry:-.42,plinth:'low'},
  {id:'field-metro',cls:'signage',kind:'metroSign',x:-6.1,z:-3,ry:.14,plinth:'low'},
  {id:'field-fence',cls:'barriers',kind:'fence',x:-5.9,z:-5.5,ry:.92,plinth:'low'},
  {id:'field-rail',cls:'barriers',kind:'guardrail',x:-6.2,z:-10.2,ry:1.03,plinth:'low'},
  ...Array.from({length:4},(_,index)=>({id:'field-bike-'+index,cls:'vehicles',kind:'bicycle',x:-4.8+index*.74,z:-2.7-index*.57,ry:-.38,plinth:'low'})),
  {id:'field-sedan',cls:'vehicles',kind:'sedan',x:2.1,z:-6.3,ry:-.32,plinth:'low',scale:.89},
  {id:'field-suv',cls:'vehicles',kind:'suv',x:3.5,z:-11.2,ry:-.28,plinth:'low',scale:.78},
  {id:'field-sign',cls:'signage',kind:'gantry',x:2.3,z:-15.8,ry:.13,plinth:'low',scale:.62},
  {id:'field-cabinet',cls:'facility',kind:'cabinet',x:-3.4,z:.2,ry:.28,plinth:'low'}
];
const placedObjects=observation ? observationObjects.filter(object=>object.id!=='field-target'||requestedKind) : OBJECTS;

for (const o of observation ? [] : placedObjects) {
  const [fw, fd] = FOOT[o.kind] || [1, 1];
  const p = PLINTH[o.plinth] || PLINTH.low;
  if (o.plinth === 'glass') {
    const w = fw + p.inset, d = fd + p.inset;
    glassList.push({ w, h: p.h, d, x: o.x, z: o.z, base: p.base });
    edgeList.push({ w, d, x: o.x, z: o.z, y: p.base + p.h, h: p.h, base: p.base });
    lowList.push({ w: w - 0.03, h: p.base, d: d - 0.03, x: o.x, z: o.z });
  } else {
    lowList.push({ w: fw + p.inset, h: p.h, d: fd + p.inset, x: o.x, z: o.z });
  }
  shadowList.push({ w: fw + 1.5, d: fd + 1.5, x: o.x, z: o.z });
}

/* 玻璃：合并成一个几何体（1 次 draw），不用 transmission，靠环境反射出通透感 */
{
  const parts = [];
  for (const g of glassList) {
    const box = new THREE.BoxGeometry(g.w, g.h, g.d);
    box.translate(g.x, g.base + g.h / 2, g.z);
    parts.push(box);
  }
  const geo = mergeSimple(parts);
  const mat = new THREE.MeshPhysicalMaterial({
    color: '#5d6b70', metalness: 0.0, roughness: 0.20, transparent: true, opacity: 0.16,
    envMapIntensity: 0.55, side: THREE.DoubleSide, depthWrite: false,
    clearcoat: 0.30, clearcoatRoughness: 0.18
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.name = 'glass';
  mesh.renderOrder = 3;
  scene.add(mesh);

  /* 棱线：台面四边 + 四条竖棱。参考图里能一眼读出"亚克力罩"全靠这几道亮边。
     台面必须做成"空边框"——整块薄板会变成一张盖在展台上的浅灰卡片。 */
  const edges = [];
  for (const g of edgeList) {
    const x0 = g.x - g.w / 2, x1 = g.x + g.w / 2;
    const z0 = g.z - g.d / 2, z1 = g.z + g.d / 2;
    for (const pz of [z0, z1]) {
      const b = new THREE.BoxGeometry(g.w, 0.014, 0.012);
      b.translate(g.x, g.y, pz);
      edges.push(b);
    }
    for (const px of [x0, x1]) {
      const b = new THREE.BoxGeometry(0.012, 0.014, g.d);
      b.translate(px, g.y, g.z);
      edges.push(b);
    }
    for (const px of [x0, x1]) {
      for (const pz of [z0, z1]) {
        const v = new THREE.BoxGeometry(0.012, g.h, 0.012);
        v.translate(px, g.base + g.h / 2, pz);
        edges.push(v);
      }
    }
  }
  const em = new THREE.Mesh(mergeSimple(edges), new THREE.MeshBasicMaterial({
    color: '#d8e4e6', transparent: true, opacity: 0.38, depthWrite: false
  }));
  em.name = 'edges';
  em.renderOrder = 4;
  scene.add(em);
}

/* 低台座：合并成一个几何体 */
{
  const parts = [];
  for (const g of lowList) {
    const b = new THREE.BoxGeometry(g.w, g.h, g.d);
    b.translate(g.x, g.h / 2, g.z);
    parts.push(b);
  }
  const mesh = new THREE.Mesh(mergeSimple(parts), new THREE.MeshStandardMaterial({
    color: '#080a0c', metalness: 0.02, roughness: 0.88, envMapIntensity: 0.25
  }));
  mesh.receiveShadow = true;
  mesh.name = 'low';
  scene.add(mesh);
}

/* 接触阴影：一张柔化椭圆贴图，合并成一次 draw */
{
  const parts = [];
  for (const s of shadowList) {
    const g = new THREE.PlaneGeometry(s.w, s.d);
    g.rotateX(-Math.PI / 2);
    g.translate(s.x, 0.014, s.z);
    parts.push(g);
  }
  const mesh = new THREE.Mesh(mergeWithUV(parts), new THREE.MeshBasicMaterial({
    map: makeContactTexture(), transparent: true, opacity: 0.62, depthWrite: false, color: '#000000'
  }));
  mesh.renderOrder = 2;
  mesh.name = 'shadow';
  scene.add(mesh);
}

/* ── 物体 ── */
const items = [];
const objectGroup = new THREE.Group();
scene.add(objectGroup);
const archiveVehicles = observation ? universeModels(THREE) : null;
const newVehicleKinds = new Set(['van','mpv']);

function observationGeometry(kind) {
  if(!newVehicleKinds.has(kind)) return geometryFor(kind);
  const record={labelEn:kind.toUpperCase(),category:'vehicle'};
  return spaceVehicleGeometry({...record,annotation:record},kind);
}

function spaceVehicleGeometry(record,kind) {
  const geometry=archiveVehicles.get(record).geometry;
  if(!geometry) return geometryFor(kind);
  const shape=geometry.clone();
  shape.rotateY(-Math.PI/2);
  const scale=(FOOT[kind]?.[0]??4.65)/2.4;
  shape.scale(scale,scale,scale);
  shape.computeBoundingBox();
  shape.translate(0,-shape.boundingBox.min.y,0);
  shape.computeBoundingBox();
  return shape;
}

for (const o of placedObjects) {
  const spec = MATERIAL_SPEC[o.kind] || { metalness: 0.5, roughness: 0.5, env: 1.1 };
  const mat = new THREE.MeshStandardMaterial({
    vertexColors: true,
    metalness: spec.metalness,
    roughness: spec.roughness,
    envMapIntensity: spec.env
  });
  const mesh = new THREE.Mesh(observationGeometry(o.kind), mat);
  const p = PLINTH[o.plinth] || PLINTH.low;
  const lift = observation ? 0 : o.plinth === 'glass' ? p.base + p.h : p.h;
  mesh.position.set(o.x, lift, o.z);
  mesh.rotation.y = o.ry || 0;
  mesh.castShadow = true;
  if (o.scale) mesh.scale.setScalar(o.scale);
  mesh.userData.id = o.id;
  objectGroup.add(mesh);
  items.push({ o, mesh, mat, lift });
}

/* 湿地面倒影：把物体镜像到 y<0，用不受光的暗色材质，透过半透明地面读出来。
   受光材质会把镜像照成"白板"，所以这里必须用 MeshBasicMaterial。
   负 Y 缩放会把三角形绕序翻过来，必须 DoubleSide，否则只画到箱体的内壁，
   地面上就会出现一片片无来源的浅灰平行四边形。 */
const reflMat = new THREE.MeshBasicMaterial({
  vertexColors: true, color: '#242424', transparent: true, opacity: 0.20,
  depthWrite: false, side: THREE.DoubleSide, fog: true
});
const reflGroup = new THREE.Group();
reflGroup.name = 'reflGroup';
reflGroup.visible = !observation;
scene.add(reflGroup);
for (const it of items) {
  const r = new THREE.Mesh(it.mesh.geometry, reflMat);
  r.name = 'refl';
  r.position.set(it.o.x, -it.lift, it.o.z);
  r.rotation.y = it.o.ry || 0;
  r.scale.set(1, -1, 1);
  if (it.o.scale) r.scale.multiplyScalar(it.o.scale);
  r.renderOrder = 0;
  r.userData.id = it.o.id;
  it.refl = r;
  reflGroup.add(r);
}

/* ── 柔光晕：车灯与售货机灯带（替代后期 bloom） ── */
if(!observation) {
  const glowTex = makeGlowTexture();
  const add = (x, y, z, size, color, opacity) => {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({
      map: glowTex, color, transparent: true, opacity, depthWrite: false,
      blending: THREE.AdditiveBlending, fog: false
    }));
    s.position.set(x, y, z);
    s.scale.set(size, size, 1);
    desc.add(s);
  };
  var desc = new THREE.Group();
  scene.add(desc);
  /* 主位车灯：两个小点 */
  add(-1.02, 0.62, -2.16, 0.95, '#ffd9a8', 0.40);
  add(0.62, 0.62, -2.16, 0.95, '#ffd9a8', 0.40);
  /* 售货机面板：一条冷白（跟随 A-04 前移后的位置） */
  add(3.4, 1.45, -4.20, 0.85, '#dbe6e6', 0.22);
  /* 远处冷色指示灯 */
  add(-9.5, 1.35, -42.9, 0.7, '#6f9fba', 0.35);
}

/* ── 普查记录：给每件物体配真实编号 ── */
function kindOf(label) {
 const kinds = [
  [/sedan|taxi/i, 'sedan'], [/suv/i, 'suv'], [/truck/i, 'truck'], [/coach/i, 'coach'], [/bus/i, 'bus'],
  [/\bmpv\b/i,'mpv'], [/\bvan\b/i,'van'], [/bicycle|bike/i,'bicycle'],
  [/LUMINAIRE|STREET ?LIGHT/i, 'streetlight'], [/CAMERA POLE/i, 'cameraPole'],
  [/GANTRY/i, 'gantry'], [/METRO SIGN/i, 'metroSign'], [/BANNER/i, 'banner'], [/SIGN/i, 'standSign'],
  [/BARRIER/i, 'jersey'], [/GUARDRAIL/i, 'guardrail'], [/FENCE/i, 'fence'],
  [/KERB/i, 'kerb'], [/MANHOLE|DRAIN/i, 'manhole'], [/LANE ?MARK/i, 'laneMark'], [/ARROW/i, 'arrow'],
  [/CONE/i, 'cone'], [/A\.?C\.? UNIT|AIR ?CON/i, 'acUnit'], [/CABINET/i, 'cabinet'],
  [/VENDING/i, 'vending'], [/BOILER|WATER HEATER/i, 'boiler'], [/OUTDOOR UNIT/i, 'acUnit']
 ];
  const s = String(label || '');
  for (const [re, kind] of kinds) if (re.test(s)) return kind;
  return null;
}

let records = [];
async function loadCensus() {
  try {
    const res = await fetch('data/census.json', { cache: 'no-cache' });
    if (!res.ok) return [];
    const json = await res.json();
    const rows = Array.isArray(json) ? json : (json.records || json.items || json.objects || []);
    return rows.filter(r => (r.category || r.class || '').toLowerCase() !== 'person');
  } catch { return []; }
}

/* 编号：优先分配带 SP-ST 前缀的正式登记号，其余按顺序补 */
function assignRecords() {
  const pool = records.slice().sort((a, b) => {
    const pa = /^SP-ST/.test(a.canonicalId || a.id || '') ? 0 : 1;
    const pb = /^SP-ST/.test(b.canonicalId || b.id || '') ? 0 : 1;
    return pa - pb;
  });
  const used = new Set();
  const selected=observation ? pool.find(record=>record.canonicalId===requestedRecord) : null;
  if(selected) used.add(selected);
  for (const it of items) {
    const kind = it.o.kind;
    const matches=r=>!used.has(r)&&kindOf(r.labelEn||r.annotation?.labelEn||r.label||r.name)===kind;
    let hit = observation&&it.o.id==='field-target' ? selected :
      pool.find(r=>r.sceneId===qs.get('camera')&&matches(r))||pool.find(matches);
    if (!observation&&!hit) hit = pool.find(r => !used.has(r) && kindOf(r.labelEn || r.label || r.name) === null && kind === 'sedan');
    if (hit) {
      used.add(hit);
      it.rec = hit;
      it.code = hit.canonicalId || hit.id || hit.code || 'SP-—';
      it.nameCn = hit.label || hit.name || hit.labelEn || CLASS_META[it.o.cls].cn;
      it.nameEn = (hit.labelEn || hit.label || '').toString().toUpperCase();
    } else {
      it.code = 'SP-PENDING';
      it.nameCn = '待编目';
      it.nameEn = CLASS_META[it.o.cls].en;
    }
  }
}

/* ── 选中与标签 ── */
const selBoxEl = document.getElementById('selBox');
const labelEl = document.getElementById('recLabel');
const recIdEl = document.getElementById('recId');
const recClassEl = document.getElementById('recClass');

let focused = qs.get('focus');
if (focused === null || focused === undefined) focused = HERO_ID;
if (focused === 'none') focused = null;
if (observation) focused = requestedKind ? 'field-target' : null;
const observationRecord=document.getElementById('observationRecord');
const vehicleInspection=document.getElementById('vehicleInspection');
const inspectionHost=vehicleInspection.querySelector('.vehicle-inspection-stage');
const inspectionStatus=vehicleInspection.querySelector('[role="status"]');
const inspectButton=document.getElementById('inspectVehicle');
let inspection, inspectionVersion=0;

function asVehicle(record){
  return {...record,labelEn:record.labelEn||record.annotation?.labelEn||'SEDAN',
    annotation:record.annotation||{category:'vehicle',labelEn:record.labelEn||'SEDAN'}};
}

async function openVehicleInspection(record){
  const version=++inspectionVersion;
  vehicleInspection.querySelector('h2').textContent=record.label;
  vehicleInspection.querySelector('small').textContent=record.canonicalId;
  inspectionStatus.textContent='正在加载车辆模型…';
  vehicleInspection.querySelectorAll('[data-adjust]').forEach(button=>{button.disabled=true;});
  vehicleInspection.showModal();
  try {
    const {mountInspection}=await import('../integration/residue-models.js');
    if(!vehicleInspection.open||version!==inspectionVersion) return;
    inspection=mountInspection(inspectionHost,asVehicle(record));
    inspectionStatus.textContent='';
    vehicleInspection.querySelectorAll('[data-adjust]').forEach(button=>{button.disabled=false;});
  } catch(error){
    inspectionStatus.textContent='模型暂时无法显示，可以返回物件空间查看取证图。';
    console.warn('[VEHICLE INSPECTION]',error);
  }
}

vehicleInspection.querySelector('footer').addEventListener('click',event=>{
  const action=event.target.closest('[data-adjust]')?.dataset.adjust;
  if(action) inspection?.adjust(action);
});
vehicleInspection.addEventListener('close',()=>{
  inspectionVersion++;
  inspection?.dispose();
  inspection=null;
  inspectButton.focus({preventScroll:true});
  needsFrame();
});

function showObservationRecord(record,item) {
  if(!observation||!record) return;
  const img=observationRecord.querySelector('img');
  const caption=observationRecord.querySelector('small');
  const title=observationRecord.querySelector('strong');
  const detail=observationRecord.querySelector('p');
  const archive=document.getElementById('openObservationArchive');
  observationRecord.hidden=false;
  img.hidden=!record.thumb;
  if(record.thumb) img.src=record.thumb;
  caption.textContent=record.canonicalId;
  title.textContent=record.label;
  detail.textContent=item?'同类结构示意 · 现场以取证帧为准':'原始取证帧 · 暂无对应模型';
  archive.onclick=()=>parent.postMessage({type:'sp:space-archive',id:record.canonicalId},location.origin);
  inspectButton.hidden=record.category!=='vehicle';
  inspectButton.onclick=()=>openVehicleInspection(record);
}

const _box = new THREE.Box3();
const _v = new THREE.Vector3();
const _corners = [];
for (let i = 0; i < 8; i++) _corners.push(new THREE.Vector3());

function computeBounds(mesh) {
  const geo = mesh.geometry;
  if (!geo.boundingBox) geo.computeBoundingBox();
  const b = geo.boundingBox;
  const m = mesh.matrixWorld;
  _box.makeEmpty();
  let k = 0;
  for (const sx of [b.min.x, b.max.x]) for (const sy of [b.min.y, b.max.y]) for (const sz of [b.min.z, b.max.z]) {
    _corners[k].set(sx, sy, sz).applyMatrix4(m);
    k++;
  }
  return _corners;
}

function updateOverlay() {
  const it = items.find(i => i.o.id === focused);
  if (!it) { selBoxEl.style.opacity = 0; labelEl.style.opacity = 0; return; }
  const pts = computeBounds(it.mesh);
  let minX = 1e9, minY = 1e9, maxX = -1e9, maxY = -1e9;
  for (const p of pts) {
    _v.copy(p).project(camera);
    const x = (_v.x * 0.5 + 0.5) * window.innerWidth;
    const y = (-_v.y * 0.5 + 0.5) * window.innerHeight;
    minX = Math.min(minX, x); maxX = Math.max(maxX, x);
    minY = Math.min(minY, y); maxY = Math.max(maxY, y);
  }
  const pad = 10;
  selBoxEl.style.left = (minX - pad) + 'px';
  selBoxEl.style.top = (minY - pad) + 'px';
  selBoxEl.style.width = (maxX - minX + pad * 2) + 'px';
  selBoxEl.style.height = (maxY - minY + pad * 2) + 'px';
  selBoxEl.style.opacity = 1;
  recIdEl.textContent = 'ID ' + (it.code || '—');
  recClassEl.textContent = (it.nameCn || CLASS_META[it.o.cls].cn);
  labelEl.style.left = ((minX + maxX) / 2) + 'px';
  labelEl.style.top = (maxY + pad + 12) + 'px';
  const showLabel = qs.get('labels') !== '0';
  labelEl.style.opacity = showLabel ? 1 : 0;
}

/* ── 筛选（左侧类别 + 右上检索） ── */
let catFilter = qs.get('cat') || 'all';
let textFilter = (qs.get('q') || '').trim().toLowerCase();

function applyFilter() {
  for (const it of items) {
    const catOk = catFilter === 'all' || it.o.cls === catFilter;
    const textOk = !textFilter || (it.code + ' ' + (it.nameCn || '') + ' ' + (it.nameEn || '')).toLowerCase().includes(textFilter);
    const on = catOk && textOk;
    it.mat.color.setScalar(on ? 1 : 0.12);
    if (it.refl) it.refl.visible = on;
  }
  document.querySelectorAll('.cat').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.cat === catFilter);
  });
}

/* ── 交互 ── */
const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();
let downX = 0, downY = 0, dragging = false;
let yawOff = 0, pitchOff = 0, lastInteract = 0;

function pick(x, y) {
  pointer.set((x / window.innerWidth) * 2 - 1, -(y / window.innerHeight) * 2 + 1);
  raycaster.setFromCamera(pointer, camera);
  const hits = raycaster.intersectObjects(objectGroup.children, false);
  return hits.length ? hits[0].object.userData.id : null;
}

canvas.addEventListener('pointerdown', e => {
  downX = e.clientX; downY = e.clientY; dragging = true;
  canvas.setPointerCapture(e.pointerId);
});
canvas.addEventListener('pointermove', e => {
  if (!dragging) return;
  const dx = e.clientX - downX, dy = e.clientY - downY;
  if (Math.abs(dx) + Math.abs(dy) < 4) return;
  yawOff = THREE.MathUtils.clamp(dx * 0.0016, -0.075, 0.075);
  pitchOff = THREE.MathUtils.clamp(-dy * 0.0012, -0.05, 0.05);
  lastInteract = performance.now();
  needsFrame();
});
canvas.addEventListener('pointerup', e => {
  dragging = false;
  const moved = Math.abs(e.clientX - downX) + Math.abs(e.clientY - downY);
  if (moved < 5) {
    const id = pick(e.clientX, e.clientY);
    if (id) {
      focused = id;
      const it=items.find(item=>item.o.id===id);
      showObservationRecord(it?.rec,it);
      updateOverlay();
      needsFrame();
    }
  }
});

document.addEventListener('keydown', e => {
  if(vehicleInspection.open) return;
  if(observation&&e.key==='Escape'){parent.postMessage({type:'sp:space-close'},location.origin);return;}
  if (e.key === 'Escape') { focused = null; updateOverlay(); needsFrame(); }
});

document.querySelectorAll('.cat').forEach(btn => {
  btn.addEventListener('click', () => {
    catFilter = btn.dataset.cat;
    applyFilter();
    needsFrame();
  });
});

const searchInput = document.getElementById('searchInput');
if (searchInput) {
  if (textFilter) searchInput.value = textFilter;
  searchInput.addEventListener('input', () => {
    textFilter = searchInput.value.trim().toLowerCase();
    applyFilter();
    needsFrame();
  });
}

/* ── 相机微调（拖动带来的轻微视差，不改变构图） ── */
const basePos = new THREE.Vector3(...CAM.pos);
const baseLook = new THREE.Vector3(...CAM.target);
const orbitPivot = new THREE.Vector3(CAM.target[0], 1.1, CAM.target[2]);

function updateCamera() {
  const p = basePos.clone();
  const dir = p.clone().sub(orbitPivot);
  dir.applyAxisAngle(new THREE.Vector3(0, 1, 0), yawOff);
  const right = new THREE.Vector3().crossVectors(new THREE.Vector3(0, 1, 0), dir).normalize();
  dir.applyAxisAngle(right, pitchOff);
  p.copy(orbitPivot).add(dir);
  camera.position.copy(p);
  camera.lookAt(orbitPivot.x, baseLook.y + Math.sin(pitchOff) * 2.0, baseLook.z);
}

/* ── 主循环：闲置降帧 ── */
let rafId = 0;
let lastRender = 0;
let fps = 0, fpsAcc = 0, fpsCount = 0, fpsLast = performance.now();

function loop(now) {
  rafId = requestAnimationFrame(loop);
  if(vehicleInspection.open) return;
  const idle = now - lastInteract > 1200;
  if (idle && now - lastRender < 110) return;

  lastRender = now;
  updateCamera();
  renderer.render(scene, camera);
  updateOverlay();

  fpsAcc += now - fpsLast; fpsCount++; fpsLast = now;
  if (fpsAcc > 500) { fps = Math.round(1000 / (fpsAcc / fpsCount)); fpsAcc = 0; fpsCount = 0; }

  const debug = debugEl;
  if (debug && document.body.classList.contains('debug')) {
    const info = renderer.info.render;
    debug.textContent =
      'objects   ' + items.length + '\n' +
      'drawcalls ' + info.calls + '\n' +
      'triangles ' + info.triangles + '\n' +
      'fps       ' + fps + '\n' +
      'focus     ' + (focused || '—');
  }
}

const debugEl = document.getElementById('debug');

function needsFrame() {
  lastInteract = performance.now();
}

(async function boot() {
  records = await loadCensus();
  assignRecords();
  if(observation){
    const record=records.find(entry=>entry.canonicalId===requestedRecord);
    const item=items.find(entry=>entry.o.id===focused);
    if(item&&record?.category==='vehicle'&&!newVehicleKinds.has(item.o.kind)){
      const geometry=spaceVehicleGeometry(asVehicle(record),item.o.kind);
      item.mesh.geometry=geometry;
      item.refl.geometry=geometry;
      item.mesh.userData.geometrySource='archive-vehicle';
    }
    showObservationRecord(record,item);
  }
  const totalEl = document.getElementById('totalCount');
  /* 参考图的 TOTAL 是"档案总藏量"的概念值（18,432），不是本届样本条数；
     本届实际条数留在 stats().sampled 里，避免用样本数冒充总量。 */
  if (totalEl) totalEl.textContent = '18,432';

  applyFilter();
  updateOverlay();
  renderer.render(scene, camera);
  document.getElementById('boot').classList.add('gone');
  document.body.classList.add('ready');
  if (qs.get('debug') === '1') document.body.classList.add('debug');
  if (qs.get('hint') === '0') document.getElementById('hint').classList.add('gone');
  else setTimeout(() => document.getElementById('hint').classList.add('gone'), 9000);

  window.__space = {
    ready: true,
    stats: () => ({
      objects: items.length,
      drawCalls: renderer.info.render.calls,
      triangles: renderer.info.render.triangles,
      fps,
      focused,
      sampled: records.length,
      codes: items.map(i => i.code)
    })
  };


  lastInteract = performance.now();
  requestAnimationFrame(loop);
})();

/* ── 几何合并小工具（保留 UV / 只取位置法线） ── */
function mergeSimple(geos) {
  let vCount = 0;
  for (const g of geos) vCount += g.attributes.position.count;
  const pos = new Float32Array(vCount * 3);
  const nor = new Float32Array(vCount * 3);
  let o = 0;
  for (const g of geos) {
    const p = g.attributes.position.array, n = g.attributes.normal.array;
    pos.set(p, o); nor.set(n, o);
    o += p.length;
    g.dispose();
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  geo.computeBoundingBox();
  geo.computeBoundingSphere();
  return geo;
}

function mergeWithUV(geos) {
  let vCount = 0;
  for (const g of geos) vCount += g.attributes.position.count;
  const pos = new Float32Array(vCount * 3);
  const nor = new Float32Array(vCount * 3);
  const uv = new Float32Array(vCount * 2);
  let o = 0, u = 0;
  for (const g of geos) {
    const p = g.attributes.position.array, n = g.attributes.normal.array, t = g.attributes.uv.array;
    pos.set(p, o); nor.set(n, o); uv.set(t, u);
    o += p.length; u += t.length;
    g.dispose();
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  geo.computeBoundingBox();
  geo.computeBoundingSphere();
  return geo;
}
