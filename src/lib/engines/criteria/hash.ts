import type { CriteriaPack } from "./types.ts";

function canonical(value: unknown): string {
  if (value == null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj).sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${canonical(obj[k])}`).join(",")}}`;
}

/** Stable hash of engine knobs. overlayId / appliedAt do not affect it. */
export function hashCriteria(pack: CriteriaPack): string {
  const body = canonical({
    schema: pack.schema,
    engines: pack.engines,
  });
  let h = 2166136261;
  for (let i = 0; i < body.length; i++) {
    h ^= body.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return `c${(h >>> 0).toString(16).padStart(8, "0")}`;
}

export function criteriaProvenance(pack: CriteriaPack): {
  schema: string;
  overlayId: string;
  versions: { xbagger: string; oversold: string; quality70: string };
  hash: string;
} {
  return {
    schema: pack.schema,
    overlayId: pack.overlayId,
    versions: {
      xbagger: pack.engines.xbagger.version,
      oversold: pack.engines.oversold.version,
      quality70: pack.engines.quality70.version,
    },
    hash: hashCriteria(pack),
  };
}
