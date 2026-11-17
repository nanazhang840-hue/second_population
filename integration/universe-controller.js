/* One universe renderer, one Census store, three reading levels. */
(function(){
 'use strict';if(new URLSearchParams(location.search).get('visual')==='web')return;
 const C=window.Census,host=document.getElementById('objectWeb'),video=document.getElementById('cam'),esc=window.ArchiveData.escape;
 let engine=null,starting=false,selected=null,inspectedGroup=null,monitorReturn=null,quietClose=false,cleanupAdapter=null,resolveReady,rejectReady,energyMap=new Map();
 const ready=new Promise((resolve,reject)=>{resolveReady=resolve;rejectReady=reject;});ready.catch(()=>{});
 const root=document.createElement('section');root.className='object-universe';root.hidden=true;
 root.innerHTML=`<header class="universe-heading"><div><small>SECOND POPULATION UNIVERSE</small><h3>第二人口宇宙</h3></div><button type="button" class="universe-expand" aria-label="展开物体宇宙">展开全景 ↗</button></header>
 <p class="universe-criterion">第二人口：城市里承担了一件原本由人承担的事的人造物。</p>
 <div class="universe-summary"><span><b id="universeCount">63</b><small>候选观察</small></span><span><b id="universeCategories">5</b><small>功能类别</small></span><span><b>4</b><small>监控来源</small></span></div>
 <div class="universe-meta"><span id="universeCamera">CAM02 来源高亮</span><span>类别 → 来源 → 个体</span></div>
 <nav class="universe-category-nav" aria-label="点击分类放大查看"></nav>
 <div class="universe-workspace"><div class="universe-surface"><canvas tabindex="0" aria-label="第二人口宇宙：点击类别下钻，点击粒子查看个体；滚轮缩放，拖动旋转，Home 返回整体"></canvas><div class="universe-annotations"></div><div class="universe-crop" aria-hidden="true"><i></i><i></i><i></i><i></i></div><span class="universe-space-note">1 粒子 = 1 条候选观察 · 抽象排布，非地理坐标</span><span class="universe-energy-note" id="universeEnergyNote">当前口径：一次性制造（一次能源）· 与电表读数对比需 ×2.47</span></div><aside class="universe-selection" aria-label="群落与个体信息"></aside></div>
 <div class="universe-controls"><button type="button" data-universe-action="out" aria-label="缩小">− 缩小</button><button type="button" data-universe-action="in" aria-label="放大">＋ 放大</button><button type="button" data-universe-action="overview">重置总览</button><button type="button" data-universe-action="palette" aria-label="切换配色方案">配色 A</button><button type="button" data-universe-action="energy" aria-label="切换能耗口径">口径：制造</button><button type="button" data-universe-action="fireflies" aria-pressed="true" aria-label="开关萤火虫层（E）">萤火虫 开</button><button type="button" data-universe-action="category" disabled>返回分类</button><span class="universe-scope"><button type="button" data-universe-scope="all" aria-pressed="true">全部来源</button><button type="button" data-universe-scope="scene" aria-pressed="false">当前来源</button></span><small class="universe-help">点分类放大 · 点清单看物体 · 拖动旋转</small></div>`;
 host.append(root);const dialog=document.createElement('dialog');dialog.className='universe-dialog';dialog.setAttribute('aria-label','第二人口宇宙：整体、类别、个体');dialog.innerHTML='<button type="button" class="universe-close" aria-label="返回监控">返回监控 ×</button>';document.body.append(dialog);
 const canvas=root.querySelector('canvas'),inspector=root.querySelector('.universe-selection'),labels=root.querySelector('.universe-annotations'),arcs=new Map();
 const NS='http://www.w3.org/2000/svg';
 const api=window.ObjectUniverse={enabled:true,ready,open,close:()=>dialog.close(),select:(id,options)=>engine?.select(id,options),focusCategory:id=>engine?.focusCategory(id),overview:()=>engine?.overview(),setPalette:name=>engine?.setPalette(name),decorations:n=>engine?.decorationScreen(n),setEnergyCaliber:mode=>engine?.setEnergyCaliber(mode),setFireflies:on=>engine?.setFireflies(on),energySizes:()=>engine?.energySizes(),getState:()=>({ready:!!engine,expanded:dialog.open,...engine?.snapshot()}),dispose(){cleanupAdapter?.();cleanupAdapter=null;engine?.dispose();engine=null;api.enabled=false;root.remove();host.classList.remove('has-object-universe');dialog.remove();}};
 function energyLabel(caliber){return caliber==='daily'?'每日使用':'一次性制造';}
 function syncEnergy(state){if(!state)return;const button=root.querySelector('[data-universe-action="energy"]'),fl=root.querySelector('[data-universe-action="fireflies"]'),note=root.querySelector('#universeEnergyNote');if(button)button.textContent='口径：'+(state.caliber==='daily'?'每日':'制造');if(fl){fl.textContent='萤火虫 '+(state.fireflies?'开':'关');fl.setAttribute('aria-pressed',String(state.fireflies));}if(note)note.textContent='当前口径：'+energyLabel(state.caliber)+'（一次能源）· 与电表读数对比需 ×2.47';}
 function fmtEnergy(v,digits){if(!Number.isFinite(v))return '未核';const body=Math.abs(v)>=100?Math.round(v).toLocaleString('en-US'):v.toFixed(digits??0).replace(/(\.\d*?)0+$/,'$1').replace(/\.$/,'');return body;}
 function energyRows(record){const item=energyMap.get(record.canonicalId);if(!item)return '';
  const emb=item.embodiedStatus==='pending'||typeof item.embodiedKwh!=='number'?'<b class="is-pending">未核</b>':'<b>'+(item.embodiedRange?'约 '+fmtEnergy(item.embodiedRange[0])+'–'+fmtEnergy(item.embodiedRange[1]):fmtEnergy(item.embodiedKwh))+' kWh</b><em>'+(item.embodiedStatus==='verified'?'已核':'估算')+'</em>';
  const amort=typeof item.amortizedKwh==='number'?'<b>'+fmtEnergy(item.amortizedKwh,3)+' kWh/日</b>':'<b class="is-pending">未核</b>';
  const daily=item.dailyStatus==='pending'||typeof item.dailyKwh!=='number'?'<b class="is-pending">未核</b>':item.dailyNote==='0（无电源，物理结论）'?'<b>0（无电源，物理结论）</b>':'<b>'+(item.dailyRange&&item.dailyRange[1]!==item.dailyRange[0]?'约 '+fmtEnergy(item.dailyRange[0],2)+'–'+fmtEnergy(item.dailyRange[1],2)+' kWh/日':fmtEnergy(item.dailyKwh,1)+' kWh/日')+'</b><em>'+esc(item.dailyNote||'估算')+'</em>';
  return '<div class="universe-energy"><p><i>制造</i>'+emb+'</p><p><i>日均摊销</i>'+amort+'</p><p><i>每日使用</i>'+daily+'</p><small>一次能源口径；与电表读数对比需 ×2.47 · 来源：'+esc(item.source||'未注明')+'</small></div>';
 }
 function visible(){return dialog.open||window.RenderLifecycle.stageVisible()&&root.isConnected&&!root.hidden;}
 function highlight(record){const active=record||selected;document.querySelectorAll('.track-box').forEach(box=>box.classList.toggle('universe-hover',!!active&&active.sceneId===window.__activeScene()&&box.dataset.canonicalId===active.canonicalId));document.querySelectorAll('.camera-preview').forEach(button=>button.classList.toggle('universe-source-highlight',!!active&&button.dataset.previewScene===active.sceneId));}
 const stamp=v=>Number.isFinite(v)?v.toFixed(2)+' s':'DATA PENDING';
 function syncNavigation(id){root.querySelectorAll('.universe-category-nav button').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.category===id)));root.querySelector('[data-universe-action="category"]').disabled=!id;}
 function overviewInfo(){if(!engine)return;root.dataset.level='overview';inspectedGroup=null;syncNavigation(null);inspector.innerHTML='<div class="universe-level">01 / 整体群体</div><h4>城市工业物的五个群落</h4><div class="universe-category-list">'+engine.layout.groups.map(g=>'<button type="button" data-category="'+g.id+'" style="--category-color:'+g.color+'"><i></i><span>'+g.label+'</span><b>'+g.count+'</b></button>').join('')+'</div><p class="universe-info-note">判据：它替人做了一件具体的事——走、看、指路、维持秩序、划线。<br>63 条候选观察，物理身份待核验。原始 75 条来源完整保留。</p>';}
 function showCategory(group,preview){
  if(!group){overviewInfo();return;}const same=inspectedGroup?.id===group.id;inspectedGroup=group;root.dataset.level='category';syncNavigation(group.id);syncScope(engine.viewState().scope);const camera=window.__activeScene(),human=window.PopulationCriterion&&window.PopulationCriterion.group(group.id);
  inspector.innerHTML='<div class="universe-level">02 / 类别群落'+(preview?' · 悬停预览':'')+'</div><h4 style="color:'+group.color+'">'+group.label+' <b>'+group.count+'</b></h4><div class="universe-category-en">'+group.en+'</div>'+(human?'<div class="universe-category-role">替人的事 <b style="color:'+group.color+'">'+esc(human.role)+'</b> · '+esc(human.human)+'<span>'+esc(human.text)+'</span></div>':'')+'<div class="universe-source-distribution">'+['street1','street2','street3','street4'].map((key,i)=>{const n=group.sources.find(s=>s.sceneId===key)?.count||0;return '<div class="universe-source-row '+(key===camera?'is-current':'')+'" data-source="'+key+'"><span>CAM0'+(i+1)+'</span><i><em style="width:'+n/group.count*100+'%;background:'+group.color+'"></em></i><b>'+n+'</b></div>';}).join('')+'</div><p class="universe-info-note">亮的一组来自当前监控。点下方物体，进入它所在机位的物件空间。</p><header class="universe-list-heading">本类物体清单 <b>'+group.count+'</b></header><div class="universe-representatives universe-object-list">'+group.records.map(r=>'<button type="button" data-object="'+r.canonicalId+'"><img src="'+esc(r.thumb)+'" alt="'+esc(r.label)+'取证图" loading="lazy"><span><b>'+esc(r.label)+'</b><small>'+r.cameraId+' · '+r.sourceId+'<br>'+stamp(r.appear)+' — '+stamp(r.disappear)+'</small></span><i aria-hidden="true">↗</i></button>').join('')+'</div><p class="universe-info-note universe-category-definition">基于原始标签的功能分类；保留原始类别。</p>';
  if(!same)inspector.scrollTop=0;
 }
 function refreshInspector(){if(inspectedGroup)showCategory(inspectedGroup,false);else overviewInfo();}
 function updateScene(key){engine?.setScene(key);root.querySelector('.universe-heading small').textContent=key==='legacy'?'SECOND POPULATION · 历史片段':'SECOND POPULATION · CAM0'+key.slice(-1)+' 来源高亮';root.querySelector('#universeCamera').textContent=key==='legacy'?'历史片段独立保留':'CAM0'+key.slice(-1)+' · 当前来源高亮';refreshInspector();}
 function syncScope(scope){root.querySelectorAll('[data-universe-scope]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.universeScope===scope)));root.querySelector('#universeCount').textContent=scope==='scene'?C.candidateRecords.filter(r=>r.sceneId===window.__activeScene()).length+' / 63':String(C.candidateRecords.length);}
 function saveView(saved){syncScope(saved.scope);C.setState({universeView:saved,globalViewTransform:saved,filter:{scope:saved.scope,categoryId:saved.categoryId}},false);}
 /* 弧形文字：沿群落虚线圆的顶部弧排布；默认全部隐藏，只让 activeCategory 那一组淡入。 */
 function arcPath(cx,cy,r){const points=[];for(let i=0;i<=18;i++){const t=(205+130*i/18)*Math.PI/180;points.push((cx+Math.cos(t)*r).toFixed(1)+','+(cy+Math.sin(t)*r).toFixed(1));}return 'M'+points.join(' L');}
 function project(data,meta){
  if(!arcs.size)return;
  const activeId=(meta&&meta.activeCategory)||null;
  for(const g of data){const arc=arcs.get(g.id);if(!arc)continue;
   const show=activeId===g.id&&g.r>10;
   arc.group.style.opacity=show?'1':'0';
   if(!show)continue;
   const text=arc.label+' / '+(g.visibleCount===g.count?String(g.count):g.visibleCount+' / '+g.count);
   arc.path.setAttribute('d',arcPath(g.cx,g.cy,g.r+13));
   if(arc.textPath.textContent!==text)arc.textPath.textContent=text;
   arc.text.style.fill=arc.color;
  }
 }
 function buildAnnotations(){
  const svg=document.createElementNS(NS,'svg');svg.setAttribute('class','universe-arcs');svg.setAttribute('aria-hidden','true');labels.append(svg);
  for(const g of engine.layout.groups){
   const group=document.createElementNS(NS,'g');group.setAttribute('class','universe-arc');group.style.opacity='0';
   const path=document.createElementNS(NS,'path');path.setAttribute('fill','none');path.setAttribute('id','universe-arc-'+g.id);
   const text=document.createElementNS(NS,'text');const textPath=document.createElementNS(NS,'textPath');textPath.setAttribute('startOffset','50%');textPath.setAttribute('href','#universe-arc-'+g.id);textPath.setAttributeNS('http://www.w3.org/1999/xlink','xlink:href','#universe-arc-'+g.id);
   text.append(textPath);group.append(path,text);svg.append(group);
   arcs.set(g.id,{group,path,text,textPath,color:g.color,label:g.label});
   const shortcut=document.createElement('button');shortcut.type='button';shortcut.dataset.category=g.id;shortcut.setAttribute('aria-pressed','false');shortcut.style.setProperty('--category-color',g.color);shortcut.innerHTML='<span>'+g.label+'</span><b>'+g.count+'</b>';root.querySelector('.universe-category-nav').append(shortcut);
  }
 }
 async function initialize(){if(starting||engine||!window.RenderLifecycle.stageVisible())return;starting=true;try{await C.ready;const module=await import('./object-universe.js');
  const manifest=await fetch('energy-manifest.json').then(r=>r.ok?r.json():null).catch(()=>null);
  energyMap=new Map((manifest?.items||[]).map(i=>[i.objectId,i]));
  engine=module.createObjectUniverse(canvas,C.candidateRecords,{visible,energy:manifest,onEnergy:syncEnergy,onSelect:r=>{selected=r;highlight(r);},onOpenObject:id=>openObjectScene(id).catch(console.error),onCategory:showCategory,onHover:highlight,onProject:project,onView:saveView,onArchive:id=>openRecord(id,'archive'),onSource:()=>refreshInspector()});buildAnnotations();root.hidden=false;host.classList.add('has-object-universe');window.ObjectWeb?.hide();syncEnergy(engine.energyState());
  cleanupAdapter=window.SecondPopulationLocalCommunity.mount({onScene(detail){updateScene(detail.sceneId);syncScope(engine.snapshot().scope);},onFrame:frame=>engine.setFrame(frame),onSelect:detail=>{selected=C.get(detail.canonicalId);highlight(selected);},onObject(){},dispose(){engine?.dispose();engine=null;api.enabled=false;root.hidden=true;host.classList.remove('has-object-universe');}});
  root.querySelector('#universeCategories').textContent=engine.layout.groups.length;if(C.state.universeView)engine.restore({...C.state.universeView,selectedObjectId:null,framing:C.state.universeView.framing==='object'?'overview':C.state.universeView.framing});else overviewInfo();updateScene(window.__activeScene());engine.resize();engine.sync();resolveReady(engine);
 }catch(error){starting=false;api.enabled=false;root.hidden=true;host.classList.remove('has-object-universe');rejectReady(error);console.warn('[UNIVERSE] Existing star map remains available:',error.message);}}
 async function open(id){const record=id?C.get(id):null;if(id&&(!record?.sky||record.populationEligible===false))return;await ready;if(dialog.open){if(record?.universeCategoryId)engine.focusCategory(record.universeCategoryId);return;}monitorReturn=window.PopulationNavigation.captureMonitor();video.pause();C.setState({view:'universe'});root.classList.add('is-expanded');dialog.append(root);inspector.scrollTop=0;dialog.showModal();window.RenderLifecycle.changed();engine.resize();engine.sync();if(record?.universeCategoryId)engine.focusCategory(record.universeCategoryId);else{engine.setScope('all');engine.overview();syncScope('all');}canvas.focus({preventScroll:true});}
 function restorePane(){host.append(root);root.classList.remove('is-expanded');engine.resize();engine.sync();}
 dialog.addEventListener('close',async()=>{restorePane();highlight(null);if(quietClose){quietClose=false;return;}await window.Monitor.restore(selected?{...monitorReturn,selectedObjectId:selected.canonicalId}:monitorReturn);highlight(selected);engine.sync();});dialog.querySelector('.universe-close').onclick=()=>dialog.close();dialog.addEventListener('keydown',e=>{if(e.key==='Escape'){e.preventDefault();e.stopPropagation();dialog.close();}},{capture:true});
 async function openRecord(id,mode){const record=C.get(id);if(!record)return;const back=dialog.open?monitorReturn:window.PopulationNavigation.captureMonitor();if(dialog.open){quietClose=true;dialog.close();}C.setState({view:'transition'});video.pause();window.RenderLifecycle.changed();if(mode==='monitor')await window.Monitor.restore({sceneId:record.sceneId,time:record.appear+.05,paused:true,selectedObjectId:id});else{const returnSnapshot=back?.sceneId===record.sceneId?{...back,selectedObjectId:id}:null;await window.__openCanonical(id,{returnSnapshot});}engine.sync();}
 let openingObject=false;
 async function openObjectScene(id){
  const record=C.get(id);
  if(!record||openingObject)return;
  openingObject=true;
  const back=dialog.open?monitorReturn:window.PopulationNavigation.captureMonitor();
  try{
   if(dialog.open){quietClose=true;dialog.close();}
   const position=back?.sceneId===record.sceneId?back:{sceneId:record.sceneId,time:record.appear+.05,paused:true};
   await window.Monitor.restore({...position,paused:true,selectedObjectId:id});
   if(!window.ResidueSpace?.open(id,{returnSnapshot:back})){
    if(!window.ObjectSpace?.open(id))await window.__openCanonical(id);
   }
  }finally{openingObject=false;}
 }
 root.addEventListener('click',e=>{const expand=e.target.closest('.universe-expand');if(expand){open(selected?.canonicalId).catch(console.error);return;}const category=e.target.closest('[data-category]');if(category){engine.focusCategory(category.dataset.category);return;}const object=e.target.closest('[data-object]');if(object){openObjectScene(object.dataset.object).catch(console.error);return;}const scope=e.target.closest('[data-universe-scope]');if(scope){engine.setScope(scope.dataset.universeScope);syncScope(scope.dataset.universeScope);return;}const action=e.target.closest('[data-universe-action]')?.dataset.universeAction;if(!action)return;if(action==='in')engine.zoom(.7);else if(action==='out')engine.zoom(1.4);else if(action==='overview'){engine.overview();engine.setScope('all');syncScope('all');}else if(action==='palette'){const next=window.UniversePalette.palette.cycle();engine.setPalette(next);root.querySelector('[data-universe-action="palette"]').textContent='配色 '+({cool5:'A',monoAccent:'B',groupHues:'C'}[next]||'A');}else if(action==='energy')syncEnergy(engine.setEnergyCaliber(engine.energyState().caliber==='daily'?'embodied':'daily'));else if(action==='fireflies')syncEnergy(engine.setFireflies(!engine.energyState().fireflies));else if(action==='category'){const id=engine.snapshot().focusedCategory;if(id)engine.focusCategory(id);else engine.overview();}else if(action==='current')engine.focusScene();else if(action==='previous')engine.stepObject(-1);else if(action==='next')engine.stepObject(1);else if(selected)openRecord(selected.canonicalId,action).catch(console.error);});
 root.addEventListener('pointerover',e=>{const item=e.target.closest('[data-category]');if(item)engine?.setCategoryHover(item.dataset.category);});root.addEventListener('pointerout',e=>{const item=e.target.closest('[data-category]');if(item&&!item.contains(e.relatedTarget))engine?.setCategoryHover(null);});
 C.events.addEventListener('hover',e=>engine?.setHover(e.detail.active?e.detail.canonicalId:null));window.addEventListener('boot:entered',initialize);window.addEventListener('sp:viewchange',()=>{if(!engine)initialize();else engine.sync();});initialize();
})();

