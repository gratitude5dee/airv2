/**
 * Vendor snapshot maintenance.
 *
 *   npx tsx packages/create-kit/scripts/vendor.ts            # extract tarballs → vendor/.extracted (offline)
 *   npx tsx packages/create-kit/scripts/vendor.ts --sbom     # also rebuild vendor/sbom.json (npm registry metadata)
 *
 * Adding or bumping a package: drop the `.tgz` from `npm pack <name>@<version>`
 * into vendor/tarballs/, delete the old one, run `--sbom`, then re-run harvest.
 * `buildSbom` refuses versions published less than MIN_AGE_DAYS ago.
 */
import { buildSbom, extractVendor, sbomProblems } from "./lib/vendor.ts";

const args = new Set(process.argv.slice(2));
const log = (s: string) => console.log(s);

if (args.has("--sbom")) {
  const { sbom, changed } = await buildSbom(log);
  const problems = sbomProblems(sbom, new Date());
  if (problems.length > 0) {
    for (const p of problems) console.error(`  FAIL ${p}`);
    process.exit(1);
  }
  log(changed ? "sbom.json updated" : "sbom.json unchanged");
}
const nm = extractVendor(log);
log(`vendor extracted to ${nm}`);
