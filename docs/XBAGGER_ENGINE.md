# X-Bagger XBG-v2.3

Weights X01–X10 sum to 100. Score 0–10. N/A excluded from denominator.

Coverage: ≥90 no penalty, 80–89 −3, 70–79 −7, <70 RESEARCH REQUIRED.

Hard gates (not mixed into the average): Trust, 12m Survival, 10x feasibility, Customer watchlist.

## XBG-SCR-v1.0 screening overlay (Johnny-AI-OS news rules)

Does **not** change F1–F10 weights. Overlay flags only:

- Cash runway from cash / burn (FCF and OP if negative)
- Dilution (share growth)
- PoC / unnamed customers (customer gate WATCHLIST or RESEARCH REQUIRED)
- Backlog N/A for semi/industrial (no invented conversion)
- FCF burn

Formula bump is deferred (Johnny-AI-OS NEWS_MONITORING_LOG). Past snapshots unchanged.

## v2.3 honesty

- F10 needs observed growth (`revenuePrior`) as well as current revenue. TTM-only names stay F10=N/A. No 0% CAGR scenario pack and no fixed EV/S 12x path.
- Trust gate: going concern / trustFail → FAIL. Management or disclosure evidence → PASS. Otherwise RESEARCH REQUIRED (not an implicit PASS).
- Incomplete Oversold Case no longer tags TURNAROUND.

## v2.2 honesty

- F1 TAM is N/A without a numeric TAM CAGR in the pack. AI/quantum keywords do not mint a score.
- F2 prefers 3Y revenue CAGR from FY series (4 annual points). Latest YoY still reported; a stall or drop caps the 3Y score.
- F3 uses gross margin plus operating profit. Deep operating losses cap unit-economics even if GM looks fine. Expanding OM from series can lift a profitable name.
- F5 needs an explicit market-share percentage. “World’s leading” is not a share number.
- F6 needs named customers (or named + repeat PO). Revenue is not customer proof.
- F7: 3Y CFO persistence + net cash scores 8 when FCF is mixed. Missing cashflow stays RESEARCH REQUIRED, not PASS.
- F8 is N/A without a sales multiple (unless mega-cap already prices the future). No invented small-cap 4/6.
- F9 is N/A with no catalyst disclosure (not a zero).
- F10 remains Tenx math only.

## v2.1 integrity (kept)

- F10 is Tenx math, not narrative. No revenue → F10 = N/A. `marketCap/20` and default 25% growth are gone.
- Tenx path: current cap → ×10 target → required revenue / NI / PE / EV/S / CAGR → Base/Bull feasibility → F10 ladder 0/2/4/6/8/10.
- Survival gate uses cashflow + runway + net cash evidence. Missing evidence is RESEARCH REQUIRED, not PASS. FAIL only with distress.
- Customer gate needs named / paid / repeat / retention evidence. Revenue alone is not PASS.
- Trust signals distinguish MANAGEMENT / DISCLOSURE / AUDIT·GOING CONCERN. Quality score is never added in.
- Snapshot stores criteria provenance (`schema`, `overlayId`, engine versions, hash).

Knobs (weights, grade cutoffs, gates, coverage penalties) live in CriteriaPack `CRITERIA-v1`. Formula changes stay in code.
