/* 档案空间 · 工业物几何库
   车辆复用现有 ModelEngine / ArchiveModels 的模型；
   其余四类按真实尺度程序化构建，颜色写入顶点，一个物体合并成一个 draw call。 */
import * as THREE from '../integration/vendor/three-r170.module.js';

export const PALETTE = {
  shell: '#4b555c', shellDark: '#2f373c', glass: '#111a1f', rubber: '#080a0c',
  steel: '#7c868b', steelDark: '#454e52', concrete: '#6b6a64', concreteDark: '#46453f',
  ink: '#171d1f', panel: '#9c9d95', panelLight: '#c3c4b8', marking: '#9c9d94',
  /* 参考图里的白漆设备：空调外机、柜体的亮面，比 panelLight 再高一档 */
  porcelain: '#cfd0c6',
  rust: '#8a4b28', lamp: '#e2e7de', asphalt: '#24282c',
  /* 参考图里的三个彩色点：警示橙、售货机红、锈青灰 */
  orange: '#cc5b22', red: '#ab3520', patina: '#54696a',
  /* 巴士专用漆面：整车只有这一件用，避免改动 P.shell 影响轿车/SUV/卡车 */
  busPaint: '#6f7a80', busPaintDark: '#39434a'
};

/* 每类物体的 PBR 参数：金属度/粗糙度分离，玻璃单独一套。
   这是“不再是塑料”的关键——同一份顶点色，靠这组数值拉开材质差异。 */
export const MATERIAL_SPEC = {
  sedan: { metalness: .72, roughness: .34, env: 1.5 },
  suv: { metalness: .72, roughness: .34, env: 1.5 },
  truck: { metalness: .55, roughness: .48, env: 1.2 },
  /* 巴士：漆面按电介质处理（金属漆的金属度只有 0.14），
     原 0.50 的金属度把漫反射砍掉一半，而环境图整体接近纯黑、补不回高光。 */
  bus: { metalness: .14, roughness: .34, env: 1.9 },
  coach: { metalness: .14, roughness: .34, env: 1.9 },
  streetlight: { metalness: .82, roughness: .3, env: 1.6 },
  cameraPole: { metalness: .82, roughness: .3, env: 1.6 },
  gantry: { metalness: .8, roughness: .36, env: 1.5 },
  metroSign: { metalness: .65, roughness: .4, env: 1.3 },
  banner: { metalness: .35, roughness: .62, env: .9 },
  standSign: { metalness: .6, roughness: .45, env: 1.2 },
  jersey: { metalness: .04, roughness: .86, env: .5 },
  guardrail: { metalness: .8, roughness: .38, env: 1.5 },
  fence: { metalness: .78, roughness: .42, env: 1.4 },
  kerb: { metalness: .04, roughness: .9, env: .4 },
  manhole: { metalness: .7, roughness: .52, env: 1.1 },
  laneMark: { metalness: .1, roughness: .8, env: .5 },
  arrow: { metalness: .1, roughness: .8, env: .5 },
  grate: { metalness: .7, roughness: .5, env: 1.1 },
  cone: { metalness: .05, roughness: .68, env: .7 },
  acUnit: { metalness: .45, roughness: .52, env: 1.1 },
  cabinet: { metalness: .68, roughness: .55, env: 1.2 },
  vending: { metalness: .38, roughness: .46, env: 1.1 },
  boiler: { metalness: .5, roughness: .58, env: 1.1 }
};

const _color = h => new THREE.Color(h);

export function xform(x = 0, y = 0, z = 0, ry = 0, rx = 0, rz = 0) {
  const m = new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(rx, ry, rz));
  m.setPosition(x, y, z);
  return m;
}

export function addPart(list, geo, color, matrix) {
  const g = geo.index ? geo.toNonIndexed() : geo;
  list.push({ g, color: _color(color), m: matrix || new THREE.Matrix4() });
  if (g !== geo) geo.dispose();
}

/* 倒角箱：把每个顶点向"内框 + 半径"挤压，再焊接法线。
   参考图里所有器物边缘都有一道柔和高光，而不是硬 90° 折角——这是同一份几何
   从"低模方块"变成"工业件"的关键。半径按最小边比例给，并封顶 5cm，
   避免巴士那种大体量被削圆。 */
