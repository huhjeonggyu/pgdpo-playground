# PG-DPO Playground

A compact static playground for the common PG-DPO workflow

\[
\text{rollout warm-up}
\;\longrightarrow\;
\text{BPTT adjoint estimation}
\;\longrightarrow\;
\text{local correction}.
\]

The page now contains four examples selected from the header:

- **Smooth Merton** — a smooth Hamiltonian first-order condition recovers a point control.
- **Constraints** — first- and second-order adjoints define a local generalized-Hamiltonian KKT/QP problem.
- **Transaction costs** — a costate-ratio wedge and dead-zone projection recover sell / hold / buy.
- **Non-exponential** — decision-time anchored adjoints feed a diagonal Hamiltonian solve, giving optimal controls for multiplicative kernels and equilibrium controls otherwise.

The animation is educational. The displayed rollout sketches and convergence paths are schematic rather than live neural training output.

## Page structure

1. **Warm-up.** A differentiable continuation policy is trained by simulated rollouts.
2. **Adjoint estimation.** BPTT supplies pathwise marginal sensitivities; conditional averaging or regression gives the adjoints required by the selected problem.
3. **Local correction.** A problem-specific action-space solver enforces the relevant Pontryagin condition.

## Files

- `index.html` — page structure, four-example selector, figures, and equations.
- `app.js` — original smooth Merton rollout and recovery animation.
- `local-corrections.js` — transaction-cost dead-zone visualization.
- `research-modes.js` — top-level example switching and shared canvas/animation utilities.
- `constraints-mode.js` — constrained-portfolio figures and KKT/QP recovery animation.
- `nonexp-mode.js` — non-exponential-discounting figures and diagonal recovery animation.
- `style.css` — base responsive dark-theme layout.
- `local-corrections.css` — smooth / transaction-cost component styling.
- `research-modes.css` — paper-mode selector, stacked panels, and new example styling.
- `docs/transaction-costs.md` — transaction-cost mathematical note.
- `docs/constrained-portfolios.md` — first/second adjoints and local KKT/QP recovery.
- `docs/non-exponential-discounting.md` — anchored objectives and diagonal Pontryagin recovery.
- `docs/adding-a-recovery-mode.md` — extension guide.
- `references/recovering-no-trade-regions-aqfc-2026.md` — AQFC transaction-cost companion note.

## Local preview

```bash
python3 -m http.server 3000
```

Open `http://localhost:3000`.

Direct links:

- Smooth Merton: `http://localhost:3000/`
- Transaction costs: `http://localhost:3000/?mode=transaction-costs`
- Constraints: `http://localhost:3000/?example=constraints`
- Non-exponential discounting: `http://localhost:3000/?example=non-exponential`

## Deploy on Vercel

This is a static site. Import the repository into Vercel; no build step is required.
