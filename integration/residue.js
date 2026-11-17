const census = window.Census;
const viewport = document.getElementById('viewport');
const video = document.getElementById('cam');
const trackLayer = document.getElementById('trackLayer');
const monitorChrome = [...document.querySelectorAll('.topbar, .layout, .tickerbar')];
const reduced = matchMedia('(prefers-reduced-motion: reduce)');
const clamp = (value,min,max) => Math.max(min,Math.min(max,value));
const transitionDuration = 12000;
const subjectReady = .36;
const firstArrival = .43;
const ease = value => {
  const t=clamp(value,0,1);
  return t*t*(3-2*t);
};
const phase = (progress,start,end) => ease((progress-start)/(end-start));

// Bounds are normalized to the supplied artwork. Supplemental props have no source archive.
const cameras = {
  street1: {objects:[
    [1,'地铁导向牌',.087,.198,.044,.427],[10,'路侧护栏',.06,.384,.275,.225],
    [null,'共享单车',.161,.474,.211,.195,'bike'],[15,'电单车',.371,.389,.056,.117,'moped'],
    [11,'深色 SUV',.469,.574,.173,.255],[20,'后方轿车',.466,.365,.09,.119],
    [null,'远处深色 SUV',.564,.309,.055,.072,'suv'],[null,'最远处轿车',.637,.275,.039,.042,'sedan'],
    [12,'银色轿车',.812,.448,.112,.163],[2,'高架路牌',.565,.115,.186,.131],
    [3,'监控立杆',.75,.116,.078,.408],[6,'路灯',.827,.104,.088,.335],
    [5,'弧形护栏',.79,.319,.154,.149],[4,'防撞桶',.734,.451,.045,.1],
  ]},
  street2: {objects:[
    [1,'深色轿车',.246,.445,.211,.278],[16,'双臂路灯',.103,.138,.157,.76,'twin'],
    [17,'蓝色导向牌',.611,.256,.035,.17],[18,'中央隔离墩',.313,.217,.686,.542,'concrete','angled'],
    [19,'路缘石',.043,.579,.058,.155],[9,'远处轿车',.676,.315,.111,.094],
    [10,'白色面包车',.837,.371,.143,.154],[null,'蓝色 LED 大屏',.395,.084,.244,.12,'screen'],
    [null,'竖向 LED 灯带',.273,.016,.105,.175,'led'],[null,'共享单车',.026,.306,.082,.087,'bike'],
    [null,'路口导向牌',.028,.246,.036,.062,'parking'],[null,'高架路牌与摄像头',.663,.098,.17,.284,'gantry'],
    [null,'左后方轿车',.149,.326,.062,.075,'sedan'],[null,'远端轿车',.223,.259,.051,.056,'sedan'],
  ]},
  street3: {objects:[
    [3,'共享单车排',.015,.619,.29,.346,'bike'],[1,'左侧路灯',.108,.104,.127,.588],
    [7,'前向电单车',.294,.495,.06,.162,'moped'],[8,'后向电单车',.483,.495,.067,.183,'moped'],
    [11,'白色面包车',.19,.247,.096,.182],[13,'深色轿车',.352,.242,.104,.147],
    [12,'远端客车',.42,.055,.092,.161],[10,'城市公交',.514,.106,.116,.19],
    [5,'弯曲路缘',.678,.291,.32,.322,null,'curve'],[2,'红色路旗',.852,.112,.091,.417],
    [null,'后方 LED 灯箱',.324,.059,.077,.071,'screen'],[null,'悬挂灯箱',.63,.044,.057,.123,'led'],
    [null,'左侧灯箱',.126,.304,.035,.143,'led'],[null,'右后方路灯',.741,.098,.03,.14,'twin'],
    [null,'右侧导向牌',.786,.22,.042,.28,'parking'],
  ]},
  street4: {objects:[
    [20,'客车',.044,.144,.324,.29],[13,'出租车',.282,.407,.185,.201],
    [5,'白色面包车',.446,.302,.223,.238],[6,'白色轿车',.5,.522,.243,.211],
    [12,'黑色 SUV',.662,.632,.302,.297],[3,'路缘石',.842,.444,.079,.053],
    [null,'共享单车排',.079,.417,.181,.165,'bike'],[null,'电单车',.191,.602,.092,.165,'moped'],
    [null,'停车导向牌',.686,.228,.04,.207,'parking'],[null,'低位 LED 信息屏',.75,.314,.093,.148,'screen'],
  ]},
};

// One readable subject per midpoint. Source bounds are checked against the actual footage.
const subjects = {
  street1: ['ST1-0017',[.710,.355,.142,.209],[.477,.590,.156,.228]],
  street2: ['ST2-0006',[.520,.501,.124,.121],[.251,.451,.203,.263]],
  street3: ['ST3-0002',[.880,.272,.062,.160],[.907,.134,.034,.183]],
  street4: ['ST4-0013',[.210,.299,.273,.246],[.285,.414,.178,.184]]
};
const boxFrom = ([x,y,w,h]) => ({x,y,w,h});

