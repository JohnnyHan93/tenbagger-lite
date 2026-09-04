import { createServerFn } from "@tanstack/react-start";
import type { WorkspaceDump } from "./repo.ts";
import type { Snapshot } from "../domain/snapshot.ts";
import type { Company } from "../types.ts";

export const loadWorkspaceFn = createServerFn({ method: "GET" }).handler(async () => {
  const { loadWorkspace } = await import("./repo.ts");
  return loadWorkspace();
});

export const persistWorkspaceFn = createServerFn({ method: "POST" })
  .validator((input: WorkspaceDump) => input)
  .handler(async ({ data }) => {
    const { persistWorkspace } = await import("./repo.ts");
    await persistWorkspace(data);
    return { ok: true as const };
  });

export const saveCompanyFn = createServerFn({ method: "POST" })
  .validator((input: Company) => input)
  .handler(async ({ data }) => {
    const { saveCompany } = await import("./repo.ts");
    await saveCompany(data);
    return { ok: true as const };
  });

export const insertAnalysisFn = createServerFn({ method: "POST" })
  .validator((input: Snapshot) => input)
  .handler(async ({ data }) => {
    const { insertAnalysis } = await import("./repo.ts");
    await insertAnalysis(data);
    return { ok: true as const };
  });

export const clearWorkspaceFn = createServerFn({ method: "POST" }).handler(async () => {
  const { clearWorkspace } = await import("./repo.ts");
  await clearWorkspace();
  return { ok: true as const };
});

export const cleanupDemoDataFn = createServerFn({ method: "POST" }).handler(async () => {
  const { cleanupDemoData } = await import("./repo.ts");
  return cleanupDemoData();
});
