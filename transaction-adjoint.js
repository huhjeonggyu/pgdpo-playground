(() => {
  "use strict";
  const E = window.PGExtended;
  if (!E) return;
  const { COLORS, clamp, lerp, easeOut, setupCanvas, drawBackground, drawGrid, drawAxes, drawArrow,
    stageCounts, state, transactionEls, stageContext, adjointProgress, roundedRect, drawLegendLine } = E;

  const tc = {
    alpha: 0.10,
    epsilon: 0.18,
    lower: 0.90,
    upper: 1.00,
    ratioMin: 0.80,
    ratioMax: 1.10,
  };

  const transactionQueries = [
    { id: "sell", label: "S", ratioStart: 0.875, ratioTrue: 0.850, color: COLORS.red, soft: COLORS.redSoft, phase: 0.35 },
    { id: "hold", label: "H", ratioStart: 0.980, ratioTrue: 0.955, color: COLORS.green, soft: COLORS.greenSoft, phase: 1.55 },
    { id: "buy", label: "B", ratioStart: 1.035, ratioTrue: 1.060, color: COLORS.orange, soft: COLORS.orangeSoft, phase: 2.65 },
  ];

  transactionQueries.forEach((query, queryIndex) => {
    query.stageRatios = [];
    stageCounts.forEach((count, index) => {
      const decay = Math.exp(-1.45 * Math.log10(count));
      const wiggle = index >= stageCounts.length - 2
        ? 0
        : 0.0035 * Math.exp(-0.38 * (index + 1)) * Math.sin(0.90 * (index + 1) + query.phase);
      query.stageRatios.push(
        query.ratioTrue + (query.ratioStart - query.ratioTrue) * decay + wiggle * (queryIndex === 1 ? 0.75 : 1)
      );
    });
    query.stageRatios[query.stageRatios.length - 1] = query.ratioTrue;
  });

  function projectedTrade(ratio) {
    if (ratio > tc.upper) return (ratio - tc.upper) / tc.epsilon;
    if (ratio < tc.lower) return (ratio - tc.lower) / tc.epsilon;
    return 0;
  }

  function transactionRegime(ratio) {
    if (ratio > tc.upper) return "buy";
    if (ratio < tc.lower) return "sell";
    return "hold";
  }

  function currentTransactionRatio(query) {
    const { completed, progress } = stageContext();
    if (completed <= 0) return lerp(query.ratioStart, query.stageRatios[0], progress);
    if (completed >= stageCounts.length) return query.ratioTrue;
    return lerp(query.stageRatios[completed - 1], query.stageRatios[completed], progress);
  }

  function transactionState(component, pathIndex, time) {
    const phase = 0.65 * pathIndex;
    if (component === "cash") {
      return 0.76 - 0.10 * time + 0.035 * Math.sin(6.2 * time + phase) + 0.018 * Math.sin(15.2 * time + 0.4 * phase);
    }
    if (component === "y1") {
      return 0.16 + 0.095 * time + 0.028 * Math.sin(5.5 * time + phase + 1.1) + 0.012 * Math.sin(14.8 * time + phase);
    }
    return 0.09 + 0.065 * time + 0.023 * Math.sin(5.0 * time + phase + 2.0) + 0.010 * Math.sin(13.0 * time + 0.7 * phase);
  }

  function drawTransactionRollout() {
    const { ctx, width, height } = setupCanvas(transactionEls.rollout);
    if (!ctx || width < 2) return;
    drawBackground(ctx, width, height);
    const pad = { left: 44, right: 16, top: 58, bottom: 28 };
    drawGrid(ctx, width, height, pad);
    drawAxes(ctx, width, height, pad, "time", "state component");

    const reveal = Math.max(1, Math.round(state.warmup * 80));
    const xScale = (time) => pad.left + time * (width - pad.left - pad.right);
    const yScale = (value) => height - pad.bottom - (value - 0.02) / 0.82 * (height - pad.top - pad.bottom);
    const components = [
      { id: "cash", label: "cash X", color: COLORS.blue },
      { id: "y1", label: "position Y₁", color: COLORS.orange },
      { id: "y2", label: "position Y₂", color: COLORS.purple },
    ];

    components.forEach((component, componentIndex) => {
      for (let pathIndex = 0; pathIndex < 6; pathIndex += 1) {
        ctx.beginPath();
        for (let step = 0; step <= reveal; step += 1) {
          const time = step / 80;
          const x = xScale(time);
          const y = yScale(transactionState(component.id, pathIndex, time));
          if (step === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        }
        ctx.strokeStyle = component.color.replace(",1)", `,${pathIndex === 0 ? 0.88 : 0.12 + 0.025 * componentIndex})`);
        ctx.lineWidth = pathIndex === 0 ? 2.1 : 1.0;
        ctx.stroke();
      }
    });

    const cursorX = xScale(reveal / 80);
    ctx.save();
    ctx.setLineDash([5, 5]);
    ctx.strokeStyle = "rgba(255,255,255,.24)";
    ctx.beginPath();
    ctx.moveTo(cursorX, pad.top);
    ctx.lineTo(cursorX, height - pad.bottom);
    ctx.stroke();
    ctx.restore();

    ctx.fillStyle = COLORS.text;
    ctx.font = "bold 11px Inter,system-ui,sans-serif";
    ctx.fillText("Roll out Z=(X,Y₁,Y₂) under the differentiable warm-up policy", pad.left, 17);
    ctx.fillStyle = COLORS.muted;
    ctx.font = "10px Inter,system-ui,sans-serif";
    ctx.fillText("The proportional-cost kink remains in the local action map, not in this rollout head.", pad.left, 33);

    let legendX = pad.left;
    components.forEach((component) => {
      drawLegendLine(ctx, legendX, height - 7, component.color, component.label);
      legendX += 118;
    });
  }

  function drawNetwork(ctx, originX, originY, width, height, progress) {
    const layerSizes = [3, 5, 3];
    const xPositions = [originX, originX + width * 0.50, originX + width];
    const yPositions = layerSizes.map((size) => Array.from(
      { length: size },
      (_, index) => originY + index * height / Math.max(1, size - 1)
    ));

    for (let layer = 0; layer < layerSizes.length - 1; layer += 1) {
      yPositions[layer].forEach((y0) => yPositions[layer + 1].forEach((y1) => {
        ctx.beginPath();
        ctx.moveTo(xPositions[layer], y0);
        ctx.lineTo(xPositions[layer + 1], y1);
        ctx.strokeStyle = `rgba(143,216,255,${0.08 + 0.20 * progress})`;
        ctx.lineWidth = 1;
        ctx.stroke();
      }));
    }

    yPositions.forEach((layer, layerIndex) => layer.forEach((y) => {
      ctx.beginPath();
      ctx.fillStyle = layerIndex === 1 ? "rgba(255,176,122,.78)" : "rgba(143,216,255,.82)";
      ctx.arc(xPositions[layerIndex], y, 5.8, 0, Math.PI * 2);
      ctx.fill();
    }));
  }

  function drawTransactionPolicy() {
    const { ctx, width, height } = setupCanvas(transactionEls.policy);
    if (!ctx || width < 2) return;
    drawBackground(ctx, width, height);
    const p = easeOut(state.warmup);

    ctx.fillStyle = COLORS.text;
    ctx.font = "bold 11px Inter,system-ui,sans-serif";
    ctx.fillText("Warm-up policy = continuation generator", 12, 18);
    ctx.fillStyle = COLORS.muted;
    ctx.font = "10px Inter,system-ui,sans-serif";
    ctx.fillText("freeze uθ*, branch from a query state, and differentiate terminal utility", 12, 34);

    drawNetwork(ctx, 38, 62, width * 0.27, height - 92, p);
    ctx.fillStyle = COLORS.blue;
    ctx.font = "bold 10px Inter,system-ui,sans-serif";
    ctx.fillText("uθ*(t,X,Y)", 31, height - 13);

    const queryX = width * 0.46;
    const queryY = height * 0.53;
    roundedRect(ctx, queryX - 42, queryY - 20, 84, 40, 10, "rgba(255,228,141,.08)", "rgba(255,228,141,.34)");
    ctx.fillStyle = COLORS.yellow;
    ctx.font = "bold 10px Inter,system-ui,sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("query q=(t,x,y)", queryX, queryY + 3);
    ctx.textAlign = "left";
    drawArrow(ctx, width * 0.34, queryY, queryX - 48, queryY, COLORS.yellowSoft, 1.8);

    const rightStart = width * 0.59;
    const rightEnd = width - 24;
    const fanCount = 7;
    for (let branch = 0; branch < fanCount; branch += 1) {
      const terminalY = 54 + branch * (height - 96) / Math.max(1, fanCount - 1);
      const control = p * (0.55 + 0.45 * branch / fanCount);
      const endX = lerp(rightStart, rightEnd, control);
      ctx.beginPath();
      ctx.moveTo(queryX + 45, queryY);
      ctx.quadraticCurveTo((queryX + rightEnd) / 2, queryY + (terminalY - queryY) * 0.35, endX, terminalY);
      ctx.strokeStyle = `rgba(148,240,193,${0.16 + 0.08 * branch})`;
      ctx.lineWidth = branch < 2 ? 1.8 : 1.1;
      ctx.stroke();
      if (control > 0.95) {
        ctx.beginPath();
        ctx.fillStyle = COLORS.green.replace(",1)", `,${0.35 + 0.06 * branch})`);
        ctx.arc(rightEnd, terminalY, 3.2, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.fillStyle = COLORS.green;
    ctx.font = "bold 10px Inter,system-ui,sans-serif";
    ctx.fillText("continuation rollouts", rightStart + 5, 18);
    ctx.fillStyle = COLORS.muted;
    ctx.fillText("BPTT inputs", rightStart + 36, height - 12);
  }

  function transactionCostateBase(kind, time) {
    if (kind === "cash") return 1.22 - 0.36 * time + 0.035 * Math.sin(5.1 * time);
    return 1.16 - 0.35 * time + 0.032 * Math.sin(5.4 * time + 0.5);
  }

  function transactionCostateSample(kind, sample, time) {
    const base = transactionCostateBase(kind, time);
    const phase = 0.78 * sample + (kind === "cash" ? 0.2 : 1.1);
    const amplitude = (kind === "cash" ? 0.028 : 0.031) + 0.004 * (sample % 4);
    const secondary = kind === "cash" ? 0.009 : 0.011;
    return base
      + amplitude * Math.sin(7.7 * time + phase) * (1 - 0.28 * time)
      + secondary * Math.sin(17.0 * time + 1.4 * phase) * (0.82 - 0.20 * time)
      + (sample - 3.5) * 0.0035 * (1 - 0.35 * time);
  }

  function transactionSampleProgress(maxSamples) {
    const total = adjointProgress() * maxSamples;
    const deposited = Math.min(maxSamples, Math.floor(total + 1e-9));
    const active = deposited < maxSamples ? total - deposited : 0;
    const meanAlpha = clamp((total - 1.2) / 2.8, 0, 1);
    return { deposited, active, meanAlpha };
  }

  function strokeTransactionCostate(ctx, xScale, yScale, kind, sample, startTime, endTime, color, alpha, width, glow = false) {
    const steps = 90;
    const from = Math.round(startTime * steps);
    const to = Math.round(endTime * steps);
    const direction = from <= to ? 1 : -1;
    ctx.save();
    if (glow) {
      ctx.shadowBlur = 17;
      ctx.shadowColor = color.replace(",1)", ",.95)");
    }
    ctx.beginPath();
    let first = true;
    for (let step = from; direction > 0 ? step <= to : step >= to; step += direction) {
      const time = step / steps;
      const x = xScale(time);
      const y = yScale(transactionCostateSample(kind, sample, time));
      if (first) { ctx.moveTo(x, y); first = false; } else ctx.lineTo(x, y);
    }
    ctx.strokeStyle = color.replace(",1)", `,${alpha})`);
    ctx.lineWidth = width;
    ctx.stroke();
    ctx.restore();

    if (glow) {
      const frontX = xScale(endTime);
      const frontY = yScale(transactionCostateSample(kind, sample, endTime));
      const pulse = 0.5 + 0.5 * Math.sin(performance.now() * 0.012 + sample);
      ctx.save();
      ctx.shadowBlur = 14;
      ctx.shadowColor = COLORS.yellow;
      ctx.beginPath();
      ctx.fillStyle = COLORS.yellow.replace(",1)", `,${0.78 + 0.18 * pulse})`);
      ctx.arc(frontX, frontY, 3.5 + 1.1 * pulse, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  function drawTransactionAdjointHalf(ctx, area, kind, color, progressInfo) {
    const xScale = (time) => area.left + time * area.width;
    const min = kind === "cash" ? 0.78 : 0.73;
    const max = kind === "cash" ? 1.31 : 1.27;
    const yScale = (value) => area.top + area.height - (value - min) / (max - min) * area.height;

    ctx.strokeStyle = "rgba(255,255,255,.07)";
    for (let row = 0; row <= 3; row += 1) {
      const y = area.top + row * area.height / 3;
      ctx.beginPath();
      ctx.moveTo(area.left, y);
      ctx.lineTo(area.left + area.width, y);
      ctx.stroke();
    }

    for (let sample = 0; sample < progressInfo.deposited; sample += 1) {
      strokeTransactionCostate(ctx, xScale, yScale, kind, sample, 1, 0, color, 0.28, sample < 2 ? 1.35 : 1.0);
    }
    if (progressInfo.active > 0.005 && progressInfo.deposited < 8) {
      const front = 1 - progressInfo.active;
      strokeTransactionCostate(ctx, xScale, yScale, kind, progressInfo.deposited, 1, front, color, 0.96, 2.5, true);
    }

    if (progressInfo.meanAlpha > 0.005) {
      ctx.beginPath();
      for (let step = 0; step <= 90; step += 1) {
        const time = step / 90;
        const x = xScale(time);
        const y = yScale(transactionCostateBase(kind, time));
        if (step === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.strokeStyle = COLORS.yellow.replace(",1)", `,${0.18 + 0.78 * progressInfo.meanAlpha})`);
      ctx.lineWidth = 1.6 + 0.8 * progressInfo.meanAlpha;
      ctx.stroke();
    }

    ctx.fillStyle = color;
    ctx.font = "bold 10px Inter,system-ui,sans-serif";
    ctx.fillText(kind === "cash" ? "λₓ(t): cash costate" : "λᵧ(t): position costate", area.left + 5, area.top + 13);
  }

  function drawTransactionAdjoint() {
    const { ctx, width, height } = setupCanvas(transactionEls.adjoint);
    if (!ctx || width < 2) return;
    drawBackground(ctx, width, height);

    const left = 46;
    const right = 16;
    const top = 34;
    const bottom = 26;
    const gap = 16;
    const halfHeight = (height - top - bottom - gap) / 2;
    const progressInfo = transactionSampleProgress(8);

    ctx.fillStyle = COLORS.text;
    ctx.font = "bold 11px Inter,system-ui,sans-serif";
    ctx.fillText("Each continuation contributes one pathwise costate sample", left, 16);
    ctx.fillStyle = COLORS.yellow;
    ctx.font = "bold 9px Inter,system-ui,sans-serif";
    ctx.textAlign = "right";
    ctx.fillText("BPTT backward:  query time  ←  T", width - right, 31);
    ctx.textAlign = "left";

    drawTransactionAdjointHalf(ctx, { left, top, width: width - left - right, height: halfHeight }, "cash", COLORS.blue, progressInfo);
    drawTransactionAdjointHalf(ctx, { left, top: top + halfHeight + gap, width: width - left - right, height: halfHeight }, "position", COLORS.orange, progressInfo);

    ctx.fillStyle = COLORS.muted;
    ctx.font = "9px Inter,system-ui,sans-serif";
    ctx.fillText("query time", left - 4, height - 7);
    ctx.textAlign = "right";
    ctx.fillText("T", width - right, height - 7);
    ctx.textAlign = "left";
  }

  E.transaction = {
    tc, transactionQueries, projectedTrade, transactionRegime, currentTransactionRatio,
    transactionSampleProgress, drawTransactionRollout, drawTransactionPolicy, drawTransactionAdjoint,
  };
})();
