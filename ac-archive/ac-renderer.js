const TAU=Math.PI*2,W=3.6,H=2.5,D=1.1;
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
const hash=n=>{const x=Math.sin(n*127.1+311.7)*43758.5453;return x-Math.floor(x);};
export function rotatePoint([x,y,z],yaw,pitch=-.12){const a=x*Math.cos(yaw)+z*Math.sin(yaw),b=-x*Math.sin(yaw)+z*Math.cos(yaw);return[a,y*Math.cos(pitch)-b*Math.sin(pitch),y*Math.sin(pitch)+b*Math.cos(pitch)];}
function ring(x,y,z,r,n=64){return Array.from({length:n+1},(_,i)=>[x+Math.cos(i/n*TAU)*r,y+Math.sin(i/n*TAU)*r,z]);}
function rect(x,y,z,w,h){return[[x,y,z],[x+w,y,z],[x+w,y+h,z],[x,y+h,z],[x,y,z]];}
const segments=[];
function path(points,side='all',weight=1){for(let i=1;i<points.length;i++)segments.push({a:points[i-1],b:points[i],side,weight});}
for(const z of[-D/2,D/2])path(rect(-W/2,-H/2,z,W,H),'all',1.3);
for(const x of[-W/2,W/2])for(const y of[-H/2,H/2])path([[x,y,-D/2],[x,y,D/2]],'all',1.2);
for(const r of[.17,.24,.55,.83,.96,1.02])path(ring(-.61,.03,D/2+.015,r,72),'front',r>.9?1.15:.55);
for(let i=0;i<28;i++){const a=i/28*TAU;path([[-.61+Math.cos(a)*.2,.03+Math.sin(a)*.2,D/2+.025],[-.61+Math.cos(a)*1.01,.03+Math.sin(a)*1.01,D/2+.025]],'front',.65);}
for(let i=0;i<26;i++){const y=-.98+i*.079,dx=Math.sqrt(Math.max(0,.99*.99-y*y));path([[-.61-dx,.03+y,D/2+.027],[-.61+dx,.03+y,D/2+.027]],'front',.4);}
path(rect(.57,-1.07,D/2+.025,1.03,2.14),'front',1.1);
for(let i=0;i<6;i++)path(rect(.75,-.82+i*.115,D/2+.04,.66,.035),'front',.7);
for(const [x,y]of[[-1.62,-1.06],[-1.62,1.06],[1.58,1.06],[1.58,-1.06]])path(ring(x,y,D/2+.04,.034,10),'front',.7);
for(let i=0;i<20;i++)path([[-1.64,-1.08+i*.111,-D/2-.01],[1.64,-1.08+i*.111,-D/2-.01]],'rear',.55);
for(let i=0;i<18;i++)path([[-1.65+i*.194,-1.1,-D/2-.012],[-1.65+i*.194,1.1,-D/2-.012]],'rear',.42);
for(const x of[-W/2-.01,W/2+.01])for(let i=0;i<13;i++)path([[x,-1.01+i*.165,-.43],[x,-1.01+i*.165,.43]],x<0?'left':'right',.65);
for(const x of[-1.18,1.18]){path(rect(x-.23,-1.45,-.36,.46,.12),'all',.9);path([[x-.23,-1.25,-.36],[x-.23,-1.45,-.36],[x+.23,-1.45,-.36],[x+.23,-1.25,-.36]],'all',.85);path([[x-.23,-1.45,.24],[x+.23,-1.45,.24]],'all',.9);}
path([[1.81,.5,-.34],[2,.5,-.34],[2,.2,-.34],[1.9,0,-.34],[2,-.45,-.34],[1.9,-.85,-.34],[1.8,-.85,-.34]],'right',1);

