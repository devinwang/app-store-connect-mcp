# Contributing

## Development loop

```bash
git clone https://github.com/devinwang/app-store-connect-mcp.git
cd app-store-connect-mcp
npm install
npm run typecheck
npm run build
```

## Updating to a new OpenAPI spec

Apple ships spec updates alongside WWDC and periodically throughout the year.

```bash
npm run spec:download   # fetches latest zip, extracts to spec/
npm run codegen         # regenerates src/tools/generated/*
npm run build
```

Review `spec/coverage-report.txt` diff. If a new top-level tag appeared or if the total tool count changed significantly, add a CHANGELOG entry.

## Adding a hand-written override

Helpers that wrap multi-step flows or non-JSON transports live in `src/tools/overrides.ts`. They must:

1. Have a name that does **not** collide with any generated tool name.
2. Use `defineTool({...})` so validation + error wrapping + output redaction run consistently.
3. Go through `ascRequest()` from `src/utils/http.ts` for any outbound ASC call (so JWT signing, retries, and error translation all work).

## Security

- Never commit a real `.p8`, `keyId`, `issuerId`, or JWT. Use clearly-fake placeholders like `AB12CD34EF` and `69a6de70-xxxx-xxxx-xxxx-xxxxxxxxxxxx`.
- The CI workflow greps `dist/` for private-key patterns and fails the build if it finds any.
- If you're debugging locally, `redact()` + `redactDeep()` from `src/utils/redact.ts` are the two filters to put in front of anything you log.

## Style

- TypeScript strict mode. No `any` except inside generated files or where openly casted (documented).
- No `console.log` for user-facing output. Tools return structured data via `defineTool`.
- Commit messages: short imperative ("Add `ci_build_run_wait` helper", "Fix pagination on sales reports").
