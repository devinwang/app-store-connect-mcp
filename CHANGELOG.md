# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.2.0] — 2026-06-05

Fixes a regression that broke **all binary asset uploads** (screenshots, previews, review attachments, App Clip header images, Game Center images, routing app coverages) and hardens the upload flow against it recurring.

### Fixed

- **Asset uploads failed with HTTP 403 due to over-broad secret redaction.** The output redactor's generic `\b[a-f0-9]{40,}\b` "long hex" catch-all matched the `X-Amz-Signature` inside the pre-signed S3 `uploadOperations[].url` returned by every asset `create` call, rewriting it to `[REDACTED HEX]`. Because `asset_upload_file` PUTs to that exact URL, the corrupted signature made every upload 403. The long-hex pattern has been **removed** — it protected nothing (the S3 signature is a short-lived, single-asset, write-only token, not a credential) while silently breaking the documented 3-step upload protocol. The real secrets (the ASC JWT and the `.p8` private key) remain covered by the JWT / PEM / Bearer patterns plus the `redactDeep` field-name rules, and never appear in API response bodies in the first place.

### Added

- **`asset_upload_file` can fetch upload operations server-side.** Pass `assetType` (e.g. `appScreenshots`) + `assetId` (the freshly-created asset) instead of `uploadOperations`; the tool issues `GET /v1/{assetType}/{assetId}?fields[{assetType}]=uploadOperations` itself. The pre-signed signature is used entirely inside the server process and never transits MCP output, so uploads are immune to redaction regardless of the fix above. This is now the **preferred** invocation.

### Changed

- `asset_upload_file` input: `uploadOperations` is now **optional**. Provide either `assetType` + `assetId` (preferred) or a non-empty `uploadOperations` array (legacy fallback).
- The output redactor no longer redacts bare 40+ character hex strings (which also caught git commit SHAs and S3 signatures). It now redacts only the specific JWT / PEM / Bearer credential shapes.
- README screenshot-upload example updated to the `assetType` + `assetId` flow.

## [0.1.4] — 2026-04-26

The 0.1.3 publish was also rejected by npm — the same author who published `appstore-connect-mcp` had also reserved `appstore-connect-mcp-server`, and our `app-store-connect-mcp-server` was flagged as too similar.

### Changed

- **npm package name**: `app-store-connect-mcp-server` → **`apple-app-store-connect-mcp`**. The `apple-` prefix adds enough distinctiveness from `appstore-connect-mcp{,-server}` to clear the npm typosquatting filter, while keeping the verbatim `app-store-connect-mcp` substring for SEO.
- README install commands and npm badges updated.
- CLI command name (`bin`) stays `app-store-connect-mcp`.

## [0.1.3] — 2026-04-26

First version actually published to npm. 0.1.2's tag-triggered publish was rejected by npm with a 403:

> Package name too similar to existing package `appstore-connect-mcp`; try renaming your package.

The unrelated `appstore-connect-mcp` (no hyphen between "app" and "store"), published by another author, sits inside npm's similarity-based typosquatting filter even though our two packages cover wildly different surface areas. npm's official remediation is either a scope or a more distinctive name — this release picks the latter.

### Changed

- **npm package name**: `app-store-connect-mcp` → **`app-store-connect-mcp-server`**. Aligns with the MCP ecosystem `-mcp-server` suffix convention (e.g. `firecrawl-mcp-server`) and clears the npm similarity filter.
- The **CLI command name is unchanged** — `bin` still maps to `app-store-connect-mcp`, so existing MCP client configs keep working after a fresh global install.
- The **GitHub repo name is unchanged** — `devinwang/app-store-connect-mcp` stays.
- README install commands and npm badges updated to the new package name.

## [0.1.2] — 2026-04-26

First version published to npm. Pre-publish polish only — no behaviour change.

### Build

- `postbuild` step now `chmod +x dist/index.js` so the `bin` entry stays executable on clean builds (relying on a one-off manual `chmod` was fragile).
- CI/Release workflow: tag push (`v*`) now publishes to npm with [provenance](https://docs.npmjs.com/generating-provenance-statements) (sigstore) attached, gated on a tag-vs-`package.json` version match check, and cuts a matching GitHub Release with the CHANGELOG section as notes.
- `main` is now branch-protected: PR + CI required, no force push, no delete, linear history.

### Metadata

- Tightened `description` so the high-value search terms (App Store Connect, MCP, TestFlight, Xcode Cloud, Game Center, App Clips) fit inside the first 150 characters npm shows in search results.
- `keywords`: added `mcp-server`, `vscode`, `gemini-cli`, `windsurf`, `agentic`, `ai-assistant`, `automation`. Removed `asc` (too obscure) and `llm` (too generic).
- README: added `npm version` and `npm downloads` badges.

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
