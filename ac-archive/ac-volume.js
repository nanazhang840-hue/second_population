const mix=(a,b,t)=>a+(b-a)*t;
const A=[170,48,-160],B=[459,107,20],C=[459,412,20],D=[159,359,-160];
const G=[291,41,-354],E=[580,100,-174],F=[583,390,-174],H=[283,337,-354];
export const AC_GEOMETRY={front:[A,B,C,D],right:[B,E,F,C],top:[G,E,B,A],rear:[E,G,H,F],left:[G,A,D,H]};
export function pointOnFace(face,u,v){return quad(AC_GEOMETRY[face],u,v);}
function quad(c,u,v){return c[0].map((_,i)=>mix(mix(c[0][i],c[1][i],u),mix(c[3][i],c[2][i],u),v));}
function normal(c){const u=c[1].map((v,i)=>v-c[0][i]),v=c[3].map((v,i)=>v-c[0][i]);const n=[u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]];const length=Math.hypot(...n);return n.map(v=>v/length);}
function inside(x,y,c){let yes=false;for(let i=0,j=c.length-1;i<c.length;j=i++){if((c[i][1]>y)!==(c[j][1]>y)&&x<(c[j][0]-c[i][0])*(y-c[i][1])/(c[j][1]-c[i][1])+c[i][0])yes=!yes;}return yes;}
export function projectVolumePoint(p,yaw){const x=p[0]-358.5,z=p[2]+167;return[358.5+x*Math.cos(yaw)+z*Math.sin(yaw),p[1],-x*Math.sin(yaw)+z*Math.cos(yaw)];}
export function buildVolume(data,width,height,edges){
 const faces=[{corners:[A,B,C,D],uv:[A,B,C,D]}, {corners:[B,E,F,C],uv:[B,E,F,C]}, {corners:[G,E,B,A],uv:[G,E,B,A]}, {corners:[E,G,H,F],uv:[B,E,F,C]}, {corners:[G,A,D,H],uv:[B,E,F,C]}];
 const sample=(x,y)=>Math.max(0,Math.min(height-1,Math.round(y)))*width*4+Math.max(0,Math.min(width-1,Math.round(x)))*4;
 const cloud=[];
 for(let f=0;f<faces.length;f++){const face=faces[f],n=normal(face.corners),points=[];const nx=f===0?155:80,ny=f===2?60:155;for(let iy=0;iy<=ny;iy++)for(let ix=0;ix<=nx;ix++){const u=ix/nx,v=iy/ny,p=quad(face.corners,u,v),uv=quad(face.uv,u,v),i=sample(uv[0],uv[1]),l=(data[i]+data[i+1]+data[i+2])/3;if(l<28)continue;points.push({p,r:data[i],g:data[i+1],b:data[i+2],edge:edges[i+3]>30,seed:((ix*31+iy*71+f*47)%997)/997});}cloud.push({normal:n,points});}
 // Retain the approved image's broken casing, feet and peripheral fragments.
 const fragments=[];for(let y=0;y<height;y+=3)for(let x=0;x<width;x+=3){if(faces.slice(0,3).some(f=>inside(x,y,f.corners)))continue;const i=sample(x,y);if(data[i]+data[i+1]+data[i+2]<210)continue;fragments.push({p:[x,y,x>459?20-(x-459)*1.6:-160+(x-170)*.62],r:data[i],g:data[i+1],b:data[i+2],edge:true,seed:((x*31+y*71)%997)/997});}cloud.push({normal:normal([A,B,C,D]),points:fragments});return cloud;
}
export function drawVolume(ctx,cloud,yaw,completion,opacity){
 const sin=Math.sin(yaw),cos=Math.cos(yaw);
 const visible=cloud.filter(face=>-face.normal[0]*sin+face.normal[2]*cos>-.03).sort((a,b)=>{const depth=f=>f.points.length?projectVolumePoint(f.points[Math.floor(f.points.length/2)].p,yaw)[2]:0;return depth(a)-depth(b);});
 ctx.globalCompositeOperation='screen';
 for(const face of visible)for(const dot of face.points){if(!dot.edge&&dot.seed>completion)continue;const p=projectVolumePoint(dot.p,yaw),shade=.78+.22*Math.cos(yaw),size=completion>.5?1.8:1.1;ctx.globalAlpha=opacity*(dot.edge?.8:.75)*shade;ctx.fillStyle=completion<.12?'#a7d9e8':`rgb(${dot.r},${dot.g},${dot.b})`;ctx.fillRect(p[0],p[1],size,size);}
}
