# PG-DPO Playground

A static interactive page that presents the PG-DPO family through one common computational architecture:

1. **Stage I — rollout warm-up**
2. **Stage II-A — adapted adjoint estimation**
3. **Stage II-B — local Pontryagin recovery**

The page includes five examples:

- Core PG-DPO / smooth Merton
- Pointwise portfolio constraints
- Proportional transaction costs
- Non-exponential discounting
- Stochastic delay control and kink recovery

## Terminology

The visible copy is intentionally PMP-first. It uses *adjoint*, *costate*, *state sensitivity*, *continuation objective*, and *local Hamiltonian recovery*. It does not present the method through a recursively trained global surrogate.

## Direct links

- `?example=smooth`
- `?example=constraints`
- `?example=transaction-costs`
- `?example=non-exponential`
- `?example=delay`

## Files

- `index.html` — semantic page shell, example selector, figure cards, equations, and scope notes.
- `style.css` — responsive three/two/one-column layout, accessible controls, and mobile overflow handling.
- `playground.js` — all five schematic animations, mode switching, solver/case toggles, and URL routing.

## Local preview

```bash
python3 -m http.server 3000
```

Open `http://localhost:3000`. No build step is required.
