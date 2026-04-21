# Migrating from `asc-mcp` (zelentsov-dev) → `app-store-connect-mcp`

This server is a drop-in **credential** replacement: the same `.p8`, key ID, and issuer ID work unchanged. But tool names follow Apple's official `operationId` convention (snake-cased), not the simplified scheme the older server used. Any prompt, script, or pipeline referring to old names must be updated.

## Credential migration

Works without changes if you keep using env vars:

```jsonc
{
  "mcpServers": {
    "app-store-connect": {
      "command": "app-store-connect-mcp",
      "env": {
        "ASC_KEY_ID": "AB12CD34EF",
        "ASC_ISSUER_ID": "69a6de70-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
        "ASC_PRIVATE_KEY_PATH": "/Users/you/.config/app-store-connect-mcp/AuthKey_AB12CD34EF.p8"
      }
    }
  }
}
```

Recommended: migrate to `accounts_add` + `accounts_switch` to get multi-account support.

## Concept map

| `asc-mcp` (old) | `app-store-connect-mcp` (new) |
|---|---|
| `company_*` — manage multiple App Store Connect teams | `accounts_*` — same idea, cleaner name |
| `auth_generate_token`, `auth_refresh_token`, `auth_validate_token`, `auth_token_status` | **Removed.** Tokens are never surfaced. `auth_status` returns a boolean readiness indicator and the expiry timestamp; `auth_revoke_cache` drops the in-memory cache. |

## Tool name mapping (representative subset)

Old names followed `resource_action` with a friendly shape. New names follow Apple's `operationId` — camelCase becomes snake_case.

