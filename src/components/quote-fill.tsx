import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input, NativeSelect } from "@/components/ui/input";
import type { Currency, ResearchQuote } from "@/lib/types";
import { parseUserMoney, type QuoteOverrides } from "@/lib/research/manual-quote";

function money(v: string): number | undefined {
  const n = parseUserMoney(v);
  return n == null ? undefined : n;
}

function str(n: number | null | undefined): string {
  if (n == null || n === 0) return "";
  return String(n);
}

export function QuoteFillForm({
  ticker,
  quote,
  busy,
  missing,
  onSubmit,
}: {
  ticker: string;
  quote?: ResearchQuote | null;
  busy?: boolean;
  missing?: string[];
  onSubmit: (overrides: QuoteOverrides, ticker: string) => void;
}) {
  const [t, setT] = useState(ticker);
  const [name, setName] = useState(quote?.companyName ?? "");
  const [currency, setCurrency] = useState<Currency>(quote?.currency ?? (/^\d{6}/.test(ticker) ? "KRW" : "USD"));
  const [price, setPrice] = useState(str(quote?.price));
  const [cap, setCap] = useState(str(quote?.marketCap));
  const [rev, setRev] = useState(str(quote?.financials.revenueTtm));
  const [op, setOp] = useState(str(quote?.financials.operatingIncomeTtm));
  const [ni, setNi] = useState(str(quote?.financials.netIncomeTtm));
  const [cash, setCash] = useState(str(quote?.financials.cash));
  const [debt, setDebt] = useState(str(quote?.financials.totalDebt));
  const [fcf, setFcf] = useState(str(quote?.financials.fcf));
  const [localError, setLocalError] = useState("");

  useEffect(() => {
    setT(ticker);
    if (!quote) return;
    setName(quote.companyName || "");
    setCurrency(quote.currency);
    if (quote.price > 0) setPrice(String(quote.price));
    if (quote.marketCap > 0) setCap(String(quote.marketCap));
    setRev(str(quote.financials.revenueTtm));
    setOp(str(quote.financials.operatingIncomeTtm));
    setNi(str(quote.financials.netIncomeTtm));
    setCash(str(quote.financials.cash));
    setDebt(str(quote.financials.totalDebt));
    setFcf(str(quote.financials.fcf));
  }, [ticker, quote]);

  function submit() {
    setLocalError("");
    const p = money(price);
    const m = money(cap);
    if (!t.trim()) {
      setLocalError("티커를 입력하세요.");
      return;
    }
    if (!(p && p > 0) || !(m && m > 0)) {
      setLocalError("주가와 시가총액은 필수입니다. 47.5조 / 14.4B / 절대값.");
      return;
    }
    onSubmit(
      {
        companyName: name.trim() || undefined,
        currency,
        price: p,
        marketCap: m,
        financials: {
          ...(money(rev) != null ? { revenueTtm: money(rev) } : {}),
          ...(money(op) != null ? { operatingIncomeTtm: money(op) } : {}),
          ...(money(ni) != null ? { netIncomeTtm: money(ni) } : {}),
          ...(money(cash) != null ? { cash: money(cash) } : {}),
          ...(money(debt) != null ? { totalDebt: money(debt) } : {}),
          ...(money(fcf) != null ? { fcf: money(fcf) } : {}),
        },
      },
      t.trim(),
    );
  }

  const needPrice = missing?.includes("price");
  const needCap = missing?.includes("marketCap");

  return (
    <div className="mt-4 rounded-[var(--radius-md)] bg-inset p-4">
      <p className="font-mono text-[0.625rem] tracking-widest text-sage uppercase">직접 입력</p>
      <p className="mt-1 text-xs text-muted">
        시세가 비면 주가·시총만 넣어도 분석됩니다. 실적은 있으면 Quality / Oversold가 채점합니다.
      </p>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <Field label="Ticker">
          <Input value={t} onChange={(e) => setT(e.target.value.toUpperCase())} />
        </Field>
        <Field label="기업명">
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="선택" />
        </Field>
        <Field label={needPrice ? "주가 (필수)" : "주가"}>
          <Input inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="37.64 / 70000" />
        </Field>
        <Field label={needCap ? "시가총액 (필수)" : "시가총액"}>
          <Input inputMode="decimal" value={cap} onChange={(e) => setCap(e.target.value)} placeholder="14.4B / 400조" />
        </Field>
        <Field label="통화">
          <NativeSelect value={currency} onChange={(e) => setCurrency(e.target.value as Currency)}>
            <option value="USD">USD</option>
            <option value="KRW">KRW</option>
          </NativeSelect>
        </Field>
        <Field label="매출 (TTM)">
          <Input inputMode="decimal" value={rev} onChange={(e) => setRev(e.target.value)} placeholder="1.2억 / 80M" />
        </Field>
        <Field label="영업이익">
          <Input inputMode="decimal" value={op} onChange={(e) => setOp(e.target.value)} />
        </Field>
        <Field label="순이익">
          <Input inputMode="decimal" value={ni} onChange={(e) => setNi(e.target.value)} />
        </Field>
        <Field label="현금">
          <Input inputMode="decimal" value={cash} onChange={(e) => setCash(e.target.value)} />
        </Field>
        <Field label="부채">
          <Input inputMode="decimal" value={debt} onChange={(e) => setDebt(e.target.value)} />
        </Field>
        <Field label="FCF">
          <Input inputMode="decimal" value={fcf} onChange={(e) => setFcf(e.target.value)} />
        </Field>
      </div>
      {localError ? <p className="mt-2 text-sm text-grade-d">{localError}</p> : null}
      <Button className="mt-3" disabled={busy} onClick={submit}>
        {busy ? "분석 중" : "이 값으로 분석"}
      </Button>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block font-mono text-[0.625rem] tracking-widest text-subtle uppercase">{label}</span>
      {children}
    </label>
  );
}
