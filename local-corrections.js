(() => {
  "use strict";

  const stageCounts = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 100, 200, 1000];
  const stageIntervals = stageCounts.map((_, i) => (i < 10 ? 0.5 : 0.14));

  const tc = {
    alpha: 0.10,
    epsilon: 0.18,
    ratioMin: 0.78,
    ratioMax: 1.12,
    ratioStart: 1.085,
    ratioTrue: 0.955,
  };
  tc.lower = 1 - tc.alpha;
  tc.upper = 1;

  const stageRatio = [tc.ratioStart];
  stageCounts.forEach((count, i) => {
    const decay = Math.exp(-1.45 * Math.log10(count));
    const wiggle = i >= stageCounts.length - 2
      ? 0
      : 0.009 * Math.exp(-0.34 * (i + 1)) * Math.sin(0.92 * (i + 1));
    stageRatio.push(tc.ratioTrue + (tc.ratioStart - tc.ratioTrue) * decay + wiggle);
  });
  stageRatio[stageRatio.length - 1] = tc.ratioTrue + 0.0015;

  const els = {
    title: document.getElementById("recoveryTitle"),
    buttons: Array.from(document.querySelectorAll("[data-recovery-mode]")),
    panels: Array.from(document.querySelectorAll("[data-recovery-panel]")),
    equations: Array.from(document.querySelectorAll("[data-recovery-equations]")),
    projectionCanvas: document.getElementById("tcProjectionCanvas"),
    convergenceCanvas: document.getElementById("tcConvergenceCanvas"),
    estimateText: document.getElementById("tcEstimateText"),
    regimeBadge: document.getElementById("tcRegimeBadge"),
    dot: document.getElementById("tcDot"),
    target: document.getElementById("tcTargetMarker"),
    footLeft: document.getElementById("tcFootLeft"),
    footCenter: document.getElementById("tcFootCenter"),
    footRight: document.getElementById("tcFootRight"),
    playButton: document.getElementById("playButton"),
    resetButton: document.getElementById("resetButton"),
  };

  const state = {
    mode: "smooth",
    warmup: 0,
    stageIndex: 0,
    stageTimer: 0,
    playing: false,
    lastTimestamp: 0,
  };

  function clamp(x, lo, hi) { return Math.max(lo, Math.min(hi, x)); }
  function fmt(x, digits = 3) { return Number.isFinite(x) ? x.toFixed(digits) : "—"; }

  function setupCanvas(canvas) {
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    const width = rect.width || canvas.width;
    const height = rect.height || canvas.height;
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    const ctx = canvas.getContext("2d");
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    return { ctx, width, height };
  }

  function drawBackground(ctx, width, height) {
    ctx.clearRect(0, 0, width, height);
    const g = ctx.createLinearGradient(0, 0, 0, height);
    g.addColorStop(0, "rgba(9,17,29,0.72)");
    g.addColorStop(1, "rgba(8,15,24,0.94)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, width, height);
  }

  function drawGrid(ctx, width, height, pad, rows = 5, cols = 6) {
    ctx.save();
    ctx.strokeStyle = "rgba(255,255,255,0.06)";
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
    ctx.save();
    ctx.strokeStyle = "rgba(255,255,255,0.12)";
    ctx.beginPath();
    ctx.moveTo(pad.left, pad.top);
    ctx.lineTo(pad.left, height - pad.bottom);
    ctx.lineTo(width - pad.right, height - pad.bottom);
    ctx.stroke();
    ctx.fillStyle = "rgba(241,246,255,0.70)";
    ctx.font = "12px Inter, system-ui, sans-serif";
    ctx.fillText(yLabel, pad.left, Math.max(12, pad.top - 4));
    ctx.textAlign = "right";
    ctx.fillText(xLabel, width - pad.right, height - 10);
    ctx.restore();
  }

  function projectedTrade(ratio) {
    if (ratio > tc.upper) return (ratio - tc.upper) / tc.epsilon;
    if (ratio < tc.lower) return (ratio - tc.lower) / tc.epsilon;
    return 0;
  }

  function regime(ratio) {
    if (ratio > tc.upper) return "buy";
    if (ratio < tc.lower) return "sell";
    return "hold";
  }

  function stageContext() {
    const completed = state.stageIndex;
    const progress = completed < stageCounts.length
      ? clamp(state.stageTimer / stageIntervals[completed], 0, 1)
      : 1;
    return { completed, progress };
  }

  function currentRatio() {
    const { completed, progress } = stageContext();
    if (completed === 0) return tc.ratioStart;
    if (completed >= stageCounts.length) return tc.ratioTrue;
    return stageRatio[completed] + (stageRatio[completed + 1] - stageRatio[completed]) * progress;
  }

  function drawProjectionBranch(ctx, xScale, yScale, start, end, color) {
    ctx.beginPath();
    for (let i = 0; i <= 100; i += 1) {
      const r = start + (end - start) * i / 100;
      const x = xScale(r);
      const y = yScale(projectedTrade(r));
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.strokeStyle = color;
    ctx.lineWidth = 2.7;
    ctx.stroke();
  }

  function drawProjection() {
    const { ctx, width, height } = setupCanvas(els.projectionCanvas);
    if (width < 2 || height < 2) return;
    drawBackground(ctx, width, height);
    const pad = { left: 46, right: 18, top: 24, bottom: 34 };
    drawGrid(ctx, width, height, pad);
    drawAxes(ctx, width, height, pad, "costate ratio R", "trading rate û");

    const yBound = 0.72;
    const xScale = (r) => pad.left + ((r - tc.ratioMin) / (tc.ratioMax - tc.ratioMin)) * (width - pad.left - pad.right);
    const yScale = (u) => height - pad.bottom - ((u + yBound) / (2 * yBound)) * (height - pad.top - pad.bottom);
    const lowerX = xScale(tc.lower);
    const upperX = xScale(tc.upper);
    const zeroY = yScale(0);

    ctx.fillStyle = "rgba(148,240,193,0.10)";
    ctx.fillRect(lowerX, pad.top, upperX - lowerX, height - pad.top - pad.bottom);
    ctx.strokeStyle = "rgba(255,255,255,0.18)";
    ctx.beginPath(); ctx.moveTo(pad.left, zeroY); ctx.lineTo(width - pad.right, zeroY); ctx.stroke();
    ctx.save();
    ctx.setLineDash([5, 5]);
    ctx.strokeStyle = "rgba(255,255,255,0.28)";
    [lowerX, upperX].forEach((x) => { ctx.beginPath(); ctx.moveTo(x, pad.top); ctx.lineTo(x, height - pad.bottom); ctx.stroke(); });
    ctx.restore();

    drawProjectionBranch(ctx, xScale, yScale, tc.ratioMin, tc.lower, "rgba(255,133,133,0.92)");
    drawProjectionBranch(ctx, xScale, yScale, tc.lower, tc.upper, "rgba(148,240,193,0.96)");
    drawProjectionBranch(ctx, xScale, yScale, tc.upper, tc.ratioMax, "rgba(255,176,122,0.94)");

    ctx.font = "11px Inter, system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillStyle = "rgba(255,170,170,0.90)"; ctx.fillText("SELL", (pad.left + lowerX) / 2, pad.top + 14);
    ctx.fillStyle = "rgba(189,255,220,0.92)"; ctx.fillText("HOLD", (lowerX + upperX) / 2, pad.top + 14);
    ctx.fillStyle = "rgba(255,205,170,0.92)"; ctx.fillText("BUY", (upperX + width - pad.right) / 2, pad.top + 14);
    ctx.fillStyle = "rgba(241,246,255,0.66)";
    ctx.font = "10px Inter, system-ui, sans-serif";
    ctx.fillText(`1 − α = ${fmt(tc.lower)}`, lowerX, height - pad.bottom + 15);
    ctx.fillText("1", upperX, height - pad.bottom + 15);

    const ratio = currentRatio();
    const trade = projectedTrade(ratio);
    const currentRegime = regime(ratio);
    const pointX = xScale(ratio);
    const pointY = yScale(trade);
    const colors = { sell: "rgba(255,133,133,1)", hold: "rgba(148,240,193,1)", buy: "rgba(255,176,122,1)" };
    ctx.save();
    ctx.shadowBlur = 12;
    ctx.shadowColor = colors[currentRegime];
    ctx.beginPath();
    ctx.fillStyle = colors[currentRegime];
    ctx.arc(pointX, pointY, 6.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    ctx.fillStyle = "rgba(241,246,255,0.88)";
    ctx.font = "11px Inter, system-ui, sans-serif";
    ctx.textAlign = ratio > 1.02 ? "right" : "left";
    ctx.fillText(
      currentRegime === "hold" ? "dead-zone: no trade" : `${currentRegime} correction`,
      ratio > 1.02 ? pointX - 9 : pointX + 9,
      currentRegime === "hold" ? pointY - 12 : pointY - 9,
    );
  }

  function drawConvergence() {
    const { ctx, width, height } = setupCanvas(els.convergenceCanvas);
    if (width < 2 || height < 2) return;
    drawBackground(ctx, width, height);
    const pad = { left: 46, right: 18, top: 20, bottom: 28 };
    drawGrid(ctx, width, height, pad, 4, 6);
    drawAxes(ctx, width, height, pad, "number of paths", "R̂");

    const xMax = stageCounts[stageCounts.length - 1];
    const xScale = (count) => pad.left + (Math.log10(Math.max(count, 1)) / Math.log10(xMax)) * (width - pad.left - pad.right);
    const yMin = 0.86;
    const yMax = 1.10;
    const yScale = (r) => height - pad.bottom - ((r - yMin) / (yMax - yMin)) * (height - pad.top - pad.bottom);

    const holdTop = yScale(tc.upper);
    const holdBottom = yScale(tc.lower);
    ctx.fillStyle = "rgba(148,240,193,0.10)";
    ctx.fillRect(pad.left, holdTop, width - pad.left - pad.right, holdBottom - holdTop);
    ctx.save();
    ctx.setLineDash([5, 5]);
    ctx.strokeStyle = "rgba(255,255,255,0.28)";
    [tc.lower, tc.upper].forEach((r) => { ctx.beginPath(); ctx.moveTo(xScale(1), yScale(r)); ctx.lineTo(xScale(xMax), yScale(r)); ctx.stroke(); });
    ctx.strokeStyle = "rgba(255,228,141,0.72)";
    ctx.beginPath(); ctx.moveTo(xScale(1), yScale(tc.ratioTrue)); ctx.lineTo(xScale(xMax), yScale(tc.ratioTrue)); ctx.stroke();
    ctx.restore();

    ctx.font = "10px Inter, system-ui, sans-serif";
    ctx.fillStyle = "rgba(189,255,220,0.84)";
    ctx.fillText("hold wedge", pad.left + 7, yScale(tc.upper) + 12);
    ctx.fillStyle = "rgba(255,228,141,0.88)";
    ctx.textAlign = "right";
    ctx.fillText("true R", width - pad.right - 4, yScale(tc.ratioTrue) - 6);
    ctx.textAlign = "left";

    const { completed, progress } = stageContext();
    if (completed > 0) {
      ctx.beginPath();
      for (let i = 1; i <= completed; i += 1) {
        const x = xScale(stageCounts[i - 1]);
        const y = yScale(stageRatio[i]);
        if (i === 1) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      if (completed < stageCounts.length) {
        const x0 = xScale(stageCounts[completed - 1]);
        const y0 = yScale(stageRatio[completed]);
        const x1 = xScale(stageCounts[completed]);
        const y1 = yScale(stageRatio[completed + 1]);
        ctx.lineTo(x0 + (x1 - x0) * progress, y0 + (y1 - y0) * progress);
      }
      ctx.strokeStyle = "rgba(143,216,255,0.96)";
      ctx.lineWidth = 2.4;
      ctx.stroke();
    }
  }

  function updateTrack() {
    const ratio = currentRatio();
    const trade = projectedTrade(ratio);
    const currentRegime = regime(ratio);
    const position = 100 * clamp((ratio - tc.ratioMin) / (tc.ratioMax - tc.ratioMin), 0, 1);
    els.dot.style.left = `${position}%`;
    els.dot.dataset.regime = currentRegime;
    els.estimateText.textContent = `R̂ = ${fmt(ratio)} · û = ${fmt(trade)}`;
    els.regimeBadge.textContent = currentRegime.toUpperCase();
    els.regimeBadge.dataset.regime = currentRegime;
  }

  function drawTransaction() {
    if (state.mode !== "transaction") return;
    drawProjection();
    drawConvergence();
    updateTrack();
  }

  function typesetVisibleEquations() {
    if (!window.MathJax?.typesetPromise) return;
    const visible = els.equations.filter((node) => !node.hidden);
    window.MathJax.typesetPromise(visible).catch((error) => console.warn("MathJax typesetting failed", error));
  }

  function setMode(modeId, updateUrl = false) {
    const selected = modeId === "transaction" ? "transaction" : "smooth";
    state.mode = selected;
    els.title.textContent = selected === "transaction" ? "No-trade projection" : "Smooth control recovery";
    els.buttons.forEach((button) => {
      const active = button.dataset.recoveryMode === selected;
      button.classList.toggle("is-active", active);
      button.setAttribute("aria-pressed", String(active));
    });
    els.panels.forEach((panel) => { panel.hidden = panel.dataset.recoveryPanel !== selected; });
    els.equations.forEach((row) => { row.hidden = row.dataset.recoveryEquations !== selected; });
    drawTransaction();
    typesetVisibleEquations();

    if (updateUrl) {
      const url = new URL(window.location.href);
      if (selected === "smooth") url.searchParams.delete("mode");
      else url.searchParams.set("mode", "transaction-costs");
      window.history.replaceState({}, "", url);
    }
  }

  function restart() {
    state.warmup = 0;
    state.stageIndex = 0;
    state.stageTimer = 0;
    state.playing = true;
  }

  function reset() {
    state.warmup = 0;
    state.stageIndex = 0;
    state.stageTimer = 0;
    state.playing = false;
    drawTransaction();
  }

  function animate(timestamp) {
    if (!state.lastTimestamp) state.lastTimestamp = timestamp;
    const dt = (timestamp - state.lastTimestamp) / 1000;
    state.lastTimestamp = timestamp;

    if (state.playing) {
      if (state.warmup < 1) {
        state.warmup = clamp(state.warmup + dt / 2, 0, 1);
      } else if (state.stageIndex < stageCounts.length) {
        state.stageTimer += dt;
        const interval = stageIntervals[state.stageIndex];
        if (state.stageTimer >= interval) {
          state.stageTimer = 0;
          state.stageIndex += 1;
        }
      } else {
        state.playing = false;
      }
    }

    drawTransaction();
    window.requestAnimationFrame(animate);
  }

  els.footLeft.textContent = `sell < ${fmt(tc.lower)}`;
  els.footCenter.textContent = `hold [${fmt(tc.lower)}, ${fmt(tc.upper)}]`;
  els.footRight.textContent = `buy > ${fmt(tc.upper)}`;
  els.target.style.left = `${100 * (tc.ratioTrue - tc.ratioMin) / (tc.ratioMax - tc.ratioMin)}%`;

  els.buttons.forEach((button) => {
    button.addEventListener("click", () => setMode(button.dataset.recoveryMode, true));
  });
  els.playButton.addEventListener("click", restart);
  els.resetButton.addEventListener("click", reset);
  window.addEventListener("resize", drawTransaction);

  const queryMode = new URLSearchParams(window.location.search).get("mode");
  setMode(queryMode === "transaction-costs" || queryMode === "costs" ? "transaction" : "smooth");
  window.requestAnimationFrame(animate);
  window.setTimeout(restart, 350);
})();
