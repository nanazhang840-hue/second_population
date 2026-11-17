import * as THREE from './vendor/three-r170.module.js';
import {universeModels} from './universe-models.js';

let studio;
const cache = new Map();

function createStudio() {
  const renderer = new THREE.WebGLRenderer({alpha:true,antialias:true,preserveDrawingBuffer:true});
  renderer.setSize(448, 448, false);
  renderer.setClearColor(0x000000, 0);
  renderer.setPixelRatio(1);
  const scene = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(-2,2,2,-2,.1,40);
  camera.position.set(0,7.2,4.7);
  camera.lookAt(0,0,0);
  camera.updateMatrixWorld();
  scene.add(new THREE.HemisphereLight('#e9f0f2','#41545b',2.3));
  const light = new THREE.DirectionalLight('#f7f4e9',3.1);
  light.position.set(-4,7,2);
  scene.add(light);
  const rim = new THREE.DirectionalLight('#8daab7',1.6);
  rim.position.set(4,4,-5);
  scene.add(rim);
  return {renderer,scene,camera,library:universeModels(THREE)};
}

function simpleMesh(kind) {
  const g = new THREE.Group();
  const steel = new THREE.MeshStandardMaterial({color:'#a1a6a6',roughness:.75});
  const rubber = new THREE.MeshStandardMaterial({color:'#171b20',roughness:.85});
  const amber = new THREE.MeshStandardMaterial({color:'#aa813a'});
  function add(geometry, material, x, y, z) {
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(x,y,z);
    g.add(mesh);
    return mesh;
  }
  if (kind === 'concrete') {
    const section = new THREE.Shape();
    section.moveTo(-.45,0); section.lineTo(.45,0); section.lineTo(.23,.34);
    section.lineTo(.14,.73); section.lineTo(-.14,.73); section.lineTo(-.23,.34);
    section.closePath();
    for (let i=0;i<3;i++) add(new THREE.ExtrudeGeometry(section,{depth:1.15,bevelEnabled:false}),steel,0,0,1.22*i-1.8);
    g.rotation.y = Math.PI/2;
  } else if (kind === 'gantry') {
    add(new THREE.CylinderGeometry(.06,.075,2.55,16),steel,1.25,0,0);
    add(new THREE.BoxGeometry(2.65,.54,.15),steel,0,1.02,0);
    add(new THREE.BoxGeometry(2.65,.07,.07),rubber,0,1.02,.09);
    add(new THREE.BoxGeometry(.28,.15,.17),steel,1.13,1.34,.15);
  } else if (['screen','led','parking'].includes(kind)) {
    const glow = new THREE.MeshStandardMaterial({color:'#557ea0',emissive:'#254969',emissiveIntensity:.85});
    const width = kind === 'screen' ? 3.2 : kind === 'parking' ? .48 : .12;
    const height = kind === 'screen' ? .9 : kind === 'parking' ? 2.1 : 1.55;
    add(new THREE.BoxGeometry(width,height,.14),steel,0,0,0);
    add(new THREE.BoxGeometry(width*.85,height*.86,.035),glow,0,0,.078);
    if (kind === 'screen') for (const x of [-1.2,1.2]) add(new THREE.BoxGeometry(.11,.55,.13),rubber,x,-.65,0);
  } else if (kind === 'twin') {
    add(new THREE.CylinderGeometry(.048,.065,2.65,16),steel,0,1.32,0);
    add(new THREE.CylinderGeometry(.16,.19,.13,16),steel,0,.06,0);
    add(new THREE.BoxGeometry(2.25,.065,.08),steel,0,2.63,0);
    const lens = new THREE.MeshStandardMaterial({color:'#d4d1c2',emissive:'#dbbf80',emissiveIntensity:.85});
    for (const x of [-1.12,1.12]) {
      add(new THREE.BoxGeometry(.39,.10,.23),steel,x,2.64,0);
      add(new THREE.BoxGeometry(.28,.04,.17),lens,x,2.58,0);
    }
  } else if (kind === 'moped') {
    for (const x of [-.64,.64]) {
      add(new THREE.TorusGeometry(.24,.07,10,28),rubber,x,.28,0);
      add(new THREE.CylinderGeometry(.14,.14,.09,20),steel,x,.28,0).rotation.x=Math.PI/2;
    }
    add(new THREE.BoxGeometry(.81,.2,.34),steel,-.15,.39,0);
    add(new THREE.BoxGeometry(.56,.29,.33),steel,-.37,.58,0);
    add(new THREE.BoxGeometry(.48,.11,.31),rubber,-.39,.76,0);
    add(new THREE.BoxGeometry(.18,.68,.29),steel,.47,.65,0).rotation.z=.19;
    add(new THREE.BoxGeometry(.08,.06,.54),rubber,.42,1,0);
    const beam = new THREE.MeshStandardMaterial({color:'#d8e3e9',emissive:'#7d9ca9'});
    add(new THREE.BoxGeometry(.045,.09,.2),beam,.58,.85,0);
  } else if (kind === 'bike') {
    for (const x of [-.7,.7]) {
      add(new THREE.TorusGeometry(.32,.056,8,32),rubber,x,.36,0);
      add(new THREE.TorusGeometry(.266,.019,8,32),steel,x,.36,0);
    }
    const brace = (a,b) => {
      const first = new THREE.Vector3(...a), second = new THREE.Vector3(...b);
      const center = first.clone().lerp(second,.5);
      const mesh = add(new THREE.CylinderGeometry(.032,.032,first.distanceTo(second),10),steel,center.x,center.y,center.z);
      mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),second.sub(first).normalize());
    };
    brace([-.7,.36,0],[0,.39,0]); brace([0,.39,0],[.51,.91,0]);
    brace([.51,.91,0],[.7,.36,0]); brace([-.27,.72,0],[0,.39,0]);
    brace([-.7,.36,0],[-.27,.72,0]); brace([.51,.91,-.22],[.51,.91,.22]);
    add(new THREE.BoxGeometry(.3,.075,.17),rubber,-.31,.77,0);
    add(new THREE.BoxGeometry(.36,.13,.13),steel,-.12,.46,0);
  } else {
    add(new THREE.CylinderGeometry(.38,.42,.78,28),amber,0,.42,0);
    for (const y of [.10,.36,.65,.82]) add(new THREE.CylinderGeometry(.425,.425,.065,28),rubber,0,y,0);
  }
  return g;
}

