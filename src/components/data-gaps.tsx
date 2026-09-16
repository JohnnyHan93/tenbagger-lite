import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { Snapshot } from "@/lib/domain/snapshot";
import type { Company } from "@/lib/types";
import {
  FILL_FIELDS,
  listDataNeeds,
  type DataNeedItem,
  type EngineId,
  type FillFieldDef,
  type FillFieldKey,
} from "@/lib/research/data-needs";
import {
  parseListInput,
  parseMoneyInput,
  parsePctInput,
  type ManualFillPatch,
} from "@/lib/research/manual-fill";

const ENGINE_LABEL: Record<EngineId, string> = {
  xbagger: "X-Bagger",
  oversold: "Oversold",
  quality: "Quality 70",
};

function ModePill({ mode }: { mode: "AUTO" | "MANUAL" }) {
  return (
    <span
      className={
        mode === "AUTO"
          ? "rounded-full bg-elevated px-2 py-0.5 font-mono text-[0.625rem] tracking-wide text-sage"
          : "rounded-full bg-elevated px-2 py-0.5 font-mono text-[0.625rem] tracking-wide text-grade-c"
      }
    >
      {mode === "AUTO" ? "자동" : "직접입력"}
    </span>
  );
}

export function GapCountLink({
  snapshot,
  ticker,
  engine,
}: {
  snapshot: Snapshot;
  ticker: string;
  engine?: EngineId;
}) {
  const c = listDataNeeds(snapshot).counts;
  const label =
    engine === "xbagger" ? `X ${c.x}` : engine === "oversold" ? `O ${c.o}` : engine === "quality" ? `Q ${c.q}` : `X${c.x} · O${c.o} · Q${c.q}`;
  const n = engine === "xbagger" ? c.x : engine === "oversold" ? c.o : engine === "quality" ? c.q : c.x + c.o + c.q;
  return (
    <Link
      to="/company/$ticker"
      params={{ ticker: encodeURIComponent(ticker) }}
      search={{ tab: "g" }}
      className={n ? "font-mono text-xs text-grade-c hover:text-fg" : "font-mono text-xs text-subtle hover:text-fg"}
    >
      {n ? label : "—"}
    </Link>
  );
}

