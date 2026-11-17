/* 第二人口 · 电影展示模式 · 无边界深场环境
   复用 space/hall.js 的 PMREM 程序化环境贴图 technique 与发光贴图，
   但**不建地面、不建光带、不建星空**：纵深只由物体大小 / 位置 / 遮挡 / 光照 / 镜头建立。
   环境贴图完全确定性（无 Math.random），保证重播一致。 */
import * as THREE from '../integration/vendor/three-r170.module.js';
import { makeGlowTexture } from '../space/hall.js';
import { FOG } from './config.js';

function makeEnvTexture() {
  const c = document.createElement('canvas');
  c.width = 1024; c.height = 512;
  const g = c.getContext('2d');
  g.fillStyle = '#05080b';
  g.fillRect(0, 0, c.width, c.height);

  /* 地平线方向极淡冷光带：给金属一条可读的高光来源 */
  const band = g.createLinearGradient(0, 208, 0, 302);
  band.addColorStop(0, 'rgba(10,14,20,0)');
  band.addColorStop(.45, 'rgba(40,52,64,.50)');
  band.addColorStop(1, 'rgba(10,14,20,0)');
  g.fillStyle = band;
  g.fillRect(0, 208, c.width, 94);

  const softbox = (cx, cy, w, h, inner, outer) => {
    const rg = g.createRadialGradient(cx, cy, 1, cx, cy, Math.max(w, h));
    rg.addColorStop(0, inner); rg.addColorStop(1, outer);
    g.save(); g.translate(cx, cy); g.scale(w / Math.max(w, h), h / Math.max(w, h)); g.translate(-cx, -cy);
    g.fillStyle = rg; g.beginPath(); g.arc(cx, cy, Math.max(w, h), 0, Math.PI * 2); g.fill(); g.restore();
  };
  softbox(210, 148, 132, 80, 'rgba(228,238,242,.95)', 'rgba(40,52,62,0)');   // 左前上主光
  softbox(742, 196, 106, 62, 'rgba(150,178,200,.52)', 'rgba(30,40,50,0)');  // 右后冷补
  softbox(512, 470, 220, 90, 'rgba(52,40,30,.34)', 'rgba(20,16,12,0)');     // 下方极弱暖反弹

  const tex = new THREE.CanvasTexture(c);
  tex.mapping = THREE.EquirectangularReflectionMapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function buildEnvironment(scene, renderer) {
  const pmrem = new THREE.PMREMGenerator(renderer);
  pmrem.compileEquirectangularShader();
  const src = makeEnvTexture();
  const rt = pmrem.fromEquirectangular(src);
  scene.environment = rt.texture;
  src.dispose(); pmrem.dispose();

  scene.background = new THREE.Color(FOG.color);
  scene.fog = new THREE.FogExp2(FOG.color, FOG.close);

  /* 主光（暖）+ 冷补 + 轮廓光 + 半球抬暗部：与档案空间同一套光照语言。
     深场无地面反弹，整体比档案空间再抬一档，保证暗场中形体可读。 */
  const key = new THREE.DirectionalLight('#efe4d2', 3.6);
  key.position.set(-9, 12, 12);
  key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024);
  key.shadow.camera.near = 1; key.shadow.camera.far = 40;
  key.shadow.camera.left = -9; key.shadow.camera.right = 9;
  key.shadow.camera.top = 9; key.shadow.camera.bottom = -9;
  key.shadow.bias = -0.0006; key.shadow.normalBias = 0.02;
  scene.add(key, key.target);

  const fill = new THREE.DirectionalLight('#8fa9c0', 1.15);
  fill.position.set(11, 5.5, 8);
  scene.add(fill);

  const rim = new THREE.DirectionalLight('#a3bacb', 0.95);
  rim.position.set(-2, 5, -24);
  scene.add(rim);

  const hemi = new THREE.HemisphereLight('#7e94a6', '#0a0d10', 0.68);
  scene.add(hemi);

  /* 远景弱洗光：让远排物体在雾里仍有轮廓，而不是全黑 */
  const backWash = new THREE.PointLight('#8ea6b6', 320, 120, 2);
  backWash.position.set(0, 8, -30);
  scene.add(backWash);

  return { key, fill, rim, hemi, backWash, glowTexture: makeGlowTexture(), envRT: rt };
}