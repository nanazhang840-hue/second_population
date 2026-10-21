/* ═══════════════════════════════════════════════════════════════════════
   GLITCH RUNTIME — 开场启动序列 + 视频画面信号劣化
   仅使用 #000000 + #A8D3E0，与全站配色一致
   参考语法：chrislemke.github.io「Glitch Art」研究页
     · 双通道错位重影（单色青版）
     · repeating-linear-gradient 扫描线
     · SVG feTurbulence 噪声
     · 横向切片位移 + steps() 离散跳变
   ═══════════════════════════════════════════════════════════════════════ */
(function () {
  "use strict";

  const $ = (id) => document.getElementById(id);
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const rnd = (a, b) => a + Math.random() * (b - a);
  const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

  /* ═════════════ 1. 开场启动界面 ═════════════ */
  const bootScreen = $("bootScreen");
  const bootLog = $("bootLog");
  const bootFill = $("bootFill");
  const bootPct = $("bootPct");
  const bootErr = $("bootErr");
  const bootLvl = $("bootLvl");
  const bootEnter = $("bootEnter");
  const bootSkip = document.querySelector(".boot-skip");

  let bootDone = false;

  const BOOT_LINES = [
    { t: "MOUNT /dev/signal", s: "ok" },
    { t: "DECODING CHANNEL R", s: "ok" },
    { t: "DECODING CHANNEL G — DRIFT", s: "warn" },
    { t: "DECODING CHANNEL B", s: "ok" },
    { t: "SYNC 40 TRACK SIGNATURES", s: "ok" },
    { t: "LOADING tracks.json — 40 OBJECTS", s: "ok" },
    { t: "3 SIGNATURES UNVERIFIED", s: "warn" },
    { t: "BUFFERING DATAMOSH ENGINE", s: "ok" },
    { t: "GEOMETRY ENGINE — 9 SUBTYPES", s: "ok" },
    { t: "ALIGNING CHANNEL OFFSET ±3px", s: "ok" },
    { t: "SIGNAL LOCKED", s: "ok" }
  ];

  function setProgress(p) {
    if (!bootFill || !bootPct) return;
    bootFill.style.width = p + "%";
    bootPct.textContent = String(p).padStart(2, "0") + "%";
  }

  function pushLogLine(item, idx) {
    if (!bootLog) return;
    const el = document.createElement("div");
    el.className = "bl-line";
    const idxEl = document.createElement("span");
    idxEl.className = "bl-idx";
    idxEl.textContent = String(idx + 1).padStart(2, "0");
    const txtEl = document.createElement("span");
    txtEl.className = "bl-txt " + (item.s === "warn" ? "bl-warn" : "bl-ok");
    txtEl.textContent = item.t;
    el.appendChild(idxEl);
    el.appendChild(txtEl);
    bootLog.appendChild(el);
    // 只保留最近 6 行，模拟终端滚动
    while (bootLog.children.length > 6) bootLog.removeChild(bootLog.firstChild);
  }

  function runBootSequence() {
    if (!bootLog) { finishBoot(); return; }
    let i = 0;
    const total = BOOT_LINES.length;

    (function next() {
      if (i >= total) { finishBoot(); return; }
      const item = BOOT_LINES[i];
      pushLogLine(item, i);
      i++;
      setProgress(Math.round(92 * (i / total)));

      // 偶发注入伪造传输错误，强化 glitch 叙事
      if (!reduced && Math.random() < 0.22) {
        if (bootErr) bootErr.textContent = pick(["ERR_NONE", "0x00", "FRAME_OFFSET", "CRC_MISMATCH", "0xDEAD"]);
        if (bootLvl) bootLvl.textContent = Math.round(rnd(8, 94)).toString().padStart(2, "0") + "%";
      }
      setTimeout(next, rnd(90, 200));
    })();
  }

  function finishBoot() {
    setProgress(100);
    if (bootEnter) {
      bootEnter.disabled = false;
      bootEnter.focus();
    }
  }

  function enterSite() {
    if (bootDone) return;
    bootDone = true;
    if (!reduced && bootScreen) bootScreen.classList.add("is-collapsing");
    document.body.classList.remove("is-booting");
    setTimeout(function () {
      if (bootScreen && bootScreen.parentNode) bootScreen.parentNode.removeChild(bootScreen);
      startDegrade();
      window.dispatchEvent(new CustomEvent("boot:entered"));
    }, reduced ? 60 : 560);
  }

  if (bootEnter) bootEnter.addEventListener("click", enterSite);
  if (bootSkip) bootSkip.addEventListener("click", enterSite);

  document.addEventListener("keydown", function (e) {
    if (bootDone || !bootScreen) return;
    if (e.key === "Enter" && bootEnter && !bootEnter.disabled) {
      e.preventDefault();
      enterSite();
    }
  });

  /* ═════════════ 2. 视频画面：随机横向切片 ═════════════
     手法参考 Glitch Art 页的 clip-path 切片位移 + steps() 跳变。 */
  const degrade = $("sigDegrade");
  const sliceHost = $("sdSlices");
  let level = 1;              // 默认轻度
  let sliceTimer = null;

  function spawnSlice() {
    if (!sliceHost) return;
    const el = document.createElement("i");
    el.className = "sd-slice";
    const h = rnd(2, 9);              // 条高 2–9%
    const top = rnd(0, 96);
    const shift = rnd(-3.2, 3.2);     // 错位幅度（刻意克制）
    const dur = Math.round(rnd(90, 220));
    el.style.height = h + "%";
    el.style.top = top + "%";
    el.style.opacity = "0";
    sliceHost.appendChild(el);

    // 首帧：瞬间错位
    el.style.transform = "translateX(" + shift.toFixed(2) + "px)";
    el.style.opacity = String(rnd(0.10, 0.24));
    // 下一帧：steps(2) 分段归位 —— 跳变而非平滑滑动
    requestAnimationFrame(function () {
      el.style.transition = "transform " + dur + "ms steps(2), opacity " + dur + "ms steps(2)";
      el.style.transform = "translateX(0)";
      el.style.opacity = "0";
    });

    setTimeout(function () { if (el.parentNode) el.parentNode.removeChild(el); }, dur + 60);
  }

  function scheduleSlice() {
    clearTimeout(sliceTimer);
    if (!sliceHost || level === 0) return;
    const base = level === 1 ? [2600, 5400] : [700, 2100];
    sliceTimer = setTimeout(function () {
      spawnSlice();
      scheduleSlice();
    }, Math.round(rnd(base[0], base[1])));
  }

  function startDegrade() {
    if (sliceHost) sliceHost.innerHTML = "";
    scheduleSlice();
  }

  const ctl = $("sigCtl");
  if (ctl) {
    ctl.addEventListener("click", function (e) {
      const btn = e.target.closest("button[data-lv]");
      if (!btn) return;
      level = parseInt(btn.getAttribute("data-lv"), 10);
      if (degrade) degrade.setAttribute("data-level", String(level));
      Array.prototype.forEach.call(ctl.querySelectorAll("button[data-lv]"), function (b) {
        b.classList.toggle("on", b === btn);
      });
      if (sliceHost) sliceHost.innerHTML = "";
      scheduleSlice();
    });
  }

  /* 启动 */
  if (bootScreen) {
    runBootSequence();
  } else {
    document.body.classList.remove("is-booting");
    startDegrade();
  }
})();