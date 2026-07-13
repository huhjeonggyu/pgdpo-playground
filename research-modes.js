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

  // Use roughly twice the original vertical chart space. The larger plotting
  // areas reduce label collisions while the page continues to scroll naturally.
  const chartHeights = {
    fsdeCanvas: 380,
    hamiltonianCanvas: 380,
    tcProjectionCanvas: 380,
    constraintRolloutCanvas: 380,
    nonexpKernelCanvas: 380,
    constraintRecoveryCanvas: 380,
    nonexpRecoveryCanvas: 380,
    trainCanvas: 300,
    constraintFeasibleCanvas: 300,
    nonexpAnchorCanvas: 300,
    costateCanvas: 376,
    constraintAdjointCanvas: 376,
    nonexpAdjointCanvas: 376,
    lambdaConvCanvas: 144,
    constraintAdjointConvCanvas: 144,
    nonexpDiagonalCanvas: 144,
    piConvCanvas: 200,
    tcConvergenceCanvas: 216,
    constraintResidualCanvas: 216,
    nonexpResidualCanvas: 216,
  };
  Object.entries(chartHeights).forEach(([id, height]) => {
    const canvas = document.getElementById(id);
    if (canvas) canvas.style.aspectRatio = `520 / ${height}`;
  });

  // The Hamiltonian alone does not identify the adjoint variables shown in the
  // figures. Add the corresponding BSDE directly below each Hamiltonian card.
  if (!document.getElementById("adjoint-bsde-styles")) {
    const style = document.createElement("style");
    style.id = "adjoint-bsde-styles";
    style.textContent = `
      .adjoint-bsde-block {
        width: 100%;
        margin-top: 12px;
        padding: 12px 2px 7px;
        border-top: 1px solid rgba(255,255,255,0.10);
        font-size: 1rem;
      }
      .adjoint-bsde-label {
        margin-bottom: 7px;
        color: rgba(168,199,255,0.88);
        font-size: 0.72rem;
        font-weight: 850;
        letter-spacing: 0.10em;
        line-height: 1.25;
        text-transform: uppercase;
      }
      .adjoint-bsde-block > div:not(.adjoint-bsde-label) + div {
        margin-top: 5px;
      }
      .adjoint-bsde-block mjx-container {
        margin: 0.34em 0 !important;
        font-size: 92% !important;
      }
      .adjoint-bsde-block.is-dense {
        padding-top: 13px;
        padding-bottom: 9px;
        font-size: 0.96rem;
      }
      .adjoint-bsde-block.is-dense mjx-container {
        font-size: 86% !important;
      }
      .bptt-overlay-wrap {
        position: relative;
        width: 100%;
        min-width: 0;
      }
      .bptt-overlay-wrap > canvas:first-child {
        position: relative;
        z-index: 1;
      }
      canvas.bptt-glow-overlay {
        position: absolute;
        inset: 0;
        z-index: 2;
        width: 100% !important;
        height: 100% !important;
        pointer-events: none;
        border: 0 !important;
        border-radius: 16px;
        background: transparent !important;
        box-shadow: none !important;
      }
      @media (max-width: 700px) {
        .adjoint-bsde-block {
          margin-top: 10px;
          padding: 10px 0 6px;
          font-size: 0.92rem;
        }
        .adjoint-bsde-label { font-size: 0.66rem; }
        .adjoint-bsde-block mjx-container { font-size: 90% !important; }
        .adjoint-bsde-block.is-dense { font-size: 0.90rem; }
        .adjoint-bsde-block.is-dense mjx-container { font-size: 82% !important; }
      }
    `;
    document.head.appendChild(style);
  }

  function appendBsde(selector, label, lines, dense = false) {
    const body = document.querySelector(selector);
    if (!body || body.querySelector(".adjoint-bsde-block")) return;
    const block = document.createElement("div");
    block.className = `adjoint-bsde-block${dense ? " is-dense" : ""}`;
    block.innerHTML = `<div class="adjoint-bsde-label">${label}</div>${lines.map((tex) => `<div>$$${tex}$$</div>`).join("")}`;
    body.appendChild(block);
  }

  appendBsde(
    '[data-recovery-equations="smooth"] .eq-card:nth-child(2) .eq-body',
    "Adjoint BSDE",
    [String.raw`\begin{aligned}-d\lambda_t&=\partial_x H_t\,dt-Z_t\,dW_t,\\ \lambda_T&=U'(X_T).\end{aligned}`],
  );
  appendBsde(
    '[data-recovery-equations="transaction"] .eq-card:nth-child(2) .eq-body',
    "Vector adjoint BSDE",
    [String.raw`\begin{aligned}-d\Lambda_t&=\nabla_z H_t\,dt-\mathcal M_t\,dW_t,\\ \Lambda_T&=U'(L_T)\nabla_zL_T,\qquad R_t=\frac{\lambda_{y,t}}{\lambda_{x,t}}.\end{aligned}`],
    true,
  );
  appendBsde(
    '[data-paper-equations="constraints"] .eq-card:nth-child(2) .eq-body',
    "First- and second-order adjoint BSDEs",
    [
      String.raw`\begin{aligned}-d\lambda_t&=\partial_x H_t\,dt-Z_t^{\top}dW_t,\\ \lambda_T&=Ke^{-\rho T}U'(X_T).\end{aligned}`,
      String.raw`\begin{aligned}-dP_t&=\Big[\partial_{xx}H_t+2b_{x,t}P_t+\|\sigma_{x,t}\|^2P_t\\ &\qquad\quad+2\sigma_{x,t}^{\top}R_t\Big]dt-R_t^{\top}dW_t,\\ P_T&=Ke^{-\rho T}U''(X_T).\end{aligned}`,
    ],
    true,
  );
  appendBsde(
    '[data-paper-equations="nonexp"] .eq-card:nth-child(2) .eq-body',
    "Anchored adjoint BSDE",
    [String.raw`\begin{aligned}-d\lambda_t^{t_0}&=\partial_xH\!\left(t_0,t,X_t,u_t,\lambda_t^{t_0},Z_t^{t_0}\right)dt-Z_t^{t_0}dW_t,\\ \lambda_T^{t_0}&=D(t_0,T)\nabla g(X_T).\end{aligned}`],
    true,
  );

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

  function installOverlay(baseCanvas, id) {
    if (!baseCanvas) return null;
    const existing = document.getElementById(id);
    if (existing) return { base: baseCanvas, overlay: existing };
    const wrapper = document.createElement("div");
    wrapper.className = "bptt-overlay-wrap";
    baseCanvas.parentNode.insertBefore(wrapper, baseCanvas);
    wrapper.appendChild(baseCanvas);
    const overlay = document.createElement("canvas");
    overlay.id = id;
    overlay.className = "bptt-glow-overlay";
    overlay.setAttribute("aria-hidden", "true");
    wrapper.appendChild(overlay);
    return { base: baseCanvas, overlay };
  }

  function setupOverlay(target) {
    if (!target?.base || !target?.overlay) return { ctx: null, width: 0, height: 0 };
    const rect = target.base.getBoundingClientRect();
    const width = rect.width, height = rect.height;
    const dpr = window.devicePixelRatio || 1;
    const ctx = target.overlay.getContext("2d");
    if (!ctx || width < 2 || height < 2) return { ctx, width: 0, height: 0 };
    const pw = Math.max(1, Math.round(width * dpr));
    const ph = Math.max(1, Math.round(height * dpr));
    if (target.overlay.width !== pw || target.overlay.height !== ph) {
      target.overlay.width = pw;
      target.overlay.height = ph;
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, width, height);
    return { ctx, width, height };
  }

  function rgba(color, alpha) {
    return color.replace(/,\s*1\)$/, `,${alpha})`);
  }

  function drawBackwardSweep(ctx, path, xScale, yScale, start, phase, color, lineWidth = 3.1) {
    const span = Math.max(1e-6, 1 - start);
    const front = 1 - clamp(phase, 0, 1) * span;
    const tail = Math.min(1, front + 0.28 * span);
    const samples = 42;

    ctx.save();
    ctx.shadowBlur = 17;
    ctx.shadowColor = rgba(color, 0.95);
    ctx.beginPath();
    for (let i = 0; i <= samples; i += 1) {
      const t = tail - (tail - front) * i / samples;
      const x = xScale(t), y = yScale(path(t));
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.strokeStyle = rgba(color, 0.93);
    ctx.lineWidth = lineWidth;
    ctx.stroke();

    const fx = xScale(front), fy = yScale(path(front));
    const pulse = 0.5 + 0.5 * Math.sin(performance.now() * 0.012);
    ctx.beginPath();
    ctx.fillStyle = rgba(COLORS.yellow, 0.78 + 0.18 * pulse);
    ctx.arc(fx, fy, 3.4 + 1.2 * pulse, 0, Math.PI * 2);
    ctx.fill();
    for (let j = 0; j < 3; j += 1) {
      const drift = 7 + j * 6;
      ctx.beginPath();
      ctx.fillStyle = rgba(color, 0.48 - 0.10 * j);
      ctx.arc(fx + drift, fy + Math.sin(performance.now() * 0.006 + j) * 2.2, 2.1 - 0.35 * j, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  const overlayTargets = {
    constraints: installOverlay(document.getElementById("constraintAdjointCanvas"), "constraintBpttGlowCanvas"),
    nonexp: installOverlay(document.getElementById("nonexpAdjointCanvas"), "nonexpBpttGlowCanvas"),
  };

  function bpttIsActive(mode) {
    return state.mode === mode && state.playing && state.warmup >= 0.999 && state.stageIndex < stageCounts.length;
  }

  function drawConstraintBpttGlow() {
    const target = overlayTargets.constraints;
    const { ctx, width, height } = setupOverlay(target);
    if (!ctx || !bpttIsActive("constraints")) return;

    const left = 42, right = 14, top = 20, bottom = 18, gap = 16;
    const panelHeight = (height - top - bottom - gap) / 2;
    const xScale = (t) => left + t * (width - left - right);
    const clock = performance.now() * 0.00072;
    const panels = [
      {
        top,
        height: panelHeight,
        color: COLORS.orange,
        base: (t) => 1.18 - 0.36 * t + 0.04 * Math.sin(5.3 * t),
        min: 0.72,
        max: 1.28,
        offset: 0,
      },
      {
        top: top + panelHeight + gap,
        height: panelHeight,
        color: COLORS.blue,
        base: (t) => 1.72 - 0.58 * t + 0.06 * Math.cos(4.6 * t + 0.4),
        min: 1.02,
        max: 1.90,
        offset: 0.27,
      },
    ];

    panels.forEach((panel, panelIndex) => {
      const yScale = (v) => panel.top + panel.height - (v - panel.min) / (panel.max - panel.min) * panel.height;
      for (let j = 0; j < 3; j += 1) {
        const phase = (clock + panel.offset + j * 0.19) % 1;
        const path = (t) => panel.base(t) + (0.018 + 0.006 * j) * Math.sin(8.5 * t + 0.9 * j + panelIndex) * (1 - 0.35 * t);
        drawBackwardSweep(ctx, path, xScale, yScale, 0, phase, panel.color, j === 0 ? 3.2 : 2.0);
      }
    });

    ctx.fillStyle = rgba(COLORS.yellow, 0.92);
    ctx.font = "bold 10px Inter,system-ui,sans-serif";
    ctx.textAlign = "left";
    ctx.fillText("BPTT backward sweep:  t₀  ←  T", left, 14);
  }

  function nonexpMean(anchor, t) {
    if (t < anchor) return NaN;
    const s = (t - anchor) / Math.max(1e-6, 1 - anchor);
    return 1.30 - 0.42 * s + 0.10 * anchor + 0.035 * Math.sin(4.8 * s + 1.2 * anchor);
  }

  function drawNonexpBpttGlow() {
    const target = overlayTargets.nonexp;
    const { ctx, width, height } = setupOverlay(target);
    if (!ctx || !bpttIsActive("nonexp")) return;

    const pad = { left: 44, right: 18, top: 35, bottom: 30 };
    const xScale = (t) => pad.left + t * (width - pad.left - pad.right);
    const yScale = (v) => height - pad.bottom - (v - 0.78) / 0.64 * (height - pad.top - pad.bottom);
    const anchors = [
      { t: 0.18, color: COLORS.blue, offset: 0 },
      { t: 0.50, color: COLORS.orange, offset: 0.24 },
      { t: 0.82, color: COLORS.purple, offset: 0.48 },
    ];
    const clock = performance.now() * 0.00068;

    anchors.forEach((q, ai) => {
      for (let j = 0; j < 3; j += 1) {
        const phase = (clock + q.offset + j * 0.17) % 1;
        const path = (t) => {
          const s = (t - q.t) / Math.max(1e-6, 1 - q.t);
          return nonexpMean(q.t, t) + (0.014 + 0.005 * j) * Math.sin(9 * s + 0.8 * j + ai) * (1 - 0.4 * s);
        };
        drawBackwardSweep(ctx, path, xScale, yScale, q.t, phase, q.color, j === 0 ? 3.2 : 1.9);
      }
    });

    ctx.fillStyle = rgba(COLORS.yellow, 0.92);
    ctx.font = "bold 10px Inter,system-ui,sans-serif";
    ctx.textAlign = "right";
    ctx.fillText("BPTT backward:  t₀  ←  T", width - pad.right, 31);
    ctx.textAlign = "left";
  }

  function drawBpttOverlays() {
    drawConstraintBpttGlow();
    drawNonexpBpttGlow();
  }

  function drawActive() { if (drawers[state.mode]) drawers[state.mode](); }
  function registerMode(id, draw) { drawers[id] = draw; if (state.mode === id) requestAnimationFrame(draw); }
  function typeset() {
    if (!window.MathJax?.typesetPromise) return;
    window.MathJax.typesetPromise(els.equations.filter((x) => !x.hidden)).catch((e) => console.warn("MathJax typesetting failed", e));
  }

  function restart() { state.warmup = 0; state.stageIndex = 0; state.stageTimer = 0; state.playing = true; }
  function reset() { state.warmup = 0; state.stageIndex = 0; state.stageTimer = 0; state.playing = false; drawActive(); drawBpttOverlays(); }

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
    requestAnimationFrame(() => { drawActive(); drawBpttOverlays(); window.dispatchEvent(new Event("resize")); });
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
    drawActive();
    drawBpttOverlays();
    requestAnimationFrame(animate);
  }

  window.PGDemo = { stageCounts, COLORS, state, clamp, lerp, easeOut, fmt, expFmt, setupCanvas, drawBackground, drawGrid, drawAxes, drawArrow, stageContext, recoveryProgress, visiblePathCount, drawProgressSeries, registerMode };

  els.buttons.forEach((b) => b.addEventListener("click", () => {
    setMode(b.dataset.paperMode, true);
    if (b.dataset.paperMode === "core") {
      requestAnimationFrame(() => els.play?.click());
    }
  }));
  els.play?.addEventListener("click", restart); els.reset?.addEventListener("click", reset);
  window.addEventListener("resize", () => { drawActive(); drawBpttOverlays(); });
  window.addEventListener("pgdpo:ready", () => { drawActive(); drawBpttOverlays(); typeset(); });

  const p = new URLSearchParams(location.search), example = p.get("example"), legacy = p.get("mode");
  const initial = example === "constraints" || legacy === "constraints" ? "constraints" :
    (example === "non-exponential" || example === "nonexp" || legacy === "non-exponential" || legacy === "nonexp") ? "nonexp" : "core";
  setMode(initial, false); requestAnimationFrame(animate); setTimeout(() => { if (state.mode !== "core") restart(); }, 350);
})();
