(() => {
  "use strict";
  const scripts = ["nonexp-figures-a.js", "nonexp-figures-b.js", "extended-bootstrap.js"];
  const load = (index) => {
    if (index >= scripts.length) return;
    const script = document.createElement("script");
    script.src = scripts[index];
    script.async = false;
    script.onload = () => load(index + 1);
    script.onerror = () => console.error(`Failed to load ${scripts[index]}`);
    document.body.appendChild(script);
  };
  load(0);
})();
