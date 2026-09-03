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
  if (/bank|insurance|capital market|asset manag|broker|reit|real estate/.test(blob) && /reit/.test(blob)) {
    return "reit";
  }
  if (/bank|insurance|capital market|asset manag|broker|financial/.test(blob)) return "financial";
  if (/biotech|pharma|drug|therapeu/.test(blob)) return "pharma";
  if (/health|hospital|medtech|medical device/.test(blob)) return "healthcare";
  if (/semiconductor|foundry|chip|fab|eda/.test(blob)) return "semi";
  if (/software|saas|internet|cloud|cyber|adtech|information technology/.test(blob)) return "saas";
  if (/consumer|retail|restaurant|apparel|food/.test(blob)) return "consumer";
  if (/industrial|machinery|equipment|manufactur|aerospace/.test(blob)) return "industrial";
  if (/reit/.test(blob)) return "reit";
  return "other";
}

export function naForGroup(group: IndustryGroup, kind: "inventory" | "backlog" | "rd" | "roic" | "de"): Applicability {
  if (kind === "inventory" && (group === "saas" || group === "financial" || group === "reit")) return "N";
  if (kind === "backlog" && (group === "consumer" || group === "financial" || group === "saas")) return "C";
  if (kind === "rd" && (group === "financial" || group === "reit" || group === "consumer")) return "C";
  if (kind === "roic" && group === "pharma") return "C";
  if (kind === "de" && (group === "financial" || group === "reit")) return "R";
  return "A";
}
