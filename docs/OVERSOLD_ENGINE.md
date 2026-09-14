# Oversold OSM-v2.2

Opp = 0.40×Fundamental + 0.25×Valuation + 0.10×Oversold + 0.25×RiskInverse

N/A is excluded and remaining weights are renormalized. N/A ≠ 0 and N/A ≠ 5. Zero is a valid score.

Regression: F=8 V=7 O=6 R=5 → 6.80. F=8 V=7 O=N/A R=5 → 6.89 at 90% coverage.

Value Trap 0–10 is separate. 0 = no detected trap signal. VT ≥ 7 is a strong warning. Trap is never subtracted from Opp.

Cases A–D from price vs fundamentals. If Fundamental or Oversold is N/A: `case = null`, `caseStatus = INCOMPLETE`. No default Case B.

Peak earnings is `NONE | POSSIBLE | HIGH` (boolean `peakEarnings` kept for old UI). REIT / financial names are not forced onto manufacturing P/E or EV/S.

Weights stay 0.40 / 0.25 / 0.10 / 0.25 unless Criteria JSON changes them.
