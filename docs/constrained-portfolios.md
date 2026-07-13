# Constrained portfolio recovery mode

This note summarizes the **Constraints** example in the PG-DPO playground. It follows the architecture of *Scalable Pontryagin-Guided Adjoint-to-Control Recovery for Constrained Dynamic Portfolio Choice*.

## 1. Pointwise control constraints

At a time-state pair `(t, x)`, the admissible portfolio-consumption set is

\[
U(t,x)
=
\left\{(\pi,C):\mathbf 1^\top\pi=1,\ \Gamma(t,x;\pi,C)\ge0\right\}.
\]

Examples include long-only weights, no borrowing, leverage or sector limits, and fixed or wealth-dependent consumption bounds such as `0 <= C <= m x`.

The warm-up network uses smooth activations—softmax, sigmoid, scaled tanh, or softplus—to generate feasible controls. This guarantees admissibility, but it does **not** by itself imply pointwise Hamiltonian stationarity or KKT complementarity.

## 2. Why first- and second-order adjoints appear

For wealth dynamics

\[
dX_t=(X_t\pi_t^\top\mu^e-C_t)dt+X_t\pi_t^\top v^e dW_t,
\]

the portfolio enters the diffusion. The first-order Hamiltonian is therefore linear in the portfolio when the first-order adjoint is held fixed. The second-order stochastic adjoint supplies the missing curvature.

The generalized Hamiltonian is

\[
\mathcal H(t,x;\pi,C,\lambda,\zeta,P)
=
e^{-\rho t}U(C)+\lambda b+\zeta^\top\sigma+
\frac12P\|\sigma\|^2.
\]

Once- and twice-differentiated continuation payoffs give pathwise samples

\[
\widetilde\lambda=D_XJ,
\qquad
\widetilde P=D^2_{XX}J,
\]

whose conditional projections provide the adapted first- and second-order adjoints used at deployment.

## 3. Local KKT / QP recovery

After the adjoints are estimated, the remaining task is finite dimensional:

\[
\widehat u(t,x)
\in
\arg\max_{u\in U(t,x)}
\widehat{\mathcal H}(t,x;u).
\]

For a quadratic-affine risky-portfolio block, this becomes the strictly concave QP

\[
\widehat u
=
\arg\max_{u\in K}
\left\{a^\top u-\frac12u^\top Qu\right\},
\]

with

\[
a=x\{\widehat\lambda(\mu-r\mathbf1)+v\widehat\zeta\},
\qquad
Q=-x^2\widehat P\Sigma.
\]

An exact QP/KKT solver has no barrier bias. For general smooth constrained blocks, a log-barrier or another active-set, primal-dual, SQP, or augmented-Lagrangian solver can evaluate the same solver-neutral recovery map.

## 4. What the animation shows

- **Figure 1:** activations keep the warm-up controls inside a simplex-like feasible set.
- **Figure 2:** BPTT supplies both marginal sensitivity `lambda` and curvature `P`.
- **Figure 3:** three representative states—active, near-switching, and interior—move from feasible warm-up actions toward local KKT/QP solutions.
- The lower residual chart contrasts feasibility-only DPO with barrier and exact QP/KKT recovery.

All curves are schematic educational outputs.

## 5. Scope

The mode covers **pointwise control constraints**, including constraints whose bounds depend on the current Markov state. Genuine state-path restrictions—hard drawdown, running maxima, continuous-time ratcheting, reflected obstacles, or singular controls—require additional nonsmooth, reflected, or singular-control machinery and are not represented as ordinary local KKT blocks here.
