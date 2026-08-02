import { readFileSync } from "node:fs";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { allTools, toolByName } from "./tools/index.js";

/**
 * Read the version from package.json rather than hard-coding it — a literal
 * here silently drifts from the published version on every release. The path
 * resolves to the package root from both `src/` and the compiled `dist/`.
 */
function packageVersion(): string {
  try {
    const pkg = JSON.parse(
      readFileSync(new URL("../package.json", import.meta.url), "utf8"),
    ) as { version?: string };
    return pkg.version ?? "0.0.0";
  } catch {
    return "0.0.0";
  }
}

export function createServer(): Server {
  const server = new Server(
    {
      name: "app-store-connect-mcp",
      version: packageVersion(),
    },
    {
      capabilities: {
        tools: {},
      },
    },
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: allTools.map((t) => ({
      name: t.name,
      description: t.description,
      inputSchema: t.inputSchema,
    })),
  }));

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const tool = toolByName(request.params.name);
    if (!tool) {
      return {
        content: [
          { type: "text", text: `Unknown tool: ${request.params.name}` },
        ],
        isError: true,
      };
    }
    // MCP SDK's ServerResult type has optional fields we don't populate.
    // Our ToolResult satisfies the response contract.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (await tool.handle(request.params.arguments ?? {})) as any;
  });

  return server;
}
