/* 第二人口 · 电影展示模式 · 主编排器
   单 WebGLRenderer、单 requestAnimationFrame、单确定性时间轴。
   入口：cinematic.html（或 index.html?mode=cinematic 分流）。
   不创建第二个渲染器；页面隐藏自动暂停；离开时完整 dispose。 */
import * as THREE from '../integration/vendor/three-r170.module.js';
import { FRAME, DURATION, CHAPTERS, HERO_ID, FOG, categoryOf } from './config.js';
import { cameraAt, fogAt, chapterAt, clamp } from './timeline.js';
import { buildEnvironment } from './environment.js';
import { buildLayout } from './layout.js';
import { buildPopulation } from './population.js';
import { createCCTV } from './cctv.js';
import { createOverlay } from './overlay.js';

const app = document.getElementById('app');
const stage = document.getElementById('stage');
const canvas = document.getElementById('cineCanvas');
const plate = document.getElementById('cinePlate');
const video = document.getElementById('cineVideo');
const overlayRoot = document.getElementById('overlay');

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(1);                       // 固定 1920×1080 内部像素，保证录制一致
renderer.setSize(FRAME.w, FRAME.h, false);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.42;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(40, FRAME.aspect, 0.1, 400);
const camState = { pos: [0, 0, 0], tgt: [0, 0, 0], fov: 40 };
const lookTarget = new THREE.Vector3();

let env = null, population = null, cctv = null, overlay = null;
let nodes = [], heroRecord = null, energyItem = null, counts = {};
let mode = 'start';       // start | playing | paused | ended
let t = 0, dirty = true, last = performance.now();
let idleTimer = 0, controlsVisible = true;
const frameTimes = [];
let disposed = false;

function fitStage() {
  const s = Math.min(window.innerWidth / FRAME.w, window.innerHeight / FRAME.h);
  stage.style.transform = `translate(-50%,-50%) scale(${s})`;
  dirty = true;
}
window.addEventListener('resize', fitStage);

async function loadData() {
  const [census, energy] = await Promise.all([
    fetch('data/census.json').then(r => r.json()),
    fetch('energy-manifest.json').then(r => r.json()),
  ]);
  const NATURE = /^\s*(TREE|HEDGE)\s*$/i;
  const candidates = census.records.filter(r => r.sky && r.populationEligible !== false && !NATURE.test(r.labelEn || ''));
  heroRecord = census.records.find(r => r.canonicalId === HERO_ID);
  energyItem = (energy.items || []).find(i => i.objectId === HERO_ID) || null;
  return candidates;
}

async function boot() {
  fitStage();
  const candidates = await loadData();
  env = buildEnvironment(scene, renderer);

  /* 镜头路径采样 → 布局 clearance，避免穿模 */
  const samples = [];
  for (let s = 22; s <= DURATION; s += 0.5) { cameraAt(s, camState); samples.push([...camState.pos]); }
  nodes = buildLayout(candidates, samples);
  for (const n of nodes) counts[n.cat] = (counts[n.cat] || 0) + 1;
  population = buildPopulation(scene, nodes, env.glowTexture);

  cctv = createCCTV(video, plate);
  await cctv.init();

  overlay = createOverlay(overlayRoot, {
    record: heroRecord, energy: energyItem, counts,
    catId: categoryOf(heroRecord).id,
  });
  wireInput();
  window.__cine = api;
  document.body.classList.add('ready');
  dirty = true;
  last = performance.now();
  requestAnimationFrame(tick);
}

/* ── 单渲染循环 ── */
function tick(now) {
  if (disposed) return;
  requestAnimationFrame(tick);
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  if (mode === 'playing') {
    t += dt;
    if (t >= DURATION) { t = DURATION; mode = 'ended'; overlay.setPlaying(false); }
    dirty = true;
  }
  if (!dirty) return;
  dirty = false;
  render(t);
  frameTimes.push(now);
  if (frameTimes.length > 240) frameTimes.shift();
}

function render(time) {
  cameraAt(time, camState);
  camera.position.set(...camState.pos);
  lookTarget.set(...camState.tgt);
  camera.lookAt(lookTarget);
  if (Math.abs(camera.fov - camState.fov) > 1e-4) { camera.fov = camState.fov; camera.updateProjectionMatrix(); }
  scene.fog.density = fogAt(time, FOG.close, FOG.wide);

  /* 主光阴影跟随主角，近景才有细节阴影 */
  env.key.target.position.set(0, 0.8, 0);
  env.key.position.set(camState.pos[0] - 9, 12, camState.pos[2] + 12);

  population.update(time);

  const plateAlpha = cctv.draw(time, heroRecord ? `${heroRecord.sourceId} · ${heroRecord.labelEn}` : '');
  plate.style.opacity = plateAlpha.toFixed(3);
  plate.style.visibility = plateAlpha > 0.002 ? 'visible' : 'hidden';
  /* 取证板完全不透明时跳过三维渲染，节省软件渲染开销 */
  if (plateAlpha < 0.999) renderer.render(scene, camera);

  overlay.update(time, (x, y, z) => {
    const v = new THREE.Vector3(x, y, z).project(camera);
    return { x: (v.x * 0.5 + 0.5) * FRAME.w, y: (-v.y * 0.5 + 0.5) * FRAME.h };
  });
}

