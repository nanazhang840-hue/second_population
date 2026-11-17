/* 档案空间 · 深场（对照参考图重做）
   没有墙、没有顶、没有地平线：只有一块湿黑地面、程序化环境贴图、指数雾与三根远处的光带。
   一切都是可离线复现的程序化贴图，不加载任何外部 HDRI / 贴图。 */
import * as THREE from '../integration/vendor/three-r170.module.js';

/* 程序化 equirect 环境图：近黑底 + 两块柔光箱 + 地面暖反弹。
   PMREM 之后成为金属/玻璃的高光来源——这是"不再是塑料"的管线级改动。 */
function makeEnvTexture() {
  const c = document.createElement('canvas');
  c.width = 1024; c.height = 512;
  const g = c.getContext('2d');

  g.fillStyle = '#04060a';
  g.fillRect(0, 0, c.width, c.height);

  /* 地平线方向的极淡冷光带 */
  const band = g.createLinearGradient(0, 210, 0, 300);
  band.addColorStop(0, 'rgba(10,14,20,0)');
  band.addColorStop(.45, 'rgba(38,50,62,.55)');
  band.addColorStop(1, 'rgba(10,14,20,0)');
  g.fillStyle = band;
  g.fillRect(0, 210, c.width, 90);

  /* 两块柔光箱：左前上方为主光，右后为冷补 */
  const softbox = (cx, cy, w, h, inner, outer) => {
    const rg = g.createRadialGradient(cx, cy, 1, cx, cy, Math.max(w, h));
    rg.addColorStop(0, inner);
    rg.addColorStop(1, outer);
    g.save();
    g.translate(cx, cy);
    g.scale(w / Math.max(w, h), h / Math.max(w, h));
    g.translate(-cx, -cy);
    g.fillStyle = rg;
    g.beginPath();
    g.arc(cx, cy, Math.max(w, h), 0, Math.PI * 2);
    g.fill();
    g.restore();
  };
  softbox(210, 150, 130, 78, 'rgba(226,236,240,.95)', 'rgba(40,52,62,0)');
  softbox(742, 196, 104, 60, 'rgba(150,178,200,.55)', 'rgba(30,40,50,0)');

  /* 地面暖反弹 */
  const warm = g.createLinearGradient(0, 340, 0, 512);
  warm.addColorStop(0, 'rgba(44,32,24,0)');
  warm.addColorStop(1, 'rgba(58,40,28,.55)');
  g.fillStyle = warm;
  g.fillRect(0, 340, c.width, 172);

  const tex = new THREE.CanvasTexture(c);
  tex.mapping = THREE.EquirectangularReflectionMapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/* 地面粗糙度贴图：竖向拖影，让环境高光在地面上拉成湿痕 */
function makeFloorRoughness() {
  const c = document.createElement('canvas');
  c.width = 1024; c.height = 1024;
  const g = c.getContext('2d');
  g.fillStyle = '#8c8c8c';
  g.fillRect(0, 0, c.width, c.height);

  for (let i = 0; i < 90; i++) {
    const x = Math.random() * c.width;
    const w = 4 + Math.random() * 46;
    const a = .04 + Math.random() * .14;
    const grad = g.createLinearGradient(x, 0, x + w, 0);
    grad.addColorStop(0, `rgba(20,20,20,0)`);
    grad.addColorStop(.5, `rgba(20,20,20,${a})`);
    grad.addColorStop(1, `rgba(20,20,20,0)`);
    g.fillStyle = grad;
    g.fillRect(x, 0, w, c.height);
  }
  /* 稀疏的沙尘斑：局部变粗糙，打散整片镜面 */
  for (let i = 0; i < 220; i++) {
    const x = Math.random() * c.width, y = Math.random() * c.height;
    const r = 8 + Math.random() * 70;
    const rg = g.createRadialGradient(x, y, 1, x, y, r);
    rg.addColorStop(0, 'rgba(150,150,150,.20)');
    rg.addColorStop(1, 'rgba(150,150,150,0)');
    g.fillStyle = rg;
    g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(3, 4);
  tex.anisotropy = 4;
  return tex;
}

/* 柔光晕贴图：车灯、售货机灯带用，替代后期 bloom */
export function makeGlowTexture() {
  const c = document.createElement('canvas');
  c.width = 128; c.height = 128;
  const g = c.getContext('2d');
  const rg = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  rg.addColorStop(0, 'rgba(255,255,255,1)');
  rg.addColorStop(.18, 'rgba(255,255,255,.72)');
  rg.addColorStop(.45, 'rgba(255,255,255,.18)');
  rg.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = rg;
  g.fillRect(0, 0, 128, 128);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/* 接触阴影贴图：柔和椭圆，贴地，替代硬件阴影下的"悬空感" */
export function makeContactTexture() {
  const c = document.createElement('canvas');
  c.width = 256; c.height = 256;
  const g = c.getContext('2d');
  const rg = g.createRadialGradient(128, 128, 2, 128, 128, 126);
  rg.addColorStop(0, 'rgba(0,0,0,.86)');
  rg.addColorStop(.42, 'rgba(0,0,0,.44)');
  rg.addColorStop(.72, 'rgba(0,0,0,.12)');
  rg.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = rg;
  g.fillRect(0, 0, 256, 256);
  return new THREE.CanvasTexture(c);
}

export function buildHall(scene, renderer) {
  const group = new THREE.Group();

  /* 环境贴图 */
  const pmrem = new THREE.PMREMGenerator(renderer);
  pmrem.compileEquirectangularShader();
  const envSrc = makeEnvTexture();
  const envRT = pmrem.fromEquirectangular(envSrc);
  scene.environment = envRT.texture;
  envSrc.dispose();
  pmrem.dispose();

  /* 雾：吃掉一切边界，远端只剩明度差 */
  scene.fog = new THREE.FogExp2('#04060a', 0.014);

  /* 地面：高金属度 + 低粗糙度 + 竖向拖影粗糙度贴图 = 湿黑反光面 */
  const floorGeo = new THREE.PlaneGeometry(140, 170);
  const floorMat = new THREE.MeshStandardMaterial({
    color: '#0b0d10',
    metalness: .90,
    roughness: 1.0,
    roughnessMap: makeFloorRoughness(),
    envMapIntensity: 1.25,
    transparent: true,
    opacity: 0.82
  });
  const floor = new THREE.Mesh(floorGeo, floorMat);
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(0, 0, -22);
  floor.receiveShadow = false;
  floor.renderOrder = 1;
  group.add(floor);

  /* 远处的三根横向光带：参考图背景里那几道极淡的水平亮线，负责给纵深一个终点 */
  const barMat = new THREE.MeshBasicMaterial({
    color: '#8fa6b4', transparent: true, opacity: .055,
    depthWrite: false, blending: THREE.AdditiveBlending, fog: false
  });
  for (const [y, w, o, z] of [[2.4, 46, .090, -36], [4.1, 34, .062, -40], [0.9, 58, .075, -34]]) {
    const bar = new THREE.Mesh(new THREE.PlaneGeometry(w, .05), barMat.clone());
    bar.material.opacity = o;
    bar.position.set(0, y, z);
    group.add(bar);
  }

  /* 远处一枚冷色指示灯：唯一的高饱和冷点 */
  const dotMat = new THREE.MeshBasicMaterial({ color: '#4d7f9a', transparent: true, opacity: .5, depthWrite: false, fog: false });
  const dot = new THREE.Mesh(new THREE.PlaneGeometry(.9, .02), dotMat);
  dot.position.set(-9.5, 1.35, -43);
  group.add(dot);

  scene.add(group);
  return { group, floor };
}
