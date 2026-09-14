import { dbSource } from "../db.ts";

/** Active SQL backend. Neon is durable. PGLite on Vercel is per-instance memory. */
export function persistBackend(): "neon" | "pglite" {
  return dbSource;
}

export function persistIsDurable(): boolean {
  return persistBackend() === "neon";
}

/**
 * Production Vercel must use Neon. A successful write to in-memory PGLite
 * looks like a save, then the next serverless instance has an empty table.
 * Local preview and CI stay on PGLite.
 */
export function assertDurablePersist(): void {
  if (process.env.IDT_ALLOW_EPHEMERAL === "1") return;
  if (process.env.VERCEL_ENV === "production" && dbSource !== "neon") {
    throw new Error(
      "EPHEMERAL_DB: Production has no DATABASE_URL. Analysis would vanish on the next instance. Set Neon DATABASE_URL on the hosting Vercel project.",
    );
  }
}
