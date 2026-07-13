(() => {
  "use strict";

  const stageCounts = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 100, 200, 1000];
  const stageIntervals = stageCounts.map((_, i) => (i < 10 ? 0.5 : 0.14));

  const tc = {
    alpha: 0.10,
    epsilon: 0.18,
    ratioMin: 0.80,
    ratioMax: 1.10,
  };
  tc.lower = 1 - tc.alpha;
  tc.upper = 1;

  const querySpecs = [
    {
      id: "sell",
      shortLabel: "S",
      ratioStart: 0.875,
      ratioTrue: 0.850,
      color: "rgba(255,133,133,1)",
      softColor: "rgba(255,133,133,0.32)",
      phase: 0.35,
    },
    {
      id: "hold",
      shortLabel: "H",
      ratioStart: 0.980,
      ratioTrue: 0.955,
      color: "rgba(148,240,193,1)",
      softColor: "rgba(148,240,193,0.32)",
      phase: 1.55,
    },
    {
      id: "buy",
      shortLabel: "B",
      ratioStart: 1.035,
      ratioTrue: 1.060,
      color: "rgba(255,176,122,1)",
      softColor: "rgba(255,176,122,0.32)",
      phase: 2.65,
    },
  ];

  function clamp(x, lo, hi) { return Math.max(lo, Math.min(hi, x)); }
  function fmt(x, digits = 3) { return Number.isFinite(x) ? x.toFixed(digits) : "—"; }

  querySpecs.forEach((query, queryIndex) => {
    query.stageRatios = [query.ratioStart];
    stageCounts.forEach((count, i) => {
      const decay = Math.exp(-1.45 * Math.log10(count));
      const wiggle = i >= stageCounts.length - 2
        ? 0
        : 0.0035 * Math.exp(-0.38 * (i + 1)) * Math.sin(0.90 * (i + 1) + query.phase);
      const value = query.ratioTrue + (query.ratioStart - query.ratioTrue) * decay + wiggle * (queryIndex === 1 ? 0.75 : 1);
      query.stageRatios.push(value);
    });
    query.stageRatios[query.stageRatios.length - 1] = query.ratioTrue;
  });

  const els = {
    title: document.getElementById("recoveryTitle"),
    buttons: Array.from(document.querySelectorAll("[data-recovery-mode]")),
    panels: Array.from(document.querySelectorAll("[data-recovery-panel]")),
    equations: Array.from(document.querySelectorAll("[data-recovery-equations]")),
    projectionCanvas: document.getElementById("tcProjectionCanvas"),
    convergenceCanvas: document.getElementById("tcConvergenceCanvas"),
    playButton: document.getElementById("playButton"),
    resetButton: document.getElementById("resetButton"),
    queries: {
      sell: {
        card: document.getElementById("tcSellCard"),
        estimate: document.getElementById("tcSellEstimateText"),
        badge: document.getElementById("tcSellRegimeBadge"),
      },
      hold: {
        card: document.getElementById("tcHoldCard"),
        estimate: document.getElementById("tcHoldEstimateText"),
        badge: document.getElementById("tcHoldRegimeBadge"),
      },
      buy: {
        card: document.getElementById("tcBuyCard"),
        estimate: document.getElementById("tcBuyEstimateText"),
        badge: document.getElementById("tcBuyRegimeBadge"),
      },
    },
  };

  const state = {
    mode: "smooth",
    warmup: 0,
    stageIndex: 0,
    stageTimer: 0,
    playing: false,
    lastTimestamp: 0,
  };

  function setupCanvas(canvas) {
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    const width = rect.width;
    const height = rect.height;
    const ctx = canvas.getContext("2d");
    if (width < 2 || height < 2) return { ctx, width: 0, height: 0 };
    const pixelWidth = Math.max(1, Math.round(width * dpr));
    const pixelHeight = Math.max(1, Math.round(height * dpr));
    if (canvas.width !== pixelWidth || canvas.height !== pixelHeight) {
      canvas.width = pixelWidth;
      canvas.height = pixelHeight;
    }
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
      ctx.beginPath();
      ctx.moveTo(pad.left, y);
      ctx.lineTo(width - pad.right, y);
      ctx.stroke();
    }
    for (let j = 0; j <= cols; j += 1) {
      const x = pad.left + (j / cols) * (width - pad.left - pad.right);
      ctx.beginPath();
      ctx.moveTo(x, pad.top);
      ctx.lineTo(x, height - pad.bottom);
      ctx.stroke();
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

  function currentRatio(query) {
    const { completed, progress } = stageContext();
    if (completed === 0) {
      const first = query.stageRatios[1];
      return query.ratioStart + (first - query.ratioStart) * progress;
    }
    if (completed >= stageCounts.length) return query.ratioTrue;
    return query.stageRatios[completed] + (query.stageRatios[completed + 1] - query.stageRatios[completed]) * progress;
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

    const yBound = 0.62;
    const xScale = (r) => pad.left + ((r - tc.ratioMin) / (tc.ratioMax - tc.ratioMin)) * (width - pad.left - pad.right);
    const yScale = (u) => height - pad.bottom - ((u + yBound) / (2 * yBound)) * (height - pad.top - pad.bottom);
    const lowerX = xScale(tc.lower);
    const upperX = xScale(tc.upper);
    const zeroY = yScale(0);

    ctx.fillStyle = "rgba(148,240,193,0.10)";
    ctx.fillRect(lowerX, pad.top, upperX - lowerX, height - pad.top - pad.bottom);
    ctx.strokeStyle = "rgba(255,255,255,0.18)";
    ctx.beginPath();
    ctx.moveTo(pad.left, zeroY);
    ctx.lineTo(width - pad.right, zeroY);
    ctx.stroke();

    ctx.save();
    ctx.setLineDash([5, 5]);
    ctx.strokeStyle = "rgba(255,255,255,0.28)";
    [lowerX, upperX].forEach((x) => {
      ctx.beginPath();
      ctx.moveTo(x, pad.top);
      ctx.lineTo(x, height - pad.bottom);
      ctx.stroke();
    });
    ctx.restore();

    drawProjectionBranch(ctx, xScale, yScale, tc.ratioMin, tc.lower, "rgba(255,133,133,0.92)");
    drawProjectionBranch(ctx, xScale, yScale, tc.lower, tc.upper, "rgba(148,240,193,0.96)");
    drawProjectionBranch(ctx, xScale, yScale, tc.upper, tc.ratioMax, "rgba(255,176,122,0.94)");

    ctx.font = "11px Inter, system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillStyle = "rgba(255,170,170,0.90)";
    ctx.fillText("SELL", (pad.left + lowerX) / 2, pad.top + 14);
    ctx.fillStyle = "rgba(189,255,220,0.92)";
    ctx.fillText("HOLD", (lowerX + upperX) / 2, pad.top + 14);
    ctx.fillStyle = "rgba(255,205,170,0.92)";
    ctx.fillText("BUY", (upperX + width - pad.right) / 2, pad.top + 14);
    ctx.fillStyle = "rgba(241,246,255,0.66)";
    ctx.font = "10px Inter, system-ui, sans-serif";
    ctx.fillText(`1 − α = ${fmt(tc.lower)}`, lowerX, height - pad.bottom + 15);
    ctx.fillText("1", upperX, height - pad.bottom + 15);

    querySpecs.forEach((query) => {
      const ratio = currentRatio(query);
      const trade = projectedTrade(ratio);
      const pointX = xScale(ratio);
      const pointY = yScale(trade);
      const targetX = xScale(query.ratioTrue);
      const targetY = yScale(projectedTrade(query.ratioTrue));

      ctx.save();
      ctx.setLineDash([3, 4]);
      ctx.strokeStyle = query.softColor;
      ctx.beginPath();
      ctx.moveTo(pointX, pointY);
      ctx.lineTo(targetX, targetY);
      ctx.stroke();
      ctx.setLineDash([]);

      ctx.beginPath();
      ctx.strokeStyle = query.softColor;
      ctx.lineWidth = 2;
      ctx.arc(targetX, targetY, 8.2, 0, Math.PI * 2);
      ctx.stroke();

      ctx.shadowBlur = 12;
      ctx.shadowColor = query.color;
      ctx.beginPath();
      ctx.fillStyle = query.color;
      ctx.arc(pointX, pointY, 6.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      ctx.fillStyle = "rgba(241,246,255,0.94)";
      ctx.font = "bold 11px Inter, system-ui, sans-serif";
      if (query.id === "buy") {
        ctx.textAlign = "right";
        ctx.fillText(query.shortLabel, pointX - 10, pointY - 9);
      } else {
        ctx.textAlign = "left";
        ctx.fillText(query.shortLabel, pointX + 10, pointY - 9);
      }
    });
  }

  function drawConvergencePath(ctx, query, xScale, yScale, completed, progress) {
    if (completed === 0) {
      const x = xScale(stageCounts[0]);
      const y = yScale(currentRatio(query));
      ctx.beginPath();
      ctx.fillStyle = query.color;
      ctx.arc(x, y, 3.4, 0, Math.PI * 2);
      ctx.fill();
      return;
    }

    ctx.beginPath();
    for (let i = 1; i <= completed; i += 1) {
      const x = xScale(stageCounts[i - 1]);
      const y = yScale(query.stageRatios[i]);
      if (i === 1) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    if (completed < stageCounts.length) {
      const x0 = xScale(stageCounts[completed - 1]);
      const y0 = yScale(query.stageRatios[completed]);
      const x1 = xScale(stageCounts[completed]);
      const y1 = yScale(query.stageRatios[completed + 1]);
      ctx.lineTo(x0 + (x1 - x0) * progress, y0 + (y1 - y0) * progress);
    }
    ctx.strokeStyle = query.color;
    ctx.lineWidth = 2.25;
    ctx.stroke();
  }

  function drawConvergence() {
    const { ctx, width, height } = setupCanvas(els.convergenceCanvas);
    if (width < 2 || height < 2) return;
    drawBackground(ctx, width, height);
    const pad = { left: 46, right: 25, top: 20, bottom: 28 };
    drawGrid(ctx, width, height, pad, 4, 6);
    drawAxes(ctx, width, height, pad, "number of paths", "R̂");

    const xMax = stageCounts[stageCounts.length - 1];
    const xScale = (count) => pad.left + (Math.log10(Math.max(count, 1)) / Math.log10(xMax)) * (width - pad.left - pad.right);
    const yMin = 0.82;
    const yMax = 1.08;
    const yScale = (r) => height - pad.bottom - ((r - yMin) / (yMax - yMin)) * (height - pad.top - pad.bottom);

    const holdTop = yScale(tc.upper);
    const holdBottom = yScale(tc.lower);
    ctx.fillStyle = "rgba(148,240,193,0.10)";
    ctx.fillRect(pad.left, holdTop, width - pad.left - pad.right, holdBottom - holdTop);

    ctx.save();
    ctx.setLineDash([5, 5]);
    ctx.strokeStyle = "rgba(255,255,255,0.25)";
    [tc.lower, tc.upper].forEach((r) => {
      ctx.beginPath();
      ctx.moveTo(xScale(1), yScale(r));
      ctx.lineTo(xScale(xMax), yScale(r));
      ctx.stroke();
    });
    querySpecs.forEach((query) => {
      ctx.strokeStyle = query.softColor;
      ctx.beginPath();
      ctx.moveTo(xScale(1), yScale(query.ratioTrue));
      ctx.lineTo(xScale(xMax), yScale(query.ratioTrue));
      ctx.stroke();
    });
    ctx.restore();

    ctx.fillStyle = "rgba(189,255,220,0.84)";
    ctx.font = "10px Inter, system-ui, sans-serif";
    ctx.fillText("hold wedge", pad.left + 7, yScale(tc.upper) + 12);

    const { completed, progress } = stageContext();
    querySpecs.forEach((query) => drawConvergencePath(ctx, query, xScale, yScale, completed, progress));

    ctx.font = "bold 10px Inter, system-ui, sans-serif";
    ctx.textAlign = "right";
    querySpecs.forEach((query) => {
      ctx.fillStyle = query.color;
      ctx.fillText(query.shortLabel, width - pad.right - 3, yScale(query.ratioTrue) - 4);
    });
    ctx.textAlign = "left";
  }

  function updateQueryCards() {
    querySpecs.forEach((query) => {
      const ratio = currentRatio(query);
      const trade = projectedTrade(ratio);
      const currentRegime = regime(ratio);
      const queryEls = els.queries[query.id];
      queryEls.card.dataset.regime = currentRegime;
      queryEls.estimate.textContent = `R̂ = ${fmt(ratio)} · û = ${fmt(trade)}`;
      queryEls.badge.textContent = currentRegime.toUpperCase();
      queryEls.badge.dataset.regime = currentRegime;
    });
  }

  function drawTransaction() {
    if (state.mode !== "transaction") return;
    drawProjection();
    drawConvergence();
    updateQueryCards();
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
    window.requestAnimationFrame(() => window.dispatchEvent(new Event("resize")));

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
    const dt = Math.min((timestamp - state.lastTimestamp) / 1000, 0.10);
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
