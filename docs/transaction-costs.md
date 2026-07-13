# Transaction-cost recovery mode

This note explains the transaction-cost example used in Figure 3 of the PG-DPO playground.
Figures 1 and 2 remain unchanged: a continuation policy generates rollouts, and BPTT estimates local marginal-value signals. Only the final costate-to-action map changes.

## 1. State, liquidation wealth, and trading rate

For one risky asset, write the state as

\[
Z_t=(X_t,Y_t),
\]

where \(X_t\) is cash and \(Y_t\) is the risky position. With proportional selling cost \(\alpha\), liquidation wealth is

\[
L_t=X_t+(1-\alpha)Y_t.
\]

The signed trading rate \(u_t\) is interpreted as

- \(u_t>0\): buy,
- \(u_t=0\): hold,
- \(u_t<0\): sell.

The educational example uses terminal CRRA utility of liquidation wealth.

## 2. Nonsmooth local Hamiltonian

The control-dependent part of the local Hamiltonian can be written as

\[
H(u;\lambda)
=
L_t\left[-\lambda_xu^+ +(1-\alpha)\lambda_xu^-+\lambda_yu\right],
\]

where \(u^+=\max(u,0)\) and \(u^-=\max(-u,0)\).
The kink at \(u=0\) creates a no-action wedge.

Define the costate ratio

\[
R=\frac{\lambda_y}{\lambda_x}.
\]

Then the local regime is

\[
\begin{cases}
R>1, & \text{buy},\\
1-\alpha\le R\le1, & \text{hold},\\
R<1-\alpha, & \text{sell}.
\end{cases}
\]

Thus the costate signal recovers more than a scalar target: it identifies the buy/hold/sell structure.

## 3. Quadratic regularization and dead-zone projection

To obtain a unique finite trading rate, add a quadratic penalty:

\[
H^{\varepsilon}(u;\lambda)
=
H(u;\lambda)-\frac{\varepsilon}{2}L_t\lambda_xu^2.
\]

The resulting closed-form correction is

\[
P_{\varepsilon}(R)=
\begin{cases}
\dfrac{R-1}{\varepsilon}, & R>1,\\[5pt]
0, & 1-\alpha\le R\le1,\\[5pt]
\dfrac{R-(1-\alpha)}{\varepsilon}, & R<1-\alpha.
\end{cases}
\]

The wedge location is set by transaction costs. The parameter \(\varepsilon\) controls trading intensity outside the wedge without moving the thresholds.

## 4. What the animation represents

The transaction-cost panel compares three representative query points under the same local map:

1. a sell query with \(\widehat R<1-\alpha\) and \(\widehat u<0\);
2. a hold query with \(1-\alpha\le\widehat R\le1\) and \(\widehat u=0\);
3. a buy query with \(\widehat R>1\) and \(\widehat u>0\).

For each query, the displayed BPTT estimate improves as the schematic path count increases, and the dead-zone map returns the signed trading rate \(\widehat u=P_{\varepsilon}(\widehat R)\).

Repeating the same local classification over a state domain traces a no-trade region. In multiple assets, the projection is componentwise after the covariance-aware costate vector has been estimated, so the recovered state-space geometry need not be a rectangular product of one-dimensional bands.

The convergence curves on the playground are schematic rather than live training outputs.

## 5. Classical references

- M. H. A. Davis and A. R. Norman, “Portfolio Selection with Transaction Costs,” *Mathematics of Operations Research*, 1990.
- S. E. Shreve and H. M. Soner, “Optimal Investment and Consumption with Transaction Costs,” *Annals of Applied Probability*, 1994.
- H. Liu, “Optimal Consumption and Investment with Transaction Costs and Multiple Risky Assets,” *Journal of Finance*, 2004.
- M. Dai, L. Jiang, P. Li, and F. Yi, “Finite Horizon Optimal Investment and Consumption with Transaction Costs,” *SIAM Journal on Control and Optimization*, 2009.
- P. Guasoni and J. Muhle-Karbe, *Portfolio Choice with Transaction Costs: A User’s Guide*, Springer, 2013.