| Old (`asc-mcp`) | New (`app-store-connect-mcp`) |
|---|---|
| `apps_list` | `apps_get_collection` |
| `apps_search` | `apps_get_collection` (with `filter[*]`) |
| `apps_get_details` | `apps_get_instance` |
| `apps_get_metadata` | `apps_get_instance` + `include=appInfos,appInfos.ageRatingDeclaration` |
| `apps_update_metadata` | `apps_update_instance` |
| `apps_list_localizations` | `apps_app_infos_get_to_many_related` + `app_infos_app_info_localizations_get_to_many_related` |
| `apps_create_localization` | `app_info_localizations_create_instance` |
| `apps_delete_localization` | `app_info_localizations_delete_instance` |
| `app_versions_list` | `app_store_versions_get_collection` |
| `app_versions_create` | `app_store_versions_create_instance` |
| `app_versions_get` | `app_store_versions_get_instance` |
| `app_versions_update` | `app_store_versions_update_instance` |
| `app_versions_delete` | `app_store_versions_delete_instance` |
| `app_versions_submit_for_review` | `review_submissions_create_instance` + `review_submission_items_create_instance` (v2 flow; old v1 is still reachable via `app_store_version_submissions_create_instance`) |
| `app_versions_cancel_review` | `app_store_version_submissions_delete_instance` (legacy) or `review_submissions_update_instance` (v2, set state: `CANCELING`) |
| `app_versions_release` | `app_store_version_release_requests_create_instance` |
| `app_versions_attach_build` | `app_store_versions_update_instance` (with `relationships.build.data`) |
| `app_versions_create_phased_release` | `app_store_version_phased_releases_create_instance` |
| `app_versions_get_phased_release` | `app_store_version_phased_releases_get_instance` |
| `app_versions_update_phased_release` | `app_store_version_phased_releases_update_instance` |
| `app_versions_update_age_rating` | `age_rating_declarations_update_instance` |
| `app_versions_set_review_details` | `app_store_review_details_update_instance` + `app_store_review_attachments_*` |
| `builds_list` | `builds_get_collection` |
| `builds_get` | `builds_get_instance` |
| `builds_find_by_number` | `builds_get_collection` (filter by `filter[version]`, `filter[preReleaseVersion.version]`) |
| `builds_list_for_version` | `app_store_versions_build_get_to_one_related` / `pre_release_versions_builds_get_to_many_related` |
| `builds_get_processing_state` / `builds_get_processing_status` | `builds_get_instance` (read `data.attributes.processingState`) |
| `builds_check_readiness` | `builds_get_instance` + parse fields like `expired`, `iconAssetToken`, `processingState`, `usesNonExemptEncryption` |
| `builds_get_beta_detail` | `builds_build_beta_detail_get_to_one_related` |
| `builds_update_beta_detail` | `build_beta_details_update_instance` |
| `builds_get_beta_groups` | `builds_beta_groups_get_to_many_relationship` |
| `builds_add_to_beta_groups` | `builds_beta_groups_create_to_many_relationship` |
| `builds_get_beta_testers` | `builds_individual_testers_get_to_many_relationship` |
| `builds_list_beta_localizations` | `builds_beta_build_localizations_get_to_many_related` |
| `builds_set_beta_localization` | `beta_build_localizations_create_instance` / `beta_build_localizations_update_instance` |
| `builds_send_beta_notification` | `build_beta_notifications_create_instance` |
| `builds_update_encryption` | `builds_update_instance` (set `usesNonExemptEncryption`) or `app_encryption_declarations_*` |
| `beta_groups_list` | `beta_groups_get_collection` |
| `beta_groups_create` | `beta_groups_create_instance` |
| `beta_groups_update` | `beta_groups_update_instance` |
| `beta_groups_delete` | `beta_groups_delete_instance` |
| `beta_groups_list_testers` | `beta_groups_beta_testers_get_to_many_relationship` |
| `beta_groups_add_testers` | `beta_groups_beta_testers_create_to_many_relationship` |
| `beta_groups_remove_testers` | `beta_groups_beta_testers_delete_to_many_relationship` |
| `beta_groups_add_builds` | `beta_groups_builds_create_to_many_relationship` |
| `beta_groups_remove_builds` | `beta_groups_builds_delete_to_many_relationship` |
| `beta_testers_list` | `beta_testers_get_collection` |
| `beta_testers_get` | `beta_testers_get_instance` |
| `beta_testers_create` | `beta_testers_create_instance` |
| `beta_testers_delete` | `beta_testers_delete_instance` |
| `beta_testers_search` | `beta_testers_get_collection` (with `filter[email]`, `filter[firstName]`, etc.) |
| `beta_testers_list_apps` | `beta_testers_apps_get_to_many_relationship` |
| `reviews_list` | `customer_reviews_get_collection` |
| `reviews_get` | `customer_reviews_get_instance` |
| `reviews_list_for_version` | `customer_reviews_get_collection` with `filter[app]` |
| `reviews_stats` | No direct equivalent — compute client-side from `customer_reviews_get_collection` |
| `reviews_create_response` | `customer_review_responses_v1_create_instance` |
| `reviews_get_response` | `customer_review_responses_v1_get_instance` |
| `reviews_delete_response` | `customer_review_responses_v1_delete_instance` |
| `iap_list` | `in_app_purchases_v2_get_collection` |
| `iap_get` | `in_app_purchases_v2_get_instance` |
| `iap_create` | `in_app_purchases_v2_create_instance` |
| `iap_update` | `in_app_purchases_v2_update_instance` |
| `iap_delete` | `in_app_purchases_v2_delete_instance` |
| `iap_create_localization` | `in_app_purchase_localizations_create_instance` |
| `iap_update_localization` | `in_app_purchase_localizations_update_instance` |
| `iap_delete_localization` | `in_app_purchase_localizations_delete_instance` |
| `iap_list_localizations` | `in_app_purchases_v2_iap_price_schedule_get_to_one_related` / `*_app_store_review_screenshot_get_to_one_related` etc. |
| `iap_submit_for_review` | `in_app_purchase_submissions_create_instance` |
| `iap_get_price_schedule` | `in_app_purchase_price_schedules_get_instance` |
| `iap_set_price_schedule` | `in_app_purchase_price_schedules_create_instance` |
| `iap_list_price_points` | `in_app_purchase_price_points_get_collection` |
| `iap_create_review_screenshot` | `in_app_purchase_app_store_review_screenshots_create_instance` + `asset_upload_file` + update with `uploaded: true` |
| `subscriptions_*` | `subscriptions_*` (one-to-one — new names match Apple's nouns) |
| `subscriptions_create_group` / `..._update_group` / `..._delete_group` | `subscription_groups_{create,update,delete}_instance` |
| `subscriptions_list_prices` | `subscriptions_prices_get_to_many_related` |
| `offer_codes_*` (custom + one-time-use) | `subscription_offer_codes_*` + `subscription_offer_code_custom_codes_*` + `subscription_offer_code_one_time_use_codes_*` |
| `winback_*` | `subscription_win_back_offers_*` + `subscription_win_back_offer_codes_*` |
| `screenshots_create`/`delete`/`list`/`reorder` | `app_screenshots_*` + `app_screenshot_sets_*` |
| `screenshots_create_preview` / `..._create_preview_set` | `app_previews_*` + `app_preview_sets_*` |
| `custom_pages_*` | `app_custom_product_pages_*` + `app_custom_product_page_versions_*` + `app_custom_product_page_localizations_*` |
| `ppo_*` | `app_store_version_experiments_v2_*` + `app_store_version_experiment_treatments_v2_*` + `app_store_version_experiment_treatment_localizations_*` |
| `promoted_*` | `promoted_purchases_*` + `promoted_purchase_images_*` + `promoted_purchase_versions_*` |
| `provisioning_list_bundle_ids` / `..._get_bundle_id` / `..._create_bundle_id` / `..._delete_bundle_id` | `bundle_ids_{get_collection,get_instance,create_instance,delete_instance}` |
| `provisioning_list_capabilities` | `bundle_ids_bundle_id_capabilities_get_to_many_related` |
| `provisioning_enable_capability` | `bundle_id_capabilities_create_instance` |
| `provisioning_disable_capability` | `bundle_id_capabilities_delete_instance` |
| `provisioning_list_certificates` / `..._get_certificate` | `certificates_{get_collection,get_instance}` |
| `provisioning_revoke_certificate` | `certificates_delete_instance` |
| `provisioning_list_devices` / `..._register_device` / `..._update_device` | `devices_{get_collection,create_instance,update_instance}` |
| `provisioning_list_profiles` / `..._get_profile` / `..._create_profile` / `..._delete_profile` | `profiles_{get_collection,get_instance,create_instance,delete_instance}` |
| `app_info_*` | `app_infos_*` + `app_info_localizations_*` |
| `pricing_list_territories` | `territories_get_collection` |
| `pricing_list_price_points` | `app_price_points_v3_get_collection` |
| `pricing_get_price_schedule` | `app_price_schedules_get_instance` |
| `pricing_set_price_schedule` | `app_price_schedules_create_instance` |
| `pricing_get_availability` | `app_availabilities_v2_get_instance` |
| `pricing_list_territory_availability` | `app_availabilities_v2_available_territories_get_to_many_related` |
| `users_list` / `users_get` / `users_remove` / `users_update` | `users_{get_collection,get_instance,delete_instance,update_instance}` |
| `users_invite` / `users_list_invitations` / `users_cancel_invitation` | `user_invitations_{create_instance,get_collection,delete_instance}` |
| `app_events_*` | `app_events_*` + `app_event_localizations_*` + `app_event_screenshots_*` + `app_event_video_clips_*` |
| `analytics_list_instances` / `..._get_instance` / `..._check_snapshot_status` | `analytics_report_instances_get_collection` / `..._get_instance` |
| `analytics_create_report_request` / `..._list_report_requests` / `..._list_reports` / `..._get_report` / `..._list_segments` | `analytics_report_requests_*` + `analytics_reports_*` + `analytics_report_segments_*` |
| `analytics_app_summary` | No dedicated endpoint — run an analytics report for the `App Store Engagement` metric set. |
| `analytics_sales_report` | `sales_reports_download` (helper) |
| `analytics_financial_report` | `finance_reports_download` (helper) |
| `metrics_app_perf` | `apps_perf_power_metrics_get_to_many_related` |
| `metrics_build_perf` | `builds_perf_power_metrics_get_to_many_related` |
| `metrics_build_diagnostics` | `builds_diagnostic_signatures_get_to_many_related` |
| `metrics_get_diagnostic_logs` | `diagnostic_signatures_logs_get_to_many_related` |

Anything not listed: search the new tool list for the matching Apple `operationId`. The names are all-lowercase snake case with underscores, following the exact spelling used in Apple's REST reference.
