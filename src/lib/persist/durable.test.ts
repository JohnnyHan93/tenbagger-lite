import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { assertDurablePersist, persistBackend, persistIsDurable } from "./durable.ts";

describe("durable persist guard", () => {
  it("does not throw in CI / local (no VERCEL_ENV=production)", () => {
    assert.notEqual(process.env.VERCEL_ENV, "production");
    assert.doesNotThrow(() => assertDurablePersist());
  });

  it("reports the process backend", () => {
    const backend = persistBackend();
    assert.ok(backend === "neon" || backend === "pglite");
    assert.equal(persistIsDurable(), backend === "neon");
  });
});