const depthProps = {
  street1: [['signal',.19,.18,.047],['cabinet',.38,.30,.039],['hydrant',.67,.46,.034],['cart',.30,.74,.075],['signal',.91,.68,.117],['cabinet',.05,.72,.112],['hydrant',.76,.86,.064]],
  street2: [['signal',.06,.11,.043],['cabinet',.29,.18,.038],['cart',.47,.22,.051],['hydrant',.88,.25,.045],['cabinet',.55,.73,.105],['signal',.86,.65,.122],['cart',.12,.80,.102]],
  street3: [['signal',.26,.075,.043],['cabinet',.57,.087,.037],['hydrant',.70,.36,.042],['cart',.36,.49,.062],['signal',.68,.62,.116],['cabinet',.88,.72,.122],['hydrant',.42,.81,.079]],
  street4: [['signal',.10,.062,.041],['cabinet',.42,.17,.047],['cart',.84,.21,.06],['hydrant',.63,.39,.036],['signal',.04,.62,.10],['cabinet',.42,.77,.098],['cart',.23,.83,.098]]
};

const skyline = [
  ['signal',.04,.13,.025],['cart',.12,.27,.037],['hydrant',.20,.15,.023],
  ['cabinet',.31,.21,.032],['signal',.39,.10,.034],['cart',.48,.15,.033],
  ['cabinet',.55,.23,.031],['signal',.64,.13,.027],['hydrant',.72,.20,.027],
  ['cart',.81,.12,.040],['signal',.94,.17,.033]
];
const foreground = [
  ['signal',-.027,.51,.145],['cabinet',.075,.83,.117],
  ['hydrant',.155,.73,.065],['cart',.24,.87,.12],
  ['cabinet',.43,.82,.096],['hydrant',.54,.91,.084],
  ['cart',.70,.83,.107],['signal',.88,.51,.16],
  ['cabinet',.93,.81,.119]
];

const space = document.createElement('section');
space.className = 'residue-space';
space.setAttribute('aria-label','第二人口空间');
space.style.setProperty('--assembly-duration',transitionDuration+'ms');
space.tabIndex = -1;
space.hidden = true;
space.innerHTML = `
  <div class="residue-window"><div class="residue-world">
    <img class="residue-art" alt="" draggable="false">
    <div class="residue-depth" aria-hidden="true"></div>
    <div class="residue-points" aria-label="人造物"></div>
    <div class="library-arrivals" aria-label="其他机位的人造物"></div>
  </div>
    <canvas class="residue-transition" hidden aria-hidden="true"></canvas>
  </div>
  <button type="button" class="residue-skip" data-action="skip-assembly">跳过转场 ↗</button>
  <aside class="object-library" aria-label="人造物库" hidden>
    <header><div><small>第二人口</small><h2>人造物库</h2></div><button type="button" data-action="library-toggle" aria-expanded="false" aria-controls="libraryBrowser">展开</button></header>
    <div id="libraryBrowser" hidden>
      <nav aria-label="按来源筛选"></nav>
      <p class="library-caption" aria-live="polite"></p>
      <div class="library-records"></div>
    </div>
  </aside>
  <div class="residue-controls">
    <button type="button" data-action="far" aria-label="拉远">−</button>
    <output aria-label="观察倍率">1.00×</output>
    <button type="button" data-action="near" aria-label="推进">+</button>
    <button type="button" data-action="unlock" hidden>取消锁定</button>
    <button type="button" data-action="selected-archive" hidden>查看所选档案 ↗</button>
    <button type="button" data-action="exit">返回监控</button>
  </div>
`;
document.body.append(space);
const art = space.querySelector('.residue-art');
const depth = space.querySelector('.residue-depth');
const stage = space.querySelector('.residue-window');
const world = space.querySelector('.residue-world');
const points = space.querySelector('.residue-points');
const arrivals = space.querySelector('.library-arrivals');
const library = space.querySelector('.object-library');
const browser = library.querySelector('#libraryBrowser');
const filters = library.querySelector('nav');
const records = library.querySelector('.library-records');
const transition = space.querySelector('canvas');
const scaleReadout = space.querySelector('output');
const unlockButton = space.querySelector('[data-action="unlock"]');
const artArchive = document.createElement('dialog');
artArchive.className = 'residue-art-archive';
artArchive.setAttribute('aria-labelledby','residue-archive-title');
artArchive.innerHTML = `
  <header><h2 id="residue-archive-title"></h2><form method="dialog"><button>返回空间 ×</button></form></header>
  <div class="residue-archive-image" role="img"></div>
  <p></p>
`;
document.body.append(artArchive);
const assets = new Map();
let sceneId, snapshot, selected, entryRecord;
let libraryOrigin, libraryFilter, libraryEntries=[], localPoints=[];
let occupied=[];
let mode = 'monitor';
let epoch = 0;
let zoom = 1;
let pan = {x:.5,y:.5};
let drag;
let skipAssembly=false;

