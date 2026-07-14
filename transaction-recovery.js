(() => {
  "use strict";
  const E = window.PGExtended;
  if (!E?.transaction) return;
  const { COLORS, lerp, setupCanvas, drawBackground, drawGrid, drawAxes, drawSeries, drawLegendLine,
    stageCounts, stageContext, transactionEls, fmt } = E;
  const { tc, transactionQueries, projectedTrade, currentTransactionRatio, drawTransactionRollout,
    drawTransactionPolicy, drawTransactionAdjoint } = E.transaction;

  function drawTransactionRatio() {
    const { ctx, width, height } = setupCanvas(transactionEls.ratio);
    if (!ctx || width < 2) return;
    drawBackground(ctx, width, height);
    const pad = { left: 46, right: 26, top: 22, bottom: 27 };
    drawGrid(ctx, width, height, pad, 4, 6);
    drawAxes(ctx, width, height, pad, "number of continuations", "R̂");

    const xMax = stageCounts[stageCounts.length - 1];
    const xScale = (count) => pad.left + Math.log10(Math.max(1, count)) / Math.log10(xMax) * (width - pad.left - pad.right);
    const yScale = (ratio) => height - pad.bottom - (ratio - 0.82) / 0.26 * (height - pad.top - pad.bottom);
    const holdTop = yScale(tc.upper);
    const holdBottom = yScale(tc.lower);
    ctx.fillStyle = "rgba(148,240,193,.10)";
    ctx.fillRect(pad.left, holdTop, width - pad.left - pad.right, holdBottom - holdTop);

    ctx.save();
    ctx.setLineDash([5, 5]);
    ctx.strokeStyle = "rgba(255,255,255,.26)";
    [tc.lower, tc.upper].forEach((ratio) => {
      ctx.beginPath();
      ctx.moveTo(pad.left, yScale(ratio));
      ctx.lineTo(width - pad.right, yScale(ratio));
      ctx.stroke();
    });
    ctx.restore();

    transactionQueries.forEach((query) => drawSeries(ctx, query.stageRatios, xScale, yScale, query.color, 2.2));
    ctx.fillStyle = COLORS.green;
    ctx.font = "10px Inter,system-ui,sans-serif";
    ctx.fillText("exact hold wedge", pad.left + 7, holdTop + 13);
    ctx.textAlign = "right";
    transactionQueries.forEach((query) => {
      ctx.fillStyle = query.color;
      ctx.font = "bold 10px Inter,system-ui,sans-serif";
      ctx.fillText(query.label, width - pad.right - 2, yScale(query.ratioTrue) - 3);
    });
    ctx.textAlign = "left";
  }

  function drawDeadZoneBranch(ctx, xScale, yScale, start, end, color) {
    ctx.beginPath();
    for (let index = 0; index <= 100; index += 1) {
      const ratio = lerp(start, end, index / 100);
      const x = xScale(ratio);
      const y = yScale(projectedTrade(ratio));
      if (index === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.strokeStyle = color;
    ctx.lineWidth = 2.8;
    ctx.stroke();
  }

  function drawTransactionRecovery() {
    const { ctx, width, height } = setupCanvas(transactionEls.recovery);
    if (!ctx || width < 2) return;
    drawBackground(ctx, width, height);
    const pad = { left: 48, right: 18, top: 60, bottom: 34 };
    drawGrid(ctx, width, height, pad);
    drawAxes(ctx, width, height, pad, "costate ratio R̂", "trading rate û");

    const yBound = 0.64;
    const xScale = (ratio) => pad.left + (ratio - tc.ratioMin) / (tc.ratioMax - tc.ratioMin) * (width - pad.left - pad.right);
    const yScale = (trade) => height - pad.bottom - (trade + yBound) / (2 * yBound) * (height - pad.top - pad.bottom);
    const lowerX = xScale(tc.lower);
    const upperX = xScale(tc.upper);
    const zeroY = yScale(0);

    ctx.fillStyle = "rgba(148,240,193,.10)";
    ctx.fillRect(lowerX, pad.top, upperX - lowerX, height - pad.top - pad.bottom);
    ctx.strokeStyle = "rgba(255,255,255,.18)";
    ctx.beginPath();
    ctx.moveTo(pad.left, zeroY);
    ctx.lineTo(width - pad.right, zeroY);
    ctx.stroke();

    ctx.save();
    ctx.setLineDash([5, 5]);
    ctx.strokeStyle = "rgba(255,255,255,.28)";
    [lowerX, upperX].forEach((x) => {
      ctx.beginPath();
      ctx.moveTo(x, pad.top);
      ctx.lineTo(x, height - pad.bottom);
      ctx.stroke();
    });
    ctx.restore();

    drawDeadZoneBranch(ctx, xScale, yScale, tc.ratioMin, tc.lower, COLORS.red);
    drawDeadZoneBranch(ctx, xScale, yScale, tc.lower, tc.upper, COLORS.green);
    drawDeadZoneBranch(ctx, xScale, yScale, tc.upper, tc.ratioMax, COLORS.orange);

    ctx.fillStyle = COLORS.text;
    ctx.font = "bold 11px Inter,system-ui,sans-serif";
    ctx.fillText("Closed-form nonsmooth Pontryagin projection", pad.left, 17);
    ctx.fillStyle = COLORS.muted;
    ctx.font = "10px Inter,system-ui,sans-serif";
    ctx.fillText("the proportional-cost wedge remains exactly flat", pad.left, 32);

    ctx.textAlign = "center";
    ctx.font = "bold 10px Inter,system-ui,sans-serif";
    ctx.fillStyle = COLORS.red;
    ctx.fillText("SELL", (pad.left + lowerX) / 2, pad.top + 14);
    ctx.fillStyle = COLORS.green;
    ctx.fillText("HOLD", (lowerX + upperX) / 2, pad.top + 14);
    ctx.fillStyle = COLORS.orange;
    ctx.fillText("BUY", (upperX + width - pad.right) / 2, pad.top + 14);
    ctx.textAlign = "left";

    transactionQueries.forEach((query) => {
      const ratio = currentTransactionRatio(query);
      const trade = projectedTrade(ratio);
      const pointX = xScale(ratio);
      const pointY = yScale(trade);
      const targetX = xScale(query.ratioTrue);
      const targetY = yScale(projectedTrade(query.ratioTrue));

      ctx.save();
      ctx.setLineDash([3, 4]);
      ctx.strokeStyle = query.soft;
      ctx.beginPath();
      ctx.moveTo(pointX, pointY);
      ctx.lineTo(targetX, targetY);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(targetX, targetY, 8, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();

      ctx.save();
      ctx.shadowBlur = 12;
      ctx.shadowColor = query.color;
      ctx.beginPath();
      ctx.fillStyle = query.color;
      ctx.arc(pointX, pointY, 6.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      ctx.fillStyle = COLORS.text;
      ctx.font = "bold 11px Inter,system-ui,sans-serif";
      ctx.fillText(query.label, pointX + (query.id === "buy" ? -16 : 9), pointY - 9);
    });
  }

  const transactionDpoResidual = stageCounts.map((count) => 0.030 + 0.032 * Math.exp(-0.72 * Math.log10(count)));
  const transactionProjectedResidual = stageCounts.map((count) => 2e-5 + 0.030 * Math.pow(count, -0.94));

  function drawTransactionDiagnostic() {
    const { ctx, width, height } = setupCanvas(transactionEls.diagnostic);
    if (!ctx || width < 2) return;
    drawBackground(ctx, width, height);
    const pad = { left: 48, right: 26, top: 60, bottom: 30 };
    drawGrid(ctx, width, height, pad, 4, 6);
    drawAxes(ctx, width, height, pad, "number of continuations", "");

    const xMax = stageCounts[stageCounts.length - 1];
    const xScale = (count) => pad.left + Math.log10(Math.max(1, count)) / Math.log10(xMax) * (width - pad.left - pad.right);
    const yScale = (value) => height - pad.bottom - (Math.log10(Math.max(1e-5, value)) + 5) / 4 * (height - pad.top - pad.bottom);

    ctx.fillStyle = COLORS.text;
    ctx.font = "bold 10px Inter,system-ui,sans-serif";
    ctx.fillText("nonsmooth local stationarity residual", pad.left, 16);
    drawLegendLine(ctx, pad.left, 39, "rgba(241,246,255,.62)", "warm-up", true);
    drawLegendLine(ctx, Math.max(pad.left + 118, width - pad.right - 150), 39, COLORS.green, "dead-zone recovery");

    drawSeries(ctx, transactionDpoResidual, xScale, yScale, "rgba(241,246,255,.58)", 1.8, true);
    drawSeries(ctx, transactionProjectedResidual, xScale, yScale, COLORS.green, 2.4);
  }

  function updateTransactionCards() {
    transactionQueries.forEach((query) => {
      const ratio = currentTransactionRatio(query);
      const trade = projectedTrade(ratio);
      const node = transactionEls.text[query.id];
      if (node) node.textContent = `R̂ = ${fmt(ratio)} · û = ${fmt(trade)}`;
    });
  }

  function drawTransaction() {
    drawTransactionRollout();
    drawTransactionPolicy();
    drawTransactionAdjoint();
    drawTransactionRatio();
    drawTransactionRecovery();
    drawTransactionDiagnostic();
    updateTransactionCards();
  }

  E.drawTransaction = drawTransaction;
})();