function chamferBox(w, h, d) {
  const r = Math.min(0.05, Math.min(w, h, d) * 0.18);
  const seg = r > 0.012 ? 2 : 1;
  const g = new THREE.BoxGeometry(w, h, d, seg, seg, seg);
  if (r > 0.0005) {
    const pos = g.attributes.position;
    const ax = Math.max(w / 2 - r, 0), ay = Math.max(h / 2 - r, 0), az = Math.max(d / 2 - r, 0);
    for (let i = 0; i < pos.count; i++) {
      const px = pos.getX(i), py = pos.getY(i), pz = pos.getZ(i);
      const qx = Math.min(ax, Math.max(-ax, px));
      const qy = Math.min(ay, Math.max(-ay, py));
      const qz = Math.min(az, Math.max(-az, pz));
      const dx = px - qx, dy = py - qy, dz = pz - qz;
      const len = Math.hypot(dx, dy, dz);
      if (len > 1e-6) {
        pos.setXYZ(i, qx + dx / len * r, qy + dy / len * r, qz + dz / len * r);
      }
    }
    weldAndSmooth(g);
  }
  return g;
}

/* 按位置焊接顶点后重算法线：倒角带与平面共享法线，得到柔和的边缘高光。
   注意必须沿着原始 index 逐个映射，不能按顶点数重建索引——那样会把网格
   重新连成退化三角形（箱体会塌成一片薄板）。 */
function weldAndSmooth(g) {
  const pos = g.attributes.position;
  const src = g.index;
  const map = new Map();
  const verts = [];
  const remap = new Int32Array(pos.count);

  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
    const k = Math.round(x * 1e4) + ',' + Math.round(y * 1e4) + ',' + Math.round(z * 1e4);
    let j = map.get(k);
    if (j === undefined) {
      j = verts.length / 3;
      map.set(k, j);
      verts.push(x, y, z);
    }
    remap[i] = j;
  }

  const idx = new Uint32Array(src ? src.count : pos.count);
  for (let i = 0; i < idx.length; i++) idx[i] = remap[src ? src.getX(i) : i];

  g.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
  g.setIndex(new THREE.BufferAttribute(idx, 1));
  g.computeVertexNormals();
}

export function addBox(list, w, h, d, x, y, z, color, ry = 0, rx = 0, rz = 0) {
  addPart(list, chamferBox(w, h, d), color, xform(x, y, z, ry, rx, rz));
}

export function addCyl(list, rTop, rBottom, h, x, y, z, color, seg = 10, rz = 0, rx = 0) {
  addPart(list, new THREE.CylinderGeometry(rTop, rBottom, h, seg), color, xform(x, y, z, 0, rx, rz));
}

export function mergeParts(list) {
  const pos = [], nor = [], col = [];
  const nm = new THREE.Matrix3(), v = new THREE.Vector3();
  for (const it of list) {
    const p = it.g.attributes.position, n = it.g.attributes.normal;
    nm.getNormalMatrix(it.m);
    for (let i = 0; i < p.count; i++) {
      v.fromBufferAttribute(p, i).applyMatrix4(it.m); pos.push(v.x, v.y, v.z);
      v.fromBufferAttribute(n, i).applyMatrix3(nm).normalize(); nor.push(v.x, v.y, v.z);
      col.push(it.color.r, it.color.g, it.color.b);
    }
    it.g.dispose();
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  geo.computeBoundingBox();
  geo.computeBoundingSphere();
  return geo;
}

/* ── 车辆：改为程序化"侧影 + 拉伸"建模（原来是低模面片，近看不像车）
   侧影给出引擎盖/风挡/车顶/尾箱的轮廓，沿车宽拉伸；车轮为独立圆柱，轴线横向。 ── */
function extrudeProfile(list, pts, width, color, bevel=.06) {
  const s = new THREE.Shape();
  s.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) s.lineTo(pts[i][0], pts[i][1]);
  s.closePath();
  const g = new THREE.ExtrudeGeometry(s, {depth:width-2*bevel,bevelEnabled:true,bevelSegments:3,bevelSize:bevel,bevelThickness:bevel});
  g.rotateY(-Math.PI / 2);
  g.translate(width/2-bevel,0,0);
  addPart(list, g, color);
}

