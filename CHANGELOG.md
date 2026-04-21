# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.1] — 2026-04-21

Bug fixes. Two codegen defects shipped in 0.1.0 that made tool schemas
unusable from Claude-family MCP clients.

### Fixed

- **Anthropic tool-schema regex rejected bracketed property keys.** The previous codegen emitted Apple's JSON:API query-param names verbatim as zod object keys (`filter[name]`, `fields[apps]`, `limit[appStoreVersions]`, `filter[appStoreVersions.appStoreState]`). Anthropic's API requires tool property names to match `^[a-zA-Z0-9_.-]{1,64}$`, so every request that included one of these tools returned `400 invalid_request_error`. Codegen now maps to a bracket-free safe form at schema time and remaps back to Apple's original when building the outgoing query:
  - `filter[name]` → `filter_name`
  - `fields[apps]` → `fields_apps`
  - `limit[appStoreVersions]` → `limit_appStoreVersions`
  - `filter[appStoreVersions.appStoreState]` → `filter_appStoreVersions_appStoreState`
  The sales/finance report helpers in `overrides.ts` got the same rename.
- **Path parameters at the path-item level were dropped.** OpenAPI 3.x permits a shared `parameters` array on a path item that every operation inherits. Apple declares `id` (and similar single-resource path params) exclusively at that level. The previous codegen only read `op.parameters`, so every single-resource `_get_instance` / `_update_instance` / `_delete_instance` / relationship tool was missing `id` from its schema — 1020 of 1221 tools. From the LLM's perspective these endpoints appeared to "not support path IDs." Codegen now merges path-item `parameters` with op-level `parameters` (de-duped by `in` + `name`, op-level wins on duplicates per OpenAPI semantics).

### Verified

- `list_tools` over stdio: all 1221 tools now pass the Anthropic property-name regex.
- 1020 / 1221 tools now correctly declare `id` as a required path parameter (the remainder are collection / report / action endpoints that genuinely don't need one).

## [0.1.0] — 2026-04-21

First public release.

### Added

- **1221 MCP tools.**
  - 6 `accounts_*` — local registry management for multiple App Store Connect API keys.
  - 2 `auth_*` — `auth_status`, `auth_revoke_cache`.
  - 1208 auto-generated from Apple's official App Store Connect OpenAPI specification v4.3 — one tool per operation, covering every non-deprecated endpoint across all 191 resource groups (TestFlight, Xcode Cloud, Game Center, App Clips, in-app purchases, subscriptions, review submissions v2, alternative distribution for EU DMA, app data usages, analytics, metrics, provisioning, etc.).
  - 5 hand-written helpers: `asset_upload_file` (3-step asset upload), `sales_reports_download`, `finance_reports_download`, `analytics_report_instance_wait`, `ci_build_run_wait`.
- **Deprecated operations** are still emitted as tools but with a `[DEPRECATED]` prefix in their description.
- **Spec-driven codegen** (`npm run spec:download && npm run codegen`). Regenerating when Apple updates the spec takes seconds.
- **JWT signing** with ES256 from `.p8` key file, 20-minute lifetime, in-memory-only cache with 60-second safety margin.
- **Multi-account registry** at `~/.app-store-connect-mcp/accounts.json` (directory `0700`, file `0600`, path storage only — no key material on disk outside the user's own `.p8` file).
- **Env-var compatibility mode** with `ASC_KEY_ID` / `ASC_ISSUER_ID` / `ASC_PRIVATE_KEY_PATH` for drop-in replacement of `zelentsov-dev/asc-mcp`.
- **Universal output redaction** via `redact()` and `redactDeep()` — JWT, PEM, `Bearer` tokens, long hex tokens are replaced with `[REDACTED …]` before any tool output reaches the MCP client.
- **Error translation** for `401` / `403` / `404` / `409` / `422` / `429` / `5xx` with actionable hints.
- **CI** on Node 18 / 20 / 22 with typecheck + build + build-output credential leak scan.

### Security

- Zero credentials in the repository.
- `.gitignore` blocks `*.p8`, `AuthKey_*`, `*.pem`, `*.p12`, `*.pfx`, `*.key`, `id_rsa*`, `accounts.json`, `credentials/`, `keys/`, `secrets/`, `.env`, `.env.*`.
- CI fails if any private-key-material regex is detected in `dist/`.
