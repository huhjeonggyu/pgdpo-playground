(() => {
  "use strict";
  const D = window.PGDemo; if (!D) return;
  const { stageCounts, COLORS, state, clamp, lerp, easeOut, fmt, expFmt, setupCanvas, drawBackground, drawGrid, drawAxes, drawArrow, stageContext, recoveryProgress, drawProgressSeries } = D;
  if (!document.getElementById("compact-equation-card-styles")) {
    const style = document.createElement("style");
    style.id = "compact-equation-card-styles";
    style.textContent = `
      .paper-equation-stack > [data-paper-equations][hidden],
      .equation-stack > [data-recovery-equations][hidden] {
        display: none !important;
      }
      .paper-equation-stack,
      .paper-equation-stack > [data-paper-equations],
      .paper-equation-stack .equation-stack {
        align-items: start;
      }
      .paper-equation-stack .equation-row {
        align-items: start;
      }
      .paper-equation-stack .eq-card {
        align-self: start;
        height: auto;
      }
      .paper-equation-stack .eq-body {
        min-height: 0 !important;
        align-items: stretch;
        justify-content: flex-start;
        padding-bottom: 4px !important;
      }
      .paper-equation-stack .adjoint-bsde-block {
        padding-bottom: 2px !important;
      }
      .paper-equation-stack .adjoint-bsde-block.is-dense {
        padding-bottom: 3px !important;
      }
      #constraintBpttGlowCanvas,
      #nonexpBpttGlowCanvas {
        display: none !important;
      }
      @media (max-height: 900px) {
        .paper-equation-stack .eq-body { min-height: 0 !important; }
      }
    `;
    document.head.appendChild(style);
  }

  const els = {
    rollout: document.getElementById("constraintRolloutCanvas"), feasible: document.getElementById("constraintFeasibleCanvas"),
    adjoint: document.getElementById("constraintAdjointCanvas"), conv: document.getElementById("constraintAdjointConvCanvas"),
    recovery: document.getElementById("constraintRecoveryCanvas"), residual: document.getElementById("constraintResidualCanvas"),
    text: { active: document.getElementById("constraintActiveText"), near: document.getElementById("constraintNearText"), interior: document.getElementById("constraintInteriorText") }
  };

  const nearLabel = document.querySelector('[data-paper-panel="constraints"] .insight-card[data-tone="near"] .insight-card-head > span:first-child');
  if (nearLabel) nearLabel.innerHTML = '<span class="insight-swatch tone-near"></span>Near boundary';
  const activeLabel = document.querySelector('[data-paper-panel="constraints"] .insight-card[data-tone="active"] .insight-card-head > span:first-child');
  if (activeLabel) activeLabel.innerHTML = '<span class="insight-swatch tone-active"></span>Active boundary';
  const constraintRecoveryPanel = els.recovery?.closest('[data-paper-panel="constraints"]');
  const constraintCaption = constraintRecoveryPanel?.querySelector('.caption');
  if (constraintCaption) constraintCaption.textContent = "The active query wants to move beyond the feasible set, so KKT recovery stops at u₁=0; the same adjoints also handle near-boundary and interior queries.";
  const constraintAdjointPanel = els.adjoint?.closest('[data-paper-panel="constraints"]');
  const constraintAdjointCaption = constraintAdjointPanel?.querySelector('.caption');
  if (constraintAdjointCaption) constraintAdjointCaption.textContent = "Each backward sweep deposits one pathwise first- and second-order adjoint sample. The thin paths remain while the thick Monte Carlo means emerge.";

  const queries = [
    { id: "active", label: "A", color: COLORS.red, soft: COLORS.redSoft, start: [0.22, 0.42], target: [0, 0.58], unconstrained: [-0.16, 0.66], r0: 5.2e-2, r1: 1.1e-4 },
    { id: "near", label: "N", color: COLORS.yellow, soft: COLORS.yellowSoft, start: [0.20, 0.35], target: [0.035, 0.47], unconstrained: [-0.018, 0.50], r0: 3.6e-2, r1: 2e-4 },
    { id: "interior", label: "I", color: COLORS.green, soft: COLORS.greenSoft, start: [0.16, 0.14], target: [0.28, 0.24], unconstrained: null, r0: 2.8e-2, r1: 9e-5 }
  ];

  function pathValue(p, k, n) {
    const t = k / n, phase = 0.42 * p;
    return 1 + (0.06 + 0.012 * ((p % 5) - 2)) * t + (0.055 * Math.sin(5.2 * t + phase) + 0.025 * Math.sin(13 * t + 0.7 * phase)) * Math.sqrt(t + 0.02);
  }

  function drawRollout() {
    const { ctx, width, height } = setupCanvas(els.rollout); if (!ctx || width < 2) return;
    drawBackground(ctx, width, height); const pad = { left: 40, right: 14, top: 18, bottom: 24 };
    drawGrid(ctx, width, height, pad); drawAxes(ctx, width, height, pad, "time", "wealth X");
    const n = 60, reveal = Math.max(1, Math.floor(state.warmup * n)), values = [];
    for (let p = 0; p < 14; p++) for (let k = 0; k <= n; k++) values.push(pathValue(p, k, n));
    const ymin = Math.min(...values) - 0.025, ymax = Math.max(...values) + 0.025;
    const xs = (k) => pad.left + k / n * (width - pad.left - pad.right), ys = (v) => height - pad.bottom - (v - ymin) / (ymax - ymin) * (height - pad.top - pad.bottom);
    for (let p = 0; p < 14; p++) {
      ctx.beginPath(); for (let k = 0; k <= reveal; k++) { const x = xs(k), y = ys(pathValue(p, k, n)); if (!k) ctx.moveTo(x, y); else ctx.lineTo(x, y); }
      ctx.strokeStyle = p < 3 ? "rgba(143,216,255,.78)" : "rgba(148,240,193,.25)"; ctx.lineWidth = p < 3 ? 1.9 : 1.05; ctx.stroke();
    }
    const cx = xs(reveal); ctx.save(); ctx.setLineDash([5, 5]); ctx.strokeStyle = "rgba(255,255,255,.22)"; ctx.beginPath(); ctx.moveTo(cx, pad.top); ctx.lineTo(cx, height - pad.bottom); ctx.stroke(); ctx.restore();
    ctx.fillStyle = COLORS.text; ctx.font = "11px Inter,system-ui,sans-serif"; ctx.fillText("Activation-constrained controls remain feasible along every rollout.", pad.left + 8, pad.top + 15);
    ctx.fillStyle = COLORS.yellow; ctx.fillText("feasible ≠ KKT-stationary", pad.left + 8, pad.top + 31);
  }

  function drawFeasible() {
    const { ctx, width, height } = setupCanvas(els.feasible); if (!ctx || width < 2) return;
    drawBackground(ctx, width, height); const p = easeOut(state.warmup), leftW = width * 0.43;
    ctx.fillStyle = COLORS.text; ctx.font = "11px Inter,system-ui,sans-serif"; ctx.fillText("activation-based policy", 12, 16);
    const xs = [leftW * .18, leftW * .48, leftW * .78], layers = [3, 4, 3], ys = layers.map(n => Array.from({ length: n }, (_, i) => height * .24 + i * height * .52 / Math.max(1, n - 1)));
    for (let l = 0; l < 2; l++) ys[l].forEach(y0 => ys[l + 1].forEach(y1 => { ctx.beginPath(); ctx.moveTo(xs[l], y0); ctx.lineTo(xs[l + 1], y1); ctx.strokeStyle = `rgba(143,216,255,${.10 + .18 * p})`; ctx.stroke(); }));
    ys.forEach((layer, l) => layer.forEach(y => { ctx.beginPath(); ctx.fillStyle = l === 1 ? "rgba(255,176,122,.75)" : "rgba(143,216,255,.82)"; ctx.arc(xs[l], y, 5.6, 0, Math.PI * 2); ctx.fill(); }));
    const sx = width * .58, sy = height * .82, size = Math.min(width * .31, height * .68);
    ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(sx + size, sy); ctx.lineTo(sx, sy - size); ctx.closePath(); ctx.fillStyle = "rgba(148,240,193,.08)"; ctx.fill(); ctx.strokeStyle = "rgba(148,240,193,.62)"; ctx.lineWidth = 1.6; ctx.stroke();
    drawArrow(ctx, leftW * .87, height * .5, sx - 12, height * .5, COLORS.yellowSoft, 2);
    ctx.fillStyle = COLORS.yellow; ctx.font = "bold 10px Inter,system-ui,sans-serif"; ctx.textAlign = "center"; ctx.fillText("softmax / sigmoid", (leftW * .87 + sx - 12) / 2, height * .5 - 8);
    const u1 = lerp(.18, .34, p), u2 = lerp(.20, .28, p) + .015 * Math.sin(5 * p), px = sx + u1 * size, py = sy - u2 * size;
    ctx.save(); ctx.shadowBlur = 12; ctx.shadowColor = COLORS.green; ctx.beginPath(); ctx.fillStyle = COLORS.green; ctx.arc(px, py, 6.5, 0, Math.PI * 2); ctx.fill(); ctx.restore();
    ctx.fillStyle = COLORS.muted; ctx.font = "10px Inter,system-ui,sans-serif"; ctx.textAlign = "left"; ctx.fillText("π₁", sx + size - 10, sy + 14); ctx.fillText("π₂", sx - 18, sy - size + 4); ctx.fillText("cash = 1 − π₁ − π₂", sx + 8, sy - 8);
    ctx.fillStyle = COLORS.green; ctx.font = "bold 10px Inter,system-ui,sans-serif"; ctx.fillText("strictly feasible", sx + size * .36, sy - size * .66);
  }

  const maxAdjointSamples = 8;

  function sampleProgress(maxSamples) {
    const { completed, progress } = stageContext();
    const u = clamp((completed + progress) / stageCounts.length, 0, 1);
    const total = u * maxSamples;
    const deposited = Math.min(maxSamples, Math.floor(total + 1e-9));
    const active = deposited < maxSamples ? total - deposited : 0;
    const meanAlpha = clamp((total - 1.2) / 2.8, 0, 1);
    return { total, deposited, active, meanAlpha };
  }

  function adjointBase(kind, t) {
    return kind === "lambda" ? 1.18 - .36 * t + .04 * Math.sin(5.3 * t) : 1.72 - .58 * t + .06 * Math.cos(4.6 * t + .4);
  }

  function adjointSample(kind, sample, t) {
    const amplitude = kind === "lambda" ? .014 + .0022 * (sample % 4) : .018 + .0026 * (sample % 4);
    const phase = .79 * sample + (kind === "lambda" ? .15 : 1.05);
    const slowShift = (sample - (maxAdjointSamples - 1) / 2) * (kind === "lambda" ? .0018 : .0023) * (1 - .45 * t);
    return adjointBase(kind, t) + amplitude * Math.sin(8.5 * t + phase) * (1 - .38 * t) + slowShift;
  }

  function strokeAdjointPath(ctx, xs, ys, kind, sample, startT, endT, color, alpha, lineWidth, glow = false) {
    const n = 80, from = Math.round(startT * n), to = Math.round(endT * n), step = from <= to ? 1 : -1;
    ctx.save();
    if (glow) {
      ctx.shadowBlur = 17;
      ctx.shadowColor = color.replace(",1)", ",.95)");
    }
    ctx.beginPath();
    let first = true;
    for (let k = from; step > 0 ? k <= to : k >= to; k += step) {
      const t = k / n, x = xs(t), y = ys(adjointSample(kind, sample, t));
      if (first) { ctx.moveTo(x, y); first = false; } else ctx.lineTo(x, y);
    }
    ctx.strokeStyle = color.replace(",1)", `,${alpha})`); ctx.lineWidth = lineWidth; ctx.stroke();
    ctx.restore();

    if (glow) {
      const fx = xs(endT), fy = ys(adjointSample(kind, sample, endT));
      const pulse = .5 + .5 * Math.sin(performance.now() * .012);
      ctx.save();
      ctx.shadowBlur = 14; ctx.shadowColor = COLORS.yellow;
      ctx.beginPath(); ctx.fillStyle = COLORS.yellow.replace(",1)", `,${.78 + .18 * pulse})`); ctx.arc(fx, fy, 3.5 + 1.1 * pulse, 0, Math.PI * 2); ctx.fill();
      ctx.shadowBlur = 0;
      for (let j = 0; j < 3; j++) {
        ctx.beginPath(); ctx.fillStyle = color.replace(",1)", `,${.48 - .10 * j})`); ctx.arc(fx + 8 + 6 * j, fy + Math.sin(performance.now() * .006 + j) * 2.1, 2.1 - .35 * j, 0, Math.PI * 2); ctx.fill();
      }
      ctx.restore();
    }
  }

  function drawAdjointHalf(ctx, area, kind, progressInfo) {
    const { left, top, width, height } = area, xs = t => left + t * width;
    const ymin = kind === "lambda" ? .72 : 1.02, ymax = kind === "lambda" ? 1.28 : 1.90, ys = v => top + height - (v - ymin) / (ymax - ymin) * height;
    const color = kind === "lambda" ? COLORS.orange : COLORS.blue;

    ctx.save();
    ctx.strokeStyle = "rgba(255,255,255,.06)";
    for (let i = 0; i <= 3; i++) { const y = top + i / 3 * height; ctx.beginPath(); ctx.moveTo(left, y); ctx.lineTo(left + width, y); ctx.stroke(); }

    for (let sample = 0; sample < progressInfo.deposited; sample++) {
      strokeAdjointPath(ctx, xs, ys, kind, sample, 0, 1, color, .31, sample < 2 ? 1.35 : 1.05);
    }
    if (progressInfo.active > .005 && progressInfo.deposited < maxAdjointSamples) {
      const front = 1 - progressInfo.active;
      strokeAdjointPath(ctx, xs, ys, kind, progressInfo.deposited, 1, front, color, .96, 2.45, true);
    }

    if (progressInfo.meanAlpha > .005) {
      ctx.beginPath();
      for (let k = 0; k <= 80; k++) { const t = k / 80; if (!k) ctx.moveTo(xs(t), ys(adjointBase(kind, t))); else ctx.lineTo(xs(t), ys(adjointBase(kind, t))); }
      ctx.strokeStyle = color.replace(",1)", `,${.22 + .78 * progressInfo.meanAlpha})`); ctx.lineWidth = 1.7 + .7 * progressInfo.meanAlpha; ctx.stroke();
    }

    ctx.fillStyle = COLORS.text; ctx.font = "bold 10px Inter,system-ui,sans-serif"; ctx.fillText(kind === "lambda" ? "first-order λ" : "curvature −P", left + 6, top + 12);
    ctx.restore();
  }

  function drawAdjoint() {
    const { ctx, width, height } = setupCanvas(els.adjoint); if (!ctx || width < 2) return; drawBackground(ctx, width, height);
    const progressInfo = sampleProgress(maxAdjointSamples), left = 42, right = 14, top = 20, bottom = 18, gap = 16, h = (height - top - bottom - gap) / 2;
    drawAdjointHalf(ctx, { left, top, width: width - left - right, height: h }, "lambda", progressInfo);
    drawAdjointHalf(ctx, { left, top: top + h + gap, width: width - left - right, height: h }, "curvature", progressInfo);
    const shown = Math.min(maxAdjointSamples, progressInfo.deposited + (progressInfo.active > .03 ? 1 : 0));
    ctx.fillStyle = COLORS.yellow; ctx.font = "bold 10px Inter,system-ui,sans-serif"; ctx.textAlign = "left"; ctx.fillText("BPTT backward:  t₀  ←  T", left, 14);
    ctx.fillStyle = COLORS.muted; ctx.font = "10px Inter,system-ui,sans-serif"; ctx.textAlign = "right"; ctx.fillText(`pathwise samples deposited: ${shown}/${maxAdjointSamples}`, width - right, 14); ctx.fillText("time", width - right, height - 5); ctx.textAlign = "left";
    ctx.fillStyle = "rgba(255,228,141,.82)"; ctx.font = "9px Inter,system-ui,sans-serif"; ctx.fillText("thin paths remain · thick line = Monte Carlo mean", left, height - 5);
  }

  const lambdaVals = stageCounts.map((n, i) => 1 + .17 * Math.exp(-1.25 * Math.log10(n)) + .01 * Math.sin(.8 * i) * Math.exp(-.2 * i));
  const pVals = stageCounts.map((n, i) => 1 - .14 * Math.exp(-1.12 * Math.log10(n)) - .008 * Math.cos(.9 * i) * Math.exp(-.2 * i));
  lambdaVals[lambdaVals.length - 1] = pVals[pVals.length - 1] = 1;

  function drawConvergence() {
    const { ctx, width, height } = setupCanvas(els.conv); if (!ctx || width < 2) return; drawBackground(ctx, width, height);
    const pad = { left: 40, right: 22, top: 18, bottom: 22 }; drawGrid(ctx, width, height, pad, 3, 6);
    const xmax = stageCounts.at(-1), xs = n => pad.left + Math.log10(Math.max(1, n)) / Math.log10(xmax) * (width - pad.left - pad.right), ys = v => height - pad.bottom - (v - .82) / .38 * (height - pad.top - pad.bottom);
    ctx.save(); ctx.setLineDash([5, 5]); ctx.strokeStyle = "rgba(255,255,255,.26)"; ctx.beginPath(); ctx.moveTo(xs(1), ys(1)); ctx.lineTo(xs(xmax), ys(1)); ctx.stroke(); ctx.restore();
    drawProgressSeries(ctx, lambdaVals, xs, ys, COLORS.orange); drawProgressSeries(ctx, pVals, xs, ys, COLORS.blue);
    ctx.fillStyle = COLORS.orange; ctx.font = "bold 10px Inter,system-ui,sans-serif"; ctx.fillText("λ̂ / λ", pad.left + 4, 13); ctx.fillStyle = COLORS.blue; ctx.fillText("−P̂ / (−P)", pad.left + 58, 13);
    ctx.fillStyle = COLORS.muted; ctx.textAlign = "right"; ctx.fillText("number of paths", width - pad.right, height - 5); ctx.textAlign = "left";
  }

  const currentPoint = q => { const p = recoveryProgress(); return [lerp(q.start[0], q.target[0], p), lerp(q.start[1], q.target[1], p)]; };

  function drawRecovery() {
    const { ctx, width, height } = setupCanvas(els.recovery); if (!ctx || width < 2) return; drawBackground(ctx, width, height);
    const pad = { left: 48, right: 20, top: 28, bottom: 34 }; drawGrid(ctx, width, height, pad); drawAxes(ctx, width, height, pad, "risky weight u₁", "risky weight u₂");
    const xMin = -0.22, xMax = 1.0;
    const xs = u => pad.left + (u - xMin) / (xMax - xMin) * (width - pad.left - pad.right), ys = u => height - pad.bottom - u * (height - pad.top - pad.bottom);
    const boundaryX = xs(0);

    ctx.fillStyle = "rgba(255,133,133,.045)"; ctx.fillRect(pad.left, pad.top, Math.max(0, boundaryX - pad.left), height - pad.top - pad.bottom);
    ctx.beginPath(); ctx.moveTo(xs(0), ys(0)); ctx.lineTo(xs(1), ys(0)); ctx.lineTo(xs(0), ys(1)); ctx.closePath(); ctx.fillStyle = "rgba(148,240,193,.075)"; ctx.fill(); ctx.strokeStyle = "rgba(148,240,193,.66)"; ctx.lineWidth = 1.8; ctx.stroke();
    ctx.save(); ctx.setLineDash([5, 5]); ctx.strokeStyle = "rgba(255,133,133,.62)"; ctx.beginPath(); ctx.moveTo(boundaryX, pad.top); ctx.lineTo(boundaryX, height - pad.bottom); ctx.stroke(); ctx.restore();

    ctx.fillStyle = COLORS.red; ctx.font = "bold 10px Inter,system-ui,sans-serif"; ctx.fillText("u₁ < 0: infeasible", pad.left + 7, pad.top + 16);
    ctx.fillStyle = COLORS.text; ctx.fillText("binding boundary u₁ = 0", boundaryX + 8, pad.top + 17);
    ctx.fillStyle = COLORS.green; ctx.font = "bold 11px Inter,system-ui,sans-serif"; ctx.fillText("feasible simplex K", xs(.50), ys(.39));
    ctx.fillStyle = COLORS.muted; ctx.font = "10px Inter,system-ui,sans-serif"; ctx.fillText("cash = 1 − u₁ − u₂", xs(.48), ys(.31));

    queries.forEach(q => {
      const c = currentPoint(q), x0 = xs(q.start[0]), y0 = ys(q.start[1]), x = xs(c[0]), y = ys(c[1]), xt = xs(q.target[0]), yt = ys(q.target[1]);
      drawArrow(ctx, x0, y0, x, y, q.soft, 1.9);

      if (q.unconstrained) {
        const xu = xs(q.unconstrained[0]), yu = ys(q.unconstrained[1]);
        ctx.save(); ctx.setLineDash([5, 5]); drawArrow(ctx, xt, yt, xu, yu, q.soft, 1.5); ctx.restore();
        ctx.save(); ctx.setLineDash([3, 4]); ctx.strokeStyle = q.color; ctx.lineWidth = 1.4; ctx.beginPath(); ctx.arc(xu, yu, q.id === "active" ? 8.5 : 6.8, 0, Math.PI * 2); ctx.stroke(); ctx.restore();
        if (q.id === "active") {
          ctx.fillStyle = q.color; ctx.font = "bold 10px Inter,system-ui,sans-serif"; ctx.fillText("unconstrained optimum", xu + 10, yu - 9);
          ctx.fillText("KKT stop", xt + 8, yt + 18);
        }
      }

      ctx.save(); ctx.setLineDash([3, 4]); ctx.strokeStyle = q.soft; ctx.beginPath(); ctx.arc(xt, yt, 8.2, 0, Math.PI * 2); ctx.stroke(); ctx.restore();
      ctx.save(); ctx.shadowBlur = 12; ctx.shadowColor = q.color; ctx.beginPath(); ctx.fillStyle = q.color; ctx.arc(x, y, 6.2, 0, Math.PI * 2); ctx.fill(); ctx.restore();
      ctx.fillStyle = COLORS.text; ctx.font = "bold 11px Inter,system-ui,sans-serif"; ctx.fillText(q.label, x + 9, y - 7);
    });
  }

  const dpoR = stageCounts.map(n => .030 + .032 * Math.exp(-.72 * Math.log10(n)));
  const qpR = stageCounts.map(n => 2e-5 + .030 * Math.pow(n, -.94));

  function drawResidual() {
    const { ctx, width, height } = setupCanvas(els.residual); if (!ctx || width < 2) return; drawBackground(ctx, width, height);
    const pad = { left: 48, right: 26, top: 42, bottom: 30 }; drawGrid(ctx, width, height, pad, 4, 6); drawAxes(ctx, width, height, pad, "number of paths", "");
    const xmax = stageCounts.at(-1), xs = n => pad.left + Math.log10(Math.max(1, n)) / Math.log10(xmax) * (width - pad.left - pad.right), ys = v => height - pad.bottom - (Math.log10(Math.max(1e-5, v)) + 5) / 4 * (height - pad.top - pad.bottom);

    ctx.fillStyle = COLORS.text; ctx.font = "bold 10px Inter,system-ui,sans-serif"; ctx.fillText("projected KKT residual", pad.left, 16);
    const legendX = Math.max(pad.left + 150, width - pad.right - 205), legendY = 14;
    ctx.save(); ctx.setLineDash([6, 5]); ctx.strokeStyle = "rgba(241,246,255,.58)"; ctx.beginPath(); ctx.moveTo(legendX, legendY - 3); ctx.lineTo(legendX + 22, legendY - 3); ctx.stroke(); ctx.restore();
    ctx.fillStyle = "rgba(241,246,255,.68)"; ctx.fillText("feasible DPO", legendX + 28, legendY);
    ctx.strokeStyle = COLORS.green; ctx.lineWidth = 2.3; ctx.beginPath(); ctx.moveTo(legendX + 105, legendY - 3); ctx.lineTo(legendX + 127, legendY - 3); ctx.stroke();
    ctx.fillStyle = COLORS.green; ctx.fillText("local QP / KKT", legendX + 133, legendY);

    ctx.save(); ctx.setLineDash([6, 5]); ctx.beginPath(); dpoR.forEach((v, i) => { if (!i) ctx.moveTo(xs(stageCounts[i]), ys(v)); else ctx.lineTo(xs(stageCounts[i]), ys(v)); }); ctx.strokeStyle = "rgba(241,246,255,.52)"; ctx.lineWidth = 1.8; ctx.stroke(); ctx.restore();
    drawProgressSeries(ctx, qpR, xs, ys, COLORS.green, 2.4);
  }

  function updateCards() {
    const p = recoveryProgress(); queries.forEach(q => { const c = currentPoint(q), r = q.r1 + (q.r0 - q.r1) * Math.pow(1 - p, 2.2); if (els.text[q.id]) els.text[q.id].textContent = `u = (${fmt(c[0])}, ${fmt(c[1])}) · res. ${expFmt(r)}`; });
  }

  function draw() { drawRollout(); drawFeasible(); drawAdjoint(); drawConvergence(); drawRecovery(); drawResidual(); updateCards(); }
  D.registerMode("constraints", draw);
})();
