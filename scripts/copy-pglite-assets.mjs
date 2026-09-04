import { cpSync, existsSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const srcDir = join(root, "node_modules/@electric-sql/pglite/dist");
const dest = join(root, ".vercel/output/functions/__server.func/_libs");
if (!existsSync(srcDir)) {
  console.log("[pglite-assets] skip — @electric-sql/pglite not installed");
  process.exit(0);
}
mkdirSync(dest, { recursive: true });
for (const name of ["pglite.data", "pglite.wasm", "initdb.wasm"]) {
  const from = join(srcDir, name);
  if (!existsSync(from)) continue;
  cpSync(from, join(dest, name));
}
console.log("[pglite-assets] copied into Vercel function _libs (PGLite fallback)");
