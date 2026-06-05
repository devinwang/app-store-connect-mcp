# app-store-connect-mcp

> **The complete Model Context Protocol (MCP) server for Apple's App Store Connect API.**
> **1221 tools. 100% coverage** of every non-deprecated operation in Apple's official OpenAPI spec — TestFlight, Xcode Cloud, Game Center, App Clips, in-app purchases, subscriptions, review submissions, analytics, provisioning, and everything else Apple exposes. Works with Claude, Cursor, VS Code Copilot, Codex CLI, Gemini CLI, Windsurf, or any MCP client.

[![npm version](https://img.shields.io/npm/v/apple-app-store-connect-mcp.svg?color=cb3837&logo=npm)](https://www.npmjs.com/package/apple-app-store-connect-mcp)
[![npm downloads](https://img.shields.io/npm/dm/apple-app-store-connect-mcp.svg)](https://www.npmjs.com/package/apple-app-store-connect-mcp)
[![CI](https://github.com/devinwang/app-store-connect-mcp/actions/workflows/ci.yml/badge.svg)](https://github.com/devinwang/app-store-connect-mcp/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Node](https://img.shields.io/badge/node-%3E%3D18-green.svg)](package.json)
[![Tools: 1221](https://img.shields.io/badge/tools-1221-informational.svg)](#feature-matrix)
[![Spec: 4.3](https://img.shields.io/badge/App%20Store%20Connect%20API-4.3-000000.svg)](https://developer.apple.com/documentation/appstoreconnectapi)
[![MCP](https://img.shields.io/badge/MCP-compatible-9B59B6.svg)](https://modelcontextprotocol.io/)
[![TypeScript](https://img.shields.io/badge/TypeScript-strict-3178C6.svg)](tsconfig.json)

**See also:** [`google-play-developer-mcp`](https://github.com/devinwang/google-play-developer-mcp) — the same philosophy for the Google Play Console.

---

## Table of Contents

- [Why this exists](#why-this-exists)
- [Feature matrix](#feature-matrix)
- [Quick start](#quick-start)
- [Step-by-step setup](#step-by-step-setup)
- [Register with your MCP client](#register-with-your-mcp-client)
- [Usage examples](#usage-examples)
- [Migrating from `asc-mcp` (zelentsov-dev)](#migrating-from-asc-mcp-zelentsov-dev)
- [Security](#security)
- [Design notes](#design-notes)
- [Contributing](#contributing)
- [Version history](#version-history)
- [References](#references)

---

## Why this exists

App Store Connect is huge. Apple's own OpenAPI spec currently lists **1208 operations** across 192 resource groups — TestFlight, Xcode Cloud, Game Center, App Clips, in-app purchases, subscriptions, offer codes, review submissions, alternative distribution (EU DMA), analytics, metrics, privacy manifests, provisioning, users… the list goes on.

Every community MCP covers a slice. None covers everything.

**`app-store-connect-mcp` does.**

| Property | This server | Typical community MCP |
|---|---|---|
| App Store Connect API coverage | ✅ 1200+ tools (100% of spec v4.3) | Partial (usually 50–150 tools) |
| Xcode Cloud | ✅ all `ciProducts` / `ciWorkflows` / `ciBuildRuns` / `ciBuildActions` / `ciArtifacts` / `ciIssues` / `ciTestResults` | ❌ |
| Game Center | ✅ achievements, leaderboards, groups, matchmaking, vocabularies | ❌ |
| App Clips | ✅ default + advanced experiences, review details, header images | ❌ |
| Review Submissions v2 | ✅ | Often still on the legacy `appStoreVersionSubmissions` |
| Alternative distribution (EU DMA) | ✅ | ❌ |
| App data usages (privacy) | ✅ | ❌ |
| Multi-account (switch between dev accounts) | ✅ local registry | Usually one |
| Credential safety | No `.p8` content in repo, no keys in the process cache, strict `.gitignore` | Varies |
| Spec-driven — auto-regenerate on new spec | ✅ `npm run codegen` | ❌ |

If you drive App Store Connect with an AI assistant — submission automation, TestFlight management, IAP / subscription catalog, review triage, analytics, or Xcode Cloud orchestration — this gives the assistant the full toolbox in one install.

---

## Feature matrix

**1221 tools total (as of spec v4.3):**

- **6** `accounts_*` — local multi-account registry (add / list / switch / remove / update / current)
- **2** `auth_*` — `auth_status` (readiness) and `auth_revoke_cache`
- **1208** auto-generated from the official App Store Connect OpenAPI spec, one per operation, covering every resource group:
  - Apps / App Infos / App Store Versions / App Store Version Localizations / Phased Releases / Version Submissions
  - Review Submissions (v2) + Review Submission Items + App Store Review Attachments + App Store Review Details
  - TestFlight: Beta Groups, Beta Testers, Beta App Review Details/Submissions, Beta App Localizations, Beta Build Localizations, Beta License Agreements, Beta Feedback Screenshot/Crash Submissions, Beta Invitees, Builds, Build Bundles, Build Bundle File Sizes
  - Xcode Cloud: Ci Products, Ci Workflows, Ci Build Runs, Ci Build Actions, Ci Artifacts, Ci Issues, Ci Test Results, Ci Xcode Versions, Ci Mac Os Versions, Ci Scm Repositories / References / Pull Requests / Providers
  - Game Center: Achievements, Leaderboards, Leaderboard Sets, Groups, Matchmaking Queues / Rule Sets / Rules / Teams, Activities, Player Scores / Achievements, App Versions, Enabled Versions, Details, Vocabularies, plus all Localizations / Images / Releases
  - App Clips: App Clips, Default / Advanced Experiences, Default / Advanced Experience Localizations, Header Images, Advanced Experience Images, App Store Review Details
  - In-App Purchases: IAP v2, Subscriptions, Subscription Groups, Subscription Offer Codes (custom + one-time-use), Subscription Prices, Subscription Promotional Offers, Subscription Introductory Offers, Subscription Availabilities, Win-back Offers, Promoted Purchases
  - Pricing & Availability: App Prices, App Price Points, App Price Schedules, App Availabilities V2, Territories, Territory Availabilities
  - Custom Product Pages + PPO (A/B testing): App Custom Product Pages, Versions, Localizations, App Store Version Experiments V2 + Treatments + Localizations
  - Screenshots & Previews: App Screenshots, App Screenshot Sets, App Previews, App Preview Sets, App Event Screenshots, App Event Video Clips
  - Provisioning: Bundle Ids, Bundle Id Capabilities, Certificates, Devices, Profiles, Pass Type Ids
  - Users & Access: Users, User Invitations, Actors, Sandbox Testers
  - Encryption / Compliance: App Encryption Declarations + Documents, Age Rating Declarations, App Data Usages + Categories + Purposes + Data Protections + Publish State, Accessibility Declarations, End User License Agreements
  - Alternative Distribution (EU DMA): Alternative Distribution Keys, Domains, Packages, Package Versions / Variants / Deltas, Marketplace Search Details, Marketplace Webhooks
  - Analytics: Analytics Reports, Report Requests, Report Instances, Report Segments, Diagnostic Signatures
  - Metrics: App Perf, Build Perf, Power Perf, Diagnostic Logs
  - Sales & Finance: Sales Reports, Finance Reports
  - Reviews: Customer Reviews, Customer Review Responses
  - Routing App Coverages, App Categories, App Events + Localizations, Android ↔ iOS App Mapping, External Purchase Collectors…
- **5** hand-written helpers for flows that don't map cleanly to a single operation:
  - `asset_upload_file` — step 2 of the 3-step asset upload protocol (screenshots, previews, review attachments, IAP review screenshots, App Clip header images, Game Center images, routing app coverages)
  - `sales_reports_download` — downloads and un-gzips sales reports, returns parsed TSV
  - `finance_reports_download` — same for finance reports
  - `analytics_report_instance_wait` — poll until a report is `COMPLETED`/`FAILED`
  - `ci_build_run_wait` — poll an Xcode Cloud build run to completion

Run `auth_status`, then `apps_get_collection` to verify end-to-end.

---

## Quick start

Install from npm:

```bash
npm install -g apple-app-store-connect-mcp
```

Or run without installing:

```bash
npx -y apple-app-store-connect-mcp
```

> **About the package name.** The package on npm is `apple-app-store-connect-mcp`. After install, the command on your `$PATH` is `app-store-connect-mcp` (the bin name) — that's what your MCP client config below points at.

Then add to your MCP client config (example, Claude Code):

```json
{
  "mcpServers": {
    "app-store-connect": {
      "command": "app-store-connect-mcp"
    }
  }
}
```

Finally, register your App Store Connect API key (details below):

```
accounts_add
  name: my-app
  keyId: AB12CD34EF
  issuerId: 69a6de70-...
  keyFile: /Users/you/.config/app-store-connect-mcp/AuthKey_AB12CD34EF.p8
```

---

## Step-by-step setup

### 1. Create an App Store Connect API key

1. Open [App Store Connect](https://appstoreconnect.apple.com/).
2. **Users and Access → Integrations → App Store Connect API**.
3. Click **Generate API Key** (requires Account Holder or Admin role).
4. Name it, choose the access level you want (Admin, Developer, Finance, Marketing, etc.), and **Generate**.
5. Copy the **Key ID** and **Issuer ID** (displayed at the top of the page).
6. Click **Download API Key**. This gives you an `AuthKey_<KEYID>.p8` file. **You only get this download once.** Store it outside any git repo, for example at `~/.config/app-store-connect-mcp/AuthKey_AB12CD34EF.p8` with `chmod 600`.

### 2. Register the key with this MCP server

Launch any MCP client that has the server configured, then call:

```
accounts_add
  name: my-app
  keyId: <the 10-char Key ID>
  issuerId: <the UUID shown above the API keys list>
  keyFile: /absolute/path/to/AuthKey_XXXXXXXXXX.p8
  description: (optional)
```

### 3. Verify

```
auth_status
```

Should return `{ source: "accounts", tokenAcquired: true, expiresAt: ... }`.

```
apps_get_collection
```

Lists the apps the key can see.

### 4. Managing multiple accounts

```
accounts_add    name: client-a  keyId: ... issuerId: ... keyFile: ...
accounts_add    name: client-b  keyId: ... issuerId: ... keyFile: ...
accounts_switch name: client-b
accounts_list
```

All subsequent calls target the currently-switched account.

### Environment-variable compatibility mode

For compatibility with older setups (e.g. `zelentsov-dev/asc-mcp`), the server also accepts:

```bash
ASC_KEY_ID="..."
ASC_ISSUER_ID="..."
ASC_PRIVATE_KEY_PATH="/absolute/path/to/AuthKey_XXX.p8"
```

If no account is registered via `accounts_add`, the server falls back to these env vars. `accounts_*` tools always take precedence.

---

## Register with your MCP client

### Claude Desktop

macOS: `~/Library/Application Support/Claude/claude_desktop_config.json`
Windows: `%APPDATA%/Claude/claude_desktop_config.json`

```json
{
  "mcpServers": {
    "app-store-connect": {
      "command": "app-store-connect-mcp"
    }
  }
}
```

### Claude Code

```bash
claude mcp add app-store-connect app-store-connect-mcp
```

Or edit `~/.claude.json`:

```json
{
  "mcpServers": {
    "app-store-connect": {
      "command": "app-store-connect-mcp"
    }
  }
}
```

### Cursor

Settings → MCP → Add new MCP server:

```json
{
  "app-store-connect": {
    "command": "app-store-connect-mcp"
  }
}
```

### VS Code (GitHub Copilot agent mode)

`.vscode/mcp.json`:

```json
{
  "servers": {
    "app-store-connect": {
      "type": "stdio",
      "command": "app-store-connect-mcp"
    }
  }
}
```

### Codex CLI / Gemini CLI / Windsurf / Continue

Any MCP-compliant client accepts the same `command` entry — point it at the globally installed `app-store-connect-mcp` binary, or at `node /path/to/dist/index.js` when running from source.

### Running from source (no global install)

```bash
git clone https://github.com/devinwang/app-store-connect-mcp.git
cd app-store-connect-mcp
npm install
npm run build
```

Then in your MCP client config:

```json
{
  "mcpServers": {
    "app-store-connect": {
      "command": "node",
      "args": ["/absolute/path/to/app-store-connect-mcp/dist/index.js"]
    }
  }
}
```

---

## Usage examples

### Check which apps your key can see

```
accounts_switch name: my-app
auth_status
apps_get_collection
```

### Fetch a build by version + buildNumber and submit it to TestFlight

```
builds_get_collection
  "filter[preReleaseVersion.version]": "1.2.0"
  "filter[version]": "147"

beta_groups_get_collection
  "filter[app]": <APP_ID>
  "fields[betaGroups]": "name,publicLinkEnabled"

builds_beta_groups_create_to_many_relationship
  id: <BUILD_ID>
  body:
    data:
      - type: betaGroups
        id: <BETA_GROUP_ID>

builds_update_instance
  id: <BUILD_ID>
  body:
    data:
      type: builds
      id: <BUILD_ID>
      attributes:
        expired: false
```

### Upload a screenshot (3-step asset flow)

```
app_screenshots_create_instance
  body:
    data:
      type: appScreenshots
      attributes:
        fileName: "en-US-iphone-6_9-1.png"
        fileSize: 2415122
      relationships:
        appScreenshotSet:
          data: { type: appScreenshotSets, id: <SET_ID> }
# → response includes the new `data.id` (asset is now AWAITING_UPLOAD)

asset_upload_file
  filePath: /abs/path/to/screenshot.png
  assetType: appScreenshots     # preferred: tool fetches uploadOperations
  assetId: <SCREENSHOT_ID>      #           server-side (signature stays server-side)
# (legacy: pass `uploadOperations: [...]` from the create response instead)

app_screenshots_update_instance
  id: <SCREENSHOT_ID>
  body:
    data:
      type: appScreenshots
      id: <SCREENSHOT_ID>
      attributes:
        uploaded: true
        sourceFileChecksum: <MD5>
```

### Trigger an Xcode Cloud build and wait for completion

```
ci_build_runs_create_instance
  body:
    data:
      type: ciBuildRuns
      relationships:
        workflow:
          data: { type: ciWorkflows, id: <WORKFLOW_ID> }
# → response includes `data.id`

ci_build_run_wait
  id: <BUILD_RUN_ID>
  timeoutMs: 3600000
```

### Respond to a customer review

```
customer_reviews_get_collection
  "filter[app]": <APP_ID>
  "sort": "-createdDate"
  "limit": 10

customer_review_responses_v1_create_instance
  body:
    data:
      type: customerReviewResponses
      attributes:
        responseBody: "Thanks for the feedback — we fixed this crash in 1.2.1. Please give it another try!"
      relationships:
        review:
          data: { type: customerReviews, id: <REVIEW_ID> }
```

### Pull a sales report (one day)

```
sales_reports_download
  "filter[frequency]": DAILY
  "filter[reportType]": SALES
  "filter[reportSubType]": SUMMARY
  "filter[vendorNumber]": "12345678"
  "filter[reportDate]": "2026-04-20"
```

Returns parsed rows. Add `parse: false` to get raw TSV.

### Create + activate a subscription

```
subscription_groups_create_instance
  body: { data: { type: subscriptionGroups, attributes: { referenceName: "Premium" }, relationships: { app: { data: { type: apps, id: <APP_ID> } } } } }

subscriptions_create_instance
  body: { data: { type: subscriptions, attributes: { productId: "com.example.premium.monthly", name: "Premium Monthly", subscriptionPeriod: "ONE_MONTH" }, relationships: { group: { data: { type: subscriptionGroups, id: <GROUP_ID> } } } } }

subscription_prices_create_instance
  body: { data: { type: subscriptionPrices, relationships: { subscription: { data: { type: subscriptions, id: <SUB_ID> } }, territory: { data: { type: territories, id: "USA" } }, subscriptionPricePoint: { data: { type: subscriptionPricePoints, id: <PRICE_POINT_ID> } } } } }
```

---

## Migrating from `asc-mcp` (zelentsov-dev)

This server replaces `github.com/zelentsov-dev/asc-mcp`. Key differences:

- **Scope.** That server implements ~90 tools; this one implements all 1208 spec operations plus helpers.
- **Tool names.** `zelentsov-dev/asc-mcp` uses simplified names like `apps_search`, `reviews_list`, `app_versions_submit_for_review`. This server uses Apple's official `operationId` snake-cased — `apps_get_collection`, `customer_reviews_get_collection`, `review_submissions_create_instance`. There's no auto-translation: update any prompts or scripts that assumed the old names.
- **Credential compat.** The same env vars (`ASC_KEY_ID`, `ASC_ISSUER_ID`, `ASC_PRIVATE_KEY_PATH`) still work, so you don't need to move the `.p8` to migrate. You'll get a one-time stderr warning recommending you register via `accounts_add` for multi-account support.
- **`company_*` → `accounts_*`.** Rename mental model: a "company" in the old server is an "account" here.

A comprehensive name-by-name mapping is included in `docs/MIGRATION.md`.

---

## Security

This repo ships with **zero** credentials. You bring an App Store Connect API `.p8`; the server records only its path.

### What is and isn't on disk

| Where | What |
|---|---|
| `~/.app-store-connect-mcp/accounts.json` | Account names, key ids, issuer ids, key-file paths, descriptions. No secrets. Written with `0600` permissions, directory `0700`. |
| Wherever you placed your `AuthKey_*.p8` | The actual private key. **Never** committed. **Never** copied into the server's memory longer than one JWT signing. |
| Repo contents | Code only. No fixtures, no example keys, no real key ids. |

### What's in memory

| When | What |
|---|---|
| At JWT sign time | The `.p8` content is `readFileSync`'d, passed to `jwt.sign`, and the buffer is `fill(0)`-ed and dereferenced immediately after. |
| Between calls | A signed JWT (20-minute lifetime) is cached in a local variable in `token-cache.ts`. This is in-memory only — it is never persisted to disk. Dropped on `accounts_switch`, `accounts_update`, `accounts_remove`, and `auth_revoke_cache`. |
| In tool outputs | Everything is passed through `redact()` before emission. JWT-like strings, PEM blocks, `Bearer` tokens, and long hex tokens get replaced with `[REDACTED …]` — defense-in-depth against any code path accidentally logging. |

### `.gitignore` blocks

- `*.p8`, `AuthKey_*`, `AuthKey_*.p8`
- `*.pem`, `*.p12`, `*.pfx`, `*.key`, `id_rsa*`
- `accounts.json`, `.app-store-connect-mcp/`
- `credentials/`, `keys/`, `secrets/`
- `.env`, `.env.*` (keeps `.env.example`)

### Recommended hygiene

- Keep your `.p8` outside any git repo on your machine.
- Grant the API key the **narrowest role** your workflow needs. `Admin` lets this MCP do anything including deleting store metadata. Restrict as appropriate.
- Rotate the key periodically: revoke the old key in App Store Connect → Users and Access → Integrations, generate a new one, run `accounts_update --keyFile <newPath>`.
- `auth_status` returns only the key id, issuer id, a boolean, and the JWT expiry timestamp. It never returns the JWT or the `.p8` content.
- The CI workflow in this repo fails the build if any private-key-material regex is detected in `dist/`.

### Audit trail

Apple logs every API call against your key id. If you ever suspect misuse, open App Store Connect → Users and Access → Integrations and revoke the key; any outstanding JWTs signed with it stop working immediately.

---

## Design notes

- **Spec-driven.** 1208 of the 1221 tools are auto-generated from Apple's official OpenAPI spec (`spec/app-store-connect-openapi.json`). When Apple ships a new version, `npm run spec:download && npm run codegen && npm run build` is all it takes to update.
- **1:1 operationId naming.** Tool names are Apple's `operationId` values converted to `snake_case`. This means the MCP names match the official REST reference, so when an LLM reads Apple's docs it can pick the right tool without translation.
- **Pragmatic input validation.** Path params are typed zod strings (required), query params are typed zod fields (optional) with the exact bracketed names Apple uses (`filter[name]`, `fields[apps]`, `limit[appStoreVersions]`). Request bodies are `z.record(z.unknown())` with a description pointing at the OpenAPI component schema — ASC validates them server-side and our error translator surfaces mistakes clearly. Generating full zod trees for every JSON:API envelope would balloon the server by 10× and add negligible value.
- **Error translation.** `401` becomes "JWT rejected — rotate or check clock skew", `403` becomes "key isn't authorized for this endpoint", `422` surfaces the exact `source.pointer` from the ASC response, `429` explains the per-team quota, `5xx` points at https://developer.apple.com/system-status/.
- **Stateless transport.** stdio only. No network listener, no persistent state beyond the accounts file.
- **Zero telemetry.** The server never phones home.

---

## Contributing

PRs welcome. Before you submit:

- `npm run typecheck` + `npm run build` pass on Node 18 / 20 / 22 (CI also runs this).
- Never include a real `.p8`, a real `keyId`, a real `issuerId`, or a real JWT in an issue, PR, fixture, or example.
- When you update to a new OpenAPI spec version:
  1. `npm run spec:download`
  2. `npm run codegen` — regenerates `src/tools/generated/` and `spec/coverage-report.txt`
  3. `npm run build`
  4. Skim `spec/coverage-report.txt` diff — a delta of 10+ tools or a new top-level tag should get a CHANGELOG note.
- New hand-written tools live in `src/tools/overrides.ts` and must have names that don't collide with any generated name.

---

## Version history

### 0.1.0 — 2026-04-21 (first public release)

- **1221 MCP tools:** 6 accounts, 2 auth, 1208 auto-generated from Apple's App Store Connect OpenAPI spec v4.3, 5 hand-written helpers (asset upload, sales/finance report download, polling).
- **100% spec coverage** — every non-deprecated operation in the spec has a tool, and deprecated operations are still exposed with a `[DEPRECATED]` prefix.
- **Zero credentials in the repo.** Strict `.gitignore`, `.p8` content never cached in process memory, in-memory-only JWT cache, universal output redaction.
- **Multi-account** via `~/.app-store-connect-mcp/accounts.json` (path storage only).
- **Compatibility mode** for `ASC_KEY_ID` / `ASC_ISSUER_ID` / `ASC_PRIVATE_KEY_PATH` env vars (drop-in replacement for `zelentsov-dev/asc-mcp` setups).
- **Spec-driven regeneration** via `npm run codegen`.
- **Error translation** for every common ASC failure mode.

---

## References

- [App Store Connect API — documentation landing page](https://developer.apple.com/documentation/appstoreconnectapi)
- [App Store Connect API — REST reference](https://developer.apple.com/documentation/appstoreconnectapi/app_store_connect_api)
- [App Store Connect OpenAPI Specification (ZIP)](https://developer.apple.com/sample-code/app-store-connect/app-store-connect-openapi-specification.zip)
- [Creating API Keys to Authorize API Requests](https://developer.apple.com/documentation/appstoreconnectapi/creating_api_keys_for_app_store_connect_api)
- [Generating Tokens for API Requests (JWT format)](https://developer.apple.com/documentation/appstoreconnectapi/generating_tokens_for_api_requests)
- [Model Context Protocol specification](https://modelcontextprotocol.io/)
- [Anthropic Claude — MCP documentation](https://docs.claude.com/en/docs/mcp)

---

## License

MIT — see [LICENSE](LICENSE).
