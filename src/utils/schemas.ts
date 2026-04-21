/**
 * Zod → JSON Schema conversion for MCP's `inputSchema` field. The MCP
 * wire protocol expects a JSON Schema object; the tool definitions
 * themselves are written as zod for runtime validation. This keeps
 * both concerns in sync.
 *
 * We implement the subset we actually use; anything we don't recognise
 * falls back to `{}` which MCP clients interpret as "any value".
 */

import { z } from "zod";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyZod = z.ZodType<any, any, any>;

export function toJsonSchema(schema: AnyZod): Record<string, unknown> {
  return convert(schema);
}

function convert(schema: AnyZod): Record<string, unknown> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const def = (schema as any)._def;
  if (!def) return {};

  const description: string | undefined = def.description;

  const withDesc = (out: Record<string, unknown>): Record<string, unknown> => {
    if (description) out.description = description;
    return out;
  };

  switch (def.typeName) {
    case "ZodString": {
      const out: Record<string, unknown> = { type: "string" };
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      for (const check of def.checks ?? []) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const c = check as any;
        if (c.kind === "min") out.minLength = c.value;
        if (c.kind === "max") out.maxLength = c.value;
        if (c.kind === "regex") out.pattern = c.regex.source;
        if (c.kind === "uuid") out.format = "uuid";
        if (c.kind === "email") out.format = "email";
        if (c.kind === "url") out.format = "uri";
      }
      return withDesc(out);
    }
    case "ZodNumber": {
      const out: Record<string, unknown> = { type: "number" };
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      for (const check of def.checks ?? []) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const c = check as any;
        if (c.kind === "int") out.type = "integer";
        if (c.kind === "min") out.minimum = c.value;
        if (c.kind === "max") out.maximum = c.value;
      }
      return withDesc(out);
    }
    case "ZodBoolean":
      return withDesc({ type: "boolean" });
    case "ZodLiteral":
      return withDesc({ const: def.value });
    case "ZodEnum":
      return withDesc({ type: "string", enum: def.values });
    case "ZodNativeEnum":
      return withDesc({ enum: Object.values(def.values) });
    case "ZodArray":
      return withDesc({ type: "array", items: convert(def.type) });
    case "ZodTuple":
      return withDesc({
        type: "array",
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        items: def.items.map((t: AnyZod) => convert(t)),
      });
    case "ZodObject": {
      const shape =
        typeof def.shape === "function" ? def.shape() : def.shape;
      const properties: Record<string, unknown> = {};
      const required: string[] = [];
      for (const [key, val] of Object.entries(shape) as [string, AnyZod][]) {
        const field = convert(val);
        properties[key] = field;
        if (!isOptional(val)) required.push(key);
      }
      const out: Record<string, unknown> = {
        type: "object",
        properties,
      };
      if (required.length) out.required = required;
      out.additionalProperties = false;
      return withDesc(out);
    }
    case "ZodRecord":
      return withDesc({
        type: "object",
        additionalProperties: convert(def.valueType),
      });
    case "ZodUnion": {
      return withDesc({
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        anyOf: def.options.map((t: AnyZod) => convert(t)),
      });
    }
    case "ZodDiscriminatedUnion": {
      const options: AnyZod[] = Array.from(def.options);
      return withDesc({ anyOf: options.map((t) => convert(t)) });
    }
    case "ZodIntersection":
      return withDesc({
        allOf: [convert(def.left), convert(def.right)],
      });
    case "ZodOptional":
      return convert(def.innerType);
    case "ZodNullable": {
      const inner = convert(def.innerType);
      const existingType = inner.type;
      if (typeof existingType === "string") {
        return { ...inner, type: [existingType, "null"] };
      }
      return { anyOf: [inner, { type: "null" }] };
    }
    case "ZodDefault":
      return { ...convert(def.innerType), default: def.defaultValue() };
    case "ZodEffects":
      return convert(def.schema);
    case "ZodAny":
    case "ZodUnknown":
      return withDesc({});
    case "ZodLazy":
      return convert(def.getter());
    default:
      return withDesc({});
  }
}

function isOptional(schema: AnyZod): boolean {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const def = (schema as any)._def;
  if (!def) return false;
  if (def.typeName === "ZodOptional" || def.typeName === "ZodDefault")
    return true;
  if (def.typeName === "ZodNullable") return isOptional(def.innerType);
  if (def.typeName === "ZodEffects") return isOptional(def.schema);
  return false;
}
