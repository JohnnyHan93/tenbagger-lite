# Oversold OSM-v2.3

Opp = 0.40×Fundamental + 0.25×Valuation + 0.10×Oversold + 0.25×RiskInverse

N/A is excluded and remaining weights are renormalized. N/A ≠ 0 and N/A ≠ 5. Zero is a valid score.

Regression: F=8 V=7 O=6 R=5 → 6.80. F=8 V=7 O=N/A R=5 → 6.89 at 90% coverage.

Value Trap 0–10 is separate. 0 = no detected trap signal. VT ≥ 7 is a strong warning. Trap is never subtracted from Opp.

Cases A–D from price vs fundamentals. If Fundamental or Oversold is N/A: `case = null`, `caseStatus = INCOMPLETE`. No default Case B.

Peak earnings is `NONE | POSSIBLE | HIGH` (boolean `peakEarnings` kept for old UI). REIT / financial names are not forced onto manufacturing P/E or EV/S.

## v2.3 series

- Fundamental: 3Y revenue CAGR > 15% is +1; CAGR < 0 is −1. This is extra to 1Y YoY so a one-year spike does not look durable.
- Weak cash conversion (CFO/NI < 0.5 while NI > 0) is −1 on Fundamental — earnings quality, not a trap subtract.
- 3Y FCF span > +15% is +1; < −30% is −1 when FY FCF × 3 exists.
- Peak earnings: latest FY net income at a 3Y high, with falling revenue or compressing OM, adds a hit. Cheap multiple at peak earnings is still penalized.

Weights stay 0.40 / 0.25 / 0.10 / 0.25 unless Criteria JSON changes them.

## OSM-MON-v1.0 overlay (Johnny-AI-OS ADR-0004)

Does **not** change Opp. Overlay only.

- **MEG** (−2…+2): market pessimism vs scored F/O/VT. N/A if F or O missing. Never added to Opp.
- **Price path**: 좋은 과매도 / 트랩 위험 / 재평가 / 가격만 반등. Separate from engine Case A–D (F vs O intensity).
- **Dynamic Top 10**: KR/US lists replace #10 when a new name has a higher Opp. Not a fixed universe.
- **Alerts** vs previous snapshot: Opp ±0.20, rank ±2, VT ±1, price ±5%, path change, Top 10 enter/exit, 52W drawdown ±10pp.
- **Sector overlay** (증권 / AI·SW / 반도체): research checklist only. Never scored into Opp.
- **Capital return**: share-count drop is 제한적 긍정. Buyback+cancel is never inferred.
- Peak-earnings still lives in OSM-v2.3 valuation (cheap multiple at peak ≠ cheap).

Core OSM formula change still requires Human GO + version bump.