function loadArt(key) {
  if (!assets.has(key)) {
    const image = new Image();
    image.src = new URL('../assets/residue/CAM0' + key.at(-1) + '.png',import.meta.url).href;
    assets.set(key,image.decode().then(()=>image).catch(error=>{assets.delete(key);throw error;}));
  }
  return assets.get(key);
}

function updateView() {
  const w = stage.clientWidth, h = stage.clientHeight;
  const x = clamp((.5-pan.x*zoom)*w,(1-zoom)*w,0);
  const y = clamp((.5-pan.y*zoom)*h,(1-zoom)*h,0);
  world.style.transform = `translate(${x}px,${y}px) scale(${zoom})`;
  scaleReadout.value = zoom.toFixed(2) + '×';
}

function lock(point,zoomIn=true) {
  selected?.button.classList.remove('locked');
  selected?.button.setAttribute('aria-pressed','false');
  selected?.button.setAttribute('aria-label','锁定 '+selected.name);
  selected = point;
  point?.button.classList.add('locked');
  point?.button.setAttribute('aria-pressed','true');
  point?.button.setAttribute('aria-label','打开档案 '+point.name);
  points.classList.toggle('has-lock',Boolean(point));
  unlockButton.hidden = !point;
  pan = point&&zoomIn ? {x:point.x+point.w/2,y:point.y+point.h/2} : {x:.5,y:.5};
  zoom = point&&zoomIn ? clamp(.52/Math.max(point.w,point.h),1.48,2.55) : 1;
  updateView();
  for (const card of records.children) {
    card.setAttribute('aria-pressed',String(card.dataset.object===point?.record?.canonicalId));
  }
}

function objectRecord(key,id) {
  const record=id && census.get('SP-ST'+key.at(-1)+'-'+String(id).padStart(4,'0'));
  return record && record.category!=='person' ? record : null;
}

function buildPoints(key) {
  localPoints = cameras[key].objects.map(([id,name,x,y,w,h,,shape])=>{
    const record = objectRecord(key,id);
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'residue-point' + (shape ? ' '+shape : '');
    button.setAttribute('aria-label','锁定 '+name);
    button.setAttribute('aria-pressed','false');
    button.style.cssText = `left:${x*100}%;top:${y*100}%;width:${w*100}%;height:${h*100}%;--crop:url("${art.src}");--crop-size:${100/w}% ${100/h}%;--crop-position:${100*x/(1-w)}% ${100*y/(1-h)}%`;
    const tag = document.createElement('span');
    tag.textContent = name;
    button.append(tag);
    const point = {button,record,name,x,y,w,h};
    button.onclick = () => {
      if (mode!=='space') return;
      if (point===selected) void openArchive(point);
      else lock(point);
    };
    return point;
  });
  points.replaceChildren(...[...localPoints].sort((a,b)=>b.w*b.h-a.w*a.h).map(point=>point.button));
}

function renderLibrary() {
  for (const button of filters.children) button.setAttribute('aria-pressed',String(button.dataset.source===libraryFilter));
  const list=libraryEntries.filter(entry=>libraryFilter==='all' || entry.key===libraryFilter);
  library.querySelector('.library-caption').textContent=`${list.length} 件可查档案 · ${libraryFilter==='all'?'四路监控':cameraLabel(libraryFilter)}`;
  records.replaceChildren(...list.map(entry=>{
    const card=document.createElement('button');
    card.type='button';
    card.className='library-card';
    card.dataset.object=entry.record.canonicalId;
    card.setAttribute('aria-pressed',String(card.dataset.object===selected?.record?.canonicalId));
    const thumbnail=document.createElement('span');
    thumbnail.className='library-thumb';
    const {x,y,w,h}=entry;
    thumbnail.style.cssText=w
      ? `background-image:url("${entry.src}");background-size:${100/w}% ${100/h}%;background-position:${100*x/(1-w)}% ${100*y/(1-h)}%`
      : `background-image:url("${entry.record.thumb}");background-size:cover;background-position:center`;
    const label=document.createElement('strong');
    label.textContent=entry.name;
    const source=document.createElement('small');
    source.textContent=`${cameraLabel(entry.key)} · ${entry.record.sourceId}`;
    card.append(thumbnail,label,source);
    card.onclick=()=>{
      if (mode!=='space') return;
      if (entry.point && selected!==entry.point) lock(entry.point);
      else void openArchive(entry.point || entry);
    };
    return card;
  }));
}

