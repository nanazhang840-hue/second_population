/* 第二人口 · 电影展示模式 · 叙事覆盖层
   字幕 / 章节进度 / 类别标签 / 个体身份 / 对象档案 / 结束卡 / 播放控制。
   全部 DOM 位于 1920×1080 舞台坐标系内，随舞台整体缩放。
   文案只说明画面正在发生什么；数据只读 census / energy-manifest，不虚构。 */
import { CHAPTERS, DURATION, DESIGN, HERO_ID, categoryById } from './config.js';
import { range, smooth, clamp } from './timeline.js';

const STATUS_CN = { verified: '实测', estimated: '估算', pending: '待核验' };
const STATUS_EN = { verified: 'VERIFIED', estimated: 'ESTIMATED', pending: 'PENDING' };

export function createOverlay(root, data) {
  const { record, energy, counts } = data;
  root.innerHTML = `
  <div class="cine-vignette"></div>
  <div class="cine-grain"></div>

  <div class="cine-subtitle" id="cineSub"></div>

  <div class="cine-modelnote" id="cineModelNote">类别级结构示意 · 非现场扫描<span>CATEGORY-LEVEL STRUCTURAL MODEL · NOT A SCAN</span></div>

  <div class="cine-rail" id="cineRail">
    <div class="cine-rail-head"><span id="railIdx">01</span><span id="railEn">DISCOVERY</span></div>
    <div class="cine-rail-bar"><div class="cine-rail-fill" id="railFill"></div>
      ${CHAPTERS.map(c => `<i style="left:${(c.start / DURATION * 100).toFixed(2)}%"></i>`).join('')}
    </div>
    <div class="cine-rail-time" id="railTime">00:00 / 01:30</div>
  </div>

  <div class="cine-cat" id="cineCat">
    <i id="catSwatch"></i>
    <div><b id="catCn"></b><span id="catEn"></span></div>
    <em id="catCount"></em>
  </div>

  <div class="cine-identity" id="cineIdentity">
    <div class="cine-id-row"><span>编号</span><b id="idCode"></b></div>
    <div class="cine-id-row"><span>名称</span><b id="idName"></b></div>
    <div class="cine-id-row"><span>类别</span><b id="idCat"></b></div>
  </div>

  <aside class="cine-dossier" id="cineDossier">
    <header><span>对象档案</span><em>OBJECT DOSSIER</em></header>
    <figure>
      <img id="dosThumb" alt="原始监控取证帧">
      <figcaption id="dosThumbCap"></figcaption>
    </figure>
    <dl id="dosRows"></dl>
    <div class="cine-dos-energy">
      <h4>能源与碳代谢 <em>CARBON METABOLISM</em></h4>
      <div id="dosEnergy"></div>
      <p class="cine-dos-note" id="dosNote"></p>
    </div>
  </aside>

  <div class="cine-end" id="cineEnd">
    <h1>THE SECOND POPULATION</h1>
    <p>A DIFFERENT WAY TO OBSERVE THE CITY.</p>
  </div>

  <div class="cine-controls" id="cineControls">
    <button id="btnPlay" title="暂停 / 继续 (Space)">暂停</button>
    <button id="btnRestart" title="重新开始 (R)">重播</button>
    <button id="btnExit" title="退出展示模式 (Esc)">退出</button>
  </div>

  <div class="cine-start" id="cineStart">
    <div class="cine-start-inner">
      <p class="cine-start-kicker">城市工业物普查 · 影像装置</p>
      <h1>THE SECOND<br>POPULATION</h1>
      <p class="cine-start-cn">第二人口</p>
      <button id="btnStart">START EXPERIENCE</button>
      <p class="cine-start-hint">约 90 秒 · 16:9 · 建议全屏观看 · Space 暂停 / R 重播 / 1–8 跳章</p>
    </div>
  </div>`;

  const $ = id => root.querySelector('#' + id);
  const el = {
    sub: $('cineSub'), modelNote: $('cineModelNote'), railIdx: $('railIdx'), railEn: $('railEn'), railFill: $('railFill'), railTime: $('railTime'),
    cat: $('cineCat'), catSwatch: $('catSwatch'), catCn: $('catCn'), catEn: $('catEn'), catCount: $('catCount'),
    identity: $('cineIdentity'), idCode: $('idCode'), idName: $('idName'), idCat: $('idCat'),
    dossier: $('cineDossier'), dosThumb: $('dosThumb'), dosThumbCap: $('dosThumbCap'), dosRows: $('dosRows'), dosEnergy: $('dosEnergy'), dosNote: $('dosNote'),
    end: $('cineEnd'), controls: $('cineControls'), start: $('cineStart'),
    btnPlay: $('btnPlay'), btnRestart: $('btnRestart'), btnExit: $('btnExit'), btnStart: $('btnStart'),
  };

  /* 档案内容：只呈现当前有可靠资料的内容 */
  const cat = categoryById(record.category === 'vehicle' ? 'vehicles' : (data.catId || 'vehicles'));
  el.dosThumb.src = record.thumb;
  el.dosThumbCap.textContent = `${record.cameraId || 'CAM04'} · ${record.sceneId.toUpperCase()} · 观察时段 ${record.timeRange.start.toFixed(1)}–${record.timeRange.end.toFixed(1)}s`;
  const rows = [
    ['编号', record.canonicalId],
    ['名称', record.label],
    ['功能类别', cat.label + ' · ' + cat.en],
    ['观察来源', (record.sky && record.sky.function) || '—'],
    ['模型状态', '类别结构示意 · 非现场扫描'],
    ['登记状态', '候选观察 · 待核验'],
  ];
  el.dosRows.innerHTML = rows.map(([k, v]) => `<div><dt>${k}</dt><dd>${v}</dd></div>`).join('');
  if (energy) {
    const e = energy;
    const line = (label, val, unit, status, note) =>
      `<div class="cine-e-row"><span>${label}</span><b>${val}<i>${unit}</i></b><em class="st-${status}">${STATUS_CN[status]} ${STATUS_EN[status]}</em>${note ? `<small>${note}</small>` : ''}</div>`;
    el.dosEnergy.innerHTML =
      line('制造阶段 embodied', e.embodiedKwh.toLocaleString('en-US'), 'kWh', e.embodiedStatus, `区间 ${e.embodiedRange[0].toLocaleString('en-US')}–${e.embodiedRange[1].toLocaleString('en-US')}`) +
      line('使用阶段 daily', e.dailyKwh, 'kWh/日', e.dailyStatus, e.dailyNote || '');
    el.dosNote.textContent = '制造阶段暂无实测值；以上为基于公开研究系数的估算，不作为实测碳排放。';
  } else {
    el.dosEnergy.innerHTML = '<div class="cine-e-row"><span>能源数据</span><em class="st-pending">待核验 PENDING</em></div>';
    el.dosNote.textContent = '该对象暂无可靠能源资料。';
  }
  el.idCode.textContent = record.canonicalId;
  el.idName.textContent = record.label;
  el.idCat.textContent = cat.label;

  const fmt = s => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
  let lastSub = '';

  function update(t, proj) {
    /* 字幕 */
    const ch = CHAPTERS.find(c => t < c.end) || CHAPTERS[CHAPTERS.length - 1];
    let subA = 0, subText = ch.sub;
    if (subText) subA = smooth(range(t, ch.start + 0.8, ch.start + 1.5)) * (1 - smooth(range(t, ch.end - 1.6, ch.end - 0.9)));
    if (subText !== lastSub) { el.sub.textContent = subText; lastSub = subText; }
    el.sub.style.opacity = subA.toFixed(3);

    /* 结构模型声明（CH03–CH08）：画面主体为类别级结构示意时持续可见，避免被误读为扫描重建 */
    const noteA = smooth(range(t, 22, 23.2)) * (1 - smooth(range(t, 86.6, 87.6)));
    el.modelNote.style.opacity = (noteA * 0.78).toFixed(3);

    /* 章节进度 */
    el.railIdx.textContent = String(ch.id).padStart(2, '0');
    el.railEn.textContent = ch.en;
    el.railFill.style.width = (t / DURATION * 100).toFixed(2) + '%';
    el.railTime.textContent = `${fmt(t)} / ${fmt(DURATION)}`;

    /* 类别标签（CH06） */
    const ci = Math.floor((t - 64) / 2);
    const catActive = t >= 64 && t < 74 && ci >= 0 && ci < 5;
    if (catActive) {
      const id = ['vehicles', 'signage', 'lighting', 'street-equipment', 'ground'][ci];
      const c = categoryById(id);
      const local = (t - 64) - ci * 2;
      const a = smooth(range(local, 0, 0.45)) * (1 - smooth(range(local, 1.55, 2.0)));
      el.cat.style.opacity = a.toFixed(3);
      el.catSwatch.style.background = c.color;
      el.catCn.textContent = c.label;
      el.catEn.textContent = c.en;
      el.catCount.textContent = (counts[id] || 0) + ' 件';
    } else el.cat.style.opacity = '0';

    /* 个体身份（CH07）：贴在主角右侧 */
    const idA = smooth(range(t, 76.5, 77.6)) * (1 - smooth(range(t, 82.2, 83)));
    el.identity.style.opacity = idA.toFixed(3);
    if (idA > 0.01 && proj) {
      const p = proj(0, 1.0, 0);
      el.identity.style.transform = `translate(${clamp(p.x + 210, 40, 1500)}px, ${clamp(p.y - 140, 40, 900)}px)`;
    }

    /* 档案（CH08） */
    const dosA = smooth(range(t, 83.2, 84.2)) * (1 - smooth(range(t, 86.2, 87.2)));
    el.dossier.style.opacity = dosA.toFixed(3);
    el.dossier.style.transform = `translateX(${(1 - dosA) * 40}px)`;
    el.dossier.style.visibility = dosA > 0.01 ? 'visible' : 'hidden';

    /* 结束卡 */
    const endA = smooth(range(t, 87.8, 89.0));
    el.end.style.opacity = endA.toFixed(3);
    el.end.style.visibility = endA > 0.01 ? 'visible' : 'hidden';
  }

  function setPlaying(p) { el.btnPlay.textContent = p ? '暂停' : '继续'; }
  function hideStart() { el.start.classList.add('gone'); }
  function showStart() { el.start.classList.remove('gone'); }
  function setControlsVisible(v) { el.controls.classList.toggle('idle', !v); }

  return { el, update, setPlaying, hideStart, showStart, setControlsVisible };
}