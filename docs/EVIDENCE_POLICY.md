# Evidence policy

Evidence is a first-class graph object: id, statement, type, source tier, source, dates, confidence, factorTargets, engineTargets, status.

Tier 1 official filings / IR / customer announcements.
Tier 2 industry research / major press.
Tier 3 portals / community — cannot award top factor scores alone.
MANUAL user-entered.

Types: FACT, REPORTED, DERIVED, MANAGEMENT_TARGET, INFERENCE.
Status: ACTIVE, STALE, CONFLICTED, INVALIDATED.

Missing data → N/A + missing reason. Never fabricate TAM, share, or customers.
Contradictions stay in the graph as CONFLICTED; they are not silently deleted.
