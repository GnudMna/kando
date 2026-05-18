// タスクに対する CRUD・移動エンドポイントを定義するルーター
import { Router, Request, Response, NextFunction } from "express";
import type { PoolClient } from "pg";
import { pool } from "../db.js";
import type {
  DbTask,
  Task,
  TaskSnapshotChecklistPayload,
  TaskSnapshotSubtaskPayload,
  TaskSnapshotCommentPayload,
  TaskSnapshotPayload,
} from "@kando/types";
import { parseId, validateBody } from "../middleware/validate.js";
import { HttpError, NotFoundError } from "../errors.js";

const router = Router();
const TASK_RETURNING_COLUMNS =
  "id, column_id, content, due_date::text AS due_date, position, completed";

const DATE_ONLY_RE = /^\d{4}-\d{2}-\d{2}$/;

type TaskSnapshotChecklistInput = TaskSnapshotChecklistPayload;
type TaskSnapshotSubtaskInput = TaskSnapshotSubtaskPayload;
type TaskSnapshotCommentInput = TaskSnapshotCommentPayload;

/**
 * 期限日を `YYYY-MM-DD` の厳密形式で検証する。
 * 未指定/`null` はそのまま返し、明示指定時のみバリデーションする。
 * @param rawDueDate - 受信した期限日
 * @returns 検証済み期限日。未指定/`null` は入力値を維持
 * @throws Error `YYYY-MM-DD` 形式ではない場合
 */
