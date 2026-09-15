# Quality MFC70-v1.4

70 unique factor IDs. Classes Core / Conditional / Diagnostic.
Diagnostic never enters the base score.
Industry N/A is dropped from the denominator, not scored as 0.

v1.4 series auto-score (Yahoo/Naver FY, TIER_1/2 only):

- Q04 diluted EPS YoY from FY EPS series. No OP-growth copy. Missing series → N/A (`MISSING_SERIES`).
- Q22 Positive CFO Persistence needs 3 FY CFO points. A single-year sign is not persistence.
- Q35 Debt growth − revenue growth from FY debt series.
- Q38 Incremental ROIC = ΔOP / ΔIC from two FY points with invested capital.
- Q40 PPE turnover = Revenue / latest FY PPE.
- Q42 CAPEX productivity = Δrevenue / |CAPEX|.
- Q45 PPE growth from FY PPE series.
- 3Y revenue CAGR (`Q02` / derived) needs 4 FY revenue points.

v1.3 integrity (kept):

- Q37 Invested Capital Turnover uses Revenue / Invested Capital only. No asset-turnover copy. Missing IC → N/A (`MISSING_FIELD`).
- Q70 Going Concern scores only with audit/filing going-concern evidence. Liquidity is `LIQUIDITY_STRESS` operational flag, not Q70.
- Canonical `FinancialSeries` (FY / Q points + provenance). TIER_3 series do not auto-score.
- Auto from series when present: Q07 QoQ revenue, Q20 3Y FCF, Q21 CFO YoY, Q54 3Y diluted shares. 1Y proxies are forbidden.
- Coverage is split: `coreCoverage`, `conditionalCoverage`, `diagnosticCoverage`, `overallScorableCoverage`. The Quality score itself stays one number.
- Each N/A carries `missingReason`: MISSING_FIELD / MISSING_SERIES / MISSING_TIER_1_2_EVIDENCE / NOT_APPLICABLE / MANUAL_ONLY.

MFC74-v3.0 is experimental and not mixed.

See `docs/QUALITY_70_FACTOR_AUDIT.md`.
