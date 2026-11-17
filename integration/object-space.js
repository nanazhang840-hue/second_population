(function(){
 'use strict';
 const video=document.getElementById('cam');
 const dialog=document.createElement('dialog');
 dialog.className='object-space-dialog';
 dialog.setAttribute('aria-labelledby','objectSpaceTitle');
 dialog.innerHTML='<header><div><span>第二人口</span><h2 id="objectSpaceTitle">物件空间</h2></div><button type="button" class="survey-entry" autofocus>返回监控 ×</button></header><div class="object-space-stage"></div>';
 document.body.append(dialog);
 const stage=dialog.querySelector('.object-space-stage');
 let snapshot, archiveId, activeFrame, trigger;
 dialog.querySelector('button').onclick=()=>dialog.close();

 dialog.addEventListener('close',async()=>{
  activeFrame?.remove();
  activeFrame=null;
  const saved=snapshot, record=archiveId, source=trigger;
  snapshot=archiveId=trigger=null;
  if (!saved) return;
  try {
   await window.Monitor.restore(saved);
   if(record) await window.__openCanonical(record,{returnSnapshot:saved});
   else if(source?.isConnected) source.focus({preventScroll:true});
  } catch(error) {
   console.error('[OBJECT SPACE] Could not restore monitoring',error);
  }
 });

 window.addEventListener('message',event=>{
  if(event.origin!==location.origin||event.source!==activeFrame?.contentWindow||!dialog.open) return;
  if(event.data?.type==='sp:space-close') dialog.close();
  if(event.data?.type==='sp:space-archive'&&window.Census.get(event.data.id)){
   archiveId=event.data.id;
   dialog.close();
  }
 });

 window.ObjectSpace={
  open(id,source){
   const record=window.Census.get(id);
   if(!record||record.category==='person'||/\b(TREE|HEDGE)\b/i.test(record.labelEn||'')) return false;
   if(dialog.open) return true;
   snapshot=window.Monitor.snapshot();
   trigger=source;
   video.pause();
   window.Census.setState({view:'object-space',selectedObjectId:id});
   window.RenderLifecycle.changed();
   activeFrame=document.createElement('iframe');
   activeFrame.title='现场物件的三维展示';
   activeFrame.src='space.html?'+new URLSearchParams({mode:'observation',record:id,kind:record.labelEn||record.annotation?.labelEn||'',camera:record.sceneId||''});
   stage.append(activeFrame);
   dialog.showModal();
   return true;
  }
 };
})();