function normalizeDueDate(
  rawDueDate: string | null | undefined,
): string | null | undefined {
  if (rawDueDate === undefined || rawDueDate === null) {
    return rawDueDate;
  }

  if (!DATE_ONLY_RE.test(rawDueDate)) {
    throw new HttpError(400, "Invalid due_date format: must be YYYY-MM-DD");
  }

  const parsed = new Date(`${rawDueDate}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime())) {
    throw new HttpError(400, "Invalid due_date: not a valid calendar date");
  }

  if (parsed.toISOString().slice(0, 10) !== rawDueDate) {
    throw new HttpError(400, "Invalid due_date: not a valid calendar date");
  }

  return rawDueDate;
}

/**
 * 配列/`null` を除外したプレーンオブジェクトへ安全に絞り込む。
 * @param value - 判定対象値
 * @returns プレーンオブジェクト。対象外は `null`
 */
function asRecord(value: unknown): Record<string, unknown> | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
}

/**
 * 任意 ID フィールドを正の整数として検証し、未指定時は `undefined` を返す。
 * @param value - 入力値
 * @param fieldPath - エラーメッセージに出すフィールドパス
 * @returns 検証済み ID。未指定時は `undefined`
 * @throws HttpError 値が正の整数でない場合
 */
function parseOptionalId(
  value: unknown,
  fieldPath: string,
): number | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== "number" || !Number.isInteger(value) || value <= 0) {
    throw new HttpError(400, `'${fieldPath}' must be a positive integer`);
  }
  return value;
}

/**
 * 必須文字列フィールドを検証し、空文字・長過ぎる値を拒否する。
 * @param value - 入力値
 * @param fieldPath - エラーメッセージに出すフィールドパス
 * @param maxLength - 許容最大文字数
 * @returns 検証済み文字列
 * @throws HttpError 値が要件を満たさない場合
 */
function parseRequiredString(
  value: unknown,
  fieldPath: string,
  maxLength: number,
): string {
  if (typeof value !== "string") {
    throw new HttpError(400, `'${fieldPath}' must be a string`);
  }
  if (value.trim().length === 0) {
    throw new HttpError(400, `'${fieldPath}' must not be empty`);
  }
  if (value.length > maxLength) {
    throw new HttpError(
      400,
      `'${fieldPath}' must be ${maxLength} characters or fewer`,
    );
  }
  return value;
}

/**
 * タスク直下/サブタスク配下で共通利用するチェックリスト入力を検証する。
 * @param value - 生の入力値
 * @param fieldPath - エラーメッセージに出すフィールドパス
 * @returns 検証済みチェックリスト入力
 * @throws HttpError 値が要件を満たさない場合
 */
function parseChecklistInput(
  value: unknown,
  fieldPath: string,
): TaskSnapshotChecklistInput {
  const record = asRecord(value);
  if (!record) {
    throw new HttpError(400, `'${fieldPath}' must be an object`);
  }

  const id = parseOptionalId(record.id, `${fieldPath}.id`);
  const content = parseRequiredString(
    record.content,
    `${fieldPath}.content`,
    500,
  );
  if (typeof record.completed !== "boolean") {
    throw new HttpError(400, `'${fieldPath}.completed' must be a boolean`);
  }

  return {
    id,
    content,
    completed: record.completed,
  };
}

/**
 * サブタスク入力を検証し、配下チェックリストも再帰的に検証する。
 * @param value - 生の入力値
 * @param fieldPath - エラーメッセージに出すフィールドパス
 * @returns 検証済みサブタスク入力
 * @throws HttpError 値が要件を満たさない場合
 */
function parseSubtaskInput(
  value: unknown,
  fieldPath: string,
): TaskSnapshotSubtaskInput {
  const record = asRecord(value);
  if (!record) {
    throw new HttpError(400, `'${fieldPath}' must be an object`);
  }

  const id = parseOptionalId(record.id, `${fieldPath}.id`);
  const content = parseRequiredString(
    record.content,
    `${fieldPath}.content`,
    2000,
  );
  if (!Array.isArray(record.checklists)) {
    throw new HttpError(400, `'${fieldPath}.checklists' must be an array`);
  }

  const checklists = record.checklists.map((item, index) =>
    parseChecklistInput(item, `${fieldPath}.checklists[${index}]`),
  );

  return {
    id,
    content,
    checklists,
  };
}

/**
 * コメント入力（任意 ID + 必須 content）を検証する。
 * @param value - 生の入力値
 * @param fieldPath - エラーメッセージに出すフィールドパス
 * @returns 検証済みコメント入力
 * @throws HttpError 値が要件を満たさない場合
 */
function parseCommentInput(
  value: unknown,
  fieldPath: string,
): TaskSnapshotCommentInput {
  const record = asRecord(value);
  if (!record) {
    throw new HttpError(400, `'${fieldPath}' must be an object`);
  }

  const id = parseOptionalId(record.id, `${fieldPath}.id`);
  const content = parseRequiredString(
    record.content,
    `${fieldPath}.content`,
    2000,
  );

  return {
    id,
    content,
  };
}

/**
 * `id` 指定を持つ配列で重複 ID を禁止し、更新対象の曖昧さを排除する。
 * @param values - 検証対象配列
 * @param fieldPath - エラーメッセージに出すフィールドパス
 * @returns なし
 * @throws HttpError 重複 ID が見つかった場合
 */
function ensureNoDuplicateIds(
  values: Array<{ id?: number }>,
  fieldPath: string,
): void {
  const seen = new Set<number>();
  for (const value of values) {
    if (value.id === undefined) continue;
    if (seen.has(value.id)) {
      throw new HttpError(400, `Duplicate '${fieldPath}.id': ${value.id}`);
    }
    seen.add(value.id);
  }
}

/**
 * タスク編集モーダルのスナップショット保存用ペイロードを検証して正規化する。
 * 型不整合や必須項目不足があれば `HttpError(400)` を投げる。
 * @param raw - 生のリクエストボディ
 * @returns 検証済みスナップショット
 * @throws HttpError 入力が不正な場合
 */
function parseTaskSnapshotPayload(raw: unknown): TaskSnapshotPayload {
  const body = asRecord(raw);
  if (!body) {
    throw new HttpError(400, "Invalid request body");
  }

  const content = parseRequiredString(body.content, "content", 2000);

  let due_date: string | null;
  if (body.due_date === null) {
    due_date = null;
  } else if (typeof body.due_date === "string") {
    due_date = body.due_date;
  } else {
    throw new HttpError(400, "'due_date' must be a string or null");
  }

  if (!Array.isArray(body.checklists)) {
    throw new HttpError(400, "'checklists' must be an array");
  }
  if (!Array.isArray(body.subtasks)) {
    throw new HttpError(400, "'subtasks' must be an array");
  }
  if (!Array.isArray(body.comments)) {
    throw new HttpError(400, "'comments' must be an array");
  }

  const checklists = body.checklists.map((item, index) =>
    parseChecklistInput(item, `checklists[${index}]`),
  );
  const subtasks = body.subtasks.map((item, index) =>
    parseSubtaskInput(item, `subtasks[${index}]`),
  );
  const comments = body.comments.map((item, index) =>
    parseCommentInput(item, `comments[${index}]`),
  );

  ensureNoDuplicateIds(checklists, "checklists");
  ensureNoDuplicateIds(subtasks, "subtasks");
  ensureNoDuplicateIds(comments, "comments");
  for (const [index, subtask] of subtasks.entries()) {
    ensureNoDuplicateIds(subtask.checklists, `subtasks[${index}].checklists`);
  }

  let completed: boolean;
  if (typeof body.completed === "boolean") {
    completed = body.completed;
  } else if (body.completed === undefined) {
    completed = false;
  } else {
    throw new HttpError(400, "'completed' must be a boolean");
  }

  return {
    content,
    due_date,
    completed,
    checklists,
    subtasks,
    comments,
  };
}

/**
 * 並び順を 1000 刻みで採番する。
 * @param index - 0 始まりの配列インデックス
 * @returns 1,000 刻みの position 値
 */
function calcPosition(index: number): number {
  return (index + 1) * 1000;
}

/**
 * 既存 ID 群から keep 対象を除いた削除対象 ID を返す。
 * @param existingIds - DB 上に存在する ID 集合
 * @param keepIds - 残す ID 集合
 * @returns 削除対象 ID 配列
 */
function idsToDelete(existingIds: Set<number>, keepIds: Set<number>): number[] {
  const ids: number[] = [];
  for (const id of existingIds) {
    if (!keepIds.has(id)) {
      ids.push(id);
    }
  }
  return ids;
}

/**
 * チェックリストを「更新・追加・削除」で同期する。
 * タスク直下（type: "task"）とサブタスク配下（type: "subtask"）の両方に対応する。
 * @param client - トランザクション内の DB クライアント
 * @param parent - 親の種別と ID
 * @param checklists - 目標状態のチェックリスト配列
 * @returns 同期完了時に解決される Promise
 * @throws HttpError 既存に存在しない ID が指定された場合
 */
async function syncChecklists(
  client: PoolClient,
  parent: { type: "task"; id: number } | { type: "subtask"; id: number },
  checklists: TaskSnapshotChecklistInput[],
): Promise<void> {
  const isTask = parent.type === "task";
  const existingResult = await client.query<{ id: number }>(
    isTask
      ? "SELECT id FROM checklist_items WHERE task_id = $1 AND subtask_id IS NULL FOR UPDATE"
      : "SELECT id FROM checklist_items WHERE subtask_id = $1 FOR UPDATE",
    [parent.id],
  );

  const existingIds = new Set(existingResult.rows.map((row) => row.id));
  const keepIds = new Set<number>();
  const errorFieldPath = isTask ? "checklists" : "subtasks.checklists";

  for (const checklist of checklists) {
    if (checklist.id === undefined) continue;
    if (!existingIds.has(checklist.id)) {
      throw new HttpError(
        400,
        `'${errorFieldPath}.id' contains unknown id ${checklist.id}`,
      );
    }
    keepIds.add(checklist.id);
  }

  const removeIds = idsToDelete(existingIds, keepIds);
  if (removeIds.length > 0) {
    await client.query(
      "DELETE FROM checklist_items WHERE id = ANY($1::int[])",
      [removeIds],
    );
  }

  const toUpdate: Array<{
    id: number;
    content: string;
    completed: boolean;
    position: number;
  }> = [];
  const toInsert: Array<{
    content: string;
    completed: boolean;
    position: number;
  }> = [];

  for (const [index, checklist] of checklists.entries()) {
    const position = calcPosition(index);
    if (checklist.id !== undefined) {
      toUpdate.push({
        id: checklist.id,
        content: checklist.content,
        completed: checklist.completed,
        position,
      });
    } else {
      toInsert.push({
        content: checklist.content,
        completed: checklist.completed,
        position,
      });
    }
  }

  if (toUpdate.length > 0) {
    await client.query(
      `UPDATE checklist_items SET
         content   = updates.content,
         completed = updates.completed,
         position  = updates.position
       FROM unnest($1::int[], $2::text[], $3::bool[], $4::int[])
         AS updates(id, content, completed, position)
       WHERE checklist_items.id = updates.id`,
      [
        toUpdate.map((u) => u.id),
        toUpdate.map((u) => u.content),
        toUpdate.map((u) => u.completed),
        toUpdate.map((u) => u.position),
      ],
    );
  }

  if (toInsert.length > 0) {
    if (isTask) {
      await client.query(
        `INSERT INTO checklist_items (task_id, subtask_id, content, completed, position)
         SELECT $1, NULL, content, completed, position
         FROM unnest($2::text[], $3::bool[], $4::int[])
           AS t(content, completed, position)`,
        [
          parent.id,
          toInsert.map((i) => i.content),
          toInsert.map((i) => i.completed),
          toInsert.map((i) => i.position),
        ],
      );
    } else {
      await client.query(
        `INSERT INTO checklist_items (task_id, subtask_id, content, completed, position)
         SELECT NULL, $1, content, completed, position
         FROM unnest($2::text[], $3::bool[], $4::int[])
           AS t(content, completed, position)`,
        [
          parent.id,
          toInsert.map((i) => i.content),
          toInsert.map((i) => i.completed),
          toInsert.map((i) => i.position),
        ],
      );
    }
  }
}

/**
 * タスクコメントをスナップショット内容に合わせて同期する。
 * `position` は受信順で再計算し、UI 上の順序を維持する。
 * @param client - トランザクション内の DB クライアント
 * @param taskId - 親タスク ID
 * @param comments - 目標状態のコメント配列
 * @returns 同期完了時に解決される Promise
 * @throws HttpError 既存に存在しない ID が指定された場合
 */
async function syncTaskComments(
  client: PoolClient,
  taskId: number,
  comments: TaskSnapshotCommentInput[],
): Promise<void> {
  const existingResult = await client.query<{ id: number }>(
    "SELECT id FROM task_comments WHERE task_id = $1 FOR UPDATE",
    [taskId],
  );

  const existingIds = new Set(existingResult.rows.map((row) => row.id));
  const keepIds = new Set<number>();

  for (const comment of comments) {
    if (comment.id === undefined) continue;
    if (!existingIds.has(comment.id)) {
      throw new HttpError(
        400,
        `'comments.id' contains unknown id ${comment.id}`,
      );
    }
    keepIds.add(comment.id);
  }

  const removeIds = idsToDelete(existingIds, keepIds);
  if (removeIds.length > 0) {
    await client.query("DELETE FROM task_comments WHERE id = ANY($1::int[])", [
      removeIds,
    ]);
  }

  const toUpdate: Array<{ id: number; content: string; position: number }> = [];
  const toInsert: Array<{ content: string; position: number }> = [];

  for (const [index, comment] of comments.entries()) {
    const position = calcPosition(index);
    if (comment.id !== undefined) {
      toUpdate.push({ id: comment.id, content: comment.content, position });
    } else {
      toInsert.push({ content: comment.content, position });
    }
  }

  if (toUpdate.length > 0) {
    await client.query(
      `UPDATE task_comments SET
         content  = updates.content,
         position = updates.position
       FROM unnest($1::int[], $2::text[], $3::int[])
         AS updates(id, content, position)
       WHERE task_comments.id = updates.id`,
      [
        toUpdate.map((u) => u.id),
        toUpdate.map((u) => u.content),
        toUpdate.map((u) => u.position),
      ],
    );
  }

  if (toInsert.length > 0) {
    await client.query(
      `INSERT INTO task_comments (task_id, content, position)
       SELECT $1, content, position
       FROM unnest($2::text[], $3::int[])
         AS t(content, position)`,
      [taskId, toInsert.map((i) => i.content), toInsert.map((i) => i.position)],
    );
  }
}

/**
 * 1件のタスクと関連子要素（サブタスク・チェックリスト・コメント）を単一 CTE クエリで
 * 再取得し、API レスポンスのスナップショット形式へ組み立てて返す。
 * @param client - トランザクション内の DB クライアント
 * @param taskId - 取得対象タスク ID
 * @returns スナップショット形式タスク。未存在なら `null`
 */
async function fetchTaskSnapshot(
  client: PoolClient,
  taskId: number,
): Promise<Task | null> {
  const result = await client.query<
    DbTask & {
      subtasks: Task["subtasks"];
      checklists: Task["checklists"];
      comments: Task["comments"];
    }
  >(
    `WITH
       sub_cl AS (
         SELECT
           ci.subtask_id,
           json_agg(
             json_build_object(
               'id', ci.id,
               'task_id', ci.task_id,
               'subtask_id', ci.subtask_id,
               'content', ci.content,
               'completed', ci.completed,
               'position', ci.position
             ) ORDER BY ci.position ASC
           ) AS checklists
         FROM checklist_items ci
         WHERE ci.subtask_id IN (SELECT id FROM subtasks WHERE task_id = $1)
         GROUP BY ci.subtask_id
       ),
       agg_subtasks AS (
         SELECT json_agg(
           json_build_object(
             'id', s.id,
             'task_id', s.task_id,
             'content', s.content,
             'checklists', COALESCE(sc.checklists, '[]'::json)
           ) ORDER BY s.id ASC
         ) AS subtasks
         FROM subtasks s
         LEFT JOIN sub_cl sc ON sc.subtask_id = s.id
         WHERE s.task_id = $1
       ),
       task_cl AS (
         SELECT json_agg(
           json_build_object(
             'id', ci.id,
             'task_id', ci.task_id,
             'subtask_id', ci.subtask_id,
             'content', ci.content,
             'completed', ci.completed,
             'position', ci.position
           ) ORDER BY ci.position ASC
         ) AS checklists
         FROM checklist_items ci
         WHERE ci.task_id = $1 AND ci.subtask_id IS NULL
       ),
       task_cmt AS (
         SELECT json_agg(
           json_build_object(
             'id', tc.id,
             'task_id', tc.task_id,
             'content', tc.content,
             'created_at', tc.created_at,
             'position', tc.position
           ) ORDER BY tc.position ASC, tc.created_at ASC, tc.id ASC
         ) AS comments
         FROM task_comments tc
         WHERE tc.task_id = $1
       )
     SELECT
       t.id,
       t.column_id,
       t.content,
       t.due_date::text AS due_date,
       t.position,
       t.completed,
       COALESCE((SELECT subtasks FROM agg_subtasks), '[]'::json) AS subtasks,
       COALESCE((SELECT checklists FROM task_cl), '[]'::json) AS checklists,
       COALESCE((SELECT comments FROM task_cmt), '[]'::json) AS comments
     FROM tasks t
     WHERE t.id = $1`,
    [taskId],
  );

  const row = result.rows[0];
  if (!row) return null;
  return row as Task;
}

// 新しいタスクを作成する: POST /api/tasks
router.post(
  "/",
  validateBody({
    column_id: {
      type: "number",
      required: true,
      integer: true,
      positive: true,
    },
    content: {
      type: "string",
      required: true,
      notEmpty: true,
      maxLength: 2000,
    },
    due_date: {
      type: "string",
      notEmpty: true,
      maxLength: 10,
    },
    position: { type: "number", required: true, integer: true, positive: true },
  }),
  /**
   * タスクを作成する。
   * @param req - `column_id` `content` `due_date` `position` を含むリクエスト
   * @param res - 作成したタスクを返すレスポンス
   * @param next - エラーハンドラへ委譲する関数
   * @returns 作成処理完了時に解決される Promise
   */
  async (req: Request, res: Response, next: NextFunction) => {
    const { column_id, content, due_date, position } = req.body as {
      column_id: number;
      content: string;
      due_date?: string | null;
      position: number;
    };

    let normalizedDueDate: string | null;
    try {
      normalizedDueDate = normalizeDueDate(due_date) ?? null;
    } catch {
      res
        .status(400)
        .json({ error: "'due_date' must be in YYYY-MM-DD format" });
      return;
    }

    try {
      // カラムの親行がユーザーのものであることを確認する
      const colCheck = await pool.query<{ id: number }>(
        `SELECT c.id FROM columns c
         JOIN rows r ON r.id = c.row_id
         WHERE c.id = $1 AND r.user_id = $2`,
        [column_id, req.userId!],
      );
      if (!colCheck.rows[0]) {
        throw new NotFoundError("Column not found");
      }
      const result = await pool.query<DbTask>(
        `INSERT INTO tasks (column_id, content, due_date, position) VALUES ($1, $2, $3, $4) RETURNING ${TASK_RETURNING_COLUMNS}`,
        [column_id, content, normalizedDueDate, position],
      );
      // 新規作成時は子要素が空の状態で返す
      res.json({
        ...result.rows[0],
        subtasks: [],
        checklists: [],
        comments: [],
      });
    } catch (err) {
      next(err);
    }
  },
);

// タスクの内容・期限を更新する: PUT /api/tasks/:id
router.put(
  "/:id",
  validateBody({
    content: {
      type: "string",
      notEmpty: true,
      maxLength: 2000,
    },
    due_date: {
      type: "string",
      notEmpty: true,
      maxLength: 10,
    },
    completed: {
      type: "boolean",
    },
  }),
  /**
   * タスク内容または期限を更新する。
   * @param req - パスパラメータ `id` と本文更新項目を含むリクエスト
   * @param res - 更新後タスクを返すレスポンス
   * @param next - エラーハンドラへ委譲する関数
   * @returns 更新処理完了時に解決される Promise
   */
  async (req: Request, res: Response, next: NextFunction) => {
    const id = parseId(req.params.id);
    if (!id) {
      res.status(400).json({ error: "Invalid ID" });
      return;
    }

    const body = req.body as {
      content?: string | null;
      due_date?: string | null;
      completed?: boolean;
    };
    const contentProvided = Object.prototype.hasOwnProperty.call(
      body,
      "content",
    );
    const dueDateProvided = Object.prototype.hasOwnProperty.call(
      body,
      "due_date",
    );
    const completedProvided = Object.prototype.hasOwnProperty.call(
      body,
      "completed",
    );

    if (!contentProvided && !dueDateProvided && !completedProvided) {
      res.status(400).json({
        error:
          "At least one of 'content', 'due_date', or 'completed' is required",
      });
      return;
    }

    if (contentProvided && typeof body.content !== "string") {
      res.status(400).json({ error: "'content' must be a string" });
      return;
    }

    let normalizedDueDate: string | null | undefined;
    try {
      normalizedDueDate = normalizeDueDate(body.due_date);
    } catch {
      res
        .status(400)
        .json({ error: "'due_date' must be in YYYY-MM-DD format" });
      return;
    }

    const updates: string[] = [];
    const values: Array<string | number | boolean | null> = [];

    if (contentProvided) {
      updates.push(`content = $${values.length + 1}`);
      values.push(body.content as string);
    }

    if (dueDateProvided) {
      updates.push(`due_date = $${values.length + 1}`);
      values.push(normalizedDueDate ?? null);
    }

    if (completedProvided) {
      updates.push(`completed = $${values.length + 1}`);
      values.push(body.completed as boolean);
    }

    values.push(id);
    values.push(req.userId!);

    try {
      const result = await pool.query<DbTask>(
        `UPDATE tasks SET ${updates.join(", ")} WHERE id = $${values.length - 1}
         AND column_id IN (
           SELECT c.id FROM columns c
           JOIN rows r ON r.id = c.row_id
           WHERE r.user_id = $${values.length}
         ) RETURNING ${TASK_RETURNING_COLUMNS}`,
        values,
      );
      if (!result.rows[0]) {
        throw new NotFoundError("Task not found");
      }
      res.json(result.rows[0]);
    } catch (err) {
      next(err);
    }
  },
);

// タスク編集モーダルの内容を単一トランザクションで一括保存する: PUT /api/tasks/:id/snapshot
router.put(
  "/:id/snapshot",
  /**
   * タスク編集モーダルのスナップショットを一括保存する。
   * @param req - パスパラメータ `id` とスナップショット本文を含むリクエスト
   * @param res - 保存後タスクを返すレスポンス
   * @param next - エラーハンドラへ委譲する関数
   * @returns 保存処理完了時に解決される Promise
   */
  async (req: Request, res: Response, next: NextFunction) => {
    const id = parseId(req.params.id);
    if (!id) {
      res.status(400).json({ error: "Invalid ID" });
      return;
    }

    let payload: TaskSnapshotPayload;
    try {
      payload = parseTaskSnapshotPayload(req.body);
    } catch (err) {
      if (err instanceof HttpError) {
        res.status(err.status).json({ error: err.message });
        return;
      }
      next(err);
      return;
    }

    let normalizedDueDate: string | null;
    try {
      normalizedDueDate = normalizeDueDate(payload.due_date) ?? null;
    } catch {
      res
        .status(400)
        .json({ error: "'due_date' must be in YYYY-MM-DD format" });
      return;
    }

    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      const taskLockResult = await client.query<{ id: number }>(
        `SELECT t.id FROM tasks t
         JOIN columns c ON c.id = t.column_id
         JOIN rows r ON r.id = c.row_id
         WHERE t.id = $1 AND r.user_id = $2 FOR UPDATE`,
        [id, req.userId!],
      );
      if (!taskLockResult.rows[0]) {
        throw new HttpError(404, "Task not found");
      }

      await client.query(
        "UPDATE tasks SET content = $1, due_date = $2, completed = $3 WHERE id = $4",
        [payload.content, normalizedDueDate, payload.completed, id],
      );

      const existingSubtaskResult = await client.query<{ id: number }>(
        "SELECT id FROM subtasks WHERE task_id = $1 FOR UPDATE",
        [id],
      );
      const existingSubtaskIds = new Set(
        existingSubtaskResult.rows.map((row) => row.id),
      );
      const keepSubtaskIds = new Set<number>();
      const resolvedSubtasks: Array<{
        id: number;
        checklists: TaskSnapshotChecklistInput[];
      }> = [];

      // 既存サブタスクを一括 UPDATE、新規サブタスクは RETURNING id が必要なため個別 INSERT
      const subtasksToUpdate = payload.subtasks.filter(
        (s): s is typeof s & { id: number } => s.id !== undefined,
      );
      for (const subtask of subtasksToUpdate) {
        if (!existingSubtaskIds.has(subtask.id)) {
          throw new HttpError(
            400,
            `'subtasks.id' contains unknown id ${subtask.id}`,
          );
        }
        keepSubtaskIds.add(subtask.id);
      }
      if (subtasksToUpdate.length > 0) {
        await client.query(
          `UPDATE subtasks SET content = updates.content
           FROM unnest($1::int[], $2::text[]) AS updates(id, content)
           WHERE subtasks.id = updates.id`,
          [
            subtasksToUpdate.map((s) => s.id),
            subtasksToUpdate.map((s) => s.content),
          ],
        );
      }

      for (const subtask of payload.subtasks) {
        if (subtask.id !== undefined) {
          resolvedSubtasks.push({
            id: subtask.id,
            checklists: subtask.checklists,
          });
          continue;
        }

        const createdSubtaskResult = await client.query<{ id: number }>(
          "INSERT INTO subtasks (task_id, content) VALUES ($1, $2) RETURNING id",
          [id, subtask.content],
        );
        const createdSubtaskId = createdSubtaskResult.rows[0]?.id;
        if (!createdSubtaskId) {
          throw new Error("Failed to create subtask");
        }
        resolvedSubtasks.push({
          id: createdSubtaskId,
          checklists: subtask.checklists,
        });
      }

      const subtaskIdsForDelete = idsToDelete(
        existingSubtaskIds,
        keepSubtaskIds,
      );
      if (subtaskIdsForDelete.length > 0) {
        await client.query("DELETE FROM subtasks WHERE id = ANY($1::int[])", [
          subtaskIdsForDelete,
        ]);
      }

      await syncChecklists(client, { type: "task", id }, payload.checklists);

      for (const subtask of resolvedSubtasks) {
        await syncChecklists(
          client,
          { type: "subtask", id: subtask.id },
          subtask.checklists,
        );
      }

      await syncTaskComments(client, id, payload.comments);

      const savedTask = await fetchTaskSnapshot(client, id);
      if (!savedTask) {
        throw new HttpError(404, "Task not found");
      }

      await client.query("COMMIT");
      res.json(savedTask);
    } catch (err) {
      try {
        await client.query("ROLLBACK");
      } catch (rollbackErr) {
        console.error("Rollback failed:", rollbackErr);
      }

      if (err instanceof HttpError) {
        res.status(err.status).json({ error: err.message });
        return;
      }

      next(err);
    } finally {
      client.release();
    }
  },
);

// タスクを別カラムへ移動する: PUT /api/tasks/:id/move
router.put(
  "/:id/move",
  validateBody({
    column_id: {
      type: "number",
      required: true,
      integer: true,
      positive: true,
    },
    position: { type: "number", required: true, positive: true }, // 隣接タスクとの位置関係を示すために小数点となる場合がある
  }),
  /**
   * タスクを別カラムへ移動する。
   * @param req - パスパラメータ `id` と本文 `column_id` `position` を含むリクエスト
   * @param res - 更新後タスクを返すレスポンス
   * @param next - エラーハンドラへ委譲する関数
   * @returns 移動処理完了時に解決される Promise
   */
  async (req: Request, res: Response, next: NextFunction) => {
    const id = parseId(req.params.id);
    if (!id) {
      res.status(400).json({ error: "Invalid ID" });
      return;
    }
    const { column_id, position } = req.body as {
      column_id: number;
      position: number;
    };
    try {
      // 移動先カラムがユーザーのものであることを確認する
      const destCheck = await pool.query<{ id: number }>(
        `SELECT c.id FROM columns c
         JOIN rows r ON r.id = c.row_id
         WHERE c.id = $1 AND r.user_id = $2`,
        [column_id, req.userId!],
      );
      if (!destCheck.rows[0]) {
        throw new NotFoundError("Column not found");
      }
      const result = await pool.query<DbTask>(
        `UPDATE tasks SET column_id = $1, position = $2
         WHERE id = $3 AND column_id IN (
           SELECT c.id FROM columns c
           JOIN rows r ON r.id = c.row_id
           WHERE r.user_id = $4
         ) RETURNING ${TASK_RETURNING_COLUMNS}`,
        [column_id, position, id, req.userId!],
      );
      if (!result.rows[0]) {
        throw new NotFoundError("Task not found");
      }
      res.json(result.rows[0]);
    } catch (err) {
      next(err);
    }
  },
);

// タスクをコピーする（サブタスク・チェックリスト・コメントも含めて複製）: POST /api/tasks/:id/copy
router.post(
  "/:id/copy",
  /**
   * 指定タスクを同一カラムの末尾にコピーする。
   * サブタスク・チェックリスト・コメントもすべて複製される。
   * @param req - パスパラメータ `id` を含むリクエスト
   * @param res - 複製後タスクを返すレスポンス
   * @param next - エラーハンドラへ委譲する関数
   * @returns コピー処理完了時に解決される Promise
   */
  async (req: Request, res: Response, next: NextFunction) => {
    const id = parseId(req.params.id);
    if (!id) {
      res.status(400).json({ error: "Invalid ID" });
      return;
    }

    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      // 元タスクの所有権を確認しつつ取得
      const ownerCheck = await client.query<{ id: number }>(
        `SELECT t.id FROM tasks t
         JOIN columns c ON c.id = t.column_id
         JOIN rows r ON r.id = c.row_id
         WHERE t.id = $1 AND r.user_id = $2 FOR UPDATE`,
        [id, req.userId!],
      );
      if (!ownerCheck.rows[0]) {
        throw new NotFoundError("Task not found");
      }

      // 元タスクを取得
      const srcTask = await fetchTaskSnapshot(client, id);
      if (!srcTask) {
        throw new NotFoundError("Task not found");
      }

      // 同一カラムの末尾 position を計算
      const maxPosResult = await client.query<{ max: string | null }>(
        "SELECT MAX(position) AS max FROM tasks WHERE column_id = $1",
        [srcTask.column_id],
      );
      const maxPos = Number(maxPosResult.rows[0]?.max ?? 0);
      const newPosition = maxPos + 1000;

      // タスク本体を複製
      const newTaskResult = await client.query<DbTask>(
        `INSERT INTO tasks (column_id, content, due_date, position, completed)
         VALUES ($1, $2, $3, $4, false)
         RETURNING ${TASK_RETURNING_COLUMNS}`,
        [
          srcTask.column_id,
          `${srcTask.content} のコピー`,
          srcTask.due_date,
          newPosition,
        ],
      );
      const newTask = newTaskResult.rows[0];
      if (!newTask) throw new Error("Failed to copy task");

      // タスク直下チェックリストを複製（まとめて INSERT）
      if (srcTask.checklists.length > 0) {
        await client.query(
          `INSERT INTO checklist_items (task_id, subtask_id, content, completed, position)
           SELECT $1, NULL, content, false, position
           FROM unnest($2::text[], $3::int[]) AS t(content, position)`,
          [
            newTask.id,
            srcTask.checklists.map((cl) => cl.content),
            srcTask.checklists.map((_, i) => calcPosition(i)),
          ],
        );
      }

      // コメントを複製（まとめて INSERT）
      if (srcTask.comments.length > 0) {
        await client.query(
          `INSERT INTO task_comments (task_id, content, position)
           SELECT $1, content, position
           FROM unnest($2::text[], $3::int[]) AS t(content, position)`,
          [
            newTask.id,
            srcTask.comments.map((cm) => cm.content),
            srcTask.comments.map((_, i) => calcPosition(i)),
          ],
        );
      }

      // サブタスクとそのチェックリストを複製（サブタスクは RETURNING id が必要なため個別 INSERT）
      for (const subtask of srcTask.subtasks) {
        const newSubtaskResult = await client.query<{ id: number }>(
          "INSERT INTO subtasks (task_id, content) VALUES ($1, $2) RETURNING id",
          [newTask.id, subtask.content],
        );
        const newSubtaskId = newSubtaskResult.rows[0]?.id;
        if (!newSubtaskId) throw new Error("Failed to copy subtask");

        if (subtask.checklists.length > 0) {
          await client.query(
            `INSERT INTO checklist_items (task_id, subtask_id, content, completed, position)
             SELECT NULL, $1, content, false, position
             FROM unnest($2::text[], $3::int[]) AS t(content, position)`,
            [
              newSubtaskId,
              subtask.checklists.map((cl) => cl.content),
              subtask.checklists.map((_, i) => calcPosition(i)),
            ],
          );
        }
      }

      const copied = await fetchTaskSnapshot(client, newTask.id);
      await client.query("COMMIT");
      res.status(201).json(copied);
    } catch (err) {
      try {
        await client.query("ROLLBACK");
      } catch (rollbackErr) {
        console.error("Rollback failed:", rollbackErr);
      }
      next(err);
    } finally {
      client.release();
    }
  },
);

// タスクを削除する（サブタスク・チェックリストも CASCADE で削除される）: DELETE /api/tasks/:id
router.delete(
  "/:id",
  /**
   * タスクを削除する。
   * @param req - パスパラメータ `id` を含むリクエスト
   * @param res - 削除結果を返すレスポンス
   * @param next - エラーハンドラへ委譲する関数
   * @returns 削除処理完了時に解決される Promise
   */
  async (req: Request, res: Response, next: NextFunction) => {
    const id = parseId(req.params.id);
    if (!id) {
      res.status(400).json({ error: "Invalid ID" });
      return;
    }
    try {
      const result = await pool.query(
        `DELETE FROM tasks WHERE id = $1
         AND column_id IN (
           SELECT c.id FROM columns c
           JOIN rows r ON r.id = c.row_id
           WHERE r.user_id = $2
         )`,
        [id, req.userId!],
      );
      if ((result.rowCount ?? 0) === 0) {
        throw new NotFoundError("Task not found");
      }
      res.json({ success: true });
    } catch (err) {
      next(err);
    }
  },
);

export default router;
