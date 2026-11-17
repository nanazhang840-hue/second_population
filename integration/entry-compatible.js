const assets='integration/entry-frames/';
const cameras=[
 ['street1','CAM 01','站前交叉口'],
 ['street2','CAM 02','夜间主路'],
 ['street3','CAM 03','南段慢行道'],
 ['street4','CAM 04','辅道停靠带']
];
const chapters=[
 {at:.28,title:'项目调研',heading:'从四段街道影像开始',copy:'我们在街景里标注车辆、路灯和路牌，记录它们出现的位置、时段与用途。',frames:['CAM01-01','CAM03-02']},
 {at:.49,title:'方案过程',heading:'让观察可以回查',copy:'从原始画面找到对象，按用途整理观察记录，再沿编号回到取证帧和个体档案。',frames:['CAM01-02','CAM02-02']},
 {at:.80,title:'最终成果',heading:'进入第二人口',copy:'在四路监控中观察街道与物件。选中画面里的物件，可以进入对应机位的物件空间。',frames:['CAM03-03','CAM04-02']}
];

export function mountCompatibleEntry(host,api,complete,{roomOnly=false}={}){
 const controller=new AbortController();
 const {signal}=controller;
 const stage=host.querySelector('.entry-stage');
 stage.replaceChildren();
 host.classList.remove('entry-fallback');
 host.classList.add('entry-compatible');
 const title=host.querySelector('.entry-title');
 const phase=host.querySelector('#entryPhase');
 const hint=host.querySelector('#entryHint');
 const skip=host.querySelector('#entrySkip');
 const range=host.querySelector('#entryProgress');
 const percent=host.querySelector('#entryPercent');
 range.disabled=false;
 const image=document.createElement('img');
 image.className='compatible-camera';
 image.alt='';
 stage.append(image);
 const preload=[];
 for(let i=0;i<33;i++){
  const frame=new Image();
  frame.src='integration/entry-fallback-frames/'+String(i).padStart(2,'0')+'.jpg';
  preload.push(frame);
 }
 const story=document.createElement('div');
 story.className='compatible-story';
 story.hidden=true;
 host.append(story);
 const room=document.createElement('section');
 room.className='compatible-room';
 room.setAttribute('aria-label','四路观察台');
 room.hidden=true;
 room.innerHTML='<header><h2>四路观察台</h2><p>选择一个机位进入监控</p></header><div class="compatible-stations"></div>';
 const grid=room.querySelector('.compatible-stations');
 for(const [key,code,name] of cameras){
  const button=document.createElement('button');
  button.type='button';
  button.dataset.camera=key;
  button.innerHTML='<img src="'+assets+code.replace(' ','')+'-02.jpg" alt=""><span><b>'+code+'</b>'+name+'</span>';
  button.onclick=()=>selectStation(key);
  grid.append(button);
 }
 host.append(room);
 let p=0,lastFrame=-1,current=-2,busy=false;

 function setProgress(value){
  if(busy||signal.aborted)return;
  p=Math.max(0,Math.min(1,value));
  const isRoom=p>=.986;
  const chapter=p<.28||isRoom?-1:chapters.findLastIndex(item=>p>=item.at);
  host.classList.toggle('in-monitor-room',isRoom);
  room.hidden=!isRoom;
  story.hidden=chapter<0;
  image.hidden=isRoom||chapter>=0;
  title.hidden=p>=.10;
  title.style.opacity='1';
  if(chapter<0&&!isRoom){
   const frame=Math.min(32,Math.round(p/.28*32));
   if(frame!==lastFrame){image.src=preload[frame].src;lastFrame=frame;}
  }
  if(chapter>=0&&chapter!==current){
   const item=chapters[chapter];
   story.innerHTML='<div><small>'+item.title+'</small><h2>'+item.heading+'</h2><p>'+item.copy+'</p></div><div class="compatible-stills">'+item.frames.map(src=>'<img src="'+assets+src+'.jpg" alt="项目监控取帧">').join('')+'</div>';
  }
  current=chapter;
  phase.textContent=isRoom?'四路观察台':chapter<0?'影像通道':chapters[chapter].title;
  hint.textContent=isRoom?'点击画面进入对应机位':'向下滚动继续 · 向上滚动回看';
  range.value=String(Math.round(p*1000));
  percent.value=String(Math.round(p*100)).padStart(2,'0')+'%';
  host.style.setProperty('--opening-progress',p*100+'%');
  skip.hidden=isRoom&&!roomOnly;
  api.progress=p;
  api.frames++;
 }
 async function selectStation(key){
  if(busy||!cameras.some(entry=>entry[0]===key))return;
  busy=true;
  for(const button of grid.querySelectorAll('button'))button.disabled=true;
  phase.textContent='正在接入监控…';
  try{
   await window.__switchScene(key);
   if(!signal.aborted)complete('screen');
  }catch(error){
   phase.textContent='无法接入该机位，请重试';
   console.warn('[ENTRY] Could not open the selected camera',error);
  }finally{
   busy=false;
   for(const button of grid.querySelectorAll('button'))button.disabled=false;
  }
 }
 host.addEventListener('wheel',event=>{
  event.preventDefault();
  setProgress(p+event.deltaY*(event.deltaMode===1?18:event.deltaMode===2?innerHeight:1)/5600);
 },{signal,passive:false});
 let touchY;
 host.addEventListener('touchstart',event=>{
  if(!event.target.closest('button,input'))touchY=event.touches[0].clientY;
 },{signal,passive:true});
 host.addEventListener('touchmove',event=>{
  if(touchY==null)return;
  event.preventDefault();
  const now=event.touches[0].clientY;
  setProgress(p+(touchY-now)/2800);
  touchY=now;
 },{signal,passive:false});
 for(const type of ['touchend','touchcancel'])host.addEventListener(type,()=>{touchY=null;},{signal});
 host.addEventListener('keydown',event=>{
  if(event.target.closest('button,input'))return;
  const step={ArrowDown:.045,ArrowUp:-.045,PageDown:.15,PageUp:-.15,' ':.15}[event.key];
  if(!step&&event.key!=='Home'&&event.key!=='End')return;
  event.preventDefault();
  setProgress(event.key==='Home'?0:event.key==='End'?1:p+step);
 },{signal});
 range.addEventListener('input',()=>setProgress(Number(range.value)/1000),{signal});
 setProgress(roomOnly?1:0);
 return {
  setProgress,toRoom:()=>setProgress(1),selectStation,
  dispose:()=>controller.abort(),
  snapshot:()=>({mode:p>=.986?'monitor-room':current>=0?'story':'falling',chapter:current,storyReady:true,compatible:true})
 };
}
