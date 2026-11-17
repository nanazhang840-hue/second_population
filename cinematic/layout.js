/* 第二人口 · 电影展示模式 · 群体空间布局
   类别作为主要空间组织依据（区域倾向，非五个分离球体），真实物理尺度，
   黄金角螺旋 + 确定性碰撞松弛 + 镜头路径 clearance。不复制对象、不随机散布。 */
import { FIELD, HERO_ID, REVEAL, categoryOf } from './config.js';
import { hash01 } from './timeline.js';
import { FOOT } from '../space/layout.js';

const KIND_BY_LABEL = {
  SEDAN: 'sedan', 'WHITE SUV': 'suv', 'BLACK SUV': 'suv', SUV: 'suv',
  VAN: 'van', 'WHITE VAN': 'van', MPV: 'mpv', TAXI: 'taxi',
  COACH: 'coach', 'CITY BUS': 'bus', BUS: 'bus',
  LUMINAIRE: 'streetlight', 'CAMERA POLE': 'cameraPole',
  'METRO SIGN': 'metroSign', 'GANTRY SIGN': 'gantry', SIGN: 'standSign', BANNER: 'banner',
  BARRIER: 'jersey', GUARDRAIL: 'guardrail', FENCE: 'fence', 'BIKE RACK': 'bikeRack',
  KERB: 'kerb', MANHOLE: 'manhole', 'LANE MARK': 'laneMark', ARROW: 'arrow',
};
const EXT_FOOT = { van: [5.0, 2.2], mpv: [4.7, 2.1], taxi: [4.8, 2.0], bikeRack: [4.4, 1.0] };
export const footFor = kind => FOOT[kind] || EXT_FOOT[kind] || [2, 2];
export const kindFor = labelEn => KIND_BY_LABEL[String(labelEn || '').toUpperCase().trim()] || null;

const GOLDEN = Math.PI * (3 - Math.sqrt(5));

export function buildLayout(records, cameraSamples) {
  const nodes = [];
  const byCat = new Map();
  for (const r of records) {
    const kind = kindFor(r.labelEn);
    if (!kind) continue;                       // 无对应几何的记录不进入空间（不伪造）
    const cat = categoryOf(r);
    const node = {
      id: r.canonicalId, record: r, kind,
      cat: cat.id, catLabel: cat.label, catEn: cat.en, color: cat.color,
      hero: r.canonicalId === HERO_ID,
      foot: footFor(kind),
      pos: [0, 0, 0], ry: 0,
    };
    node.radius = Math.max(node.foot[0], node.foot[1]) * 0.5;
    nodes.push(node);
    if (!byCat.has(cat.id)) byCat.set(cat.id, []);
    byCat.get(cat.id).push(node);
  }

  /* 类别区域内黄金角螺旋布点 */
  for (const [catId, list] of byCat) {
    const F = FIELD[catId] || FIELD.vehicles;
    list.sort((a, b) => a.id.localeCompare(b.id));
    const n = list.length;
    list.forEach((node, i) => {
      if (node.hero) { node.pos = [0, 0, 0]; node.ry = 0; return; }
      const z = 1 - 2 * (i + .5) / n;
      const rad = Math.sqrt(Math.max(0, 1 - z * z));
      const a = i * GOLDEN;
      const h1 = hash01(i * 7 + catId.length * 131), h2 = hash01(i * 13 + 57), h3 = hash01(i * 29 + 11);
      node.pos = [
        F.center[0] + Math.cos(a) * rad * F.radii[0] + (h1 - .5) * 3.0,
        F.center[1] + Math.sin(a) * rad * F.radii[1] + (h2 - .5) * 2.0,
        F.center[2] + z * F.radii[2] + (h3 - .5) * 3.0,
      ];
      node.ry = (h1 - .5) * (node.cat === 'vehicles' ? 0.62 : 1.1);
    });
  }

  /* 确定性碰撞松弛：保留间距，避免穿插与严重重叠。
     垂直方向推力加权 0.45：优先水平让位，避免物体上下堆叠成“碰撞塔”。 */
  const GAP = 1.6;
  for (let it = 0; it < 90; it++) {
    for (let i = 0; i < nodes.length; i++) for (let j = i + 1; j < nodes.length; j++) {
      const a = nodes[i], b = nodes[j];
      const dx = b.pos[0] - a.pos[0], dy = b.pos[1] - a.pos[1], dz = b.pos[2] - a.pos[2];
      const d = Math.hypot(dx, dy, dz) || 1e-4;
      const min = a.radius + b.radius + GAP;
      if (d < min) {
        const f = (min - d) / d * 0.5;
        const px = dx * f, py = dy * f * 0.45, pz = dz * f;
        if (a.hero) { b.pos[0] += px * 2; b.pos[1] += py * 2; b.pos[2] += pz * 2; }
        else if (b.hero) { a.pos[0] -= px * 2; a.pos[1] -= py * 2; a.pos[2] -= pz * 2; }
        else {
          a.pos[0] -= px; a.pos[1] -= py; a.pos[2] -= pz;
          b.pos[0] += px; b.pos[1] += py; b.pos[2] += pz;
        }
      }
    }
  }

  /* 镜头路径 clearance：任何物体不得贴近镜头轨迹，避免穿模 */
  if (cameraSamples && cameraSamples.length) {
    for (let it = 0; it < 6; it++) {
      for (const node of nodes) {
        if (node.hero) continue;
        for (const s of cameraSamples) {
          const dx = node.pos[0] - s[0], dy = node.pos[1] - s[1], dz = node.pos[2] - s[2];
          const d = Math.hypot(dx, dy, dz) || 1e-4;
          const min = node.radius + 3.2;
          if (d < min) { const f = (min - d) / d; node.pos[0] += dx * f; node.pos[1] += dy * f; node.pos[2] += dz * f; }
        }
      }
    }
  }

  /* 显现分带：离主角越远越晚浮现，形成 前→中→远 的层次 */
  for (const node of nodes) {
    const d = Math.hypot(node.pos[0], node.pos[1], node.pos[2]);
    if (node.hero) { node.revealIn = REVEAL.heroIn; node.revealStart = 0; node.revealDur = 1; node.band = 0; continue; }
    node.band = Math.min(4, Math.floor(d / 13));
    node.revealStart = REVEAL.start + node.band * REVEAL.bandStep + hash01(node.id.length * 31 + node.band * 7) * REVEAL.jitter;
    node.revealDur = REVEAL.dur;
  }
  nodes.sort((a, b) => a.id.localeCompare(b.id));
  return nodes;
}