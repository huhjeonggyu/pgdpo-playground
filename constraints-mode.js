(() => {
  "use strict";
  const D = window.PGDemo; if (!D) return;
  const { stageCounts, COLORS, state, lerp, easeOut, fmt, expFmt, setupCanvas, drawBackground, drawGrid, drawAxes, drawArrow, recoveryProgress, visiblePathCount, drawProgressSeries } = D;
  const els = {
    rollout: document.getElementById("constraintRolloutCanvas"), feasible: document.getElementById("constraintFeasibleCanvas"),
    adjoint: document.getElementById("constraintAdjointCanvas"), conv: document.getElementById("constraintAdjointConvCanvas"),
    recovery: document.getElementById("constraintRecoveryCanvas"), residual: document.getElementById("constraintResidualCanvas"),
    text: { active: document.getElementById("constraintActiveText"), near: document.getElementById("constraintNearText"), interior: document.getElementById("constraintInteriorText") }
  };
  const queries = [
    { id: "active", label: "A", color: COLORS.red, soft: COLORS.redSoft, start: [0.22, 0.42], target: [0, 0.58], r0: 5.2e-2, r1: 1.1e-4 },
    { id: "near", label: "N", color: COLORS.yellow, soft: COLORS.yellowSoft, start: [0.20, 0.35], target: [0.05, 0.47], r0: 3.6e-2, r1: 2e-4 },
    { id: "interior", label: "I", color: COLORS.green, soft: COLORS.greenSoft, start: [0.16, 0.14], target: [0.28, 0.24], r0: 2.8e-2, r1: 9e-5 }
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

  function drawAdjointHalf(ctx, area, kind, visible) {
    const { left, top, width, height } = area, n = 50, xs = k => left + k / n * width;
    const base = t => kind === "lambda" ? 1.18 - .36 * t + .04 * Math.sin(5.3 * t) : 1.72 - .58 * t + .06 * Math.cos(4.6 * t + .4);
    const ymin = kind === "lambda" ? .72 : 1.02, ymax = kind === "lambda" ? 1.28 : 1.90, ys = v => top + height - (v - ymin) / (ymax - ymin) * height;
    ctx.save(); ctx.strokeStyle = "rgba(255,255,255,.06)"; for (let i = 0; i <= 3; i++) { const y = top + i / 3 * height; ctx.beginPath(); ctx.moveTo(left, y); ctx.lineTo(left + width, y); ctx.stroke(); }
    for (let p = 0; p < visible; p++) { ctx.beginPath(); for (let k = 0; k <= n; k++) { const t = k / n, v = base(t) + (.035 + .006 * (p % 3)) * Math.sin(8.5 * t + .72 * p) * (1 - .35 * t); if (!k) ctx.moveTo(xs(k), ys(v)); else ctx.lineTo(xs(k), ys(v)); } ctx.strokeStyle = kind === "lambda" ? "rgba(255,176,122,.20)" : "rgba(143,216,255,.20)"; ctx.lineWidth = 1; ctx.stroke(); }
    ctx.beginPath(); for (let k = 0; k <= n; k++) { const t = k / n; if (!k) ctx.moveTo(xs(k), ys(base(t))); else ctx.lineTo(xs(k), ys(base(t))); } ctx.strokeStyle = kind === "lambda" ? COLORS.orange : COLORS.blue; ctx.lineWidth = 2.3; ctx.stroke();
    ctx.fillStyle = COLORS.text; ctx.font = "bold 10px Inter,system-ui,sans-serif"; ctx.fillText(kind === "lambda" ? "first-order λ" : "curvature −P", left + 6, top + 12); ctx.restore();
  }

  function drawAdjoint() {
    const { ctx, width, height } = setupCanvas(els.adjoint); if (!ctx || width < 2) return; drawBackground(ctx, width, height);
    const visible = visiblePathCount(12), left = 42, right = 14, top = 20, bottom = 18, gap = 16, h = (height - top - bottom - gap) / 2;
    drawAdjointHalf(ctx, { left, top, width: width - left - right, height: h }, "lambda", visible);
    drawAdjointHalf(ctx, { left, top: top + h + gap, width: width - left - right, height: h }, "curvature", visible);
    ctx.fillStyle = COLORS.muted; ctx.font = "10px Inter,system-ui,sans-serif"; ctx.textAlign = "right"; ctx.fillText(`BPTT continuations shown: ${visible}`, width - right, 14); ctx.fillText("time", width - right, height - 5); ctx.textAlign = "left";
  }

  const lambdaVals = stageCounts.map((n, i) => 1 + .17 * Math.exp(-1.25 * Math.log10(n)) + .01 * Math.sin(.8 * i) * Math.exp(-.2 * i));
  const pVals = stageCounts.map((n, i) => 1 - .14 * Math.exp(-1.12 * Math.log10(n)) - .008 * Math.cos(.9 * i) * Math.exp(-.2 * i));
  lambdaVals[lambdaVals.length - 1] = pVals[pVals.length - 1] = 1;

  function drawConvergence() {
    const { ctx, width, height } = setupCanvas(els.conv); if (!ctx || width < 2) return; drawBackground(ctx, width, height);
    const pad = { left: 40, right: 22, top: 16, bottom: 20 }; drawGrid(ctx, width, height, pad, 3, 6);
    const xmax = stageCounts.at(-1), xs = n => pad.left + Math.log10(Math.max(1, n)) / Math.log10(xmax) * (width - pad.left - pad.right), ys = v => height - pad.bottom - (v - .82) / .38 * (height - pad.top - pad.bottom);
    ctx.save(); ctx.setLineDash([5, 5]); ctx.strokeStyle = "rgba(255,255,255,.26)"; ctx.beginPath(); ctx.moveTo(xs(1), ys(1)); ctx.lineTo(xs(xmax), ys(1)); ctx.stroke(); ctx.restore();
    drawProgressSeries(ctx, lambdaVals, xs, ys, COLORS.orange); drawProgressSeries(ctx, pVals, xs, ys, COLORS.blue);
    ctx.fillStyle = COLORS.orange; ctx.font = "bold 10px Inter,system-ui,sans-serif"; ctx.fillText("λ̂ / λ", pad.left + 4, 12); ctx.fillStyle = COLORS.blue; ctx.fillText("−P̂ / (−P)", pad.left + 58, 12);
    ctx.fillStyle = COLORS.muted; ctx.textAlign = "right"; ctx.fillText("number of paths", width - pad.right, height - 5); ctx.textAlign = "left";
  }

  const currentPoint = q => { const p = recoveryProgress(); return [lerp(q.start[0], q.target[0], p), lerp(q.start[1], q.target[1], p)]; };
  function drawRecovery() {
    const { ctx, width, height } = setupCanvas(els.recovery); if (!ctx || width < 2) return; drawBackground(ctx, width, height);
    const pad = { left: 48, right: 20, top: 24, bottom: 34 }; drawGrid(ctx, width, height, pad); drawAxes(ctx, width, height, pad, "risky weight u₁", "risky weight u₂");
    const xs = u => pad.left + u * (width - pad.left - pad.right), ys = u => height - pad.bottom - u * (height - pad.top - pad.bottom);
    ctx.beginPath(); ctx.moveTo(xs(0), ys(0)); ctx.lineTo(xs(1), ys(0)); ctx.lineTo(xs(0), ys(1)); ctx.closePath(); ctx.fillStyle = "rgba(148,240,193,.075)"; ctx.fill(); ctx.strokeStyle = "rgba(148,240,193,.62)"; ctx.lineWidth = 1.7; ctx.stroke();
    ctx.fillStyle = COLORS.green; ctx.font = "bold 11px Inter,system-ui,sans-serif"; ctx.fillText("feasible simplex K", xs(.52), ys(.40)); ctx.fillStyle = COLORS.muted; ctx.font = "10px Inter,system-ui,sans-serif"; ctx.fillText("cash = 1 − u₁ − u₂", xs(.50), ys(.32));
    queries.forEach(q => { const c = currentPoint(q), x0 = xs(q.start[0]), y0 = ys(q.start[1]), x = xs(c[0]), y = ys(c[1]), xt = xs(q.target[0]), yt = ys(q.target[1]); drawArrow(ctx, x0, y0, x, y, q.soft, 1.7); ctx.save(); ctx.setLineDash([3, 4]); ctx.strokeStyle = q.soft; ctx.beginPath(); ctx.arc(xt, yt, 8.2, 0, Math.PI * 2); ctx.stroke(); ctx.restore(); ctx.save(); ctx.shadowBlur = 12; ctx.shadowColor = q.color; ctx.beginPath(); ctx.fillStyle = q.color; ctx.arc(x, y, 6.2, 0, Math.PI * 2); ctx.fill(); ctx.restore(); ctx.fillStyle = COLORS.text; ctx.font = "bold 11px Inter,system-ui,sans-serif"; ctx.fillText(q.label, x + 9, y - 7); });
  }

  const dpoR = stageCounts.map(n => .030 + .032 * Math.exp(-.72 * Math.log10(n))), barrierR = stageCounts.map(n => 4e-4 + .045 * Math.pow(n, -.62)), qpR = stageCounts.map(n => 2e-5 + .030 * Math.pow(n, -.94));
  function drawResidual() {
    const { ctx, width, height } = setupCanvas(els.residual); if (!ctx || width < 2) return; drawBackground(ctx, width, height);
    const pad = { left: 48, right: 26, top: 20, bottom: 28 }; drawGrid(ctx, width, height, pad, 4, 6); drawAxes(ctx, width, height, pad, "number of paths", "KKT residual");
    const xmax = stageCounts.at(-1), xs = n => pad.left + Math.log10(Math.max(1, n)) / Math.log10(xmax) * (width - pad.left - pad.right), ys = v => height - pad.bottom - (Math.log10(Math.max(1e-5, v)) + 5) / 4 * (height - pad.top - pad.bottom);
    ctx.save(); ctx.setLineDash([6, 5]); ctx.beginPath(); dpoR.forEach((v, i) => { if (!i) ctx.moveTo(xs(stageCounts[i]), ys(v)); else ctx.lineTo(xs(stageCounts[i]), ys(v)); }); ctx.strokeStyle = "rgba(241,246,255,.52)"; ctx.lineWidth = 1.8; ctx.stroke(); ctx.restore();
    drawProgressSeries(ctx, barrierR, xs, ys, COLORS.yellow, 2.1); drawProgressSeries(ctx, qpR, xs, ys, COLORS.green, 2.3);
    ctx.font = "bold 10px Inter,system-ui,sans-serif"; ctx.fillStyle = "rgba(241,246,255,.62)"; ctx.fillText("feasible DPO", pad.left + 5, 13); ctx.fillStyle = COLORS.yellow; ctx.fillText("barrier", pad.left + 84, 13); ctx.fillStyle = COLORS.green; ctx.fillText("QP / KKT", pad.left + 132, 13);
  }

  function updateCards() {
    const p = recoveryProgress(); queries.forEach(q => { const c = currentPoint(q), r = q.r1 + (q.r0 - q.r1) * Math.pow(1 - p, 2.2); if (els.text[q.id]) els.text[q.id].textContent = `u = (${fmt(c[0])}, ${fmt(c[1])}) · res. ${expFmt(r)}`; });
  }

  function draw() { drawRollout(); drawFeasible(); drawAdjoint(); drawConvergence(); drawRecovery(); drawResidual(); updateCards(); }
  D.registerMode("constraints", draw);
})();
