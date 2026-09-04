# Quality 70 Factor Audit — MFC70-v1.2

Canonical count: **70**. Duplicate IDs: **none**. Wrong proxies: **0**. Missing: **0**.

## v2.3 CFO / FCF integrity

`FinancialSnapshot.cfo` and `FinancialSnapshot.fcf` are independent. Nasdaq `Net Cash Flow-Operating` maps to **cfo**, never **fcf**. Derived metrics never use `cfo ?? fcf`. Missing CFO ⇒ CFO factors N/A. Missing FCF ⇒ FCF factors N/A. Coverage may fall versus mixed-proxy snapshots; that is correct.

| Factor | Uses | If missing |
|---|---|---|
| Q17 CFO Margin | CFO | N/A |
| Q18 Cash Conversion | CFO / NI | N/A |
| Q22 Positive CFO Persistence | CFO | N/A |
| Q44 CAPEX / CFO | CAPEX and CFO | N/A |
| Q19 FCF Margin | FCF | N/A |
| Q24 FCF vs NI | FCF | N/A |
| Q57 External funding | FCF | N/A |
| Q20 3Y FCF | MANUAL_ONLY | N/A (not 1Y FCF) |
| Q21 CFO Growth | MANUAL_ONLY | N/A |
| Q32 Cash Interest Coverage | MANUAL_ONLY | N/A |
| Q41 Cash ROIC | MANUAL_ONLY | not a copy of ROIC |

Wrong Proxy remains **0** after this repair.

| Status | Count |
|---|---|
| IMPLEMENTED | 38 |
| MANUAL_ONLY | 32 |
| N/A_BY_DESIGN (factor-level) | 0 |
| MISSING | 0 |
| WRONG_PROXY | 0 |

Industry `apply() === "N"` is a **per-company denominator exclusion**, not a missing implementation.

Status key:

- **IMPLEMENTED** — scored from derived metrics when data exists; else N/A (not 0)
- **MANUAL_ONLY** — no reliable automatic field; N/A until research override
- **N/A_BY_DESIGN** — reserved for factors that never belong in the 70; unused at factor level

Wrong proxies removed in v1.2 (now MANUAL_ONLY, not scored from substitutes):

| ID | Was | Now |
|---|---|---|
| Q04 EPS Growth | OP growth substitute | MANUAL_ONLY |
| Q20 3Y FCF | single-year FCF sign | MANUAL_ONLY |
| Q32 Cash Interest Coverage | copy of accrual interest coverage | MANUAL_ONLY |
| Q41 Cash ROIC | copy of accounting ROIC | MANUAL_ONLY |
| Q54 3Y Dilution | 1Y share growth | MANUAL_ONLY |

Diagnostics (Q23, Q29, Q56–Q70 except implemented Q23/Q70) never enter the Quality 70 base score.

Normalization: score bands 0–10; Quality 70 base = mean of **score-eligible available non-diagnostic factors** × 10 (0–100). N/A excluded from denominator. Industry N excluded. Diagnostic excluded.

Evidence: auto factors use derived-metric provenance; MANUAL_ONLY requires TIER_1/TIER_2 evidence before override.

## 70-factor table

