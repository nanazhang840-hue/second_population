import {AC_GEOMETRY,pointOnFace,projectCameraPoint,faceIsVisible,UNIT_SIZE} from './ac-camera.js';
const TAU=Math.PI*2;
const mesh=[];
function add(face,points,level=.3,weight=1){for(let i=1;i<points.length;i++)mesh.push({face,a:points[i-1],b:points[i],level,weight});}
function uvLine(face,a,b,level=.3,weight=1){add(face,[pointOnFace(face,...a),pointOnFace(face,...b)],level,weight);}
function uvRect(face,x,y,w,h,level=.2,weight=1){const uv=[[x,y],[x+w,y],[x+w,y+h],[x,y+h],[x,y]];add(face,uv.map(p=>pointOnFace(face,...p)),level,weight);}
function ring(cx,cy,rx,ry,level,weight=1){const points=Array.from({length:81},(_,i)=>pointOnFace('front',cx+Math.cos(i*TAU/80)*rx,cy+Math.sin(i*TAU/80)*ry));add('front',points,level,weight);}
for(const face of Object.keys(AC_GEOMETRY)){uvRect(face,0,0,1,1,.02,1.3);uvRect(face,.025,.025,.95,.95,.08,.8);}
// The fan occupies the front panel; the service grille belongs on the side.
const fanX=.47,fanY=.52,fanRX=1.17/UNIT_SIZE.width,fanRY=1.17/UNIT_SIZE.height;
for(let i=0;i<16;i++)ring(fanX,fanY,fanRX*(.15+i*.85/15),fanRY*(.15+i*.85/15),.12+i*.012,i%4===0?1:.65);
for(let i=0;i<40;i++){const a=i*TAU/40;uvLine('front',[fanX+Math.cos(a)*fanRX*.15,fanY+Math.sin(a)*fanRY*.15],[fanX+Math.cos(a)*fanRX,fanY+Math.sin(a)*fanRY],.2+(i%5)*.025,.8);}
for(const [x,y]of [[.055,.07],[.94,.07],[.94,.94],[.055,.94]]){const points=Array.from({length:13},(_,i)=>pointOnFace('front',x+Math.cos(i*TAU/12)*.024/UNIT_SIZE.width,y+Math.sin(i*TAU/12)*.024/UNIT_SIZE.height));add('front',points,.18,.7);}
for(let i=0;i<42;i++){const y=.05+i*.9/41;uvLine('rear',[.04,y],[.96,y],.16+(i%7)*.035,.75);uvLine('left',[.04,y],[.96,y],.18+(i%7)*.03,.6);}
for(let i=0;i<22;i++){const x=.04+i*.92/21;uvLine('rear',[x,.04],[x,.96],.32,.45);uvLine('left',[x,.04],[x,.96],.35,.4);}
uvRect('right',.08,.055,.82,.9,.12,.9);
for(let i=0;i<30;i++){const x=.12+i*.7/29;uvLine('right',[x,.08],[x,.91],.25+(i%5)*.04,.38);}
for(let i=0;i<30;i++){const y=.08+i*.83/29;uvLine('right',[.12,y],[.82,y],.3+(i%4)*.025,.4);}
for(let i=0;i<6;i++)uvRect('right',.2,.59+i*.045,.47,.015,.25+i*.025,.9);
for(let i=0;i<13;i++){const v=.08+i*.84/12;uvLine('top',[.04,v],[.96,v],.23,.48);}
for(let i=0;i<14;i++){const u=.05+i*.9/13;uvLine('top',[u,.04],[u,.96],.25,.45);}
for(const u of [.13,.83]){const p=pointOnFace('front',u,1),q=pointOnFace('front',u+.13,1);add('all',[p,[p[0],p[1]-.14,p[2]], [q[0],q[1]-.14,q[2]],q],.14,1.1);add('all',[[p[0],p[1]-.14,p[2]],[p[0],p[1]-.14,p[2]-.75],[q[0],q[1]-.14,q[2]-.75],[q[0],q[1]-.14,q[2]]],.24,.7);}
// A restrained diagonal net gives the scan a volumetric, electronic character.
for(const face of ['top','rear','right'])for(let y=0;y<7;y++)for(let x=0;x<9;x++)uvLine(face,[x/9,y/7],[(x+1)/9,(y+1)/7],.54,.25);
export function loaderPose(progress){const p=Math.max(0,Math.min(1,progress));return{yaw:Math.max(0,Math.min(1,(p-.18)/.7))*TAU*2,detail:Math.max(0,Math.min(1,(p-.16)/.4))};}
export class MeshLoader{
 constructor(canvas){this.canvas=canvas;this.ctx=canvas.getContext('2d');this.resize();}
 resize(){const r=this.canvas.getBoundingClientRect();this.width=Math.max(1,this.canvas.clientWidth||r.width);this.height=Math.max(1,this.canvas.clientHeight||r.height);this.pixelScale=.85;this.canvas.width=Math.round(this.width*this.pixelScale);this.canvas.height=Math.round(this.height*this.pixelScale);this.ctx.setTransform(this.pixelScale,0,0,this.pixelScale,0,0);}
 drawAcquisition(time,frame){const ctx=this.ctx,w=this.width,h=this.height;ctx.clearRect(0,0,w,h);if(frame.objectOpacity<=0)return;const yaw=frame.yaw,scale=Math.min(w*.66/4.1,h*.72/3.45),cx=w*.5,cy=h*.49;const projected=p=>{const q=projectCameraPoint(p,yaw);return[cx+q[0]*scale,cy+q[1]*scale];};
 ctx.save();ctx.globalCompositeOperation='screen';
 for(const face of ['all',...Object.keys(AC_GEOMETRY)]){const visible=face==='all'||faceIsVisible(face,yaw),alpha=visible?.9:.045;
 for(const weight of [.4,.8,1.3]){ctx.beginPath();let count=0;for(const line of mesh){if(line.face!==face||line.level>frame.completion||line.weight>weight||line.weight<=(weight===.4?0:weight===.8?.4:.8))continue;const a=projected(line.a),b=projected(line.b);ctx.moveTo(a[0],a[1]);ctx.lineTo(b[0],b[1]);count++;}if(!count)continue;ctx.globalAlpha=frame.objectOpacity*alpha*(.95+Math.sin(time*.003)*.05);ctx.strokeStyle='#b1e6f4';ctx.shadowColor='#76c2e2';ctx.shadowBlur=visible?2:0;ctx.lineWidth=weight===1.3?1.05:weight===.8?.72:.45;ctx.stroke();}
 }
 ctx.restore();}
}
