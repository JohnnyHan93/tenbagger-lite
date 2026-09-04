#!/usr/bin/env node
/**
 * Targeted FAKE_DEMO cleanup. Does not truncate investment tables.
 */
import { cleanupDemoData } from "../src/lib/persist/repo.ts";

const report = await cleanupDemoData();

console.log("DEMO DATA CLEANUP");
console.log("");
console.log(`Companies removed: ${report.companiesRemoved}`);
console.log(`Analyses removed: ${report.analysesRemoved}`);
console.log(`Evidence removed: ${report.evidenceRemoved}`);
console.log(`Universes removed: ${report.universesRemoved}`);
console.log(`Watchlist removed: ${report.watchlistRemoved}`);
console.log("");
console.log(`Real user records affected: ${report.realUserRecordsAffected}`);
console.log("");
if (report.planned.length) {
  console.log("Planned / deleted:");
  for (const row of report.planned.slice(0, 40)) {
    console.log(`  - ${row.kind} ${row.id} (${row.reason})`);
  }
  if (report.planned.length > 40) console.log(`  … ${report.planned.length - 40} more`);
  console.log("");
}
console.log(`Status: ${report.status}`);
