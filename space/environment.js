/* 档案空间 · 环境本体：地面档案标记、围墙、结构柱、后场货架、顶部灯带 */
import * as THREE from '../integration/vendor/three-r170.module.js';
import { PALETTE, addBox, addCyl, mergeParts, xform } from './objects.js';
import { OBJECTS } from './layout.js';

const FLOOR_W = 44, FLOOR_D = 64, FLOOR_CZ = -14, TEX = 2048;

function hash(x, y, z) {
  let h = 2166136261;
  for (const v of [x, y, z]) { h ^= Math.round(v * 100) | 0; h = Math.imul(h, 16777619); }
  return (h >>> 0) / 4294967296;
}

function stencil(ctx, text, x, y, size, spacing, alpha, rot = 0) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rot);
  ctx.font = `600 ${size}px "Consolas","Menlo","Microsoft YaHei",monospace`;
  ctx.textBaseline = 'middle';
  ctx.fillStyle = `rgba(176,184,176,${alpha})`;
  let cx = 0;
  for (const ch of text) { ctx.fillText(ch, cx, 0); cx += ctx.measureText(ch).width + spacing; }
  ctx.restore();
}

function makeFloorTexture() {
  const S = TEX, c = document.createElement('canvas');
  c.width = c.height = S;
  const ctx = c.getContext('2d');
  const px = x => (x + FLOOR_W / 2) / FLOOR_W * S;
  const py = z => (z - (FLOOR_CZ - FLOOR_D / 2)) / FLOOR_D * S;
  const m = S / FLOOR_D;

  ctx.fillStyle = '#252a2c';
  ctx.fillRect(0, 0, S, S);

  const grad = ctx.createLinearGradient(0, 0, 0, S);
  grad.addColorStop(0, 'rgba(4,6,7,.55)');
  grad.addColorStop(.55, 'rgba(255,255,255,.015)');
  grad.addColorStop(1, 'rgba(255,255,255,.05)');
  ctx.fillStyle = grad; ctx.fillRect(0, 0, S, S);

  /* 混凝土颗粒 */
  for (let i = 0; i < 9000; i++) {
    const x = hash(i, 1, 7) * S, y = hash(i, 2, 9) * S, r = .4 + hash(i, 3, 5) * 1.6;
    ctx.fillStyle = `rgba(${hash(i, 4, 2) > .5 ? '210,214,208' : '0,0,0'},${.02 + hash(i, 5, 3) * .05})`;
    ctx.fillRect(x, y, r, r);
  }
  /* 长划痕 */
  for (let i = 0; i < 60; i++) {
    const x = hash(i, 6, 1) * S, y = hash(i, 7, 2) * S, len = m * (1 + hash(i, 8, 3) * 5);
    ctx.strokeStyle = `rgba(190,194,188,${.02 + hash(i, 9, 4) * .03})`;
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + len * .2, y + len); ctx.stroke();
  }
  /* 伸缩缝 */
  ctx.strokeStyle = 'rgba(5,7,8,.6)'; ctx.lineWidth = 3;
  for (const x of [-22, -15, -8, -1, 6, 13, 20]) { ctx.beginPath(); ctx.moveTo(px(x), 0); ctx.lineTo(px(x), S); ctx.stroke(); }
  for (const z of [-44, -37, -30, -23, -16, -9, -2, 5, 12]) {
    ctx.beginPath(); ctx.moveTo(0, py(z)); ctx.lineTo(S, py(z)); ctx.stroke();
  }

  /* 中央通道两侧的旧道线（断续、磨损） */
  for (const x of [-2.75, 2.75]) {
    ctx.strokeStyle = 'rgba(168,174,166,.24)'; ctx.lineWidth = 2;
    for (let z = 16; z > -30; z -= 4) {
      ctx.beginPath(); ctx.moveTo(px(x), py(z)); ctx.lineTo(px(x), py(z - 2.2)); ctx.stroke();
    }
    ctx.strokeStyle = 'rgba(168,174,166,.20)';
    for (let z = 12; z > -30; z -= 1) {
      ctx.beginPath(); ctx.moveTo(px(x) - 4, py(z)); ctx.lineTo(px(x) - 4 - m * .18, py(z)); ctx.stroke();
    }
  }

  /* 顶灯落在地面的冷光带 */
  for (const z of [5, -2, -9, -16, -23]) {
    const g = ctx.createRadialGradient(px(0), py(z), 0, px(0), py(z), m * 5);
    g.addColorStop(0, 'rgba(196,208,206,.10)');
    g.addColorStop(1, 'rgba(196,208,206,0)');
    ctx.fillStyle = g;
    ctx.fillRect(px(0) - m * 5, py(z) - m * 5, m * 10, m * 10);
  }

  /* 库位框：五类各有自己的收容区 */
  const bays = [
    { x0: -10.8, x1: -2.6, z0: -23.2, z1: -1.0, code: 'B·01', name: 'VEHICLES', count: '05 UNITS' },
    { x0: 2.6, x1: 10.9, z0: -19.8, z1: 1.6, code: 'B·02', name: 'LIGHTING & MONITORING', count: '05 UNITS' },
    { x0: -10.9, x1: -2.0, z0: -27.4, z1: -17.2, code: 'B·03', name: 'SIGNAGE', count: '05 UNITS' },
    { x0: 1.4, x1: 8.6, z0: -4.6, z1: 3.9, code: 'B·04', name: 'BARRIERS', count: '05 UNITS' }
  ];
  for (const b of bays) {
    ctx.strokeStyle = 'rgba(170,178,170,.42)';
    ctx.lineWidth = 2;
    ctx.setLineDash([12, 9]);
    ctx.beginPath();
    ctx.rect(px(b.x0), py(b.z0), (b.x1 - b.x0) * m, (b.z1 - b.z0) * m);
    ctx.stroke();
    ctx.setLineDash([]);
    /* 角部实线短标 */
    const L = m * 1.1;
    for (const [x, z, sx, sz] of [[b.x0, b.z0, 1, 1], [b.x1, b.z0, -1, 1], [b.x0, b.z1, 1, -1], [b.x1, b.z1, -1, -1]]) {
      ctx.strokeStyle = 'rgba(190,198,190,.55)';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(px(x) + sx * L, py(z)); ctx.lineTo(px(x), py(z)); ctx.lineTo(px(x), py(z) + sz * L);
      ctx.stroke();
    }
    stencil(ctx, b.code, px(b.x0) + 10, py(b.z1) - m * 1.2, Math.round(m * 1.15), 3, .24);
    stencil(ctx, b.name, px(b.x0) + 10, py(b.z1) - m * .45, Math.round(m * .3), 2, .30);
    stencil(ctx, b.count, px(b.x0) + 10, py(b.z1) + m * .12, Math.round(m * .22), 2, .28);
    /* 靠通道一侧的长向喷字：像库房地面上的库位号 */
    const edgeX = b.x1 > 0 ? b.x0 + .55 : b.x1 - .55;
    const rot = b.x1 > 0 ? Math.PI / 2 : -Math.PI / 2;
    stencil(ctx, `${b.code}  ${b.name.split(' ')[0]}  ${b.count.split(' ')[0]}`,
      px(edgeX), py(b.z1 - 1.4), Math.round(m * .5), 2, .34, rot);
  }

  /* 地面大编号：从城市收容进馆的顺序号段 */
  stencil(ctx, 'A·0001 — 0024', px(-2.2), py(6.4), Math.round(m * .42), 3, .26);
  stencil(ctx, 'ARCHIVE HALL B  /  DEPOT 01  /  收容登记区', px(-2.2), py(7.4), Math.round(m * .30), 2, .30);

  /* 每件样本脚边的登记号：贴着地面，像库存喷码而不是展签 */
  for (const o of OBJECTS) {
    const ox = o.kind === 'gantry' || o.kind === 'banner' || o.kind === 'fence' || o.kind === 'guardrail' ? o.x + (o.x < 0 ? 2.6 : -2.6) : o.x + 1.35;
    const oz = o.z + (o.kind === 'gantry' ? 1.4 : o.kind === 'guardrail' || o.kind === 'fence' ? 0.9 : 0.75);
    stencil(ctx, o.id, px(ox), py(oz), Math.round(m * .24), 2, .34);
  }

  /* 每件样本的地面登记框：只画四角短线，像测绘/入库标记，不是停车位框 */
  const FOOT = {
    sedan: [5.0, 2.1], suv: [4.9, 2.2], truck: [6.8, 2.6], bus: [11.2, 2.7],
    streetlight: [1.0, 1.0], cameraPole: [.9, .9], gantry: [9.8, 1.0], metroSign: [.9, .9],
    banner: [3.7, .6], standSign: [.9, .9], jersey: [2.3, .8], guardrail: [6.6, .6],
    fence: [4.6, .6], kerb: [3.8, .9], manhole: [1.9, 1.9], laneMark: [3.7, 1.9], grate: [1.3, .9]
  };
  for (const o of OBJECTS) {
    const [fw, fd] = FOOT[o.kind] || [1, 1];
    const s = (o.scale || 1) * m;
    ctx.save();
    ctx.translate(px(o.x), py(o.z));
    ctx.rotate(-(o.ry || 0));
    const hw = fw / 2 * s, hd = fd / 2 * s, t = m * .32;
    ctx.strokeStyle = 'rgba(176,184,176,.26)';
    ctx.lineWidth = 2;
    for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
      const x = sx * hw, y = sz * hd;
      ctx.beginPath();
      ctx.moveTo(x - sx * t, y); ctx.lineTo(x, y); ctx.lineTo(x, y - sz * t);
      ctx.stroke();
    }
    ctx.restore();
  }

  /* 油渍与旧痕 */
  for (let i = 0; i < 16; i++) {
    const x = hash(i, 11, 3) * S, y = hash(i, 12, 4) * S, rx = m * (1 + hash(i, 13, 5) * 3), ry = m * (.6 + hash(i, 14, 6) * 2);
    const g = ctx.createRadialGradient(x, y, 0, x, y, rx);
    g.addColorStop(0, 'rgba(0,0,0,.16)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.save(); ctx.translate(x, y); ctx.scale(1, ry / rx); ctx.translate(-x, -y);
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, rx, 0, Math.PI * 2); ctx.fill(); ctx.restore();
  }

  /* 沿通道的旧轮迹 */
  ctx.fillStyle = 'rgba(0,0,0,.10)';
  for (const x of [-1.25, 1.25]) {
    for (let z = 9; z > -26; z -= .5) {
      const w = m * .38 * (0.8 + hash(x, z, 3) * .3);
      ctx.fillRect(px(x) - w / 2 + Math.sin(z * .3) * 2, py(z), w, m * .55);
    }
  }

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
  return tex;
}

