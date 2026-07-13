(() => {
  "use strict";

  const stageCounts = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 100, 200, 1000];
  const stageIntervals = stageCounts.map((_, i) => (i < 10 ? 0.5 : 0.14));
  const COLORS = {
    blue: "rgba(143,216,255,1)", blueSoft: "rgba(143,216,255,0.28)",
    green: "rgba(148,240,193,1)", greenSoft: "rgba(148,240,193,0.28)",
    orange: "rgba(255,176,122,1)", orangeSoft: "rgba(255,176,122,0.28)",
    yellow: "rgba(255,228,141,1)", yellowSoft: "rgba(255,228,141,0.28)",
    red: "rgba(255,133,133,1)", redSoft: "rgba(255,133,133,0.28)",
    purple: "rgba(189,159,255,1)", purpleSoft: "rgba(189,159,255,0.28)",
    text: "rgba(241,246,255,0.88)", muted: "rgba(241,246,255,0.62)",
  };

  const els = {
    buttons: Array.from(document.querySelectorAll("[data-paper-mode]")),
    panels: Array.from(document.querySelectorAll("[data-paper-panel]")),
    equations: Array.from(document.querySelectorAll("[data-paper-equations]")),
    notes: Array.from(document.querySelectorAll("[data-paper-note]")),
    play: document.getElementById("playButton"),
    reset: document.getElementById("resetButton"),
  };
  const state = { mode: "core", warmup: 0, stageIndex: 0, stageTimer: 0, playing: false, lastTimestamp: 0 };
  const drawers = {};

  const clamp = (x, lo, hi) => Math.max(lo, Math.min(hi, x));
  const lerp = (a, b, u) => a + (b - a) * u;
  const easeOut = (u) => 1 - Math.pow(1 - clamp(u, 0, 1), 3);
  const fmt = (x, digits = 3) => Number.isFinite(x) ? x.toFixed(digits) : "—";
  function expFmt(x) {
    if (!Number.isFinite(x) || x === 0) return "0";
    const e = Math.floor(Math.log10(Math.abs(x)));
    return `${(x / Math.pow(10, e)).toFixed(1)}e${e < 0 ? "−" : "+"}${Math.abs(e)}`;
  }

  function setupCanvas(canvas) {
    if (!canvas) return { ctx: null, width: 0, height: 0 };
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    const width = rect.width, height = rect.height;
    const ctx = canvas.getContext("2d");
    if (!ctx || width < 2 || height < 2) return { ctx, width: 0, height: 0 };
    const pw = Math.max(1, Math.round(width * dpr));
    const ph = Math.max(1, Math.round(height * dpr));
    if (canvas.width !== pw || canvas.height !== ph) { canvas.width = pw; canvas.height = ph; }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    return { ctx, width, height };
  }

  function drawBackground(ctx, width, height) {
    ctx.clearRect(0, 0, width, height);
    const g = ctx.createLinearGradient(0, 0, 0, height);
    g.addColorStop(0, "rgba(9,17,29,0.72)");
    g.addColorStop(1, "rgba(8,15,24,0.94)");
    ctx.fillStyle = g; ctx.fillRect(0, 0, width, height);
  }

  function drawGrid(ctx, width, height, pad, rows = 5, cols = 6) {
    ctx.save(); ctx.strokeStyle = "rgba(255,255,255,0.06)"; ctx.lineWidth = 1;
    for (let i = 0; i <= rows; i += 1) {
      const y = pad.top + (i / rows) * (height - pad.top - pad.bottom);
      ctx.beginPath(); ctx.moveTo(pad.left, y); ctx.lineTo(width - pad.right, y); ctx.stroke();
    }
    for (let j = 0; j <= cols; j += 1) {
      const x = pad.left + (j / cols) * (width - pad.left - pad.right);
      ctx.beginPath(); ctx.moveTo(x, pad.top); ctx.lineTo(x, height - pad.bottom); ctx.stroke();
    }
    ctx.restore();
  }

  function drawAxes(ctx, width, height, pad, xLabel, yLabel) {
    ctx.save(); ctx.strokeStyle = "rgba(255,255,255,0.12)";
    ctx.beginPath(); ctx.moveTo(pad.left, pad.top); ctx.lineTo(pad.left, height - pad.bottom); ctx.lineTo(width - pad.right, height - pad.bottom); ctx.stroke();
    ctx.fillStyle = "rgba(241,246,255,0.70)"; ctx.font = "11px Inter, system-ui, sans-serif";
    ctx.fillText(yLabel, pad.left, Math.max(12, pad.top - 4)); ctx.textAlign = "right"; ctx.fillText(xLabel, width - pad.right, height - 9); ctx.restore();
  }

  function drawArrow(ctx, x0, y0, x1, y1, color, width = 1.8) {
    const a = Math.atan2(y1 - y0, x1 - x0);
    ctx.save(); ctx.strokeStyle = color; ctx.fillStyle = color; ctx.lineWidth = width;
    ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x1, y1);
    ctx.lineTo(x1 - 7 * Math.cos(a - Math.PI / 6), y1 - 7 * Math.sin(a - Math.PI / 6));
    ctx.lineTo(x1 - 7 * Math.cos(a + Math.PI / 6), y1 - 7 * Math.sin(a + Math.PI / 6));
    ctx.closePath(); ctx.fill(); ctx.restore();
  }

  function stageContext() {
    const completed = state.stageIndex;
    const progress = completed < stageCounts.length ? clamp(state.stageTimer / stageIntervals[completed], 0, 1) : 1;
    return { completed, progress };
  }
  function recoveryProgress() { const s = stageContext(); return easeOut((s.completed + s.progress) / stageCounts.length); }
  function visiblePathCount(maxCount) { const s = stageContext(); return Math.max(1, Math.round(maxCount * clamp((s.completed + s.progress) / stageCounts.length, 0, 1))); }

  function drawProgressSeries(ctx, values, xScale, yScale, color, lineWidth = 2.2) {
    const { completed, progress } = stageContext();
    if (completed <= 0) {
      ctx.beginPath(); ctx.fillStyle = color; ctx.arc(xScale(stageCounts[0]), yScale(values[0]), 3.2, 0, Math.PI * 2); ctx.fill(); return;
    }
    ctx.beginPath();
    for (let i = 0; i < completed; i += 1) {
      const x = xScale(stageCounts[i]), y = yScale(values[i]);
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    if (completed < stageCounts.length) {
      const i0 = completed - 1;
      ctx.lineTo(lerp(xScale(stageCounts[i0]), xScale(stageCounts[completed]), progress), lerp(yScale(values[i0]), yScale(values[completed]), progress));
    }
    ctx.strokeStyle = color; ctx.lineWidth = lineWidth; ctx.stroke();
  }

  function drawActive() { if (drawers[state.mode]) drawers[state.mode](); }
  function registerMode(id, draw) { drawers[id] = draw; if (state.mode === id) requestAnimationFrame(draw); }
  function typeset() {
    if (!window.MathJax?.typesetPromise) return;
    window.MathJax.typesetPromise(els.equations.filter((x) => !x.hidden)).catch((e) => console.warn("MathJax typesetting failed", e));
  }

  function restart() { state.warmup = 0; state.stageIndex = 0; state.stageTimer = 0; state.playing = true; }
  function reset() { state.warmup = 0; state.stageIndex = 0; state.stageTimer = 0; state.playing = false; drawActive(); }

  function setMode(modeId, updateUrl = false) {
    const selected = modeId === "constraints" || modeId === "nonexp" ? modeId : "core";
    state.mode = selected;
    els.panels.forEach((x) => { x.hidden = x.dataset.paperPanel !== selected; });
    els.equations.forEach((x) => { x.hidden = x.dataset.paperEquations !== selected; });
    els.notes.forEach((x) => { x.hidden = x.dataset.paperNote !== selected; });
    if (selected === "core") {
      els.buttons.forEach((b) => { if (b.dataset.paperMode !== "core") { b.classList.remove("is-active"); b.setAttribute("aria-pressed", "false"); } });
    } else {
      els.buttons.forEach((b) => { const active = b.dataset.paperMode === selected; b.classList.toggle("is-active", active); b.setAttribute("aria-pressed", String(active)); });
      restart();
    }
    requestAnimationFrame(() => { drawActive(); window.dispatchEvent(new Event("resize")); });
    typeset();
    if (updateUrl) {
      const url = new URL(window.location.href);
      if (selected === "core") url.searchParams.delete("example");
      else { url.searchParams.set("example", selected === "nonexp" ? "non-exponential" : "constraints"); url.searchParams.delete("mode"); }
      history.replaceState({}, "", url);
    }
  }

  function animate(ts) {
    if (!state.lastTimestamp) state.lastTimestamp = ts;
    const dt = Math.min((ts - state.lastTimestamp) / 1000, 0.10); state.lastTimestamp = ts;
    if (state.playing) {
      if (state.warmup < 1) state.warmup = clamp(state.warmup + dt / 2, 0, 1);
      else if (state.stageIndex < stageCounts.length) {
        state.stageTimer += dt;
        if (state.stageTimer >= stageIntervals[state.stageIndex]) { state.stageTimer = 0; state.stageIndex += 1; }
      } else state.playing = false;
    }
    drawActive(); requestAnimationFrame(animate);
  }

  window.PGDemo = { stageCounts, COLORS, state, clamp, lerp, easeOut, fmt, expFmt, setupCanvas, drawBackground, drawGrid, drawAxes, drawArrow, stageContext, recoveryProgress, visiblePathCount, drawProgressSeries, registerMode };

  els.buttons.forEach((b) => b.addEventListener("click", () => setMode(b.dataset.paperMode, true)));
  els.play?.addEventListener("click", restart); els.reset?.addEventListener("click", reset);
  window.addEventListener("resize", drawActive); window.addEventListener("pgdpo:ready", drawActive);

  const p = new URLSearchParams(location.search), example = p.get("example"), legacy = p.get("mode");
  const initial = example === "constraints" || legacy === "constraints" ? "constraints" :
    (example === "non-exponential" || example === "nonexp" || legacy === "non-exponential" || legacy === "nonexp") ? "nonexp" : "core";
  setMode(initial, false); requestAnimationFrame(animate); setTimeout(() => { if (state.mode !== "core") restart(); }, 350);
})();