function wheel(list, r, w, x, y, z, color) {
  addPart(list, new THREE.CylinderGeometry(r, r, w, 28), color, xform(x, y, z, 0, 0, Math.PI / 2));
  addPart(list, new THREE.CylinderGeometry(r * .52, r * .52, w + .02, 20), PALETTE.steelDark, xform(x, y, z, 0, 0, Math.PI / 2));
  const side=Math.sign(x);
  addPart(list,new THREE.TorusGeometry(r*.63,.012,8,28),PALETTE.steel,xform(x+side*(w/2+.013),y,z,Math.PI/2));
}

function vehicle(kind) {
  const L = [], P = PALETTE;

  if (kind === 'sedan' || kind === 'suv') {
    const suv = kind === 'suv';
    const W = suv ? 1.92 : 1.84;
    const bodyTop = suv ? 1.02 : .86;
    const roofY = suv ? 1.66 : 1.36;

    extrudeProfile(L, [
      [-2.32, .34], [-2.30, .60], [-2.06, .68], [-1.55, bodyTop - .04],
      [-.55, bodyTop], [1.10, bodyTop], [1.86, bodyTop - .04], [2.20, .68], [2.28, .58], [2.30, .34]
    ], W, P.shell);

    /* 玻璃舱：前风挡斜率与后风挡斜率不同，避免"方盒" */
    extrudeProfile(L, [
      [-.62, bodyTop - .02], [-.16, roofY], [suv ? 1.42 : 1.06, roofY],
      [suv ? 1.78 : 1.52, bodyTop - .02]
    ], suv ? 1.74 : 1.66, P.glass);

    /* 车顶薄板 */
    addBox(L, suv ? 1.70 : 1.62, .055, suv ? 1.52 : 1.12, 0, roofY + .026, suv ? .62 : .44, P.shell);
    /* A/C 柱：两小段金属，压住玻璃边界 */
    addBox(L, suv ? 1.70 : 1.62, .05, .05, 0, roofY - .02, suv ? -.13 : -.16, P.shellDark);

    /* 前后保险杠与灯 */
    addBox(L, W - .10, .17, .16, 0, .44, 2.26, P.shellDark);
    addBox(L, W - .10, .17, .16, 0, .44, -2.26, P.shellDark);
    addBox(L, .42, .12, .06, -.58, .66, 2.32, P.lamp);
    addBox(L, .42, .12, .06, .58, .66, 2.32, P.lamp);
    addBox(L, .66, .05, .065, 0, .61, 2.345, P.steelDark);
    addBox(L, .27, .08, .065, 0, .49, 2.345, P.ink);
    addBox(L, .36, .10, .06, -.62, .68, -2.32, P.red);
    addBox(L, .36, .10, .06, .62, .68, -2.32, P.red);

    /* 侧窗分隔与门缝 */
    for (const z of [-.42, .62]) addBox(L, W + .012, .02, .018, 0, bodyTop - .10, z, P.shellDark);
    addBox(L, W + .012, .30, .012, 0, .60, .30, P.shellDark);

    const r = suv ? .37 : .33;
    const zf = suv ? 1.50 : 1.46;
    wheel(L, r, .24, -(W / 2 - .10), r, zf, P.rubber);
    wheel(L, r, .24, (W / 2 - .10), r, zf, P.rubber);
    wheel(L, r, .24, -(W / 2 - .10), r, -zf, P.rubber);
    wheel(L, r, .24, (W / 2 - .10), r, -zf, P.rubber);
    return mergeParts(L);
  }

  if (kind === 'truck') {
    /* 驾驶室 + 货箱：两段体量明确分开，不做成一个长盒子 */
    addBox(L, 2.30, 1.05, 2.10, 0, .95, 2.05, P.shell);
    addBox(L, 2.24, .62, 1.70, 0, 1.72, 2.16, P.glass);
    addBox(L, 2.34, .07, 2.16, 0, 2.06, 2.05, P.shell);
    addBox(L, 2.34, .20, .14, 0, .52, 3.08, P.shellDark);
    addBox(L, 2.20, .16, 2.60, 0, 1.38, -.55, P.panel);
    addBox(L, 2.24, .10, 2.66, 0, 2.42, -.55, P.panelLight);
    addBox(L, 2.26, .08, 2.62, 0, .42, -.55, P.steelDark);
    for (let i = 0; i < 7; i++) addBox(L, 2.28, .05, .05, 0, 2.16 - i * .11, -.55 - 1.30 + .02, P.steelDark);
    addBox(L, .40, .12, .06, -.72, 1.02, 3.12, P.lamp);
    addBox(L, .40, .12, .06, .72, 1.02, 3.12, P.lamp);
    const r = .48;
    for (const z of [2.30, -.55, -1.55]) {
      wheel(L, r, .30, -1.02, r, z, P.rubber);
      wheel(L, r, .30, 1.02, r, z, P.rubber);
    }
    return mergeParts(L);
  }

  /* bus / coach：长体量 + 窗带，靠体量压住远景。
     车身用 busPaint（比 P.shell 亮 2.5 倍线性反照率）——巴士在 z=-27，主光到它
     左flank只剩 0.45 的点积，再用深反照率 + 高金属度就会压成一块纯黑。 */
  const W = 2.52, len = 11.0;
  addBox(L, W, 2.36, len, 0, 1.52, 0, P.busPaint);
  addBox(L, W + .02, .86, len - .50, 0, 2.16, 0, P.glass);
  addBox(L, W + .03, .06, len - .30, 0, 2.62, 0, P.busPaintDark);
  /* 腰线：把 2.36m 高的车身切成上亮下暗两段，给侧面一条可读的水平分界 */
  addBox(L, W + .012, .04, len - .20, 0, 1.16, 0, P.busPaintDark);
  addBox(L, W - .02, .12, len - .20, 0, .62, 0, P.shellDark);
  addBox(L, W + .02, .10, .80, 0, 2.00, -len / 2 + .30, P.glass);
  addBox(L, .70, .34, .06, 0, 2.94, len / 2 - .02, P.panelLight);
  addBox(L, W - .30, .30, .10, 0, .78, len / 2 + .01, P.shellDark);
  for (const z of [len / 2 - 1.9, -len / 2 + 2.5]) {
    wheel(L, .52, .34, -(W / 2 - .12), .52, z, P.rubber);
    wheel(L, .52, .34, (W / 2 - .12), .52, z, P.rubber);
  }
  addBox(L, .5, .2, .06, -.9, 1.0, -len / 2 - .02, P.red);
  addBox(L, .5, .2, .06, .9, 1.0, -len / 2 - .02, P.red);
  return mergeParts(L);
}

