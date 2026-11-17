/* 第二人口 · 电影展示模式 · 统一确定性时间轴
   所有状态都是 t 的纯函数：同一 t 重复求值必得同一视觉结果。
   支持 pause / resume / seek / replay，不依赖随机数。 */
import { CHAPTERS, DURATION, SOURCE_TIME_KEYS, FIELD_CENTER } from './config.js';

export const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
export const mix = (a, b, k) => a + (b - a) * k;
export const smooth = k => { k = clamp(k, 0, 1); return k * k * (3 - 2 * k); };
export const easeInOut = k => { k = clamp(k, 0, 1); return k < .5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2; };
export const easeOut = k => 1 - Math.pow(1 - clamp(k, 0, 1), 3);
export const easeIn = k => Math.pow(clamp(k, 0, 1), 3);
/* 区间归一化 */
export const range = (t, a, b) => clamp((t - a) / (b - a), 0, 1);
/* 确定性哈希（替代 Math.random，保证重播一致） */
export function hash01(n) {
  let x = (n | 0) * 0x27d4eb2d;
  x = (x ^ (x >>> 15)) >>> 0;
  x = Math.imul(x, 0x85ebca6b) >>> 0;
  x = (x ^ (x >>> 13)) >>> 0;
  x = Math.imul(x, 0xc2b2ae35) >>> 0;
  return ((x ^ (x >>> 16)) >>> 0) / 4294967296;
}

export function chapterAt(t) {
  for (const c of CHAPTERS) if (t < c.end) return c;
  return CHAPTERS[CHAPTERS.length - 1];
}

/* 分段线性源时间映射（监控视频秒） */
export function sourceTime(t) {
  const K = SOURCE_TIME_KEYS;
  if (t <= K[0][0]) return K[0][1];
  for (let i = 1; i < K.length; i++) {
    if (t <= K[i][0]) {
      const k = (t - K[i - 1][0]) / (K[i][0] - K[i - 1][0]);
      return mix(K[i - 1][1], K[i][1], k);
    }
  }
  return K[K.length - 1][1];
}

/* ── 镜头关键帧：Catmull-Rom 样条保证速度连续，无瞬移 / 抖动 ── */
const CAM_KEYS = [
  // t,      pos,                    target,                fov
  [0,    [4.9, 0.95, 0.2],   [0, 0.85, 0],        40],
  [18.5, [4.9, 0.95, 0.2],   [0, 0.85, 0],        40],
  [22,   [4.9, 0.95, 0.2],   [0, 0.85, 0],        40],
  [27,   [3.9, 1.35, 3.2],   [0, 0.85, 0],        39],
  [32,   [2.7, 1.40, 4.7],   [0, 0.85, 0],        38],
  [40,   [9.0, 3.6, 17.0],   [-1, 1.0, -5],       42],
  [48,   [16.0, 6.0, 34.0],  [-2, 1.0, -8],       45],
  [56,   [24.0, 8.5, 52.0],  [-3, 0.8, -9],       47],
  [64,   [30.0, 11.0, 66.0], FIELD_CENTER,        48],
  [67,   [26.0, 4.5, 27.0],  [30, 2.0, -16],      46],
  [69,   [8.0, 3.4, 17.0],   [-34, 6.0, -18],     46],
  [71,   [-12.0, 3.0, 15.0], [-27, -4.0, 6],      46],
  [74,   [-26.0, 4.5, 26.0], [25, -6.0, 6],       46],
  [78,   [-9.0, 2.4, 11.0],  [0, 0.9, 0],         41],
  [83,   [3.6, 1.45, 5.0],   [0, 0.85, 0],        38],
  [86.2, [5.2, 1.70, 5.6],   [1.15, 0.95, 0],     38],
  [90,   [28.0, 10.0, 62.0], FIELD_CENTER,        48],
];

/* 单调三次 Hermite（Fritsch–Carlson）：C1 连续、无过冲、不在关键帧处停顿。
   比逐段 ease-in-out 更自然，比均匀 Catmull-Rom 在不等间隔时更稳。 */
