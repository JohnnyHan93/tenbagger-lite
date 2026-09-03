import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input, NativeSelect, Textarea } from "@/components/ui/input";
import { FACTOR_META, FACTOR_ORDER, type FactorCode, type FlagStatus } from "@/lib/scoring/config";
import { makeFlag } from "@/lib/risk/flags";
import { buildScenario, feasibilityFromMath } from "@/lib/tenx/calculator";
import type { Currency, ResearchDraft, ResearchQuote } from "@/lib/types";
import { uid } from "@/lib/utils";

const emptyQuote = (): ResearchQuote => ({
  ticker: "",
  exchange: "",
  companyName: "",
  currency: "USD",
  price: 0,
  marketCap: 0,
  enterpriseValue: 0,
  country: "",
  sector: "",
  industry: "",
  financials: {
    revenueTtm: null,
    revenuePrior: null,
    operatingIncomeTtm: null,
    netIncomeTtm: null,
    cash: null,
    totalDebt: null,
    sharesOutstanding: null,
    grossMargin: null,
    operatingMargin: null,
    fcf: null,
  },
});

export function ManualForm({
  initialTicker,
  onSubmit,
  busy,
}: {
  initialTicker?: string;
  onSubmit: (draft: ResearchDraft) => void;
  busy?: boolean;
}) {
  const [q, setQ] = useState<ResearchQuote>({
    ...emptyQuote(),
    ticker: initialTicker?.toUpperCase() ?? "",
  });
  const [scores, setScores] = useState<Record<FactorCode, number>>(() => {
    const o = {} as Record<FactorCode, number>;
    for (const c of FACTOR_ORDER) o[c] = 4;
    return o;
  });
  const [summaries, setSummaries] = useState<Record<FactorCode, string>>(() => {
    const o = {} as Record<FactorCode, string>;
    for (const c of FACTOR_ORDER) o[c] = "";
    return o;
  });
  const [mgmt, setMgmt] = useState<FlagStatus>("GREEN");
  const [surv, setSurv] = useState<FlagStatus>("GREEN");
  const [tenx, setTenx] = useState<FlagStatus>("GREEN");
  const [revBase, setRevBase] = useState("");
  const [revBull, setRevBull] = useState("");
  const [thesis, setThesis] = useState("");
  const [error, setError] = useState("");

  function num(v: string): number {
    return Number(String(v).replace(/,/g, "")) || 0;
  }

  function submit() {
    setError("");
    if (!q.ticker.trim() || !q.companyName.trim()) {
      setError("티커와 기업명을 입력하세요.");
      return;
    }
    if (!(q.marketCap > 0) || !(q.price > 0)) {
      setError("주가와 시가총액을 숫자로 입력하세요.");
      return;
    }
    const baseRev = num(revBase) || q.marketCap / 5;
    const bullRev = num(revBull) || q.marketCap / 2;
    const base = buildScenario({
      scenario: "BASE",
      revenue: baseRev,
      operatingMargin: 0.18,
      netMargin: 0.12,
      multipleType: "EV_SALES",
      multipleValue: 8,
      currentMarketCap: q.marketCap,
    });
    const bull = buildScenario({
      scenario: "BULL",
      revenue: bullRev,
      operatingMargin: 0.28,
      netMargin: 0.2,
      multipleType: "EV_SALES",
      multipleValue: 12,
      currentMarketCap: q.marketCap,
    });
    const flags = [
      makeFlag("MANAGEMENT", mgmt, "수동 입력"),
      makeFlag("SURVIVAL", surv, "수동 입력"),
      makeFlag("TENX", tenx, "수동 입력"),
    ];
    const draft: ResearchDraft = {
      quote: {
        ...q,
        ticker: q.ticker.trim().toUpperCase(),
        enterpriseValue: q.enterpriseValue || q.marketCap,
      },
      factors: FACTOR_ORDER.map((code) => ({
        code,
        score: scores[code],
        summary: summaries[code] || "수동 입력",
      })),
      redFlags: flags,
      tenxScenarios: [base, bull],
      requiredRevenue: q.marketCap * 10 / 8,
      requiredNetIncome: q.marketCap * 10 / 25,
      requiredPe: 25,
      requiredEvSales: 8,
      tenxFeasibility: feasibilityFromMath([base, bull], scores.F10, tenx === "RED"),
      catalysts: [],
      risks: [],
      nextProof: [],
      killCriteria: [],
      thesis,
      evidences: [
        {
          id: uid("e"),
          factorCode: "GENERAL",
          evidence: "Manual Mode 입력",
          evidenceType: "INFERENCE",
          sourceName: "User",
          sourceUrl: "",
          sourceDate: new Date().toISOString().slice(0, 10),
          confidence: 1,
          createdAt: new Date().toISOString(),
        },
      ],
      researchProvider: "manual",
    };
    onSubmit(draft);
  }

  return (
    <form
      className="space-y-5"
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
    >
      <div className="grid gap-3 md:grid-cols-2">
        <Field label="Ticker">
          <Input
            value={q.ticker}
            onChange={(e) => setQ({ ...q, ticker: e.target.value.toUpperCase() })}
            placeholder="RKLB / 005930"
          />
        </Field>
        <Field label="기업명">
          <Input value={q.companyName} onChange={(e) => setQ({ ...q, companyName: e.target.value })} />
        </Field>
        <Field label="Exchange">
          <Input value={q.exchange} onChange={(e) => setQ({ ...q, exchange: e.target.value })} />
        </Field>
        <Field label="통화">
          <NativeSelect
            value={q.currency}
            onChange={(e) => setQ({ ...q, currency: e.target.value as Currency })}
          >
            <option value="USD">USD</option>
            <option value="KRW">KRW</option>
          </NativeSelect>
        </Field>
        <Field label="주가">
          <Input
            inputMode="decimal"
            value={q.price || ""}
            onChange={(e) => setQ({ ...q, price: num(e.target.value) })}
          />
        </Field>
        <Field label="시가총액 (절대값)">
          <Input
            inputMode="decimal"
            value={q.marketCap || ""}
            onChange={(e) => setQ({ ...q, marketCap: num(e.target.value) })}
            placeholder="47560000000"
          />
        </Field>
        <Field label="국가">
          <Input value={q.country} onChange={(e) => setQ({ ...q, country: e.target.value })} />
        </Field>
        <Field label="섹터">
          <Input value={q.sector} onChange={(e) => setQ({ ...q, sector: e.target.value })} />
        </Field>
      </div>

      <div>
        <h3 className="mb-2 font-mono text-xs tracking-widest text-muted">10 FACTORS</h3>
        <div className="space-y-2">
          {FACTOR_ORDER.map((code) => (
            <div key={code} className="grid gap-2 rounded-[var(--radius-md)] bg-elevated p-3 md:grid-cols-[4.5rem_7rem_1fr] md:items-center">
              <span className="font-mono text-xs text-subtle">{code}</span>
              <NativeSelect
                value={scores[code]}
                onChange={(e) => setScores({ ...scores, [code]: Number(e.target.value) })}
              >
                <option value={0}>0</option>
                <option value={2}>2</option>
                <option value={4}>4</option>
                <option value={6}>6</option>
                <option value={8}>8</option>
                <option value={10}>10</option>
              </NativeSelect>
              <Input
                placeholder={FACTOR_META[code].nameKo}
                value={summaries[code]}
                onChange={(e) => setSummaries({ ...summaries, [code]: e.target.value })}
              />
            </div>
          ))}
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <Field label="Management">
          <FlagSelect value={mgmt} onChange={setMgmt} />
        </Field>
        <Field label="Survival">
          <FlagSelect value={surv} onChange={setSurv} />
        </Field>
        <Field label="10x Structure">
          <FlagSelect value={tenx} onChange={setTenx} />
        </Field>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <Field label="BASE 매출 (미래)">
          <Input value={revBase} onChange={(e) => setRevBase(e.target.value)} />
        </Field>
        <Field label="BULL 매출 (미래)">
          <Input value={revBull} onChange={(e) => setRevBull(e.target.value)} />
        </Field>
      </div>

      <Field label="한 문장 Thesis">
        <Textarea value={thesis} onChange={(e) => setThesis(e.target.value)} rows={3} />
      </Field>

      {error ? <p className="text-sm text-grade-d">{error}</p> : null}

      <Button type="submit" disabled={busy}>
        수동 분석 저장
      </Button>
    </form>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block font-mono text-[0.625rem] tracking-widest text-subtle uppercase">
        {label}
      </span>
      {children}
    </label>
  );
}

function FlagSelect({
  value,
  onChange,
}: {
  value: FlagStatus;
  onChange: (v: FlagStatus) => void;
}) {
  return (
    <NativeSelect value={value} onChange={(e) => onChange(e.target.value as FlagStatus)}>
      <option value="GREEN">GREEN</option>
      <option value="YELLOW">YELLOW</option>
      <option value="RED">RED</option>
    </NativeSelect>
  );
}