/* ── 照明与监测 ── */
function streetlight() {
  const L = [];
  const P = PALETTE;
  addBox(L, .72, .12, .72, 0, .06, 0, P.concreteDark);
  addCyl(L, .075, .16, 7.85, 0, 3.98, 0, P.steel, 10);
  addCyl(L, .16, .19, .16, 0, .55, 0, P.steelDark, 10);
  addCyl(L, .105, .105, .06, 0, 7.93, 0, P.steelDark, 10);
  addBox(L, 2.4, .075, .13, 1.18, 7.95, 0, P.steel);
  addBox(L, 1.3, .045, .045, .62, 7.80, 0, P.steelDark, 0, 0, .16);
  addBox(L, .68, .17, .30, 2.32, 7.87, 0, P.steelDark);
  addBox(L, .52, .025, .21, 2.32, 7.78, 0, P.lamp);
  addBox(L, .24, .44, .16, 0, 1.38, 0, P.steelDark);
  return mergeParts(L);
}

function cameraPole() {
  const L = [];
  const P = PALETTE;
  addBox(L, .5, .1, .5, 0, .05, 0, P.concreteDark);
  addCyl(L, .055, .095, 4.4, 0, 2.2, 0, P.steel, 8);
  addBox(L, 1.15, .06, .07, .55, 4.26, 0, P.steel);
  addBox(L, .18, .26, .18, 0, 4.02, 0, P.steelDark);
  addBox(L, .32, .20, .44, 1.08, 4.14, 0, P.steelDark);
  addCyl(L, .055, .075, .16, 1.30, 4.14, 0, P.ink, 10, Math.PI / 2);
  return mergeParts(L);
}

