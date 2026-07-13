(() => {
  "use strict";
  const D = window.PGDemo; if (!D) return;
  const { stageCounts, COLORS, state, lerp, easeOut, setupCanvas, drawBackground, drawGrid, drawAxes, drawArrow, recoveryProgress, visiblePathCount, drawProgressSeries } = D;
  const els = {
    kernel: document.getElementById("nonexpKernelCanvas"), anchor: document.getElementById("nonexpAnchorCanvas"),
    adjoint: document.getElementById("nonexpAdjointCanvas"), diagonal: document.getElementById("nonexpDiagonalCanvas"),
    recovery: document.getElementById("nonexpRecoveryCanvas"), residual: document.getElementById("nonexpResidualCanvas"),
    text: { early: document.getElementById("nonexpEarlyText"), middle: document.getElementById("nonexpMiddleText"), late: document.getElementById("nonexpLateText") }
  };
  const queries = [
    { id: "early", label: "E", t: .18, color: COLORS.blue, soft: COLORS.blueSoft },
    { id: "middle", label: "M", t: .50, color: COLORS.orange, soft: COLORS.orangeSoft },
    { id: "late", label: "L", t: .82, color: COLORS.purple, soft: COLORS.purpleSoft }
  ];

  function curve(ctx, fn, xs, ys, reveal, color, dash = []) {
    ctx.save(); ctx.setLineDash(dash); ctx.beginPath(); const n = 120, stop = Math.max(1, Math.floor(n * reveal));
    for (let i = 0; i <= stop; i++) { const t = i / n; if (!i) ctx.moveTo(xs(t), ys(fn(t))); else ctx.lineTo(xs(t), ys(fn(t))); }
    ctx.strokeStyle = color; ctx.lineWidth = 2.2; ctx.stroke(); ctx.restore();
  }

  function drawKernel() {
    const { ctx, width, height } = setupCanvas(els.kernel); if (!ctx || width < 2) return; drawBackground(ctx, width, height);
    const pad = { left: 42, right: 18, top: 20, bottom: 28 }; drawGrid(ctx, width, height, pad); drawAxes(ctx, width, height, pad, "delay τ", "D(t₀,t₀+τ)");
    const xs = t => pad.left + t * (width - pad.left - pad.right), ys = v => height - pad.bottom - v * (height - pad.top - pad.bottom), reveal = easeOut(state.warmup);
    curve(ctx, t => Math.exp(-3 * t), xs, ys, reveal, "rgba(241,246,255,.72)", [5, 4]);
    curve(ctx, t => Math.pow(.45 / (.45 + t), 1.15), xs, ys, reveal, COLORS.blue);
    curve(ctx, t => Math.pow(1.15 / (1.15 + t), 1.15), xs, ys, reveal, COLORS.green);
    curve(ctx, t => 1 / (1 + 2.4 * t), xs, ys, reveal, COLORS.orange);
    const legend = [["exponential", "rgba(241,246,255,.72)"], ["survival t₀=0", COLORS.blue], ["survival t₀>0", COLORS.green], ["hyperbolic", COLORS.orange]];
    ctx.font = "10px Inter,system-ui,sans-serif"; legend.forEach((z, i) => { const x = width - pad.right - 124, y = pad.top + 12 + 15 * i; ctx.strokeStyle = z[1]; ctx.lineWidth = 2.2; ctx.beginPath(); ctx.moveTo(x, y - 3); ctx.lineTo(x + 18, y - 3); ctx.stroke(); ctx.fillStyle = COLORS.muted; ctx.fillText(z[0], x + 24, y); });
  }

  function drawAnchor() {
    const { ctx, width, height } = setupCanvas(els.anchor); if (!ctx || width < 2) return; drawBackground(ctx, width, height);
    const left = 52, right = width - 24, anchors = [.12, .42, .68], colors = [COLORS.blue, COLORS.orange, COLORS.purple], p = easeOut(state.warmup);
    ctx.fillStyle = COLORS.text; ctx.font = "11px Inter,system-ui,sans-serif"; ctx.fillText("random-anchor rollout objective", 12, 16); ctx.fillStyle = COLORS.muted; ctx.font = "10px Inter,system-ui,sans-serif"; ctx.fillText("each anchor carries its own kernel D(t₀, ·)", 12, 31);
    anchors.forEach((a, row) => { const y = 58 + row * 30, ax = lerp(left, right, a), rx = lerp(ax, right, p); ctx.strokeStyle = "rgba(255,255,255,.12)"; ctx.beginPath(); ctx.moveTo(left, y); ctx.lineTo(right, y); ctx.stroke(); ctx.strokeStyle = colors[row]; ctx.lineWidth = 2.2; ctx.beginPath(); ctx.moveTo(ax, y); ctx.lineTo(rx, y); ctx.stroke();
      for (let j = 0; j < 7; j++) { const u = j / 6, x = lerp(ax, right, u); if (x > rx + 1) continue; ctx.fillStyle = colors[row].replace(",1)", `,${.75 * Math.exp(-1.7 * u)})`); ctx.fillRect(x - 2, y - 7, 4, 14); }
      ctx.beginPath(); ctx.fillStyle = colors[row]; ctx.arc(ax, y, 5.2, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = COLORS.text; ctx.font = "bold 10px Inter,system-ui,sans-serif"; ctx.fillText(`t₀${row + 1}`, ax - 10, y - 10); });
    ctx.fillStyle = COLORS.muted; ctx.font = "10px Inter,system-ui,sans-serif"; ctx.fillText("0", left - 3, height - 8); ctx.textAlign = "right"; ctx.fillText("T", right + 3, height - 8); ctx.textAlign = "left";
  }

  function mean(anchor, t) { if (t < anchor) return NaN; const s = (t - anchor) / Math.max(1e-6, 1 - anchor); return 1.28 - .40 * s + .08 * anchor + .045 * Math.sin(5.2 * s + 1.5 * anchor); }
  function drawAdjoint() {
    const { ctx, width, height } = setupCanvas(els.adjoint); if (!ctx || width < 2) return; drawBackground(ctx, width, height);
    const pad = { left: 42, right: 16, top: 22, bottom: 28 }; drawGrid(ctx, width, height, pad); drawAxes(ctx, width, height, pad, "time", "anchored adjoint λ(t₀,t)");
    const xs = t => pad.left + t * (width - pad.left - pad.right), ys = v => height - pad.bottom - (v - .78) / .62 * (height - pad.top - pad.bottom), anchors = [.15, .45, .72], colors = [COLORS.blue, COLORS.orange, COLORS.purple], visible = visiblePathCount(8);
    anchors.forEach((a, ai) => { for (let p = 0; p < visible; p++) { ctx.beginPath(); let started = false; for (let k = 0; k <= 70; k++) { const t = k / 70; if (t < a) continue; const s = (t - a) / (1 - a), y = ys(mean(a, t) + .028 * Math.sin(9 * s + .8 * p + ai) * (1 - .4 * s)); if (!started) { ctx.moveTo(xs(t), y); started = true; } else ctx.lineTo(xs(t), y); } ctx.strokeStyle = colors[ai].replace(",1)", ",.16)"); ctx.lineWidth = 1; ctx.stroke(); }
      ctx.beginPath(); let started = false; for (let k = 0; k <= 70; k++) { const t = k / 70; if (t < a) continue; if (!started) { ctx.moveTo(xs(t), ys(mean(a, t))); started = true; } else ctx.lineTo(xs(t), ys(mean(a, t))); } ctx.strokeStyle = colors[ai]; ctx.lineWidth = 2.25; ctx.stroke(); ctx.fillStyle = colors[ai]; ctx.font = "bold 10px Inter,system-ui,sans-serif"; ctx.fillText(`t₀=${a.toFixed(2)}`, xs(a) + 5, pad.top + 13 + 14 * ai); });
    ctx.fillStyle = COLORS.yellow; ctx.font = "10px Inter,system-ui,sans-serif"; ctx.textAlign = "right"; ctx.fillText(`continuations: ${visible}`, width - pad.right, 15); ctx.textAlign = "left";
  }

  function drawDiagonal() {
    const { ctx, width, height } = setupCanvas(els.diagonal); if (!ctx || width < 2) return; drawBackground(ctx, width, height);
    const left = 46, right = width - 26, top = 12, bottom = height - 18, xs = t => left + t * (right - left), ys = t => bottom - t * (bottom - top);
    ctx.beginPath(); ctx.moveTo(xs(0), ys(0)); ctx.lineTo(xs(1), ys(0)); ctx.lineTo(xs(1), ys(1)); ctx.closePath(); ctx.fillStyle = "rgba(143,216,255,.055)"; ctx.fill(); ctx.strokeStyle = "rgba(255,255,255,.12)"; ctx.stroke();
    ctx.strokeStyle = COLORS.yellow; ctx.lineWidth = 2.4; ctx.beginPath(); ctx.moveTo(xs(0), ys(0)); ctx.lineTo(xs(1), ys(1)); ctx.stroke(); const q = .08 + .84 * recoveryProgress(); ctx.save(); ctx.shadowBlur = 10; ctx.shadowColor = COLORS.yellow; ctx.beginPath(); ctx.fillStyle = COLORS.yellow; ctx.arc(xs(q), ys(q), 5.2, 0, Math.PI * 2); ctx.fill(); ctx.restore();
    ctx.fillStyle = COLORS.text; ctx.font = "bold 10px Inter,system-ui,sans-serif"; ctx.fillText("diagonal: anchor t₀ = decision time t", left + 8, top + 10); ctx.fillStyle = COLORS.muted; ctx.textAlign = "right"; ctx.fillText("decision time t", right, height - 4); ctx.textAlign = "left"; ctx.fillText("anchor t₀", 5, top + 8);
  }

  const equilibrium = t => 1.14 + .18 * Math.sin(2 * Math.PI * t) + .10 * Math.sin(4 * Math.PI * t + .45);
  const warm = t => 1.17 + .065 * Math.sin(2 * Math.PI * t + .25) - .025 * t;
  const current = q => lerp(warm(q.t), equilibrium(q.t), recoveryProgress());
  function drawRecovery() {
    const { ctx, width, height } = setupCanvas(els.recovery); if (!ctx || width < 2) return; drawBackground(ctx, width, height);
    const pad = { left: 44, right: 18, top: 24, bottom: 30 }; drawGrid(ctx, width, height, pad); drawAxes(ctx, width, height, pad, "decision time t", "action u");
    const xs = t => pad.left + t * (width - pad.left - pad.right), ys = u => height - pad.bottom - (u - .82) / .64 * (height - pad.top - pad.bottom);
    ctx.save(); ctx.setLineDash([6, 5]); ctx.beginPath(); for (let i = 0; i <= 120; i++) { const t = i / 120; if (!i) ctx.moveTo(xs(t), ys(warm(t))); else ctx.lineTo(xs(t), ys(warm(t))); } ctx.strokeStyle = "rgba(241,246,255,.52)"; ctx.lineWidth = 1.9; ctx.stroke(); ctx.restore();
    ctx.beginPath(); for (let i = 0; i <= 120; i++) { const t = i / 120; if (!i) ctx.moveTo(xs(t), ys(equilibrium(t))); else ctx.lineTo(xs(t), ys(equilibrium(t))); } ctx.strokeStyle = COLORS.orange; ctx.lineWidth = 2.5; ctx.stroke();
    queries.forEach(q => { const x = xs(q.t), yw = ys(warm(q.t)), yc = ys(current(q)), yt = ys(equilibrium(q.t)); drawArrow(ctx, x, yw, x, yc, q.soft, 1.8); ctx.save(); ctx.setLineDash([3, 4]); ctx.strokeStyle = q.soft; ctx.beginPath(); ctx.arc(x, yt, 8.1, 0, Math.PI * 2); ctx.stroke(); ctx.restore(); ctx.save(); ctx.shadowBlur = 12; ctx.shadowColor = q.color; ctx.beginPath(); ctx.fillStyle = q.color; ctx.arc(x, yc, 6.2, 0, Math.PI * 2); ctx.fill(); ctx.restore(); ctx.fillStyle = COLORS.text; ctx.font = "bold 11px Inter,system-ui,sans-serif"; ctx.fillText(q.label, x + 8, yc - 8); });
    ctx.fillStyle = "rgba(241,246,255,.58)"; ctx.font = "10px Inter,system-ui,sans-serif"; ctx.fillText("warm-up", pad.left + 8, pad.top + 13); ctx.fillStyle = COLORS.orange; ctx.fillText("diagonal optimum / equilibrium", pad.left + 65, pad.top + 13);
  }

  const warmR = stageCounts.map(n => .030 + .14 * Math.exp(-.78 * Math.log10(n))), projectedR = stageCounts.map(n => .008 + .055 * Math.exp(-1.22 * Math.log10(n)));
  function drawResidual() {
    const { ctx, width, height } = setupCanvas(els.residual); if (!ctx || width < 2) return; drawBackground(ctx, width, height);
    const pad = { left: 48, right: 26, top: 20, bottom: 28 }; drawGrid(ctx, width, height, pad, 4, 6); drawAxes(ctx, width, height, pad, "number of paths", "Hamiltonian residual");
    const xmax = stageCounts.at(-1), xs = n => pad.left + Math.log10(Math.max(1, n)) / Math.log10(xmax) * (width - pad.left - pad.right), ys = v => height - pad.bottom - (Math.log10(Math.max(.005, v)) + 2.25) / 1.60 * (height - pad.top - pad.bottom);
    drawProgressSeries(ctx, warmR, xs, ys, COLORS.blue, 2); drawProgressSeries(ctx, projectedR, xs, ys, COLORS.orange, 2.4);
    ctx.font = "bold 10px Inter,system-ui,sans-serif"; ctx.fillStyle = COLORS.blue; ctx.fillText("Stage 1 warm-up", pad.left + 5, 13); ctx.fillStyle = COLORS.orange; ctx.fillText("diagonal projection", pad.left + 102, 13);
  }

  function updateCards() { queries.forEach(q => { if (els.text[q.id]) els.text[q.id].textContent = `t = ${q.t.toFixed(2)} · û = ${current(q).toFixed(3)}`; }); }
  function draw() { drawKernel(); drawAnchor(); drawAdjoint(); drawDiagonal(); drawRecovery(); drawResidual(); updateCards(); }
  D.registerMode("nonexp", draw);
})();
