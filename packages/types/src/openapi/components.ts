/**
 * OpenAPI components(スキーマ・セキュリティ定義)を登録する。
 */
import { OpenAPIRegistry } from "@asteasolutions/zod-to-openapi";
import { z } from "./setup.js";
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

/** パスパラメータ用の正の整数 ID。 */
export const pathIdParam = z
  .string()
  .regex(/^\d+$/)
  .openapi({ param: { name: "id", in: "path" }, example: "1" });

/** パスパラメータ用のタスク ID。 */
export const pathTaskIdParam = z
  .string()
  .regex(/^\d+$/)
  .openapi({ param: { name: "taskId", in: "path" }, example: "1" });

export const ErrorResponse = z
  .object({
    error: z.string().openapi({ example: "Invalid ID" }),
  })
  .openapi("ErrorResponse");

export const OkResponse = z
  .object({
    ok: z.boolean().openapi({ example: true }),
  })
  .openapi("OkResponse");

export const SuccessResponse = z
  .object({
    success: z.boolean().openapi({ example: true }),
  })
  .openapi("SuccessResponse");

export const AuthStatusResponse = z
  .object({
    hasUsers: z.boolean().openapi({ example: true }),
  })
  .openapi("AuthStatusResponse");

export const HealthResponse = z
  .object({
    status: z.enum(["ok", "error"]).openapi({ example: "ok" }),
  })
  .openapi("HealthResponse");

export const LivenessResponse = z
  .object({
    status: z.literal("alive").openapi({ example: "alive" }),
  })
  .openapi("LivenessResponse");

export const ChecklistItem = z
  .object({
    id: z.number().int(),
    task_id: z.number().int().nullable(),
    subtask_id: z.number().int().nullable(),
    content: z.string(),
    completed: z.boolean(),
    position: z.number(),
  })
  .openapi("ChecklistItem");

export const TaskComment = z
  .object({
    id: z.number().int(),
    task_id: z.number().int(),
    content: z.string(),
    created_at: z.string().datetime(),
    position: z.number(),
  })
  .openapi("TaskComment");

export const Subtask = z
  .object({
    id: z.number().int(),
    task_id: z.number().int(),
    content: z.string(),
    checklists: z.array(ChecklistItem),
  })
  .openapi("Subtask");

export const Task = z
  .object({
    id: z.number().int(),
    column_id: z.number().int(),
    content: z.string(),
    due_date: z.string().nullable(),
    position: z.number(),
    completed: z.boolean(),
    revision: z.number().int(),
    subtasks: z.array(Subtask),
    checklists: z.array(ChecklistItem),
    comments: z.array(TaskComment),
  })
  .openapi("Task");

export const Column = z
  .object({
    id: z.number().int(),
    title: z.string(),
    position: z.number(),
    row_id: z.number().int(),
    tasks: z.array(Task).optional(),
  })
  .openapi("Column");

export const PositionUpdate = z
  .object({
    id: z.number().int(),
    position: z.number(),
  })
  .openapi("PositionUpdate");

const rebalancedField = z
  .array(PositionUpdate)
  .optional()
  .openapi({
    description:
      "position の衝突で並び全体が 1000 刻みに振り直された場合のみ含まれる、他アイテムの新しい position。",
  });

export const TaskWithRebalance = Task.extend({
  rebalanced: rebalancedField,
}).openapi("TaskWithRebalance");

export const ColumnWithRebalance = Column.extend({
  rebalanced: rebalancedField,
}).openapi("ColumnWithRebalance");

export const Row = z
  .object({
    id: z.number().int(),
    title: z.string(),
    position: z.number(),
    columns: z.array(Column).optional(),
  })
  .openapi("Row");

export const DbSubtask = z
  .object({
    id: z.number().int(),
    task_id: z.number().int(),
    content: z.string(),
  })
  .openapi("DbSubtask");

export const DbChecklistItem = z
  .object({
    id: z.number().int(),
    task_id: z.number().int().nullable(),
    subtask_id: z.number().int().nullable(),
    content: z.string(),
    completed: z.boolean(),
    position: z.number(),
  })
  .openapi("DbChecklistItem");

