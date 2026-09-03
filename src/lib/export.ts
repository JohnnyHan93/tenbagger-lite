import { displayTicker, formatDate } from "./format";
import { latestAnalysis } from "./store";
import type { Analysis, Company } from "./types";

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

export function exportWatchlistCsv(companies: Company[], analyses: Analysis[]) {
  const headers = [
    "Ticker",
    "Company",
    "Country",
    "Sector",
    "Score",
    "Grade",
    "Verdict",
    "10x",
    "Price",
    "MarketCap",
    "Currency",
    "LastAnalysis",
    "ScoringVersion",
  ];
  const rows = companies.map((c) => {
    const a = latestAnalysis(analyses, c.id);
    return [
      displayTicker(c.ticker),
      c.companyName,
      c.country,
      c.sector,
      a?.adjustedScore ?? "",
      a?.grade ?? "",
      a?.verdict ?? "",
      a?.tenxFeasibility ?? "",
      a?.price ?? "",
      a?.marketCap ?? "",
      a?.currency ?? "",
      a ? formatDate(a.analysisDate) : "",
      a?.scoringVersion ?? "",
    ];
  });
  downloadText(
    `tenbagger-watchlist-${formatDate(new Date().toISOString())}.csv`,
    toCsv(headers, rows),
    "text/csv;charset=utf-8",
  );
}

export function exportAnalysisCsv(company: Company, analyses: Analysis[]) {
  const list = analyses.filter((a) => a.companyId === company.id);
  const headers = [
    "Date",
    "Ticker",
    "Score",
    "Grade",
    "FactorTotal",
    "Raw",
    "HardStop",
    "10x",
    "Thesis",
    "Version",
  ];
  const rows = list.map((a) => [
    formatDate(a.analysisDate),
    displayTicker(company.ticker),
    a.adjustedScore,
    a.grade,
    a.factorTotal,
    a.rawScore,
    a.hardStop,
    a.tenxFeasibility,
    a.oneSentenceThesis,
    a.scoringVersion,
  ]);
  downloadText(
    `${displayTicker(company.ticker)}-history.csv`,
    toCsv(headers, rows),
    "text/csv;charset=utf-8",
  );
}

export function exportEvidenceCsv(company: Company, analysis: Analysis) {
  const headers = [
    "Ticker",
    "Factor",
    "Type",
    "Evidence",
    "Source",
    "URL",
    "Date",
    "Confidence",
  ];
  const rows = analysis.evidences.map((e) => [
    displayTicker(company.ticker),
    e.factorCode,
    e.evidenceType,
    e.evidence,
    e.sourceName,
    e.sourceUrl,
    e.sourceDate,
    e.confidence,
  ]);
  downloadText(
    `${displayTicker(company.ticker)}-evidence.csv`,
    toCsv(headers, rows),
    "text/csv;charset=utf-8",
  );
}

function xmlEscape(s: string): string {
  return s
    .replace(/&/g, "\u0026amp;")
    .replace(/</g, "\u0026lt;")
    .replace(/>/g, "\u0026gt;")
    .replace(/"/g, "\u0026quot;");
}

export function exportWatchlistXls(companies: Company[], analyses: Analysis[]) {
  const rows = companies
    .map((c) => {
      const a = latestAnalysis(analyses, c.id);
      if (!a) return "";
      return `<Row>
        <Cell><Data ss:Type="String">${xmlEscape(displayTicker(c.ticker))}</Data></Cell>
        <Cell><Data ss:Type="String">${xmlEscape(c.companyName)}</Data></Cell>
        <Cell><Data ss:Type="Number">${a.adjustedScore}</Data></Cell>
        <Cell><Data ss:Type="String">${a.grade}</Data></Cell>
        <Cell><Data ss:Type="String">${xmlEscape(a.verdict)}</Data></Cell>
        <Cell><Data ss:Type="String">${a.tenxFeasibility}</Data></Cell>
        <Cell><Data ss:Type="Number">${a.marketCap}</Data></Cell>
        <Cell><Data ss:Type="String">${formatDate(a.analysisDate)}</Data></Cell>
      </Row>`;
    })
    .join("");
  const xml = `<?xml version="1.0"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
<Worksheet ss:Name="Watchlist">
<Table>
<Row>
<Cell><Data ss:Type="String">Ticker</Data></Cell>
<Cell><Data ss:Type="String">Company</Data></Cell>
<Cell><Data ss:Type="String">Score</Data></Cell>
<Cell><Data ss:Type="String">Grade</Data></Cell>
<Cell><Data ss:Type="String">Verdict</Data></Cell>
<Cell><Data ss:Type="String">10x</Data></Cell>
<Cell><Data ss:Type="String">MarketCap</Data></Cell>
<Cell><Data ss:Type="String">LastAnalysis</Data></Cell>
</Row>
${rows}
</Table>
</Worksheet>
</Workbook>`;
  downloadText(
    `tenbagger-watchlist-${formatDate(new Date().toISOString())}.xls`,
    xml,
    "application/vnd.ms-excel",
  );
}

export function backupJson(payload: unknown) {
  downloadText(
    `tenbagger_lite_${formatDate(new Date().toISOString()).replace(/-/g, "")}.json`,
    JSON.stringify(payload, null, 2),
    "application/json",
  );
}
