(() => {
  "use strict";
  if (window.__pgdpoExtendedEquations) return;
  window.__pgdpoExtendedEquations = true;
  const equationStack = document.querySelector(".paper-equation-stack");
  if (equationStack && !equationStack.querySelector('[data-paper-equations="transaction"]')) equationStack.insertAdjacentHTML("beforeend", "<section class=\"equation-row\" data-paper-equations=\"transaction\" hidden=\"\">\n<article class=\"eq-card\"><h3>Transaction-cost state</h3><div class=\"eq-body eq-body-block\"><div>$$L_t=X_t+\\sum_i(1-\\alpha_i)Y_t^i,\\qquad J(q;u)=\\mathbb E_q[U(L_T)]$$</div><div>$$dY_t^i=Y_t^i(\\mu_i\\,dt+\\sigma_i\\,dW_t^i)+L_tu_t^i\\,dt$$</div></div></article>\n<article class=\"eq-card\"><h3>Fixed-policy costates</h3><div class=\"eq-body eq-body-block tc-equation-dense\"><div>$$\\lambda_x^{(m)}(q)=D_xJ^{(m)}(q;u_\\theta^*),\\quad \\lambda_{y_i}^{(m)}(q)=D_{y_i}J^{(m)}(q;u_\\theta^*),\\quad (\\hat\\lambda_x,\\hat\\lambda_{y_i})=\\frac1M\\sum_{m=1}^M(\\lambda_x^{(m)},\\lambda_{y_i}^{(m)})$$</div><div>$$\\hat R_i(q)=\\frac{\\hat\\lambda_{y_i}(q)}{\\hat\\lambda_x(q)}$$</div></div></article>\n<article class=\"eq-card\"><h3>Nonsmooth local recovery</h3><div class=\"eq-body eq-body-block tc-equation-dense\"><div>$$H^\\varepsilon_i(u_i;\\lambda)=L_t[-\\lambda_xu_i^++(1-\\alpha_i)\\lambda_xu_i^-+\\lambda_{y_i}u_i]-\\frac\\varepsilon2L_t\\lambda_xu_i^2$$</div><div>$$\\hat u_i=P_\\varepsilon(\\hat R_i),\\qquad \\hat u_i=0\\iff1-\\alpha_i\\le\\hat R_i\\le1$$</div></div></article>\n</section>");
  if (equationStack && !equationStack.querySelector('[data-paper-equations="delay"]')) equationStack.insertAdjacentHTML("beforeend", "<section class=\"equation-row\" data-paper-equations=\"delay\" hidden=\"\">\n<article class=\"eq-card\"><h3>SDDE and history</h3><div class=\"eq-body eq-body-block nonexp-equation-dense\"><div>$$dX(t)=b(t,X(t),Y(t),A(t),u(t))dt+\\sigma(t,X(t),Y(t),A(t))dW(t)$$</div><div>$$Y(t)=X(t-\\delta),\\qquad A(t)=\\int_{t-\\delta}^te^{-\\rho(t-r)}X(r)dr$$</div></div></article>\n<article class=\"eq-card\"><h3>Anticipated adjoint bridge</h3><div class=\"eq-body eq-body-block nonexp-equation-dense\"><div>$$dp(t)=\\mathbb E[\\mu(t)\\mid\\mathcal F_t]dt+q(t)dW(t),\\quad \\mu(t)=-\\partial_xH_t-\\partial_yH_{t+\\delta}\\mathbf1_{\\{t\\le T-\\delta\\}}-e^{\\rho t}\\int_t^{t+\\delta}\\!\\partial_aH_s e^{-\\rho s}\\mathbf1_{\\{s\\le T\\}}ds$$</div><div>$$\\lambda_k^{\\mathrm{BPTT}}=\\lambda_{k+1|k}+(f_k+C_k^{\\mathrm{cl}})\\Delta t$$</div></div></article>\n<article class=\"eq-card\"><h3>Problem-specific recovery</h3><div class=\"eq-body eq-body-block nonexp-equation-dense\"><div>$$\\hat u_t\\in\\arg\\max_{u\\in U}\\{f(t,\\cdot,u)+b(t,\\cdot,u)^\\top\\hat\\lambda_t\\}$$</div><div>$$0=\\partial_uH_t+\\mathbb E_t[\\partial_{u_{\\mathrm{del}}}H_{t+\\delta_u}]\\mathbf1_{\\{t+\\delta_u\\le T\\}}\\quad\\text{(control delay)}$$</div></div></article>\n</section>");
  const noteStack = document.querySelector(".paper-note-stack");
  if (noteStack && !noteStack.querySelector('[data-paper-note="transaction"]')) noteStack.insertAdjacentHTML("beforeend", "<section class=\"note-card\" data-paper-note=\"transaction\" hidden=\"\">\n<p><strong>Transaction costs.</strong> The distinctive object is the costate ratio $\\lambda_{y_i}/\\lambda_x$ and its exact no-action wedge, not a globally fitted free boundary.</p>\n<p><strong>Scope.</strong> The theory concerns the auxiliary quadratically regularized trading-rate problem and local regime recovery; it does not claim convergence to the limiting singular-control solution.</p>\n</section>");
  if (noteStack && !noteStack.querySelector('[data-paper-note="delay"]')) noteStack.insertAdjacentHTML("beforeend", "<section class=\"note-card\" data-paper-note=\"delay\" hidden=\"\">\n<p><strong>Delay control.</strong> BPTT recovers a discretized anticipated adjoint up to a predictable FOC residual, and the local projection restores the sharp structure smoothed by recurrent policies.</p>\n<p><strong>Scope.</strong> The displayed theory assumes control-independent diffusion and gives conditional short-slab stability rather than end-to-end convergence.</p>\n</section>");
  const corePanels = document.querySelectorAll('[data-paper-panel="core"]');
  const coreTitles = ["Rollout warm-up", "Adjoint recovery", "Smooth control recovery"];
  corePanels.forEach((panel, index) => {
    const title = panel.querySelector("h2");
    if (title && coreTitles[index]) title.textContent = coreTitles[index];
  });
  const coreCaptions = [
    "Stage 1 trains a differentiable continuation policy by simulation. The same rollout graph is retained for the adjoint stage.",
    "Stage 2 averages pathwise BPTT sensitivities into adapted costate estimates at the queried state.",
  ];
  corePanels.forEach((panel, index) => {
    const caption = panel.querySelector(".caption");
    if (caption && coreCaptions[index]) caption.textContent = coreCaptions[index];
  });
})();
