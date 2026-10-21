export const UNIT_SIZE={width:3.1,height:2.7,depth:1.25};
const X=UNIT_SIZE.width/2,Y=UNIT_SIZE.height/2,Z=UNIT_SIZE.depth/2;
const A=[-X,Y,Z],B=[X,Y,Z],C=[X,-Y,Z],D=[-X,-Y,Z],G=[-X,Y,-Z],E=[X,Y,-Z],F=[X,-Y,-Z],H=[-X,-Y,-Z];
export const AC_GEOMETRY={front:[A,B,C,D],right:[B,E,F,C],top:[G,E,B,A],rear:[E,G,H,F],left:[G,A,D,H]};
export const FACE_NORMALS={front:[0,0,1],right:[1,0,0],top:[0,1,0],rear:[0,0,-1],left:[-1,0,0]};
export const CAMERA={distance:9,pitch:.24,baseYaw:-.54};
export function pointOnFace(face,u,v){const c=AC_GEOMETRY[face];return c[0].map((_,i)=>(1-v)*((1-u)*c[0][i]+u*c[1][i])+v*((1-u)*c[3][i]+u*c[2][i]));}
export function cameraPoint([x,y,z],yaw,pitch=CAMERA.pitch){const a=yaw+CAMERA.baseYaw,xx=x*Math.cos(a)+z*Math.sin(a),zz=-x*Math.sin(a)+z*Math.cos(a);return[xx,y*Math.cos(pitch)-zz*Math.sin(pitch),y*Math.sin(pitch)+zz*Math.cos(pitch)];}
export function projectCameraPoint(p,yaw){const [x,y,z]=cameraPoint(p,yaw);const factor=CAMERA.distance/(CAMERA.distance-z);return[x*factor,-y*factor,z];}
export function faceIsVisible(face,yaw){const n=cameraPoint(FACE_NORMALS[face],yaw),c=cameraPoint(pointOnFace(face,.5,.5),yaw);return n[0]*(-c[0])+n[1]*(-c[1])+n[2]*(CAMERA.distance-c[2])>0;}