export function mountInspection(host, record, variant) {
  const {renderer,scene,camera,library} = createStudio();
  host.append(renderer.domElement);
  renderer.domElement.setAttribute('aria-label', '可旋转的三维模型');
  if (variant==='suv' || variant==='sedan') {
    record={labelEn:variant.toUpperCase(),category:'vehicle',annotation:{labelEn:variant.toUpperCase(),category:'vehicle'}};
    variant=null;
  }
  const shared = variant ? null : library.get(record);
  const material = shared?.geometry && new THREE.MeshStandardMaterial({
    vertexColors:true,color:record?.labelEn==='TAXI'?'#d2ae64':'#bcc6ca',roughness:.56,side:THREE.DoubleSide
  });
  if (!variant && !material) {
    renderer.dispose(); renderer.forceContextLoss(); renderer.domElement.remove(); library.dispose();
    throw new Error('No inspection geometry');
  }
  const model = variant ? simpleMesh(variant) : new THREE.Mesh(shared.geometry,material);
  const group = new THREE.Group();
  group.add(model);
  const box = new THREE.Box3().setFromObject(model);
  model.position.sub(box.getCenter(new THREE.Vector3()));
  const extent = box.getSize(new THREE.Vector3()).length() || 1;
  group.scale.setScalar(2.75/extent);
  scene.add(group);
  let yaw=-.48, tilt=.28, zoom=1, drag=null;
  const canvas = renderer.domElement;
  const listeners = new AbortController();
  const options = {signal:listeners.signal};
  function draw() {
    const w=Math.max(1,host.clientWidth), h=Math.max(1,host.clientHeight);
    const ratio=w/h;
    renderer.setPixelRatio(Math.min(devicePixelRatio || 1,2));
    renderer.setSize(w,h,false);
    camera.left=-1.8*Math.max(1,ratio);
    camera.right=-camera.left;
    camera.top=1.8*Math.max(1,1/ratio);
    camera.bottom=-camera.top;
    camera.position.set(0, Math.sin(tilt)*8,Math.cos(tilt)*8);
    camera.lookAt(0,0,0);
    camera.zoom=zoom;
    camera.updateProjectionMatrix();
    group.rotation.y=yaw;
    renderer.render(scene,camera);
  }
  canvas.addEventListener('pointerdown',e=>{
    if (e.button!==0 || drag) return;
    drag={id:e.pointerId,x:e.clientX,y:e.clientY};
    canvas.setPointerCapture(e.pointerId);
  },options);
  canvas.addEventListener('pointermove',e=>{
    if (drag?.id!==e.pointerId) return;
    yaw+=(e.clientX-drag.x)*.009;
    tilt=Math.max(-.46,Math.min(1.36,tilt+(e.clientY-drag.y)*.008));
    drag.x=e.clientX; drag.y=e.clientY;
    draw();
  },options);
  canvas.addEventListener('lostpointercapture',()=>{drag=null;},options);
  host.addEventListener('wheel',e=>{
    e.preventDefault();
    zoom=Math.max(.72,Math.min(2.55,zoom*Math.exp(-e.deltaY*(e.deltaMode===1?.035:.0018))));
    draw();
  },{...options,passive:false});
  const observer = new ResizeObserver(draw);
  observer.observe(host);
  draw();
  return {
    adjust(action){
      if(action==='left') yaw-=.32;
      if(action==='right') yaw+=.32;
      if(action==='near') zoom=Math.min(2.55,zoom*1.18);
      if(action==='far') zoom=Math.max(.72,zoom/1.18);
      draw();
    },
    dispose(){
      listeners.abort(); observer.disconnect();
      if(variant){
        const materials=new Set();
        group.traverse(mesh=>{if(mesh.isMesh){mesh.geometry.dispose();materials.add(mesh.material);}});
        for(const mat of materials) mat.dispose();
      } else material.dispose();
      library.dispose(); renderer.dispose(); renderer.forceContextLoss(); canvas.remove();
    }
  };
}