function slopes(times, vals) {
  const n = times.length, h = [], d = [], m = new Array(n);
  for (let i = 0; i < n - 1; i++) { h[i] = times[i + 1] - times[i]; d[i] = (vals[i + 1] - vals[i]) / h[i]; }
  m[0] = d[0]; m[n - 1] = d[n - 2];
  for (let i = 1; i < n - 1; i++) {
    if (d[i - 1] * d[i] <= 0) m[i] = 0;
    else {
      const w1 = 2 * h[i] + h[i - 1], w2 = h[i] + 2 * h[i - 1];
      m[i] = (w1 + w2) / (w1 / d[i - 1] + w2 / d[i]);
    }
  }
  return { h, m };
}
function hermite(times, vals, sl, t) {
  const n = times.length;
  let i = 1;
  while (i < n - 1 && t > times[i]) i++;
  const a = i - 1, h = sl.h[a], k = clamp((t - times[a]) / h, 0, 1);
  const k2 = k * k, k3 = k2 * k;
  const h00 = 2 * k3 - 3 * k2 + 1, h10 = k3 - 2 * k2 + k, h01 = -2 * k3 + 3 * k2, h11 = k3 - k2;
  return h00 * vals[a] + h10 * h * sl.m[a] + h01 * vals[a + 1] + h11 * h * sl.m[a + 1];
}
const CAM_T = CAM_KEYS.map(k => k[0]);
const CAM_POS = [0, 1, 2].map(c => CAM_KEYS.map(k => k[1][c]));
const CAM_TGT = [0, 1, 2].map(c => CAM_KEYS.map(k => k[2][c]));
const CAM_FOV = CAM_KEYS.map(k => k[3]);
const CAM_SL = CAM_POS.map(v => slopes(CAM_T, v));
const TGT_SL = CAM_TGT.map(v => slopes(CAM_T, v));
const FOV_SL = slopes(CAM_T, CAM_FOV);

export function cameraAt(t, out) {
  for (let c = 0; c < 3; c++) {
    out.pos[c] = hermite(CAM_T, CAM_POS[c], CAM_SL[c], t);
    out.tgt[c] = hermite(CAM_T, CAM_TGT[c], TGT_SL[c], t);
  }
  out.fov = hermite(CAM_T, CAM_FOV, FOV_SL, t);
  /* 极轻微呼吸漂移：确定性正弦，幅度 < 0.12m，避免死板但绝不抖动 */
  const br = Math.sin(t * 0.31) * 0.06 + Math.sin(t * 0.17 + 1.3) * 0.05;
  out.pos[1] += br * range(t, 22, 26) * (1 - range(t, 84, 88));
  return out;
}

/* 雾密度：近景浓 → 远景薄 */
export function fogAt(t, close, wide) {
  return mix(close, wide, smooth(range(t, 32, 50)));
}

/* 单对象显现度：0=隐于黑暗，1=完整亮度 */
export function revealAt(t, node) {
  if (node.hero) return smooth(range(t, node.revealIn[0], node.revealIn[1]));
  return smooth(range(t, node.revealStart, node.revealStart + node.revealDur));
}

/* 类别观察窗高亮系数：当前窗类别保持全亮，其余类别降亮。
   （修复：旧版把降亮误加在本类别自己的窗口上，导致高亮反向。） */
export function classFocusAt(t, catId) {
  const start = 64, each = 2, dim = 0.26, fade = 0.45;
  const order = ['vehicles', 'signage', 'lighting', 'street-equipment', 'ground'];
  const idx = order.indexOf(catId);
  if (idx < 0) return 1;
  const ci = Math.floor((t - start) / each);
  if (ci < 0 || ci >= order.length) return 1;
  const a = start + ci * each, b = a + each;
  const inK = smooth(range(t, a - fade, a + fade));
  const outK = 1 - smooth(range(t, b - fade, b + fade));
  const active = Math.min(inK, outK);
  if (ci === idx) return 1;              // 被观察类别保持全亮
  return mix(1, dim, active);            // 其余类别在该窗内降亮
}

/* CH07/CH08 非主角降亮 */
export function individualDimAt(t) {
  const inK = smooth(range(t, 75, 79));
  const outK = 1 - smooth(range(t, 86.5, 89));
  return mix(1, 0.42, Math.min(inK, outK));
}

export { DURATION };