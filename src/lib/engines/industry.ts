export type IndustryGroup =
  | "saas"
  | "semi"
  | "industrial"
  | "consumer"
  | "healthcare"
  | "pharma"
  | "financial"
  | "reit"
  | "other";

export type Applicability = "A" | "C" | "N" | "R";

export function industryGroupOf(sector: string, industry: string): IndustryGroup {
  const blob = `${sector} ${industry}`.toLowerCase();
  if (/reit|real estate investment/.test(blob)) return "reit";
  if (/bank|insurance|capital market|asset manag|broker|financials|\bbanks\b/.test(blob)) {
    return "financial";
  }
  if (/biotech|pharma|drug|therapeu/.test(blob)) return "pharma";
  if (/health|hospital|medtech|medical device|managed care|managed health/.test(blob)) {
    return "healthcare";
  }
  if (/semiconductor|foundry|\bchip\b|\bfab\b|\beda\b/.test(blob)) return "semi";
  if (/telecom|satellite|space mobile|space\b/.test(blob)) return "other";
  if (/software|saas|internet|cloud|cyber|adtech|edp services|information technology/.test(blob)) {
    return "saas";
  }
  if (/consumer|retail|restaurant|apparel|food/.test(blob)) return "consumer";
  if (/industrial|machinery|electrical equipment|manufactur|aerospace/.test(blob)) return "industrial";
  if (/\breal estate\b/.test(blob)) return "reit";
  return "other";
}

export function naForGroup(
  group: IndustryGroup,
  kind: "inventory" | "backlog" | "rd" | "roic" | "de",
): Applicability {
  if (kind === "inventory" && (group === "saas" || group === "financial" || group === "reit")) return "N";
  if (kind === "inventory" && group === "pharma") return "C";
  if (kind === "backlog" && (group === "consumer" || group === "financial" || group === "saas")) return "C";
  if (kind === "rd" && (group === "financial" || group === "reit" || group === "consumer")) return "C";
  if (kind === "roic" && group === "pharma") return "C";
  if (kind === "roic" && (group === "financial" || group === "reit")) return "N";
  if (kind === "de" && group === "financial") return "N";
  if (kind === "de" && group === "reit") return "A";
  return "A";
}