/* ── 导向与标识 ── */
function metroSign() {
  const L = [];
  const P = PALETTE;
  addBox(L, .6, .08, .6, 0, .04, 0, P.concreteDark);
  addCyl(L, .05, .075, 2.9, 0, 1.48, 0, P.steel, 8);
  addBox(L, 1.66, 1.08, .04, 0, 2.58, -.055, P.steelDark);
  addBox(L, 1.55, .98, .1, 0, 2.58, .015, P.ink);
  addBox(L, 1.3, .1, .012, 0, 2.94, .07, P.rust);
  for (let i = 0; i < 3; i++) addBox(L, i === 0 ? 1.05 : .8, .055, .012, i === 0 ? 0 : -.12, 2.74 - i * .20, .07, P.panelLight);
  for (let i = 0; i < 4; i++) addBox(L, .09, .09, .012, -.52 + i * .09, 3.02, .07, P.marking);
  return mergeParts(L);
}

function gantry() {
  const L = [], span = 9.2, P = PALETTE;
  addBox(L, .28, .12, .8, -span / 2, .06, 0, P.concreteDark);
  addBox(L, .28, .12, .8, span / 2, .06, 0, P.concreteDark);
  addBox(L, .17, 5.45, .17, -span / 2, 2.72, 0, P.steelDark);
  addBox(L, .17, 5.45, .17, span / 2, 2.72, 0, P.steelDark);
  addBox(L, span + .24, .26, .22, 0, 5.5, 0, P.steel);
  addBox(L, .1, .16, .1, -span / 2, .9, 0, P.steelDark);
  addBox(L, 6.0, 1.4, .03, 0, 4.55, -.09, P.steelDark);
  addBox(L, 5.86, 1.32, .13, 0, 4.55, 0, P.ink);
  addBox(L, 5.3, .05, .014, 0, 5.04, .068, P.panelLight);
  for (let i = 0; i < 3; i++) addBox(L, 1.55, .07, .014, -1.95 + i * 1.95, 4.74, .068, P.marking);
  for (let i = 0; i < 8; i++) addBox(L, .09, .09, .014, -2.6 + i * .41, 4.34, .068, P.panelLight);
  return mergeParts(L);
}

function banner() {
  const L = [], P = PALETTE;
  addBox(L, .1, 2.7, .1, -1.55, 1.35, 0, P.steelDark);
  addBox(L, .1, 2.7, .1, 1.55, 1.35, 0, P.steelDark);
  addBox(L, 3.3, 1.9, .06, 0, 1.55, 0, P.panel);
  addBox(L, 3.34, .28, .02, 0, 2.35, .035, P.rust);
  addBox(L, 3.34, .1, .02, 0, .72, .035, P.ink);
  for (let i = 0; i < 3; i++) addBox(L, 2.4, .08, .02, -.2, 1.86 - i * .3, .035, P.panelLight);
  return mergeParts(L);
}

function standSign() {
  const L = [], P = PALETTE;
  addBox(L, .55, .07, .55, 0, .035, 0, P.concreteDark);
  addCyl(L, .04, .06, 2.1, 0, 1.08, 0, P.steel, 8);
  addBox(L, .94, .68, .05, 0, 1.94, 0, P.ink);
  addBox(L, .98, .72, .02, 0, 1.94, -.04, P.steelDark);
  addBox(L, .74, .06, .012, 0, 2.08, .03, P.panelLight);
  addBox(L, .5, .06, .012, 0, 1.94, .03, P.marking);
  return mergeParts(L);
}