const cameraLabel = key => 'CAM 0'+key.at(-1);

function slotIsClear(box,gap=.012) {
  if (box.x<.02 || box.y<.04 || box.x+box.w>.97 || box.y+box.h>.95) return false;
  return occupied.every(other=>box.x+box.w+gap<=other.x || other.x+other.w+gap<=box.x ||
    box.y+box.h+gap<=other.y || other.y+other.h+gap<=box.y);
}

async function showLibrary(origin, version) {
  const sources=await Promise.allSettled(Object.keys(cameras).map(async key=>({key,image:await loadArt(key)})));
  if (version!==epoch || libraryOrigin!==origin) return;
  const available=sources.flatMap(source=>source.status==='fulfilled'?[source.value]:[]);
  libraryFilter='all';
  libraryEntries=available.flatMap(({key,image})=>cameras[key].objects.flatMap(([id,name,x,y,w,h],index)=>{
    const record=objectRecord(key,id);
    return record ? [{key,src:image.src,name,x,y,w,h,record,point:key===origin?localPoints[index]:null}] : [];
  }));
  const represented=new Set(libraryEntries.map(entry=>entry.record.canonicalId));
  for (const record of census.records || []) {
    if (!cameras[record.sceneId] || represented.has(record.canonicalId) || record.category!=='vehicle' || !record.thumb) continue;
    libraryEntries.push({key:record.sceneId,name:record.label,record});
  }
  filters.replaceChildren(...['all',...available.map(({key})=>key)].map(key=>{
    const button=document.createElement('button');
    button.type='button';
    button.dataset.source=key;
    button.textContent=key==='all'?'全部':cameraLabel(key);
    button.onclick=()=>{libraryFilter=key;renderLibrary()};
    return button;
  }));
  renderLibrary();
  library.hidden=false;
  // Keep the supplied scene composition on entry; other cameras are available in the library.
  if (space.dataset.entry==='object') return;
  const incoming=available.filter(({key})=>key!==origin).flatMap(({key})=>
    libraryEntries.filter(entry=>entry.key===key && entry.w && entry.record.category==='vehicle').slice(0,3));
  const placed=[];
  for (const entry of incoming) {
    const bands=placed.length%2 ? [.68,.82,.54,.36,.22,.095] : [.22,.36,.095,.68,.82,.54];
    const columns=[.33,.60,.19,.75,.46,.085,.86,.035,.25,.40,.53,.67,.81,.90];
    const staggeredBands=[...bands,.13,.28,.47,.60,.75,.88];
    const options=staggeredBands.flatMap(y=>columns.map(x=>{
      const w=y>.57?.092:y>.3?.071:.055;
      return {x,y,w,h:w*entry.h/entry.w};
    }));
    const compact=options.map(({x,y,w,h})=>({x,y,w:w*.73,h:h*.73}));
    const box=[...options,...compact].find(candidate=>slotIsClear(candidate));
    if (!box) continue;
    occupied.push(box);
    const {x,y,w,h}=box;
    const index=placed.length;
    const button=document.createElement('button');
    button.type='button';
    button.className='library-arrival';
    button.style.cssText=`left:${x*100}%;top:${y*100}%;width:${w*100}%;height:${h*100}%;
      background-image:url("${entry.src}");background-size:${100/entry.w}% ${100/entry.h}%;
      background-position:${100*entry.x/(1-entry.w)}% ${100*entry.y/(1-entry.h)}%;
      --arrival-delay:${index*.29}s;--arrival-opacity:${y<.30?.46:y<.57?.62:.81};--arrival-blur:${y<.30?1.5:0}px`;
    button.setAttribute('aria-label',`${cameraLabel(entry.key)} ${entry.name}档案`);
    button.textContent=cameraLabel(entry.key);
    button.onclick=()=>{if(mode==='space') void openArchive(entry)};
    placed.push(button);
  }
  arrivals.replaceChildren(...placed);
}

function fitStage() {
  const w = space.clientWidth, h = space.clientHeight;
  const ratio = art.naturalWidth/art.naturalHeight || 16/9;
  stage.style.width = Math.min(w,h*ratio)+'px';
  stage.style.height = Math.min(h,w/ratio)+'px';
  updateView();
}
new ResizeObserver(fitStage).observe(space);

function footageBounds() {
  const rect = viewport.getBoundingClientRect();
  const ratio = video.videoWidth/video.videoHeight || 16/9;
  const fit = getComputedStyle(video).objectFit === 'cover' ? Math.max : Math.min;
  const width = fit(rect.width,rect.height*ratio);
  const height = fit(rect.height,rect.width/ratio);
  return {x:rect.left+rect.width/2,y:rect.top+rect.height/2,width,height};
}

function showSpace() {
  space.hidden=false;
  for (const element of monitorChrome) element.inert=true;
  document.body.classList.add('residue-fullscreen');
}

