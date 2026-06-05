/**
 * Hand-written overrides that add helpers beyond what the codegen'd
 * operation tools cover. These tools wrap multi-step or non-JSON flows:
 *
 *   - `asset_upload_file`                 — step 2 of ASC's 3-step asset
 *                                           upload protocol (screenshots,
 *                                           previews, review attachments,
 *                                           IAP review screenshots, etc.)
 *                                           Uploads a local file using the
 *                                           `uploadOperations` array Apple
 *                                           returns from the "create" call.
 *   - `sales_reports_download`            — GETs `/v1/salesReports`,
 *                                           decodes gzip, returns TSV as
 *                                           either raw text or parsed rows.
 *   - `finance_reports_download`          — Same for `/v1/financeReports`.
 *   - `analytics_report_instance_wait`    — Polls until an ASC analytics
 *                                           report instance is COMPLETED.
 *   - `ci_build_run_wait`                 — Polls an Xcode Cloud build
 *                                           until its completion status
 *                                           becomes final.
 */

import fs from "node:fs";
import { gunzipSync } from "node:zlib";
import { request as undiciRequest } from "undici";
import { z } from "zod";
import { defineTool, type Tool } from "../utils/tool.js";
import { ascRequest } from "../utils/http.js";

const uploadOperationSchema = z
  .object({
    method: z.string(),
    url: z.string().url(),
    length: z.number().int().positive(),
    offset: z.number().int().nonnegative(),
    requestHeaders: z
      .array(z.object({ name: z.string(), value: z.string() }))
      .optional(),
    expiration: z.string().optional(),
    partNumber: z.number().int().optional(),
    entityTag: z.string().optional(),
  })
  .passthrough();

