# Quality MFC70-v1.3

70 unique factor IDs. Classes Core / Conditional / Diagnostic.
Diagnostic never enters the base score.
Industry N/A is dropped from the denominator, not scored as 0.

v1.3 integrity:

- Q37 Invested Capital Turnover uses Revenue / Invested Capital only. No asset-turnover copy. Missing IC → N/A (`MISSING_FIELD`).
- Q70 Going Concern scores only with audit/filing going-concern evidence. Liquidity is `LIQUIDITY_STRESS` operational flag, not Q70.
- Canonical `FinancialSeries` (FY / Q points + provenance). TIER_3 series do not auto-score.
- Auto from series when present: Q07 QoQ revenue, Q20 3Y FCF, Q21 CFO YoY, Q54 3Y diluted shares. 1Y proxies are forbidden.
- Q04 EPS, Q35 Debt growth gap, Q45 PPE growth score only if the matching series exists; otherwise MANUAL_ONLY.
- Coverage is split: `coreCoverage`, `conditionalCoverage`, `diagnosticCoverage`, `overallScorableCoverage`. The Quality score itself stays one number.
- Each N/A carries `missingReason`: MISSING_FIELD / MISSING_SERIES / MISSING_TIER_1_2_EVIDENCE / NOT_APPLICABLE / MANUAL_ONLY.

MFC74-v3.0 is experimental and not mixed.

See `docs/QUALITY_70_FACTOR_AUDIT.md`.