/* ── 围护与隔离 ── */
function jersey() {
  const L = [], P = PALETTE;
  const s = new THREE.Shape();
  const pts = [[-.32, 0], [.32, 0], [.32, .12], [.2, .46], [.13, .88], [-.13, .88], [-.2, .46], [-.32, .12]];
  s.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) s.lineTo(pts[i][0], pts[i][1]);
  s.closePath();
  const geo = new THREE.ExtrudeGeometry(s, { depth: 2.0, bevelEnabled: false, steps: 1 });
  geo.translate(0, 0, -1.0);
  addPart(L, geo, P.concrete);
  addBox(L, .27, .035, 1.96, 0, .88, 0, P.concreteDark);
  addBox(L, .06, .16, 1.2, .24, .24, .2, P.concreteDark, 0, 0, .28);
  return mergeParts(L);
}

function guardrail() {
  const L = [], P = PALETTE;
  for (const x of [-3, -1, 1, 3]) {
    addBox(L, .12, .78, .15, x, .39, 0, P.steelDark);
    addBox(L, .26, .06, .26, x, .03, 0, P.concreteDark);
  }
  addBox(L, 6.2, .30, .09, 0, .64, 0, P.steel);
  addBox(L, 6.2, .06, .12, 0, .46, 0, P.steelDark);
  addBox(L, 6.2, .08, .10, 0, .18, 0, P.steelDark);
  return mergeParts(L);
}

function fence() {
  const L = [], P = PALETTE;
  for (const x of [-2.1, 2.1]) {
    addBox(L, .09, 1.65, .09, x, .82, 0, P.steelDark);
    addBox(L, .35, .08, .35, x, .04, 0, P.concreteDark);
  }
  for (let i = 0; i < 15; i++) addBox(L, .028, 1.45, .028, -1.95 + i * .28, .78, 0, P.steel);
  addBox(L, 4.3, .05, .05, 0, 1.52, 0, P.steelDark);
  addBox(L, 4.3, .05, .05, 0, .62, 0, P.steelDark);
  addBox(L, 4.3, .12, .03, 0, .32, 0, P.panel);
  return mergeParts(L);
}

/* ── 地表设施 ── */
function kerb() {
  const L = [], P = PALETTE;
  for (let i = 0; i < 4; i++) addBox(L, .88, .32, .5, -1.35 + i * .9, .16, 0, i % 2 ? P.concrete : P.concreteDark);
  return mergeParts(L);
}

function manhole() {
  const L = [], P = PALETTE;
  addCyl(L, .9, .9, .07, 0, .035, 0, P.ink, 40);
  addPart(L, new THREE.TorusGeometry(.82, .035, 8, 40), P.steelDark, xform(0, .06, 0, 0, Math.PI / 2));
  for (let i = -3; i <= 3; i++) addBox(L, 1.3, .025, .028, 0, .075, i * .2, P.steelDark);
  addCyl(L, .92, .92, .02, 0, .005, 0, P.concreteDark, 40);
  return mergeParts(L);
}

function laneMark() {
  const L = [], P = PALETTE;
  addBox(L, 3.4, .045, 1.7, 0, .022, 0, P.asphalt);
  for (let i = 0; i < 3; i++) addBox(L, .62, .012, .13, -1.15 + i * 1.15, .048, 0, P.marking);
  return mergeParts(L);
}

function arrow() {
  const L = [], P = PALETTE;
  addBox(L, 3.4, .045, 1.7, 0, .022, 0, P.asphalt);
  addBox(L, 1.5, .012, .16, -.3, .048, 0, P.marking);
  addBox(L, .9, .012, .16, .62, .048, .25, P.marking, -Math.PI / 4);
  addBox(L, .9, .012, .16, .62, .048, -.25, P.marking, Math.PI / 4);
  return mergeParts(L);
}

function grate() {
  const L = [], P = PALETTE;
  addBox(L, 1.15, .05, .75, 0, .025, 0, P.ink);
  for (let i = 0; i < 7; i++) addBox(L, .08, .01, .68, -.48 + i * .16, .056, 0, P.steelDark);
  addBox(L, 1.2, .02, .06, 0, .056, .37, P.concreteDark);
  return mergeParts(L);
}