export const overrideTools: Tool[] = [
  defineTool({
    name: "asset_upload_file",
    description:
      "Upload a local binary file to App Store Connect, following the 3-step asset protocol (screenshots, previews, review attachments, IAP review screenshots, app clip header images, game center images, etc.). This is step 2 (PUTting the chunks); afterwards call the resource's 'update' endpoint with `{ uploaded: true }` to finalise (step 3). PREFERRED usage: pass `assetType` + `assetId` (the just-created asset) and the tool fetches the pre-signed `uploadOperations` server-side — the S3 upload signature never transits MCP output, so it can't be corrupted by secret redaction. Passing `uploadOperations` directly still works but is fragile: a signature relayed through MCP output may have been redacted.",
    input: z
      .object({
        filePath: z
          .string()
          .describe("Absolute path to the file on the local disk."),
        assetType: z
          .string()
          .optional()
          .describe(
            "PREFERRED (with assetId). The asset resource collection to fetch fresh uploadOperations from, e.g. 'appScreenshots', 'appPreviews', 'appStoreReviewAttachments', 'inAppPurchaseAppStoreReviewScreenshots', 'appClipHeaderImages', 'gameCenterAchievementImages'. The tool GETs /v1/{assetType}/{assetId}?fields[{assetType}]=uploadOperations itself.",
          ),
        assetId: z
          .string()
          .optional()
          .describe(
            "PREFERRED (with assetType). Id of the freshly-created AWAITING_UPLOAD asset, e.g. the id returned by app_screenshots_create_instance. Call this BEFORE committing { uploaded: true }.",
          ),
        uploadOperations: z
          .array(uploadOperationSchema)
          .optional()
          .describe(
            "LEGACY fallback. The `uploadOperations` array returned by the resource's 'create' call. Prefer assetType + assetId, which avoids relaying the (redaction-prone) S3 signature through MCP output.",
          ),
      })
      .strict()
      .refine(
        (v) =>
          (Boolean(v.assetType) && Boolean(v.assetId)) ||
          (Array.isArray(v.uploadOperations) && v.uploadOperations.length > 0),
        {
          message:
            "Provide either assetType + assetId (preferred) or a non-empty uploadOperations array.",
        },
      ),
    handler: async ({ filePath, assetType, assetId, uploadOperations }) => {
      if (!fs.existsSync(filePath)) {
        throw new Error(`File not found: ${filePath}`);
      }

      // Preferred path: fetch the pre-signed operations server-side so the S3
      // signature never round-trips through MCP output (where redaction would
      // corrupt it). uploadOperations are only populated while the asset is in
      // AWAITING_UPLOAD — i.e. after `create` and before `{ uploaded: true }`.
      type Op = z.infer<typeof uploadOperationSchema>;
      let ops: Op[] = uploadOperations ?? [];
      if (assetType && assetId) {
        const res = await ascRequest<{
          data?: { attributes?: { uploadOperations?: Op[] } };
        }>({
          method: "GET",
          path: "/v1/{assetType}/{assetId}",
          pathParams: { assetType, assetId },
          query: { fields: { [assetType]: "uploadOperations" } },
        });
        ops = res.body?.data?.attributes?.uploadOperations ?? [];
        if (ops.length === 0) {
          throw new Error(
            `No uploadOperations on /v1/${assetType}/${assetId}: the asset is not AWAITING_UPLOAD (already uploaded?), or the id/type is wrong. Create the asset, then call asset_upload_file before committing { uploaded: true }.`,
          );
        }
      }
      if (ops.length === 0) {
        throw new Error("No uploadOperations to execute.");
      }

      const file = fs.readFileSync(filePath);
      const results: Array<{
        partNumber: number | null;
        status: number;
        etag: string | null;
      }> = [];
      for (const op of ops) {
        const chunk = file.subarray(op.offset, op.offset + op.length);
        const headers: Record<string, string> = {
          "content-length": String(chunk.length),
        };
        for (const h of op.requestHeaders ?? []) {
          headers[h.name.toLowerCase()] = h.value;
        }
        const res = await undiciRequest(op.url, {
          // ASC always specifies "PUT" here; accept whatever Apple sends.
          method: op.method as "PUT" | "POST",
          body: chunk,
          headers,
        });
        const etag = res.headers.etag;
        results.push({
          partNumber: op.partNumber ?? null,
          status: res.statusCode,
          etag: typeof etag === "string" ? etag : null,
        });
        await res.body.dump();
        if (res.statusCode >= 400) {
          throw new Error(
            `Asset upload failed on part ${op.partNumber ?? "?"}: HTTP ${res.statusCode}`,
          );
        }
      }
      return {
        uploaded: true,
        parts: results.length,
        details: results,
        nextStep:
          "Call the resource's 'update' endpoint with `{ uploaded: true }` to commit. Example: app_screenshots_update_instance with body `{ data: { type: 'appScreenshots', id: '<asset-id>', attributes: { uploaded: true } } }`.",
      };
    },
  }),

  defineTool({
    name: "sales_reports_download",
    description:
      "Download a sales report and return its parsed TSV contents. Wraps `GET /v1/salesReports`, decodes the gzip, and optionally parses the TSV into rows. See https://developer.apple.com/documentation/appstoreconnectapi/download_sales_and_trends_reports for filter parameter values.",
    input: z
      .object({
        filter_frequency: z.enum(["DAILY", "WEEKLY", "MONTHLY", "YEARLY"]),
        filter_reportType: z.enum([
          "SALES",
          "PRE_ORDER",
          "NEWSSTAND",
          "SUBSCRIPTION",
          "SUBSCRIPTION_EVENT",
          "SUBSCRIBER",
          "SUBSCRIPTION_OFFER_CODE_REDEMPTION",
          "INSTALLS",
          "FIRST_ANNUAL",
          "WIN_BACK_ELIGIBILITY",
        ]),
        filter_reportSubType: z.enum([
          "SUMMARY",
          "DETAILED",
          "OPT_IN",
          "SUMMARY_INSTALL_TYPE",
          "SUMMARY_TERRITORY",
          "SUMMARY_CHANNEL",
        ]),
        filter_vendorNumber: z.string(),
        filter_reportDate: z.string().optional(),
        filter_version: z.string().optional(),
        parse: z
          .boolean()
          .optional()
          .describe(
            "When true (default), return `{ rows: [...] }` parsed from the TSV. When false, return the raw TSV string.",
          ),
      })
      .strict(),
    handler: async (args) => {
      const { parse = true, ...flat } = args;
      const res = await ascRequest({
        method: "GET",
        path: "/v1/salesReports",
        query: {
          "filter[frequency]": flat.filter_frequency,
          "filter[reportType]": flat.filter_reportType,
          "filter[reportSubType]": flat.filter_reportSubType,
          "filter[vendorNumber]": flat.filter_vendorNumber,
          "filter[reportDate]": flat.filter_reportDate,
          "filter[version]": flat.filter_version,
        },
        accept: "application/a-gzip",
        raw: true,
      });
      const gz = res.body as Buffer;
      const tsv = gunzipSync(gz).toString("utf8");
      if (!parse) return { tsv };
      const rows = parseTsv(tsv);
      return { rowCount: rows.length, rows };
    },
  }),

  defineTool({
    name: "finance_reports_download",
    description:
      "Download a financial report and return its parsed TSV contents. Wraps `GET /v1/financeReports`, decodes the gzip, and optionally parses the TSV into rows.",
    input: z
      .object({
        filter_regionCode: z.string(),
        filter_reportDate: z.string(),
        filter_reportType: z.enum(["FINANCIAL", "FINANCE_DETAIL"]),
        filter_vendorNumber: z.string(),
        parse: z
          .boolean()
          .optional()
          .describe(
            "When true (default), return `{ rows: [...] }` parsed from the TSV. When false, return the raw TSV string.",
          ),
      })
      .strict(),
    handler: async (args) => {
      const { parse = true, ...flat } = args;
      const res = await ascRequest({
        method: "GET",
        path: "/v1/financeReports",
        query: {
          "filter[regionCode]": flat.filter_regionCode,
          "filter[reportDate]": flat.filter_reportDate,
          "filter[reportType]": flat.filter_reportType,
          "filter[vendorNumber]": flat.filter_vendorNumber,
        },
        accept: "application/a-gzip",
        raw: true,
      });
      const gz = res.body as Buffer;
      const tsv = gunzipSync(gz).toString("utf8");
      if (!parse) return { tsv };
      const rows = parseTsv(tsv);
      return { rowCount: rows.length, rows };
    },
  }),

  defineTool({
    name: "analytics_report_instance_wait",
    description:
      "Poll an analytics report instance until it reaches a terminal state (COMPLETED or FAILED) or a timeout expires. Returns the final instance payload.",
    input: z
      .object({
        id: z.string(),
        timeoutMs: z.number().int().positive().optional(),
        pollIntervalMs: z.number().int().positive().optional(),
      })
      .strict(),
    handler: async ({
      id,
      timeoutMs = 10 * 60_000,
      pollIntervalMs = 15_000,
    }) => {
      const deadline = Date.now() + timeoutMs;
      while (true) {
        const res = await ascRequest<{
          data: { attributes?: { processingState?: string } };
        }>({
          method: "GET",
          path: "/v1/analyticsReportInstances/{id}",
          pathParams: { id },
        });
        const state = res.body.data?.attributes?.processingState;
        if (state === "COMPLETED" || state === "FAILED") {
          return res.body;
        }
        if (Date.now() >= deadline) {
          return {
            ...res.body,
            timedOut: true,
            lastProcessingState: state ?? null,
          };
        }
        await new Promise((r) => setTimeout(r, pollIntervalMs));
      }
    },
  }),

  defineTool({
    name: "ci_build_run_wait",
    description:
      "Poll an Xcode Cloud build run until it reaches a terminal completion status, or a timeout expires.",
    input: z
      .object({
        id: z.string(),
        timeoutMs: z.number().int().positive().optional(),
        pollIntervalMs: z.number().int().positive().optional(),
      })
      .strict(),
    handler: async ({
      id,
      timeoutMs = 60 * 60_000,
      pollIntervalMs = 30_000,
    }) => {
      const deadline = Date.now() + timeoutMs;
      const terminal = new Set([
        "SUCCEEDED",
        "FAILED",
        "ERRORED",
        "CANCELED",
        "SKIPPED",
      ]);
      while (true) {
        const res = await ascRequest<{
          data: {
            attributes?: { completionStatus?: string; executionProgress?: string };
          };
        }>({
          method: "GET",
          path: "/v1/ciBuildRuns/{id}",
          pathParams: { id },
        });
        const completion = res.body.data?.attributes?.completionStatus;
        const progress = res.body.data?.attributes?.executionProgress;
        if (progress === "COMPLETE" || (completion && terminal.has(completion))) {
          return res.body;
        }
        if (Date.now() >= deadline) {
          return {
            ...res.body,
            timedOut: true,
            lastCompletionStatus: completion ?? null,
            lastExecutionProgress: progress ?? null,
          };
        }
        await new Promise((r) => setTimeout(r, pollIntervalMs));
      }
    },
  }),
];

function parseTsv(tsv: string): Array<Record<string, string>> {
  const lines = tsv.split(/\r?\n/).filter((l) => l.length > 0);
  if (lines.length === 0) return [];
  const firstLine = lines[0];
  if (!firstLine) return [];
  const headers = firstLine.split("\t");
  const rows: Array<Record<string, string>> = [];
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (!line) continue;
    const cells = line.split("\t");
    const row: Record<string, string> = {};
    headers.forEach((h, idx) => {
      row[h] = cells[idx] ?? "";
    });
    rows.push(row);
  }
  return rows;
}
