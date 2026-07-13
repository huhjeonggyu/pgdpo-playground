# Non-exponential discounting mode

This note summarizes the **Non-exponential** example in the PG-DPO playground. It follows *Beyond the Bellman Recursion: A Pontryagin-Guided Framework for Non-Exponential Discounting*.

## 1. Why the objective is anchored

Let `D(s,t)` be the discount factor applied at evaluation time `s` to a payoff realized at `t >= s`. Exponential discounting is both multiplicative and time homogeneous. When either property fails, a standard Bellman recursion or a stationary value-function pipeline may fail.

PG-DPO therefore works with a decision-time anchored objective:

\[
J(t_0,x;u)
=
\mathbb E_{t_0,x}
\left[
\int_{t_0}^{T}D(t_0,s)\ell(s,X_s,u_s)ds
+
D(t_0,T)g(X_T)
\right].
\]

Stage 1 samples anchor-state pairs and directly optimizes these differentiable rollout objectives.

## 2. Anchored adjoints from BPTT

For a fixed anchor `t0`, the anchored Hamiltonian is

\[
H(t_0,t,x,u,\lambda,Z)
=
D(t_0,t)\ell(t,x,u)
+
\langle\lambda,b(t,x,u)\rangle
+
\operatorname{Tr}(Z^\top\sigma(t,x,u)).
\]

Reverse-mode differentiation through each anchored rollout gives a pathwise state sensitivity. Monte Carlo averaging stabilizes these samples into an anchored adjoint estimate.

The same state may therefore carry different marginal values under different anchors. This anchor dependence is the relevant object rather than an error to be removed.

## 3. Diagonal Pontryagin correction

Time-consistent local synthesis uses the **diagonal** specialization—anchor time equals decision time:

\[
\widehat u(t,x)
\in
\arg\max_{u\in U(x)}
H\bigl(t,t,x,u,\widehat\lambda(t,x),\widehat Z(t,x)\bigr).
\]

- If `D` is multiplicative, the diagonal condition reduces to classical Pontryagin optimality.
- If `D` is non-multiplicative, it is the local condition associated with a time-consistent equilibrium.

The pointwise solve may be closed form, Newton/quasi-Newton, constrained barrier, or another action-space solver.

## 4. What the animation shows

- **Figure 1:** exponential, survival, and hyperbolic kernels, followed by random-anchor rollout weighting.
- **Figure 2:** anchor-dependent BPTT adjoints and the highlighted diagonal `t0 = t`.
- **Figure 3:** early, middle, and late decision-time queries move from a warm-up policy toward the diagonal optimal/equilibrium action.
- The lower chart illustrates the reduction of the local Hamiltonian residual after diagonal projection.

All curves are schematic educational outputs rather than reproduced experimental data.