function captureVideo() {
  if (video.readyState<2 || !video.videoWidth) return null;
  const frame = document.createElement('canvas');
  frame.width=video.videoWidth;
  frame.height=video.videoHeight;
  frame.getContext('2d').drawImage(video,0,0);
  return frame;
}

function findFocus(key,record,bounds) {
  const [id,from,to]=subjects[key];
  const point=localPoints.find(item=>item.record?.canonicalId===record.canonicalId);
  const source=bounds||(record.sourceId===id?boxFrom(from):null);
  return {
    id:record.sourceId,from:source,
    to:point?{x:point.x,y:point.y,w:point.w,h:point.h}:record.sourceId===id?boxFrom(to):source,
    artwork:!!point||record.sourceId===id
  };
}

function drawSubject(ctx,image,source,target,width,height,opacity) {
  if (opacity<=0 || source.w<=0 || source.h<=0) return;
  const imageWidth=image.naturalWidth || image.width;
  const imageHeight=image.naturalHeight || image.height;
  ctx.globalAlpha=opacity;
  ctx.drawImage(image,source.x*imageWidth,source.y*imageHeight,
    source.w*imageWidth,source.h*imageHeight,
    target.x*width,target.y*height,target.w*width,target.h*height);
}

function drawLock(ctx,focus,width,height,opacity) {
  if (opacity<=0) return;
  const {x,y,w,h}=focus.box;
  const left=x*width,top=y*height,right=(x+w)*width,bottom=(y+h)*height;
  const corner=Math.min(16,w*width/4,h*height/4);
  ctx.globalAlpha=opacity;
  ctx.strokeStyle='#e1eef2';
  ctx.fillStyle='#e1eef2';
  ctx.lineWidth=1;
  ctx.beginPath();
  for (const [px,py,sx,sy] of [[left,top,1,1],[right,top,-1,1],[left,bottom,1,-1],[right,bottom,-1,-1]]) {
    ctx.moveTo(px+sx*corner,py);
    ctx.lineTo(px,py);
    ctx.lineTo(px,py+sy*corner);
  }
  ctx.stroke();
  ctx.font='11px monospace';
  ctx.fillText(focus.id,left,Math.max(12,top-7));
}

function prepareDepth(key) {
  occupied=cameras[key].objects.map(([,,x,y,w,h])=>({x,y,w,h}));
  // Reserve the upper corner for the collapsed catalogue.
  occupied.push({x:.83,y:0,w:.17,h:.13});
  const camera=Number(key.at(-1));
  const layout=[
    ...skyline.map(([kind,x,y,w],i)=>[kind,x+(camera-2.5)*.016,y+((i+camera)%3-1)*.026,w,.38,.80+i*.011]),
    ...depthProps[key].map(([kind,x,y,w],i)=>[kind,x,y,w,y>.6?.72:.50,.54+i*.047]),
    ...foreground.map(([kind,x,y,w],i)=>[kind,camera%2===0?1-x-w:x,y+(camera-2.5)*.014,w,.85,.68+i*.025]),
    ...[.30,.45,.60,.76].map((x,index)=>['cabinet',x,.84,.063,.74,.76+index*.025]),
    ...[.15,.38,.56,.72].map((x,index)=>['signal',x,.07,.025,.29,.85+index*.012])
  ];
  const shapeRatio={signal:170/130,cabinet:96/120,hydrant:101/95,cart:110/140};
  const placedByDepth={near:0,middle:0,far:0};
  const props=layout.flatMap(([kind,x,y,w,strength,arrival],index)=>{
    const h=w*shapeRatio[kind]*16/9;
    const box={x,y,w,h};
    const band=y>=.65?'near':y<.30?'far':'middle';
    const limit=band==='middle'?1:3;
    if (placedByDepth[band]>=limit || !slotIsClear(box,.023) || (strength>=.8 && w>.105)) return [];
    placedByDepth[band]++;
    occupied.push(box);
    const prop=document.createElement('img');
    prop.className='residue-depth-prop';
    prop.alt='';
    prop.src=new URL('../assets/residue/depth-'+kind+'.svg',import.meta.url).href;
    const mirror=index%3===0 ? -1 : 1;
    prop.style.cssText=`left:${x*100}%;top:${y*100}%;width:${w*100}%;transform:scaleX(${mirror});
      --strength:${strength};--softness:${(1-strength)*4.1}px;--arrival:${transitionDuration*arrival}ms`;
    return [prop];
  });
  depth.replaceChildren(...props);
}

