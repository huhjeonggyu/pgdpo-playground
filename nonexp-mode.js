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

  const nonexpPanels = Array.from(document.querySelectorAll('[data-paper-panel="nonexp"]'));
  const titles = ["Decision-time anchoring", "Anchored adjoints → diagonal", "Local Hamiltonian correction"];
  const captions = [
    "Each decision time evaluates the remaining horizon with its own kernel. Stage 1 samples and optimizes these anchored continuation problems.",
    "BPTT averages pathwise sensitivities for each anchor; the action step uses only the diagonal value whose anchor equals the decision time.",
    "At each query time, the warm-up action moves to the maximizer of the Hamiltonian anchored at that same time."
  ];
  nonexpPanels.forEach((panel, i) => {
    const h2 = panel.querySelector("h2"); if (h2) h2.textContent = titles[i];
    const caption = panel.querySelector(".caption"); if (caption) caption.textContent = captions[i];
  });
  document.querySelectorAll('[data-paper-panel="nonexp"] .status-badge').forEach((badge) => { badge.textContent = "t₀=t"; });

  const queries = [
    { id: "early", name: "Early", label: "E", t: .18, warm: 1.02, target: 1.34, color: COLORS.blue, soft: COLORS.blueSoft, startAnchor: .04 },
    { id: "middle", name: "Middle", label: "M", t: .50, warm: 1.30, target: 1.18, color: COLORS.orange, soft: COLORS.orangeSoft, startAnchor: .20 },
    { id: "late", name: "Late", label: "L", t: .82, warm: 1.12, target: .88, color: COLORS.purple, soft: COLORS.purpleSoft, startAnchor: .46 }
  ];

  function kappa(s) { return 1.8 + 1.4 * s; }
  function kernel(s, t) { return t < s ? 1 : 1 / (1 + kappa(s) * (t - s)); }

  function star(ctx, x, y, r, color) {
    ctx.save(); ctx.beginPath();
    for (let i = 0; i < 10; i += 1) {
      const a = -Math.PI / 2 + i * Math.PI / 5, rr = i % 2 === 0 ? r : r * .45;
      const px = x + rr * Math.cos(a), py = y + rr * Math.sin(a);
      if (!i) ctx.moveTo(px, py); else ctx.lineTo(px, py);
    }
    ctx.closePath(); ctx.fillStyle = color; ctx.shadowBlur = 10; ctx.shadowColor = color; ctx.fill(); ctx.restore();
  }

  function drawKernel() {
    const { ctx, width, height } = setupCanvas(els.kernel); if (!ctx || width < 2) return; drawBackground(ctx, width, height);
    const left = 70, right = width - 30, top = 46, bottom = height - 34, reveal = easeOut(state.warmup);
    const xs = t => left + t * (right - left);
    const rowGap = (bottom - top) / 3;

    ctx.fillStyle = COLORS.text; ctx.font = "bold 11px Inter,system-ui,sans-serif";
    ctx.fillText("The same future payoff is re-valued by each current self", 16, 20);
    ctx.fillStyle = COLORS.yellow; ctx.font = "10px Inter,system-ui,sans-serif";
    ctx.textAlign = "right"; ctx.fillText("re-anchor the objective at every decision time", width - 16, 20); ctx.textAlign = "left";

    queries.forEach((q, i) => {
      const y = top + (i + .45) * rowGap, ax = xs(q.t), rx = lerp(ax, right, reveal), finalWeight = kernel(q.t, 1);
      ctx.strokeStyle = "rgba(255,255,255,.10)"; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(left, y); ctx.lineTo(right, y); ctx.stroke();
      ctx.strokeStyle = q.color; ctx.lineWidth = 2.3; ctx.beginPath(); ctx.moveTo(ax, y); ctx.lineTo(rx, y); ctx.stroke();

      for (let j = 0; j <= 10; j += 1) {
        const u = j / 10, t = q.t + u * (1 - q.t), x = xs(t); if (x > rx + 1) continue;
        const w = kernel(q.t, t);
        ctx.fillStyle = q.color.replace(",1)", `,${.18 + .70 * w})`);
        ctx.fillRect(x - 1.7, y - 10, 3.4, 20);
      }

      ctx.save(); ctx.shadowBlur = 10; ctx.shadowColor = q.color; ctx.beginPath(); ctx.fillStyle = q.color; ctx.arc(ax, y, 5.6, 0, Math.PI * 2); ctx.fill(); ctx.restore();
      star(ctx, right, y, 7.5, COLORS.yellow);
      ctx.fillStyle = COLORS.text; ctx.font = "bold 10px Inter,system-ui,sans-serif"; ctx.fillText(`${q.name} self · t₀=${q.t.toFixed(2)}`, 12, y + 4);
      ctx.fillStyle = q.color; ctx.fillText(`D(t₀,T)=${finalWeight.toFixed(2)}`, Math.min(right - 92, ax + 28), y - 15);
    });

    const e = queries[0].t, m = queries[1].t;
    const carried = kernel(e, 1) / kernel(e, m), reanchored = kernel(m, 1);
    ctx.fillStyle = "rgba(255,255,255,.035)"; ctx.fillRect(14, height - 32, width - 28, 22);
    ctx.fillStyle = COLORS.muted; ctx.font = "10px Inter,system-ui,sans-serif";
    ctx.fillText(`earlier continuation weight ${carried.toFixed(2)}  ≠  re-anchored weight ${reanchored.toFixed(2)}  →  the continuation problem changes`, 22, height - 17);
  }

  function drawAnchor() {
    const { ctx, width, height } = setupCanvas(els.anchor); if (!ctx || width < 2) return; drawBackground(ctx, width, height);
    const left = 54, right = width - 24, p = easeOut(state.warmup), rowGap = (height - 66) / 3;
    ctx.fillStyle = COLORS.text; ctx.font = "bold 11px Inter,system-ui,sans-serif"; ctx.fillText("Stage 1 samples anchored continuation problems", 12, 18);
    ctx.fillStyle = COLORS.muted; ctx.font = "10px Inter,system-ui,sans-serif"; ctx.fillText("simulate from t₀ to T, weight every payoff by D(t₀,·), then backpropagate", 12, 34);

    queries.forEach((q, row) => {
      const y0 = 58 + row * rowGap, ax = lerp(left, right, q.t), stop = lerp(ax, right, p);
      ctx.strokeStyle = "rgba(255,255,255,.10)"; ctx.beginPath(); ctx.moveTo(left, y0); ctx.lineTo(right, y0); ctx.stroke();
      ctx.beginPath();
      for (let j = 0; j <= 80; j += 1) {
        const t = q.t + (1 - q.t) * j / 80, x = lerp(left, right, t); if (x > stop + 1) break;
        const u = (t - q.t) / (1 - q.t), y = y0 - 7 - 12 * Math.sin(Math.PI * u) + 5 * Math.sin(5 * Math.PI * u + row);
        if (!j) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.strokeStyle = q.color; ctx.lineWidth = 2.1; ctx.stroke();
      for (let j = 0; j < 8; j += 1) {
        const t = q.t + (1 - q.t) * j / 7, x = lerp(left, right, t); if (x > stop + 1) continue;
        const w = kernel(q.t, t); ctx.fillStyle = q.color.replace(",1)", `,${.18 + .62 * w})`); ctx.fillRect(x - 2, y0 + 8, 4, 15);
      }
      ctx.beginPath(); ctx.fillStyle = q.color; ctx.arc(ax, y0, 5.3, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = COLORS.text; ctx.font = "bold 10px Inter,system-ui,sans-serif"; ctx.fillText(`J(t₀=${q.t.toFixed(2)},x;u)`, ax + 8, y0 - 12);
    });
    ctx.fillStyle = COLORS.muted; ctx.font = "10px Inter,system-ui,sans-serif"; ctx.fillText("0", left - 3, height - 7); ctx.textAlign = "right"; ctx.fillText("T", right + 3, height - 7); ctx.textAlign = "left";
  }

  function mean(anchor, t) {
    if (t < anchor) return NaN;
    const s = (t - anchor) / Math.max(1e-6, 1 - anchor);
    return 1.30 - .42 * s + .10 * anchor + .035 * Math.sin(4.8 * s + 1.2 * anchor);
  }

  function drawAdjoint() {
    const { ctx, width, height } = setupCanvas(els.adjoint); if (!ctx || width < 2) return; drawBackground(ctx, width, height);
    const pad = { left: 44, right: 18, top: 35, bottom: 30 }; drawGrid(ctx, width, height, pad); drawAxes(ctx, width, height, pad, "time", "anchored marginal value λᵗ⁰(t)");
    const xs = t => pad.left + t * (width - pad.left - pad.right), ys = v => height - pad.bottom - (v - .78) / .64 * (height - pad.top - pad.bottom), visible = visiblePathCount(8);

    ctx.font = "10px Inter,system-ui,sans-serif";
    ctx.strokeStyle = "rgba(241,246,255,.22)"; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(pad.left, 16); ctx.lineTo(pad.left + 18, 16); ctx.stroke();
    ctx.fillStyle = COLORS.muted; ctx.fillText("pathwise BPTT", pad.left + 24, 19);
    ctx.strokeStyle = COLORS.yellow; ctx.lineWidth = 2.3; ctx.beginPath(); ctx.moveTo(pad.left + 112, 16); ctx.lineTo(pad.left + 130, 16); ctx.stroke();
    ctx.fillStyle = COLORS.muted; ctx.fillText("Monte Carlo mean", pad.left + 136, 19);
    ctx.textAlign = "right"; ctx.fillStyle = COLORS.yellow; ctx.fillText(`${visible} continuations / anchor`, width - pad.right, 19); ctx.textAlign = "left";

    queries.forEach((q, ai) => {
      for (let p = 0; p < visible; p++) {
        ctx.beginPath(); let started = false;
        for (let k = 0; k <= 70; k++) {
          const t = k / 70; if (t < q.t) continue;
          const s = (t - q.t) / (1 - q.t), y = ys(mean(q.t, t) + .028 * Math.sin(9 * s + .8 * p + ai) * (1 - .4 * s));
          if (!started) { ctx.moveTo(xs(t), y); started = true; } else ctx.lineTo(xs(t), y);
        }
        ctx.strokeStyle = q.color.replace(",1)", ",.16)"); ctx.lineWidth = 1; ctx.stroke();
      }
      ctx.beginPath(); let started = false;
      for (let k = 0; k <= 70; k++) {
        const t = k / 70; if (t < q.t) continue;
        if (!started) { ctx.moveTo(xs(t), ys(mean(q.t, t))); started = true; } else ctx.lineTo(xs(t), ys(mean(q.t, t)));
      }
      ctx.strokeStyle = q.color; ctx.lineWidth = 2.4; ctx.stroke();
      const sx = xs(q.t), sy = ys(mean(q.t, q.t));
      ctx.beginPath(); ctx.fillStyle = q.color; ctx.arc(sx, sy, 4.8, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = q.color; ctx.font = "bold 10px Inter,system-ui,sans-serif"; ctx.fillText(`${q.label}: anchor t₀=${q.t.toFixed(2)}`, sx + 7, sy - 8);
    });
  }

  function drawDiagonal() {
    const { ctx, width, height } = setupCanvas(els.diagonal); if (!ctx || width < 2) return; drawBackground(ctx, width, height);
    const left = 48, right = width - 26, top = 28, bottom = height - 22, xs = t => left + t * (right - left), ys = t => bottom - t * (bottom - top), p = recoveryProgress();
    ctx.beginPath(); ctx.moveTo(xs(0), ys(0)); ctx.lineTo(xs(1), ys(0)); ctx.lineTo(xs(1), ys(1)); ctx.closePath(); ctx.fillStyle = "rgba(143,216,255,.055)"; ctx.fill(); ctx.strokeStyle = "rgba(255,255,255,.12)"; ctx.stroke();
    ctx.strokeStyle = COLORS.yellow; ctx.lineWidth = 2.4; ctx.beginPath(); ctx.moveTo(xs(0), ys(0)); ctx.lineTo(xs(1), ys(1)); ctx.stroke();
    ctx.fillStyle = COLORS.text; ctx.font = "bold 10px Inter,system-ui,sans-serif"; ctx.fillText("use the diagonal adjoint: anchor t₀ = decision time t", left + 4, 15);
    ctx.fillStyle = COLORS.muted; ctx.font = "9px Inter,system-ui,sans-serif"; ctx.fillText("off-diagonal anchors describe different continuation problems", left + 4, 27);

    queries.forEach((q) => {
      const yStart = ys(q.startAnchor), yNow = ys(lerp(q.startAnchor, q.t, p)), x = xs(q.t), yTarget = ys(q.t);
      ctx.save(); ctx.setLineDash([4, 4]); drawArrow(ctx, x, yStart, x, yNow, q.soft, 1.6); ctx.restore();
      ctx.save(); ctx.setLineDash([3, 4]); ctx.strokeStyle = q.color; ctx.beginPath(); ctx.arc(x, yTarget, 7.2, 0, Math.PI * 2); ctx.stroke(); ctx.restore();
      ctx.save(); ctx.shadowBlur = 9; ctx.shadowColor = q.color; ctx.beginPath(); ctx.fillStyle = q.color; ctx.arc(x, yNow, 4.8, 0, Math.PI * 2); ctx.fill(); ctx.restore();
      ctx.fillStyle = q.color; ctx.font = "bold 9px Inter,system-ui,sans-serif"; ctx.fillText(q.label, x + 7, yNow - 5);
    });
    ctx.fillStyle = COLORS.muted; ctx.font = "9px Inter,system-ui,sans-serif"; ctx.textAlign = "right"; ctx.fillText("decision time t", right, height - 4); ctx.textAlign = "left"; ctx.fillText("anchor t₀", 5, top + 5);
  }

  const current = q => lerp(q.warm, q.target, recoveryProgress());

  function drawRecovery() {
    const { ctx, width, height } = setupCanvas(els.recovery); if (!ctx || width < 2) return; drawBackground(ctx, width, height);
    const outer = 14, gap = 10, top = 42, bottom = height - 28, panelW = (width - 2 * outer - 2 * gap) / 3;
    ctx.fillStyle = COLORS.text; ctx.font = "bold 11px Inter,system-ui,sans-serif"; ctx.fillText("At each query: estimate the diagonal adjoint, then maximize the local Hamiltonian", 14, 20);
    ctx.fillStyle = COLORS.muted; ctx.font = "9px Inter,system-ui,sans-serif"; ctx.fillText("warm-up action  →  arg maxᵤ H(t,t,x,u,λ̂,Ẑ)", 14, 34);

    queries.forEach((q, i) => {
      const x0 = outer + i * (panelW + gap), x1 = x0 + panelW;
      ctx.fillStyle = "rgba(255,255,255,.018)"; ctx.fillRect(x0, top, panelW, bottom - top);
      ctx.strokeStyle = "rgba(255,255,255,.08)"; ctx.strokeRect(x0, top, panelW, bottom - top);
      const uMin = Math.min(q.warm, q.target) - .28, uMax = Math.max(q.warm, q.target) + .28;
      const xs = u => x0 + 14 + (u - uMin) / (uMax - uMin) * (panelW - 28);
      const ys = h => bottom - 24 - h * (bottom - top - 52);
      const H = u => Math.max(0, 1 - 3.4 * Math.pow((u - q.target) / (uMax - uMin), 2));

      ctx.beginPath();
      for (let k = 0; k <= 80; k++) {
        const u = uMin + (uMax - uMin) * k / 80, x = xs(u), y = ys(H(u));
        if (!k) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.strokeStyle = q.color; ctx.lineWidth = 2.2; ctx.stroke();

      const uc = current(q), xw = xs(q.warm), yw = ys(H(q.warm)), xc = xs(uc), yc = ys(H(uc)), xt = xs(q.target), yt = ys(1);
      drawArrow(ctx, xw, yw, xc, yc, q.soft, 1.8);
      ctx.save(); ctx.setLineDash([3, 4]); ctx.strokeStyle = q.color; ctx.beginPath(); ctx.arc(xt, yt, 7.6, 0, Math.PI * 2); ctx.stroke(); ctx.restore();
      ctx.beginPath(); ctx.fillStyle = "rgba(241,246,255,.55)"; ctx.arc(xw, yw, 4.5, 0, Math.PI * 2); ctx.fill();
      ctx.save(); ctx.shadowBlur = 12; ctx.shadowColor = q.color; ctx.beginPath(); ctx.fillStyle = q.color; ctx.arc(xc, yc, 6, 0, Math.PI * 2); ctx.fill(); ctx.restore();

      ctx.fillStyle = q.color; ctx.font = "bold 10px Inter,system-ui,sans-serif"; ctx.fillText(`${q.name} · t=${q.t.toFixed(2)}`, x0 + 9, top + 16);
      ctx.fillStyle = COLORS.muted; ctx.font = "9px Inter,system-ui,sans-serif"; ctx.fillText("anchor t₀=t", x0 + 9, top + 30);
      ctx.textAlign = "center"; ctx.fillText(`u: ${q.warm.toFixed(2)} → ${q.target.toFixed(2)}`, (x0 + x1) / 2, bottom - 7); ctx.textAlign = "left";
    });
  }

  const warmR = stageCounts.map(n => .030 + .14 * Math.exp(-.78 * Math.log10(n)));
  const projectedR = stageCounts.map(n => .008 + .055 * Math.exp(-1.22 * Math.log10(n)));

  function drawResidual() {
    const { ctx, width, height } = setupCanvas(els.residual); if (!ctx || width < 2) return; drawBackground(ctx, width, height);
    const pad = { left: 48, right: 26, top: 42, bottom: 30 }; drawGrid(ctx, width, height, pad, 4, 6); drawAxes(ctx, width, height, pad, "number of paths", "");
    const xmax = stageCounts.at(-1), xs = n => pad.left + Math.log10(Math.max(1, n)) / Math.log10(xmax) * (width - pad.left - pad.right), ys = v => height - pad.bottom - (Math.log10(Math.max(.005, v)) + 2.25) / 1.60 * (height - pad.top - pad.bottom);
    ctx.fillStyle = COLORS.text; ctx.font = "bold 10px Inter,system-ui,sans-serif"; ctx.fillText("local Hamiltonian residual", pad.left, 16);
    const lx = Math.max(pad.left + 150, width - pad.right - 205), ly = 14;
    ctx.strokeStyle = COLORS.blue; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(lx, ly - 3); ctx.lineTo(lx + 22, ly - 3); ctx.stroke(); ctx.fillStyle = COLORS.blue; ctx.fillText("warm-up", lx + 28, ly);
    ctx.strokeStyle = COLORS.orange; ctx.lineWidth = 2.4; ctx.beginPath(); ctx.moveTo(lx + 92, ly - 3); ctx.lineTo(lx + 114, ly - 3); ctx.stroke(); ctx.fillStyle = COLORS.orange; ctx.fillText("diagonal correction", lx + 120, ly);
    drawProgressSeries(ctx, warmR, xs, ys, COLORS.blue, 2); drawProgressSeries(ctx, projectedR, xs, ys, COLORS.orange, 2.4);
  }

  function updateCards() { queries.forEach(q => { if (els.text[q.id]) els.text[q.id].textContent = `t = ${q.t.toFixed(2)} · û = ${current(q).toFixed(3)}`; }); }
  function draw() { drawKernel(); drawAnchor(); drawAdjoint(); drawDiagonal(); drawRecovery(); drawResidual(); updateCards(); }
  D.registerMode("nonexp", draw);
})();