| ID | Name | Pillar | Class | Applicable industries | Required raw data | Formula | Normalization | Implementation | Status | Proxy used? | Proxy valid? | Evidence | Test |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Q01 | Revenue Growth | Growth | Core | All | revenueTtm, revenuePrior | YoY | band ≥30/15/8/3/0% | derived.revenueYoY | IMPLEMENTED | No | — | filings | suite |
| Q02 | 3Y Revenue CAGR | Growth | Core | All | 3Y revenue | CAGR | band ≥20/12/7/3/0% | derived.revenueCagr3y | IMPLEMENTED | No | — | filings | suite |
| Q03 | OP Growth | Growth | Core | All | OP ttm/prior | YoY | band ≥30/15/5/0/−10% | derived.opGrowth | IMPLEMENTED | No | — | filings | suite |
| Q04 | EPS Growth | Growth | Conditional | All | diluted EPS series | YoY | MANUAL | none | MANUAL_ONLY | **removed OP proxy** | invalid | 10-K EPS | Q04 |
| Q05 | Growth Acceleration | Growth | Core | All | YoY vs 3Y CAGR | delta | band ≥10/3/0/−5pp | yoy−cagr3 | IMPLEMENTED | No | — | filings | suite |
| Q06 | Profit Growth Leverage | Growth | Core | All | OP growth, rev growth | OP−rev | band ≥10/0/−5pp | delta | IMPLEMENTED | No | — | filings | suite |
| Q07 | Sequential Growth | Growth | Conditional | All | quarterly revenue | QoQ | MANUAL | none | MANUAL_ONLY | No | — | 10-Q | suite |
| Q08 | Organic vs M&A | Growth | Conditional | All | organic disclosure | organic % | MANUAL | none | MANUAL_ONLY | No | — | IR/10-K | suite |
| Q09 | Gross Margin | Profitability | Core | not financial/REIT | GM | level | band ≥70/50/35/20/0% | derived.gm | IMPLEMENTED | No | — | filings | suite |
| Q10 | Operating Margin | Profitability | Core | All | OM | level | band ≥25/15/8/2/0% | derived.om | IMPLEMENTED | No | — | filings | suite |
| Q11 | Net Margin | Profitability | Core | All | NM | level | band ≥18/10/5/0/−5% | derived.nm | IMPLEMENTED | No | — | filings | suite |
| Q12 | Margin Change | Profitability | Core | All | OM ttm vs prior | ΔOM | band ≥3/1/0/−3pp | derived.omChange | IMPLEMENTED | No | — | filings | Q12 |
| Q13 | ROIC | Profitability | Core | not banks (industry N) | NOPAT, IC | ROIC | band ≥20/12/8/4/0% | derived.roic | IMPLEMENTED | No | — | filings | suite |
| Q14 | ROIC Change | Profitability | Conditional | not banks | ROIC series | ΔROIC | band ≥3/0/−3pp | derived.roicChange | IMPLEMENTED | No | — | filings | suite |
| Q15 | Gross Margin Stability | Profitability | Conditional | not financial | GM series | −|ΔGM| | inv-band | derived.gmChange | IMPLEMENTED | No | — | filings | suite |
| Q16 | Operating Leverage | Profitability | Core | All | OP/rev growth | OP÷rev | band ≥1.5/1.1/0.8 | ratio | IMPLEMENTED | No | — | filings | suite |
| Q17 | CFO Margin | Cash | Core | All | CFO, revenue | CFO/rev | band ≥20/12/5/0% | derived.cfoMargin | IMPLEMENTED | No | — | CFS | suite |
| Q18 | Cash Conversion | Cash | Core | All | CFO, NI | CFO/NI | band ≥1.1/0.9/0.7/0.4 | derived.cashConversion | IMPLEMENTED | No | — | CFS | suite |
| Q19 | FCF Margin | Cash | Core | All | FCF, revenue | FCF/rev | band ≥15/8/3/0% | derived.fcfMargin | IMPLEMENTED | No | — | CFS | suite |
| Q20 | 3Y FCF | Cash | Conditional | All | 3Y FCF | 3Y sum/sign | MANUAL | none | MANUAL_ONLY | **removed 1Y FCF** | invalid | CFS 3Y | suite |
| Q21 | CFO Growth | Cash | Conditional | All | CFO series | YoY | MANUAL | none | MANUAL_ONLY | No | — | CFS | suite |
| Q22 | Positive CFO Persistence | Cash | Core | All | CFO | sign | +8 / −2 | derived.cfo | IMPLEMENTED | No | — | CFS | suite |
| Q23 | Accrual Ratio | Cash | Diagnostic | All | NI−CFO / assets | accrual | inv-band (diag) | derived.accrual | IMPLEMENTED | No | — | CFS | diag |
| Q24 | FCF vs NI | Cash | Core | All | FCF, NI | FCF/NI | band ≥0.9/0.6/0.3 | ratio | IMPLEMENTED | No | — | CFS | suite |
| Q25 | AR Growth Gap | Working Capital | Core | not financial | AR, revenue | AR g − rev g | inv-band | derived.arGrowthGap | IMPLEMENTED | No | — | BS | suite |
| Q26 | Inventory Growth Gap | Working Capital | Core | not saas/financial | inventory, rev | inv g − rev g | inv-band | derived.invGrowthGap | IMPLEMENTED | No | — | BS | industry N |
| Q27 | CCC Change | Working Capital | Conditional | not saas/financial | CCC days | ΔCCC | inv-band | derived.cccChange | IMPLEMENTED | No | — | WC | suite |
| Q28 | NWC Burden | Working Capital | Conditional | not financial | NWC | NWC/rev | MANUAL | none | MANUAL_ONLY | No | — | BS | suite |
| Q29 | Contract Asset Growth | Working Capital | Diagnostic | saas A, else C | contract assets | YoY | MANUAL | none | MANUAL_ONLY | No | — | 10-K | suite |
| Q30 | Net Debt / EBITDA | Balance Sheet | Core | not banks | net debt, EBITDA | ratio | inv-band; net cash=10 | derived.netDebtEbitda | IMPLEMENTED | No | — | BS | suite |
| Q31 | Interest Coverage | Balance Sheet | Core | not banks | EBIT, interest | EBIT/int | band ≥10/5/3/1.5 | derived.interestCoverage | IMPLEMENTED | No | — | P&L | suite |
| Q32 | Cash Interest Coverage | Balance Sheet | Conditional | not banks | CFO, cash interest | CFO/cash int | MANUAL | none | MANUAL_ONLY | **removed accrual copy** | invalid | CFS | suite |
| Q33 | ST Debt / Cash | Balance Sheet | Core | All | ST debt, cash | ratio | inv-band | derived.stDebtToCash | IMPLEMENTED | No | — | BS | suite |
| Q34 | Debt Concentration | Balance Sheet | Conditional | All | maturity schedule | ST share | MANUAL | none | MANUAL_ONLY | No | — | notes | suite |
| Q35 | Debt Growth Gap | Balance Sheet | Conditional | All | debt series | Δdebt − Δrev | MANUAL | none | MANUAL_ONLY | No | — | BS | suite |
| Q36 | Cash / Assets | Balance Sheet | Core | All | cash, assets | ratio | band ≥30/15/8/3% | derived.cashToAssets | IMPLEMENTED | No | — | BS | suite |
| Q37 | Invested Capital Turnover | Capital Efficiency | Core | All | revenue, IC | turnover | band (asset turnover proxy labeled as such) | derived.assetTurnover | IMPLEMENTED | asset turnover **labeled proxy** | valid only as IC-unavailable stand-in; not hidden | filings | suite |
| Q38 | Incremental ROIC | Capital Efficiency | Conditional | not banks | ΔNOPAT, ΔIC | iROIC | MANUAL | none | MANUAL_ONLY | No | — | filings | suite |
| Q39 | Asset Turnover | Capital Efficiency | Core | All | revenue, assets | AT | band ≥1.5/0.9/0.5/0.25 | derived.assetTurnover | IMPLEMENTED | No | — | filings | suite |
| Q40 | PPE Turnover | Capital Efficiency | Conditional | saas/financial C | revenue, PPE | rev/PPE | MANUAL | none | MANUAL_ONLY | No | — | BS | suite |
| Q41 | Cash ROIC | Capital Efficiency | Conditional | All | CFO−maint. capex, IC | cash ROIC | MANUAL | none | MANUAL_ONLY | **removed ROIC copy** | invalid | CFS | Q41 |
| Q42 | CAPEX Productivity | Capital Efficiency | Conditional | All | Δrev, capex | Δrev/capex | MANUAL | none | MANUAL_ONLY | No | — | CFS | suite |
| Q43 | CAPEX / Revenue | Reinvestment | Core | All | capex, revenue | ratio | inv-band | derived.capexToRev | IMPLEMENTED | No | — | CFS | suite |
| Q44 | CAPEX / CFO | Reinvestment | Conditional | All | capex, CFO | |capex|/|CFO| | inv-band | derived.capex, cfo | IMPLEMENTED | No | — | CFS | suite |
| Q45 | PPE Growth | Reinvestment | Conditional | All | PPE series | YoY | MANUAL | none | MANUAL_ONLY | No | — | BS | suite |
| Q46 | R&D / Revenue | Reinvestment | Core | R&D industries | R&D, revenue | ratio | band ≥12/6/3% | derived.rdToRev | IMPLEMENTED | No | — | P&L | suite |
| Q47 | R&D Growth | Reinvestment | Conditional | R&D industries | R&D series | YoY | band ≥15/5/0% | derived.rdGrowth | IMPLEMENTED | No | — | P&L | suite |
| Q48 | Backlog Growth | Reinvestment | Conditional | backlog industries | backlog | YoY | band ≥20/10/3/0% | derived.backlogGrowth | IMPLEMENTED | No | — | IR | suite |
| Q49 | Backlog Coverage | Reinvestment | Conditional | backlog industries | backlog, revenue | backlog/rev | MANUAL | none | MANUAL_ONLY | No | — | IR | suite |
| Q50 | Book-to-Bill | Reinvestment | Conditional | semi/industrial A | bookings, billings | B2B | band ≥1.2/1.05/0.95 | derived.bookToBill | IMPLEMENTED | No | — | IR | suite |
| Q51 | Contract Liability Growth | Reinvestment | Conditional | saas A else C | deferred revenue | YoY | MANUAL | none | MANUAL_ONLY | No | — | BS | suite |
| Q52 | Customer Concentration | Shareholder | Core | All | top-customer % | share | inv-band | derived.customerConcentration | IMPLEMENTED | No | — | 10-K | suite |
| Q53 | Share Count Growth | Shareholder | Core | All | diluted shares | YoY | inv-band | derived.shareGrowth | IMPLEMENTED | No | — | filings | suite |
| Q54 | 3Y Dilution | Shareholder | Core | All | 3Y diluted shares | 3Y CAGR | MANUAL | none | MANUAL_ONLY | **removed 1Y shares** | invalid | filings | suite |
| Q55 | Potential Dilution | Shareholder | Conditional | All | options, convertibles | potential % | MANUAL | none | MANUAL_ONLY | No | — | notes | suite |
| Q56 | EPS vs NI Gap | Shareholder | Diagnostic | All | EPS vs NI growth | gap | MANUAL | none | MANUAL_ONLY | No | — | P&L | diag |
| Q57 | External Funding Dependence | Shareholder | Core | All | FCF sign | +FCF 8 / − 3 | derived.fcf | IMPLEMENTED | No | — | CFS | suite |
| Q58 | Goodwill Change | Accounting | Diagnostic | All | goodwill | Δ | MANUAL | none | MANUAL_ONLY | No | — | BS | diag |
| Q59 | Intangible Growth Gap | Accounting | Diagnostic | All | intangibles vs rev | gap | MANUAL | none | MANUAL_ONLY | No | — | BS | diag |
| Q60 | Related Party Receivables | Accounting | Diagnostic | All | RP receivables | level | MANUAL | none | MANUAL_ONLY | No | — | notes | diag |
| Q61 | Audit Opinion | Accounting | Diagnostic | All | audit report | opinion | MANUAL | none | MANUAL_ONLY | No | — | 10-K | diag |
| Q62 | Non-core Income | Accounting | Diagnostic | All | other income | share | MANUAL | none | MANUAL_ONLY | No | — | P&L | diag |
| Q63 | Capitalized R&D | Accounting | Diagnostic | R&D industries | cap R&D | flag | MANUAL | none | MANUAL_ONLY | No | — | notes | diag |
| Q64 | Revenue Recognition | Accounting | Diagnostic | All | policy | qualitative | MANUAL | none | MANUAL_ONLY | No | — | notes | diag |
| Q65 | One-time Items | Accounting | Diagnostic | All | extras | flag | MANUAL | none | MANUAL_ONLY | No | — | P&L | diag |
| Q66 | Related Party | Accounting | Diagnostic | All | RP transactions | flag | MANUAL | none | MANUAL_ONLY | No | — | notes | diag |
| Q67 | Off-balance Commitments | Accounting | Diagnostic | All | commitments | flag | MANUAL | none | MANUAL_ONLY | No | — | notes | diag |
| Q68 | Pension / Lease | Accounting | Diagnostic | All | pension, lease | size | MANUAL | none | MANUAL_ONLY | No | — | notes | diag |
| Q69 | Restatement | Accounting | Diagnostic | All | restatement flag | flag | MANUAL | none | MANUAL_ONLY | No | — | 8-K/10-K | diag |
| Q70 | Going Concern | Accounting | Diagnostic | All | cash, FCF | liquidity stress | 8 vs 2 | cash+FCF heuristic | IMPLEMENTED | No | — | BS/CFS | diag |

Q37 uses asset turnover **explicitly labeled** as invested-capital-unavailable stand-in. It is not a silent wrong proxy (Cash ROIC / EPS / 3Y FCF class). If IC is later available, bump model version and replace.

See `QUALITY_FACTORS` in `src/lib/engines/quality.ts` for live bands.