function featheredTile(image,{x,y,w,h}) {
  const canvas=document.createElement('canvas');
  canvas.width=Math.max(1,Math.round(w*image.naturalWidth));
  canvas.height=Math.max(1,Math.round(h*image.naturalHeight));
  const ctx=canvas.getContext('2d');
  ctx.drawImage(image,x*image.naturalWidth,y*image.naturalHeight,canvas.width,canvas.height,0,0,canvas.width,canvas.height);
  ctx.globalCompositeOperation='destination-in';
  for (const [dx,dy] of [[canvas.width,0],[0,canvas.height]]) {
    const mask=ctx.createLinearGradient(0,0,dx,dy);
    mask.addColorStop(0,'transparent');
    mask.addColorStop(.045,'black');
    mask.addColorStop(.955,'black');
    mask.addColorStop(1,'transparent');
    ctx.fillStyle=mask;
    ctx.fillRect(0,0,canvas.width,canvas.height);
  }
  return canvas;
}

function dissolve(key, frame, image, people, focus, bounds, version) {
  if (!frame || reduced.matches) return Promise.resolve();
  const width = transition.width = Math.round(stage.clientWidth);
  const height = transition.height = Math.round(stage.clientHeight);
  if (!width || !height) return Promise.resolve();
  const ctx = transition.getContext('2d');
  if(!ctx)return Promise.resolve();
  const whole={x:0,y:0,w:1,h:1};
  const focusTile=focus.artwork?featheredTile(image,focus.to):null;
  const stageRect=stage.getBoundingClientRect();
  const footage={
    x:(bounds.x-bounds.width/2-stageRect.left)/width,
    y:(bounds.y-bounds.height/2-stageRect.top)/height,
    w:bounds.width/width,h:bounds.height/height
  };
  const inStage=({x,y,w,h})=>({
    x:footage.x+x*footage.w,y:footage.y+y*footage.h,w:w*footage.w,h:h*footage.h
  });
  const initial=focus.from?inStage(focus.from):null;
  const tiles=cameras[key].objects
    .map(([, ,x,y,w,h])=>({x,y,w,h}))
    .filter(box=>!focusTile||Math.abs(box.x-focus.to.x)+Math.abs(box.y-focus.to.y)>.035)
    .sort((a,b)=>a.x-b.x)
    .map((box,index,all)=>{
      const fraction=index/Math.max(1,all.length-1);
      const wave=fraction<.33 ? 0 : fraction<.66 ? .15 : .30;
      return {box,tile:featheredTile(image,box),start:firstArrival+wave+fraction*.15};
    });
  const start = performance.now();
  transition.hidden=false;
  return new Promise(resolve=>{
    function draw(now) {
      if (epoch!==version) {resolve();return;}
      const progress = skipAssembly?1:clamp((now-start)/transitionDuration,0,1);
      ctx.clearRect(0,0,width,height);
      const environment=phase(progress,.10,.29);
      ctx.filter=`saturate(${1-.84*phase(progress,0,.22)}) brightness(${1-.43*phase(progress,0,.24)})`;
      ctx.globalAlpha=1-environment;
      drawSubject(ctx,frame,whole,footage,width,height,1-environment);
      ctx.filter='none';
      if (progress>0 && environment<1 && people.length) {
        ctx.save();
        ctx.globalCompositeOperation='destination-out';
        ctx.globalAlpha=phase(progress,.07,.25);
        for (const person of people) {
          const {x,y,w,h}=inStage(person);
          ctx.save();
          ctx.translate((x+w/2)*width,(y+h/2)*height);
          ctx.scale(Math.max(1,w*width*.85),Math.max(1,h*height*.78));
          const edge=ctx.createRadialGradient(0,0,.62,0,0,1);
          edge.addColorStop(0,'#000');
          edge.addColorStop(1,'#0000');
          ctx.fillStyle=edge;
          ctx.fillRect(-1,-1,2,2);
          ctx.restore();
        }
        ctx.restore();
      }
      const movement=phase(progress,.085,subjectReady);
      const exchange=phase(progress,.11,.31);
      const box=initial?Object.fromEntries(['x','y','w','h'].map(axis=>
        [axis,initial[axis]+(focus.to[axis]-initial[axis])*(focusTile?movement:0)])):focus.to;
      const spotlight=phase(progress,0,.075);
      if(initial)drawSubject(ctx,frame,focus.from,box,width,height,spotlight*(1-exchange));
      const assembled=phase(progress,.96,1);
      ctx.filter=`saturate(.30) brightness(${1+.22*(1-phase(progress,.52,.76))})`;
      if(focusTile&&box)drawSubject(ctx,focusTile,whole,box,width,height,exchange*(1-assembled));
      ctx.filter='saturate(.30)';
      for (const {tile,box,start} of tiles) {
        drawSubject(ctx,tile,whole,box,width,height,phase(progress,start,start+.07)*(1-assembled));
      }
      ctx.filter='none';
      if(box)drawLock(ctx,{box,id:focus.id},width,height,spotlight*(1-phase(progress,.44,.64)));
      ctx.globalAlpha=1;
      if (progress<1) requestAnimationFrame(draw);
      else resolve();
    }
    draw(start);
  });
}

