/**
 * GET /api/board の OpenAPI クエリパラメータ定義。
 * ランタイム検証は `boardQuerySchema` が担当する。
 */
import { z } from "../openapi/setup.js";
import { MAX_BOARD_LIMIT, MAX_SEARCH_QUERY_LENGTH } from "./schemas.js";

/** OpenAPI 用のボード取得クエリパラメータスキーマ。 */
export const boardQueryOpenApiSchema = z.object({
  row_id: z
    .string()
    .regex(/^\d+$/)
    .optional()
    .openapi({ param: { name: "row_id", in: "query" }, example: "1" }),
  limit: z
    .string()
    .regex(/^\d+$/)
    .optional()
    .openapi({
      param: { name: "limit", in: "query" },
      example: "20",
      description: `取得件数の上限(最大 ${MAX_BOARD_LIMIT})`,
    }),
  offset: z
    .string()
    .regex(/^\d+$/)
    .optional()
    .openapi({
      param: { name: "offset", in: "query" },
      example: "0",
      description: "スキップする件数",
    }),
  detail: z
    .enum(["summary", "full"])
    .optional()
    .openapi({
      param: { name: "detail", in: "query" },
      description: "取得詳細度。既定は summary(子要素は件数のみ、軽量)",
    }),
  q: z
    .string()
    .max(MAX_SEARCH_QUERY_LENGTH)
    .optional()
    .openapi({
      param: { name: "q", in: "query" },
      description: "横断検索キーワード(指定時は一致タスクのみフル詳細で返す)",
    }),
});
