/* 第二人口 · 电影展示模式 · 监控取证层（CH01–CH02）
   真实监控视频 + 烘焙检测框（data/detections，10fps 线性插值，不漂移不闪烁）。
   提取转场：原始帧冻结 → 目标区域外模糊降亮 → 轮廓遮罩 → 与三维模型匹配转场。
   不宣称真实分割 / 三维扫描。 */
import { FRAME, HERO_VIDEO, HERO_DETECTIONS, HERO_TRACK, FREEZE_T, PLATE_FADE, DESIGN } from './config.js';
import { sourceTime, range, smooth, clamp, mix } from './timeline.js';

const W = FRAME.w, H = FRAME.h;

function roundRect(g, x, y, w, h, r) {
  g.beginPath();
  g.moveTo(x + r, y);
  g.arcTo(x + w, y, x + w, y + h, r);
  g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r);
  g.arcTo(x, y, x + w, y, r);
  g.closePath();
}

export function createCCTV(video, plate) {
  const ctx = plate.getContext('2d');
  plate.width = W; plate.height = H;
  let detections = null;
  let fit = { s: 1, ox: 0, oy: 0 };
  let freeze = null;          // { src, full, bg, obj, rect }
  let lastSeek = -1;

  async function init() {
    video.muted = true; video.playsInline = true; video.preload = 'auto';
    video.src = HERO_VIDEO;
    await new Promise((res, rej) => {
      if (video.readyState >= 2) return res();
      video.addEventListener('loadeddata', res, { once: true });
      video.addEventListener('error', () => rej(new Error('监控视频加载失败 ' + HERO_VIDEO)), { once: true });
    });
    video.pause();
    const r = await fetch(HERO_DETECTIONS);
    detections = await r.json();
    computeFit();
  }

  function computeFit() {
    const vw = video.videoWidth || W, vh = video.videoHeight || H;
    const s = Math.max(W / vw, H / vh);
    fit = { s, ox: (W - vw * s) / 2, oy: (H - vh * s) / 2, vw, vh };
  }
  const px = b => ({ x: fit.ox + b.x * fit.vw * fit.s, y: fit.oy + b.y * fit.vh * fit.s, w: b.w * fit.vw * fit.s, h: b.h * fit.vh * fit.s });

  /* 烘焙检测线性插值：同一 trackId 在相邻帧之间平滑过渡 */
  function boxAt(trackId, t) {
    if (!detections) return null;
    const F = detections.frames;
    let lo = 0, hi = F.length - 1;
    while (lo < hi) { const mid = (lo + hi) >> 1; if (F[mid].t < t) lo = mid + 1; else hi = mid; }
    const b = F[lo];
    const prev = F[Math.max(0, lo - 1)];
    const find = fr => fr.boxes.find(x => x.trackId === trackId);
    const cur = find(b), pre = find(prev);
    if (!cur) return null;
    if (!pre || b.t === prev.t) return cur;
    const k = clamp((t - prev.t) / (b.t - prev.t), 0, 1);
    return { x: mix(pre.x, cur.x, k), y: mix(pre.y, cur.y, k), w: mix(pre.w, cur.w, k), h: mix(pre.h, cur.h, k), conf: cur.conf };
  }
  function contextBoxes(t) {
    if (!detections) return [];
    const F = detections.frames;
    let lo = 0, hi = F.length - 1;
    while (lo < hi) { const mid = (lo + hi) >> 1; if (F[mid].t < t) lo = mid + 1; else hi = mid; }
    return F[lo].boxes.filter(b => b.trackId !== HERO_TRACK && b.w * b.h > 0.012 && b.w * b.h < 0.2).slice(0, 3);
  }

  function seek(st) {
    if (Math.abs(video.currentTime - st) > 0.02) { video.currentTime = st; lastSeek = st; }
  }

  function captureFreeze(st) {
    const full = document.createElement('canvas'); full.width = W; full.height = H;
    const fg = full.getContext('2d');
    /* 与视频元素 CSS 相同的调色，保证冻结层与实时画面色调一致 */
    fg.filter = 'grayscale(1) contrast(1.06) brightness(0.99)';
    fg.drawImage(video, fit.ox, fit.oy, fit.vw * fit.s, fit.vh * fit.s);
    fg.filter = 'none';
    const b = boxAt(HERO_TRACK, st);
    const r = b ? px(b) : { x: W * .27, y: H * .33, w: W * .73, h: H * .64 };
    const pad = 0.018;
    const rect = { x: r.x - r.w * pad, y: r.y - r.h * pad, w: r.w * (1 + pad * 2), h: r.h * (1 + pad * 2) };

    /* 背景层：模糊 + 降亮，目标区域挖空（软边） */
    const bg = document.createElement('canvas'); bg.width = W; bg.height = H;
    const bgg = bg.getContext('2d');
    bgg.filter = 'blur(9px) brightness(0.30) saturate(0.6)';
    bgg.drawImage(full, 0, 0);
    bgg.filter = 'none';
    bgg.globalCompositeOperation = 'destination-out';
    const rg = bgg.createRadialGradient(rect.x + rect.w / 2, rect.y + rect.h / 2, Math.min(rect.w, rect.h) * .30, rect.x + rect.w / 2, rect.y + rect.h / 2, Math.max(rect.w, rect.h) * .62);
    rg.addColorStop(0, 'rgba(0,0,0,1)'); rg.addColorStop(.72, 'rgba(0,0,0,.92)'); rg.addColorStop(1, 'rgba(0,0,0,0)');
    bgg.fillStyle = rg;
    bgg.fillRect(0, 0, W, H);
    bgg.globalCompositeOperation = 'source-over';

    /* 目标层：仅目标区域清晰 */
    const obj = document.createElement('canvas'); obj.width = W; obj.height = H;
    const og = obj.getContext('2d');
    og.save();
    roundRect(og, rect.x, rect.y, rect.w, rect.h, 14);
    og.clip();
    og.drawImage(full, 0, 0);
    og.restore();

    freeze = { src: st, full, bg, obj, rect };
  }

  function drawBox(g, r, color, alpha, brackets) {
    g.save();
    g.globalAlpha = alpha;
    g.strokeStyle = color;
    g.lineWidth = 2;
    if (brackets) {
      const L = Math.min(26, r.w * .18, r.h * .18);
      g.lineWidth = 3;
      g.beginPath();
      g.moveTo(r.x, r.y + L); g.lineTo(r.x, r.y); g.lineTo(r.x + L, r.y);
      g.moveTo(r.x + r.w - L, r.y); g.lineTo(r.x + r.w, r.y); g.lineTo(r.x + r.w, r.y + L);
      g.moveTo(r.x + r.w, r.y + r.h - L); g.lineTo(r.x + r.w, r.y + r.h); g.lineTo(r.x + r.w - L, r.y + r.h);
      g.moveTo(r.x + L, r.y + r.h); g.lineTo(r.x, r.y + r.h); g.lineTo(r.x, r.y + r.h - L);
      g.stroke();
      g.globalAlpha = alpha * .35; g.lineWidth = 1.4;
      g.strokeRect(r.x, r.y, r.w, r.h);
    } else {
      g.lineWidth = 1.4;
      g.strokeRect(r.x, r.y, r.w, r.h);
    }
    g.restore();
  }

  function label(g, r, text, alpha) {
    g.save();
    g.globalAlpha = alpha;
    g.font = '500 21px "Consolas","Menlo",monospace';
    const tw = g.measureText(text).width;
    g.fillStyle = 'rgba(8,11,14,0.72)';
    g.fillRect(r.x, r.y - 30, tw + 18, 26);
    g.fillStyle = DESIGN.boxHero;
    g.fillText(text, r.x + 9, r.y - 11);
    g.restore();
  }

  /* 每帧绘制。返回 plate 整体不透明度（供主循环做匹配转场）。
     视频元素本身是可见画面层（CH01–02），此处只管理其淡出并叠加冻结特效与标注。 */
  function draw(t, heroLabel) {
    const st = sourceTime(t);
    const plateFade = 1 - smooth(range(t, PLATE_FADE[0], PLATE_FADE[1]));
    video.style.opacity = plateFade.toFixed(3);
    video.style.visibility = plateFade > 0.002 ? 'visible' : 'hidden';
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, W, H);
    if (plateFade <= 0.002) return 0;

    if (t < FREEZE_T) {
      seek(st);
      freeze = null;
    } else if (!freeze || Math.abs(freeze.src - st) > 1e-6) {
      seek(st);
      /* 仅在视频已就绪且不在寻帧时捕获，避免冻结到上一帧 */
      if (video.readyState >= 2 && !video.seeking) captureFreeze(st);
    }

    const bgFade = smooth(range(t, FREEZE_T, FREEZE_T + 4.2));
    if (freeze) {
      /* 模糊挖空背景 + 清晰目标，叠在已冻结的实时视频之上 */
      ctx.globalAlpha = plateFade * bgFade;
      ctx.drawImage(freeze.bg, 0, 0);
      ctx.globalAlpha = plateFade;
      ctx.drawImage(freeze.obj, 0, 0);
    }

    /* 识别框：先普通街景，再锁定唯一目标 */
    const boxIn = smooth(range(t, 2.6, 4.2));
    const ctxFade = 1 - smooth(range(t, 4.6, 6.4));
    if (boxIn > 0.01 && t < FREEZE_T + 6) {
      for (const cb of contextBoxes(st)) drawBox(ctx, px(cb), DESIGN.boxContext, 0.30 * boxIn * ctxFade * plateFade, false);
    }
    const hb = boxAt(HERO_TRACK, Math.min(st, 6.5));
    if (hb && boxIn > 0.01) {
      const r = freeze ? freeze.rect : px(hb);
      const lock = smooth(range(t, 8, 11));
      drawBox(ctx, r, DESIGN.boxHero, (0.55 + 0.45 * lock) * boxIn * plateFade, true);
      label(ctx, r, heroLabel, boxIn * plateFade * (0.5 + 0.5 * lock));
      /* 锁定扫描线 */
      if (t > 9 && t < FREEZE_T + 3) {
        const k = ((t - 9) % 1.6) / 1.6;
        ctx.save();
        ctx.globalAlpha = 0.30 * plateFade * (1 - smooth(range(t, FREEZE_T + 1.5, FREEZE_T + 3)));
        ctx.strokeStyle = DESIGN.accent; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.moveTo(r.x, r.y + r.h * k); ctx.lineTo(r.x + r.w, r.y + r.h * k); ctx.stroke();
        ctx.restore();
      }
    }
    ctx.globalAlpha = 1;
    return plateFade;
  }

  function dispose() {
    video.pause(); video.removeAttribute('src'); video.load();
    freeze = null; detections = null;
  }

  /* 供确定性截图/跳帧使用：清空冻结缓存，下一帧从当前视频帧重新捕获 */
  function invalidate() { freeze = null; }

  return { init, draw, dispose, invalidate, get fit() { return fit; }, boxAt };
}