// Enter only from an explicit monitor selection.
window.ResidueSpace={
  open(id,{returnSnapshot}={}){
    const record=census.get(id), key=window.__activeScene?.();
    if(!record||record.sceneId!==key||!cameras[key]||record.category==='person'||
       /\b(TREE|HEDGE)\b/i.test(record.labelEn||'')) return false;
    if(mode!=='monitor') return true;
    if(!window.RenderLifecycle.stageVisible()) return false;
    void enterFromMonitor(key,record,returnSnapshot);
    return true;
  }
};

async function enterFromMonitor(key,record,returnSnapshot){
  const version=++epoch;
  sceneId=key;
  snapshot=returnSnapshot||window.Monitor.snapshot();
  entryRecord=record;
  mode='transition';
  skipAssembly=false;
  const frame=reduced.matches?null:captureVideo();
  const bounds=footageBounds();
  const boxes=window.Monitor.boxes().filter(({fit,present})=>present&&fit?.w>0&&fit?.h>0);
  const target=boxes.find(box=>box.id===record.sourceId)?.fit;
  const people=boxes.filter(box=>census.resolve(box.id,key)?.category==='person').map(box=>box.fit);
  video.pause();
  try {
    const image=await loadArt(key);
    if(version!==epoch) return;
    art.src=image.src;
    libraryOrigin=key;
    library.hidden=true;
    arrivals.replaceChildren();
    buildPoints(key);
    const animated=!!frame&&bounds.width>0&&bounds.height>0;
    if(animated){
      prepareDepth(key);
      space.classList.add('transitioning');
    }
    space.dataset.entry='object';
    const entryArchive=space.querySelector('[data-action="selected-archive"]');
    entryArchive.hidden=false;
    entryArchive.title=record.label+' · '+record.sourceId;
    browser.hidden=true;
    const toggle=library.querySelector('[data-action="library-toggle"]');
    toggle.textContent='展开';
    toggle.setAttribute('aria-expanded','false');
    showSpace();
    census.setState({view:'residue',selectedObjectId:record.canonicalId});
    window.RenderLifecycle.changed();
    lock(null);
    fitStage();
    if(animated)await dissolve(key,frame,image,people,findFocus(key,record,target),bounds,version);
    if(version!==epoch)return;
    transition.hidden=true;
    space.classList.remove('transitioning');
    lock(localPoints.find(point=>point.record?.canonicalId===record.canonicalId)||null,false);
    mode='space';
    void showLibrary(key,version);
    space.focus({preventScroll:true});
  } catch(error){
    if(version!==epoch) return;
    hideSpace();
    mode='monitor';
    await window.Monitor.restore(snapshot);
    console.warn('[OBJECT SPACE] Could not display the source artwork',error);
  }
}

function hideSpace() {
  space.hidden=true;
  transition.hidden=true;
  space.classList.remove('transitioning');
  document.body.classList.remove('residue-fullscreen');
  for (const element of monitorChrome) element.inert=false;
}

async function exit() {
  if (mode!=='space' && mode!=='transition') return;
  ++epoch;
  library.hidden=true;
  arrivals.replaceChildren();
  hideSpace();
  lock(null);
  mode='monitor';
  if (snapshot) {
    await window.Monitor.restore(snapshot);
  }
  document.getElementById('playBtn').focus({preventScroll:true});
}

artArchive.addEventListener('close',()=>{
  if (mode!=='art-archive') return;
  mode='space';
  selected?.button.focus({preventScroll:true});
});

async function openArchive(point) {
  const {record,name,button,w,h}=point;
  if (!record) {
    artArchive.querySelector('h2').textContent=name+' · 图像档案';
    artArchive.querySelector('p').textContent=cameraLabel(libraryOrigin || sceneId)+' · 来源为人造物空间图像';
    const image=artArchive.querySelector('.residue-archive-image');
    for (const property of ['--crop','--crop-size','--crop-position']) {
      image.style.setProperty(property,button.style.getPropertyValue(property));
    }
    image.style.setProperty('--crop-ratio',String(w*art.naturalWidth/(h*art.naturalHeight)));
    image.setAttribute('aria-label',name);
    artArchive.showModal();
    mode='art-archive';
    return;
  }
  mode='opening-archive';
  hideSpace();
  try {
    await window.__openCanonical(record.canonicalId,{
      seekTime:record.appear+.05,returnSnapshot:{...snapshot,paused:true}
    });
    if(census.state.view!=='archive'&&!document.getElementById('evidenceRecord')?.open) throw new Error('Archive did not open');
  } catch(error) {
    console.warn(error);
    restoreSpace();
    return;
  }
  mode='archive';
}

