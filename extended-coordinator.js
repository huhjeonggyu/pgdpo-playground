(() => {
  "use strict";
  const E = window.PGExtended;
  if (!E) return;
  const { state, customModes, modeButtons, paperPanels, equationPanels, notePanels, playButton, resetButton,
    stageCounts, stageIntervals, clamp, installTerminologyPatch } = E;

  function typesetVisible() {
    if (!window.MathJax?.typesetPromise) return;
    const visible = equationPanels.filter((node) => !node.hidden);
    window.MathJax.typesetPromise(visible).catch((error) => console.warn("MathJax typesetting failed", error));
  }

  function restart() {
    if (!customModes.has(state.active)) return;
    state.warmup = 0;
    state.stageIndex = 0;
    state.stageTimer = 0;
    state.playing = true;
  }

  function reset() {
    if (!customModes.has(state.active)) return;
    state.warmup = 0;
    state.stageIndex = 0;
    state.stageTimer = 0;
    state.playing = false;
    drawActive();
  }

  function showCustomMode(modeId, updateUrl = false) {
    if (!customModes.has(modeId)) return;
    state.active = modeId;
    paperPanels.forEach((node) => { node.hidden = node.dataset.paperPanel !== modeId; });
    equationPanels.forEach((node) => { node.hidden = node.dataset.paperEquations !== modeId; });
    notePanels.forEach((node) => { node.hidden = node.dataset.paperNote !== modeId; });
    modeButtons.forEach((button) => {
      const active = button.dataset.paperMode === modeId;
      button.classList.toggle("is-active", active);
      button.setAttribute("aria-pressed", String(active));
    });

    restart();
    window.requestAnimationFrame(() => {
      drawActive();
      window.dispatchEvent(new Event("resize"));
      typesetVisible();
    });

    if (updateUrl) {
      const url = new URL(window.location.href);
      url.searchParams.set("example", modeId === "transaction" ? "transaction-costs" : "delay");
      url.searchParams.delete("mode");
      window.history.replaceState({}, "", url);
    }
  }

  function deactivateCustomMode() {
    state.active = null;
    state.playing = false;
  }

  function drawActive() {
    if (state.active === "transaction") E.drawTransaction?.();
    else if (state.active === "delay") E.drawDelay?.();
  }

  function animate(timestamp) {
    if (!state.lastTimestamp) state.lastTimestamp = timestamp;
    const dt = Math.min((timestamp - state.lastTimestamp) / 1000, 0.10);
    state.lastTimestamp = timestamp;

    if (state.playing && customModes.has(state.active)) {
      if (state.warmup < 1) {
        state.warmup = clamp(state.warmup + dt / 2, 0, 1);
      } else if (state.stageIndex < stageCounts.length) {
        state.stageTimer += dt;
        if (state.stageTimer >= stageIntervals[state.stageIndex]) {
          state.stageTimer = 0;
          state.stageIndex += 1;
        }
      } else {
        state.playing = false;
      }
    }

    drawActive();
    window.requestAnimationFrame(animate);
  }

  modeButtons.forEach((button) => {
    const modeId = button.dataset.paperMode;
    if (customModes.has(modeId)) {
      button.addEventListener("click", () => showCustomMode(modeId, true));
    } else {
      button.addEventListener("click", deactivateCustomMode);
    }
  });

  playButton?.addEventListener("click", restart);
  resetButton?.addEventListener("click", reset);
  window.addEventListener("resize", drawActive);
  window.addEventListener("pgdpo:ready", () => {
    installTerminologyPatch();
    drawActive();
    typesetVisible();
  });

  const parameters = new URLSearchParams(window.location.search);
  const example = parameters.get("example");
  const legacy = parameters.get("mode");
  if (example === "transaction" || example === "transaction-costs" || example === "costs" || legacy === "transaction-costs" || legacy === "costs") {
    showCustomMode("transaction", false);
  } else if (example === "delay" || example === "delay-control" || legacy === "delay") {
    showCustomMode("delay", false);
  }

  window.requestAnimationFrame(animate);
})();
