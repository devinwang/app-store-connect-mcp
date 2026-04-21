/**
 * Account management tools. Operate purely on the local registry —
 * they never touch the App Store Connect API.
 */

import { z } from "zod";
import { defineTool, type Tool } from "../utils/tool.js";
import {
  addAccount,
  getCurrentAccount,
  loadAccounts,
  removeAccount,
  switchAccount,
  updateAccount,
  type Account,
} from "../auth/account-store.js";
import { invalidate as invalidateToken } from "../auth/token-cache.js";

const accountSchema = z
  .object({
    name: z
      .string()
      .min(1)
      .describe(
        "Short identifier used to switch accounts (e.g. 'kairis', 'client-acme').",
      ),
    keyId: z
      .string()
      .describe(
        "The Key ID from App Store Connect → Users and Access → Integrations (e.g. 'AB12CD34EF').",
      ),
    issuerId: z
      .string()
      .uuid()
      .describe(
        "The Issuer ID shown on the same page — a single UUID per developer team.",
      ),
    keyFile: z
      .string()
      .describe(
        "Absolute path to the `.p8` private key file you downloaded from App Store Connect. Must remain readable at this path.",
      ),
    description: z.string().optional(),
    scope: z
      .array(z.string())
      .optional()
      .describe(
        "Optional list of JWT scope strings (e.g. ['GET /v1/apps', 'GET /v1/builds']). Leave empty for full access.",
      ),
  })
  .strict();

export const accountTools: Tool[] = [
  defineTool({
    name: "accounts_list",
    description:
      "List every App Store Connect account registered locally. Returns names, key ids, issuer ids, key-file paths, and descriptions. Never returns key material.",
    input: z.object({}).strict(),
    handler: async () => loadAccounts(),
  }),

  defineTool({
    name: "accounts_current",
    description:
      "Show which account is currently active. All subsequent API calls use this account's credentials.",
    input: z.object({}).strict(),
    handler: async () => getCurrentAccount(),
  }),

  defineTool({
    name: "accounts_add",
    description:
      "Register a new App Store Connect account. Provide the Key ID, Issuer ID, and an absolute path to the `.p8` file. The key file stays on disk — the MCP records only its path.",
    input: accountSchema,
    handler: async (args): Promise<{ added: string }> => {
      const acc: Account = {
        name: args.name,
        keyId: args.keyId,
        issuerId: args.issuerId,
        keyFile: args.keyFile,
        ...(args.description !== undefined && { description: args.description }),
        ...(args.scope !== undefined && { scope: args.scope }),
      };
      addAccount(acc);
      invalidateToken();
      return { added: args.name };
    },
  }),

  defineTool({
    name: "accounts_remove",
    description:
      "Remove an account from the local registry. Does NOT delete the `.p8` file on disk.",
    input: z.object({ name: z.string() }).strict(),
    handler: async ({ name }) => {
      removeAccount(name);
      invalidateToken();
      return { removed: name };
    },
  }),

  defineTool({
    name: "accounts_switch",
    description: "Make an existing registered account the active one.",
    input: z.object({ name: z.string() }).strict(),
    handler: async ({ name }) => {
      switchAccount(name);
      invalidateToken();
      return { current: name };
    },
  }),

  defineTool({
    name: "accounts_update",
    description:
      "Change one or more fields of an existing account. Provide only the fields you want to update.",
    input: z
      .object({
        name: z.string(),
        keyId: z.string().optional(),
        issuerId: z.string().uuid().optional(),
        keyFile: z.string().optional(),
        description: z.string().optional(),
        scope: z.array(z.string()).optional(),
      })
      .strict(),
    handler: async ({ name, ...patch }) => {
      updateAccount(name, patch);
      invalidateToken();
      return { updated: name };
    },
  }),
];
