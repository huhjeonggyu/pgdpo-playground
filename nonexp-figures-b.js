(() => {
  "use strict";
  const N = window.PGNonexpMode;
  if (!N) return;
  const { D, stageCounts, COLORS, lerp, setupCanvas, drawBackground, drawGrid, drawAxes, drawArrow,
    recoveryProgress, drawProgressSeries, els, queries, drawKernel, drawAnchor, drawAdjoint } = N;
  function drawDiagonal() {
    const { ctx, width, height } = setupCanvas(els.diagonal);
    if (!ctx || width < 2) return;
    drawBackground(ctx, width, height);
    const left = 48;
    const right = width - 26;
    const top = 28;
    const bottom = height - 22;
    const xScale = (time) => left + time * (right - left);
    const yScale = (anchor) => bottom - anchor * (bottom - top);
    const progress = recoveryProgress();

    ctx.beginPath();
    ctx.moveTo(xScale(0), yScale(0));
    ctx.lineTo(xScale(1), yScale(0));
    ctx.lineTo(xScale(1), yScale(1));
    ctx.closePath();
    ctx.fillStyle = "rgba(143,216,255,.055)";
    ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,.12)";
    ctx.stroke();
    ctx.strokeStyle = COLORS.yellow;
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    ctx.moveTo(xScale(0), yScale(0));
    ctx.lineTo(xScale(1), yScale(1));
    ctx.stroke();

    ctx.fillStyle = COLORS.text;
    ctx.font = "bold 10px Inter,system-ui,sans-serif";
    ctx.fillText("use the diagonal adjoint: anchor t₀ = decision time t", left + 4, 15);
    queries.forEach((query) => {
      const x = xScale(query.t);
      const yStart = yScale(query.startAnchor);
      const yNow = yScale(lerp(query.startAnchor, query.t, progress));
      const yTarget = yScale(query.t);
      ctx.save();
      ctx.setLineDash([4, 4]);
      drawArrow(ctx, x, yStart, x, yNow, query.soft, 1.6);
      ctx.restore();
      ctx.save();
      ctx.setLineDash([3, 4]);
      ctx.strokeStyle = query.color;
      ctx.beginPath();
      ctx.arc(x, yTarget, 7.2, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
      ctx.beginPath();
      ctx.fillStyle = query.color;
      ctx.arc(x, yNow, 4.8, 0, Math.PI * 2);
      ctx.fill();
    });
  }

  function currentAction(query) {
    return lerp(query.warm, query.target, recoveryProgress());
  }

  function drawRecovery() {
    const { ctx, width, height } = setupCanvas(els.recovery);
    if (!ctx || width < 2) return;
    drawBackground(ctx, width, height);
    const outer = 14;
    const gap = 10;
    const top = 42;
    const bottom = height - 28;
    const panelWidth = (width - 2 * outer - 2 * gap) / 3;

    ctx.fillStyle = COLORS.text;
    ctx.font = "bold 11px Inter,system-ui,sans-serif";
    ctx.fillText("Each query uses λ̂(t,t) to maximize its local Hamiltonian", 14, 20);
    ctx.fillStyle = COLORS.muted;
    ctx.font = "9px Inter,system-ui,sans-serif";
    ctx.fillText("warm-up action → arg maxᵤ H(t,t,x,u,λ̂,Ẑ)", 14, 34);

    queries.forEach((query, index) => {
      const x0 = outer + index * (panelWidth + gap);
      const x1 = x0 + panelWidth;
      ctx.fillStyle = "rgba(255,255,255,.018)";
      ctx.fillRect(x0, top, panelWidth, bottom - top);
      ctx.strokeStyle = "rgba(255,255,255,.08)";
      ctx.strokeRect(x0, top, panelWidth, bottom - top);
      const uMin = Math.min(query.warm, query.target) - 0.28;
      const uMax = Math.max(query.warm, query.target) + 0.28;
      const xScale = (u) => x0 + 14 + (u - uMin) / (uMax - uMin) * (panelWidth - 28);
      const yScale = (h) => bottom - 24 - h * (bottom - top - 52);
      const hamiltonian = (u) => Math.max(0, 1 - 3.4 * Math.pow((u - query.target) / (uMax - uMin), 2));

      ctx.beginPath();
      for (let step = 0; step <= 80; step += 1) {
        const u = uMin + (uMax - uMin) * step / 80;
        const x = xScale(u);
        const y = yScale(hamiltonian(u));
        if (step === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.strokeStyle = query.color;
      ctx.lineWidth = 2.2;
      ctx.stroke();

      const current = currentAction(query);
      const startX = xScale(query.warm);
      const startY = yScale(hamiltonian(query.warm));
      const currentX = xScale(current);
      const currentY = yScale(hamiltonian(current));
      drawArrow(ctx, startX, startY, currentX, currentY, query.soft, 1.8);
      ctx.beginPath();
      ctx.fillStyle = query.color;
      ctx.arc(currentX, currentY, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = query.color;
      ctx.font = "bold 10px Inter,system-ui,sans-serif";
      ctx.fillText(`${query.name} · t=${query.t.toFixed(2)}`, x0 + 9, top + 16);
      ctx.fillStyle = COLORS.muted;
      ctx.font = "9px Inter,system-ui,sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(`u: ${query.warm.toFixed(2)} → ${query.target.toFixed(2)}`, (x0 + x1) / 2, bottom - 7);
      ctx.textAlign = "left";
    });
  }

  const warmResidual = stageCounts.map((count) => 0.030 + 0.14 * Math.exp(-0.78 * Math.log10(count)));
  const correctedResidual = stageCounts.map((count) => 0.008 + 0.055 * Math.exp(-1.22 * Math.log10(count)));

  function drawResidual() {
    const { ctx, width, height } = setupCanvas(els.residual);
    if (!ctx || width < 2) return;
    drawBackground(ctx, width, height);
    const pad = { left: 48, right: 26, top: 42, bottom: 30 };
    drawGrid(ctx, width, height, pad, 4, 6);
    drawAxes(ctx, width, height, pad, "number of paths", "");
    const xMax = stageCounts[stageCounts.length - 1];
    const xScale = (count) => pad.left + Math.log10(Math.max(1, count)) / Math.log10(xMax) * (width - pad.left - pad.right);
    const yScale = (v) => height - pad.bottom - (Math.log10(Math.max(0.005, v)) + 2.25) / 1.60 * (height - pad.top - pad.bottom);
    ctx.fillStyle = COLORS.text;
    ctx.font = "bold 10px Inter,system-ui,sans-serif";
    ctx.fillText("local Hamiltonian residual", pad.left, 16);
    drawProgressSeries(ctx, warmResidual, xScale, yScale, COLORS.blue, 2);
    drawProgressSeries(ctx, correctedResidual, xScale, yScale, COLORS.orange, 2.4);
  }

  function updateCards() {
    queries.forEach((query) => {
      if (els.text[query.id]) els.text[query.id].textContent = `t = ${query.t.toFixed(2)} · û = ${currentAction(query).toFixed(3)}`;
    });
  }

  function draw() {
    drawKernel();
    drawAnchor();
    drawAdjoint();
    drawDiagonal();
    drawRecovery();
    drawResidual();
    updateCards();
  }

  D.registerMode("nonexp", draw);
})();