/* ── 参考图里出现、原版本没有的五件：交通桶、空调外机、配电柜、售货机、立式锅炉 ── */
function cone() {
  const L = [], P = PALETTE;
  addBox(L, .36, .035, .36, 0, .018, 0, P.ink);
  addCyl(L, .045, .155, .58, 0, .32, 0, P.orange, 14);
  addCyl(L, .082, .108, .10, 0, .30, 0, P.panelLight, 14);
  addCyl(L, .118, .134, .085, 0, .43, 0, P.panelLight, 14);
  addBox(L, .10, .03, .10, 0, .62, 0, P.ink);
  return mergeParts(L);
}

/* 立式空调外机：参考图里占数量最多的一种"白漆圆格栅箱体"，
   体量 0.82×1.05×0.48，正脸一枚大直径格栅 + 下方检修板，侧面散热鳍。 */
function acUnit() {
  const L = [], P = PALETTE;
  addBox(L, .74, .06, .44, 0, .03, 0, P.steelDark);
  addBox(L, .80, 1.02, .46, 0, .56, 0, P.porcelain);
  /* 顶部斜切压边 */
  addBox(L, .80, .04, .46, 0, 1.07, 0, P.panelLight);
  /* 正脸大圆格栅 */
  addPart(L, new THREE.CylinderGeometry(.30, .30, .05, 22), P.panel, xform(0, .64, .235, 0, Math.PI / 2));
  addPart(L, new THREE.TorusGeometry(.30, .018, 6, 24), P.steel, xform(0, .64, .265));
  addPart(L, new THREE.CylinderGeometry(.085, .085, .06, 14), P.steelDark, xform(0, .64, .27, 0, Math.PI / 2));
  for (let i = 0; i < 8; i++) {
    const y = .64 + (i - 3.5) * .066;
    const half = Math.sqrt(Math.max(0, .28 * .28 - Math.pow(y - .64, 2)));
    addBox(L, half * 2, .010, .012, 0, y, .272, P.steelDark);
  }
  /* 下方检修板与铭牌 */
  addBox(L, .56, .18, .02, 0, .22, .238, P.panelLight);
  addBox(L, .20, .10, .014, 0, .22, .248, P.rust);
  addBox(L, .10, .03, .012, .18, .33, .248, P.ink);
  /* 侧面散热鳍（左右各一块，做出粗糙度差） */
  addBox(L, .014, .74, .36, -.402, .62, 0, P.steelDark);
  addBox(L, .014, .74, .36, .402, .62, 0, P.steelDark);
  /* 底部支脚 */
  addBox(L, .07, .05, .16, -.34, .05, 0, P.steelDark);
  addBox(L, .07, .05, .16, .34, .05, 0, P.steelDark);
  return mergeParts(L);
}

function cabinet() {
  const L = [], P = PALETTE;
  addBox(L, .96, .06, .62, 0, .03, 0, P.concreteDark);
  addBox(L, 1.02, 1.72, .56, 0, .92, 0, P.patina);
  addBox(L, 1.06, .05, .60, 0, 1.80, 0, P.steelDark);
  addBox(L, .012, 1.62, .012, 0, .92, .283, P.ink);
  for (let i = 0; i < 6; i++) addBox(L, .42, .018, .014, -.22, 1.46 - i * .062, .284, P.ink);
  for (let i = 0; i < 5; i++) addBox(L, .30, .016, .014, .22, 1.30 - i * .058, .284, P.ink);
  addBox(L, .05, .16, .05, -.06, 1.02, .30, P.steelDark);
  addBox(L, .34, .30, .014, .24, .52, .284, P.rust);
  addBox(L, .22, .16, .014, -.28, .56, .284, P.rust);
  addBox(L, .5, .1, .02, 0, 1.66, .285, P.marking);
  return mergeParts(L);
}

