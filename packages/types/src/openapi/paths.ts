/**
 * OpenAPI パス定義モジュール。
 */
import type { OpenAPIRegistry } from "@asteasolutions/zod-to-openapi";
import { z } from "./setup.js";
import {
  AuthStatusResponse,
  Column,
  DbChecklistItem,
  DbSubtask,
  DbTaskComment,
  HealthResponse,
  LivenessResponse,
  Memo,
  OkResponse,
  Row,
  Subtask,
  SuccessResponse,
  Task,
  authenticatedSecurity,
  jsonResponse,
  pathIdParam,
  pathTaskIdParam,
  registerComponents,
  standardErrors,
} from "./components.js";
import {
  createChecklistItemBodySchema,
  createColumnBodySchema,
  createMemoBodySchema,
  createRowBodySchema,
  createSubtaskBodySchema,
  createTaskBodySchema,
  createTaskCommentBodySchema,
  linkMemoTaskBodySchema,
  loginBodySchema,
  moveColumnBodySchema,
  moveTaskBodySchema,
  registerBodySchema,
  taskSnapshotBodySchema,
  updateChecklistItemBodySchema,
  updateColumnTitleBodySchema,
  updateMemoBodySchema,
  updateRowTitleBodySchema,
  updateSubtaskBodySchema,
  updateTaskBodySchema,
  updateTaskCommentBodySchema,
} from "../validation/schemas.js";

/**
 * 全 API エンドポイントの OpenAPI パス定義を登録する。
 * @param registry - OpenAPI レジストリ
 */
