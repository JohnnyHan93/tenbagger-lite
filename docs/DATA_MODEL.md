# Data model

`Snapshot` is the unit of analysis. Fields: asOf, price, financials, derived, evidence, xbagger, oversold, quality, lenses, tags.

Refresh appends a new snapshot. Override appends a new snapshot and an audit log row.

Universe: name, version, market, status open|locked|archived, tickers[].
