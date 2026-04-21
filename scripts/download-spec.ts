/**
 * Download the latest Apple App Store Connect OpenAPI spec.
 *
 * The spec is distributed as a ZIP at a stable URL. We fetch, unzip
 * in-memory, and overwrite `spec/app-store-connect-openapi.json`.
 *
 * After a refresh, run `npm run codegen` to regenerate tool files.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { request } from "undici";
import { execSync } from "node:child_process";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const SPEC_DIR = path.join(ROOT, "spec");
const SPEC_URL =
  "https://developer.apple.com/sample-code/app-store-connect/app-store-connect-openapi-specification.zip";
const ZIP_PATH = path.join(SPEC_DIR, "asc-openapi.zip");
const JSON_DEST = path.join(SPEC_DIR, "app-store-connect-openapi.json");

async function main(): Promise<void> {
  fs.mkdirSync(SPEC_DIR, { recursive: true });
  process.stdout.write(`[spec] Fetching ${SPEC_URL} …\n`);
  const res = await request(SPEC_URL, {
    method: "GET",
    headers: {
      "user-agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    },
  });
  if (res.statusCode !== 200) {
    throw new Error(
      `unexpected HTTP ${res.statusCode} from ${SPEC_URL}`,
    );
  }
  const buf = Buffer.from(await res.body.arrayBuffer());
  fs.writeFileSync(ZIP_PATH, buf);
  process.stdout.write(`[spec] Wrote ${buf.length} bytes to ${ZIP_PATH}\n`);

  // Extract. Use the system `unzip` to avoid adding a zip dependency.
  execSync(`unzip -o "${ZIP_PATH}" -d "${SPEC_DIR}"`, { stdio: "inherit" });
  // Apple's zip puts the JSON at `openapi.oas.json`. Move and clean up.
  const extracted = path.join(SPEC_DIR, "openapi.oas.json");
  if (fs.existsSync(extracted)) {
    fs.renameSync(extracted, JSON_DEST);
  }
  const macosx = path.join(SPEC_DIR, "__MACOSX");
  if (fs.existsSync(macosx)) {
    fs.rmSync(macosx, { recursive: true, force: true });
  }

  const stat = fs.statSync(JSON_DEST);
  process.stdout.write(
    `[spec] Extracted ${JSON_DEST} (${(stat.size / 1024 / 1024).toFixed(2)} MB)\n`,
  );
}

main().catch((err) => {
  process.stderr.write(`[spec] FATAL: ${(err as Error).stack ?? err}\n`);
  process.exit(1);
});