export function DataGapsPanel({
  snapshot,
  company,
  onSaved,
  onScrape,
  scraping,
}: {
  snapshot: Snapshot;
  company: Company;
  onSaved: (patch: ManualFillPatch) => void;
  onScrape: () => void;
  scraping?: boolean;
}) {
  const report = useMemo(() => listDataNeeds(snapshot, company), [snapshot, company]);
  const [values, setValues] = useState<Record<string, string>>({});
  const [fy, setFy] = useState<Record<string, [string, string, string]>>({});
  const [q2, setQ2] = useState<[string, string]>(["", ""]);
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  const byEngine = (id: EngineId) => report.items.filter((i) => i.engine === id);
  const coreQ = byEngine("quality").filter((i) => i.kind === "Core");
  const condQ = byEngine("quality").filter((i) => i.kind !== "Core");

  function setVal(key: string, v: string) {
    setValues((s) => ({ ...s, [key]: v }));
  }

  function submit() {
    setMsg("");
    const financials: NonNullable<ManualFillPatch["financials"]> = {};
    const extras: NonNullable<ManualFillPatch["extras"]> = {};
    const series: NonNullable<ManualFillPatch["series"]> = {};
    const pack: NonNullable<ManualFillPatch["pack"]> = {};
    const patch: ManualFillPatch = { financials, extras, series, pack };
    let filled = 0;
    const snapshotMoney = [
      "revenueTtm",
      "revenuePrior",
      "operatingIncomeTtm",
      "netIncomeTtm",
      "cash",
      "totalDebt",
      "fcf",
      "cfo",
    ] as const;
    for (const k of snapshotMoney) {
      const n = parseMoneyInput(values[k] ?? "");
      if (n == null) continue;
      financials[k] = n;
      filled++;
    }
    for (const k of ["assets", "capex", "investedCapital"] as const) {
      const n = parseMoneyInput(values[k] ?? "");
      if (n == null) continue;
      extras[k] = n;
      filled++;
    }
    const gm = parsePctInput(values.grossMargin ?? "");
    if (gm != null) {
      financials.grossMargin = gm;
      filled++;
    }
    const shares = Number((values.sharesOutstanding ?? "").replace(/,/g, ""));
    if (Number.isFinite(shares) && shares > 0) {
      financials.sharesOutstanding = shares;
      filled++;
    }
    const high = Number((values.high52w ?? "").replace(/,/g, ""));
    if (Number.isFinite(high) && high > 0) {
      patch.high52w = high;
      filled++;
    }
    const pb = Number((values.pb ?? "").replace(/,/g, ""));
    if (Number.isFinite(pb) && pb > 0) {
      patch.pb = pb;
      filled++;
    }
    const pctExtras = [
      ["roic", "roic"],
      ["rdToRev", "rdToRev"],
      ["rdGrowth", "rdGrowth"],
      ["backlogGrowth", "backlogGrowth"],
      ["customerConcentration", "customerConcentration"],
      ["organicShare", "organicShare"],
    ] as const;
    for (const [k, dest] of pctExtras) {
      const n = parsePctInput(values[k] ?? "");
      if (n == null) continue;
      extras[dest] = n;
      filled++;
    }
    const icov = Number((values.interestCoverage ?? "").replace(/,/g, ""));
    if (Number.isFinite(icov) && icov !== 0) {
      extras.interestCoverage = icov;
      filled++;
    }
    const b2b = Number((values.bookToBill ?? "").replace(/,/g, ""));
    if (Number.isFinite(b2b) && b2b > 0) {
      extras.bookToBill = b2b;
      filled++;
    }
    if (/^(y|yes|true|1|있음|확인)$/i.test((values.goingConcern ?? "").trim())) {
      extras.goingConcernEvidence = true;
      filled++;
    }
    const tam = parsePctInput(values.tamCagr ?? "");
    if (tam != null) {
      pack.tamCagr = tam;
      filled++;
    }
    const share = parsePctInput(values.marketShare ?? "");
    if (share != null) {
      pack.marketShare = share;
      filled++;
    }
    const customers = parseListInput(values.customers ?? "");
    if (customers.length) {
      pack.customers = customers;
      filled++;
    }
    const moat = (values.moat ?? "").trim();
    if (moat) {
      pack.moat = moat;
      filled++;
    }
    for (const key of Object.keys(FILL_FIELDS) as FillFieldKey[]) {
      if (FILL_FIELDS[key].kind !== "fy3") continue;
      const row = fy[key];
      if (!row) continue;
      const ok = row.map((s) => parseMoneyInput(s));
      if (ok.some((n) => n != null)) {
        series[key] = ok;
        filled++;
      }
    }
    const qNums = q2.map((s) => parseMoneyInput(s));
    if (qNums.some((n) => n != null)) {
      patch.qRevenue = qNums;
      filled++;
    }
    if (!filled) {
      setMsg("입력된 값이 없습니다. 자동으로 되는 항목은 인터넷에서 채우기를 누르세요.");
      return;
    }
    setBusy(true);
    try {
      onSaved(patch);
      setValues({});
      setFy({});
      setQ2(["", ""]);
      setMsg("새 스냅샷으로 저장했습니다. 과거 분석은 그대로입니다.");
    } catch (err) {
      setMsg(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  if (report.items.length === 0) {
    return (
      <section className="rounded-[var(--radius-lg)] bg-surface p-4 shadow-[var(--shadow-border)]">
        <p className="font-mono text-[0.625rem] tracking-widest text-sage uppercase">부족한 데이터</p>
        <p className="mt-2 text-sm text-muted">세 엔진 모두 표시할 공백이 없습니다.</p>
      </section>
    );
  }

  return (
    <section className="rounded-[var(--radius-lg)] bg-surface p-4 shadow-[var(--shadow-border)]">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-mono text-[0.625rem] tracking-widest text-sage uppercase">부족한 데이터</p>
          <p className="mt-2 font-mono text-sm tabular-nums">
            X {report.counts.x} · Oversold {report.counts.o} · Quality {report.counts.q}
            <span className="ml-2 text-subtle">
              자동 {report.counts.auto} · 직접 {report.counts.manual}
            </span>
          </p>
          <p className="mt-1 text-xs text-muted">
            자동은 Yahoo/Naver에서 다시 긁습니다. 직접입력은 TAM·점유율·고객명·유기성장처럼 공시 숫자입니다.
          </p>
        </div>
        <Button variant="secondary" disabled={scraping} onClick={onScrape}>
          {scraping ? "긁는 중" : "인터넷에서 채우기"}
        </Button>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-3">
        <EngineList title="X-Bagger" items={byEngine("xbagger")} />
        <EngineList title="Oversold" items={byEngine("oversold")} />
        <div>
          <EngineList title="Quality Core" items={coreQ} />
          {condQ.length ? (
            <details className="mt-2">
              <summary className="cursor-pointer font-mono text-[0.625rem] tracking-widest text-subtle uppercase">
                Conditional {condQ.length}
              </summary>
              <ul className="mt-2 space-y-1">
                {condQ.map((it) => (
                  <NeedRow key={`${it.engine}-${it.factor}`} item={it} />
                ))}
              </ul>
            </details>
          ) : null}
        </div>
      </div>

      {report.fields.length ? (
        <div className="mt-5 border-t border-border pt-4">
          <p className="font-mono text-[0.625rem] tracking-widest text-sage uppercase">직접 넣을 값</p>
          <p className="mt-1 text-xs text-muted">비어 있는 칸만 채우면 됩니다. 조/억/B 가능. 새 분석이 추가되고 이전 건은 안 바뀝니다.</p>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            {report.fields.map((f) => (
              <FieldInput
                key={f.key}
                def={f}
                value={values[f.key] ?? ""}
                fy={fy[f.key]}
                q2={q2}
                onChange={(v) => setVal(f.key, v)}
                onFy={(row) => setFy((s) => ({ ...s, [f.key]: row }))}
                onQ2={setQ2}
              />
            ))}
          </div>
          {msg ? <p className="mt-3 text-sm text-muted">{msg}</p> : null}
          <Button className="mt-3" disabled={busy} onClick={submit}>
            {busy ? "채점 중" : "이 값으로 다시 채점"}
          </Button>
        </div>
      ) : (
        <p className="mt-4 text-sm text-muted">입력 칸이 있는 공백은 없습니다. 인터넷에서 채우기를 먼저 시도하세요.</p>
      )}
    </section>
  );
}

function EngineList({ title, items }: { title: string; items: DataNeedItem[] }) {
  return (
    <div>
      <p className="font-mono text-[0.625rem] tracking-widest text-subtle uppercase">{title}</p>
      {items.length === 0 ? (
        <p className="mt-2 text-xs text-muted">공백 없음</p>
      ) : (
        <ul className="mt-2 space-y-1">
          {items.map((it) => (
            <NeedRow key={`${it.engine}-${it.factor}`} item={it} />
          ))}
        </ul>
      )}
    </div>
  );
}

function NeedRow({ item }: { item: DataNeedItem }) {
  return (
    <li className="rounded-[var(--radius-md)] bg-inset px-3 py-2">
      <p className="flex flex-wrap items-center gap-2 text-sm">
        <span className="font-mono text-[0.625rem] text-subtle">{item.factor}</span>
        <span>{item.name}</span>
        <ModePill mode={item.mode} />
      </p>
      <p className="mt-0.5 text-xs text-muted">{item.reason}</p>
    </li>
  );
}

function FieldInput({
  def,
  value,
  fy,
  q2,
  onChange,
  onFy,
  onQ2,
}: {
  def: FillFieldDef;
  value: string;
  fy?: [string, string, string];
  q2: [string, string];
  onChange: (v: string) => void;
  onFy: (row: [string, string, string]) => void;
  onQ2: (row: [string, string]) => void;
}) {
  return (
    <label className="block">
      <span className="mb-1 flex items-center gap-2 font-mono text-[0.625rem] tracking-widest text-subtle uppercase">
        {def.label}
        <ModePill mode={def.mode} />
      </span>
      {def.kind === "fy3" ? (
        <div className="grid grid-cols-3 gap-1">
          {(["2년전", "1년전", "최근"] as const).map((lab, i) => (
            <Input
              key={lab}
              inputMode="decimal"
              placeholder={lab}
              value={(fy ?? ["", "", ""])[i]}
              onChange={(e) => {
                const next: [string, string, string] = [...(fy ?? ["", "", ""])] as [string, string, string];
                next[i] = e.target.value;
                onFy(next);
              }}
            />
          ))}
        </div>
      ) : def.kind === "q2" ? (
        <div className="grid grid-cols-2 gap-1">
          <Input inputMode="decimal" placeholder="직전 분기" value={q2[0]} onChange={(e) => onQ2([e.target.value, q2[1]])} />
          <Input inputMode="decimal" placeholder="최근 분기" value={q2[1]} onChange={(e) => onQ2([q2[0], e.target.value])} />
        </div>
      ) : def.kind === "bool" ? (
        <Input value={value} onChange={(e) => onChange(e.target.value)} placeholder="있음 / 없음" />
      ) : def.kind === "list" ? (
        <Input value={value} onChange={(e) => onChange(e.target.value)} placeholder={def.hint || "NVIDIA, AWS"} />
      ) : (
        <Input
          inputMode="decimal"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={def.hint || (def.kind === "pct" ? "18% / 0.18" : "14.4B / 47.5조")}
        />
      )}
    </label>
  );
}

void ENGINE_LABEL;