function vending() {
  const L = [], P = PALETTE;
  addBox(L, 1.04, .06, .70, 0, .03, 0, P.ink);
  addBox(L, 1.00, 1.92, .66, 0, .99, 0, P.red);
  addBox(L, 1.02, 1.26, .05, 0, 1.24, .33, P.glass);
  for (let r = 0; r < 3; r++) {
    addBox(L, .88, .05, .03, 0, 1.62 - r * .30, .35, P.panelLight);
    for (let c = 0; c < 4; c++) addBox(L, .11, .11, .06, -.32 + c * .21, 1.52 - r * .30, .35, PALETTE.marking);
  }
  addBox(L, .92, .06, .04, 0, .82, .35, P.lamp);
  addBox(L, .52, .20, .04, 0, .58, .35, P.ink);
  addBox(L, .14, .14, .04, .36, .58, .35, P.steel);
  addBox(L, .20, .30, .02, .36, 1.66, .35, P.ink);
  return mergeParts(L);
}

function boiler() {
  const L = [], P = PALETTE;
  addBox(L, .62, .08, .62, 0, .04, 0, P.concreteDark);
  addCyl(L, .34, .34, 1.34, 0, .76, 0, P.rust, 18);
  addCyl(L, .34, .30, .16, 0, 1.50, 0, P.panelLight, 18);
  addCyl(L, .05, .05, .34, .18, 1.70, .16, P.steelDark, 8);
  addCyl(L, .05, .05, .26, -.2, 1.66, -.1, P.steelDark, 8);
  addBox(L, .50, .06, .03, 0, .92, .335, P.steelDark);
  addBox(L, .18, .10, .02, -.12, .74, .335, P.porcelain);
  addBox(L, .10, .34, .02, .26, .58, .33, P.ink);
  return mergeParts(L);
}

const BUILDERS = {
  sedan: () => vehicle('sedan'), suv: () => vehicle('suv'), truck: () => vehicle('truck'),
  bus: () => vehicle('bus'), coach: () => vehicle('coach'),
  streetlight, cameraPole, metroSign, gantry, banner, standSign,
  jersey, guardrail, fence, kerb, manhole, laneMark, arrow, grate,
  cone, acUnit, cabinet, vending, boiler, bicycle
};

function bicycle() {
  const parts=[];
  const spoke=(from,to,r,color)=>{
    const a=new THREE.Vector3(...from), b=new THREE.Vector3(...to);
    const direction=b.clone().sub(a);
    const matrix=new THREE.Matrix4().compose(a.lerp(b,.5),new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0),direction.clone().normalize()),new THREE.Vector3(1,1,1));
    addPart(parts,new THREE.CylinderGeometry(r,r,direction.length(),8),color,matrix);
  };
  for(const z of [-.62,.62]){
    addPart(parts,new THREE.TorusGeometry(.31,.025,8,32),PALETTE.rubber,xform(0,.33,z,Math.PI/2));
    addPart(parts,new THREE.TorusGeometry(.287,.012,8,32),PALETTE.steel,xform(0,.33,z,Math.PI/2));
    for(const angle of [0,Math.PI/3,2*Math.PI/3]){
      const y=Math.sin(angle)*.28, dz=Math.cos(angle)*.28;
      spoke([0,.33-y,z-dz],[0,.33+y,z+dz],.0035,PALETTE.steelDark);
    }
  }
  const rear=[0,.33,-.62],front=[0,.33,.62],seat=[0,.81,-.24],crank=[0,.34,-.10],steer=[0,.87,.38];
  for(const [a,b] of [[rear,seat],[rear,crank],[seat,crank],[seat,steer],[crank,steer],[steer,front]]){
    spoke(a,b,.026,PALETTE.steel);
  }
  spoke(steer,[0,1.02,.41],.019,PALETTE.steel);
  addBox(parts,.36,.025,.03,0,1.02,.41,PALETTE.steel);
  addBox(parts,.13,.043,.19,0,.85,-.25,PALETTE.ink);
  return mergeParts(parts);
}

const cache = new Map();

export function geometryFor(kind) {
  if (!cache.has(kind)) {
    const build = BUILDERS[kind];
    if (!build) throw new Error('unknown kind: ' + kind);
    cache.set(kind, build());
  }
  return cache.get(kind);
}

export function disposeGeometries() {
  for (const g of cache.values()) g.dispose();
  cache.clear();
}