export function buildEnvironment(scene, renderer) {
  const group = new THREE.Group();
  scene.add(group);

  const floorTex = makeFloorTexture();
  floorTex.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  const floorMat = new THREE.MeshStandardMaterial({ map: floorTex, color: '#ffffff', roughness: .94, metalness: .02 });
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(FLOOR_W, FLOOR_D), floorMat);
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(0, 0, FLOOR_CZ);
  floor.receiveShadow = true;
  group.add(floor);

  const outer = new THREE.Mesh(new THREE.PlaneGeometry(140, 140),
    new THREE.MeshStandardMaterial({ color: '#07090a', roughness: 1 }));
  outer.rotation.x = -Math.PI / 2;
  outer.position.y = -.06;
  group.add(outer);

  /* 围墙 / 顶棚 */
  const wallMat = new THREE.MeshStandardMaterial({ color: '#1b2022', roughness: .96, metalness: .02 });
  const wallGeo = new THREE.BoxGeometry(.45, 9.2, 45);
  for (const x of [-13.5, 13.5]) {
    const wall = new THREE.Mesh(wallGeo, wallMat);
    wall.position.set(x, 4.6, -8);
    wall.receiveShadow = true;
    group.add(wall);
  }
  const rear = new THREE.Mesh(new THREE.BoxGeometry(27.4, 9.2, .45), wallMat);
  rear.position.set(0, 4.6, -30.4);
  rear.receiveShadow = true;
  group.add(rear);

  const ceiling = new THREE.Mesh(new THREE.PlaneGeometry(28, 46),
    new THREE.MeshStandardMaterial({ color: '#171c1e', roughness: 1 }));
  ceiling.rotation.x = Math.PI / 2;
  ceiling.position.set(0, 9.2, -8);
  group.add(ceiling);

  /* 墙上刷的库位编号（像仓库喷字，不是展签） */
  const plates = [
    { text: 'B·01   VEHICLES   05', pos: [-13.24, 3.9, -7.0], ry: Math.PI / 2 },
    { text: 'B·02   LIGHTING   05', pos: [13.24, 3.9, -7.0], ry: -Math.PI / 2 },
    { text: 'B·03   SIGNAGE   05', pos: [-13.24, 3.9, -21.0], ry: Math.PI / 2 },
    { text: 'B·04   BARRIERS   05', pos: [13.24, 3.9, -15.0], ry: -Math.PI / 2 },
    { text: 'ARCHIVE HALL B  /  DEPOT 01', pos: [0, 4.6, -30.14], ry: 0 }
  ];
  for (const p of plates) {
    const c = document.createElement('canvas');
    c.width = 1024; c.height = 256;
    const g = c.getContext('2d');
    let size = 78;
    g.font = `600 ${size}px "Consolas","Menlo",monospace`;
    while (g.measureText(p.text).width > 960 && size > 30) {
      size -= 6;
      g.font = `600 ${size}px "Consolas","Menlo",monospace`;
    }
    g.textBaseline = 'middle';
    g.fillStyle = 'rgba(206,214,206,.88)';
    g.fillText(p.text, 24, 132);
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 4;
    const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, opacity: .42, depthWrite: false });
    const plane = new THREE.Mesh(new THREE.PlaneGeometry(5, 1.25), mat);
    plane.position.set(...p.pos);
    plane.rotation.y = p.ry;
    group.add(plane);
  }

  /* 后墙主标题：抬高到门架视线以上，只在尽头露出一条命名带，不构成 UI */
  {
    const c = document.createElement('canvas');
    c.width = 2048; c.height = 384;
    const g = c.getContext('2d');
    g.textBaseline = 'middle';
    g.font = '600 150px "Consolas","Menlo",monospace';
    g.fillStyle = 'rgba(212,219,210,.94)';
    g.fillText('SECOND POPULATION', 40, 140);
    g.font = '500 62px "Microsoft YaHei","PingFang SC",sans-serif';
    g.fillStyle = 'rgba(180,191,182,.80)';
    g.fillText('第二人口 · 城市工业物收容档案', 44, 276);
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 4;
    const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, opacity: .34, depthWrite: false });
    const plane = new THREE.Mesh(new THREE.PlaneGeometry(11, 2.06), mat);
    plane.position.set(-1.2, 8.05, -30.12);
    group.add(plane);
  }

  /* 结构柱、梁、墙缝 */
  const structure = [];
  for (const x of [-12.9, 12.9]) for (const z of [12, 4, -4, -12, -20, -28]) {
    addBox(structure, .6, 8.9, .6, x, 4.45, z, '#1d2325');
    addBox(structure, .78, .12, .78, x, .06, z, '#2b3032');
  }
  for (const x of [-12.9, 12.9]) {
    for (const y of [2.7, 5.2, 7.6]) addBox(structure, .1, .06, 44, x < 0 ? -13.2 : 13.2, y, -8, '#202628');
    addBox(structure, .22, .28, 44, x < 0 ? -13.25 : 13.25, 8.6, -8, '#23292b');
  }
  for (const z of [6, -2, -10, -18, -26]) addBox(structure, 26.4, .34, .34, 0, 8.72, z, '#22282a');
  for (const z of [-24, -30.2]) addBox(structure, 26.4, .1, .1, 0, 4.6, z, '#202628');
  group.add(new THREE.Mesh(mergeParts(structure),
    new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .9, metalness: .12 })));

  /* 后场货架 + 远处简化体量 */
  const racks = [];
  for (let u = 0; u < 3; u++) {
    const x0 = -10.6 + u * 7.4;
    for (const x of [x0, x0 + 6.2]) for (const z of [-29.6, -28.2]) addBox(racks, .14, 3.05, .14, x, 1.52, z, '#262c2e');
    for (const y of [.34, 1.32, 2.3]) addBox(racks, 6.3, .12, 1.5, x0 + 3.1, y, -28.9, '#2a3032');
    for (let i = 0; i < 4; i++) {
      const w = .6 + hash(u, i, 2) * .9, h = .35 + hash(u, i, 3) * .5;
      addBox(racks, w, h, .75, x0 + .7 + i * 1.45, .4 + h / 2, -28.9, i % 2 ? '#2f3537' : '#262b2d');
    }
  }
  for (let i = 0; i < 9; i++) {
    const w = .7 + hash(i, 21, 1) * 1.4, h = .6 + hash(i, 22, 2) * 1.1;
    addBox(racks, w, h, .8, -11 + i * 2.55, h / 2, -27.6, '#1f2527');
  }
  /* 两侧靠墙的收纳架：让空间像库房而不是空场 */
  for (const side of [-1, 1]) {
    const x = side * 12.35;
    for (let z = 3; z >= -25; z -= 3.4) {
      addBox(racks, .1, 3.1, .1, x - side * .35, 1.55, z, '#2a3032');
      addBox(racks, .1, 3.1, .1, x + side * .45, 1.55, z, '#2a3032');
      for (const y of [.32, 1.12, 1.92, 2.72]) addBox(racks, .9, .07, 3.35, x + side * .05, y, z - 1.7, '#272d2f');
      for (let k = 0; k < 3; k++) {
        const w = .55 + hash(side, z, k) * .5, h = .25 + hash(z, k, side) * .45;
        addBox(racks, w, h, .7, x + side * .04, .36 + h / 2 + (k % 2) * .8, z - .5 - k * .8, k % 2 ? '#333a3c' : '#2b3133');
      }
    }
  }
  group.add(new THREE.Mesh(mergeParts(racks),
    new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .92, metalness: .05 })));

  /* 顶部灯带：沿两侧布置的短灯架，避免一条长灯管穿过画面上方 */
  const strips = [];
  for (const z of [-2, -10, -18, -26]) for (const x of [-7.2, 7.2]) {
    addBox(strips, 4.4, .09, .16, x, 8.56, z, '#ffffff');
    addBox(strips, .16, .2, .16, x - 2.0, 8.66, z, '#ffffff');
    addBox(strips, .16, .2, .16, x + 2.0, 8.66, z, '#ffffff');
  }
  const stripMat = new THREE.MeshBasicMaterial({ color: '#7e8987' });
  const stripMesh = new THREE.Mesh(mergeParts(strips), stripMat);
  group.add(stripMesh);

  return {
    group,
    floor,
    dispose() {
      floorTex.dispose(); floorMat.dispose(); wallMat.dispose();
      wallGeo.dispose(); floor.geometry.dispose(); outer.geometry.dispose();
      ceiling.geometry.dispose(); ceiling.material.dispose();
      stripMat.dispose(); stripMesh.geometry.dispose();
      for (const child of [...group.children]) if (child.isMesh && child.geometry && child.geometry.dispose && !child.geometry.attributes.uv) child.geometry.dispose();
    }
  };
}
