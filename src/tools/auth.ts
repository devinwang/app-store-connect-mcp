/**
 * Authentication introspection. Never emits key material.
 */

import { z } from "zod";
import { defineTool, type Tool } from "../utils/tool.js";
import { authStatus } from "../auth/client-factory.js";
import { invalidate as invalidateToken } from "../auth/token-cache.js";

export const authTools: Tool[] = [
  defineTool({
    name: "auth_status",
    description:
      "Verify that the active account can acquire an App Store Connect JWT. Returns identifiers and a boolean readiness flag. Never returns the JWT itself or the `.p8` contents.",
    input: z.object({}).strict(),
    handler: async () => authStatus(),
  }),

  defineTool({
    name: "auth_revoke_cache",
    description:
      "Drop the in-memory JWT cache so the next API call re-signs. Useful after rotating the `.p8`.",
    input: z.object({}).strict(),
    handler: async () => {
      invalidateToken();
      return { invalidated: true };
    },
  }),
];
