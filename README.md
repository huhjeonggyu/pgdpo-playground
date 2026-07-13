# PG-DPO Playground

A small static visual sketch for the three-stage PG-DPO workflow

\[
\text{warm-up rollout}
\;\longrightarrow\;
\text{BPTT costate estimation}
\;\longrightarrow\;
\text{local correction}.
\]

The first two figures are shared. Figure 3 can switch between two local correction maps:

- **Smooth Merton:** a smooth Hamiltonian first-order condition recovers a point control.
- **Transaction costs:** a nonsmooth costate-ratio wedge and dead-zone projection map three representative query points to sell / hold / buy.

## What the page shows

1. **Warm-up.** A neural continuation policy is trained by simulated rollouts.
2. **Costate estimation.** BPTT produces pathwise sensitivities; Monte Carlo averaging gives local marginal-value signals at queried states.
3. **Local correction.** The selected mode maps each estimated costate signal to a current action.

The animation is educational: the forward simulation is real, while the displayed convergence paths are schematic rather than live training output.

## Files

- `index.html` — page structure, three-stage strip, and Figure 3 mode switch.
- `app.js` — shared rollout, costate figures, and the smooth recovery animation.
- `local-corrections.js` — three-query transaction-cost renderer, mode switching, and URL state.
- `style.css` — base responsive dark-theme layout and stable document scrolling.
- `local-corrections.css` — mode-switch and transaction-cost styling.
- `docs/transaction-costs.md` — mathematical note for the transaction-cost mode.
- `docs/adding-a-recovery-mode.md` — short guide for adding another local correction.
- `references/recovering-no-trade-regions-aqfc-2026.md` — text companion with the key formulas and references.

## Local preview

```bash
python3 -m http.server 3000
```

Open `http://localhost:3000`.

Direct links to the two modes:

- `http://localhost:3000/`
- `http://localhost:3000/?mode=transaction-costs`

## Deploy on Vercel

This is a static site. Import the repository into Vercel; no build step is required.

## Mathematical references

See [`docs/transaction-costs.md`](docs/transaction-costs.md) for the costate-ratio wedge, regularized projection, interpretation, and classical transaction-cost references.
