import { displayTicker, formatDate } from "./format.ts";
import { latestSnapshot } from "./store.ts";
import type { Snapshot } from "./domain/snapshot.ts";
import type { Company } from "./types.ts";
import type { Universe } from "./domain/snapshot.ts";

function csvEscape(v: string | number | boolean | null | undefined): string {
  const s = v == null ? "" : String(v);
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function toCsv(headers: string[], rows: Array<Array<string | number | boolean | null | undefined>>): string {
  const lines = [headers.map(csvEscape).join(",")];
  for (const row of rows) lines.push(row.map(csvEscape).join(","));
  return "\uFEFF" + lines.join("\n");
}

export function downloadText(filename: string, content: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function exportMatrixCsv(companies: Company[], snapshots: Snapshot[]) {
  const headers = [
    "Ticker",
    "Company",
    "Market",
    "X-Bagger 0-100",
    "X Grade",
    "10x",
    "Oversold 0-10",
    "Value Trap 1-10",
    "Quality 70 0-100",
    "Quality Grade",
    "Coverage",
    "Tags",
    "AsOf",
  ];
  const rows = companies.map((c) => {
    const s = latestSnapshot(snapshots, c.id);
    return [
      displayTicker(c.ticker),
      c.companyName,
      c.country,
      s ? Math.round(s.xbagger.adjustedScore) : "",
      s?.xbagger.grade ?? "",
      s?.xbagger.tenxFeasibility ?? "",
      s?.oversold.opportunity ?? "",
      s?.oversold.valueTrap ?? "",
      s?.quality.score ?? "",
      s?.quality.grade ?? "",
      s ? Math.round(s.overallCoverage * 100) : "",
      s?.tags.join("|") ?? "",
      s ? formatDate(s.asOf) : "",
    ];
  });
  downloadText("idt-matrix.csv", toCsv(headers, rows), "text/csv;charset=utf-8");
}

export function exportSnapshotJson(company: Company, snapshots: Snapshot[]) {
  const pack = { company, snapshots: snapshots.filter((s) => s.companyId === company.id) };
  downloadText(
    `${displayTicker(company.ticker)}-research.json`,
    JSON.stringify(pack, null, 2),
    "application/json",
  );
}

export function exportUniverseJson(u: Universe) {
  downloadText(`${u.name.replace(/\s+/g, "-")}-v${u.version}.json`, JSON.stringify(u, null, 2), "application/json");
}

export function exportFullBackup(payload: unknown) {
  downloadText("idt-backup.json", JSON.stringify(payload, null, 2), "application/json");
}

export function exportMatrixXlsx(companies: Company[], snapshots: Snapshot[]) {
  const rows: string[][] = [
    [
      "Ticker",
      "Company",
      "X-Bagger 0-100",
      "Oversold 0-10",
      "Value Trap 1-10",
      "Quality 70 0-100",
      "Coverage",
      "Tags",
      "AsOf",
    ],
  ];
  for (const c of companies) {
    const s = latestSnapshot(snapshots, c.id);
    rows.push([
      displayTicker(c.ticker),
      c.companyName,
      s ? String(Math.round(s.xbagger.adjustedScore)) : "",
      s?.oversold.opportunity != null ? String(s.oversold.opportunity) : "",
      s ? String(s.oversold.valueTrap) : "",
      s?.quality.score != null ? String(s.quality.score) : "",
      s ? String(Math.round(s.overallCoverage * 100)) : "",
      s?.tags.join("|") ?? "",
      s ? formatDate(s.asOf) : "",
    ]);
  }
  void import("./xlsx.ts").then(({ downloadXlsx }) => downloadXlsx("idt-matrix.xlsx", rows, "Matrix"));
}

export function exportEvidenceCsv(company: Company, snapshots: Snapshot[]) {
  const s = latestSnapshot(snapshots, company.id);
  const headers = ["Ticker", "Factor", "Type", "Tier", "Statement", "Source", "URL", "Date", "Status"];
  const rows = (s?.evidence ?? []).map((e) => [
    displayTicker(company.ticker),
    e.factorCode,
    e.evidenceType,
    e.sourceTier ?? "",
    e.statement ?? e.evidence,
    e.sourceName,
    e.sourceUrl,
    e.sourceDate,
    e.status ?? "ACTIVE",
  ]);
  downloadText(
    `${displayTicker(company.ticker)}-evidence.csv`,
    toCsv(headers, rows),
    "text/csv;charset=utf-8",
  );
}

export function exportHistoryCsv(company: Company, snapshots: Snapshot[]) {
  const hist = snapshots.filter((s) => s.companyId === company.id).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  const headers = ["AsOf", "Price", "X", "Oversold", "ValueTrap", "Quality", "Coverage", "Provider"];
  const rows = hist.map((s) => [
    formatDate(s.asOf),
    s.price,
    Math.round(s.xbagger.adjustedScore),
    s.oversold.opportunity,
    s.oversold.valueTrap,
    s.quality.score,
    Math.round(s.overallCoverage * 100),
    s.researchProvider,
  ]);
  downloadText(`${displayTicker(company.ticker)}-history.csv`, toCsv(headers, rows), "text/csv;charset=utf-8");
}

export function exportUniverseCsv(u: Universe) {
  downloadText(
    `${u.name.replace(/\s+/g, "-")}-v${u.version}.csv`,
    toCsv(
      ["Ticker", "Name"],
      u.tickers.map((t) => [t.ticker, t.name ?? ""]),
    ),
    "text/csv;charset=utf-8",
  );
}

export function exportUniverseXlsx(u: Universe) {
  void import("./xlsx.ts").then(({ downloadXlsx }) =>
    downloadXlsx(
      `${u.name.replace(/\s+/g, "-")}-v${u.version}.xlsx`,
      [["Ticker", "Name"], ...u.tickers.map((t) => [t.ticker, t.name ?? ""])],
      "Universe",
    ),
  );
}

export function exportCompanyXlsx(company: Company, snapshots: Snapshot[]) {
  const s = latestSnapshot(snapshots, company.id);
  const rows: string[][] = [
    ["Field", "Value"],
    ["Ticker", displayTicker(company.ticker)],
    ["Company", company.companyName],
    ["AsOf", s ? formatDate(s.asOf) : ""],
    ["X-Bagger", s ? String(Math.round(s.xbagger.adjustedScore)) : ""],
    ["Oversold", s?.oversold.opportunity != null ? String(s.oversold.opportunity) : ""],
    ["Value Trap", s ? String(s.oversold.valueTrap) : ""],
    ["Quality 70", s?.quality.score != null ? String(s.quality.score) : ""],
    ["Coverage", s ? String(Math.round(s.overallCoverage * 100)) : ""],
    ["Provider", s?.researchProvider ?? ""],
    [],
    ["Engine", "Factor", "Score", "Reason", "Status"],
  ];
  if (s) {
    for (const f of s.xbagger.factors) {
      rows.push(["X-Bagger", `${f.id} ${f.name}`, f.score == null ? "N/A" : String(f.score), f.reason, f.status]);
    }
    rows.push([
      "Oversold",
      "Opportunity",
      s.oversold.opportunity == null ? "N/A" : String(s.oversold.opportunity),
      s.oversold.reasons.fundamental,
      s.oversold.status,
    ]);
    for (const f of s.quality.factors) {
      rows.push(["Quality", `${f.id} ${f.name}`, f.score == null ? "N/A" : String(f.score), f.reason, f.status]);
    }
    rows.push([]);
    rows.push(["Evidence ID", "Type", "Tier", "Statement", "Source", "Status"]);
    for (const e of s.evidence) {
      rows.push([
        e.id,
        e.evidenceType,
        e.sourceTier ?? "",
        e.statement ?? e.evidence,
        e.sourceName,
        e.status ?? "ACTIVE",
      ]);
    }
  }
  void import("./xlsx.ts").then(({ downloadXlsx }) =>
    downloadXlsx(`${displayTicker(company.ticker)}-analysis.xlsx`, rows, "Analysis"),
  );
}

