/* Integration routes only. Monitoring, archive geometry and local-community rendering remain owned by A. */
(function(){
 'use strict';
 const C=window.Census,video=document.getElementById('cam'),esc=window.ArchiveData.escape;
 const changed=()=>window.RenderLifecycle.changed();
 const safe=fn=>(...args)=>Promise.resolve().then(()=>fn(...args)).catch(error=>{console.error(error);window.alert('操作未完成：'+error.message);});
 const camera=r=>r.cameraId||'历史片段';
 const eligible=r=>!!r?.sky&&r.populationEligible!==false;
 const status=r=>eligible(r)?'待核验候选':r.sceneId==='legacy'?'历史观察 · 独立核验':'上下文记录 · 不纳入候选群落';
 function pause(view){C.setState({view,paused:video.paused,currentTime:video.currentTime});video.pause();changed();}
 function dialog(id,label){const d=document.createElement('dialog');d.id=id;d.className='master-dialog';d.setAttribute('aria-label',label);document.body.append(d);return d;}
 const selector=dialog('sceneSelector','选择监控场景'),evidence=dialog('evidenceRecord','对象观察档案'),sources=dialog('sourceMaterials','来源记录与历史资料');
 selector.classList.add('scene-selector');
 let selectorPlaying=false,evidenceReturn=null,sourcesReturn=null;
 const suppressed=new WeakSet();
 function closeQuietly(d){if(d.open){suppressed.add(d);d.close();}}
 function closeHandler(d,normal){d.addEventListener('close',()=>{if(suppressed.has(d)){suppressed.delete(d);return;}safe(normal)();});}
 function details(r){
  const labels={manufacturingEnergy:'制造能耗',manufacturingWater:'制造用水',steel:'用钢量',designLife:'设计寿命',annualCarbon:'年运营碳排放'};
  return '<details class="research-source"><summary>研究资料：原始资源注记（未核验）</summary><p>原始模拟估算，保留来源与单位；不计入公开资源总量，不作为节点亮度依据。</p><table><thead><tr><th>原始字段</th><th>注记值 / 单位</th><th>属性</th></tr></thead><tbody>'+Object.entries(r.resourceData.quantities).map(([key,q])=>'<tr><td>'+esc(labels[key])+'</td><td>'+esc(q.value??'未提供')+' '+esc(q.unit)+'</td><td>模拟估算 · 未核验</td></tr>').join('')+'</tbody></table><p>来源：'+esc(r.auditEvidence.annotationFile)+' · '+esc(r.sourceId)+'<br>以上数值缺少独立的供应商资料、测量记录或计算依据。</p></details>';
 }
 function metadata(r){return '<div class="record-evidence"><img src="'+esc(r.thumb)+'" alt="'+esc(r.label)+'的原始取证帧"><dl><dt>统一编号</dt><dd>'+esc(r.canonicalId)+'</dd><dt>原始编号</dt><dd>'+esc(r.sourceId)+'</dd><dt>来源 / 时间</dt><dd>'+camera(r)+' · '+r.appear+'–'+r.disappear+' s</dd><dt>原始类别</dt><dd>'+esc(r.categoryLabel)+' / '+esc(r.categoryOriginal)+'</dd><dt>核验状态</dt><dd>'+status(r)+'</dd><dt>证据来源</dt><dd>'+esc(r.auditEvidence.annotationFile)+'</dd></dl></div>';}

 // Keep the existing timeline; add pointer seeking and accessible keyboard seeking.
 const timeline=document.getElementById('timeline');timeline.tabIndex=0;timeline.setAttribute('role','slider');timeline.setAttribute('aria-label','监控视频时间轴');timeline.setAttribute('aria-valuemin','0');
 C.events.addEventListener('frame',e=>{timeline.setAttribute('aria-valuemax',String(e.detail.duration));timeline.setAttribute('aria-valuenow',e.detail.time.toFixed(1));});
 timeline.addEventListener('keydown',e=>{if(!['ArrowLeft','ArrowRight','Home','End'].includes(e.key))return;e.preventDefault();e.stopPropagation();const end=video.duration||0;video.currentTime=e.key==='Home'?0:e.key==='End'?Math.max(0,end-.05):Math.max(0,Math.min(end-.05,video.currentTime+(e.key==='ArrowRight'?.5:-.5)));});
 let dragging=false;const seek=e=>{const r=timeline.getBoundingClientRect();if(Number.isFinite(video.duration))video.currentTime=Math.max(0,Math.min(.999,(e.clientX-r.left)/r.width))*video.duration;};
 timeline.addEventListener('pointerdown',e=>{dragging=true;timeline.setPointerCapture(e.pointerId);seek(e);});timeline.addEventListener('pointermove',e=>{if(dragging)seek(e);});for(const type of ['pointerup','pointercancel'])timeline.addEventListener(type,()=>{dragging=false;});
 const overview=document.createElement('section');overview.id='sceneOverview';overview.setAttribute('aria-label','四场景汇总');document.querySelector('.layout').after(overview);
 C.ready.then(data=>{
  overview.innerHTML='<span class="overview-title">四个观察现场<br><small>观察记录 · 物理身份待核验</small></span>'+data.scenes.filter(s=>s.key!=='legacy').map((s,i)=>'<button type="button" data-overview="'+s.key+'"><b>0'+(i+1)+'</b><span>'+esc(s.alias)+'<small>'+s.count+' 条来源记录 · '+s.duration+'s</small></span></button>').join('');
  overview.addEventListener('click',safe(async e=>{const key=e.target.closest('[data-overview]')?.dataset.overview;if(!key)return;await window.__switchScene(key);}));
  overview.querySelector('[data-overview="'+window.__activeScene()+'"]')?.classList.add('active');
  selector.innerHTML='<header><small>OBSERVATION STATIONS / FOUR TAKES</small><button class="survey-entry" id="sceneSelectorClose" type="button">返回 ×</button></header><h2>选择一个观察入口</h2><div class="scene-choices">'+data.scenes.filter(s=>s.key!=='legacy').map((s,i)=>{const r=data.records.find(r=>r.sceneId===s.key&&r.category==='vehicle')||data.records.find(r=>r.sceneId===s.key);return '<button type="button" class="scene-choice" data-select="'+s.key+'"><img src="'+r.thumb+'" alt="'+esc(s.alias)+'场景取证帧"><div><b>0'+(i+1)+' / '+esc(s.cam)+'</b><span>'+esc(s.alias)+'</span><em>'+s.count+' SOURCE RECORDS · '+s.duration+'s</em></div></button>';}).join('')+'</div><footer><span>四段影像，70 条原始观察记录。<br>63 条待核验候选，7 条上下文另列于来源资料。</span></footer>';
  selector.querySelector('#sceneSelectorClose').onclick=()=>selector.close();
  selector.addEventListener('click',safe(async e=>{const button=e.target.closest('[data-select]');if(!button)return;button.disabled=true;try{await window.__switchScene(button.dataset.select);selectorPlaying=true;selector.close();}finally{button.disabled=false;}}));
 }).catch(console.error);
 C.events.addEventListener('scenechange',e=>{overview.querySelectorAll('[data-overview]').forEach(b=>b.classList.toggle('active',b.dataset.overview===e.detail.sceneId));});
 function choose(){if(selector.open)return;selectorPlaying=!video.paused;pause('scene-select');document.body.classList.add('is-selecting');selector.showModal();}
 closeHandler(selector,()=>{document.body.classList.remove('is-selecting');C.setState({view:'monitor'});changed();if(selectorPlaying)video.play().catch(()=>{});});
 window.addEventListener('boot:entered',()=>{if(window.CameraPrelude.directEntry||window.CameraPrelude.reason==='screen'){C.setState({view:'monitor'});changed();video.play().catch(()=>{});}else{choose();changed();}});
 const deskButton=document.getElementById('chooseScene');deskButton.textContent='四路观察台 ↗';deskButton.onclick=()=>window.ObservationDesk.open();

 const archiveMetadata=document.createElement('section');archiveMetadata.id='archiveEvidence';document.getElementById('oaIdentity').before(archiveMetadata);
 const research=document.createElement('div');research.id='archiveResearch';document.getElementById('oaSourceDialog').append(research);
 C.events.addEventListener('archiveopen',e=>{const r=C.get(e.detail.canonicalId);if(!r)return;archiveMetadata.innerHTML=metadata(r);research.innerHTML=details(r);});
 window.openEvidenceRecord=(obj,returnSnapshot)=>{
  const r=C.get(obj.canonicalId);if(!r)return;
  evidenceReturn=returnSnapshot||window.Monitor.snapshot();pause('archive');C.setState({selectedObjectId:r.canonicalId});
  evidence.innerHTML='<header><small>OBJECT OBSERVATION / EVIDENCE</small><button class="survey-entry evidence-back" type="button">BACK TO MONITOR ×</button></header><h2>'+esc(r.label)+'</h2><img class="evidence-photo" src="'+esc(r.thumb)+'" alt="'+esc(r.label)+'的原始取证影像">'+metadata(r)+'<p>当前没有经过对应核实的三维模型，展示来源影像与原始标注。型号、尺寸及资源资料尚未核验。</p>'+details(r);
  evidence.querySelector('.evidence-back').onclick=()=>evidence.close();evidence.showModal();changed();
 };
 closeHandler(evidence,()=>window.Monitor.restore(evidenceReturn));
 const identity=window.ArchiveData.identity,notes=window.ArchiveData.sourceNotes;
 window.PopulationNavigation={captureMonitor(){const saved=evidence.open?evidenceReturn:window.Monitor.snapshot();closeQuietly(evidence);window.Monitor.closeArchive({resume:false});return saved;}};
 window.ArchiveData.identity=obj=>identity(obj)+'<div class="id-row"><dt>CANONICAL ID</dt><dd>'+esc(obj.canonicalId||obj.objectId)+'</dd></div>';
 window.ArchiveData.sourceNotes=obj=>{const source=C.get(obj.canonicalId)?.provenance.sourceFile||'original annotation';return notes(obj).replace(' / tracks.json',' / '+source)+'\n\nUNIFIED OBSERVATION\n'+obj.canonicalId+'\nSource ID: '+obj.objectId+'\nSource: '+source+'\nPhysical identity across clips: unresolved.';};

 const sourceButton=document.createElement('button');sourceButton.id='openSourceMaterials';sourceButton.type='button';sourceButton.className='survey-entry';sourceButton.textContent='来源资料 ↗';document.getElementById('chooseScene').after(sourceButton);
 function renderSources(all=false){
  const records=all?C.records.filter(r=>r.sky&&!/^\s*(TREE|HEDGE)\s*$/i.test(r.labelEn||'')):C.contextRecords;
  sources.innerHTML='<header><small>SOURCE RECORDS / 原始标注保留</small><button type="button" class="survey-entry sources-close">返回监控 ×</button></header><h2>来源资料</h2><p>70 条原始记录完整保留。63 条为待核验候选，另有 7 条人员或骑手上下文；跨片段物理身份尚未去重。</p><div class="source-controls"><button type="button" class="survey-entry '+(!all?'active':'')+'" data-source-view="context">上下文 7</button><button type="button" class="survey-entry '+(all?'active':'')+'" data-source-view="all">全部来源 70</button></div><div class="source-records">'+records.map(r=>'<button type="button" class="source-record" data-source-record="'+r.canonicalId+'"><img src="'+esc(r.thumb)+'" alt=""><span><b>'+esc(r.label)+'</b><small>'+r.canonicalId+' · '+camera(r)+' · '+r.appear+'–'+r.disappear+' s</small><small>'+status(r)+'</small></span><span>调档 ↗</span></button>').join('')+'</div><details class="legacy-materials"><summary>历史素材 · 原始档案片段（40 条观察）</summary><p>独立于 CAM01–04 的早期观察片段，未作为第五个正式机位；与四段片段的物理身份关系待核验。独立空调深度档案仍保留在这里。</p><button type="button" class="survey-entry" data-open-legacy>打开历史片段 ↗</button> <a class="survey-entry" href="space.html" target="_blank" rel="noopener">档案空间原型 ↗</a></details>';
  sources.querySelector('.sources-close').onclick=()=>sources.close();
 }
 sourceButton.onclick=()=>{sourcesReturn=window.Monitor.snapshot();pause('sources');renderSources();sources.showModal();};
 sources.addEventListener('click',safe(async e=>{
  const toggle=e.target.closest('[data-source-view]');if(toggle){renderSources(toggle.dataset.sourceView==='all');return;}
  const record=e.target.closest('[data-source-record]'),legacy=e.target.closest('[data-open-legacy]');if(!record&&!legacy)return;
  closeQuietly(sources);C.setState({view:'transition'});changed();
  if(legacy)await window.Monitor.restore({sceneId:'legacy',time:0,paused:true,selectedObjectId:null});
  else{video.pause();await window.__openCanonical(record.dataset.sourceRecord);}
 }));
 closeHandler(sources,()=>window.Monitor.restore(sourcesReturn));
 let hiddenWasPlaying=false;document.addEventListener('visibilitychange',()=>{if(document.hidden){hiddenWasPlaying=!video.paused;video.pause();}else if(hiddenWasPlaying&&window.RenderLifecycle.stageVisible())video.play().catch(()=>{});});

 // Versioned adapter for the forthcoming local community. Existing rendering stays installed.
 let localCleanup=null;
 window.SecondPopulationLocalCommunity={
  version:1,
  mount(adapter){
   localCleanup?.();const seen=new Set();let alive=true;
   const deliver=detail=>{if(seen.has(detail.canonicalId))return;seen.add(detail.canonicalId);adapter.onObject?.(detail);};
   const handlers=[['scenechange',e=>{seen.clear();adapter.onScene?.(e.detail);}],['frame',e=>adapter.onFrame?.(e.detail)],['select',e=>adapter.onSelect?.(e.detail)],['objectdiscovered',e=>deliver(e.detail)]];
   for(const[t,f]of handlers)C.events.addEventListener(t,f);
   const current=window.__activeScene?.();if(current)C.scene(current).then(scene=>{if(!alive||current!==window.__activeScene())return;adapter.onScene?.({sceneId:current,scene,objects:scene.objects});for(const object of scene.objects.filter(o=>video.currentTime>=o.appear))deliver({canonicalId:object.canonicalId,sceneId:current,category:object.category,color:object.color,object});});
   localCleanup=()=>{alive=false;for(const[t,f]of handlers)C.events.removeEventListener(t,f);adapter.dispose?.();};return localCleanup;
  },
  select:canonicalId=>window.__openCanonical(canonicalId),getScene:()=>window.__activeScene?.(),get records(){return C.records;}
 };
})();

