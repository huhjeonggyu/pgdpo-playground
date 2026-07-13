# Recovering No-Trade Regions with Pontryagin-Guided Projection

**Jeonggyu Huh and Hojin Ko**  
Department of Mathematics, Sungkyunkwan University (SKKU)  
AQFC 2026, July 16, 2026

This file is a compact text companion to the transaction-cost mode of the PG-DPO playground.

## Core message

The common computational pipeline is

\[
\text{simulate continuations}
\longrightarrow
\text{estimate pathwise costates by BPTT}
\longrightarrow
\text{average marginal-value signals}
\longrightarrow
\text{apply a local correction}.
\]

For a smooth problem, the last step uses a Hamiltonian first-order condition. With proportional transaction costs, the Hamiltonian is nonsmooth at zero trading and the last step becomes a no-trade projection.

## Fixed-policy BPTT signal

At a query state \(\bar z\), run \(M\) continuations under a frozen feedback policy. One rollout gives

\[
\Lambda^{(m)}(\bar z)=\nabla_{\bar z}G^{(m)},
\]

and Monte Carlo averaging gives the local fixed-policy marginal-value signal

\[
\widehat\lambda(\bar z)
=
\frac{1}{M}\sum_{m=1}^{M}\Lambda^{(m)}(\bar z).
\]

This avoids constructing a global value-function grid.

## Transaction-cost wedge

For cash costate \(\lambda_x\) and risky-position costate \(\lambda_{y_i}\), define

\[
R_i=\frac{\lambda_{y_i}}{\lambda_x}.
\]

With proportional cost \(\alpha_i\), holding asset \(i\) is locally optimal when

\[
1-\alpha_i\le R_i\le1.
\]

The three regimes are

\[
R_i<1-\alpha_i:\ \text{sell},
\qquad
1-\alpha_i\le R_i\le1:\ \text{hold},
\qquad
R_i>1:\ \text{buy}.
\]

## Dead-zone Pontryagin projection

A quadratic regularization produces the finite-rate correction

\[
[P_{\varepsilon}(\lambda)]_i=
\begin{cases}
\dfrac{\lambda_{y_i}-\lambda_x}{\varepsilon\lambda_x},
& \lambda_{y_i}/\lambda_x>1,\\[6pt]
0,
& 1-\alpha_i\le\lambda_{y_i}/\lambda_x\le1,\\[6pt]
\dfrac{\lambda_{y_i}-(1-\alpha_i)\lambda_x}{\varepsilon\lambda_x},
& \lambda_{y_i}/\lambda_x<1-\alpha_i.
\end{cases}
\]

The sign gives buy, hold, or sell; the magnitude gives trading speed. The no-trade thresholds are structural, while \(\varepsilon\) controls the steepness outside the wedge.

## Geometry and scalability

- In one asset, the wedge appears as an interval.
- In two assets, the central hold set can be compared directly with a low-dimensional DP/QVI benchmark.
- Correlation tilts the state-space boundary because the BPTT costates incorporate covariance effects.
- In \(N\) assets, the componentwise projection can express \(3^N\) mixed buy/hold/sell regimes.
- When a global DP benchmark is unavailable, local perturbation tests can diagnose stationarity of the projected action, but they do not prove global optimality.

## Scope

The playground is an educational representative-query-point visualization. Its transaction-cost view displays one sell, one hold, and one buy query, and its convergence curves are schematic. The research claim is local consistency and regime recovery for the regularized solver, not a global convergence theorem for the limiting singular-control free-boundary problem.

## Selected references

- M. H. A. Davis and A. R. Norman, “Portfolio Selection with Transaction Costs,” *Mathematics of Operations Research*, 1990.
- S. E. Shreve and H. M. Soner, “Optimal Investment and Consumption with Transaction Costs,” *Annals of Applied Probability*, 1994.
- H. Liu, “Optimal Consumption and Investment with Transaction Costs and Multiple Risky Assets,” *Journal of Finance*, 2004.
- M. Dai, L. Jiang, P. Li, and F. Yi, “Finite Horizon Optimal Investment and Consumption with Transaction Costs,” *SIAM Journal on Control and Optimization*, 2009.
- P. Guasoni and J. Muhle-Karbe, *Portfolio Choice with Transaction Costs: A User’s Guide*, Springer, 2013.
