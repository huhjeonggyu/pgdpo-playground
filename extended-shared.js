(() => {
  "use strict";
  const D = window.PGDemo;
  if (!D) return;

  const {
    COLORS,
    clamp,
    lerp,
    easeOut,
    setupCanvas,
    drawBackground,
    drawGrid,
    drawAxes,
    drawArrow,
  } = D;

  const stageCounts = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 100, 200, 1000];
  const stageIntervals = stageCounts.map((_, index) => (index < 10 ? 0.5 : 0.14));

  const state = {
    active: null,
    warmup: 0,
    stageIndex: 0,
    stageTimer: 0,
    playing: false,
    lastTimestamp: 0,
  };

  const customModes = new Set(["transaction", "delay"]);
  const modeButtons = Array.from(document.querySelectorAll("[data-paper-mode]"));
  const paperPanels = Array.from(document.querySelectorAll("[data-paper-panel]"));
  const equationPanels = Array.from(document.querySelectorAll("[data-paper-equations]"));
  const notePanels = Array.from(document.querySelectorAll("[data-paper-note]"));
  const playButton = document.getElementById("playButton");
  const resetButton = document.getElementById("resetButton");

  const transactionEls = {
    rollout: document.getElementById("transactionRolloutCanvas"),
    policy: document.getElementById("transactionPolicyCanvas"),
    adjoint: document.getElementById("transactionAdjointCanvas"),
    ratio: document.getElementById("transactionRatioCanvas"),
    recovery: document.getElementById("transactionRecoveryCanvas"),
    diagnostic: document.getElementById("transactionDiagnosticCanvas"),
    text: {
      sell: document.getElementById("transactionSellText"),
      hold: document.getElementById("transactionHoldText"),
      buy: document.getElementById("transactionBuyText"),
    },
  };

  const delayEls = {
    rollout: document.getElementById("delayRolloutCanvas"),
    history: document.getElementById("delayHistoryCanvas"),
    adjoint: document.getElementById("delayAdjointCanvas"),
    bridge: document.getElementById("delayBridgeCanvas"),
    recovery: document.getElementById("delayRecoveryCanvas"),
    residual: document.getElementById("delayResidualCanvas"),
    text: {
      state: document.getElementById("delayStateText"),
      control: document.getElementById("delayControlText"),
      distributed: document.getElementById("delayDistributedText"),
    },
  };

  const style = document.createElement("style");
  style.id = "extended-pgdpo-mode-styles";
  style.textContent = `
    #transactionPolicyCanvas,
    #transactionRatioCanvas,
    #transactionDiagnosticCanvas,
    #delayHistoryCanvas,
    #delayBridgeCanvas,
    #delayResidualCanvas { margin-top: 6px; }

    #transactionRolloutCanvas,
    #transactionRecoveryCanvas,
    #delayRolloutCanvas,
    #delayRecoveryCanvas { aspect-ratio: 520 / 380; }

    #transactionPolicyCanvas,
    #delayHistoryCanvas { aspect-ratio: 520 / 300; }

    #transactionAdjointCanvas,
    #delayAdjointCanvas { aspect-ratio: 520 / 376; }

    #transactionRatioCanvas,
    #delayBridgeCanvas { aspect-ratio: 520 / 144; }

    #transactionDiagnosticCanvas,
    #delayResidualCanvas { aspect-ratio: 520 / 216; }

    @media (max-height: 900px) {
      #transactionPolicyCanvas,
      #transactionRatioCanvas,
      #transactionDiagnosticCanvas,
      #delayHistoryCanvas,
      #delayBridgeCanvas,
      #delayResidualCanvas { margin-top: 5px; }
    }
  `;
  document.head.appendChild(style);

  function replaceTerminology(text) {
    if (typeof text !== "string") return text;
    return text
      .replace(/marginal-value signals/gi, "adapted costate estimates")
      .replace(/marginal values/gi, "costate components")
      .replace(/marginal value/gi, "costate")
      .replace(/value-gradient/gi, "state-sensitivity");
  }

  function installTerminologyPatch() {
    const proto = window.CanvasRenderingContext2D?.prototype;
    if (proto && !proto.__pgdpoTerminologyPatched) {
      const originalFillText = proto.fillText;
      const originalStrokeText = proto.strokeText;
      proto.fillText = function patchedFillText(text, ...args) {
        return originalFillText.call(this, replaceTerminology(String(text)), ...args);
      };
      proto.strokeText = function patchedStrokeText(text, ...args) {
        return originalStrokeText.call(this, replaceTerminology(String(text)), ...args);
      };
      Object.defineProperty(proto, "__pgdpoTerminologyPatched", { value: true });
    }

    document.querySelectorAll(
      ".caption, .note-card, .stage-text, .paper-mode-label, .figure-head h2, .insight-panel-head, .tc-query-panel-head"
    ).forEach((node) => {
      const walker = document.createTreeWalker(node, NodeFilter.SHOW_TEXT);
      const textNodes = [];
      while (walker.nextNode()) textNodes.push(walker.currentNode);
      textNodes.forEach((textNode) => {
        textNode.nodeValue = replaceTerminology(textNode.nodeValue);
      });
    });
  }

  installTerminologyPatch();

  function fmt(x, digits = 3) {
    return Number.isFinite(x) ? x.toFixed(digits) : "—";
  }

  function expFmt(x) {
    if (!Number.isFinite(x) || x === 0) return "0";
    const exponent = Math.floor(Math.log10(Math.abs(x)));
    const mantissa = x / Math.pow(10, exponent);
    return `${mantissa.toFixed(1)}e${exponent < 0 ? "−" : "+"}${Math.abs(exponent)}`;
  }

  function stageContext() {
    const completed = state.stageIndex;
    const progress = completed < stageCounts.length
      ? clamp(state.stageTimer / stageIntervals[completed], 0, 1)
      : 1;
    return { completed, progress };
  }

  function adjointProgress() {
    const { completed, progress } = stageContext();
    return clamp((completed + progress) / stageCounts.length, 0, 1);
  }

  function recoveryProgress() {
    return easeOut(adjointProgress());
  }

  function currentPathCount(maxCount) {
    return Math.max(1, Math.round(maxCount * adjointProgress()));
  }

  function drawSeries(ctx, values, xScale, yScale, color, width = 2.2, dashed = false) {
    const { completed, progress } = stageContext();
    ctx.save();
    if (dashed) ctx.setLineDash([6, 5]);
    if (completed <= 0) {
      ctx.beginPath();
      ctx.fillStyle = color;
      ctx.arc(xScale(stageCounts[0]), yScale(values[0]), 3.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      return;
    }

    ctx.beginPath();
    for (let index = 0; index < completed; index += 1) {
      const x = xScale(stageCounts[index]);
      const y = yScale(values[index]);
      if (index === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    if (completed < stageCounts.length) {
      const previous = completed - 1;
      const x = lerp(xScale(stageCounts[previous]), xScale(stageCounts[completed]), progress);
      const y = lerp(yScale(values[previous]), yScale(values[completed]), progress);
      ctx.lineTo(x, y);
    }
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.stroke();
    ctx.restore();
  }

  function roundedRect(ctx, x, y, width, height, radius, fill, stroke) {
    ctx.save();
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(x, y, width, height, radius);
    else ctx.rect(x, y, width, height);
    if (fill) { ctx.fillStyle = fill; ctx.fill(); }
    if (stroke) { ctx.strokeStyle = stroke; ctx.stroke(); }
    ctx.restore();
  }

  function drawLegendLine(ctx, x, y, color, label, dashed = false) {
    ctx.save();
    if (dashed) ctx.setLineDash([5, 4]);
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x, y - 3);
    ctx.lineTo(x + 20, y - 3);
    ctx.stroke();
    ctx.restore();
    ctx.fillStyle = color;
    ctx.font = "10px Inter,system-ui,sans-serif";
    ctx.fillText(label, x + 26, y);
  }

  window.PGExtended = {
    D, COLORS, clamp, lerp, easeOut, setupCanvas, drawBackground, drawGrid, drawAxes, drawArrow,
    stageCounts, stageIntervals, state, customModes, modeButtons, paperPanels, equationPanels, notePanels,
    playButton, resetButton, transactionEls, delayEls, installTerminologyPatch, fmt, expFmt, stageContext,
    adjointProgress, recoveryProgress, currentPathCount, drawSeries, roundedRect, drawLegendLine,
  };
})();