export function overheadModel(record, yaw) {
  const key = record.canonicalId + ':' + yaw.toFixed(2);
  if (cache.has(key)) return cache.get(key);
  studio ||= createStudio();
  const {renderer,scene,camera,library} = studio;
  const label = record.labelEn;
  const street2 = record.sceneId === 'street2';
  const variant = /RIDER/.test(label) ? 'bike' : street2 && label === 'GUARDRAIL' ? 'concrete'
    : street2 && label === 'LUMINAIRE' ? 'twin' : label === 'BARRIER' ? 'barrel' : null;
  const spec = variant ? null : library.get(record);
  if (!variant && !spec?.geometry) return null;
  const paint = /TAXI/.test(label) ? '#c9a24f' : /白|银|WHITE/.test(record.label+' '+label) ? '#dce0df'
    : /红/.test(record.label) ? '#a46e66' : /黑|深色|BLACK/.test(record.label+' '+label) ? '#71808a' : '#b5c1c3';
  const material = spec && new THREE.MeshStandardMaterial({vertexColors:true,color:paint,side:THREE.DoubleSide,roughness:.53,metalness:.16});
  const group = new THREE.Group();
  group.add(variant ? simpleMesh(variant) : new THREE.Mesh(spec.geometry,material));
  group.rotation.y = yaw;
  scene.add(group);
  const box = new THREE.Box3().setFromObject(group);
  const center = box.getCenter(new THREE.Vector3());
  group.position.sub(center);
  box.translate(center.negate());
  const corners = [];
  for (const x of [box.min.x,box.max.x]) for (const y of [box.min.y,box.max.y]) for (const z of [box.min.z,box.max.z]) {
    corners.push(new THREE.Vector3(x,y,z).project(camera));
  }
  const extent = Math.max(...corners.map(p=>Math.max(Math.abs(p.x),Math.abs(p.y))));
  camera.zoom = .88 / extent;
  camera.updateProjectionMatrix();
  renderer.render(scene,camera);
  camera.zoom = 1;
  camera.updateProjectionMatrix();
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 448;
  const ctx = canvas.getContext('2d',{willReadFrequently:true});
  ctx.drawImage(renderer.domElement,0,0);
  const pixels = ctx.getImageData(0,0,448,448);
  let left=447, right=0, top=447, bottom=0;
  for (let y=0;y<448;y++) for (let x=0;x<448;x++) {
    if (pixels.data[(y*448+x)*4+3]<32) continue;
    left=Math.min(left,x); right=Math.max(right,x); top=Math.min(top,y); bottom=Math.max(bottom,y);
  }
  scene.remove(group);
  if (variant) {
    const materials = new Set();
    group.traverse(mesh=>{ if(mesh.isMesh){mesh.geometry.dispose();materials.add(mesh.material);} });
    for (const mat of materials) mat.dispose();
  } else material.dispose();
  if (right<=left || bottom<=top) return null;
  const cutout = document.createElement('canvas');
  cutout.width = right-left+13;
  cutout.height = bottom-top+13;
  cutout.getContext('2d').drawImage(canvas, left,top,right-left+1,bottom-top+1,6,6,right-left+1,bottom-top+1);
  cache.set(key, cutout);
  return cutout;
}
