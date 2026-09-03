import { Link, createFileRoute } from "@tanstack/react-router";
import { PageTitle, SafetyNote } from "@/components/shell";
import { Chip } from "@/components/ui/badge";
import { NativeSelect } from "@/components/ui/input";
import { displayTicker, formatDate } from "@/lib/format";
import { latestAnalysis, useAppStore } from "@/lib/store";
import { FACTOR_ORDER, type FactorCode } from "@/lib/scoring/config";
import { useMemo, useState } from "react";

export const Route = createFileRoute("/evidence")({ component: EvidencePage });

function EvidencePage() {
  const companies = useAppStore((s) => s.companies);
  const analyses = useAppStore((s) => s.analyses);
  const [factor, setFactor] = useState<FactorCode | "ALL">("ALL");
  const [companyId, setCompanyId] = useState("ALL");

  const rows = useMemo(() => {
    const list = companies.flatMap((c) => {
      const a = latestAnalysis(analyses, c.id);
      if (!a) return [];
      return a.evidences.map((e) => ({ company: c, analysis: a, evidence: e }));
    });
    return list.filter((r) => {
      if (companyId !== "ALL" && r.company.id !== companyId) return false;
      if (factor !== "ALL" && r.evidence.factorCode !== factor) return false;
      return true;
    });
  }, [companies, analyses, factor, companyId]);

  return (
    <>
      <PageTitle kicker="Evidence" title="증거 브라우저" />
      <div className="mb-5 grid grid-cols-1 gap-2 md:grid-cols-2">
        <NativeSelect value={companyId} onChange={(e) => setCompanyId(e.target.value)}>
          <option value="ALL">종목 전체</option>
          {companies.map((c) => (
            <option key={c.id} value={c.id}>
              {displayTicker(c.ticker)} · {c.companyName}
            </option>
          ))}
        </NativeSelect>
        <NativeSelect
          value={factor}
          onChange={(e) => setFactor(e.target.value as FactorCode | "ALL")}
        >
          <option value="ALL">Factor 전체</option>
          {FACTOR_ORDER.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </NativeSelect>
      </div>

      <ul className="space-y-3">
        {rows.map((r) => (
          <li
            key={r.evidence.id}
            className="rounded-[var(--radius-lg)] bg-surface p-4 shadow-[var(--shadow-border)]"
          >
            <div className="flex flex-wrap items-center gap-2">
              <Link
                to="/company/$ticker"
                params={{ ticker: encodeURIComponent(r.company.ticker) }}
                className="font-mono text-sm text-sage"
              >
                {displayTicker(r.company.ticker)}
              </Link>
              <Chip>{r.evidence.factorCode}</Chip>
              <Chip>{r.evidence.evidenceType}</Chip>
              <span className="font-mono text-[0.6875rem] text-subtle">
                {formatDate(r.evidence.sourceDate || r.evidence.createdAt)}
              </span>
            </div>
            <p className="mt-2 text-sm leading-relaxed">{r.evidence.evidence}</p>
            <p className="mt-1 text-xs text-muted">{r.evidence.sourceName || "source unknown"}</p>
          </li>
        ))}
      </ul>
      {rows.length === 0 ? <p className="text-sm text-muted">조건에 맞는 증거가 없습니다.</p> : null}
      <SafetyNote />
    </>
  );
}
