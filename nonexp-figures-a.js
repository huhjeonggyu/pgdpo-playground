(() => {
  "use strict";
  const D = window.PGDemo;
  if (!D) return;

  const {
    stageCounts,
    COLORS,
    state,
    clamp,
    lerp,
    easeOut,
    setupCanvas,
    drawBackground,
    drawGrid,
    drawAxes,
    drawArrow,
    stageContext,
    recoveryProgress,
    drawProgressSeries,
  } = D;

  const els = {
    kernel: document.getElementById("nonexpKernelCanvas"),
    anchor: document.getElementById("nonexpAnchorCanvas"),
    adjoint: document.getElementById("nonexpAdjointCanvas"),
    diagonal: document.getElementById("nonexpDiagonalCanvas"),
    recovery: document.getElementById("nonexpRecoveryCanvas"),
    residual: document.getElementById("nonexpResidualCanvas"),
    text: {
      early: document.getElementById("nonexpEarlyText"),
      middle: document.getElementById("nonexpMiddleText"),
      late: document.getElementById("nonexpLateText"),
    },
  };

  const panels = Array.from(document.querySelectorAll('[data-paper-panel="nonexp"]'));
  const titles = ["Decision-time anchoring", "Anchored adjoints → diagonal", "Local Hamiltonian correction"];
  const captions = [
    "Each decision time evaluates the remaining horizon with its own kernel. Stage 1 samples and optimizes these anchored continuation problems.",
    "Each terminal-to-anchor BPTT sweep deposits a pathwise costate sample. Monte Carlo means emerge, and local synthesis uses the diagonal anchor t₀=t.",
    "At each query time, the warm-up action moves to the maximizer of the Hamiltonian anchored at that same time.",
  ];
  panels.forEach((panel, index) => {
    const title = panel.querySelector("h2");
    const caption = panel.querySelector(".caption");
    if (title && titles[index]) title.textContent = titles[index];
    if (caption && captions[index]) caption.textContent = captions[index];
  });
  document.querySelectorAll('[data-paper-panel="nonexp"] .status-badge').forEach((badge) => {
    badge.textContent = "t₀=t";
  });

  const queries = [
    { id: "early", name: "Early", label: "E", t: 0.18, warm: 1.02, target: 1.34, color: COLORS.blue, soft: COLORS.blueSoft, startAnchor: 0.04 },
    { id: "middle", name: "Middle", label: "M", t: 0.50, warm: 1.30, target: 1.18, color: COLORS.orange, soft: COLORS.orangeSoft, startAnchor: 0.20 },
    { id: "late", name: "Late", label: "L", t: 0.82, warm: 1.12, target: 0.88, color: COLORS.purple, soft: COLORS.purpleSoft, startAnchor: 0.46 },
  ];

  function kappa(anchor) {
    return 1.8 + 1.4 * anchor;
  }

  function kernel(anchor, time) {
    return time < anchor ? 1 : 1 / (1 + kappa(anchor) * (time - anchor));
  }

  function star(ctx, x, y, radius, color) {
    ctx.save();
    ctx.beginPath();
    for (let index = 0; index < 10; index += 1) {
      const angle = -Math.PI / 2 + index * Math.PI / 5;
      const r = index % 2 === 0 ? radius : radius * 0.45;
      const px = x + r * Math.cos(angle);
      const py = y + r * Math.sin(angle);
      if (index === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.shadowBlur = 10;
    ctx.shadowColor = color;
    ctx.fill();
    ctx.restore();
  }

  function drawKernel() {
    const { ctx, width, height } = setupCanvas(els.kernel);
    if (!ctx || width < 2) return;
    drawBackground(ctx, width, height);
    const left = 70;
    const right = width - 30;
    const top = 56;
    const bottom = height - 34;
    const reveal = easeOut(state.warmup);
    const xScale = (time) => left + time * (right - left);
    const rowGap = (bottom - top) / 3;

    ctx.fillStyle = COLORS.text;
    ctx.font = "bold 11px Inter,system-ui,sans-serif";
    ctx.fillText("Same future payoff, different decision-time weights", 16, 18);
    ctx.fillStyle = COLORS.yellow;
    ctx.font = "10px Inter,system-ui,sans-serif";
    ctx.fillText("Re-anchor the continuation objective at every t₀", 16, 35);

    queries.forEach((query, index) => {
      const y = top + (index + 0.45) * rowGap;
      const anchorX = xScale(query.t);
      const endX = lerp(anchorX, right, reveal);
      ctx.strokeStyle = "rgba(255,255,255,.10)";
      ctx.beginPath();
      ctx.moveTo(left, y);
      ctx.lineTo(right, y);
      ctx.stroke();
      ctx.strokeStyle = query.color;
      ctx.lineWidth = 2.3;
      ctx.beginPath();
      ctx.moveTo(anchorX, y);
      ctx.lineTo(endX, y);
      ctx.stroke();

      for (let step = 0; step <= 10; step += 1) {
        const time = query.t + step / 10 * (1 - query.t);
        const x = xScale(time);
        if (x > endX + 1) continue;
        const weight = kernel(query.t, time);
        ctx.fillStyle = query.color.replace(",1)", `,${0.18 + 0.70 * weight})`);
        ctx.fillRect(x - 1.7, y - 10, 3.4, 20);
      }

      ctx.beginPath();
      ctx.fillStyle = query.color;
      ctx.arc(anchorX, y, 5.5, 0, Math.PI * 2);
      ctx.fill();
      star(ctx, right, y, 7.3, COLORS.yellow);
      ctx.fillStyle = COLORS.text;
      ctx.font = "bold 10px Inter,system-ui,sans-serif";
      ctx.fillText(`${query.name} self · t₀=${query.t.toFixed(2)}`, 12, y + 4);
      ctx.fillStyle = query.color;
      ctx.fillText(`D(t₀,T)=${kernel(query.t, 1).toFixed(2)}`, Math.min(right - 92, anchorX + 28), y - 15);
    });

    const early = queries[0].t;
    const middle = queries[1].t;
    const carried = kernel(early, 1) / kernel(early, middle);
    const reanchored = kernel(middle, 1);
    ctx.fillStyle = "rgba(255,255,255,.035)";
    ctx.fillRect(14, height - 32, width - 28, 22);
    ctx.fillStyle = COLORS.muted;
    ctx.font = "10px Inter,system-ui,sans-serif";
    ctx.fillText(`carried-forward ${carried.toFixed(2)} ≠ re-anchored ${reanchored.toFixed(2)} → continuation problem changes`, 22, height - 17);
  }

  function drawAnchor() {
    const { ctx, width, height } = setupCanvas(els.anchor);
    if (!ctx || width < 2) return;
    drawBackground(ctx, width, height);
    const left = 54;
    const right = width - 24;
    const progress = easeOut(state.warmup);
    const rowGap = (height - 66) / 3;

    ctx.fillStyle = COLORS.text;
    ctx.font = "bold 11px Inter,system-ui,sans-serif";
    ctx.fillText("Stage 1 samples anchored continuation problems", 12, 18);
    ctx.fillStyle = COLORS.muted;
    ctx.font = "10px Inter,system-ui,sans-serif";
    ctx.fillText("simulate from t₀ to T, weight by D(t₀,·), then backpropagate", 12, 34);

    queries.forEach((query, row) => {
      const y0 = 58 + row * rowGap;
      const anchorX = lerp(left, right, query.t);
      const stop = lerp(anchorX, right, progress);
      ctx.strokeStyle = "rgba(255,255,255,.10)";
      ctx.beginPath();
      ctx.moveTo(left, y0);
      ctx.lineTo(right, y0);
      ctx.stroke();
      ctx.beginPath();
      for (let step = 0; step <= 80; step += 1) {
        const time = query.t + (1 - query.t) * step / 80;
        const x = lerp(left, right, time);
        if (x > stop + 1) break;
        const local = (time - query.t) / (1 - query.t);
        const y = y0 - 7 - 12 * Math.sin(Math.PI * local) + 5 * Math.sin(5 * Math.PI * local + row);
        if (step === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.strokeStyle = query.color;
      ctx.lineWidth = 2.1;
      ctx.stroke();
      ctx.beginPath();
      ctx.fillStyle = query.color;
      ctx.arc(anchorX, y0, 5.3, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = COLORS.text;
      ctx.font = "bold 10px Inter,system-ui,sans-serif";
      ctx.fillText(`J(t₀=${query.t.toFixed(2)},x;u)`, anchorX + 8, y0 - 12);
    });
  }

  function costateMean(anchor, time) {
    if (time < anchor) return NaN;
    const local = (time - anchor) / Math.max(1e-6, 1 - anchor);
    return 1.30 - 0.42 * local + 0.10 * anchor + 0.035 * Math.sin(4.8 * local + 1.2 * anchor);
  }

  function costateSample(query, queryIndex, sample, time) {
    if (time < query.t) return NaN;
    const local = (time - query.t) / Math.max(1e-6, 1 - query.t);
    const phase = 0.83 * sample + 0.55 * queryIndex;
    return costateMean(query.t, time)
      + (0.024 + 0.005 * (sample % 3)) * Math.sin(7.8 * local + phase) * (1 - 0.24 * local)
      + (0.009 + 0.0024 * ((sample + queryIndex) % 2)) * Math.sin(18.6 * local + 1.41 * sample + 0.86 * queryIndex) * (0.88 - 0.23 * local)
      + (sample - 2) * 0.0052 * (1 - 0.35 * local);
  }

  function sampleProgress(maxSamples) {
    const { completed, progress } = stageContext();
    const total = clamp((completed + progress) / stageCounts.length, 0, 1) * maxSamples;
    return {
      deposited: Math.min(maxSamples, Math.floor(total + 1e-9)),
      active: Math.floor(total) < maxSamples ? total - Math.floor(total) : 0,
      meanAlpha: clamp((total - 1.0) / 2.5, 0, 1),
    };
  }

  function drawCostatePath(ctx, xScale, yScale, query, queryIndex, sample, start, end, alpha, lineWidth, glow = false) {
    const steps = 90;
    const from = Math.round(start * steps);
    const to = Math.round(end * steps);
    const direction = from <= to ? 1 : -1;
    ctx.save();
    if (glow) {
      ctx.shadowBlur = 17;
      ctx.shadowColor = query.color.replace(",1)", ",.95)");
    }
    ctx.beginPath();
    let first = true;
    for (let step = from; direction > 0 ? step <= to : step >= to; step += direction) {
      const time = step / steps;
      if (time < query.t) continue;
      const x = xScale(time);
      const y = yScale(costateSample(query, queryIndex, sample, time));
      if (first) { ctx.moveTo(x, y); first = false; } else ctx.lineTo(x, y);
    }
    ctx.strokeStyle = query.color.replace(",1)", `,${alpha})`);
    ctx.lineWidth = lineWidth;
    ctx.stroke();
    ctx.restore();
  }

  function drawAdjoint() {
    const { ctx, width, height } = setupCanvas(els.adjoint);
    if (!ctx || width < 2) return;
    drawBackground(ctx, width, height);
    const pad = { left: 44, right: 18, top: 35, bottom: 30 };
    drawGrid(ctx, width, height, pad);
    drawAxes(ctx, width, height, pad, "time", "anchored costate λᵗ⁰(t)");
    const xScale = (time) => pad.left + time * (width - pad.left - pad.right);
    const yScale = (v) => height - pad.bottom - (v - 0.78) / 0.64 * (height - pad.top - pad.bottom);
    const progressInfo = sampleProgress(5);

    queries.forEach((query, queryIndex) => {
      for (let sample = 0; sample < progressInfo.deposited; sample += 1) {
        drawCostatePath(ctx, xScale, yScale, query, queryIndex, sample, query.t, 1, 0.34, sample < 2 ? 1.35 : 1.05);
      }
      if (progressInfo.active > 0.005 && progressInfo.deposited < 5) {
        const front = 1 - progressInfo.active * (1 - query.t);
        drawCostatePath(ctx, xScale, yScale, query, queryIndex, progressInfo.deposited, 1, front, 0.94, 2.45, true);
      }
      if (progressInfo.meanAlpha > 0.005) {
        ctx.beginPath();
        let started = false;
        for (let step = 0; step <= 90; step += 1) {
          const time = step / 90;
          if (time < query.t) continue;
          const x = xScale(time);
          const y = yScale(costateMean(query.t, time));
          if (!started) { ctx.moveTo(x, y); started = true; } else ctx.lineTo(x, y);
        }
        ctx.strokeStyle = query.color.replace(",1)", `,${0.18 + 0.82 * progressInfo.meanAlpha})`);
        ctx.lineWidth = 1.7 + 0.7 * progressInfo.meanAlpha;
        ctx.stroke();
      }
      const x = xScale(query.t);
      const y = yScale(costateMean(query.t, query.t));
      ctx.beginPath();
      ctx.fillStyle = query.color;
      ctx.arc(x, y, 4.8, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = query.color;
      ctx.font = "bold 10px Inter,system-ui,sans-serif";
      ctx.fillText(`${query.label}: t₀=${query.t.toFixed(2)}`, x + 7, y - 8);
    });

    ctx.fillStyle = COLORS.yellow;
    ctx.font = "bold 9px Inter,system-ui,sans-serif";
    ctx.textAlign = "right";
    ctx.fillText("BPTT: t₀ ← T", width - pad.right, 19);
    ctx.textAlign = "left";
  }

  window.PGNonexpMode = {
    D, stageCounts, COLORS, state, clamp, lerp, easeOut, setupCanvas, drawBackground, drawGrid, drawAxes, drawArrow,
    stageContext, recoveryProgress, drawProgressSeries, els, queries, drawKernel, drawAnchor, drawAdjoint,
  };
})();
