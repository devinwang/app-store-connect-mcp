/**
 * Codegen — read the official Apple App Store Connect OpenAPI spec and
 * emit one TypeScript file per tag containing `defineTool(...)` entries
 * for every operation inside.
 *
 * Philosophy:
 *   - Names: `operationId` → snake_case, 1:1 with Apple's spec
 *   - Path params: typed zod strings, required
 *   - Query params: typed zod fields, optional (names may contain brackets
 *     like `filter[name]`, `fields[apps]`, `limit[appStoreVersions]` — zod
 *     accepts those as keys, MCP emits them as JSON Schema properties)
 *   - Body: `z.record(z.unknown()).optional()` with a description pointing
 *     at the $ref component name. ASC validates bodies server-side and our
 *     error translator surfaces validation issues clearly. Generating full
 *     zod for every nested JSON:API envelope would balloon output by 10×
 *     and offer little practical value.
 *
 * Usage: `npm run codegen`
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const SPEC_PATH = path.join(ROOT, "spec/app-store-connect-openapi.json");
const OUT_DIR = path.join(ROOT, "src/tools/generated");
const COVERAGE_OUT = path.join(ROOT, "spec/coverage-report.txt");

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Any = any;

interface OpenApiSpec {
  info: { title: string; version: string };
  paths: Record<string, Record<string, Operation>>;
  components?: { schemas?: Record<string, Any> };
}

interface Operation {
  operationId?: string;
  tags?: string[];
  summary?: string;
  description?: string;
  deprecated?: boolean;
  parameters?: Parameter[];
  requestBody?: {
    required?: boolean;
    content?: Record<string, { schema?: { $ref?: string } }>;
    description?: string;
  };
  responses?: Record<string, Any>;
}

interface Parameter {
  name: string;
  in: "path" | "query" | "header" | "cookie";
  required?: boolean;
  description?: string;
  schema?: {
    type?: string;
    format?: string;
    enum?: string[];
    items?: { type?: string; enum?: string[] };
    minimum?: number;
    maximum?: number;
  };
}

/**
 * Convert an OpenAPI camelCase operationId (with possible `_` separators
 * that Apple uses) into snake_case suitable for an MCP tool name.
 *
 * Examples:
 *   "apps_getCollection"                 → "apps_get_collection"
 *   "appStoreVersions_createInstance"    → "app_store_versions_create_instance"
 *   "users_getInvitedUserInformation"    → "users_get_invited_user_information"
 */
function toSnakeCase(id: string): string {
  return id
    .replace(/([A-Z]+)([A-Z][a-z])/g, "$1_$2")
    .replace(/([a-z0-9])([A-Z])/g, "$1_$2")
    .replace(/_+/g, "_")
    .toLowerCase();
}

/**
 * Apple's JSON:API param names use brackets and dots (e.g. `filter[name]`,
 * `fields[apps]`, `limit[appStoreVersions]`, `filter[appStoreVersions.appStoreState]`).
 * Anthropic's tool-schema property-name regex `^[a-zA-Z0-9_.-]{1,64}$`
 * allows dots but NOT brackets, so unchanged keys fail the API call with
 * 400 `Property keys should match pattern …`.
 *
 * We therefore map to a bracket-free safe form for schema keys, and the
 * generated handler remaps the safe keys back to Apple's original when
 * building the outgoing query string.
 *
 *   filter[name]                                 → filter_name
 *   fields[apps]                                 → fields_apps
 *   limit[appStoreVersions]                      → limit_appStoreVersions
 *   filter[appStoreVersions.appStoreState]       → filter_appStoreVersions_appStoreState
 */
function toSafeKey(name: string): string {
  return name
    .replace(/\[/g, "_")
    .replace(/\]/g, "")
    .replace(/\./g, "_");
}

/**
 * Tag → kebab-case filename stem.
 */