/* ── 播放控制 ── */
function play() {
  if (mode === 'ended') t = 0;
  mode = 'playing'; overlay.setPlaying(true); overlay.hideStart();
  stage.classList.add('rolling'); dirty = true; last = performance.now();
}
function pause() { mode = 'paused'; overlay.setPlaying(false); stage.classList.remove('rolling'); dirty = true; }
function toggle() { mode === 'playing' ? pause() : play(); }
function restart() { t = 0; play(); }
function seek(nt) { t = clamp(nt, 0, DURATION); overlay.hideStart(); if (mode === 'ended') mode = 'paused'; dirty = true; }
function exit() {
  pause(); t = 0; mode = 'start'; overlay.showStart(); stage.classList.remove('rolling');
  if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
  dirty = true;
}

function wireInput() {
  overlay.el.btnStart.addEventListener('click', async () => {
    overlay.hideStart();
    try { await app.requestFullscreen(); } catch (e) { /* 全屏失败仍可播放 */ }
    fitStage(); play();
  });
  overlay.el.btnPlay.addEventListener('click', toggle);
  overlay.el.btnRestart.addEventListener('click', restart);
  overlay.el.btnExit.addEventListener('click', exit);
  window.addEventListener('keydown', e => {
    if (mode === 'start') { if (e.code === 'Space' || e.code === 'Enter') { e.preventDefault(); overlay.el.btnStart.click(); } return; }
    if (e.code === 'Space') { e.preventDefault(); toggle(); }
    else if (e.key === 'r' || e.key === 'R') restart();
    else if (e.key === 'Escape') { exit(); }
    else if (/^[1-8]$/.test(e.key)) seek(CHAPTERS[Number(e.key) - 1].start + 0.01);
    pokeControls();
  });
  window.addEventListener('mousemove', pokeControls);
  window.addEventListener('touchstart', pokeControls, { passive: true });
  document.addEventListener('visibilitychange', () => { if (document.hidden && mode === 'playing') pause(); last = performance.now(); });
  document.addEventListener('fullscreenchange', fitStage);
}
function pokeControls() {
  controlsVisible = true; overlay.setControlsVisible(true);
  clearTimeout(idleTimer);
  idleTimer = setTimeout(() => { controlsVisible = false; overlay.setControlsVisible(false); }, 2600);
}

/* ── 资源释放 ── */
function dispose() {
  disposed = true;
  window.removeEventListener('resize', fitStage);
  cctv && cctv.dispose();
  population && population.dispose();
  if (env) { env.envRT.dispose(); env.glowTexture.dispose(); }
  renderer.dispose();
  renderer.forceContextLoss && renderer.forceContextLoss();
}
window.addEventListener('pagehide', dispose);

/* ── QA / 调试接口（不出现在画面上） ── */
const api = {
  seek, play, pause, restart, exit, toggle,
  refresh: () => { cctv && cctv.invalidate(); dirty = true; },
  state: () => ({ mode, t, chapter: chapterAt(t).key, nodes: nodes.length, counts }),
  fps: () => {
    if (frameTimes.length < 2) return 0;
    const span = (frameTimes[frameTimes.length - 1] - frameTimes[0]) / 1000;
    return (frameTimes.length - 1) / span;
  },
  info: () => ({
    three: THREE.REVISION, renderer: renderer.info.render, memory: renderer.info.memory,
    programs: renderer.info.programs.length,
    hero: heroRecord && heroRecord.canonicalId,
    bounds: (() => { const b = new THREE.Box3(); for (const n of nodes) b.expandByPoint(new THREE.Vector3(...n.pos)); return { min: b.min.toArray(), max: b.max.toArray() }; })(),
  }),
  dispose,
};

boot().catch(err => {
  console.error('[CINEMATIC] 启动失败', err);
  document.body.classList.add('boot-error');
  const d = document.createElement('div');
  d.className = 'cine-boot-error';
  d.textContent = '展示模式启动失败：' + (err && err.message || err);
  app.appendChild(d);
});