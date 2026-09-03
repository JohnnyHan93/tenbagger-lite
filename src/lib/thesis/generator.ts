import { formatMoney } from "../format.ts";
import type { Analysis, ResearchDraft } from "../types.ts";


function hasConcreteNumbers(text: string): boolean {
  return /\d/.test(text);
}

export function generateThesis(input: {
  companyName: string;
  market: string;
  edge: string;
  proof: string;
  marketCap: number;
  currency: "USD" | "KRW";
  future: string;
  tenxUnrealistic: boolean;
}): { thesis: string; gate: "PASS" | "FAIL" } {
  if (input.tenxUnrealistic) {
    return {
      thesis: `${input.companyName}은(는) 현재 시가총액 ${formatMoney(input.marketCap, input.currency)}에서 10배가 되려면 비현실적인 매출·점유율·멀티플 가정이 동시에 필요하다. 10x Math가 성립하지 않으므로 PASS.`,
      gate: "FAIL",
    };
  }

  const thesis = `${input.companyName}은(는) ${input.market}에서 ${input.edge}를 기반으로 ${input.proof}를 확대하고 있으며, 현재 약 ${formatMoney(input.marketCap, input.currency)}에서 ${input.future}을(를) 달성하면 약 10배 기업가치가 수학적으로 가능하다.`;

  if (!hasConcreteNumbers(thesis) || !input.future.trim()) {
    return { thesis, gate: "FAIL" };
  }
  return { thesis, gate: "PASS" };
}

export function thesisFromDraft(draft: ResearchDraft): { thesis: string; gate: "PASS" | "FAIL" } {
  if (draft.thesis && draft.thesis.trim()) {
    const gate =
      draft.tenxFeasibility === "UNREALISTIC" || !/\d/.test(draft.thesis)
        ? "FAIL"
        : "PASS";
    return { thesis: draft.thesis, gate };
  }
  const f4 = draft.factors.find((f) => f.code === "F4")?.summary ?? "기술 우위";
  const f1 = draft.factors.find((f) => f.code === "F1")?.summary ?? "성장 시장";
  const f6 = draft.factors.find((f) => f.code === "F6")?.summary ?? "고객 검증";
  const future = draft.requiredRevenue
    ? `매출 ${formatMoney(draft.requiredRevenue, draft.quote.currency)} 수준`
    : "명시된 미래 매출·이익";
  return generateThesis({
    companyName: draft.quote.companyName,
    market: f1,
    edge: f4,
    proof: f6,
    marketCap: draft.quote.marketCap,
    currency: draft.quote.currency,
    future,
    tenxUnrealistic: draft.tenxFeasibility === "UNREALISTIC",
  });
}

export function thesisGateFromAnalysis(a: Pick<Analysis, "oneSentenceThesis" | "tenxFeasibility">): "PASS" | "FAIL" {
  if (a.tenxFeasibility === "UNREALISTIC") return "FAIL";
  if (!/\d/.test(a.oneSentenceThesis)) return "FAIL";
  return "PASS";
}
