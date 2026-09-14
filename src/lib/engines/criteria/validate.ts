import { CRITERIA_SCHEMA, type BandStep, type CriteriaPack } from "./types.ts";
import { DEFAULT_CRITERIA } from "./defaults.ts";

export function cloneDefaultCriteria(): CriteriaPack {
  return structuredClone(DEFAULT_CRITERIA);
}

function finiteNum(n: unknown): n is number {
  return typeof n === "number" && Number.isFinite(n);
}

function descendingGrades(g: { S: number; A: number; B: number; C: number; D: number } | undefined): boolean {
  if (!g) return false;
  return finiteNum(g.S) && finiteNum(g.A) && finiteNum(g.B) && finiteNum(g.C) && finiteNum(g.D) && g.S > g.A && g.A > g.B && g.B > g.C && g.C > g.D;
}

function validBands(bands: Record<string, BandStep[]> | undefined): string | null {
  if (bands == null) return null;
  if (typeof bands !== "object") return "quality70.bands 가 객체가 아닙니다";
  for (const [id, steps] of Object.entries(bands)) {
    if (!/^Q\d{2}$/.test(id)) return `알 수 없는 Quality factor ID: ${id}`;
    const n = Number(id.slice(1));
    if (n < 1 || n > 70) return `Quality factor ID 범위 밖: ${id}`;
    if (!Array.isArray(steps) || steps.length === 0) return `${id} band 가 비었습니다`;
    for (const step of steps) {
      if (!Array.isArray(step) || step.length !== 2 || !finiteNum(step[0]) || !finiteNum(step[1])) {
        return `${id} band 형식이 [threshold, score] 가 아닙니다`;
      }
      if (step[1] < 0 || step[1] > 10) return `${id} score 는 0–10 이어야 합니다`;
    }
  }
  return null;
}

export function parseCriteriaPack(raw: unknown): { ok: true; pack: CriteriaPack } | { ok: false; error: string } {
  if (!raw || typeof raw !== "object") return { ok: false, error: "JSON 객체가 아닙니다" };
  const o = raw as Record<string, unknown>;
  if (o.schema !== CRITERIA_SCHEMA) return { ok: false, error: `schema 는 ${CRITERIA_SCHEMA} 여야 합니다` };
  const engines = o.engines as CriteriaPack["engines"] | undefined;
  if (!engines?.xbagger || !engines?.oversold || !engines?.quality70) {
    return { ok: false, error: "engines.xbagger / oversold / quality70 이 모두 있어야 합니다" };
  }

  const w = engines.xbagger.weights;
  if (!w) return { ok: false, error: "X-Bagger weights 없음" };
  const codes = ["F1", "F2", "F3", "F4", "F5", "F6", "F7", "F8", "F9", "F10"] as const;
  for (const c of codes) {
    if (!finiteNum(w[c]) || w[c] < 0) return { ok: false, error: `X-Bagger ${c} 가중치가 유효하지 않습니다` };
  }
  const weightSum = codes.reduce((s, c) => s + w[c], 0);
  if (Math.abs(weightSum - 100) > 0.01) return { ok: false, error: `X-Bagger 가중치 합은 100이어야 합니다 (현재 ${weightSum})` };
  if (!descendingGrades(engines.xbagger.gradeThresholds)) {
    return { ok: false, error: "X-Bagger 등급 임계값은 S>A>B>C>D 이어야 합니다" };
  }
  const gates = engines.xbagger.hardGates;
  if (!gates || !finiteNum(gates.tenxMin) || !finiteNum(gates.survivalMin) || !finiteNum(gates.customerMin)) {
    return { ok: false, error: "X-Bagger hardGates 가 유효하지 않습니다" };
  }
  if ([gates.tenxMin, gates.survivalMin, gates.customerMin].some((n) => n < 0 || n > 10)) {
    return { ok: false, error: "X-Bagger gate 는 0–10 이어야 합니다" };
  }
  const cov = engines.xbagger.coverage;
  if (!cov || cov.research >= cov.mild || cov.mild >= cov.noPenalty) {
    return { ok: false, error: "X-Bagger coverage 임계값 순서가 논리적이어야 합니다 (research < mild < noPenalty)" };
  }

  const ow = engines.oversold.weights;
  const oSum = Number(ow?.fundamental) + Number(ow?.valuation) + Number(ow?.oversold) + Number(ow?.risk);
  if (!ow || [ow.fundamental, ow.valuation, ow.oversold, ow.risk].some((n) => !finiteNum(n) || n < 0)) {
    return { ok: false, error: "Oversold 가중치가 유효하지 않습니다" };
  }
  if (!Number.isFinite(oSum) || Math.abs(oSum - 1) > 0.02) {
    return { ok: false, error: `Oversold 가중치 합은 1이어야 합니다 (현재 ${oSum})` };
  }
  const oc = engines.oversold.classify;
  if (!oc || [oc.caseDOversoldMax, oc.caseAFundMin, oc.caseBFundMin].some((n) => !finiteNum(n) || n < 0 || n > 10)) {
    return { ok: false, error: "Oversold classify 임계값은 0–10 이어야 합니다" };
  }

  if (!descendingGrades(engines.quality70.gradeThresholds)) {
    return { ok: false, error: "Quality 등급 임계값은 S>A>B>C>D 이어야 합니다" };
  }
  const bandErr = validBands(engines.quality70.bands);
  if (bandErr) return { ok: false, error: bandErr };

  const pack: CriteriaPack = {
    schema: CRITERIA_SCHEMA,
    title: typeof o.title === "string" && o.title.trim() ? o.title.trim() : "사용자 기준",
    note: typeof o.note === "string" ? o.note : DEFAULT_CRITERIA.note,
    overlayId: typeof o.overlayId === "string" && o.overlayId ? o.overlayId : `overlay-${Date.now()}`,
    appliedAt: typeof o.appliedAt === "string" ? o.appliedAt : null,
    engines,
  };
  return { ok: true, pack };
}