export class ACModel{
constructor(canvas){this.canvas=canvas;this.ctx=canvas.getContext('2d');this.width=1;this.height=1;this.resize();}
resize(){const r=this.canvas.getBoundingClientRect();this.width=Math.max(1,r.width);this.height=Math.max(1,r.height);const dpr=Math.min(devicePixelRatio||1,1.5);this.canvas.width=Math.round(this.width*dpr);this.canvas.height=Math.round(this.height*dpr);this.ctx.setTransform(dpr,0,0,dpr,0,0);}
project(p,yaw,pitch,scale,cx,cy){const[x,y,z]=rotatePoint(p,yaw,pitch);const f=7.8/(7.8-z);return[cx+x*scale*f,cy-y*scale*f,z];}
clear(){this.ctx.clearRect(0,0,this.width,this.height);}
drawSolid(time){const ctx=this.ctx,w=this.width,h=this.height;this.clear();const yaw=-.45+Math.sin(time*.0002)*.018,pitch=-.13,scale=Math.min(w*.19,h*.245),cx=w*.5,cy=h*.54;const project=p=>this.project(p,yaw,pitch,scale,cx,cy);const A=[-W/2,-H/2,-D/2],B=[W/2,-H/2,-D/2],C=[W/2,H/2,-D/2],E=[-W/2,H/2,-D/2],F=[-W/2,-H/2,D/2],G=[W/2,-H/2,D/2],I=[W/2,H/2,D/2],J=[-W/2,H/2,D/2];
const shadow=ctx.createRadialGradient(cx,cy+scale*1.55,0,cx,cy+scale*1.55,scale*2.3);shadow.addColorStop(0,'#000000cc');shadow.addColorStop(1,'#00000000');ctx.fillStyle=shadow;ctx.save();ctx.translate(cx,cy+scale*1.55);ctx.scale(1,.16);ctx.beginPath();ctx.ellipse(0,0,scale*2.4,scale*2.4,0,0,TAU);ctx.fill();ctx.restore();
const faces=[{p:[A,B,C,E],color:'#747f7c'},{p:[B,G,I,C],color:'#747f7d'},{p:[A,F,J,E],color:'#7f8b87'},{p:[E,C,I,J],color:'#c2cdc7'},{p:[F,G,I,J],color:'#b2beb7'}].sort((a,b)=>a.p.reduce((s,p)=>s+project(p)[2],0)-b.p.reduce((s,p)=>s+project(p)[2],0));
for(const f of faces){const pts=f.p.map(project);ctx.beginPath();pts.forEach((p,i)=>i?ctx.lineTo(p[0],p[1]):ctx.moveTo(p[0],p[1]));ctx.closePath();const g=ctx.createLinearGradient(cx-scale*1.4,cy-scale,cx+scale,cy+scale*1.4);g.addColorStop(0,f.color);g.addColorStop(1,'#687974');ctx.fillStyle=g;ctx.fill();ctx.strokeStyle='#d4dfd033';ctx.lineWidth=1;ctx.stroke();}
const circle=(r,fill,stroke,line=1)=>{const pts=ring(-.61,.03,D/2+.03,r,80).map(project);ctx.beginPath();pts.forEach((p,i)=>i?ctx.lineTo(p[0],p[1]):ctx.moveTo(p[0],p[1]));if(fill){ctx.fillStyle=fill;ctx.fill();}if(stroke){ctx.strokeStyle=stroke;ctx.lineWidth=line;ctx.stroke();}};
circle(1.035,'#424f4b','#d5ddd177',2);circle(.96,'#12201e','#61756a',1);for(let i=0;i<3;i++){const a=i*TAU/3+.5;const pts=[[-.61,.03,D/2+.04],[-.61+Math.cos(a)*.9,.03+Math.sin(a)*.9,D/2+.04],[-.61+Math.cos(a+.75)*.8,.03+Math.sin(a+.75)*.8,D/2+.04],[-.61+Math.cos(a+1.1)*.3,.03+Math.sin(a+1.1)*.3,D/2+.04]].map(project);ctx.beginPath();pts.forEach((p,j)=>j?ctx.lineTo(p[0],p[1]):ctx.moveTo(p[0],p[1]));ctx.closePath();ctx.fillStyle='#364640';ctx.fill();}
for(const r of[.23,.46,.68,.88,1.01])circle(r,null,'#b7c7bc77',1.2);for(let i=0;i<24;i++){const a=i*TAU/24;const p=project([-.61+Math.cos(a)*.2,.03+Math.sin(a)*.2,D/2+.05]),q=project([-.61+Math.cos(a),.03+Math.sin(a),D/2+.05]);ctx.beginPath();ctx.moveTo(p[0],p[1]);ctx.lineTo(q[0],q[1]);ctx.strokeStyle='#c0d1c577';ctx.lineWidth=.8;ctx.stroke();}circle(.17,'#667b6e','#c4d6ca66',1);
for(const s of segments){if(s.side==='rear'||s.side==='right')continue;if(s.side==='all'&&s.weight<1)continue;const a=project(s.a),b=project(s.b);ctx.beginPath();ctx.moveTo(a[0],a[1]);ctx.lineTo(b[0],b[1]);ctx.strokeStyle=s.side==='left'?'#34463a99':'#4f655466';ctx.lineWidth=s.weight;ctx.stroke();}
for(const x of[-1.18,1.18]){const pts=rect(x-.24,-1.44,.24,.48,.13).map(project);ctx.beginPath();pts.forEach((p,i)=>i?ctx.lineTo(p[0],p[1]):ctx.moveTo(p[0],p[1]));ctx.fillStyle='#7c8f83';ctx.fill();}
const tl=project([-W/2,H/2,0]),br=project([W/2,-H/2,0]);this.bounds={x:Math.min(tl[0],br[0])-scale*.15,y:tl[1]-scale*.12,w:Math.abs(br[0]-tl[0])+scale*.3,h:Math.abs(br[1]-tl[1])+scale*.35};}
drawWire(time,{yaw=-.45,opacity=1,reveal=1,subtle=false}={}){const ctx=this.ctx,w=this.width,h=this.height;this.clear();if(opacity<=0)return;const pitch=-.14,scale=Math.min(w*.195,h*.267),cx=w*.5,cy=h*.49;const c=Math.cos(yaw),s=Math.sin(yaw),frame=Math.floor(time/85);ctx.globalCompositeOperation='lighter';ctx.globalAlpha=opacity;ctx.lineCap='square';
segments.forEach((seg,index)=>{if(seg.side==='front'&&c<.08||seg.side==='rear'&&c>-.08||seg.side==='left'&&s>.1||seg.side==='right'&&s<-.1)return;const seed=hash(index+51);if(seed>reveal*.92)return;const a=this.project(seg.a,yaw,pitch,scale,cx,cy),b=this.project(seg.b,yaw,pitch,scale,cx,cy);const band=Math.floor(a[1]/21);if(!subtle&&hash(band+frame*.031)>.87)return;let jitter=0;if(!subtle&&hash(band+Math.floor(frame/3)*9)>.94)jitter=(hash(band+frame)-.5)*34;const fade=subtle?.9:(.3+hash(index+Math.floor(frame/2)*.003)*.7);ctx.strokeStyle='rgba(164,219,237,'+(fade*seg.weight*.75)+')';ctx.lineWidth=subtle?.7:.65;ctx.beginPath();ctx.moveTo(a[0]+jitter,a[1]);ctx.lineTo(b[0]+jitter,b[1]);ctx.stroke();if(!subtle&&seed<.25){ctx.fillStyle='rgba(205,239,249,'+fade+')';ctx.fillRect(Math.round(a[0]+jitter),Math.round(a[1]),1.5+seed*7,1.2);}});
if(!subtle){for(let i=0;i<120;i++){const seed=hash(i+frame*.03);if(seed>reveal*.75)continue;const x=cx+(hash(i*13)-.5)*scale*4.6,y=cy+(hash(i*17)-.5)*scale*2.7;if(hash(i+frame)>.6)continue;ctx.fillStyle='rgba(172,225,243,'+(.1+seed*.3)+')';ctx.fillRect(x,y,hash(i*21)>.85?7:1.5,1.2);}}
ctx.globalAlpha=1;ctx.globalCompositeOperation='source-over';}
}
