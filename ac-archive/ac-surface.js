import {buildVolume,drawVolume} from './ac-volume.js';
const clamp=x=>Math.max(0,Math.min(1,x));
const noise=n=>{const v=Math.sin(n*91.733)*43758.5453;return v-Math.floor(v);};
export function surfacePlacement(width,height){const w=Math.min(width*.94,height*1.54);return{x:(width-w)/2,y:(height-w*450/717)/2,w,h:w*450/717};}
export function edgePixels(data,width,height){const output=new Uint8ClampedArray(data.length),lum=i=>data[i]*.2126+data[i+1]*.7152+data[i+2]*.0722;for(let y=1;y<height-1;y++)for(let x=1;x<width-1;x++){const i=(y*width+x)*4,dx=lum(i+4)-lum(i-4),dy=lum(i+width*4)-lum(i-width*4);const strength=Math.hypot(dx,dy);if(strength<24||lum(i)<35)continue;output[i]=166;output[i+1]=222;output[i+2]=242;output[i+3]=Math.min(225,strength*2);}return output;}
export class ACSurface{
 constructor(canvas){this.canvas=canvas;this.ctx=canvas.getContext('2d');this.image=new Image();this.ready=false;this.image.onload=()=>{this.edges=document.createElement('canvas');this.edges.width=this.image.naturalWidth;this.edges.height=this.image.naturalHeight;const c=this.edges.getContext('2d',{willReadFrequently:true});c.drawImage(this.image,0,0);const pixels=c.getImageData(0,0,this.edges.width,this.edges.height),edgeData=edgePixels(pixels.data,this.edges.width,this.edges.height);this.cloud=buildVolume(pixels.data,this.edges.width,this.edges.height,edgeData);pixels.data.set(edgeData);c.putImageData(pixels,0,0);this.ready=true;};this.image.src='./assets/ac-reconstructed.png';this.resize();}
 resize(){const r=this.canvas.getBoundingClientRect();this.width=Math.max(1,r.width);this.height=Math.max(1,r.height);const dpr=Math.min(devicePixelRatio||1,1.5);this.canvas.width=this.width*dpr;this.canvas.height=this.height*dpr;this.ctx.setTransform(dpr,0,0,dpr,0,0);}
 drawAcquisition(time,frame){
 const c=this.ctx;c.clearRect(0,0,this.width,this.height);if(!this.ready)return;
 const box=surfacePlacement(this.width,this.height);c.save();c.translate(box.x,box.y);c.scale(box.w/717,box.h/450);
 drawVolume(c,this.cloud,frame.yaw,frame.completion,frame.objectOpacity*(1-frame.surfaceAlpha));
 if(frame.surfaceAlpha>0){c.globalCompositeOperation='screen';c.globalAlpha=frame.surfaceAlpha*frame.objectOpacity;c.drawImage(this.image,0,0,717,450);}
 c.restore();
 }
 draw(time,{completion=1,opacity=1,operating=false,acquiring=false}={}){
 const c=this.ctx;c.clearRect(0,0,this.width,this.height);if(!this.ready)return;
 const box=surfacePlacement(this.width,this.height);c.save();
 c.globalAlpha=opacity;c.globalCompositeOperation='screen';
 // Both passes use the SAME pixels, placement and transform. No second geometry is introduced.
 c.translate(box.x+box.w/2,box.y+box.h/2);
 const sway=acquiring?Math.sin((1-completion)*Math.PI*2)*.035:0;
 c.transform(1-Math.abs(sway)*.6,sway*.18,sway*.12,1,0,0);
 c.translate(-box.w/2,-box.h/2);c.scale(box.w/717,box.h/450);
 if(completion<1){c.globalAlpha=opacity*(1-completion*.65);c.drawImage(this.edges,0,0,717,450);}
 c.globalAlpha=opacity;
 if(completion>=1)c.drawImage(this.image,0,0,717,450);
 else if(completion>0){const cols=90,rows=56,sw=717/cols,sh=450/rows;for(let y=0;y<rows;y++)for(let x=0;x<cols;x++){const threshold=noise(y*cols+x)*.7+y/rows*.3;if(threshold>completion)continue;c.globalAlpha=opacity*clamp((completion-threshold)*12);c.drawImage(this.image,x*sw,y*sh,sw,sh,x*sw,y*sh,sw+.15,sh+.15);}}
 c.restore();
 }
}
