(function () {
  'use strict';
  const C = window.Census;
  const byId = id => document.getElementById(id);
  const video = byId('cam');
  const view = byId('viewport');
  const layout = document.querySelector('.layout');
  const sidebar = layout.querySelector('.sidebar');
  const code = byId('codePanel');
  const stage = layout.querySelector('.stage');
  const transport = stage.querySelector('.transport');
  const section = (tag, className, html) => {
    const element = document.createElement(tag);
    element.className = className;
    element.innerHTML = html;
    return element;
  };
  const chart = (title, subtitle, id, readout = '') =>
    '<section class="monitor-chart"><h2>' + title + '<small>' + subtitle + '</small>' +
    readout + '</h2><canvas id="' + id + '" role="img" aria-label="' + title + '"></canvas></section>';
  const esc = window.ArchiveData.escape;

  document.body.classList.add('monitor-layout');
  const left = section('aside', 'monitor-metrics',
    chart('可见目标', '片段内标注', 'visibleChart', '<output id="visibleReadout">—</output>') +
    chart('新登记', '首次出现 / 秒', 'arrivalChart') +
    chart('出现时段', '片段内标注', 'presenceChart') +
    '<section class="monitor-signal"><h2>信号调节</h2></section>');
  left.setAttribute('aria-label', '当前片段的对象观测');
  left.querySelector('.monitor-signal').append(byId('sigCtl'));
  left.querySelector('.sig-ctl-label').textContent = '劣化强度';

  const right = section('aside', 'observation-rail', '');
  right.setAttribute('aria-label', '当前观测');
  const stats = section('section', 'monitor-progress',
    '<h2 class="monitor-sr">累计识别</h2><output id="progressReadout">—</output>' +
    '<canvas id="progressTrace" aria-hidden="true"></canvas>');
  stats.id = 'monitorProgress';
  const records = section('details', 'monitor-target-records', '<summary>对象记录</summary>');
  records.append(sidebar.querySelector('.target-list'));
  const cumulative = section('div', 'monitor-cumulative', chart('累计识别', '对象数', 'cumulativeChart'));
  const dataPanel = section('dialog', 'monitor-data', '<header><h2 id="monitorDataTitle">观测数据</h2>' +
    '<button type="button" aria-label="关闭观测数据" autofocus>×</button></header>' +
    '<div class="monitor-data-body"></div>');
  dataPanel.setAttribute('aria-labelledby', 'monitorDataTitle');
  const breakdown = section('section', 'monitor-breakdown',
    '<h2>按类识别</h2><ul class="monitor-categories"></ul>');
  const details = section('section', 'monitor-object-details',
    '<h2>当前对象</h2><p id="activeTargetRange">—</p><p id="monitorVideoFormat"></p>');
  dataPanel.querySelector('.monitor-data-body').append(details, breakdown, cumulative, left, records, code,
    document.querySelector('.ticker-note'));
  document.body.append(dataPanel);
  const dataButton = section('button', 'monitor-data-launch survey-entry', '观测数据');
  dataButton.type = 'button';
  dataButton.setAttribute('aria-haspopup', 'dialog');
  dataButton.addEventListener('click', () => dataPanel.showModal());
  dataPanel.querySelector('header button').addEventListener('click', () => dataPanel.close());
  records.addEventListener('click', event => {
    if (event.target.closest('.target-item')) dataPanel.close();
  }, { capture: true });

  const activeTarget = section('section', 'monitor-object-link',
    '<h2>取证画面</h2><button type="button" disabled aria-label="进入当前对象的物件空间">' +
    '<span class="target-preview"><img alt=""><canvas width="360" height="210" hidden aria-hidden="true"></canvas></span>' +
    '<span class="target-caption"><strong id="dockObjectLabel">等待目标</strong>' +
    '<small id="dockObjectId"></small><i aria-hidden="true">↗</i></span></button>');
  const ledger = section('ul', 'monitor-ledger', '');
  ledger.setAttribute('aria-label', '识别记录');
  right.append(activeTarget, ledger, stats);
  const viewportLabel = section('div', 'monitor-video-label',
    '<span id="monitorCamera"></span><strong id="monitorZone"></strong>');
  viewportLabel.prepend(byId('playBtn'));
  view.append(viewportLabel);

  const strip = section('section', 'camera-strip',
    '<h2 class="monitor-sr">切换机位</h2><div class="camera-thumbnails" aria-label="切换机位"></div>');
  strip.id = 'cameraStrip';
  transport.hidden = true;
  const sequence = section('section', 'monitor-sequence',
    '<header><h2>四路观测时序</h2></header>' +
    '<canvas id="observationTime" tabindex="0" role="slider" aria-label="观测时间" aria-valuemin="0" aria-valuemax="0" aria-valuenow="0"></canvas>');
  const dock = section('section', 'monitor-dock', '');
  dock.setAttribute('aria-label', '观测时序与机位');
  dock.append(sequence, strip);
  const legacy = section('details', 'legacy-research', '<summary>历史素材研究面板</summary>');
  legacy.hidden = true;
  legacy.append(layout.querySelector('.deck'));
  legacy.addEventListener('toggle', () => window.RenderLifecycle.changed());
  layout.append(right, dock, legacy);
  sidebar.hidden = true;
  byId('sceneOverview').hidden = true;
  code.querySelector('.dh-title').textContent = '实时代码';
  code.querySelector('.dh-en').textContent = '';

  const wordmark = document.createElement('img');
  wordmark.src = 'integration/entry-wordmark.svg';
  wordmark.alt = '';
  document.querySelector('.brand').append(wordmark, section('span', 'monitor-brand-en', 'THE SECOND POPULATION'));
  byId('openSourceMaterials').before(dataButton);
  byId('chooseScene').textContent = '四路观察台';
  byId('openSourceMaterials').textContent = '来源资料';

  const counts = new Map([
    ['vehicle', '车辆'], ['person', '行人 / 骑手'], ['infrastructure', '道路设施'],
    ['industrial', '地表与工业物'], ['appliance', '设备']
  ]);
  const tones = { vehicle:'#dab474', infrastructure:'#83a5b5', industrial:'#a4ad78',
    person:'#c49484', appliance:'#b6a5c3' };
  const laneIcons = {
    vehicle: new Path2D('M2 8 4 4H12L14 8V11H2ZM2 8H14M4 11V13M12 11V13M4 9H6M10 9H12'),
    infrastructure: new Path2D('M2 3H14V8H2ZM8 8V14M5 5H11'),
    industrial: new Path2D('M1 8C1 4 15 4 15 8S1 12 1 8ZM4 8H12M6 6V10M10 6V10'),
    person: new Path2D('M10 4A2 2 0 1 1 6 4A2 2 0 1 1 10 4M3 14V11C3 7 13 7 13 11V14'),
    appliance: new Path2D('M2 3H14V13H2ZM5 6H11M5 9H11')
  };
  const sequenceCanvas = byId('observationTime');
  const buttons = strip.querySelector('.camera-thumbnails');
  const dockButton = activeTarget.querySelector('button');
  const evidenceImage = activeTarget.querySelector('img');
  const evidenceCanvas = activeTarget.querySelector('canvas');
  const evidenceContext = evidenceCanvas.getContext('2d');
  evidenceImage.addEventListener('error', () => { evidenceImage.hidden = true; });
  const measurement = new ResizeObserver(renderCharts);
  const canvases = ['visibleChart', 'arrivalChart', 'presenceChart', 'cumulativeChart'].map(byId);
  [sequenceCanvas, byId('progressTrace'), ...canvases].forEach(canvas => measurement.observe(canvas));
  let scenes = [];
  let scene;
  let track;
  let activeKey;
  let sampleTime = 0;
  let lastSample = -1;
  let lastSecond = -1;
  let history = [];
  let registers = [];
  let entries = [];
  let categories = [];
  let timerange = 1;
  let seen = new Set();
  let presentTracks = [];
  let actualCount = 0;
  let timelineBins = [];
  let sequenceSegments = [];
  let completeSequence = [];
  let sequenceDuration = 1;
  let sequenceEvents = [];
  let sequenceKeys = [];
  let sequenceFrame = -1;
  let seekRequest = 0;
  let hoveredTime = null;
  let ledgerKey = '';
  const minuteTime = time => {
    const hundredths = Math.floor(Math.max(0, time) * 100);
    return String(Math.floor(hundredths / 6000)).padStart(2,'0') + ':' +
      String(Math.floor(hundredths / 100) % 60).padStart(2,'0') + '.' +
      String(hundredths % 100).padStart(2,'0');
  };
  const cameraName = key => key === 'legacy' ? '历史素材' : 'CAM 0' + key.slice(-1);

  function switchCamera(e) {
    const button = e.target.closest('[data-preview-scene]');
    if (!button || button.disabled) return;
    const key = button.dataset.previewScene;
    if (key === activeKey) return;
    seekRequest++;
    button.disabled = true;
    window.__switchScene(key).then(() => {
      if (C.state.view === 'monitor') return video.play();
    }).catch(error => console.debug(error)).finally(() => { button.disabled = false; });
  }
  buttons.addEventListener('click', switchCamera);
  dockButton.addEventListener('click', () => {
    if (track && !window.ResidueSpace?.open(track.canonicalId)) {
      void window.__openCanonical(track.canonicalId);
    }
  });
  function seek(time, id = null) {
    hoveredTime = null;
    lastSample = -1;
    sequenceFrame = -1;
    window.Monitor?.seekObservation(time, id);
  }
  const sequenceOffset = () => sequenceSegments.find(segment => segment.key === activeKey)?.offset || 0;
  async function seekSequence(time, snap = false) {
    const segment = sequenceSegments.find(item => time < item.offset + item.duration) || sequenceSegments.at(-1);
    if (!segment) return;
    const token = ++seekRequest;
    const threshold = sequenceDuration * 6 / Math.max(1, sequenceCanvas.clientWidth - 51);
    const near = segment.records.reduce((best, record) =>
      Math.abs(record.appear + segment.offset - time) < Math.abs((best?.appear ?? Infinity) + segment.offset - time) ?
        record : best, null);
    const local = time - segment.offset;
    const event = snap && near && Math.abs(near.appear - local) <= threshold ? near : null;
    if (segment.key !== activeKey) {
      video.pause();
      await window.__switchScene(segment.key);
    }
    if (token !== seekRequest || segment.key !== activeKey) return;
    if (video.readyState < 1) {
      video.addEventListener('loadedmetadata', () => {
        if (token === seekRequest && segment.key === activeKey) seek(event?.appear ?? local,event?.canonicalId);
      }, {once:true});
    } else {
      seek(event?.appear ?? local,event?.canonicalId);
    }
  }
  ledger.addEventListener('click', event => {
    const id = event.target.closest('button')?.dataset.record;
    const record = entries.find(entry => entry.canonicalId === id);
    if (record) seek(record.appear, id);
  });
  function pointerTime(event) {
    const rect = sequenceCanvas.getBoundingClientRect();
    return Math.min(sequenceDuration, Math.max(0, (event.clientX - rect.left - 31) / (rect.width - 51) * sequenceDuration));
  }
  sequenceCanvas.addEventListener('pointermove', event => {
    hoveredTime = pointerTime(event);
    renderSequence();
  });
  sequenceCanvas.addEventListener('pointerleave', () => {
    hoveredTime = null;
    renderSequence();
  });
  sequenceCanvas.addEventListener('click', event => {
    void seekSequence(pointerTime(event),true);
  });
  sequenceCanvas.addEventListener('keydown', event => {
    const directions = { ArrowLeft: -.25, ArrowDown: -.25, ArrowRight: .25, ArrowUp: .25,
      PageDown: -2, PageUp: 2, Home: -sequenceDuration, End: sequenceDuration };
    if (directions[event.key] == null) return;
    event.preventDefault();
    seekSequence(Math.min(sequenceDuration,Math.max(0,sequenceOffset() + video.currentTime + directions[event.key])));
  });

  function renderThumbnails(key) {
    buttons.innerHTML = scenes.filter(s => s.key !== key).map(s =>
      '<button type="button" class="camera-preview" data-preview-scene="' + s.key +
      '" aria-label="切换到 ' + cameraName(s.key) + ' ' + esc(s.alias) +
      '"><span class="camera-preview-caption"><b>' + cameraName(s.key) + '</b><span>' + esc(s.alias) +
      '</span></span><img src="integration/entry-frames/CAM0' + s.key.slice(-1) +
      '-02.jpg" alt=""></button>').join('');
    buttons.classList.toggle('four-previews', key === 'legacy');
  }

  function loadScene(detail) {
    const key = detail.sceneId;
    activeKey = key;
    sequence.querySelector('h2').textContent = key === 'legacy' ? '观测时序' : '四路观测时序';
    scene = scenes.find(item => item.key === key) || detail.scene || {};
    legacy.hidden = key !== 'legacy';
    scene = { ...scene, key };
    byId('monitorCamera').textContent = cameraName(key);
    byId('monitorZone').textContent = scene.alias || scene.zone || '';
    updateVideoLabel();
    renderThumbnails(key);
    lastSecond = -1;
    lastSample = -1;
    sampleTime = 0;
    hoveredTime = null;
    ledgerKey = '';
    actualCount = 0;
    seen = new Set();
    timerange = Number(scene.duration) || 1;
    entries = C.records.filter(record => record.sceneId === key)
      .map(record => ({ ...record, end: record.disappear }))
      .sort((a,b) => a.appear - b.appear);
    history = Array.from({ length: Math.ceil(timerange * 4) + 1 }, (_, i) =>
      entries.filter(record => record.appear <= i / 4 && record.end >= i / 4).length);
    registers = Array.from({ length: Math.ceil(timerange) }, (_, i) =>
      entries.filter(record => Math.floor(record.appear) === i).length);
    categories = Array.from(counts, ([key, label]) => {
      const group = entries.filter(record => record.category === key);
      return { key, label, group };
    }).filter(category => category.group.length)
      .sort((a,b) => Object.keys(tones).indexOf(a.key) - Object.keys(tones).indexOf(b.key));
    const segments = key === 'legacy' ?
      [{key,duration:timerange,offset:0,records:entries}] : completeSequence;
    if (sequenceSegments !== segments) buildSequence(segments);
    breakdown.querySelector('.monitor-categories').innerHTML = categories.map(category =>
      '<li><span>' + category.label + '</span><span class="category-scale"><i></i></span><output></output></li>').join('');
    setTarget(null);
    renderSample();
    window.Panels.code.reset?.(scene);
  }

  function buildSequence(segments) {
    sequenceSegments = segments;
    sequenceDuration = segments.reduce((total,segment) => total + segment.duration,0) || 1;
    sequenceEvents = segments.flatMap(segment => segment.records
      .filter(record => record.appear > 0 && record.appear < segment.duration)
      .map(record => segment.offset + record.appear));
    const keys = Object.keys(tones);
    sequenceKeys = keys.filter(key => segments.some(segment => segment.records.some(record => record.category === key)));
    const bins = Math.min(310,Math.ceil(sequenceDuration*6));
    timelineBins = Array.from({length:bins}, (_,index) => {
      const time = (index+.5)*sequenceDuration/bins;
      const segment = segments.find(item => item.offset + item.duration > time);
      const counts = keys.map(() => 0);
      const changes = keys.map(() => 0);
      if (!segment) return {counts,changes};
      const local = time-segment.offset;
      const window = sequenceDuration/bins;
      for (const record of segment.records) {
        const lane = keys.indexOf(record.category);
        if (lane < 0) continue;
        if (record.appear <= local && local <= record.disappear) counts[lane]++;
        if (Math.abs(record.appear-local)<=window*.5 || Math.abs(record.disappear-local)<=window*.5) changes[lane]++;
      }
      return {counts,changes};
    });
  }

  function updateVideoLabel() {
    const resolution = video.videoWidth ? video.videoWidth + '×' + video.videoHeight : '';
    byId('monitorVideoFormat').textContent =
      [scene?.key && cameraName(scene.key), resolution, scene?.fps && scene.fps + ' FPS'].filter(Boolean).join(' · ');
  }
  video.addEventListener('loadedmetadata', updateVideoLabel);

  function setTarget(record) {
    track = record;
    byId('activeTargetRange').textContent = record ?
      cameraName(record.sceneId) + ' · ' + record.sourceId + ' · ' +
      record.appear.toFixed(2) + '–' + record.disappear.toFixed(2) + ' s' : '—';
    byId('dockObjectId').textContent = record?.sourceId || '';
    byId('dockObjectLabel').textContent = record?.label || '等待目标';
    dockButton.disabled = !record || record.sceneId === 'legacy';
    evidenceImage.hidden = !record?.thumb;
    evidenceCanvas.hidden = true;
    if (record?.thumb) {
      evidenceImage.src = record.thumb;
      evidenceImage.alt = record.label || '';
      if (!matchMedia('(prefers-reduced-motion: reduce)').matches) {
        evidenceImage.getAnimations().forEach(animation => animation.cancel());
        evidenceImage.animate([{opacity:.48}, {opacity:1}], {duration:240, easing:'ease-out'});
      }
    } else {
      evidenceImage.removeAttribute('src');
    }
    const vehicles = entries.filter(item => item.category === 'vehicle' && item.canonicalId !== record?.canonicalId);
    presentTracks = [record, ...vehicles, ...entries.filter(item => item.category !== 'vehicle' &&
      item.canonicalId !== record?.canonicalId)].filter(Boolean).slice(0, 3);
  }

  function updateEvidence(bounds) {
    if (video.seeking || video.readyState < 2 || !bounds || bounds.w <= 0 || bounds.h <= 0) return;
    const vw = video.videoWidth, vh = video.videoHeight;
    const ratio = evidenceCanvas.width / evidenceCanvas.height;
    const w = Math.min(vw, vh*ratio, Math.max(bounds.w*vw, bounds.h*vh*ratio)*1.18);
    const h = w / ratio;
    if (w < 12 || h < 12) return;
    const x = Math.min(vw-w,Math.max(0,(bounds.x+bounds.w/2)*vw-w/2));
    const y = Math.min(vh-h,Math.max(0,(bounds.y+bounds.h/2)*vh-h/2));
    evidenceContext.drawImage(video,x,y,w,h,0,0,evidenceCanvas.width,evidenceCanvas.height);
    evidenceCanvas.hidden = false;
  }

  function renderSample() {
    byId('visibleReadout').textContent = actualCount;
    const total = entries.length;
    const found = entries.filter(record => record.appear <= sampleTime).length;
    byId('progressReadout').textContent = found + ' / ' + total;
    const rows = breakdown.querySelectorAll('.monitor-categories li');
    categories.forEach(({group}, i) => {
      const count = group.filter(record => record.appear <= sampleTime).length;
      rows[i].querySelector('output').textContent = count + ' / ' + group.length;
      rows[i].querySelector('i').style.width = 100 * count / group.length + '%';
    });
    renderCharts();
    renderLedger();
  }

  function renderCharts() {
    renderTrace();
    renderSequence();
    const ink = '#adc1c7';
    const grid = '#39403f';
    for (const canvas of canvases) {
      const w = canvas.clientWidth, h = canvas.clientHeight;
      if (!w || !h) continue;
      const density = Math.min(window.devicePixelRatio || 1, 2);
      if (canvas.width !== Math.round(w * density) || canvas.height !== Math.round(h * density)) {
        canvas.width = Math.round(w * density);
        canvas.height = Math.round(h * density);
      }
      const ctx = canvas.getContext('2d');
      ctx.setTransform(density,0,0,density,0,0);
      ctx.clearRect(0,0,w,h);
      const presence = canvas.id === 'presenceChart';
      const bottom = h - 20, top = 9, left = presence ? 70 : 28, right = w - 12;
      const x = t => left + (right - left) * Math.min(Math.max(t / timerange, 0), 1);
      const tickStep = timerange > 12 ? 5 : timerange > 6 ? 2 : 1;
      ctx.font = '10px Consolas, monospace';
      ctx.fillStyle = '#c2c0b6';
      ctx.strokeStyle = grid;
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let t = 0; t <= timerange; t += tickStep) {
        const pos = Math.round(x(t)) + .5;
        ctx.moveTo(pos,top);
        ctx.lineTo(pos,bottom);
        ctx.fillText(String(t), pos - 3, h - 5);
      }
      ctx.fillText('s', right + 4, h - 5);
      const cumulative = canvas.id === 'cumulativeChart';
      const arrivals = canvas.id === 'arrivalChart';
      const peak = cumulative ? entries.length : arrivals ? Math.max(0,...registers) : Math.max(0,...history);
      const step = Math.max(1,Math.ceil(peak / 4));
      const y = n => bottom - (bottom - top) * n / (step * 4);
      if (!presence) {
        for (let n = 0; n <= 4; n++) {
          const pos = Math.round(y(n * step)) + .5;
          ctx.moveTo(left,pos);
          ctx.lineTo(right,pos);
          ctx.fillText(String(n * step), 3, pos + 3);
        }
      }
      ctx.stroke();

      ctx.fillStyle = ink;
      if (presence) {
        const lane = (bottom - top) / 3;
        presentTracks.forEach((record, i) => {
          const row = top + i * lane + 2;
          ctx.fillStyle = '#c2c0b6';
          ctx.fillText(record.sourceId,0,row+9);
          ctx.fillStyle = '#2e3636';
          ctx.fillRect(left,row,right-left,Math.max(3,lane-5));
          ctx.fillStyle = i === 0 && track ? '#dbc281' : ink;
          ctx.fillRect(x(record.appear),row,Math.max(1,x(record.disappear)-x(record.appear)),Math.max(3,lane-5));
        });
      } else if (arrivals) {
        registers.forEach((count,i) => {
          if (i > sampleTime || !count) return;
          ctx.fillRect(x(i) + 1,y(count),Math.max(1,(right-left)/timerange*.58),bottom-y(count));
        });
      } else {
        ctx.beginPath();
        if (cumulative) {
          ctx.moveTo(left,bottom);
          let count = 0;
          for (const record of entries) {
            if (record.appear > sampleTime) break;
            ctx.lineTo(x(record.appear),y(count));
            ctx.lineTo(x(record.appear),y(++count));
          }
          ctx.lineTo(x(sampleTime),y(count));
        } else {
          ctx.moveTo(left,y(history[0] || 0));
          history.forEach((count,i) => {
            if (i / 4 <= sampleTime) ctx.lineTo(x(i / 4),y(count));
          });
        }
        ctx.save();
        ctx.lineWidth = 1.4;
        ctx.strokeStyle = ink;
        ctx.stroke();
        ctx.lineTo(x(cumulative ? sampleTime : Math.floor(sampleTime * 4) / 4),bottom);
        ctx.lineTo(left,bottom);
        ctx.closePath();
        ctx.fillStyle = '#90aeb44b';
        ctx.fill();
        ctx.restore();
      }
      ctx.beginPath();
      ctx.strokeStyle = '#baaa83';
      const cursor = Math.round(x(sampleTime)) + .5;
      ctx.moveTo(cursor,top);
      ctx.lineTo(cursor,bottom);
      ctx.stroke();
    }
  }

  function renderLedger() {
    const reached = entries.filter(record => record.appear <= sampleTime + .002);
    const recent = reached.slice(-3);
    if (track && !recent.some(record => record.canonicalId === track.canonicalId)) recent[0] = track;
    recent.sort((a,b) => a.appear - b.appear);
    const identity = recent.map(record => record.canonicalId).join(',');
    if (identity === ledgerKey) {
      for (const button of ledger.querySelectorAll('button')) {
        button.setAttribute('aria-pressed', String(button.dataset.record === track?.canonicalId));
      }
      return;
    }
    ledgerKey = identity;
    ledger.replaceChildren(...recent.map(record => {
      const row = section('li', '', '');
      const button = section('button', '', '');
      button.type = 'button';
      button.dataset.record = record.canonicalId;
      button.setAttribute('aria-pressed', String(record.canonicalId === track?.canonicalId));
      const stamp = section('time', '', minuteTime(record.appear));
      const id = section('span', '', '');
      id.textContent = record.sourceId;
      const marker = section('i', '', '');
      marker.style.backgroundColor = tones[record.category] || 'currentColor';
      marker.setAttribute('aria-hidden', 'true');
      button.append(stamp,id,marker);
      row.append(button);
      return row;
    }));
  }

  function renderSequence() {
    const w = sequenceCanvas.clientWidth, h = sequenceCanvas.clientHeight;
    if (w < 60 || h < 50) return;
    const density = Math.min(window.devicePixelRatio || 1, 2);
    if (sequenceCanvas.width !== Math.round(w*density) || sequenceCanvas.height !== Math.round(h*density)) {
      sequenceCanvas.width = Math.round(w*density);
      sequenceCanvas.height = Math.round(h*density);
    }
    const ctx = sequenceCanvas.getContext('2d');
    ctx.setTransform(density,0,0,density,0,0);
    ctx.clearRect(0,0,w,h);
    const left = 31, right = w-20, top = 24, base = Math.round(h*.51), bottom = h-19;
    const x = time => left + (right-left) * Math.min(1, Math.max(0,time/sequenceDuration));
    const keys = sequenceKeys;
    const size = (right-left) / Math.max(1,timelineBins.length);
    const peak = Math.max(1, ...timelineBins.map(bin => bin.counts.reduce((total,count) => total+count,0)));
    const increment = Math.max(1,Math.ceil(peak/4));
    const unit = (base-top) / (increment*4);
    const lane = (bottom-base-4) / Math.max(1,keys.length);
    const localTime = video.readyState >= 1 && !video.seeking ? video.currentTime : sampleTime;
    const actualTime = Math.min(sequenceDuration,sequenceOffset() + localTime);
    const cursor = hoveredTime ?? actualTime;
    const cursorX = x(cursor);
    ctx.fillStyle = '#dbac6720';
    ctx.fillRect(cursorX-5,top,10,bottom-top);
    ctx.font = '10px Consolas, monospace';
    ctx.textAlign = 'right';
    ctx.beginPath();
    for(let i=0;i<=4;i++) {
      const yy = Math.round(base-i*increment*unit)+.5;
      ctx.fillStyle = '#c9c0b2';
      ctx.fillText(String(i*increment),left-7,yy+3);
      ctx.moveTo(left,yy);
      ctx.lineTo(right,yy);
    }
    ctx.strokeStyle = '#d7c5ad2c';
    ctx.setLineDash([1,5]);
    ctx.stroke();
    ctx.setLineDash([]);
    const toneKeys = Object.keys(tones);
    timelineBins.forEach(({counts,changes},i) => {
      const start = left + i*size;
      let level = 0;
      keys.forEach((key,index) => {
        const tone = toneKeys.indexOf(key);
        const count = counts[tone];
        const color = tones[key];
        ctx.fillStyle = color;
        const passed = start <= x(actualTime);
        for(let n=0;n<count;n++,level++) {
          const grain = ((i*23+n*7+index*11)%13)/13;
          ctx.globalAlpha = (passed ? .74 : .51) + grain*.25;
          ctx.fillRect(start+grain*.5,base-(level+1)*unit,Math.max(1,size-1.55),Math.min(2.8,Math.max(1,unit*.73)));
        }
        if (count) {
          ctx.globalAlpha = changes[tone] ? 1 : Math.min(.67,.13+count*.084);
          ctx.fillRect(start,base+5+(index+.5)*lane,Math.max(1,size-1.25),changes[tone]?3:1.6);
        }
      });
    });
    ctx.globalAlpha = 1;
    keys.forEach((key,i) => {
      ctx.save();
      ctx.translate(left-20,base+(i+.5)*lane);
      ctx.scale(.7,.7);
      ctx.lineWidth = 1.35;
      ctx.strokeStyle = tones[key];
      ctx.stroke(laneIcons[key]);
      ctx.restore();
    });
    ctx.font = '10px Consolas, monospace';
    ctx.textAlign = 'center';
    ctx.fillStyle = '#bcb2a5';
    ctx.strokeStyle = '#a5988366';
    ctx.beginPath();
    const spacing = sequenceDuration<10 ? 2 : sequenceDuration<26 ? 5 : w<560 ? 20 : 10;
    const ticks = [0];
    for(let t=spacing;t<sequenceDuration-spacing*.44;t+=spacing) ticks.push(t);
    ticks.push(sequenceDuration);
    for(const time of ticks) {
      const xx = x(time);
      ctx.moveTo(xx,bottom);
      ctx.lineTo(xx,bottom+4);
      ctx.fillText(minuteTime(time).slice(0,5),xx,h-4);
    }
    ctx.moveTo(left,bottom);
    ctx.lineTo(right,bottom);
    ctx.stroke();
    ctx.fillStyle = '#d9ba86';
    for (const time of sequenceEvents) {
      ctx.beginPath();
      ctx.arc(x(time),top-4,1.4,0,Math.PI*2);
      ctx.fill();
    }
    ctx.textAlign = 'left';
    for (const segment of sequenceSegments) {
      const start = x(segment.offset);
      ctx.strokeStyle = '#bab19a55';
      ctx.beginPath();
      ctx.moveTo(start,top);
      ctx.lineTo(start,bottom);
      ctx.stroke();
      ctx.fillStyle = '#c9bb9a';
      const space = x(segment.offset+segment.duration)-start;
      const label = space < 51 && segment.key !== 'legacy' ? '0'+segment.key.slice(-1) : cameraName(segment.key);
      ctx.fillText(label,start+4,top+9);
    }
    ctx.strokeStyle = '#e4b777';
    ctx.beginPath();
    ctx.moveTo(cursorX,top-8);
    ctx.lineTo(cursorX,bottom);
    ctx.stroke();
    ctx.fillStyle = '#f3cc91';
    const selectedBin = timelineBins[Math.min(timelineBins.length-1,Math.floor(cursor/sequenceDuration*timelineBins.length))];
    if (selectedBin) {
      const yy = base-unit*selectedBin.counts.reduce((sum,count) => sum+count,0);
      ctx.beginPath();
      ctx.moveTo(cursorX,yy-3);
      ctx.lineTo(cursorX+3,yy);
      ctx.lineTo(cursorX,yy+3);
      ctx.lineTo(cursorX-3,yy);
      ctx.fill();
    }
    ctx.textAlign = 'center';
    ctx.fillText(minuteTime(cursor),Math.min(right-19,Math.max(left+18,cursorX)),12);
    sequenceCanvas.setAttribute('aria-valuemax',sequenceDuration.toFixed(2));
    sequenceCanvas.setAttribute('aria-valuenow',actualTime.toFixed(2));
    sequenceCanvas.setAttribute('aria-valuetext',minuteTime(actualTime));
  }

  function renderTrace() {
    const trace = byId('progressTrace');
    const width = trace.clientWidth;
    const height = trace.clientHeight;
    if (!width || !height) return;
    const density = Math.min(window.devicePixelRatio || 1, 2);
    const pixelWidth = Math.round(width * density), pixelHeight = Math.round(height * density);
    if (trace.width !== pixelWidth || trace.height !== pixelHeight) {
      trace.width = pixelWidth;
      trace.height = pixelHeight;
    }
    const ctx = trace.getContext('2d');
    ctx.setTransform(density, 0, 0, density, 0, 0);
    ctx.clearRect(0, 0, width, height);
    const x = time => 3 + (width - 6) * Math.min(time / timerange, 1);
    const y = n => height - 5 - (height - 9) * n / Math.max(1, entries.length);
    function line(time, fade) {
      let count = 0;
      ctx.beginPath();
      ctx.moveTo(x(0), y(count));
      for (const item of entries) {
        if (item.appear > time) break;
        ctx.lineTo(x(item.appear), y(count));
        ctx.lineTo(x(item.appear), y(++count));
      }
      ctx.lineTo(x(time), y(count));
      ctx.strokeStyle = fade;
      ctx.lineWidth = 1.5;
      ctx.lineJoin = 'round';
      ctx.stroke();
      return count;
    }
    line(timerange, '#514638');
    const count = line(sampleTime, '#d9bc90');
    ctx.beginPath();
    ctx.arc(x(sampleTime), y(count), 2.8, 0, 2 * Math.PI);
    ctx.fillStyle = '#f0cc93';
    ctx.fill();
  }

  C.events.addEventListener('scenechange', e => loadScene(e.detail));
  C.events.addEventListener('objectdiscovered', e => {
    const { canonicalId, object } = e.detail;
    if (seen.has(canonicalId) || !object) return;
    seen.add(canonicalId);
    window.Panels.code.push(minuteTime(video.currentTime) + '  [' + object.sourceId + ']  登记 ' + object.label);
  });
  C.events.addEventListener('frame', e => {
    const { sceneId, time, visibleIds, trackingId, trackingBounds } = e.detail;
    if (sceneId !== activeKey || video.seeking) return;
    const timestamp = minuteTime(time);
    const chosen = trackingId || null;
    const changed = (track?.canonicalId || null) !== chosen;
    if (changed) setTarget(chosen ? C.get(chosen) : null);
    const sample = Math.floor(time * 4);
    const cursorFrame = Math.floor(time * 16);
    if (sample !== lastSample || changed) {
      actualCount = visibleIds.length;
      sampleTime = time;
      lastSample = sample;
      sequenceFrame = cursorFrame;
      renderSample();
      if (trackingId && chosen === trackingId) updateEvidence(trackingBounds);
    } else if (cursorFrame !== sequenceFrame) {
      sequenceFrame = cursorFrame;
      renderSequence();
    }
    const second = Math.floor(time);
    if (second !== lastSecond) {
      lastSecond = second;
      window.Panels.code.push(timestamp + '  [' + cameraName(sceneId) + ']  画面内 ' + visibleIds.length + ' 项标注');
    }
  });

  function playbackStatus() {
    const indicator = code.querySelector('.dh-live');
    indicator.innerHTML = '<i></i>' + (video.paused ? 'PAUSED' : 'RUNNING');
    indicator.classList.toggle('paused', video.paused);
  }
  video.addEventListener('play', playbackStatus);
  video.addEventListener('pause', playbackStatus);
  video.addEventListener('seeked', () => { lastSample = -1; });
  playbackStatus();
  C.ready.then(data => {
    scenes = data.scenes.filter(s => s.key !== 'legacy');
    let offset = 0;
    completeSequence = scenes.flatMap(({key,duration}) => {
      if (!Number.isFinite(duration) || duration <= 0) return [];
      const segment = {key,duration,offset,records:data.records.filter(record => record.sceneId === key)};
      offset += duration;
      return [segment];
    });
    const key = window.__activeScene?.() || 'street2';
    loadScene({ sceneId: key, scene: data.scenes.find(s => s.key === key) });
  });
  window.addEventListener('resize', () => window.RenderLifecycle.changed());
  window.RenderLifecycle.changed();
})();