function restoreSpace() {
  mode='space';
  showSpace();
  census.setState({view:'residue'});
  window.RenderLifecycle.changed();
  fitStage();
  selected?.button.focus({preventScroll:true});
}

function setScene(key) {
  if (sceneId===key) return;
  if (mode==='space' || mode==='transition') {
    ++epoch;
    hideSpace();
    library.hidden=true;
    arrivals.replaceChildren();
    lock(null);
    mode='monitor';
    if(census.state.view==='residue') {
      census.setState({view:'monitor'});
      window.RenderLifecycle.changed();
    }
  }
  sceneId=key;
  if (cameras[key]) loadArt(key).catch(()=>{});
}

space.addEventListener('click',e=>{
  const action=e.target.closest('[data-action]')?.dataset.action;
  if(action==='skip-assembly'){skipAssembly=true;return;}
  if (action==='exit') exit();
  if (mode!=='space') return;
  if(action==='selected-archive'&&entryRecord) void openArchive(localPoints.find(point=>point.record?.canonicalId===entryRecord.canonicalId)||{record:entryRecord,name:entryRecord.label});
  if (action==='library-toggle') {
    browser.hidden=!browser.hidden;
    const button=e.target.closest('button');
    button.textContent=browser.hidden?'展开':'收起';
    button.setAttribute('aria-expanded',String(!browser.hidden));
  }
  if (action==='unlock') lock(null);
  if (action==='near' || action==='far') {
    zoom=clamp(zoom*(action==='near'?1.18:1/1.18),1,3.4);
    updateView();
  }
});
viewport.addEventListener('click',event=>{
  if(mode!=='monitor'||event.target.closest('.track-box,.monitor-video-label,button,a,input,[role="button"]'))return;
  if(!window.RenderLifecycle.stageVisible())return;
  const key=window.__activeScene?.();
  if(!cameras[key])return;
  const bounds=footageBounds();
  if(!bounds.width||!bounds.height)return;
  const x=(event.clientX-bounds.x)/bounds.width+.5;
  const y=(event.clientY-bounds.y)/bounds.height+.5;
  if(x<0||x>1||y<0||y>1)return;
  const candidates=window.Monitor.boxes().flatMap(box=>{
    if(!box.present||!box.fit)return [];
    const record=census.resolve(box.id,key);
    if(!record||record.category==='person'||/\b(TREE|HEDGE)\b/i.test(record.labelEn||''))return [];
    const {x:bx,y:by,w,h}=box.fit;
    return [{record,distance:Math.hypot(x-bx-w/2,y-by-h/2)}];
  });
  candidates.sort((a,b)=>a.distance-b.distance);
  const record=candidates[0]?.record;
  if(record)window.ResidueSpace.open(record.canonicalId);
});
stage.addEventListener('wheel',e=>{
  if(mode!=='space') return;
  e.preventDefault();
  zoom=clamp(zoom*Math.exp(e.deltaY*(e.deltaMode===1?.035:.00145)),1,3.4);
  updateView();
},{passive:false});
stage.addEventListener('pointerdown',e=>{
  if (mode!=='space' || e.button!==0 || e.target.closest('button')) return;
  drag={id:e.pointerId,x:e.clientX,y:e.clientY};
  stage.setPointerCapture(e.pointerId);
});
stage.addEventListener('pointermove',e=>{
  if(drag?.id!==e.pointerId || zoom===1) return;
  pan.x=clamp(pan.x-(e.clientX-drag.x)/(stage.clientWidth*zoom),.15,.85);
  pan.y=clamp(pan.y-(e.clientY-drag.y)/(stage.clientHeight*zoom),.15,.85);
  drag.x=e.clientX;drag.y=e.clientY;
  stage.classList.add('dragging');
  updateView();
});
stage.addEventListener('lostpointercapture',()=>{
  drag=null;
  stage.classList.remove('dragging');
});
census.events.addEventListener('scenechange',e=>setScene(e.detail.sceneId));
census.events.addEventListener('statechange',()=>{
  if(mode==='archive') queueMicrotask(()=>{
    if(mode==='archive' && census.state.view==='monitor' && document.getElementById('objArchive').hidden &&
       !document.getElementById('evidenceRecord')?.open) restoreSpace();
  });
});
document.addEventListener('keydown',e=>{
  if (e.key!=='Escape' || !['space','transition'].includes(mode)) return;
  e.preventDefault();
  e.stopImmediatePropagation();
  if (selected) lock(null); else exit();
},{capture:true});
document.getElementById('playBtn').addEventListener('click',async e=>{
  if (mode!=='space' && mode!=='transition') return;
  e.stopImmediatePropagation();
  await exit();
  video.play().catch(()=>{});
},{capture:true});
trackLayer.setAttribute('aria-live','off');
census.ready.then(()=>setScene(window.__activeScene?.() || census.state.camera));
