/**
 * API リクエストボディ用の Zod スキーマ定義。
 * バックエンドのルートバリデーションと型推論の両方で利用する。
 */
import { z } from "zod";
import {
  numberField,
  optionalBooleanField,
  optionalNonEmptyString,
  optionalPositiveNumberField,
  optionalString,
  passwordField,
  positiveNumberField,
  requiredString,
} from "./fields.js";
import {
  detailQueryField,
  optionalNonNegativeIntQueryField,
  optionalPositiveIntQueryField,
  searchQueryField,
} from "./queryFields.js";

/** 認証: ユーザー登録リクエストボディ */
export const registerBodySchema = z.object({
  username: requiredString("username", 100),
  password: passwordField("password"),
});

/** 認証: ログインリクエストボディ */
export const loginBodySchema = z.object({
  username: requiredString("username", 100),
  password: requiredString("password", 72),
});

/** 行作成リクエストボディ */
export const createRowBodySchema = z.object({
  title: requiredString("title", 200),
  position: positiveNumberField("position"),
});

/** 行タイトル更新リクエストボディ */
export const updateRowTitleBodySchema = z.object({
  title: requiredString("title", 200),
});

/** カラム作成リクエストボディ */
export const createColumnBodySchema = z.object({
  title: requiredString("title", 200),
  position: positiveNumberField("position"),
  row_id: positiveNumberField("row_id", { integer: true }),
});

/** カラムタイトル更新リクエストボディ */
export const updateColumnTitleBodySchema = z.object({
  title: requiredString("title", 200),
});

/** カラム移動リクエストボディ */
export const moveColumnBodySchema = z.object({
  position: positiveNumberField("position"),
});

/** タスク作成リクエストボディ */
export const createTaskBodySchema = z.object({
  column_id: positiveNumberField("column_id", { integer: true }),
  content: requiredString("content", 2000),
  due_date: z
    .string({
      error: () => "'due_date' must be a string",
    })
    .superRefine((value, ctx) => {
      if (value.trim().length === 0) {
        ctx.addIssue({
          code: "custom",
          message: "'due_date' must not be empty",
        });
      }
      if (value.length > 10) {
        ctx.addIssue({
          code: "custom",
          message: "'due_date' must be 10 characters or fewer",
        });
      }
    })
    .optional(),
  position: positiveNumberField("position", { integer: true }),
});

/** タスク部分更新リクエストボディ */
export const updateTaskBodySchema = z.object({
  content: optionalNonEmptyString("content", 2000),
  due_date: z
    .union([
      z
        .string({
          error: () => "'due_date' must be a string",
        })
        .superRefine((value, ctx) => {
          if (value.trim().length === 0) {
            ctx.addIssue({
              code: "custom",
              message: "'due_date' must not be empty",
            });
          }
          if (value.length > 10) {
            ctx.addIssue({
              code: "custom",
              message: "'due_date' must be 10 characters or fewer",
            });
          }
        }),
      z.null(),
    ])
    .optional(),
  completed: optionalBooleanField("completed"),
});

/** タスク移動リクエストボディ */
export const moveTaskBodySchema = z.object({
  column_id: positiveNumberField("column_id", { integer: true }),
  position: positiveNumberField("position"),
});

/** サブタスク作成リクエストボディ */
export const createSubtaskBodySchema = z.object({
  task_id: positiveNumberField("task_id", { integer: true }),
  content: requiredString("content", 2000),
});

/** サブタスク更新リクエストボディ */
export const updateSubtaskBodySchema = z.object({
  content: requiredString("content", 2000),
});

/** タスクコメント作成リクエストボディ */
export const createTaskCommentBodySchema = z.object({
  task_id: positiveNumberField("task_id", { integer: true }),
  content: requiredString("content", 2000),
});

/** タスクコメント更新リクエストボディ */
export const updateTaskCommentBodySchema = z.object({
  content: optionalNonEmptyString("content", 2000),
  position: optionalPositiveNumberField("position"),
});

