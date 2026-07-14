(() => {
  "use strict";
  if (window.__pgdpoExtendedBootstrap) return;
  window.__pgdpoExtendedBootstrap = true;
  const scripts = [
    "extended-dom-panels.js",
    "extended-dom-equations.js",
    "extended-shared.js",
    "transaction-adjoint.js",
    "transaction-recovery.js",
    "delay-adjoint.js",
    "delay-recovery.js",
    "extended-coordinator.js",
  ];
  const load = (index) => {
    if (index >= scripts.length) return;
    if (document.querySelector(`script[src="${scripts[index]}"]`)) { load(index + 1); return; }
    const script = document.createElement("script");
    script.src = scripts[index];
    script.async = false;
    script.onload = () => load(index + 1);
    script.onerror = () => console.error(`Failed to load ${scripts[index]}`);
    document.body.appendChild(script);
  };
  load(0);
})();
