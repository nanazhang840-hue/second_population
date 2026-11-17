/* Canonical data and one in-memory navigation state. Original annotations remain intact. */
(function(){
 'use strict';
 const events=new EventTarget();let data=null;let loadError=null;
 let state={view:'monitor',camera:'street2',cameraId:'CAM02',currentTime:0,paused:true,selectedObjectId:null,filter:null,globalViewTransform:null};
 /* 主账缺失 / 断网兜底：先原样请求，失败后 500ms 再重试一次（reload 绕缓存）；
    仍失败则记录 loadError 并降级为空数据集，避免 tracker、星图、档案等消费方
    拿到 rejected Promise 后整站静默失效。 */
 async function fetchCensus(cache){
  const r=await fetch('data/census.json',cache?{cache}:undefined);
  if(!r.ok)throw Error('统一普查数据加载失败 '+r.status);
  return r.json();
 }
 const ready=(async()=>{
  try{data=await fetchCensus();}
  catch(first){
   await new Promise(res=>setTimeout(res,500));
   try{data=await fetchCensus('reload');}
   catch(err){
    loadError=err;
    console.error('[CENSUS] 数据源不可用，页面以降级模式运行：'+(err&&err.message||err));
    data={records:[],scenes:[],summary:{}};
   }
  }
  return data;
 })();
 const emit=(type,detail)=>events.dispatchEvent(new CustomEvent(type,{detail}));
 function setState(patch,notify=true){state={...state,...structuredClone(patch)};if(notify)emit('statechange',structuredClone(state));}
 events.addEventListener('scenechange',e=>setState({camera:e.detail.sceneId,cameraId:e.detail.sceneId==='legacy'?null:'CAM0'+e.detail.sceneId.slice(-1),selectedObjectId:null}));
 events.addEventListener('frame',e=>setState({currentTime:e.detail.time},false));
 events.addEventListener('select',e=>setState({selectedObjectId:e.detail.canonicalId}));
 const NATURE=/^\s*(TREE|HEDGE)\s*$/i;
 const candidates=()=>data?.records.filter(r=>r.sky&&r.populationEligible!==false&&!NATURE.test(r.labelEn||''))||[];
 window.Census={ready,events,emit,setState,get state(){return structuredClone(state)},get summary(){return data?.summary},get scenes(){return data?.scenes||[]},get records(){return data?.records||[]},
  get loadError(){return loadError},
  get(id){return data?.records.find(r=>r.canonicalId===id)},
  resolve(sourceId,sceneId){return data?.records.find(r=>r.sceneId===sceneId&&(r.sourceId===sourceId||r.canonicalId===sourceId))},
  get candidateRecords(){return candidates()},get contextRecords(){return data?.records.filter(r=>r.sky&&r.populationEligible===false&&!NATURE.test(r.labelEn||''))||[]},
  async scene(key){await ready;const scene=data.scenes.find(s=>s.key===key);if(!scene){if(loadError)return {key,objects:[]};throw Error('Unknown scene '+key)}return {...scene,objects:data.records.filter(r=>r.sceneId===key).map(r=>({...structuredClone(r.annotation),canonicalId:r.canonicalId,sourceId:r.sourceId,sceneId:r.sceneId,cameraId:r.cameraId,timeRange:r.timeRange,thumb:r.thumb,archive:r.archive,resourceData:r.resourceData,populationEligible:r.populationEligible,populationEligibility:r.populationEligibility,eligibilityStatus:r.eligibilityStatus,modelStatus:r.modelStatus,visualGroupId:r.visualGroupId,color:r.color,source:r.source}))}},
  get populationView(){return data?.records.filter(r=>r.sky&&r.populationEligible===true)||[]},
  async sky(){await ready;const records=candidates();return {scenes:data.scenes.filter(s=>s.key!=='legacy').map(s=>({...s,rawCount:s.count,count:records.filter(r=>r.sceneId===s.key).length})),objects:records.map(r=>({...structuredClone(r.sky),cameraId:r.cameraId,eligibilityStatus:r.eligibilityStatus}))}}
 };
})();
