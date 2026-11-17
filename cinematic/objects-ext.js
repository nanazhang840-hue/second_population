/* 第二人口 · 电影展示模式 · 几何补充
   复用 space/objects.js 的倒角箱 / 圆柱 / 合并管线与 PALETTE，
   补齐候选数据中出现但原几何库缺失的四种：VAN / MPV / TAXI / BIKE RACK。
   全部为类别级结构示意（真实尺度），不宣称现场扫描。 */
import * as THREE from '../integration/vendor/three-r170.module.js';
import { PALETTE as P, addBox, addCyl, addPart, mergeParts, xform } from '../space/objects.js';

function wheel(L, r, w, x, y, z) {
  addPart(L, new THREE.CylinderGeometry(r, r, w, 16), P.rubber, xform(x, y, z, 0, 0, Math.PI / 2));
  addPart(L, new THREE.CylinderGeometry(r * .52, r * .52, w + .02, 12), P.steelDark, xform(x, y, z, 0, 0, Math.PI / 2));
}

/* 厢式面包车：单厢体量 + 短头 + 侧滑门缝 */
function van() {
  const L = [], W = 1.98;
  addBox(L, W, 1.42, 4.30, 0, 1.02, -.10, P.shell);
  addBox(L, W - .06, .62, 1.02, 0, 1.62, 1.86, P.shell);          // 短头引擎盖
  addBox(L, W - .10, .78, .06, 0, 1.66, 1.42, P.glass, 0, -.30);  // 前风挡斜率
  addBox(L, W + .012, .62, 3.30, 0, 1.62, -.55, P.glass);         // 侧窗带
  addBox(L, W + .02, .06, 4.34, 0, 2.06, -.10, P.shell);          // 顶板
  addBox(L, W + .014, .02, .018, 0, 1.02, .55, P.shellDark);      // 滑门缝
  addBox(L, W - .10, .18, .16, 0, .46, 2.32, P.shellDark);
  addBox(L, W - .10, .18, .16, 0, .46, -2.32, P.shellDark);
  addBox(L, .40, .12, .06, -.60, .80, 2.36, P.lamp);
  addBox(L, .40, .12, .06, .60, .80, 2.36, P.lamp);
  addBox(L, .34, .30, .06, -.62, .90, -2.36, P.red);
  addBox(L, .34, .30, .06, .62, .90, -2.36, P.red);
  for (const z of [1.42, -1.42]) { wheel(L, .36, .24, -(W / 2 - .10), .36, z); wheel(L, .36, .24, (W / 2 - .10), .36, z); }
  return mergeParts(L);
}

/* MPV：两厢半体量，车顶比 SUV 低、比轿车高 */
function mpv() {
  const L = [], W = 1.86;
  addBox(L, W, .82, 4.42, 0, .78, 0, P.shell);
  addBox(L, W - .08, .68, 3.30, 0, 1.42, -.20, P.shell);
  addBox(L, W - .14, .56, 3.06, 0, 1.46, -.20, P.glass);
  addBox(L, W - .10, .05, 3.20, 0, 1.78, -.20, P.shell);
  addBox(L, W - .12, .50, .06, 0, 1.40, 1.42, P.glass, 0, -.42);
  addBox(L, W - .10, .16, .16, 0, .44, 2.24, P.shellDark);
  addBox(L, W - .10, .16, .16, 0, .44, -2.24, P.shellDark);
  addBox(L, .42, .11, .06, -.58, .70, 2.28, P.lamp);
  addBox(L, .42, .11, .06, .58, .70, 2.28, P.lamp);
  addBox(L, .36, .10, .06, -.62, .72, -2.28, P.red);
  addBox(L, .36, .10, .06, .62, .72, -2.28, P.red);
  for (const z of [1.44, -1.44]) { wheel(L, .34, .23, -(W / 2 - .10), .34, z); wheel(L, .34, .23, (W / 2 - .10), .34, z); }
  return mergeParts(L);
}

/* 出租车：轿车体量 + 顶灯 + 低饱和营运漆色 */
function taxi() {
  const L = [], W = 1.82, paint = '#a8934e', paintDark = '#6d5f33';
  addBox(L, W, .62, 4.50, 0, .62, 0, paint);
  addBox(L, W - .10, .52, 2.30, 0, 1.16, -.10, paint);
  addBox(L, W - .16, .44, 2.06, 0, 1.20, -.10, P.glass);
  addBox(L, W - .12, .05, 2.20, 0, 1.45, -.10, paint);
  addBox(L, W - .14, .40, .06, 0, 1.10, 1.06, P.glass, 0, -.46);
  addBox(L, W - .14, .36, .06, 0, 1.10, -1.26, P.glass, 0, .40);
  addBox(L, .46, .14, .22, 0, 1.55, .30, P.porcelain);            // 顶灯
  addBox(L, .40, .06, .16, 0, 1.60, .30, P.lamp);
  addBox(L, W + .012, .10, .02, 0, .78, .30, paintDark);           // 营运腰线
  addBox(L, W - .10, .16, .16, 0, .42, 2.28, P.shellDark);
  addBox(L, W - .10, .16, .16, 0, .42, -2.28, P.shellDark);
  addBox(L, .40, .11, .06, -.56, .66, 2.32, P.lamp);
  addBox(L, .40, .11, .06, .56, .66, 2.32, P.lamp);
  addBox(L, .34, .10, .06, -.60, .68, -2.32, P.red);
  addBox(L, .34, .10, .06, .60, .68, -2.32, P.red);
  for (const z of [1.46, -1.46]) { wheel(L, .33, .22, -(W / 2 - .10), .33, z); wheel(L, .33, .22, (W / 2 - .10), .33, z); }
  return mergeParts(L);
}

/* 自行车停放架：五组倒 U  hoop + 横杆 */
function bikeRack() {
  const L = [];
  for (let i = 0; i < 5; i++) {
    const x = -1.8 + i * .9;
    addPart(L, new THREE.TorusGeometry(.40, .028, 8, 20, Math.PI), P.steel, xform(x, .42, 0, 0, 0, 0));
    addCyl(L, .028, .028, .42, x - .40, .21, 0, P.steel, 8);
    addCyl(L, .028, .028, .42, x + .40, .21, 0, P.steel, 8);
    addBox(L, .10, .03, .10, x - .40, .015, 0, P.concreteDark);
    addBox(L, .10, .03, .10, x + .40, .015, 0, P.concreteDark);
  }
  addBox(L, 4.2, .05, .05, 0, .30, 0, P.steelDark);
  return mergeParts(L);
}

const EXT = { van, mpv, taxi, bikeRack };
const cache = new Map();
export function extGeometryFor(kind) {
  if (!cache.has(kind)) cache.set(kind, EXT[kind]());
  return cache.get(kind);
}
export const EXT_KINDS = Object.keys(EXT);
export function disposeExt() { for (const g of cache.values()) g.dispose(); cache.clear(); }