# OpenAPI Spec

**Source:** https://developer.apple.com/sample-code/app-store-connect/app-store-connect-openapi-specification.zip

| Field | Value |
|---|---|
| File | `app-store-connect-openapi.json` |
| Spec version | 4.5.1 |
| Downloaded | 2026-10-21 |
| Total operations | 1303 |
| Unique operationIds | 1303 |
| Deprecated operations | 159 |
| Tags (resource groups) | 203 |
| Server base URL | `https://api.appstoreconnect.apple.com/` |

## How to refresh

1. `npm run spec:download` — fetches the latest zip and overwrites `app-store-connect-openapi.json`.
2. `npm run codegen` — regenerates `src/tools/generated/` from the new spec.
3. Rebuild: `npm run build`.

## Licensing

The spec is Apple's intellectual property. It is redistributed here under the implicit license Apple grants via the public sample-code endpoint, for the sole purpose of driving the App Store Connect API. Do **not** extract and republish it as a standalone artefact — always fetch the latest from Apple.

## Deprecated operations

They're still emitted as tools, but with a `[DEPRECATED]` prefix in their description. This keeps backwards compatibility while steering AI clients away from them.
