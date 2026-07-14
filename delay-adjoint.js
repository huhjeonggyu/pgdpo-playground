(() => {
  "use strict";
  const E = window.PGExtended;
  if (!E?.transaction) return;
  const { COLORS, clamp, lerp, easeOut, setupCanvas, drawBackground, drawGrid, drawAxes, drawArrow,
    state, delayEls, roundedRect } = E;
  const { transactionSampleProgress } = E.transaction;

  const delay = {
    delta: 0.28,
    kink: 0.61,
  };

  function delayPath(pathIndex, time) {
    const phase = 0.52 * pathIndex;
    const delayedWave = time > delay.delta
      ? 0.045 * Math.sin(7.4 * (time - delay.delta) + 0.4 * phase)
      : 0;
    return 0.94
      + 0.10 * time
      + 0.055 * Math.sin(5.3 * time + phase) * Math.sqrt(time + 0.04)
      + 0.022 * Math.sin(14.2 * time + 0.7 * phase)
      + delayedWave;
  }

  function drawDelayRollout() {
    const { ctx, width, height } = setupCanvas(delayEls.rollout);
    if (!ctx || width < 2) return;
    drawBackground(ctx, width, height);
    const pad = { left: 44, right: 16, top: 56, bottom: 30 };
    drawGrid(ctx, width, height, pad);
    drawAxes(ctx, width, height, pad, "time", "state X");

    const revealTime = clamp(state.warmup, 0, 1);
    const revealStep = Math.max(1, Math.round(90 * revealTime));
    const xScale = (time) => pad.left + time * (width - pad.left - pad.right);
    const allValues = [];
    for (let pathIndex = 0; pathIndex < 12; pathIndex += 1) {
      for (let step = 0; step <= 90; step += 1) allValues.push(delayPath(pathIndex, step / 90));
    }
    const min = Math.min(...allValues) - 0.02;
    const max = Math.max(...allValues) + 0.02;
    const yScale = (value) => height - pad.bottom - (value - min) / (max - min) * (height - pad.top - pad.bottom);

    for (let pathIndex = 0; pathIndex < 12; pathIndex += 1) {
      ctx.beginPath();
      for (let step = 0; step <= revealStep; step += 1) {
        const time = step / 90;
        const x = xScale(time);
        const y = yScale(delayPath(pathIndex, time));
        if (step === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.strokeStyle = pathIndex === 0 ? COLORS.blue : `rgba(148,240,193,${0.11 + 0.012 * (pathIndex % 4)})`;
      ctx.lineWidth = pathIndex === 0 ? 2.4 : 1.05;
      ctx.stroke();
    }

    const currentTime = revealStep / 90;
    const historyStart = Math.max(0, currentTime - delay.delta);
    const startX = xScale(historyStart);
    const currentX = xScale(currentTime);
    ctx.fillStyle = "rgba(255,228,141,.08)";
    ctx.fillRect(startX, pad.top, Math.max(1, currentX - startX), height - pad.top - pad.bottom);

    ctx.save();
    ctx.setLineDash([5, 5]);
    ctx.strokeStyle = COLORS.yellow.replace(",1)", ",.62)");
    [startX, currentX].forEach((x) => {
      ctx.beginPath();
      ctx.moveTo(x, pad.top);
      ctx.lineTo(x, height - pad.bottom);
      ctx.stroke();
    });
    ctx.restore();

    ctx.fillStyle = COLORS.text;
    ctx.font = "bold 11px Inter,system-ui,sans-serif";
    ctx.fillText("The controller reads a trajectory segment, not only X(t)", pad.left, 17);
    ctx.fillStyle = COLORS.yellow;
    ctx.font = "10px Inter,system-ui,sans-serif";
    ctx.fillText(`history window Hₜ=[t−δ,t],  δ=${delay.delta.toFixed(2)}`, pad.left, 32);

    ctx.fillStyle = COLORS.muted;
    ctx.font = "9px Inter,system-ui,sans-serif";
    ctx.fillText("t−δ", startX - 10, height - 8);
    ctx.fillText("t", currentX - 2, height - 8);
  }

  function drawDelayHistory() {
    const { ctx, width, height } = setupCanvas(delayEls.history);
    if (!ctx || width < 2) return;
    drawBackground(ctx, width, height);
    const progress = easeOut(state.warmup);

    ctx.fillStyle = COLORS.text;
    ctx.font = "bold 11px Inter,system-ui,sans-serif";
    ctx.fillText("LSTM warm-up encodes the available history", 12, 18);
    ctx.fillStyle = COLORS.muted;
    ctx.font = "10px Inter,system-ui,sans-serif";
    ctx.fillText("point delay, distributed memory, and recurrent hidden state share one policy head", 12, 34);

    const left = 30;
    const right = width - 30;
    const y = height * 0.62;
    const tapCount = 7;
    const tapSpacing = width * 0.045;
    const historyEnd = left + tapSpacing * (tapCount - 1);
    for (let index = 0; index < tapCount; index += 1) {
      const x = left + index * tapSpacing;
      ctx.beginPath();
      ctx.fillStyle = index === 0 ? COLORS.purple : COLORS.blue.replace(",1)", `,${0.32 + 0.07 * index})`);
      ctx.arc(x, y + 8 * Math.sin(index * 0.8), 4.8, 0, Math.PI * 2);
      ctx.fill();
      if (index > 0) {
        ctx.strokeStyle = "rgba(143,216,255,.26)";
        ctx.beginPath();
        ctx.moveTo(x - tapSpacing + 5, y + 8 * Math.sin((index - 1) * 0.8));
        ctx.lineTo(x - 5, y + 8 * Math.sin(index * 0.8));
        ctx.stroke();
      }
    }
    ctx.fillStyle = COLORS.muted;
    ctx.font = "9px Inter,system-ui,sans-serif";
    ctx.fillText("X(t−δ)", left - 11, y + 30);
    ctx.fillText("X(t)", historyEnd - 7, y + 30);

    const lstmX = width * 0.47;
    const lstmY = height * 0.56;
    roundedRect(ctx, lstmX - 52, lstmY - 30, 104, 60, 13, "rgba(255,176,122,.08)", "rgba(255,176,122,.42)");
    ctx.fillStyle = COLORS.orange;
    ctx.font = "bold 12px Inter,system-ui,sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("LSTM / hₜ", lstmX, lstmY + 4);
    ctx.textAlign = "left";
    drawArrow(ctx, historyEnd + 10, y, lstmX - 60, lstmY, COLORS.orangeSoft, 2.0);

    const summaries = [
      { label: "Y(t)=X(t−δ)", color: COLORS.purple, y: 55 },
      { label: "A(t)=∫ memory", color: COLORS.green, y: 88 },
    ];
    summaries.forEach((item) => {
      const x0 = width * 0.62;
      const targetX = width * 0.78;
      const endX = lerp(x0, targetX, progress);
      ctx.strokeStyle = item.color.replace(",1)", ",.74)");
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(x0, item.y);
      ctx.lineTo(endX, item.y);
      ctx.stroke();
      ctx.beginPath();
      ctx.fillStyle = item.color;
      ctx.arc(endX, item.y, 4.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = item.color;
      ctx.font = "bold 9px Inter,system-ui,sans-serif";
      ctx.fillText(item.label, x0, item.y - 8);
    });

    const controlX = width - 54;
    const controlY = height * 0.58;
    roundedRect(ctx, controlX - 34, controlY - 23, 68, 46, 12, "rgba(148,240,193,.08)", "rgba(148,240,193,.42)");
    ctx.fillStyle = COLORS.green;
    ctx.font = "bold 11px Inter,system-ui,sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("uθ(t)", controlX, controlY + 4);
    ctx.textAlign = "left";
    drawArrow(ctx, lstmX + 58, lstmY, controlX - 40, controlY, COLORS.greenSoft, 2.0);
  }

  function delayAdjointBase(time) {
    const anticipation = time < 0.72 ? 0.05 * Math.sin(8.5 * (time + delay.delta)) : 0;
    return 1.30 - 0.46 * time + 0.045 * Math.sin(4.8 * time) + anticipation;
  }

  function delayAdjointSample(sample, time) {
    const phase = 0.72 * sample + 0.25;
    return delayAdjointBase(time)
      + (0.027 + 0.004 * (sample % 4)) * Math.sin(7.9 * time + phase) * (1 - 0.27 * time)
      + (0.010 + 0.002 * (sample % 3)) * Math.sin(18.2 * time + 1.3 * phase) * (0.84 - 0.23 * time)
      + (sample - 3.5) * 0.0037 * (1 - 0.35 * time);
  }

  function strokeDelayAdjoint(ctx, xScale, yScale, sample, startTime, endTime, alpha, width, glow = false) {
    const steps = 100;
    const from = Math.round(startTime * steps);
    const to = Math.round(endTime * steps);
    const direction = from <= to ? 1 : -1;
    ctx.save();
    if (glow) {
      ctx.shadowBlur = 17;
      ctx.shadowColor = COLORS.orange.replace(",1)", ",.95)");
    }
    ctx.beginPath();
    let first = true;
    for (let step = from; direction > 0 ? step <= to : step >= to; step += direction) {
      const time = step / steps;
      const x = xScale(time);
      const y = yScale(delayAdjointSample(sample, time));
      if (first) { ctx.moveTo(x, y); first = false; } else ctx.lineTo(x, y);
    }
    ctx.strokeStyle = COLORS.orange.replace(",1)", `,${alpha})`);
    ctx.lineWidth = width;
    ctx.stroke();
    ctx.restore();

    if (glow) {
      const x = xScale(endTime);
      const y = yScale(delayAdjointSample(sample, endTime));
      const pulse = 0.5 + 0.5 * Math.sin(performance.now() * 0.012);
      ctx.save();
      ctx.shadowBlur = 14;
      ctx.shadowColor = COLORS.yellow;
      ctx.beginPath();
      ctx.fillStyle = COLORS.yellow.replace(",1)", `,${0.78 + 0.18 * pulse})`);
      ctx.arc(x, y, 3.5 + 1.1 * pulse, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  function drawAnticipatedArc(ctx, xScale, yScale, time, progress) {
    const future = Math.min(1, time + delay.delta);
    const x0 = xScale(future);
    const y0 = yScale(delayAdjointBase(future));
    const x1 = xScale(time);
    const y1 = yScale(delayAdjointBase(time));
    const controlY = Math.min(y0, y1) - 22 - 7 * Math.sin(time * 11);
    ctx.save();
    ctx.strokeStyle = COLORS.purple.replace(",1)", `,${0.18 + 0.52 * progress})`);
    ctx.lineWidth = 1.4;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.quadraticCurveTo((x0 + x1) / 2, controlY, x1, y1);
    ctx.stroke();
    ctx.setLineDash([]);
    const angle = Math.atan2(y1 - controlY, x1 - (x0 + x1) / 2);
    ctx.fillStyle = COLORS.purple.replace(",1)", `,${0.25 + 0.65 * progress})`);
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x1 - 7 * Math.cos(angle - Math.PI / 6), y1 - 7 * Math.sin(angle - Math.PI / 6));
    ctx.lineTo(x1 - 7 * Math.cos(angle + Math.PI / 6), y1 - 7 * Math.sin(angle + Math.PI / 6));
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  function drawDelayAdjoint() {
    const { ctx, width, height } = setupCanvas(delayEls.adjoint);
    if (!ctx || width < 2) return;
    drawBackground(ctx, width, height);
    const pad = { left: 48, right: 18, top: 46, bottom: 32 };
    drawGrid(ctx, width, height, pad);
    drawAxes(ctx, width, height, pad, "time", "delay costate λ(t)");

    const xScale = (time) => pad.left + time * (width - pad.left - pad.right);
    const yScale = (value) => height - pad.bottom - (value - 0.75) / 0.66 * (height - pad.top - pad.bottom);
    const progressInfo = transactionSampleProgress(8);

    for (let sample = 0; sample < progressInfo.deposited; sample += 1) {
      strokeDelayAdjoint(ctx, xScale, yScale, sample, 1, 0, 0.28, sample < 2 ? 1.35 : 1.0);
    }
    if (progressInfo.active > 0.005 && progressInfo.deposited < 8) {
      const front = 1 - progressInfo.active;
      strokeDelayAdjoint(ctx, xScale, yScale, progressInfo.deposited, 1, front, 0.96, 2.6, true);
    }

    if (progressInfo.meanAlpha > 0.005) {
      ctx.beginPath();
      for (let step = 0; step <= 100; step += 1) {
        const time = step / 100;
        const x = xScale(time);
        const y = yScale(delayAdjointBase(time));
        if (step === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.strokeStyle = COLORS.yellow.replace(",1)", `,${0.18 + 0.78 * progressInfo.meanAlpha})`);
      ctx.lineWidth = 1.6 + 0.8 * progressInfo.meanAlpha;
      ctx.stroke();
    }

    [0.12, 0.30, 0.48, 0.66].forEach((time) => drawAnticipatedArc(ctx, xScale, yScale, time, progressInfo.meanAlpha));

    ctx.fillStyle = COLORS.text;
    ctx.font = "bold 11px Inter,system-ui,sans-serif";
    ctx.fillText("Present states re-enter future drift and cost through t+δ", pad.left, 18);
    ctx.fillStyle = COLORS.purple;
    ctx.font = "10px Inter,system-ui,sans-serif";
    ctx.fillText("anticipated contribution", pad.left, 34);
    ctx.fillStyle = COLORS.yellow;
    ctx.textAlign = "right";
    ctx.font = "bold 9px Inter,system-ui,sans-serif";
    ctx.fillText("BPTT backward:  t  ←  T", width - pad.right, 34);
    ctx.textAlign = "left";
  }

  E.delay = { delay, delayAdjointBase, drawDelayRollout, drawDelayHistory, drawDelayAdjoint };
})();
