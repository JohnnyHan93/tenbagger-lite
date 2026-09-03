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
