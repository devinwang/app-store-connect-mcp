#!/usr/bin/env node
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createServer } from "./server.js";

async function main(): Promise<void> {
  const server = createServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((err) => {
  // Write to stderr so the stdio transport on stdout isn't corrupted.
  process.stderr.write(
    `[app-store-connect-mcp] fatal: ${(err as Error).stack ?? err}\n`,
  );
  process.exit(1);
});