export const DbTaskComment = z
  .object({
    id: z.number().int(),
    task_id: z.number().int(),
    content: z.string(),
    created_at: z.string().datetime(),
    position: z.number(),
  })
  .openapi("DbTaskComment");

export const MemoTaskLink = z
  .object({
    id: z.number().int(),
    content: z.string(),
  })
  .openapi("MemoTaskLink");

export const Memo = z
  .object({
    id: z.number().int(),
    user_id: z.number().int(),
    title: z.string(),
    content: z.string(),
    created_at: z.string().datetime(),
    updated_at: z.string().datetime(),
    tasks: z.array(MemoTaskLink),
  })
  .openapi("Memo");

const requestBodySchemas = {
  RegisterBody: registerBodySchema,
  LoginBody: loginBodySchema,
  CreateRowBody: createRowBodySchema,
  UpdateRowTitleBody: updateRowTitleBodySchema,
  CreateColumnBody: createColumnBodySchema,
  UpdateColumnTitleBody: updateColumnTitleBodySchema,
  MoveColumnBody: moveColumnBodySchema,
  CreateTaskBody: createTaskBodySchema,
  UpdateTaskBody: updateTaskBodySchema,
  MoveTaskBody: moveTaskBodySchema,
  TaskSnapshotBody: taskSnapshotBodySchema,
  CreateSubtaskBody: createSubtaskBodySchema,
  UpdateSubtaskBody: updateSubtaskBodySchema,
  CreateTaskCommentBody: createTaskCommentBodySchema,
  UpdateTaskCommentBody: updateTaskCommentBodySchema,
  CreateChecklistItemBody: createChecklistItemBodySchema,
  UpdateChecklistItemBody: updateChecklistItemBodySchema,
  CreateMemoBody: createMemoBodySchema,
  UpdateMemoBody: updateMemoBodySchema,
  LinkMemoTaskBody: linkMemoTaskBodySchema,
} as const;

/**
 * 共有コンポーネントとセキュリティスキームをレジストリへ登録する。
 * @param registry - OpenAPI レジストリ
 */
export function registerComponents(registry: OpenAPIRegistry): void {
  for (const [name, schema] of Object.entries(requestBodySchemas)) {
    registry.register(name, schema);
  }

  registry.registerComponent("securitySchemes", "cookieAuth", {
    type: "apiKey",
    in: "cookie",
    name: "token",
    description: "HttpOnly JWT Cookie(推奨)",
  });

  registry.registerComponent("securitySchemes", "bearerAuth", {
    type: "http",
    scheme: "bearer",
    bearerFormat: "JWT",
    description: "Authorization: Bearer <token> ヘッダー(フォールバック)",
  });
}

/** 認証が必要なエンドポイント向けのセキュリティ定義(Cookie または Bearer)。 */
export const authenticatedSecurity: Array<Record<string, string[]>> = [
  { cookieAuth: [] },
  { bearerAuth: [] },
];

/** JSON レスポンス定義を生成する。
 * @param schema - レスポンスボディの Zod スキーマ
 * @param description - OpenAPI レスポンス説明
 * @returns OpenAPI JSON レスポンス定義オブジェクト
 */
export function jsonResponse(
  schema: z.ZodType,
  description: string,
): {
  description: string;
  content: { "application/json": { schema: z.ZodType } };
} {
  return {
    description,
    content: {
      "application/json": { schema },
    },
  };
}

/** よく使うエラーレスポンス群。 */
export const standardErrors = {
  400: jsonResponse(ErrorResponse, "リクエストが不正"),
  401: jsonResponse(ErrorResponse, "未認証"),
  403: jsonResponse(ErrorResponse, "禁止"),
  404: jsonResponse(ErrorResponse, "リソースが見つからない"),
  409: jsonResponse(ErrorResponse, "競合"),
  503: jsonResponse(ErrorResponse, "サービス利用不可"),
};
