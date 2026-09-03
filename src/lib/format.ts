import type { Currency } from "./types.ts";


export function formatMoney(n: number | null | undefined, currency: Currency): string {
  if (n == null || !Number.isFinite(n)) return "—";
  const abs = Math.abs(n);
  if (currency === "KRW") {
    const sign = n < 0 ? "-" : "";
    if (abs >= 1e12) return `${sign}${(n / 1e12).toFixed(2)}조`;
    if (abs >= 1e8) return `${sign}${(n / 1e8).toFixed(1)}억`;
    return `${sign}${Math.round(n).toLocaleString("ko-KR")}원`;
  }
  const sign = n < 0 ? "-" : "";
  if (abs >= 1e12) return `${sign}$${(abs / 1e12).toFixed(2)}T`;
  if (abs >= 1e9) return `${sign}$${(abs / 1e9).toFixed(2)}B`;
  if (abs >= 1e6) return `${sign}$${(abs / 1e6).toFixed(2)}M`;
  return `${sign}$${abs.toLocaleString("en-US", { maximumFractionDigits: 2 })}`;
}

export function formatPrice(n: number, currency: Currency): string {
  if (!Number.isFinite(n)) return "—";
  if (currency === "KRW") {
    return `${Math.round(n).toLocaleString("ko-KR")}원`;
  }
  return `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function formatPct(n: number | null | undefined, digits = 0): string {
  if (n == null || !Number.isFinite(n)) return "—";
  return `${(n * 100).toFixed(digits)}%`;
}

export function formatMultiple(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return "—";
  return `${n.toFixed(1)}x`;
}

export function formatScore(n: number): string {
  return Math.round(n).toString();
}

export function formatOutOf(
  n: number | null | undefined,
  max: number,
  digits: number,
): string {
  if (n == null || !Number.isFinite(n)) return "N/A";
  return `${n.toFixed(digits)} / ${max}`;
}

export function formatXScore(n: number | null | undefined): string {
  return formatOutOf(n, 100, 1);
}

export function formatOppScore(n: number | null | undefined): string {
  return formatOutOf(n, 10, 2);
}

export function formatQualityScore(n: number | null | undefined): string {
  return formatOutOf(n, 100, 1);
}

export function formatFactor10(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return "N/A";
  return Number.isInteger(n) ? `${n} / 10` : `${n.toFixed(1)} / 10`;
}

export const ENGINE_TAB = {
  xbagger: { id: "x" as const, name: "X-Bagger", version: "XBG-v2.0" },
  oversold: { id: "o" as const, name: "Oversold", version: "OSM-v1.0" },
  quality: { id: "q" as const, name: "Quality 70", version: "MFC70-v1.1" },
};

export function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso.slice(0, 10);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function signedChange(n: number): string {
  if (n > 0) return `+${n}`;
  return String(n);
}

export function displayTicker(ticker: string): string {
  return ticker.replace(/\.(KS|KQ|N|O|L)$/i, "");
}