/** チェックリスト項目作成リクエストボディ */
export const createChecklistItemBodySchema = z
  .object({
    content: requiredString("content", 500),
    task_id: positiveNumberField("task_id", {
      integer: true,
      required: false,
    }).optional(),
    subtask_id: positiveNumberField("subtask_id", {
      integer: true,
      required: false,
    }).optional(),
  })
  .superRefine((body, ctx) => {
    const hasTaskId = body.task_id !== undefined;
    const hasSubtaskId = body.subtask_id !== undefined;
    if (hasTaskId === hasSubtaskId) {
      ctx.addIssue({
        code: "custom",
        message: "Exactly one of 'task_id' or 'subtask_id' is required",
      });
    }
  });

/** チェックリスト項目更新リクエストボディ */
export const updateChecklistItemBodySchema = z.object({
  content: optionalNonEmptyString("content", 500),
  completed: optionalBooleanField("completed"),
  position: optionalPositiveNumberField("position", { integer: true }),
});

/** メモ作成リクエストボディ */
export const createMemoBodySchema = z.object({
  title: optionalString("title", 255),
  content: optionalString("content", 50000),
});

/** メモ更新リクエストボディ */
export const updateMemoBodySchema = z.object({
  title: optionalString("title", 255),
  content: optionalString("content", 50000),
});

/** メモとタスクの関連付けリクエストボディ */
export const linkMemoTaskBodySchema = z.object({
  task_id: positiveNumberField("task_id", { integer: true }),
});

const taskSnapshotChecklistSchema = z.object({
  id: positiveNumberField("id", { integer: true, required: false }).optional(),
  content: requiredString("content", 500),
  completed: z.boolean({
    error: () => "must be a boolean",
  }),
});

const taskSnapshotSubtaskSchema = z.object({
  id: positiveNumberField("id", { integer: true, required: false }).optional(),
  content: requiredString("content", 2000),
  checklists: z.array(taskSnapshotChecklistSchema),
});

const taskSnapshotCommentSchema = z.object({
  id: positiveNumberField("id", { integer: true, required: false }).optional(),
  content: requiredString("content", 2000),
});

/**
 * 配列内の ID 重複を検証する。
 * @param values - ID を持つオブジェクト配列
 * @param fieldPath - エラーメッセージ用フィールドパス
 * @param ctx - Zod refinement コンテキスト
 */
function ensureNoDuplicateIds(
  values: Array<{ id?: number }>,
  fieldPath: string,
  ctx: z.RefinementCtx,
): void {
  const seen = new Set<number>();
  for (const value of values) {
    if (value.id === undefined) continue;
    if (seen.has(value.id)) {
      ctx.addIssue({
        code: "custom",
        message: `Duplicate '${fieldPath}.id': ${value.id}`,
      });
      return;
    }
    seen.add(value.id);
  }
}

/** タスクスナップショット一括保存リクエストボディ */
export const taskSnapshotBodySchema = z
  .object({
    content: requiredString("content", 2000),
    due_date: z.union([
      z.string({
        error: () => "'due_date' must be a string or null",
      }),
      z.null(),
    ]),
    completed: z
      .boolean({
        error: () => "'completed' must be a boolean",
      })
      .optional()
      .default(false),
    checklists: z.array(taskSnapshotChecklistSchema),
    subtasks: z.array(taskSnapshotSubtaskSchema),
    comments: z.array(taskSnapshotCommentSchema),
  })
  .superRefine((body, ctx) => {
    ensureNoDuplicateIds(body.checklists, "checklists", ctx);
    ensureNoDuplicateIds(body.subtasks, "subtasks", ctx);
    ensureNoDuplicateIds(body.comments, "comments", ctx);
    for (const [index, subtask] of body.subtasks.entries()) {
      ensureNoDuplicateIds(
        subtask.checklists,
        `subtasks[${index}].checklists`,
        ctx,
      );
    }
  });

/** ボード取得 API のクエリパラメータ上限 */
export const MAX_BOARD_LIMIT = 100;

/** ボード検索クエリの最大文字数 */
export const MAX_SEARCH_QUERY_LENGTH = 200;

