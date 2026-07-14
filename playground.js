(() => {
  "use strict";

  const COLORS = {
    blue: "#8fd8ff",
    blueSoft: "rgba(143,216,255,0.24)",
    green: "#94f0c1",
    greenSoft: "rgba(148,240,193,0.24)",
    orange: "#ffb07a",
    orangeSoft: "rgba(255,176,122,0.24)",
    yellow: "#ffe48d",
    yellowSoft: "rgba(255,228,141,0.24)",
    red: "#ff8585",
    redSoft: "rgba(255,133,133,0.24)",
    purple: "#bd9fff",
    purpleSoft: "rgba(189,159,255,0.24)",
    text: "rgba(241,246,255,0.90)",
    muted: "rgba(190,205,226,0.68)",
    faint: "rgba(241,246,255,0.12)",
    grid: "rgba(241,246,255,0.055)",
    panel: "rgba(7,15,26,0.80)",
  };

  const els = {
    play: document.getElementById("playButton"),
    reset: document.getElementById("resetButton"),
    modeSwitch: document.getElementById("modeSwitch"),
    modeShell: document.querySelector(".mode-scroll-shell"),
    modeButtons: Array.from(document.querySelectorAll("[data-mode]")),
    stages: Array.from(document.querySelectorAll("[data-stage-index]")),
    canvases: [
      document.getElementById("figure1Canvas"),
      document.getElementById("figure2Canvas"),
      document.getElementById("figure3Canvas"),
    ],
    titles: [
      document.getElementById("figure1Title"),
      document.getElementById("figure2Title"),
      document.getElementById("figure3Title"),
    ],
    badges: [
      document.getElementById("figure1Badge"),
      document.getElementById("figure2Badge"),
      document.getElementById("figure3Badge"),
    ],
    details: [
      document.getElementById("figure1Detail"),
      document.getElementById("figure2Detail"),
      document.getElementById("figure3Detail"),
    ],
    captions: [
      document.getElementById("figure1Caption"),
      document.getElementById("figure2Caption"),
      document.getElementById("figure3Caption"),
    ],
    equationTitles: [
      document.getElementById("equation1Title"),
      document.getElementById("equation2Title"),
      document.getElementById("equation3Title"),
    ],
    equationBodies: [
      document.getElementById("equation1Body"),
      document.getElementById("equation2Body"),
      document.getElementById("equation3Body"),
    ],
    scopeTitle: document.getElementById("scopeTitle"),
    scopeBody: document.getElementById("scopeBody"),
    footerMode: document.getElementById("footerMode"),
  };

  const reducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches ?? false;

  const state = {
    mode: "core",
    progress: reducedMotion ? 1 : 0,
    playing: false,
    lastTimestamp: 0,
    frame: 0,
    constraintSolver: "qp",
    nonexpCase: 2,
    delayKind: "state",
    resizeTimer: null,
  };

  const modes = {
    core: {
      label: "Core PG-DPO",
      url: "smooth",
      titles: ["Rollout warm-up", "First- and second-order adjoints", "Generalized-Hamiltonian recovery"],
      badges: ["smooth control", "λ and P", "local maximizer"],
      captions: [
        "A differentiable policy generates continuation rollouts. Stage I is an exploratory warm start, not the final control.",
        "Reverse-mode differentiation supplies pathwise state sensitivities; conditional averaging forms the adapted first- and second-order adjoints.",
        "The recovered risky weight follows the local generalized-Hamiltonian maximizer. The CRRA homogeneity identity is displayed only as a specialization.",
      ],
      equations: [
        {
          title: "State dynamics and objective",
          body: String.raw`<div>$$dX_t=X_t\bigl[r+\pi_t(\mu-r)\bigr]dt+X_t\pi_t\sigma\,dW_t$$</div><div>$$\max_{\pi}\;\mathbb E\!\left[U(X_T)\right]$$</div>`,
        },
        {
          title: "Open-loop generalized Hamiltonian",
          body: String.raw`<div>$$\mathcal H(\pi)=\lambda x\bigl[r+\pi(\mu-r)\bigr]+\zeta x\sigma\pi+\tfrac12Px^2\sigma^2\pi^2$$</div><div>$$-d\lambda_t=\partial_xH_tdt-Z_t\,dW_t,\qquad P_t<0$$</div>`,
        },
        {
          title: "Recovered risky weight",
          body: String.raw`<div>$$\widehat\pi=-\frac{\widehat\lambda(\mu-r)+\sigma\widehat\zeta}{x\sigma^2\widehat P}$$</div><div>$$\zeta=0,\;xP=-\gamma\lambda\;\Longrightarrow\;\pi^*=\frac{\mu-r}{\gamma\sigma^2}$$</div>`,
        },
      ],
      scopeTitle: "Open-loop adjoints first; smooth identities only afterward",
      scopeBody: `<p>The primary object is the trajectorywise state–adjoint system. The displayed identities <strong>ζ = 0</strong> and <strong>P = ∂ₓλ</strong> are optional smooth benchmark reductions, not definitions and not separately fitted surrogate objects.</p><div class="scope-tags"><span class="scope-tag">terminal-wealth example</span><span class="scope-tag">no consumption mismatch</span><span class="scope-tag">PMP-first presentation</span></div>`,
    },
    constraints: {
      label: "Constraints",
      url: "constraints",
      titles: ["Feasible warm-up", "Adapted adjoint tuple", "KKT / solver-neutral recovery"],
      badges: ["activations", "λ, ζ, P", "barrier or QP"],
      captions: [
        "Smooth output maps keep every warm-up action inside the pointwise control set, while feasibility alone does not impose KKT stationarity.",
        "Once- and twice-differentiated continuations supply the sensitivity and curvature needed for the local constrained portfolio block.",
        "The same learned adjoints feed either a general log-barrier solve or an exact QP/KKT solve when quadratic-affine structure is available.",
      ],
      equations: [
        {
          title: "Pointwise feasible set",
          body: String.raw`<div>$$u=(\pi,C),\qquad \mathbf 1^\top\pi=1,\qquad \Gamma(t,x;u)\ge 0$$</div><div>$$dX_t=\bigl(X_t\pi_t^\top\mu^e-C_t\bigr)dt+X_t\pi_t^\top v^e\,dW_t$$</div>`,
        },
        {
          title: "Generalized Hamiltonian",
          body: String.raw`<div>$$\mathcal H=e^{-\rho t}U(C)+\lambda b+\zeta^\top\sigma+\tfrac12P\|\sigma\|^2$$</div><div>$$\widehat\vartheta=(\widehat\lambda,\widehat\zeta,\widehat P)$$</div>`,
        },
        {
          title: "Common recovery interface",
          body: String.raw`<div>$$\widehat u\in\arg\max_{u\in U(t,x)}\widehat{\mathcal H}(u)$$</div><div>$$\text{QP block: }\arg\max_{u\in K}\left\{a^\top u-\tfrac12u^\top Qu\right\}$$</div>`,
        },
      ],
      scopeTitle: "Displayed slice and solver interpretation",
      scopeBody: `<p>The figure uses a two-risky-asset <strong>long-only / no-borrowing</strong> slice and the displayed smooth specialization <strong>ζ = 0, P = ∂ₓλ</strong>. The broader framework also covers borrowing-permitted short-sale-only blocks and consumption caps.</p><p><strong>B-PGDPO and QP-PGDPO share Stage I.</strong> They differ only in the downstream local solver.</p><div class="scope-tags"><span class="scope-tag">active boundary</span><span class="scope-tag">near boundary</span><span class="scope-tag">interior</span></div>`,
    },
    transaction: {
      label: "Transaction costs",
      url: "transaction-costs",
      titles: ["Cash–position continuations", "Cash and position adjoints", "Dead-zone Pontryagin projection"],
      badges: ["(X, Y, L)", "λₓ, λᵧ, R", "sell / hold / buy"],
      captions: [
        "Stage I now rolls out cash and risky positions under the same ε-regularized trading-rate dynamics used by the local projection.",
        "BPTT differentiates terminal utility with respect to cash and position. Their adapted ratio R = λᵧ/λₓ determines the intervention regime.",
        "The middle interval remains exactly flat: ε changes trading intensity outside the wedge without moving the sell/hold/buy thresholds.",
      ],
      equations: [
        {
          title: "State and liquidation wealth",
          body: String.raw`<div>$$Z_t=(X_t,Y_t),\qquad L_t=X_t+(1-\alpha)Y_t$$</div><div>$$\max_u\;\mathbb E\!\left[U(L_T)\right]$$</div>`,
        },
        {
          title: "Kinked local Hamiltonian",
          body: String.raw`<div>$$H(u;\Lambda)=L\bigl[-\lambda_xu^+ +(1-\alpha)\lambda_xu^-+\lambda_yu\bigr]$$</div><div>$$R=\lambda_y/\lambda_x$$</div>`,
        },
        {
          title: "Exact no-action wedge",
          body: String.raw`<div>$$P_\varepsilon(R)=\begin{cases}(R-1)/\varepsilon,&R>1,\\0,&1-\alpha\le R\le1,\\(R-(1-\alpha))/\varepsilon,&R<1-\alpha.\end{cases}$$</div>`,
        },
      ],
      scopeTitle: "Auxiliary regularized trading-rate problem",
      scopeBody: `<p>The visualization supports <strong>local Hamiltonian consistency and buy/hold/sell regime recovery</strong>. It does not claim convergence to the limiting finite-variation singular-control free boundary.</p><p>Repeating the local ratio test over a state domain traces no-trade geometry; covariance enters through the continuation adjoints, not through independent scalar thresholds.</p><div class="scope-tags"><span class="scope-tag">exact hold wedge</span><span class="scope-tag">fixed ε</span><span class="scope-tag">local regime diagnostic</span></div>`,
    },
    nonexp: {
      label: "Non-exponential",
      url: "non-exponential",
      titles: ["Discount-kernel taxonomy", "Decision-time anchored adjoints", "Diagonal Hamiltonian correction"],
      badges: ["2×2 taxonomy", "anchor t₀", "t₀ = t"],
      captions: [
        "Multiplicativity and time homogeneity are separated explicitly. The selected case determines whether recursion, stationarity, or both fail.",
        "Each decision anchor defines its own remaining-horizon objective and its own adapted adjoint. The diagonal t₀ = t is highlighted for synthesis.",
        "At the query time, action-space maximization produces the classical optimum for multiplicative kernels and a time-consistent equilibrium otherwise.",
      ],
      equations: [
        {
          title: "Anchored continuation objective",
          body: String.raw`<div>$$J(t_0,x;u)=\mathbb E_{t_0,x}\!\left[\int_{t_0}^{T}D(t_0,s)\ell(s,X_s,u_s)ds+D(t_0,T)g(X_T)\right]$$</div>`,
        },
        {
          title: "Anchored Hamiltonian and adjoint",
          body: String.raw`<div>$$H(t_0,t,x,u,\lambda,Z)=D(t_0,t)\ell+\langle\lambda,b\rangle+\operatorname{Tr}(Z^\top\sigma)$$</div><div>$$\lambda_T^{t_0}=D(t_0,T)\nabla g(X_T)$$</div>`,
        },
        {
          title: "Diagonal action synthesis",
          body: String.raw`<div>$$\widehat u(t,x)\in\arg\max_{u\in U(x)}H\bigl(t,t,x,u,\widehat\lambda(t,x),\widehat Z(t,x)\bigr)$$</div><div>$$\text{multiplicative: optimum}$$</div><div>$$\text{non-multiplicative: equilibrium}$$</div>`,
        },
      ],
      scopeTitle: "Three structural cases, one diagonal synthesis rule",
      scopeBody: `<p><strong>Case 1:</strong> multiplicative but time-inhomogeneous—recursion survives, stationarity does not. <strong>Case 2:</strong> time-homogeneous but non-multiplicative—time-consistent equilibrium replaces classical optimality. <strong>Case 3:</strong> neither property—both recursion and stationarity are lost.</p><div class="scope-tags"><span class="scope-tag">Case 1 survival</span><span class="scope-tag">Case 2 hyperbolic</span><span class="scope-tag">Case 3 time-varying</span></div>`,
    },
    delay: {
      label: "Delay / kinks",
      url: "delay",
      titles: ["History-aware warm-up", "Anticipated delay adjoint", "Kink and switching recovery"],
      badges: ["LSTM / path segment", "future re-entry", "structure-aware"],
      captions: [
        "The warm-up policy conditions on a history segment rather than only the current state; the displayed recurrent controller is a continuation model.",
        "A present perturbation re-enters future dynamics through delayed state or control channels, so the backward adjoint includes anticipated contributions.",
        "The local Pontryagin map restores sharp switching behavior that a smooth recurrent policy can smear across the transition region.",
      ],
      equations: [
        {
          title: "Stochastic delay dynamics",
          body: String.raw`<div>$$dX(t)=b\bigl(t,X(t),X(t-\delta),A(t),u(t)\bigr)dt+\sigma\bigl(t,X(t),X(t-\delta),A(t)\bigr)dW(t)$$</div><div>$$u_\theta(t)=\pi_\theta(H_t)$$</div>`,
        },
        {
          title: "Anticipated adjoint structure",
          body: String.raw`<div>$$dp(t)=\mathbb E\!\left[\mu(t)\mid\mathcal F_t\right]dt+q(t)dW(t)$$</div><div>$$\mu(t)=-\partial_xH(t)-\mathbb E_t\!\left[\partial_yH(t+\delta)\right]-\text{distributed-delay term}$$</div>`,
        },
        {
          title: "Delay-aware local projection",
          body: String.raw`<div>$$\widehat u(t)\in\arg\max_{u\in U}H_{\mathrm{red}}\bigl(t,X_t,H_t,u;\widehat\lambda_t\bigr)$$</div><div>$$\text{control delay: }\partial_uH(t)+\mathbb E_t\!\left[\partial_{u_{\rm del}}H(t+\delta_u)\right]=0$$</div>`,
        },
      ],
      scopeTitle: "Conditional local theory under control-independent diffusion",
      scopeBody: `<p>The displayed projection theory assumes <strong>∂ᵤσ = 0</strong>. State delay produces an anticipated adjoint; control delay adds a future-control term to the pointwise condition; distributed delay accumulates weighted future re-entry.</p><p>The short-slab guarantee is conditional on a sufficiently useful warm start, accurate BPTT/Monte Carlo adjoints, and a tight local solve.</p><div class="scope-tags"><span class="scope-tag">state delay</span><span class="scope-tag">control delay</span><span class="scope-tag">distributed delay</span></div>`,
    },
  };

  const clamp = (x, lo = 0, hi = 1) => Math.max(lo, Math.min(hi, x));
  const lerp = (a, b, u) => a + (b - a) * u;
  const ease = (u) => 1 - Math.pow(1 - clamp(u), 3);
  const smooth = (u) => {
    const x = clamp(u);
    return x * x * (3 - 2 * x);
  };
  const rgba = (hex, alpha) => {
    const raw = hex.replace("#", "");
    const full = raw.length === 3 ? raw.split("").map((c) => c + c).join("") : raw;
    const n = Number.parseInt(full, 16);
    return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${alpha})`;
  };
  const fmt = (x, digits = 3) => Number.isFinite(x) ? x.toFixed(digits) : "—";
  const expFmt = (x) => {
    if (!Number.isFinite(x) || x === 0) return "0";
    const e = Math.floor(Math.log10(Math.abs(x)));
    return `${(x / Math.pow(10, e)).toFixed(1)}e${e < 0 ? "−" : "+"}${Math.abs(e)}`;
  };

  function stageProgress() {
    return {
      warm: ease(clamp(state.progress * 3)),
      adjoint: ease(clamp(state.progress * 3 - 1)),
      recovery: ease(clamp(state.progress * 3 - 2)),
    };
  }

  function setupCanvas(canvas) {
    const rect = canvas.getBoundingClientRect();
    const width = Math.max(2, rect.width);
    const height = Math.max(2, rect.height);
    const dpr = Math.min(window.devicePixelRatio || 1, 2.5);
    const pw = Math.round(width * dpr);
    const ph = Math.round(height * dpr);
    if (canvas.width !== pw || canvas.height !== ph) {
      canvas.width = pw;
      canvas.height = ph;
    }
    const ctx = canvas.getContext("2d");
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, width, height);
    return { ctx, width, height };
  }

  function roundedRect(ctx, x, y, w, h, r = 10) {
    const rr = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + rr, y);
    ctx.arcTo(x + w, y, x + w, y + h, rr);
    ctx.arcTo(x + w, y + h, x, y + h, rr);
    ctx.arcTo(x, y + h, x, y, rr);
    ctx.arcTo(x, y, x + w, y, rr);
    ctx.closePath();
  }

  function drawBackground(ctx, width, height) {
    const g = ctx.createLinearGradient(0, 0, 0, height);
    g.addColorStop(0, "rgba(9,18,31,0.76)");
    g.addColorStop(1, "rgba(6,14,25,0.96)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, width, height);
  }

  function drawGrid(ctx, area, rows = 4, cols = 6) {
    const { x, y, w, h } = area;
    ctx.save();
    ctx.strokeStyle = COLORS.grid;
    ctx.lineWidth = 1;
    for (let i = 0; i <= rows; i += 1) {
      const yy = y + h * i / rows;
      ctx.beginPath();
      ctx.moveTo(x, yy);
      ctx.lineTo(x + w, yy);
      ctx.stroke();
    }
    for (let j = 0; j <= cols; j += 1) {
      const xx = x + w * j / cols;
      ctx.beginPath();
      ctx.moveTo(xx, y);
      ctx.lineTo(xx, y + h);
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawAxes(ctx, area, xLabel, yLabel) {
    const { x, y, w, h } = area;
    ctx.save();
    ctx.strokeStyle = COLORS.faint;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x, y + h);
    ctx.lineTo(x + w, y + h);
    ctx.stroke();
    ctx.fillStyle = COLORS.muted;
    ctx.font = "10px Inter, system-ui, sans-serif";
    ctx.textAlign = "left";
    ctx.fillText(yLabel, x, Math.max(11, y - 5));
    ctx.textAlign = "right";
    ctx.fillText(xLabel, x + w, y + h + 17);
    ctx.restore();
  }

  function drawPill(ctx, text, x, y, color, align = "left") {
    ctx.save();
    ctx.font = "800 10px Inter, system-ui, sans-serif";
    const tw = ctx.measureText(text).width;
    const w = tw + 14;
    const h = 20;
    const xx = align === "right" ? x - w : x;
    roundedRect(ctx, xx, y, w, h, 10);
    ctx.fillStyle = rgba(color, 0.12);
    ctx.fill();
    ctx.strokeStyle = rgba(color, 0.28);
    ctx.stroke();
    ctx.fillStyle = color;
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.fillText(text, xx + 7, y + h / 2 + 0.5);
    ctx.restore();
  }

  function drawArrow(ctx, x0, y0, x1, y1, color, width = 1.8, head = 7) {
    const a = Math.atan2(y1 - y0, x1 - x0);
    ctx.save();
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.lineWidth = width;
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.lineTo(x1, y1);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x1 - head * Math.cos(a - Math.PI / 6), y1 - head * Math.sin(a - Math.PI / 6));
    ctx.lineTo(x1 - head * Math.cos(a + Math.PI / 6), y1 - head * Math.sin(a + Math.PI / 6));
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  function drawDot(ctx, x, y, color, radius = 5.5, glow = true) {
    ctx.save();
    if (glow) {
      ctx.shadowBlur = 12;
      ctx.shadowColor = color;
    }
    ctx.beginPath();
    ctx.fillStyle = color;
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function drawPolyline(ctx, points, color, width = 2, alpha = 1, dash = []) {
    if (!points.length) return;
    ctx.save();
    ctx.strokeStyle = rgba(color, alpha);
    ctx.lineWidth = width;
    ctx.setLineDash(dash);
    ctx.beginPath();
    points.forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y));
    ctx.stroke();
    ctx.restore();
  }

  function drawLegendLine(ctx, x, y, color, label, dash = []) {
    ctx.save();
    ctx.setLineDash(dash);
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x, y - 3);
    ctx.lineTo(x + 20, y - 3);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = COLORS.muted;
    ctx.font = "10px Inter, system-ui, sans-serif";
    ctx.fillText(label, x + 25, y);
    ctx.restore();
  }

  function clipText(ctx, text, x, y, maxWidth) {
    let out = text;
    if (ctx.measureText(out).width <= maxWidth) {
      ctx.fillText(out, x, y);
      return;
    }
    while (out.length > 2 && ctx.measureText(`${out}…`).width > maxWidth) out = out.slice(0, -1);
    ctx.fillText(`${out}…`, x, y);
  }

  function pathNoise(path, t, scale = 1) {
    return scale * (
      0.62 * Math.sin(5.2 * t + path * 0.71) +
      0.28 * Math.sin(13.4 * t + path * 1.17) +
      0.16 * Math.sin(27.0 * t + path * 0.29)
    );
  }

  function drawCore1(ctx, width, height) {
    drawBackground(ctx, width, height);
    const { warm } = stageProgress();
    const area = { x: 42, y: 30, w: width - 58, h: height - 72 };
    drawGrid(ctx, area, 4, 6);
    drawAxes(ctx, area, "time", "wealth X");
    const n = 90;
    const reveal = Math.max(1, Math.floor(n * warm));
    const xs = (k) => area.x + area.w * k / n;
    const ys = (v) => area.y + area.h - (v - 0.72) / 0.68 * area.h;
    for (let p = 0; p < 15; p += 1) {
      const pts = [];
      for (let k = 0; k <= reveal; k += 1) {
        const t = k / n;
        const v = 1 + 0.16 * t + 0.07 * Math.sqrt(t + 0.02) * pathNoise(p, t, 0.65 + 0.02 * p);
        pts.push([xs(k), ys(v)]);
      }
      drawPolyline(ctx, pts, p < 3 ? COLORS.blue : COLORS.green, p < 3 ? 1.9 : 1.0, p < 3 ? 0.82 : 0.25);
    }
    const cursor = xs(reveal);
    ctx.save();
    ctx.setLineDash([5, 5]);
    ctx.strokeStyle = "rgba(255,255,255,0.22)";
    ctx.beginPath();
    ctx.moveTo(cursor, area.y);
    ctx.lineTo(cursor, area.y + area.h);
    ctx.stroke();
    ctx.restore();
    drawPill(ctx, "Stage I policy rollout", area.x + 8, area.y + 8, COLORS.blue);

    const boxW = Math.min(132, width * 0.28);
    const boxH = 54;
    const bx = width - boxW - 19;
    const by = 12;
    roundedRect(ctx, bx, by, boxW, boxH, 10);
    ctx.fillStyle = "rgba(9,21,36,0.93)";
    ctx.fill();
    ctx.strokeStyle = rgba(COLORS.blue, 0.25);
    ctx.stroke();
    ctx.fillStyle = COLORS.text;
    ctx.font = "800 10px Inter, system-ui, sans-serif";
    ctx.fillText("policy πθ(t, X)", bx + 10, by + 18);
    ctx.fillStyle = COLORS.muted;
    ctx.font = "9px Inter, system-ui, sans-serif";
    ctx.fillText("simulation + BPTT", bx + 10, by + 34);
    ctx.fillStyle = COLORS.green;
    ctx.fillText(`${Math.round(100 * warm)}% warm-up`, bx + 10, by + 48);
  }

  function drawAdjointPanels(ctx, width, height, mode = "core") {
    drawBackground(ctx, width, height);
    const { adjoint } = stageProgress();
    const left = 42;
    const right = 16;
    const top = 30;
    const bottom = 25;
    const gap = 18;
    const ph = (height - top - bottom - gap) / 2;
    const panels = [
      { y: top, h: ph, label: mode === "transaction" ? "cash adjoint λₓ" : "first-order adjoint λ", color: COLORS.orange, base: (t) => 1.17 - 0.36 * t + 0.035 * Math.sin(5.1 * t) },
      { y: top + ph + gap, h: ph, label: mode === "transaction" ? "position adjoint λᵧ" : "curvature −P", color: COLORS.blue, base: (t) => mode === "transaction" ? 1.06 - 0.31 * t + 0.03 * Math.cos(5.8 * t) : 1.70 - 0.56 * t + 0.055 * Math.cos(4.6 * t) },
    ];
    const pathCount = Math.max(1, Math.floor(1 + adjoint * 8));
    const activeFrac = adjoint * 8 - Math.floor(adjoint * 8);
    panels.forEach((panel, pi) => {
      const area = { x: left, y: panel.y, w: width - left - right, h: panel.h };
      drawGrid(ctx, area, 3, 6);
      const ymin = pi === 0 ? 0.68 : (mode === "transaction" ? 0.58 : 0.98);
      const ymax = pi === 0 ? 1.28 : (mode === "transaction" ? 1.22 : 1.91);
      const xs = (t) => area.x + t * area.w;
      const ys = (v) => area.y + area.h - (v - ymin) / (ymax - ymin) * area.h;
      for (let p = 0; p < pathCount; p += 1) {
        const end = p === pathCount - 1 && pathCount < 9 ? clamp(activeFrac) : 1;
        const front = 1 - end;
        const pts = [];
        for (let k = 80; k >= Math.round(80 * front); k -= 1) {
          const t = k / 80;
          const amp = 0.020 + 0.004 * (p % 4);
          const v = panel.base(t) + amp * pathNoise(p + pi * 11, t, 0.9) * (1 - 0.3 * t);
          pts.push([xs(t), ys(v)]);
        }
        drawPolyline(ctx, pts, panel.color, p < 2 ? 1.45 : 1.05, p === pathCount - 1 && end < 1 ? 0.95 : 0.34);
        if (p === pathCount - 1 && end < 1) {
          const t = front;
          const amp = 0.020 + 0.004 * (p % 4);
          drawDot(ctx, xs(t), ys(panel.base(t) + amp * pathNoise(p + pi * 11, t, 0.9) * (1 - 0.3 * t)), COLORS.yellow, 3.8, true);
        }
      }
      if (adjoint > 0.22) {
        const meanAlpha = clamp((adjoint - 0.20) / 0.42);
        const pts = [];
        for (let k = 0; k <= 80; k += 1) {
          const t = k / 80;
          pts.push([xs(t), ys(panel.base(t))]);
        }
        drawPolyline(ctx, pts, panel.color, 2.5, 0.25 + 0.75 * meanAlpha);
      }
      ctx.fillStyle = COLORS.text;
      ctx.font = "800 10px Inter, system-ui, sans-serif";
      ctx.fillText(panel.label, area.x + 7, area.y + 13);
    });
    ctx.fillStyle = COLORS.yellow;
    ctx.font = "800 10px Inter, system-ui, sans-serif";
    ctx.fillText("BPTT backward:  t₀  ←  T", left, 16);
    ctx.fillStyle = COLORS.muted;
    ctx.textAlign = "right";
    ctx.fillText(`pathwise samples: ${Math.min(8, pathCount)}/8`, width - right, 16);
    ctx.fillText("time", width - right, height - 6);
    ctx.textAlign = "left";
  }

  function drawCore3(ctx, width, height) {
    drawBackground(ctx, width, height);
    const { recovery } = stageProgress();
    const area = { x: 44, y: 34, w: width - 62, h: height - 75 };
    drawGrid(ctx, area, 4, 7);
    drawAxes(ctx, area, "risky weight π", "generalized Hamiltonian");
    const xmin = -0.05;
    const xmax = 1.15;
    const xs = (x) => area.x + (x - xmin) / (xmax - xmin) * area.w;
    const hfun = (x) => 0.97 - 1.65 * Math.pow(x - 0.75, 2);
    const ymin = -0.15;
    const ymax = 1.08;
    const ys = (v) => area.y + area.h - (v - ymin) / (ymax - ymin) * area.h;
    const pts = [];
    for (let i = 0; i <= 120; i += 1) {
      const x = xmin + (xmax - xmin) * i / 120;
      pts.push([xs(x), ys(hfun(x))]);
    }
    drawPolyline(ctx, pts, COLORS.green, 2.5, 0.88);
    const start = 0.28;
    const target = 0.75;
    const current = lerp(start, target, recovery);
    ctx.save();
    ctx.setLineDash([5, 5]);
    ctx.strokeStyle = rgba(COLORS.yellow, 0.55);
    ctx.beginPath();
    ctx.moveTo(xs(target), area.y);
    ctx.lineTo(xs(target), area.y + area.h);
    ctx.stroke();
    ctx.restore();
    drawArrow(ctx, xs(start), ys(hfun(start)), xs(current), ys(hfun(current)), COLORS.blueSoft, 2.1);
    drawDot(ctx, xs(current), ys(hfun(current)), COLORS.blue, 6.2, true);
    drawDot(ctx, xs(target), ys(hfun(target)), COLORS.yellow, 4.0, false);
    drawPill(ctx, `π̂ = ${fmt(current)}`, area.x + 9, area.y + 9, COLORS.blue);
    drawPill(ctx, "local maximizer 0.750", area.x + area.w - 8, area.y + 9, COLORS.yellow, "right");
    const residual = lerp(0.18, 0.0012, recovery * recovery);
    ctx.fillStyle = COLORS.muted;
    ctx.font = "10px Inter, system-ui, sans-serif";
    ctx.fillText(`stationarity residual  ${expFmt(residual)}`, area.x + 8, area.y + area.h - 9);
  }

  function drawConstraints1(ctx, width, height) {
    drawBackground(ctx, width, height);
    const { warm } = stageProgress();
    const leftW = width * 0.43;
    const nodes = [3, 5, 3];
    const xs = [leftW * 0.17, leftW * 0.49, leftW * 0.82];
    const ys = nodes.map((n) => Array.from({ length: n }, (_, i) => height * 0.22 + i * height * 0.56 / Math.max(1, n - 1)));
    ctx.fillStyle = COLORS.text;
    ctx.font = "800 10px Inter, system-ui, sans-serif";
    ctx.fillText("activation-constrained policy", 13, 19);
    for (let l = 0; l < 2; l += 1) {
      ys[l].forEach((y0) => ys[l + 1].forEach((y1, j) => {
        ctx.beginPath();
        ctx.moveTo(xs[l], y0);
        ctx.lineTo(xs[l + 1], y1);
        ctx.strokeStyle = `rgba(143,216,255,${0.10 + 0.16 * warm + 0.02 * (j % 2)})`;
        ctx.stroke();
      }));
    }
    ys.forEach((layer, l) => layer.forEach((y) => drawDot(ctx, xs[l], y, l === 1 ? COLORS.orange : COLORS.blue, 4.8, false)));
    const sx = width * 0.56;
    const sy = height * 0.83;
    const size = Math.min(width * 0.35, height * 0.68);
    ctx.beginPath();
    ctx.moveTo(sx, sy);
    ctx.lineTo(sx + size, sy);
    ctx.lineTo(sx, sy - size);
    ctx.closePath();
    ctx.fillStyle = "rgba(148,240,193,0.065)";
    ctx.fill();
    ctx.strokeStyle = rgba(COLORS.green, 0.72);
    ctx.lineWidth = 1.7;
    ctx.stroke();
    drawArrow(ctx, leftW * 0.88, height * 0.5, sx - 12, height * 0.5, COLORS.yellowSoft, 1.8);
    const p1 = lerp(0.12, 0.34, warm);
    const p2 = lerp(0.12, 0.28, warm) + 0.018 * Math.sin(5 * warm);
    drawDot(ctx, sx + p1 * size, sy - p2 * size, COLORS.green, 6.2, true);
    ctx.fillStyle = COLORS.green;
    ctx.font = "800 10px Inter, system-ui, sans-serif";
    ctx.fillText("strictly feasible", sx + size * 0.27, sy - size * 0.62);
    ctx.fillStyle = COLORS.muted;
    ctx.font = "10px Inter, system-ui, sans-serif";
    ctx.fillText("u₁", sx + size - 7, sy + 15);
    ctx.fillText("u₂", sx - 20, sy - size + 5);
    ctx.fillText("cash = 1 − u₁ − u₂", sx + 9, sy - 9);
    drawPill(ctx, "feasible ≠ KKT-stationary", 13, height - 30, COLORS.yellow);
  }

  function drawConstraints3(ctx, width, height) {
    drawBackground(ctx, width, height);
    const { recovery } = stageProgress();
    const area = { x: 50, y: 36, w: width - 72, h: height - 74 };
    drawGrid(ctx, area, 4, 6);
    drawAxes(ctx, area, "risky weight u₁", "risky weight u₂");
    const xmin = -0.20;
    const xmax = 1.0;
    const xs = (u) => area.x + (u - xmin) / (xmax - xmin) * area.w;
    const ys = (u) => area.y + area.h - u * area.h;
    const boundaryX = xs(0);
    ctx.fillStyle = "rgba(255,133,133,0.04)";
    ctx.fillRect(area.x, area.y, boundaryX - area.x, area.h);
    ctx.beginPath();
    ctx.moveTo(xs(0), ys(0));
    ctx.lineTo(xs(1), ys(0));
    ctx.lineTo(xs(0), ys(1));
    ctx.closePath();
    ctx.fillStyle = "rgba(148,240,193,0.07)";
    ctx.fill();
    ctx.strokeStyle = rgba(COLORS.green, 0.70);
    ctx.lineWidth = 1.8;
    ctx.stroke();
    ctx.save();
    ctx.setLineDash([5, 5]);
    ctx.strokeStyle = rgba(COLORS.red, 0.60);
    ctx.beginPath();
    ctx.moveTo(boundaryX, area.y);
    ctx.lineTo(boundaryX, area.y + area.h);
    ctx.stroke();
    ctx.restore();

    ctx.fillStyle = COLORS.red;
    ctx.font = "800 9px Inter, system-ui, sans-serif";
    ctx.fillText("infeasible", area.x + 8, area.y + 15);
    ctx.fillStyle = COLORS.text;
    ctx.font = "800 8.5px Inter, system-ui, sans-serif";
    ctx.fillText("binding face  u₁ = 0", boundaryX + 6, area.y + 29);

    const qpTargets = {
      active: [0.0, 0.58],
      near: [0.035, 0.47],
      interior: [0.28, 0.24],
    };
    const barrierTargets = {
      active: [0.025, 0.56],
      near: [0.050, 0.455],
      interior: [0.276, 0.238],
    };
    const starts = {
      active: [0.22, 0.42],
      near: [0.20, 0.35],
      interior: [0.16, 0.14],
    };
    const colors = { active: COLORS.red, near: COLORS.yellow, interior: COLORS.green };
    const labels = { active: "A", near: "N", interior: "I" };
    const targets = state.constraintSolver === "qp" ? qpTargets : barrierTargets;
    Object.keys(starts).forEach((key) => {
      const start = starts[key];
      const target = targets[key];
      const current = [lerp(start[0], target[0], recovery), lerp(start[1], target[1], recovery)];
      drawArrow(ctx, xs(start[0]), ys(start[1]), xs(current[0]), ys(current[1]), rgba(colors[key], 0.30), 1.8);
      ctx.save();
      ctx.setLineDash([3, 4]);
      ctx.strokeStyle = rgba(colors[key], 0.65);
      ctx.beginPath();
      ctx.arc(xs(target[0]), ys(target[1]), 7.5, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
      drawDot(ctx, xs(current[0]), ys(current[1]), colors[key], 5.7, true);
      ctx.fillStyle = COLORS.text;
      ctx.font = "800 10px Inter, system-ui, sans-serif";
      ctx.fillText(labels[key], xs(current[0]) + 8, ys(current[1]) - 7);
    });
    drawPill(ctx, state.constraintSolver === "qp" ? "Exact QP / KKT" : "Log-barrier central path", area.x + area.w - 7, area.y + 8, COLORS.green, "right");
  }

  function drawTransaction1(ctx, width, height) {
    drawBackground(ctx, width, height);
    const { warm } = stageProgress();
    const left = 44;
    const right = 17;
    const top = 30;
    const bottom = 25;
    const gap = 18;
    const ph = (height - top - bottom - gap) / 2;
    const panels = [
      { y: top, h: ph, label: "cash X", color: COLORS.blue, base: (p, t) => 0.52 + 0.06 * t + 0.035 * pathNoise(p, t) },
      { y: top + ph + gap, h: ph, label: "risky position Y", color: COLORS.orange, base: (p, t) => 0.36 + 0.08 * t + 0.045 * pathNoise(p + 5, t) },
    ];
    const n = 80;
    const reveal = Math.max(1, Math.floor(n * warm));
    panels.forEach((panel) => {
      const area = { x: left, y: panel.y, w: width - left - right, h: panel.h };
      drawGrid(ctx, area, 3, 6);
      const xs = (k) => area.x + area.w * k / n;
      const ys = (v) => area.y + area.h - (v - 0.18) / 0.62 * area.h;
      for (let p = 0; p < 12; p += 1) {
        const pts = [];
        for (let k = 0; k <= reveal; k += 1) {
          const t = k / n;
          pts.push([xs(k), ys(panel.base(p, t))]);
        }
        drawPolyline(ctx, pts, panel.color, p < 2 ? 1.7 : 1.0, p < 2 ? 0.80 : 0.25);
      }
      ctx.fillStyle = COLORS.text;
      ctx.font = "800 10px Inter, system-ui, sans-serif";
      ctx.fillText(panel.label, area.x + 7, area.y + 13);
    });
    drawPill(ctx, "L = X + (1−α)Y", left + 6, 7, COLORS.green);
    ctx.fillStyle = COLORS.muted;
    ctx.font = "10px Inter, system-ui, sans-serif";
    ctx.textAlign = "right";
    ctx.fillText("ε-regularized trading-rate rollouts", width - right, 18);
    ctx.fillText("time", width - right, height - 6);
    ctx.textAlign = "left";
  }

  function transactionQueries() {
    const { adjoint, recovery } = stageProgress();
    const u = Math.max(adjoint, recovery);
    return [
      { id: "sell", label: "S", color: COLORS.red, start: 0.900, target: 0.875, threshold: 0.94 },
      { id: "hold", label: "H", color: COLORS.green, start: 0.970, target: 0.980, threshold: 0.94 },
      { id: "buy", label: "B", color: COLORS.orange, start: 1.020, target: 1.035, threshold: 1.0 },
    ].map((q) => ({ ...q, current: lerp(q.start, q.target, u) }));
  }

  function drawTransaction2(ctx, width, height) {
    drawAdjointPanels(ctx, width, height, "transaction");
    const { adjoint } = stageProgress();
    const q = transactionQueries();
    const y = height - 28;
    const left = 44;
    const right = 18;
    const xs = (r) => left + (r - 0.84) / 0.22 * (width - left - right);
    ctx.save();
    ctx.strokeStyle = "rgba(255,255,255,0.16)";
    ctx.beginPath();
    ctx.moveTo(left, y);
    ctx.lineTo(width - right, y);
    ctx.stroke();
    [0.94, 1.0].forEach((r) => {
      ctx.setLineDash([3, 4]);
      ctx.strokeStyle = rgba(COLORS.yellow, 0.55);
      ctx.beginPath();
      ctx.moveTo(xs(r), y - 14);
      ctx.lineTo(xs(r), y + 6);
      ctx.stroke();
    });
    ctx.setLineDash([]);
    q.forEach((item) => drawDot(ctx, xs(item.current), y, item.color, 4.2, adjoint > 0.01));
    ctx.fillStyle = COLORS.muted;
    ctx.font = "9px Inter, system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("1−α", xs(0.94), y + 16);
    ctx.fillText("1", xs(1.0), y + 16);
    ctx.textAlign = "left";
    ctx.restore();
  }

  function deadZone(r, alpha = 0.06, eps = 0.25) {
    if (r > 1) return (r - 1) / eps;
    if (r < 1 - alpha) return (r - (1 - alpha)) / eps;
    return 0;
  }

  function drawTransaction3(ctx, width, height) {
    drawBackground(ctx, width, height);
    const { recovery } = stageProgress();
    const area = { x: 47, y: 35, w: width - 67, h: height - 76 };
    drawGrid(ctx, area, 4, 7);
    drawAxes(ctx, area, "adjoint ratio R = λᵧ/λₓ", "projected rate Pε(R)");
    const xmin = 0.82;
    const xmax = 1.10;
    const ymin = -0.55;
    const ymax = 0.55;
    const xs = (r) => area.x + (r - xmin) / (xmax - xmin) * area.w;
    const ys = (u) => area.y + area.h - (u - ymin) / (ymax - ymin) * area.h;
    const pts = [];
    for (let i = 0; i <= 160; i += 1) {
      const r = xmin + (xmax - xmin) * i / 160;
      pts.push([xs(r), ys(deadZone(r))]);
    }
    drawPolyline(ctx, pts, COLORS.green, 2.6, 0.90);
    const lo = 0.94;
    const hi = 1.0;
    ctx.fillStyle = "rgba(148,240,193,0.07)";
    ctx.fillRect(xs(lo), area.y, xs(hi) - xs(lo), area.h);
    [lo, hi].forEach((r) => {
      ctx.save();
      ctx.setLineDash([5, 5]);
      ctx.strokeStyle = rgba(COLORS.yellow, 0.60);
      ctx.beginPath();
      ctx.moveTo(xs(r), area.y);
      ctx.lineTo(xs(r), area.y + area.h);
      ctx.stroke();
      ctx.restore();
    });
    const q = transactionQueries();
    q.forEach((item) => {
      const startU = deadZone(item.start);
      const currentR = lerp(item.start, item.target, recovery);
      const currentU = deadZone(currentR);
      drawArrow(ctx, xs(item.start), ys(startU), xs(currentR), ys(currentU), rgba(item.color, 0.33), 1.8);
      drawDot(ctx, xs(currentR), ys(currentU), item.color, 5.8, true);
      ctx.fillStyle = COLORS.text;
      ctx.font = "800 10px Inter, system-ui, sans-serif";
      ctx.fillText(item.label, xs(currentR) + 8, ys(currentU) - 7);
    });
    drawPill(ctx, "SELL", xs(0.85), area.y + 8, COLORS.red);
    drawPill(ctx, "HOLD", (xs(lo) + xs(hi)) / 2 - 24, area.y + 8, COLORS.green);
    drawPill(ctx, "BUY", xs(1.055), area.y + 8, COLORS.orange);
  }

  function nonexpCaseInfo() {
    return {
      1: { name: "Case 1", short: "survival", mult: true, homogeneous: false, target: "OPTIMAL", color: COLORS.blue },
      2: { name: "Case 2", short: "hyperbolic", mult: false, homogeneous: true, target: "EQUIL.", color: COLORS.orange },
      3: { name: "Case 3", short: "time-varying", mult: false, homogeneous: false, target: "EQUIL.", color: COLORS.purple },
    }[state.nonexpCase];
  }

  function drawNonexp1(ctx, width, height) {
    drawBackground(ctx, width, height);
    const { warm } = stageProgress();
    const info = nonexpCaseInfo();
    const margin = 24;
    const gridX = margin;
    const gridY = 45;
    const gridW = Math.min(width * 0.58, 300);
    const gridH = height - 72;
    const cellW = gridW / 2;
    const cellH = gridH / 2;
    ctx.fillStyle = COLORS.text;
    ctx.font = "800 10px Inter, system-ui, sans-serif";
    ctx.fillText("Multiplicative?", gridX, 19);
    ctx.fillStyle = COLORS.muted;
    ctx.font = "9px Inter, system-ui, sans-serif";
    ctx.fillText("yes", gridX + cellW * 0.44, 34);
    ctx.fillText("no", gridX + cellW * 1.46, 34);
    ctx.save();
    ctx.translate(10, gridY + gridH * 0.72);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText("Time homogeneous?  yes / no", 0, 0);
    ctx.restore();
    const cells = [
      { x: 0, y: 0, label: "Exponential", sub: "recursion + stationarity", mult: true, hom: true, color: COLORS.green },
      { x: 1, y: 0, label: "Case 2", sub: "equilibrium", mult: false, hom: true, color: COLORS.orange },
      { x: 0, y: 1, label: "Case 1", sub: "non-stationary", mult: true, hom: false, color: COLORS.blue },
      { x: 1, y: 1, label: "Case 3", sub: "general D(s,t)", mult: false, hom: false, color: COLORS.purple },
    ];
    cells.forEach((cell) => {
      const x = gridX + cell.x * cellW;
      const y = gridY + cell.y * cellH;
      const active = cell.mult === info.mult && cell.hom === info.hom;
      roundedRect(ctx, x + 4, y + 4, cellW - 8, cellH - 8, 11);
      ctx.fillStyle = active ? rgba(cell.color, 0.13 + 0.09 * warm) : "rgba(255,255,255,0.025)";
      ctx.fill();
      ctx.strokeStyle = active ? rgba(cell.color, 0.72) : "rgba(255,255,255,0.09)";
      ctx.lineWidth = active ? 1.8 : 1;
      ctx.stroke();
      ctx.fillStyle = active ? cell.color : COLORS.text;
      ctx.font = "800 10px Inter, system-ui, sans-serif";
      ctx.fillText(cell.label, x + 13, y + 23);
      ctx.fillStyle = COLORS.muted;
      ctx.font = "9px Inter, system-ui, sans-serif";
      clipText(ctx, cell.sub, x + 13, y + 39, cellW - 28);
    });

    const plot = { x: gridX + gridW + 25, y: 35, w: width - (gridX + gridW + 43), h: height - 68 };
    if (plot.w > 105) {
      drawGrid(ctx, plot, 4, 5);
      drawAxes(ctx, plot, "remaining horizon", "D(t₀,t)");
      const xs = (t) => plot.x + t * plot.w;
      const ys = (d) => plot.y + plot.h - d * plot.h;
      const curves = [
        { t0: 0.18, color: COLORS.blue },
        { t0: 0.50, color: COLORS.orange },
        { t0: 0.82, color: COLORS.purple },
      ];
      curves.forEach((q, i) => {
        const pts = [];
        for (let k = 0; k <= 70 * warm; k += 1) {
          const s = k / 70;
          let d;
          if (state.nonexpCase === 1) d = Math.pow((0.34 + q.t0) / (0.34 + q.t0 + s * (1 - q.t0)), 1.4);
          else if (state.nonexpCase === 2) d = 1 / (1 + 2.4 * s * (1 - q.t0));
          else d = 1 / (1 + (1.6 + 1.4 * q.t0) * s * (1 - q.t0));
          pts.push([xs(s), ys(d)]);
        }
        drawPolyline(ctx, pts, q.color, 2.0, 0.86);
      });
      drawPill(ctx, `${info.name}: ${info.short}`, plot.x + 6, plot.y + 6, info.color);
    }
  }

  function drawNonexp2(ctx, width, height) {
    drawBackground(ctx, width, height);
    const { adjoint } = stageProgress();
    const area = { x: 44, y: 36, w: width - 62, h: height - 72 };
    drawGrid(ctx, area, 4, 6);
    drawAxes(ctx, area, "time", "anchored adjoint λᵗ⁰(t)");
    const anchors = [
      { t: 0.18, color: COLORS.blue, label: "early" },
      { t: 0.50, color: COLORS.orange, label: "middle" },
      { t: 0.82, color: COLORS.purple, label: "late" },
    ];
    const xs = (t) => area.x + t * area.w;
    const ys = (v) => area.y + area.h - (v - 0.72) / 0.72 * area.h;
    anchors.forEach((q, ai) => {
      const pathCount = Math.max(1, Math.floor(1 + adjoint * 5));
      const active = adjoint * 5 - Math.floor(adjoint * 5);
      for (let p = 0; p < pathCount; p += 1) {
        const reveal = p === pathCount - 1 && pathCount < 6 ? active : 1;
        const front = 1 - reveal;
        const pts = [];
        const startK = Math.round(90 * (q.t + front * (1 - q.t)));
        for (let k = 90; k >= startK; k -= 1) {
          const t = k / 90;
          const s = (t - q.t) / Math.max(1e-6, 1 - q.t);
          const base = 1.30 - 0.42 * s + 0.10 * q.t + 0.035 * Math.sin(4.8 * s + 1.2 * q.t);
          const v = base + (0.014 + 0.004 * p) * pathNoise(p + ai * 7, s) * (1 - 0.35 * s);
          pts.push([xs(t), ys(v)]);
        }
        drawPolyline(ctx, pts, q.color, p < 2 ? 1.5 : 1.0, p === pathCount - 1 && reveal < 1 ? 0.95 : 0.30);
      }
      if (adjoint > 0.28) {
        const pts = [];
        for (let k = Math.round(90 * q.t); k <= 90; k += 1) {
          const t = k / 90;
          const s = (t - q.t) / (1 - q.t);
          const base = 1.30 - 0.42 * s + 0.10 * q.t + 0.035 * Math.sin(4.8 * s + 1.2 * q.t);
          pts.push([xs(t), ys(base)]);
        }
        drawPolyline(ctx, pts, q.color, 2.4, clamp((adjoint - 0.2) / 0.5));
      }
      drawDot(ctx, xs(q.t), ys(1.30 + 0.10 * q.t), q.color, 4.6, adjoint > 0.02);
      ctx.fillStyle = q.color;
      ctx.font = "800 9px Inter, system-ui, sans-serif";
      ctx.fillText("t₀=t", xs(q.t) + 7, ys(1.30 + 0.10 * q.t) - 7);
    });
    drawPill(ctx, "diagonal points", area.x + area.w - 6, area.y + 8, COLORS.yellow, "right");
  }

  function nonexpQueries() {
    const info = nonexpCaseInfo();
    const targets = state.nonexpCase === 1 ? [1.30, 1.10, 0.92] : state.nonexpCase === 2 ? [1.34, 1.18, 0.88] : [1.38, 1.03, 1.01];
    return [
      { id: "early", label: "E", t: 0.18, warm: 1.02, target: targets[0], color: COLORS.blue },
      { id: "middle", label: "M", t: 0.50, warm: 1.30, target: targets[1], color: COLORS.orange },
      { id: "late", label: "L", t: 0.82, warm: 1.12, target: targets[2], color: COLORS.purple },
    ].map((q) => ({ ...q, status: info.target }));
  }

  function drawNonexp3(ctx, width, height) {
    drawBackground(ctx, width, height);
    const { recovery } = stageProgress();
    const area = { x: 46, y: 36, w: width - 64, h: height - 75 };
    drawGrid(ctx, area, 4, 6);
    drawAxes(ctx, area, "decision time t", "action u");
    const xs = (t) => area.x + t * area.w;
    const ys = (u) => area.y + area.h - (u - 0.68) / 0.88 * area.h;
    const q = nonexpQueries();
    const targetPts = q.map((item) => [xs(item.t), ys(item.target)]);
    drawPolyline(ctx, targetPts, COLORS.yellow, 1.6, 0.60, [5, 5]);
    q.forEach((item) => {
      const current = lerp(item.warm, item.target, recovery);
      drawArrow(ctx, xs(item.t), ys(item.warm), xs(item.t), ys(current), rgba(item.color, 0.34), 2);
      drawDot(ctx, xs(item.t), ys(current), item.color, 6.0, true);
      ctx.fillStyle = COLORS.text;
      ctx.font = "800 10px Inter, system-ui, sans-serif";
      ctx.fillText(item.label, xs(item.t) + 8, ys(current) - 7);
    });
    const info = nonexpCaseInfo();
    drawPill(ctx, `${info.name} · ${info.target}`, area.x + area.w - 7, area.y + 8, info.color, "right");
    const res = lerp(0.12, 0.0015, recovery * recovery);
    ctx.fillStyle = COLORS.muted;
    ctx.font = "10px Inter, system-ui, sans-serif";
    ctx.fillText(`diagonal stationarity residual  ${expFmt(res)}`, area.x + 8, area.y + area.h - 9);
  }

  function delayInfo() {
    return {
      state: { name: "State delay", color: COLORS.blue, delta: 0.22, kink: 0.63 },
      control: { name: "Control delay", color: COLORS.orange, delta: 0.30, kink: 0.54 },
      distributed: { name: "Distributed delay", color: COLORS.purple, delta: 0.36, kink: 0.72 },
    }[state.delayKind];
  }

  function drawDelay1(ctx, width, height) {
    drawBackground(ctx, width, height);
    const { warm } = stageProgress();
    const info = delayInfo();
    const left = 28;
    const right = width - 24;
    const y = height * 0.58;
    ctx.strokeStyle = "rgba(255,255,255,0.14)";
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(left, y);
    ctx.lineTo(right, y);
    ctx.stroke();
    const tNow = lerp(0.28, 0.72, warm);
    const xNow = lerp(left, right, tNow);
    const xPast = lerp(left, right, Math.max(0, tNow - info.delta));
    ctx.fillStyle = rgba(info.color, 0.09);
    roundedRect(ctx, xPast, y - 26, xNow - xPast, 52, 11);
    ctx.fill();
    ctx.strokeStyle = rgba(info.color, 0.52);
    ctx.stroke();
    ctx.fillStyle = info.color;
    ctx.font = "800 10px Inter, system-ui, sans-serif";
    ctx.fillText("history Hₜ", xPast + 8, y - 34);
    drawDot(ctx, xNow, y, COLORS.yellow, 5.5, true);
    ctx.fillStyle = COLORS.text;
    ctx.fillText("t", xNow - 3, y + 22);
    const points = [];
    for (let i = 0; i <= 80; i += 1) {
      const u = i / 80;
      const x = left + u * (right - left);
      const yy = y - 5 - 18 * Math.sin(4.4 * u + 0.2) - 8 * Math.sin(12.5 * u);
      points.push([x, yy]);
    }
    drawPolyline(ctx, points, COLORS.blue, 1.6, 0.60);

    const boxX = Math.max(18, width * 0.34);
    const boxY = 18;
    const boxW = Math.min(190, width * 0.38);
    const boxH = 68;
    roundedRect(ctx, boxX, boxY, boxW, boxH, 12);
    ctx.fillStyle = "rgba(11,24,40,0.92)";
    ctx.fill();
    ctx.strokeStyle = rgba(COLORS.green, 0.28);
    ctx.stroke();
    ctx.fillStyle = COLORS.text;
    ctx.font = "800 10px Inter, system-ui, sans-serif";
    ctx.fillText("recurrent continuation policy", boxX + 12, boxY + 19);
    ctx.fillStyle = COLORS.muted;
    ctx.font = "9px Inter, system-ui, sans-serif";
    ctx.fillText("LSTM hidden state", boxX + 12, boxY + 37);
    ctx.fillText("history → action uθ(t)", boxX + 12, boxY + 53);
    drawArrow(ctx, xNow, y - 28, boxX + boxW * 0.52, boxY + boxH, COLORS.greenSoft, 1.8);
    drawPill(ctx, info.name, 14, 14, info.color);
  }

  function drawDelay2(ctx, width, height) {
    drawBackground(ctx, width, height);
    const { adjoint } = stageProgress();
    const info = delayInfo();
    const area = { x: 44, y: 36, w: width - 62, h: height - 73 };
    drawGrid(ctx, area, 4, 6);
    drawAxes(ctx, area, "time", "delay adjoint p(t)");
    const xs = (t) => area.x + t * area.w;
    const ys = (v) => area.y + area.h - (v - 0.58) / 0.88 * area.h;
    const base = (t) => 1.28 - 0.48 * t + 0.08 * Math.sin(5.2 * t) + (state.delayKind === "distributed" ? 0.04 * Math.sin(12 * t) : 0);
    const pathCount = Math.max(1, Math.floor(1 + 7 * adjoint));
    const active = 7 * adjoint - Math.floor(7 * adjoint);
    for (let p = 0; p < pathCount; p += 1) {
      const reveal = p === pathCount - 1 && pathCount < 8 ? active : 1;
      const front = 1 - reveal;
      const pts = [];
      for (let k = 90; k >= Math.round(front * 90); k -= 1) {
        const t = k / 90;
        pts.push([xs(t), ys(base(t) + (0.018 + 0.004 * p) * pathNoise(p, t) * (1 - 0.3 * t))]);
      }
      drawPolyline(ctx, pts, info.color, p < 2 ? 1.5 : 1.0, p === pathCount - 1 && reveal < 1 ? 0.95 : 0.30);
    }
    if (adjoint > 0.25) {
      const pts = [];
      for (let k = 0; k <= 90; k += 1) {
        const t = k / 90;
        pts.push([xs(t), ys(base(t))]);
      }
      drawPolyline(ctx, pts, info.color, 2.5, clamp((adjoint - 0.20) / 0.50));
    }
    const t0 = 0.34;
    const tf = Math.min(0.95, t0 + info.delta);
    drawArrow(ctx, xs(tf), ys(base(tf)) - 12, xs(t0), ys(base(t0)) - 12, rgba(COLORS.yellow, 0.74), 2.0);
    drawDot(ctx, xs(tf), ys(base(tf)), COLORS.yellow, 4.2, true);
    drawDot(ctx, xs(t0), ys(base(t0)), info.color, 4.8, true);
    ctx.fillStyle = COLORS.yellow;
    ctx.font = "800 9px Inter, system-ui, sans-serif";
    ctx.fillText("future re-entry  t+δ", xs(tf) - 34, ys(base(tf)) - 20);
    ctx.fillStyle = COLORS.text;
    ctx.fillText("present t", xs(t0) - 17, ys(base(t0)) + 19);
    if (state.delayKind === "control") {
      drawPill(ctx, "anticipated control term", area.x + area.w - 6, area.y + 8, COLORS.orange, "right");
    } else if (state.delayKind === "distributed") {
      drawPill(ctx, "weighted future interval", area.x + area.w - 6, area.y + 8, COLORS.purple, "right");
    } else {
      drawPill(ctx, "anticipated state derivative", area.x + area.w - 6, area.y + 8, COLORS.blue, "right");
    }
  }

  function delayCurve(t, kind) {
    const info = delayInfo();
    if (kind === "target") {
      if (state.delayKind === "control") return t < info.kink ? 4.2 + 2.8 * t : 3.05 + 2.2 * (t - info.kink);
      if (state.delayKind === "distributed") return 0.4 + 4.8 * Math.max(0, t - info.kink) + 0.35 * Math.exp(-45 * Math.pow(t - 0.35, 2));
      return 0.88 + 0.12 * Math.tanh(12 * (t - info.kink));
    }
    if (kind === "smooth") {
      if (state.delayKind === "control") return 4.2 + 2.1 * t - 1.95 / (1 + Math.exp(-18 * (t - info.kink)));
      if (state.delayKind === "distributed") return 0.4 + 4.1 * Math.log1p(Math.exp(10 * (t - info.kink))) / 10 + 0.20 * Math.exp(-20 * Math.pow(t - 0.35, 2));
      return 0.88 + 0.12 * Math.tanh(4.4 * (t - info.kink));
    }
    return lerp(delayCurve(t, "smooth"), delayCurve(t, "target"), stageProgress().recovery);
  }

  function drawDelay3(ctx, width, height) {
    drawBackground(ctx, width, height);
    const { recovery } = stageProgress();
    const info = delayInfo();
    const area = { x: 45, y: 36, w: width - 63, h: height - 74 };
    drawGrid(ctx, area, 4, 6);
    drawAxes(ctx, area, "time", state.delayKind === "state" ? "consumption" : "control");
    const samples = 120;
    const targetVals = [];
    const smoothVals = [];
    const projectedVals = [];
    for (let i = 0; i <= samples; i += 1) {
      const t = i / samples;
      targetVals.push(delayCurve(t, "target"));
      smoothVals.push(delayCurve(t, "smooth"));
      projectedVals.push(delayCurve(t, "projected"));
    }
    const all = targetVals.concat(smoothVals);
    const ymin = Math.min(...all) - 0.08 * (Math.max(...all) - Math.min(...all) + 1e-6);
    const ymax = Math.max(...all) + 0.08 * (Math.max(...all) - Math.min(...all) + 1e-6);
    const xs = (t) => area.x + t * area.w;
    const ys = (v) => area.y + area.h - (v - ymin) / (ymax - ymin) * area.h;
    const ptsTarget = targetVals.map((v, i) => [xs(i / samples), ys(v)]);
    const ptsSmooth = smoothVals.map((v, i) => [xs(i / samples), ys(v)]);
    const ptsProjected = projectedVals.map((v, i) => [xs(i / samples), ys(v)]);
    drawPolyline(ctx, ptsTarget, COLORS.text.startsWith("#") ? COLORS.text : "#f1f6ff", 1.6, 0.70, [5, 5]);
    drawPolyline(ctx, ptsSmooth, COLORS.blue, 2.0, 0.62);
    drawPolyline(ctx, ptsProjected, COLORS.orange, 2.7, 0.40 + 0.60 * recovery);
    const kx = xs(info.kink);
    ctx.save();
    ctx.setLineDash([4, 5]);
    ctx.strokeStyle = rgba(COLORS.yellow, 0.62);
    ctx.beginPath();
    ctx.moveTo(kx, area.y);
    ctx.lineTo(kx, area.y + area.h);
    ctx.stroke();
    ctx.restore();
    drawPill(ctx, "switch / kink", kx + 7, area.y + 8, COLORS.yellow);
    drawLegendLine(ctx, area.x + 7, area.y + area.h - 31, "#f1f6ff", "reference", [5, 5]);
    drawLegendLine(ctx, area.x + 90, area.y + area.h - 31, COLORS.blue, "LSTM-DPO");
    drawLegendLine(ctx, area.x + 183, area.y + area.h - 31, COLORS.orange, "PG-DPO");
  }

  const drawers = {
    core: [drawCore1, (ctx, w, h) => drawAdjointPanels(ctx, w, h, "core"), drawCore3],
    constraints: [drawConstraints1, (ctx, w, h) => drawAdjointPanels(ctx, w, h, "constraints"), drawConstraints3],
    transaction: [drawTransaction1, drawTransaction2, drawTransaction3],
    nonexp: [drawNonexp1, drawNonexp2, drawNonexp3],
    delay: [drawDelay1, drawDelay2, drawDelay3],
  };

  function renderDetail() {
    els.details.forEach((el) => {
      el.hidden = true;
      el.innerHTML = "";
    });
    if (state.mode === "constraints") {
      const panel = els.details[2];
      panel.hidden = false;
      panel.innerHTML = `
        <div class="detail-head">
          <span>Representative query points</span>
          <div class="mini-switch" role="group" aria-label="Choose local constrained solver">
            <button type="button" class="mini-button ${state.constraintSolver === "barrier" ? "is-active" : ""}" data-solver="barrier">Barrier</button>
            <button type="button" class="mini-button ${state.constraintSolver === "qp" ? "is-active" : ""}" data-solver="qp">Exact QP</button>
          </div>
        </div>
        <div class="detail-grid">
          <div class="detail-card" data-tone="red"><div class="detail-card-head"><span>Active</span><span class="status-pill">BINDING</span></div><div class="detail-card-body" id="constraintActiveMetric"></div></div>
          <div class="detail-card" data-tone="yellow"><div class="detail-card-head"><span>Near</span><span class="status-pill">NEAR</span></div><div class="detail-card-body" id="constraintNearMetric"></div></div>
          <div class="detail-card" data-tone="green"><div class="detail-card-head"><span>Interior</span><span class="status-pill">INTERIOR</span></div><div class="detail-card-body" id="constraintInteriorMetric"></div></div>
        </div>`;
      panel.querySelectorAll("[data-solver]").forEach((button) => button.addEventListener("click", () => {
        state.constraintSolver = button.dataset.solver;
        renderDetail();
        drawAll();
      }));
    } else if (state.mode === "transaction") {
      const panel = els.details[2];
      panel.hidden = false;
      panel.innerHTML = `
        <div class="detail-head"><span>Representative query states</span><span>R̂ → Pε(R̂)</span></div>
        <div class="detail-grid">
          <div class="detail-card" data-tone="red"><div class="detail-card-head"><span>Query S</span><span class="status-pill">SELL</span></div><div class="detail-card-body" id="tcSellMetric"></div></div>
          <div class="detail-card" data-tone="green"><div class="detail-card-head"><span>Query H</span><span class="status-pill">HOLD</span></div><div class="detail-card-body" id="tcHoldMetric"></div></div>
          <div class="detail-card" data-tone="orange"><div class="detail-card-head"><span>Query B</span><span class="status-pill">BUY</span></div><div class="detail-card-body" id="tcBuyMetric"></div></div>
        </div>`;
    } else if (state.mode === "nonexp") {
      const panel = els.details[0];
      panel.hidden = false;
      panel.innerHTML = `
        <div class="detail-head">
          <span>Discount-kernel case</span>
          <div class="mini-switch" role="group" aria-label="Choose discount-kernel case">
            ${[1, 2, 3].map((c) => `<button type="button" class="mini-button ${state.nonexpCase === c ? "is-active" : ""}" data-nonexp-case="${c}">Case ${c}</button>`).join("")}
          </div>
        </div>
        <div class="detail-grid">
          <div class="detail-card" data-tone="blue"><div class="detail-card-head"><span>Case 1</span><span class="status-pill">MULT.</span></div><div class="detail-card-body">survival · time-inhomogeneous</div></div>
          <div class="detail-card" data-tone="orange"><div class="detail-card-head"><span>Case 2</span><span class="status-pill">EQUIL.</span></div><div class="detail-card-body">hyperbolic · time-homogeneous</div></div>
          <div class="detail-card" data-tone="purple"><div class="detail-card-head"><span>Case 3</span><span class="status-pill">GENERAL</span></div><div class="detail-card-body">time-varying impatience</div></div>
        </div>`;
      panel.querySelectorAll("[data-nonexp-case]").forEach((button) => button.addEventListener("click", () => {
        state.nonexpCase = Number(button.dataset.nonexpCase);
        renderDetail();
        drawAll();
      }));
    } else if (state.mode === "delay") {
      const panel = els.details[0];
      panel.hidden = false;
      panel.innerHTML = `
        <div class="detail-head">
          <span>Delay channel</span>
          <div class="mini-switch" role="group" aria-label="Choose delay channel">
            <button type="button" class="mini-button ${state.delayKind === "state" ? "is-active" : ""}" data-delay-kind="state">State</button>
            <button type="button" class="mini-button ${state.delayKind === "control" ? "is-active" : ""}" data-delay-kind="control">Control</button>
            <button type="button" class="mini-button ${state.delayKind === "distributed" ? "is-active" : ""}" data-delay-kind="distributed">Distributed</button>
          </div>
        </div>
        <div class="detail-grid">
          <div class="detail-card" data-tone="blue"><div class="detail-card-head"><span>State delay</span><span class="status-pill">ABSDE</span></div><div class="detail-card-body">future state derivative</div></div>
          <div class="detail-card" data-tone="orange"><div class="detail-card-head"><span>Control</span><span class="status-pill">t+δ FOC</span></div><div class="detail-card-body">branching term at t+δᵤ</div></div>
          <div class="detail-card" data-tone="purple"><div class="detail-card-head"><span>Memory</span><span class="status-pill">DISTRIB.</span></div><div class="detail-card-body">weighted history aggregate</div></div>
        </div>`;
      panel.querySelectorAll("[data-delay-kind]").forEach((button) => button.addEventListener("click", () => {
        state.delayKind = button.dataset.delayKind;
        renderDetail();
        drawAll();
      }));
    }
    updateMetrics();
  }

  function updateMetrics() {
    const { recovery } = stageProgress();
    if (state.mode === "constraints") {
      const qp = state.constraintSolver === "qp";
      const targets = qp ? [[0, 0.58], [0.035, 0.47], [0.28, 0.24]] : [[0.025, 0.56], [0.05, 0.455], [0.276, 0.238]];
      const starts = [[0.22, 0.42], [0.20, 0.35], [0.16, 0.14]];
      const ids = ["constraintActiveMetric", "constraintNearMetric", "constraintInteriorMetric"];
      ids.forEach((id, i) => {
        const el = document.getElementById(id);
        if (!el) return;
        const u1 = lerp(starts[i][0], targets[i][0], recovery);
        const u2 = lerp(starts[i][1], targets[i][1], recovery);
        const r0 = [5.2e-2, 3.6e-2, 2.8e-2][i];
        const r1 = qp ? [1e-8, 2e-8, 8e-9][i] : [7e-4, 6e-4, 3e-4][i];
        const res = r1 + (r0 - r1) * Math.pow(1 - recovery, 2.2);
        el.textContent = `u = (${fmt(u1)}, ${fmt(u2)}) · res. ${expFmt(res)}`;
      });
    } else if (state.mode === "transaction") {
      const queries = transactionQueries();
      const ids = ["tcSellMetric", "tcHoldMetric", "tcBuyMetric"];
      queries.forEach((q, i) => {
        const el = document.getElementById(ids[i]);
        if (!el) return;
        el.textContent = `R̂ = ${fmt(q.current)} · û = ${fmt(deadZone(q.current))}`;
      });
    }
  }

  function updateContent() {
    const config = modes[state.mode];
    els.titles.forEach((el, i) => { el.textContent = config.titles[i]; });
    els.badges.forEach((el, i) => { el.textContent = config.badges[i]; });
    els.captions.forEach((el, i) => { el.textContent = config.captions[i]; });
    config.equations.forEach((eq, i) => {
      els.equationTitles[i].textContent = eq.title;
      els.equationBodies[i].innerHTML = eq.body;
      els.equationBodies[i].classList.toggle("is-dense", state.mode === "constraints" || state.mode === "delay");
    });
    els.scopeTitle.textContent = config.scopeTitle;
    els.scopeBody.innerHTML = config.scopeBody;
    els.footerMode.textContent = config.label;
    els.modeButtons.forEach((button) => {
      const active = button.dataset.mode === state.mode;
      button.classList.toggle("is-active", active);
      button.setAttribute("aria-pressed", String(active));
      if (active) button.scrollIntoView({ block: "nearest", inline: "center", behavior: reducedMotion ? "auto" : "smooth" });
    });
    renderDetail();
    typesetEquations();
    updateOverflowHint();
  }

  function typesetEquations() {
    const root = document.getElementById("equationsGrid");
    if (!window.MathJax?.typesetPromise) return;
    if (window.MathJax.typesetClear) window.MathJax.typesetClear([root]);
    window.MathJax.typesetPromise([root]).catch((error) => console.warn("MathJax typesetting failed", error));
  }

  function updateStage() {
    const index = state.progress < 1 / 3 ? 0 : state.progress < 2 / 3 ? 1 : 2;
    els.stages.forEach((el, i) => el.classList.toggle("is-active", i === index && (state.playing || state.progress > 0)));
  }

  function drawAll() {
    const modeDrawers = drawers[state.mode];
    els.canvases.forEach((canvas, i) => {
      const { ctx, width, height } = setupCanvas(canvas);
      modeDrawers[i](ctx, width, height);
    });
    updateStage();
    updateMetrics();
  }

  function updateOverflowHint() {
    if (!els.modeSwitch || !els.modeShell) return;
    const canScroll = els.modeSwitch.scrollWidth > els.modeSwitch.clientWidth + 4;
    const rightOverflow = canScroll && els.modeSwitch.scrollLeft < els.modeSwitch.scrollWidth - els.modeSwitch.clientWidth - 5;
    const leftOverflow = canScroll && els.modeSwitch.scrollLeft > 5;
    els.modeShell.classList.toggle("has-overflow", rightOverflow);
    els.modeShell.classList.toggle("has-left-overflow", leftOverflow);
  }

  function startAnimation(reset = true) {
    if (reducedMotion) {
      state.progress = 1;
      state.playing = false;
      drawAll();
      return;
    }
    if (reset || state.progress >= 0.999) state.progress = 0;
    state.playing = true;
    state.lastTimestamp = 0;
    cancelAnimationFrame(state.frame);
    state.frame = requestAnimationFrame(animate);
  }

  function resetAnimation() {
    state.playing = false;
    state.progress = reducedMotion ? 1 : 0;
    state.lastTimestamp = 0;
    cancelAnimationFrame(state.frame);
    drawAll();
  }

  function animate(timestamp) {
    if (!state.playing) return;
    if (!state.lastTimestamp) state.lastTimestamp = timestamp;
    const dt = Math.min(0.08, (timestamp - state.lastTimestamp) / 1000);
    state.lastTimestamp = timestamp;
    state.progress = clamp(state.progress + dt / 10.5);
    drawAll();
    if (state.progress >= 1) {
      state.playing = false;
      return;
    }
    state.frame = requestAnimationFrame(animate);
  }

  function setMode(mode, updateUrl = true) {
    if (!modes[mode]) mode = "core";
    state.mode = mode;
    state.progress = reducedMotion ? 1 : 0;
    state.playing = false;
    cancelAnimationFrame(state.frame);
    updateContent();
    drawAll();
    if (updateUrl) {
      const url = new URL(window.location.href);
      url.searchParams.set("example", modes[mode].url);
      url.searchParams.delete("mode");
      history.replaceState({}, "", url);
    }
    startAnimation(false);
  }

  function initialMode() {
    const params = new URLSearchParams(window.location.search);
    const requested = (params.get("example") || params.get("mode") || "smooth").toLowerCase();
    const aliases = {
      smooth: "core",
      core: "core",
      merton: "core",
      constraints: "constraints",
      constrained: "constraints",
      "transaction-costs": "transaction",
      transaction: "transaction",
      nonexp: "nonexp",
      "non-exponential": "nonexp",
      delay: "delay",
      kinks: "delay",
    };
    return aliases[requested] || "core";
  }

  els.play?.addEventListener("click", () => startAnimation(true));
  els.reset?.addEventListener("click", resetAnimation);
  els.modeButtons.forEach((button) => button.addEventListener("click", () => setMode(button.dataset.mode, true)));
  els.modeSwitch?.addEventListener("scroll", updateOverflowHint, { passive: true });

  window.addEventListener("resize", () => {
    clearTimeout(state.resizeTimer);
    state.resizeTimer = setTimeout(() => {
      drawAll();
      updateOverflowHint();
    }, 80);
  });

  window.addEventListener("pgdpo:ready", () => {
    typesetEquations();
    drawAll();
  });

  state.mode = initialMode();
  updateContent();
  drawAll();
  if (!reducedMotion) setTimeout(() => startAnimation(false), 350);
})();
