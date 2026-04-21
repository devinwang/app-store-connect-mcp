/**
 * Aggregate every tool the server exposes. Order:
 *
 *   1. `accountTools`  — local credential registry management
 *   2. `authTools`     — introspection (auth_status, auth_revoke_cache)
 *   3. `generatedTools` — the full 1000+ auto-generated ASC operations
 *   4. `overrideTools` — hand-written helpers (asset upload, reports download,
 *                        polling). These have unique names that don't collide
 *                        with the generated set.
 */

import type { Tool } from "../utils/tool.js";
import { accountTools } from "./accounts.js";
import { authTools } from "./auth.js";
import { generatedTools } from "./generated/index.js";
import { overrideTools } from "./overrides.js";

export const allTools: Tool[] = [
  ...accountTools,
  ...authTools,
  ...generatedTools,
  ...overrideTools,
];

const byName: Map<string, Tool> = new Map(
  allTools.map((t) => [t.name, t]),
);

export function toolByName(name: string): Tool | undefined {
  return byName.get(name);
}