/** ボード取得 API のクエリパラメータ */
export const boardQuerySchema = z.object({
  row_id: optionalPositiveIntQueryField("row_id"),
  limit: optionalPositiveIntQueryField("limit", { max: MAX_BOARD_LIMIT }),
  offset: optionalNonNegativeIntQueryField("offset"),
  detail: detailQueryField(),
  q: searchQueryField("q", MAX_SEARCH_QUERY_LENGTH),
});

export type RegisterBody = z.infer<typeof registerBodySchema>;
export type LoginBody = z.infer<typeof loginBodySchema>;
export type CreateRowBody = z.infer<typeof createRowBodySchema>;
export type UpdateRowTitleBody = z.infer<typeof updateRowTitleBodySchema>;
export type CreateColumnBody = z.infer<typeof createColumnBodySchema>;
export type UpdateColumnTitleBody = z.infer<typeof updateColumnTitleBodySchema>;
export type MoveColumnBody = z.infer<typeof moveColumnBodySchema>;
export type CreateTaskBody = z.infer<typeof createTaskBodySchema>;
export type UpdateTaskBody = z.infer<typeof updateTaskBodySchema>;
export type MoveTaskBody = z.infer<typeof moveTaskBodySchema>;
export type CreateSubtaskBody = z.infer<typeof createSubtaskBodySchema>;
export type UpdateSubtaskBody = z.infer<typeof updateSubtaskBodySchema>;
export type CreateTaskCommentBody = z.infer<typeof createTaskCommentBodySchema>;
export type UpdateTaskCommentBody = z.infer<typeof updateTaskCommentBodySchema>;
export type CreateChecklistItemBody = z.infer<
  typeof createChecklistItemBodySchema
>;
export type UpdateChecklistItemBody = z.infer<
  typeof updateChecklistItemBodySchema
>;
export type CreateMemoBody = z.infer<typeof createMemoBodySchema>;
export type UpdateMemoBody = z.infer<typeof updateMemoBodySchema>;
export type LinkMemoTaskBody = z.infer<typeof linkMemoTaskBodySchema>;
export type TaskSnapshotBody = z.infer<typeof taskSnapshotBodySchema>;
export type BoardQuery = z.infer<typeof boardQuerySchema>;

/** validate.test.ts 用の汎用スキーマ */
export const validateTestBodySchema = z.object({
  title: requiredString("title", 10_000),
  position: numberField("position"),
});

/** validate.test.ts 用のタイトル最大長スキーマ */
export const validateTestTitleMaxSchema = z.object({
  title: requiredString("title", 10),
});

/** validate.test.ts 用の position スキーマ */
export const validateTestPositionSchema = z.object({
  position: numberField("position"),
});

/** validate.test.ts 用の row_id 整数スキーマ */
export const validateTestRowIdSchema = z.object({
  row_id: positiveNumberField("row_id", { integer: true }),
});

/** validate.test.ts 用の positive position スキーマ */
export const validateTestPositivePositionSchema = z.object({
  position: positiveNumberField("position"),
});

/** validate.test.ts 用の score 範囲スキーマ */
export const validateTestScoreSchema = z.object({
  score: numberField("score").superRefine((value, ctx) => {
    if (value < 0) {
      ctx.addIssue({
        code: "custom",
        message: "'score' must be greater than or equal to 0",
      });
    }
    if (value > 100) {
      ctx.addIssue({
        code: "custom",
        message: "'score' must be less than or equal to 100",
      });
    }
  }),
});

/** validate.test.ts 用の複合数値スキーマ */
export const validateTestRowAndPositionSchema = z.object({
  row_id: positiveNumberField("row_id", { integer: true }),
  position: numberField("position").superRefine((value, ctx) => {
    if (value < 0.5) {
      ctx.addIssue({
        code: "custom",
        message: "'position' must be greater than or equal to 0.5",
      });
    }
    if (value > 10) {
      ctx.addIssue({
        code: "custom",
        message: "'position' must be less than or equal to 10",
      });
    }
  }),
});
