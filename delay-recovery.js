(() => {
  "use strict";
  const E = window.PGExtended;
  if (!E?.delay) return;
  const { COLORS, lerp, setupCanvas, drawBackground, drawGrid, drawAxes, drawSeries, drawLegendLine,
    stageCounts, delayEls, recoveryProgress, currentPathCount, roundedRect } = E;
  const { delay, drawDelayRollout, drawDelayHistory, drawDelayAdjoint } = E.delay;

  const delayResidualValues = stageCounts.map((count) => 0.12 * Math.pow(count, -0.55) + 0.0025);
  const delayDiscretizationValues = stageCounts.map((count) => 0.065 * Math.pow(count, -0.48) + 0.0018);

  function drawDelayBridge() {
    const { ctx, width, height } = setupCanvas(delayEls.bridge);
    if (!ctx || width < 2) return;
    drawBackground(ctx, width, height);

    const leftWidth = width * 0.48;
    ctx.fillStyle = COLORS.text;
    ctx.font = "bold 10px Inter,system-ui,sans-serif";
    ctx.fillText("Predictable adjoint identity", 12, 17);

    roundedRect(ctx, 16, 30, leftWidth * 0.34, height - 48, 10, "rgba(255,176,122,.07)", "rgba(255,176,122,.30)");
    roundedRect(ctx, leftWidth * 0.37, 30, leftWidth * 0.34, height - 48, 10, "rgba(143,216,255,.07)", "rgba(143,216,255,.30)");
    roundedRect(ctx, leftWidth * 0.74, 30, leftWidth * 0.23, height - 48, 10, "rgba(189,159,255,.07)", "rgba(189,159,255,.30)");

    ctx.textAlign = "center";
    ctx.fillStyle = COLORS.orange;
    ctx.font = "bold 9px Inter,system-ui,sans-serif";
    ctx.fillText("BPTT drift", 16 + leftWidth * 0.17, 51);
    ctx.fillStyle = COLORS.blue;
    ctx.fillText("ABSDE drift", leftWidth * 0.54, 51);
    ctx.fillStyle = COLORS.purple;
    ctx.fillText("CᶜˡΔt", leftWidth * 0.855, 51);
    ctx.fillStyle = COLORS.muted;
    ctx.font = "9px Inter,system-ui,sans-serif";
    ctx.fillText("=", leftWidth * 0.355, height * 0.61);
    ctx.fillText("+", leftWidth * 0.72, height * 0.61);
    ctx.textAlign = "left";

    const pad = { left: leftWidth + 34, right: 18, top: 28, bottom: 24 };
    drawGrid(ctx, width, height, pad, 3, 4);
    const xMax = stageCounts[stageCounts.length - 1];
    const xScale = (count) => pad.left + Math.log10(Math.max(1, count)) / Math.log10(xMax) * (width - pad.left - pad.right);
    const yScale = (value) => height - pad.bottom - (Math.log10(Math.max(1e-3, value)) + 3) / 2.2 * (height - pad.top - pad.bottom);
    drawSeries(ctx, delayResidualValues, xScale, yScale, COLORS.purple, 2.2);
    drawSeries(ctx, delayDiscretizationValues, xScale, yScale, COLORS.blue, 1.8, true);
    ctx.fillStyle = COLORS.purple;
    ctx.font = "bold 9px Inter,system-ui,sans-serif";
    ctx.fillText("FOC residual", pad.left + 4, 16);
    ctx.fillStyle = COLORS.blue;
    ctx.fillText("Euler / MC error", pad.left + 77, 16);
  }

  function delayReferenceControl(time) {
    if (time <= delay.kink) return 0.885 + 0.145 * time;
    return 0.885 + 0.145 * delay.kink + 0.022 * (time - delay.kink);
  }

  function delayWarmControl(time) {
    const leftSlope = 0.132;
    const rightSlope = 0.035;
    const smoothTransition = 0.5 * (1 + Math.tanh((time - delay.kink) / 0.075));
    const base = 0.889 + leftSlope * time;
    return base - (leftSlope - rightSlope) * (time - delay.kink) * smoothTransition;
  }

  function delayProjectedControl(time) {
    return lerp(delayWarmControl(time), delayReferenceControl(time), recoveryProgress());
  }

  function drawControlCurve(ctx, xScale, yScale, fn, color, width, dashed = false) {
    ctx.save();
    if (dashed) ctx.setLineDash([6, 5]);
    ctx.beginPath();
    for (let step = 0; step <= 120; step += 1) {
      const time = step / 120;
      const x = xScale(time);
      const y = yScale(fn(time));
      if (step === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.stroke();
    ctx.restore();
  }

  function drawDelayRecovery() {
    const { ctx, width, height } = setupCanvas(delayEls.recovery);
    if (!ctx || width < 2) return;
    drawBackground(ctx, width, height);
    const pad = { left: 48, right: 18, top: 76, bottom: 34 };
    drawGrid(ctx, width, height, pad);
    drawAxes(ctx, width, height, pad, "time", "control u(t)");

    const xScale = (time) => pad.left + time * (width - pad.left - pad.right);
    const yScale = (control) => height - pad.bottom - (control - 0.875) / 0.125 * (height - pad.top - pad.bottom);

    drawControlCurve(ctx, xScale, yScale, delayWarmControl, COLORS.blue.replace(",1)", ",.72)"), 2.0, true);
    drawControlCurve(ctx, xScale, yScale, delayReferenceControl, COLORS.yellow.replace(",1)", ",.72)"), 1.8, true);
    drawControlCurve(ctx, xScale, yScale, delayProjectedControl, COLORS.orange, 2.7);

    const kinkX = xScale(delay.kink);
    ctx.save();
    ctx.setLineDash([5, 5]);
    ctx.strokeStyle = COLORS.purple.replace(",1)", ",.60)");
    ctx.beginPath();
    ctx.moveTo(kinkX, pad.top);
    ctx.lineTo(kinkX, height - pad.bottom);
    ctx.stroke();
    ctx.restore();

    ctx.fillStyle = COLORS.text;
    ctx.font = "bold 11px Inter,system-ui,sans-serif";
    ctx.fillText("Pointwise projection restores the delay-induced kink", pad.left, 18);
    ctx.fillStyle = COLORS.muted;
    ctx.font = "10px Inter,system-ui,sans-serif";
    ctx.fillText("the recurrent warm-up remains as the continuation policy", pad.left, 34);

    drawLegendLine(ctx, pad.left, 57, COLORS.blue, "LSTM", true);
    drawLegendLine(ctx, width * 0.47, 57, COLORS.orange, "PG-DPO");
    drawLegendLine(ctx, width - 112, 57, COLORS.yellow, "reference", true);

    ctx.fillStyle = COLORS.purple;
    ctx.font = "bold 9px Inter,system-ui,sans-serif";
    ctx.fillText("kink", kinkX + 6, pad.top + 14);
  }

  const delayWarmResidual = stageCounts.map((count) => 0.052 * Math.pow(count, -0.36) + 0.0022);
  const delayAdjointNumericalError = stageCounts.map((count) => 0.046 * Math.pow(count, -0.50) + 0.0014);
  const delayControlGap = stageCounts.map((count, index) => 0.72 * (delayWarmResidual[index] + delayAdjointNumericalError[index]));

  function drawDelayResidual() {
    const { ctx, width, height } = setupCanvas(delayEls.residual);
    if (!ctx || width < 2) return;
    drawBackground(ctx, width, height);
    const pad = { left: 48, right: 26, top: 62, bottom: 30 };
    drawGrid(ctx, width, height, pad, 4, 6);
    drawAxes(ctx, width, height, pad, "number of continuations", "");

    const xMax = stageCounts[stageCounts.length - 1];
    const xScale = (count) => pad.left + Math.log10(Math.max(1, count)) / Math.log10(xMax) * (width - pad.left - pad.right);
    const yScale = (value) => height - pad.bottom - (Math.log10(Math.max(5e-4, value)) + 3.3) / 2.1 * (height - pad.top - pad.bottom);

    ctx.fillStyle = COLORS.text;
    ctx.font = "bold 10px Inter,system-ui,sans-serif";
    ctx.fillText("short-slab control-gap bound", pad.left, 16);
    drawLegendLine(ctx, pad.left, 41, COLORS.blue, "warm FOC residual", true);
    drawLegendLine(ctx, Math.max(pad.left + 150, width * 0.43), 41, COLORS.purple, "adjoint + numerical");
    drawLegendLine(ctx, width - 124, 41, COLORS.orange, "control gap");

    drawSeries(ctx, delayWarmResidual, xScale, yScale, COLORS.blue, 1.8, true);
    drawSeries(ctx, delayAdjointNumericalError, xScale, yScale, COLORS.purple, 2.0);
    drawSeries(ctx, delayControlGap, xScale, yScale, COLORS.orange, 2.5);
  }

  function updateDelayCards() {
    const progress = recoveryProgress();
    if (delayEls.text.state) delayEls.text.state.textContent = `kink recovery ${Math.round(100 * progress)}% · current-time map`;
    if (delayEls.text.control) delayEls.text.control.textContent = `future FOC term at t+δu · MC branch ${currentPathCount(10)}/10`;
    if (delayEls.text.distributed) delayEls.text.distributed.textContent = `A(t) memory taps · adjoint samples ${currentPathCount(8)}/8`;
  }

  function drawDelay() {
    drawDelayRollout();
    drawDelayHistory();
    drawDelayAdjoint();
    drawDelayBridge();
    drawDelayRecovery();
    drawDelayResidual();
    updateDelayCards();
  }

  E.drawDelay = drawDelay;
})();
