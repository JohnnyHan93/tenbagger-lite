const UA = "IDT-preflight/2.3.1";

async function reachable(url: string, timeout = 4000): Promise<boolean> {
  try {
    const res = await fetch(url, {
      method: "GET",
      headers: { "User-Agent": UA, Accept: "application/json,text/plain,*/*" },
      signal: AbortSignal.timeout(timeout),
    });
    return res.ok || res.status === 429 || res.status === 403;
  } catch {
    return false;
  }
}

export interface QuoteProviderHealth {
  us: boolean;
  kr: boolean;
}

/** Connectivity only. Must not persist analyses, evidence, or call xAI. */
export async function probeQuoteProviders(): Promise<QuoteProviderHealth> {
  const [us, kr] = await Promise.all([
    reachable("https://query1.finance.yahoo.com/v8/finance/chart/AAPL?range=1d&interval=1d"),
    reachable("https://m.stock.naver.com/api/stock/005930/basic"),
  ]);
  return { us, kr };
}
