export interface UniverseTicker {
  ticker: string;
  name?: string;
}

export interface ParsedUniverse {
  tickers: UniverseTicker[];
  errors: string[];
}

const TICKER_RE = /^[A-Z0-9.]{1,12}$/;

function cleanTicker(raw: string): string {
  return raw.trim().toUpperCase().replace(/^\$/, "");
}

export function parseTickerList(text: string): ParsedUniverse {
  const tickers: UniverseTicker[] = [];
  const errors: string[] = [];
  const seen = new Set<string>();
  const trimmed = text.trim();
  if (!trimmed) return { tickers, errors: ["빈 입력"] };

  if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
    try {
      const json = JSON.parse(trimmed) as unknown;
      const arr = Array.isArray(json)
        ? json
        : Array.isArray((json as { tickers?: unknown }).tickers)
          ? (json as { tickers: unknown[] }).tickers
          : null;
      if (!arr) {
        return { tickers, errors: ["JSON에 tickers 배열이 없습니다"] };
      }
      for (const row of arr) {
        if (typeof row === "string") push(cleanTicker(row), undefined);
        else if (row && typeof row === "object" && "ticker" in row) {
          const t = cleanTicker(String((row as { ticker: string }).ticker));
          const name = "name" in row ? String((row as { name: string }).name) : undefined;
          push(t, name);
        }
      }
      return { tickers, errors };
    } catch {
      return { tickers, errors: ["JSON 파싱 실패"] };
    }
  }

  const lines = trimmed.split(/\r?\n/);
  const looksCsv = lines[0]?.includes(",");
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!.trim();
    if (!line || line.startsWith("#")) continue;
    if (line.startsWith("|")) {
      const cells = line.split("|").map((c) => c.trim()).filter(Boolean);
      if (cells.every((c) => /^[-:]+$/.test(c))) continue;
      if (/^ticker$/i.test(cells[0] ?? "")) continue;
      const t = cleanTicker(cells[0] ?? "");
      const name = cells[1];
      push(t, name);
      continue;
    }
    if (looksCsv) {
      const cells = line.split(",").map((c) => c.trim().replace(/^"|"$/g, ""));
      if (i === 0 && /ticker/i.test(cells[0] ?? "")) continue;
      push(cleanTicker(cells[0] ?? ""), cells[1]);
      continue;
    }
    const parts = line.split(/[\s,;]+/);
    push(cleanTicker(parts[0] ?? ""), parts.slice(1).join(" ") || undefined);
  }
  return { tickers, errors };

  function push(ticker: string, name?: string) {
    if (!ticker) return;
    if (!TICKER_RE.test(ticker) && !/^\d{6}(\.(KS|KQ))?$/.test(ticker)) {
      errors.push(`잘못된 티커: ${ticker}`);
      return;
    }
    if (seen.has(ticker)) {
      errors.push(`중복: ${ticker}`);
      return;
    }
    seen.add(ticker);
    tickers.push({ ticker, name: name || undefined });
  }
}

export function previewImport(text: string): { count: number; sample: string[]; errors: string[] } {
  const parsed = parseTickerList(text);
  return {
    count: parsed.tickers.length,
    sample: parsed.tickers.slice(0, 8).map((t) => t.ticker),
    errors: parsed.errors.slice(0, 12),
  };
}