export function registerPaths(registry: OpenAPIRegistry): void {
  registerComponents(registry);

  // ── ヘルスチェック ──────────────────────────────────────────────────────

  registry.registerPath({
    method: "get",
    path: "/api/health",
    summary: "ヘルスチェック",
    description: "API の稼働状態と DB 疎通を確認する。",
    tags: ["System"],
    responses: {
      200: jsonResponse(HealthResponse, "正常"),
      503: jsonResponse(HealthResponse, "DB 接続エラー"),
    },
  });

  registry.registerPath({
    method: "get",
    path: "/api/liveness",
    summary: "ライブネスチェック",
    description: "コンテナが応答可能かを確認する。",
    tags: ["System"],
    responses: {
      200: jsonResponse(LivenessResponse, "応答可能"),
    },
  });

  // ── 認証 ────────────────────────────────────────────────────────────────

  registry.registerPath({
    method: "get",
    path: "/api/auth/status",
    summary: "ユーザー登録状態の確認",
    description:
      "ユーザーが1人以上登録されているかを返す。初回セットアップ画面の判定に使用する。",
    tags: ["Auth"],
    responses: {
      200: jsonResponse(AuthStatusResponse, "登録状態"),
    },
  });

  registry.registerPath({
    method: "post",
    path: "/api/auth/register",
    summary: "ユーザー登録",
    description:
      "新規ユーザーを登録し JWT を HttpOnly Cookie にセットする。パスワードは12文字以上。",
    tags: ["Auth"],
    request: {
      body: {
        content: { "application/json": { schema: registerBodySchema } },
      },
    },
    responses: {
      201: jsonResponse(OkResponse, "登録成功"),
      400: standardErrors[400],
      409: standardErrors[409],
      503: standardErrors[503],
    },
  });

  registry.registerPath({
    method: "post",
    path: "/api/auth/login",
    summary: "ログイン",
    description:
      "ユーザー名とパスワードを検証し JWT を HttpOnly Cookie にセットする。",
    tags: ["Auth"],
    request: {
      body: {
        content: { "application/json": { schema: loginBodySchema } },
      },
    },
    responses: {
      200: jsonResponse(OkResponse, "ログイン成功"),
      400: standardErrors[400],
      401: standardErrors[401],
      503: standardErrors[503],
    },
  });

  registry.registerPath({
    method: "post",
    path: "/api/auth/logout",
    summary: "ログアウト",
    description: "HttpOnly Cookie を削除してログアウトする。",
    tags: ["Auth"],
    responses: {
      200: jsonResponse(OkResponse, "ログアウト成功"),
    },
  });

  registry.registerPath({
    method: "get",
    path: "/api/auth/verify",
    summary: "認証状態の確認",
    description: "Cookie / Bearer トークンを検証し、認証済みなら 200 を返す。",
    tags: ["Auth"],
    security: authenticatedSecurity,
    responses: {
      200: jsonResponse(OkResponse, "認証済み"),
      401: standardErrors[401],
      503: standardErrors[503],
    },
  });

  // ── ボード ──────────────────────────────────────────────────────────────

  registry.registerPath({
    method: "get",
    path: "/api/board",
    summary: "ボード全体の取得",
    description:
      "行・カラム・タスク・サブタスク・チェックリスト・コメントを階層構造で返す。",
    tags: ["Board"],
    security: authenticatedSecurity,
    request: {
      query: z.object({
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
            description: "取得件数の上限(最大 100)",
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
          .max(200)
          .optional()
          .openapi({
            param: { name: "q", in: "query" },
            description:
              "横断検索キーワード(指定時は一致タスクのみフル詳細で返す)",
          }),
      }),
    },
    responses: {
      200: jsonResponse(z.array(Row), "ボード階層データ"),
      400: standardErrors[400],
      401: standardErrors[401],
    },
  });

  // ── 行 ──────────────────────────────────────────────────────────────────

  registry.registerPath({
    method: "post",
    path: "/api/rows",
    summary: "行の作成",
    tags: ["Rows"],
    security: authenticatedSecurity,
    request: {
      body: {
        content: { "application/json": { schema: createRowBodySchema } },
      },
    },
    responses: {
      200: jsonResponse(Row, "作成した行"),
      400: standardErrors[400],
      401: standardErrors[401],
    },
  });

  registry.registerPath({
    method: "post",
    path: "/api/rows/with-default-columns",
    summary: "行とデフォルトカラムの一括作成",
    description: "「未着手 / 進行中 / 完了」の3カラムを同時に作成する。",
    tags: ["Rows"],
    security: authenticatedSecurity,
    request: {
      body: {
        content: { "application/json": { schema: createRowBodySchema } },
      },
    },
    responses: {
      200: jsonResponse(Row, "デフォルトカラム付きの行"),
      400: standardErrors[400],
      401: standardErrors[401],
    },
  });

  registry.registerPath({
    method: "put",
    path: "/api/rows/{id}",
    summary: "行タイトルの更新",
    tags: ["Rows"],
    security: authenticatedSecurity,
    request: {
      params: z.object({ id: pathIdParam }),
      body: {
        content: {
          "application/json": { schema: updateRowTitleBodySchema },
        },
      },
    },
    responses: {
      200: jsonResponse(Row, "更新後の行"),
      400: standardErrors[400],
      401: standardErrors[401],
      404: standardErrors[404],
    },
  });

  registry.registerPath({
    method: "delete",
    path: "/api/rows/{id}",
    summary: "行の削除",
    description: "配下のカラム・タスクも CASCADE で削除される。",
    tags: ["Rows"],
    security: authenticatedSecurity,
    request: { params: z.object({ id: pathIdParam }) },
    responses: {
      200: jsonResponse(SuccessResponse, "削除成功"),
      400: standardErrors[400],
      401: standardErrors[401],
      404: standardErrors[404],
    },
  });

  // ── カラム ──────────────────────────────────────────────────────────────

  registry.registerPath({
    method: "post",
    path: "/api/columns",
    summary: "カラムの作成",
    tags: ["Columns"],
    security: authenticatedSecurity,
    request: {
      body: {
        content: { "application/json": { schema: createColumnBodySchema } },
      },
    },
    responses: {
      200: jsonResponse(Column, "作成したカラム"),
      400: standardErrors[400],
      401: standardErrors[401],
      404: standardErrors[404],
    },
  });

  registry.registerPath({
    method: "put",
    path: "/api/columns/{id}",
    summary: "カラムタイトルの更新",
    tags: ["Columns"],
    security: authenticatedSecurity,
    request: {
      params: z.object({ id: pathIdParam }),
      body: {
        content: {
          "application/json": { schema: updateColumnTitleBodySchema },
        },
      },
    },
    responses: {
      200: jsonResponse(Column, "更新後のカラム"),
      400: standardErrors[400],
      401: standardErrors[401],
      404: standardErrors[404],
    },
  });

  registry.registerPath({
    method: "put",
    path: "/api/columns/{id}/move",
    summary: "カラムの並び替え",
    tags: ["Columns"],
    security: authenticatedSecurity,
    request: {
      params: z.object({ id: pathIdParam }),
      body: {
        content: { "application/json": { schema: moveColumnBodySchema } },
      },
    },
    responses: {
      200: jsonResponse(Column, "移動後のカラム"),
      400: standardErrors[400],
      401: standardErrors[401],
      404: standardErrors[404],
    },
  });

  registry.registerPath({
    method: "delete",
    path: "/api/columns/{id}",
    summary: "カラムの削除",
    description: "配下のタスクも CASCADE で削除される。",
    tags: ["Columns"],
    security: authenticatedSecurity,
    request: { params: z.object({ id: pathIdParam }) },
    responses: {
      200: jsonResponse(SuccessResponse, "削除成功"),
      400: standardErrors[400],
      401: standardErrors[401],
      404: standardErrors[404],
    },
  });

  // ── タスク ──────────────────────────────────────────────────────────────

  registry.registerPath({
    method: "post",
    path: "/api/tasks",
    summary: "タスクの作成",
    tags: ["Tasks"],
    security: authenticatedSecurity,
    request: {
      body: {
        content: { "application/json": { schema: createTaskBodySchema } },
      },
    },
    responses: {
      200: jsonResponse(Task, "作成したタスク"),
      400: standardErrors[400],
      401: standardErrors[401],
      404: standardErrors[404],
    },
  });

  registry.registerPath({
    method: "get",
    path: "/api/tasks/{id}",
    summary: "タスク詳細の取得",
    description: "サブタスク・チェックリスト・コメントを含むタスク詳細を返す。",
    tags: ["Tasks"],
    security: authenticatedSecurity,
    request: {
      params: z.object({ id: pathIdParam }),
    },
    responses: {
      200: jsonResponse(Task, "タスク詳細"),
      400: standardErrors[400],
      401: standardErrors[401],
      404: standardErrors[404],
    },
  });

  registry.registerPath({
    method: "put",
    path: "/api/tasks/{id}",
    summary: "タスクの部分更新",
    description: "content / due_date / completed のいずれか1つ以上を指定する。",
    tags: ["Tasks"],
    security: authenticatedSecurity,
    request: {
      params: z.object({ id: pathIdParam }),
      body: {
        content: { "application/json": { schema: updateTaskBodySchema } },
      },
    },
    responses: {
      200: jsonResponse(Task, "更新後のタスク"),
      400: standardErrors[400],
      401: standardErrors[401],
      404: standardErrors[404],
    },
  });

  registry.registerPath({
    method: "put",
    path: "/api/tasks/{id}/snapshot",
    summary: "タスク編集内容の一括保存",
    description:
      "タスク本文・期限・サブタスク・チェックリスト・コメントを単一トランザクションで保存する。",
    tags: ["Tasks"],
    security: authenticatedSecurity,
    request: {
      params: z.object({ id: pathIdParam }),
      body: {
        content: { "application/json": { schema: taskSnapshotBodySchema } },
      },
    },
    responses: {
      200: jsonResponse(Task, "保存後のタスク"),
      400: standardErrors[400],
      401: standardErrors[401],
      404: standardErrors[404],
    },
  });

  registry.registerPath({
    method: "put",
    path: "/api/tasks/{id}/move",
    summary: "タスクの移動",
    tags: ["Tasks"],
    security: authenticatedSecurity,
    request: {
      params: z.object({ id: pathIdParam }),
      body: {
        content: { "application/json": { schema: moveTaskBodySchema } },
      },
    },
    responses: {
      200: jsonResponse(Task, "移動後のタスク"),
      400: standardErrors[400],
      401: standardErrors[401],
      404: standardErrors[404],
    },
  });

  registry.registerPath({
    method: "post",
    path: "/api/tasks/{id}/copy",
    summary: "タスクのコピー",
    tags: ["Tasks"],
    security: authenticatedSecurity,
    request: { params: z.object({ id: pathIdParam }) },
    responses: {
      201: jsonResponse(Task, "コピーしたタスク"),
      400: standardErrors[400],
      401: standardErrors[401],
      404: standardErrors[404],
    },
  });

  registry.registerPath({
    method: "delete",
    path: "/api/tasks/{id}",
    summary: "タスクの削除",
    tags: ["Tasks"],
    security: authenticatedSecurity,
    request: { params: z.object({ id: pathIdParam }) },
    responses: {
      200: jsonResponse(SuccessResponse, "削除成功"),
      400: standardErrors[400],
      401: standardErrors[401],
      404: standardErrors[404],
    },
  });

  // ── サブタスク ──────────────────────────────────────────────────────────

  registry.registerPath({
    method: "post",
    path: "/api/subtasks",
    summary: "サブタスクの作成",
    tags: ["Subtasks"],
    security: authenticatedSecurity,
    request: {
      body: {
        content: { "application/json": { schema: createSubtaskBodySchema } },
      },
    },
    responses: {
      200: jsonResponse(Subtask, "作成したサブタスク"),
      400: standardErrors[400],
      401: standardErrors[401],
      404: standardErrors[404],
    },
  });

  registry.registerPath({
    method: "put",
    path: "/api/subtasks/{id}",
    summary: "サブタスクの更新",
    tags: ["Subtasks"],
    security: authenticatedSecurity,
    request: {
      params: z.object({ id: pathIdParam }),
      body: {
        content: { "application/json": { schema: updateSubtaskBodySchema } },
      },
    },
    responses: {
      200: jsonResponse(DbSubtask, "更新後のサブタスク"),
      400: standardErrors[400],
      401: standardErrors[401],
      404: standardErrors[404],
    },
  });

  registry.registerPath({
    method: "delete",
    path: "/api/subtasks/{id}",
    summary: "サブタスクの削除",
    tags: ["Subtasks"],
    security: authenticatedSecurity,
    request: { params: z.object({ id: pathIdParam }) },
    responses: {
      200: jsonResponse(SuccessResponse, "削除成功"),
      400: standardErrors[400],
      401: standardErrors[401],
      404: standardErrors[404],
    },
  });

  // ── タスクコメント ──────────────────────────────────────────────────────

  registry.registerPath({
    method: "post",
    path: "/api/task-comments",
    summary: "タスクコメントの作成",
    tags: ["TaskComments"],
    security: authenticatedSecurity,
    request: {
      body: {
        content: {
          "application/json": { schema: createTaskCommentBodySchema },
        },
      },
    },
    responses: {
      200: jsonResponse(DbTaskComment, "作成したコメント"),
      400: standardErrors[400],
      401: standardErrors[401],
      404: standardErrors[404],
    },
  });

  registry.registerPath({
    method: "put",
    path: "/api/task-comments/{id}",
    summary: "タスクコメントの更新",
    tags: ["TaskComments"],
    security: authenticatedSecurity,
    request: {
      params: z.object({ id: pathIdParam }),
      body: {
        content: {
          "application/json": { schema: updateTaskCommentBodySchema },
        },
      },
    },
    responses: {
      200: jsonResponse(DbTaskComment, "更新後のコメント"),
      400: standardErrors[400],
      401: standardErrors[401],
      404: standardErrors[404],
    },
  });

  registry.registerPath({
    method: "delete",
    path: "/api/task-comments/{id}",
    summary: "タスクコメントの削除",
    tags: ["TaskComments"],
    security: authenticatedSecurity,
    request: { params: z.object({ id: pathIdParam }) },
    responses: {
      200: jsonResponse(SuccessResponse, "削除成功"),
      400: standardErrors[400],
      401: standardErrors[401],
      404: standardErrors[404],
    },
  });

  // ── チェックリスト ──────────────────────────────────────────────────────

  registry.registerPath({
    method: "post",
    path: "/api/checklist-items",
    summary: "チェックリスト項目の作成",
    description: "task_id または subtask_id のどちらか一方のみ必須。",
    tags: ["ChecklistItems"],
    security: authenticatedSecurity,
    request: {
      body: {
        content: {
          "application/json": { schema: createChecklistItemBodySchema },
        },
      },
    },
    responses: {
      200: jsonResponse(DbChecklistItem, "作成した項目"),
      400: standardErrors[400],
      401: standardErrors[401],
      404: standardErrors[404],
    },
  });

  registry.registerPath({
    method: "put",
    path: "/api/checklist-items/{id}",
    summary: "チェックリスト項目の更新",
    tags: ["ChecklistItems"],
    security: authenticatedSecurity,
    request: {
      params: z.object({ id: pathIdParam }),
      body: {
        content: {
          "application/json": { schema: updateChecklistItemBodySchema },
        },
      },
    },
    responses: {
      200: jsonResponse(DbChecklistItem, "更新後の項目"),
      400: standardErrors[400],
      401: standardErrors[401],
      404: standardErrors[404],
    },
  });

  registry.registerPath({
    method: "delete",
    path: "/api/checklist-items/{id}",
    summary: "チェックリスト項目の削除",
    tags: ["ChecklistItems"],
    security: authenticatedSecurity,
    request: { params: z.object({ id: pathIdParam }) },
    responses: {
      200: jsonResponse(SuccessResponse, "削除成功"),
      400: standardErrors[400],
      401: standardErrors[401],
      404: standardErrors[404],
    },
  });

  // ── メモ ────────────────────────────────────────────────────────────────

  registry.registerPath({
    method: "get",
    path: "/api/memos",
    summary: "メモ一覧の取得",
    tags: ["Memos"],
    security: authenticatedSecurity,
    responses: {
      200: jsonResponse(z.array(Memo), "メモ一覧"),
      401: standardErrors[401],
    },
  });

  registry.registerPath({
    method: "post",
    path: "/api/memos",
    summary: "メモの作成",
    tags: ["Memos"],
    security: authenticatedSecurity,
    request: {
      body: {
        content: { "application/json": { schema: createMemoBodySchema } },
      },
    },
    responses: {
      201: jsonResponse(Memo, "作成したメモ"),
      400: standardErrors[400],
      401: standardErrors[401],
    },
  });

  registry.registerPath({
    method: "put",
    path: "/api/memos/{id}",
    summary: "メモの更新",
    tags: ["Memos"],
    security: authenticatedSecurity,
    request: {
      params: z.object({ id: pathIdParam }),
      body: {
        content: { "application/json": { schema: updateMemoBodySchema } },
      },
    },
    responses: {
      200: jsonResponse(Memo, "更新後のメモ"),
      400: standardErrors[400],
      401: standardErrors[401],
      404: standardErrors[404],
    },
  });

  registry.registerPath({
    method: "delete",
    path: "/api/memos/{id}",
    summary: "メモの削除",
    tags: ["Memos"],
    security: authenticatedSecurity,
    request: { params: z.object({ id: pathIdParam }) },
    responses: {
      204: { description: "削除成功(ボディなし)" },
      400: standardErrors[400],
      401: standardErrors[401],
      404: standardErrors[404],
    },
  });

  registry.registerPath({
    method: "post",
    path: "/api/memos/{id}/tasks",
    summary: "メモとタスクの関連付け",
    tags: ["Memos"],
    security: authenticatedSecurity,
    request: {
      params: z.object({ id: pathIdParam }),
      body: {
        content: { "application/json": { schema: linkMemoTaskBodySchema } },
      },
    },
    responses: {
      200: jsonResponse(Memo, "関連付け後のメモ"),
      400: standardErrors[400],
      401: standardErrors[401],
      404: standardErrors[404],
    },
  });

  registry.registerPath({
    method: "delete",
    path: "/api/memos/{id}/tasks/{taskId}",
    summary: "メモとタスクの関連付け解除",
    tags: ["Memos"],
    security: authenticatedSecurity,
    request: {
      params: z.object({ id: pathIdParam, taskId: pathTaskIdParam }),
    },
    responses: {
      200: jsonResponse(Memo, "関連付け解除後のメモ"),
      400: standardErrors[400],
      401: standardErrors[401],
      404: standardErrors[404],
    },
  });
}
