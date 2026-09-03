import seed from "./library-seed.json";
import type { Analysis, Company } from "./types";

export function buildLibraryWorld(): {
  companies: Company[];
  analyses: Analysis[];
} {
  return {
    companies: seed.companies as Company[],
    analyses: seed.analyses as Analysis[],
  };
}
