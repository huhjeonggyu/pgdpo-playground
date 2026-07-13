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
        margin-top: 8px;
        padding-top: 8px;
        border-top: 1px solid rgba(255,255,255,0.08);
      }
      .adjoint-bsde-label {
        margin-bottom: 3px;
        color: rgba(168,199,255,0.82);
        font-size: 0.60rem;
        font-weight: 800;
        letter-spacing: 0.10em;
        text-transform: uppercase;
      }
      .adjoint-bsde-block mjx-container {
        margin: 0.18em 0 !important;
        font-size: 68% !important;
      }
      .adjoint-bsde-block.is-dense mjx-container {
        font-size: 57% !important;
      }
      @media (max-width: 700px) {
        .adjoint-bsde-block mjx-container { font-size: 62% !important; }
        .adjoint-bsde-block.is-dense mjx-container { font-size: 52% !important; }
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
    [String.raw`-d\lambda_t=\partial_x H_t\,dt-Z_t\,dW_t,\qquad \lambda_T=U'(X_T)`],
  );
  appendBsde(
    '[data-recovery-equations="transaction"] .eq-card:nth-child(2) .eq-body',
    "Vector adjoint BSDE",
    [String.raw`-d\Lambda_t=\nabla_z H_t\,dt-\mathcal M_t\,dW_t,\qquad \Lambda_T=U'(L_T)\nabla_zL_T,\qquad R_t=\lambda_{y,t}/\lambda_{x,t}`],
    true,
  );
  appendBsde(
    '[data-paper-equations="constraints"] .eq-card:nth-child(2) .eq-body',
    "First- and second-order adjoint BSDEs",
    [
      String.raw`-d\lambda_t=\partial_x H_t\,dt-Z_t^{\top}dW_t,\qquad \lambda_T=Ke^{-\rho T}U'(X_T)`,
      String.raw`-dP_t=\bigl[\partial_{xx}H_t+2b_{x,t}P_t+\|\sigma_{x,t}\|^2P_t+2\sigma_{x,t}^{\top}R_t\bigr]dt-R_t^{\top}dW_t,\quad P_T=Ke^{-\rho T}U''(X_T)`,
    ],
    true,
  );
  appendBsde(
    '[data-paper-equations="nonexp"] .eq-card:nth-child(2) .eq-body',
    "Anchored adjoint BSDE",
    [String.raw`-d\lambda_t^{t_0}=\partial_xH\!\left(t_0,t,X_t,u_t,\lambda_t^{t_0},Z_t^{t_0}\right)dt-Z_t^{t_0}dW_t,\qquad \lambda_T^{t_0}=D(t_0,T)\nabla g(X_T)`],
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

  els.buttons.forEach((b) => b.addEventListener("click", () => {
    setMode(b.dataset.paperMode, true);
    if (b.dataset.paperMode === "core") {
      requestAnimationFrame(() => els.play?.click());
    }
  }));
  els.play?.addEventListener("click", restart); els.reset?.addEventListener("click", reset);
  window.addEventListener("resize", drawActive);
  window.addEventListener("pgdpo:ready", () => { drawActive(); typeset(); });

  const p = new URLSearchParams(location.search), example = p.get("example"), legacy = p.get("mode");
  const initial = example === "constraints" || legacy === "constraints" ? "constraints" :
    (example === "non-exponential" || example === "nonexp" || legacy === "non-exponential" || legacy === "nonexp") ? "nonexp" : "core";
  setMode(initial, false); requestAnimationFrame(animate); setTimeout(() => { if (state.mode !== "core") restart(); }, 350);
})();