function tagToFilename(tag: string): string {
  return tag
    .replace(/([A-Z]+)([A-Z][a-z])/g, "$1-$2")
    .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
    .replace(/[^A-Za-z0-9-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();
}

/**
 * Extract the $ref name (last path segment) from an OpenAPI ref string.
 */
function refName(ref: string | undefined): string | undefined {
  if (!ref) return undefined;
  const parts = ref.split("/");
  return parts[parts.length - 1];
}

/**
 * Produce a short single-line description for a tool. Trim and sanitise.
 * The name already conveys the action; we focus on describing the
 * resource + flavour.
 */
function buildDescription(
  op: Operation,
  method: string,
  urlPath: string,
): string {
  const pieces: string[] = [];
  if (op.deprecated) pieces.push("[DEPRECATED]");

  const summary = (op.summary ?? "").trim();
  const description = (op.description ?? "").trim();
  const chosen =
    summary.length > 0
      ? summary
      : description.length > 0
        ? description
        : `${method.toUpperCase()} ${urlPath}`;

  pieces.push(chosen);
  pieces.push(`(${method.toUpperCase()} ${urlPath})`);

  const bodyRef = refName(
    op.requestBody?.content?.["application/json"]?.schema?.$ref,
  );
  if (bodyRef) {
    pieces.push(
      `Body shape: see OpenAPI components.schemas.${bodyRef} for the full JSON:API envelope.`,
    );
  }

  return pieces.join(" ").replace(/\s+/g, " ").slice(0, 800);
}

/**
 * Escape a string for use inside a TypeScript double-quoted string.
 */
function esc(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\n/g, " ");
}

/**
 * zod fragment for a parameter's type. Always optional unless the
 * parameter is path-type (path params are always required).
 */
function zodForParameter(p: Parameter): string {
  const t = p.schema?.type ?? "string";
  let base: string;
  switch (t) {
    case "integer":
      base = "z.coerce.number().int()";
      break;
    case "number":
      base = "z.coerce.number()";
      break;
    case "boolean":
      base = "z.coerce.boolean()";
      break;
    case "array": {
      const itemType = p.schema?.items?.type ?? "string";
      const itemEnum = p.schema?.items?.enum;
      if (itemEnum && itemEnum.length > 0) {
        const values = itemEnum.map((v) => `"${esc(String(v))}"`).join(", ");
        base = `z.union([z.array(z.enum([${values}])), z.string()])`;
      } else if (itemType === "integer" || itemType === "number") {
        base = "z.union([z.array(z.coerce.number()), z.string()])";
      } else {
        base = "z.union([z.array(z.string()), z.string()])";
      }
      break;
    }
    case "string":
    default: {
      const en = p.schema?.enum;
      if (en && en.length > 0) {
        const values = en.map((v) => `"${esc(String(v))}"`).join(", ");
        base = `z.enum([${values}])`;
      } else {
        base = "z.string()";
      }
    }
  }
  const desc = (p.description ?? "").trim();
  const withDesc = desc
    ? `${base}.describe("${esc(desc.slice(0, 240))}")`
    : base;
  // Path parameters are always required; everything else optional.
  return p.in === "path" ? withDesc : `${withDesc}.optional()`;
}

function buildZodObject(op: Operation): string {
  const fields: string[] = [];
  const params = op.parameters ?? [];
  const usedKeys = new Set<string>();
  for (const p of params) {
    if (p.in !== "path" && p.in !== "query") continue;
    const zodFrag = zodForParameter(p);
    // Query keys with brackets/dots get transformed to a schema-safe form.
    // Path params never have brackets, so `toSafeKey` is a no-op for them.
    let safeKey = toSafeKey(p.name);
    // Pathological de-duplication in case two different Apple param names
    // collapse to the same safe form (should never happen in practice).
    if (usedKeys.has(safeKey)) {
      let i = 2;
      while (usedKeys.has(`${safeKey}_${i}`)) i++;
      safeKey = `${safeKey}_${i}`;
    }
    usedKeys.add(safeKey);
    const keyToken = /^[A-Za-z_][A-Za-z0-9_]*$/.test(safeKey)
      ? safeKey
      : `"${esc(safeKey)}"`;
    fields.push(`    ${keyToken}: ${zodFrag},`);
  }

  const body = op.requestBody?.content?.["application/json"];
  if (body) {
    const bodyRef = refName(body.schema?.$ref);
    const bodyRequired = op.requestBody?.required === true;
    const zodBody = `z.record(z.unknown())`;
    const desc = bodyRef
      ? `JSON body. Shape: components.schemas.${bodyRef}.`
      : "JSON body.";
    fields.push(
      `    body: ${zodBody}.describe("${esc(desc)}")${
        bodyRequired ? "" : ".optional()"
      },`,
    );
  }

  if (fields.length === 0) {
    return `z.object({}).strict()`;
  }
  return `z.object({\n${fields.join("\n")}\n  }).strict()`;
}

/**
 * Build the tool handler body as a string. Runtime, it assembles
 * pathParams, query (from non-path fields), body, and dispatches.
 */
function buildHandler(op: Operation, method: string, urlPath: string): string {
  const params = op.parameters ?? [];
  const pathParamNames = params
    .filter((p) => p.in === "path")
    .map((p) => p.name);
  const queryParamNames = params
    .filter((p) => p.in === "query")
    .map((p) => p.name);

  const hasBody = !!op.requestBody?.content?.["application/json"];

  const pathParamsObj = pathParamNames.length
    ? `{ ${pathParamNames
        .map((n) => {
          const safe = /^[A-Za-z_][A-Za-z0-9_]*$/.test(n)
            ? n
            : `"${esc(n)}"`;
          return `${safe}: String(args[${JSON.stringify(n)}])`;
        })
        .join(", ")} }`
    : "undefined";

  // Map `args["filter_name"]` back to `query["filter[name]"]` etc., so the
  // outgoing request uses Apple's original JSON:API parameter names.
  const queryObj = queryParamNames.length
    ? `{\n${queryParamNames
        .map(
          (n) =>
            `      ${JSON.stringify(n)}: args[${JSON.stringify(toSafeKey(n))}],`,
        )
        .join("\n")}\n    }`
    : "undefined";

  const bodyExpr = hasBody ? "args.body" : "undefined";

  return `async (args: Any) => {
    const res = await ascRequest({
      method: ${JSON.stringify(method.toUpperCase())},
      path: ${JSON.stringify(urlPath)},
      pathParams: ${pathParamsObj},
      query: ${queryObj},
      body: ${bodyExpr},
    });
    return res.body;
  }`;
}

async function main(): Promise<void> {
  const raw = fs.readFileSync(SPEC_PATH, "utf8");
  const spec = JSON.parse(raw) as OpenApiSpec;

  // Clean generated dir.
  if (fs.existsSync(OUT_DIR)) {
    fs.rmSync(OUT_DIR, { recursive: true, force: true });
  }
  fs.mkdirSync(OUT_DIR, { recursive: true });

  interface ToolSpec {
    name: string;
    description: string;
    inputSrc: string;
    handlerSrc: string;
    deprecated: boolean;
  }
  const byTag: Record<string, ToolSpec[]> = {};

  let totalOps = 0;
  let emittedTools = 0;
  let skipped = 0;
  let deprecatedCount = 0;
  const nameSeen = new Map<string, string>(); // tool name → path+method

  const methods = ["get", "post", "put", "patch", "delete"] as const;

  for (const [urlPath, pathItem] of Object.entries(spec.paths)) {
    for (const method of methods) {
      const op = pathItem[method as keyof typeof pathItem] as
        | Operation
        | undefined;
      if (!op) continue;
      totalOps++;
      const opId = op.operationId;
      if (!opId) {
        skipped++;
        continue;
      }
      const name = toSnakeCase(opId);
      if (nameSeen.has(name)) {
        skipped++;
        process.stderr.write(
          `[codegen] WARN: duplicate tool name '${name}' — skipping ${method.toUpperCase()} ${urlPath} (first at ${nameSeen.get(name)})\n`,
        );
        continue;
      }
      nameSeen.set(name, `${method.toUpperCase()} ${urlPath}`);

      const tag = op.tags?.[0] ?? "_untagged";
      const tool: ToolSpec = {
        name,
        description: buildDescription(op, method, urlPath),
        inputSrc: buildZodObject(op),
        handlerSrc: buildHandler(op, method, urlPath),
        deprecated: !!op.deprecated,
      };
      if (tool.deprecated) deprecatedCount++;
      (byTag[tag] ||= []).push(tool);
      emittedTools++;
    }
  }

  // Emit one file per tag.
  const tagFiles: Array<{ tag: string; file: string; varName: string }> = [];
  for (const [tag, tools] of Object.entries(byTag)) {
    const fileStem = tagToFilename(tag);
    const varName =
      fileStem.replace(/-([a-z])/g, (_, c) => c.toUpperCase()) + "Tools";
    const filePath = path.join(OUT_DIR, `${fileStem}.ts`);
    const body = tools
      .map(
        (t) => `  defineTool({
    name: "${t.name}",
    description: "${esc(t.description)}",
    input: ${t.inputSrc},
    handler: ${t.handlerSrc},
  }),`,
      )
      .join("\n");
    const src = `// Auto-generated by scripts/codegen.ts from the Apple App Store Connect OpenAPI spec.
// Tag: ${tag}
// Tool count: ${tools.length}
// DO NOT EDIT BY HAND — re-run \`npm run codegen\` after refreshing the spec.
/* eslint-disable */
import { z } from "zod";
import { defineTool, type Tool } from "../../utils/tool.js";
import { ascRequest } from "../../utils/http.js";

type Any = any;

export const ${varName}: Tool[] = [
${body}
];
`;
    fs.writeFileSync(filePath, src);
    tagFiles.push({ tag, file: fileStem, varName });
  }

  // Emit aggregator.
  const indexSrc = `// Auto-generated by scripts/codegen.ts. Do not edit.
/* eslint-disable */
import type { Tool } from "../../utils/tool.js";
${tagFiles
  .map((t) => `import { ${t.varName} } from "./${t.file}.js";`)
  .join("\n")}

export const generatedTools: Tool[] = [
${tagFiles.map((t) => `  ...${t.varName},`).join("\n")}
];
`;
  fs.writeFileSync(path.join(OUT_DIR, "index.ts"), indexSrc);

  // Coverage report.
  const sortedTags = Object.entries(byTag).sort(
    (a, b) => b[1].length - a[1].length,
  );
  const coverageLines: string[] = [];
  coverageLines.push("# Coverage report (regenerated)");
  coverageLines.push("");
  coverageLines.push(
    `Spec: App Store Connect API ${spec.info.version} (title: ${spec.info.title})`,
  );
  coverageLines.push(`Total operations in spec:   ${totalOps}`);
  coverageLines.push(`Tools emitted:              ${emittedTools}`);
  coverageLines.push(`Deprecated (still emitted): ${deprecatedCount}`);
  coverageLines.push(`Skipped:                    ${skipped}`);
  coverageLines.push(`Tags:                       ${sortedTags.length}`);
  coverageLines.push("");
  coverageLines.push("| # | Tag | Tools | File |");
  coverageLines.push("|---|---|---|---|");
  sortedTags.forEach(([tag, tools], i) => {
    coverageLines.push(
      `| ${i + 1} | ${tag} | ${tools.length} | \`${tagToFilename(tag)}.ts\` |`,
    );
  });
  fs.writeFileSync(COVERAGE_OUT, coverageLines.join("\n"));

  process.stdout.write(
    `[codegen] Spec v${spec.info.version}: ${totalOps} ops → ${emittedTools} tools across ${sortedTags.length} files (${deprecatedCount} deprecated, ${skipped} skipped)\n`,
  );
}

main().catch((err) => {
  process.stderr.write(`[codegen] FATAL: ${(err as Error).stack ?? err}\n`);
  process.exit(1);
});
