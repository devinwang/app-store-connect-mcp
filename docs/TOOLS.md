# Tool reference

For the authoritative list with descriptions and input schemas, install the server and use your MCP client's tool list command (Claude Code: `/mcp`, Claude Desktop: chat sidebar, Cursor: MCP panel).

This server exposes **1221 tools**:

- **6** `accounts_*` — local credential registry
- **2** `auth_*` — introspection
- **1208** auto-generated from Apple's OpenAPI spec, one per operation
- **5** hand-written helpers (`asset_upload_file`, `sales_reports_download`, `finance_reports_download`, `analytics_report_instance_wait`, `ci_build_run_wait`)

## Naming convention

Tool names are Apple's `operationId` values converted from camelCase to snake_case:

- `apps_getCollection`                 → `apps_get_collection`
- `appStoreVersions_createInstance`    → `app_store_versions_create_instance`
- `customerReviewResponsesV1_createInstance` → `customer_review_responses_v1_create_instance`

For each resource, the usual pattern is:

| Action | `operationId` suffix | Example |
|---|---|---|
| List | `get_collection` | `apps_get_collection` |
| Get by id | `get_instance` | `apps_get_instance` |
| Create | `create_instance` | `app_store_versions_create_instance` |
| Update | `update_instance` | `apps_update_instance` |
| Delete | `delete_instance` | `beta_groups_delete_instance` |
| Read one-to-one relation | `<rel>_get_to_one_related` | `apps_end_user_license_agreement_get_to_one_related` |
| Read one-to-many relation | `<rel>_get_to_many_related` | `apps_builds_get_to_many_related` |
| Read relationship (ids only) | `<rel>_get_to_many_relationship` | `beta_groups_beta_testers_get_to_many_relationship` |
| Add to relationship | `<rel>_create_to_many_relationship` | `beta_groups_beta_testers_create_to_many_relationship` |
| Remove from relationship | `<rel>_delete_to_many_relationship` | `beta_groups_beta_testers_delete_to_many_relationship` |

## Resource groups

See `spec/coverage-report.txt` in the repo for the full list of 191 tags + tool counts per tag.

## Finding a tool

1. Open Apple's [App Store Connect API reference](https://developer.apple.com/documentation/appstoreconnectapi/).
2. Find the operation you want (e.g. "List Builds → `builds-getCollection`").
3. The MCP tool is `builds_get_collection`.

The 5 hand-written helpers are documented in the README under [Feature matrix](../README.md#feature-matrix).
