(function () {
  'use strict';
  const C = window.Census;
  const sources = ['street1', 'street2', 'street3', 'street4'];
  const camera = key => 'CAM 0' + key.slice(-1);
  const art = {
    'METRO SIGN': 'metro', 'GANTRY SIGN': 'gantry', 'CAMERA POLE': 'camera',
    BARRIER: 'barrier', GUARDRAIL: 'fence', LUMINAIRE: 'lamp', KERB: 'kerb',
    MANHOLE: 'manhole', FENCE: 'fence', SUV: 'suv-dark', SEDAN: 'sedan',
    VAN: 'van', BUS: 'bus', 'WHITE SUV': 'suv', 'BLACK SUV': 'suv-dark',
    TAXI: 'taxi', 'WHITE VAN': 'van', COACH: 'coach', MPV: 'mpv',
    SIGN: 'sign', BANNER: 'banner', 'BIKE RACK': 'bike', 'CITY BUS': 'bus'
  };
  const groups = [
    ['vehicles', '交通工具', record => record.category === 'vehicle'],
    ['signage', '导向与信息', record => /SIGN|BANNER/.test(record.labelEn)],
    ['lighting', '照明与监测', record => /LUMINAIRE|CAMERA POLE/.test(record.labelEn)],
    ['barriers', '道路围护与停放', record => /BARRIER|GUARDRAIL|FENCE|BIKE RACK/.test(record.labelEn)],
    ['surface', '地表基础设施', () => true]
  ];
  const dialog = document.createElement('dialog');
  dialog.className = 'assembly';
  dialog.setAttribute('aria-labelledby', 'assemblyTitle');
  dialog.innerHTML = `
    <header class="assembly-header">
      <div><span class="assembly-kicker">第二人口 / 四路观察</span><h2 id="assemblyTitle">工业物集合</h2></div>
      <nav aria-label="按机位查看"></nav>
      <button type="button" data-action="close" autofocus>返回监控 ×</button>
    </header>
    <div class="assembly-stage">
      <div class="assembly-world" aria-label="按类别分布的工业物"></div>
      <div class="assembly-sources" aria-hidden="true"></div>
      <button type="button" class="assembly-skip" data-action="skip">直接查看集合 ↗</button>
    </div>
    <footer class="assembly-footer">
      <p class="assembly-count"></p>
      <div class="assembly-detail" hidden>
        <span><strong></strong><small></small></span>
        <button type="button" data-action="source">定位原片 ↗</button>
        <button type="button" data-action="archive">查看档案 ↗</button>
      </div>
    </footer>`;
  document.body.append(dialog);
  const openButton = document.createElement('button');
  openButton.type = 'button';
  openButton.className = 'survey-entry';
  openButton.id = 'openAssembly';
  openButton.textContent = '工业物集合';
  document.getElementById('chooseScene').after(openButton);
  const world = dialog.querySelector('.assembly-world');
  const filterNav = dialog.querySelector('nav');
  const detail = dialog.querySelector('.assembly-detail');
  const count = dialog.querySelector('.assembly-count');
  let records = [];
  let selected;
  let snapshot;
  let leavingForRecord = false;
  let archiveReturn;
  let introTimer;
  const objects = new Map();

  function build() {
    records = C.records.filter(record => sources.includes(record.sceneId) && record.populationEligible !== false);
    const fragments = new Map(groups.map(([key, title]) => {
      const section = document.createElement('section');
      section.className = 'assembly-group';
      section.dataset.group = key;
      const heading = document.createElement('h3');
      heading.textContent = title;
      const tally = document.createElement('output');
      heading.append(tally);
      const grid = document.createElement('div');
      grid.className = 'assembly-objects';
      section.append(heading, grid);
      world.append(section);
      return [key,{ grid, tally }];
    }));
    const sorted = [...records].sort((a,b) => a.labelEn.localeCompare(b.labelEn) || a.sourceId.localeCompare(b.sourceId));
    sorted.forEach((record, index) => {
      const [group] = groups.find(([, , includes]) => includes(record));
      const object = document.createElement('button');
      object.type = 'button';
      object.className = 'assembly-object';
      object.dataset.source = record.sceneId;
      object.title = record.label + ' · ' + record.sourceId;
      object.setAttribute('aria-label', record.label + '，' + camera(record.sceneId) + '，' + record.sourceId);
      object.setAttribute('aria-pressed', 'false');
      object.style.setProperty('--delay', (index % 12) * 22 + 'ms');
      const sprite = art[record.labelEn];
      if (sprite) {
        const image = document.createElement('img');
        image.src = 'assets/residue/assembly/' + sprite + '.webp';
        image.alt = '';
        image.decoding = 'async';
        object.append(image);
      } else {
        const mark = document.createElement('i');
        mark.className = record.labelEn === 'ARROW' ? 'assembly-arrow' : 'assembly-lane';
        mark.setAttribute('aria-hidden', 'true');
        object.append(mark);
      }
      object.addEventListener('click', () => select(record));
      fragments.get(group).grid.append(object);
      fragments.get(group).tally.value = fragments.get(group).grid.children.length;
      objects.set(record.canonicalId, object);
    });
    for (const key of ['all', ...sources]) {
      const button = document.createElement('button');
      button.type = 'button';
      button.dataset.camera = key;
      button.textContent = key === 'all' ? '全部' : camera(key);
      button.addEventListener('click', () => applyFilter(key));
      filterNav.append(button);
    }
    for (const key of sources) {
      const frame = document.createElement('div');
      const image = document.createElement('img');
      image.src = 'integration/entry-frames/CAM0' + key.slice(-1) + '-02.jpg';
      image.alt = '';
      const label = document.createElement('span');
      label.textContent = camera(key);
      frame.append(image, label);
      dialog.querySelector('.assembly-sources').append(frame);
    }
  }

  function select(record) {
    if (selected) objects.get(selected.canonicalId).setAttribute('aria-pressed', 'false');
    selected = record;
    detail.hidden = !record;
    if (!record) return;
    objects.get(record.canonicalId).setAttribute('aria-pressed', 'true');
    detail.querySelector('strong').textContent = record.label;
    detail.querySelector('small').textContent = camera(record.sceneId) + ' · ' + record.sourceId;
  }

  function applyFilter(key) {
    if (selected && key !== 'all' && selected.sceneId !== key) select(null);
    for (const button of filterNav.children) button.setAttribute('aria-pressed', String(button.dataset.camera === key));
    for (const object of objects.values()) {
      const dim = key !== 'all' && key !== object.dataset.source;
      object.classList.toggle('other-source', dim);
      object.disabled = dim;
    }
    const visible = key === 'all' ? records.length : records.filter(record => record.sceneId === key).length;
    count.textContent = visible + ' 条候选观测 / ' + (key === 'all' ? '四路监控' : camera(key)) +
      ' · 形态为示意，跨片段身份待核验';
  }

  function finishIntro() {
    clearTimeout(introTimer);
    dialog.classList.remove('assembling');
  }

  async function open() {
    await C.ready;
    if (dialog.open || C.state.view !== 'monitor') return;
    if (!filterNav.childElementCount) build();
    snapshot = window.Monitor.snapshot();
    leavingForRecord = false;
    document.getElementById('cam').pause();
    C.setState({view:'assembly'});
    window.RenderLifecycle.changed();
    applyFilter('all');
    select(null);
    if (!matchMedia('(prefers-reduced-motion: reduce)').matches) {
      dialog.classList.add('assembling');
      introTimer = setTimeout(finishIntro, 1650);
    }
    dialog.showModal();
  }

  openButton.addEventListener('click', open);
  C.events.addEventListener('archiveclose', event => {
    if (!archiveReturn) return;
    const saved = archiveReturn;
    archiveReturn = null;
    if (!event.detail.suppressed) void window.Monitor.restore(saved);
  });
  dialog.addEventListener('close', () => {
    finishIntro();
    if (!leavingForRecord) void window.Monitor.restore(snapshot);
  });
  dialog.addEventListener('click', async event => {
    const action = event.target.closest('[data-action]')?.dataset.action;
    if (action === 'close') dialog.close();
    if (action === 'skip') {
      finishIntro();
      dialog.querySelector('[data-action="close"]').focus();
    }
    if (!selected || (action !== 'source' && action !== 'archive')) return;
    const record = selected;
    leavingForRecord = true;
    dialog.close();
    try {
      if (action === 'source') {
        await window.Monitor.restore({sceneId:record.sceneId,time:record.appear+.05,paused:true,selectedObjectId:record.canonicalId});
      } else {
        archiveReturn = snapshot;
        await window.__openCanonical(record.canonicalId,{
          seekTime: record.appear + .05,
          returnSnapshot: {...snapshot,paused:true}
        });
      }
    } catch (error) {
      console.warn('[ASSEMBLY] Could not open observation', error);
      archiveReturn = null;
      await window.Monitor.restore(snapshot);
    }
  });
})();
