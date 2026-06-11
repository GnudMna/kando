// タスクに対する CRUD・移動エンドポイントを定義するルーター
import { Router, Request, Response, NextFunction } from "express";
import type {
  TaskSnapshotChecklistPayload,
  TaskSnapshotSubtaskPayload,
  TaskSnapshotCommentPayload,
  TaskSnapshotPayload,
} from "@kando/types";
import { parseId, validateBody } from "../middleware/validate.js";
import { HttpError, NotFoundError } from "../errors.js";
import {
  createTask,
  updateTask,
  saveTaskSnapshot,
  moveTask,
  copyTask,
  deleteTask,
} from "../services/tasksService.js";

const router = Router();

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

// ─── ルートハンドラ ──────────────────────────────────────────────────────────

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
      const task = await createTask(
        column_id,
        content,
        normalizedDueDate,
        position,
        req.userId!,
      );
      res.json(task);
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

    const patch: {
      content?: string;
      due_date?: string | null;
      completed?: boolean;
    } = {};
    if (contentProvided) patch.content = body.content as string;
    if (dueDateProvided) patch.due_date = normalizedDueDate ?? null;
    if (completedProvided) patch.completed = body.completed as boolean;

    try {
      const task = await updateTask(id, patch, req.userId!);
      res.json(task);
    } catch (err) {
      next(err);
    }
  },
);

// タスク編集モーダルの内容を単一トランザクションで一括保存する: PUT /api/tasks/:id/snapshot
router.put(
  "/:id/snapshot",
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

    try {
      const task = await saveTaskSnapshot(
        id,
        payload,
        normalizedDueDate,
        req.userId!,
      );
      res.json(task);
    } catch (err) {
      if (err instanceof HttpError) {
        res.status(err.status).json({ error: err.message });
        return;
      }
      next(err);
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
    position: { type: "number", required: true, positive: true },
  }),
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
      const task = await moveTask(id, column_id, position, req.userId!);
      res.json(task);
    } catch (err) {
      next(err);
    }
  },
);

// タスクをコピーする: POST /api/tasks/:id/copy
router.post(
  "/:id/copy",
  async (req: Request, res: Response, next: NextFunction) => {
    const id = parseId(req.params.id);
    if (!id) {
      res.status(400).json({ error: "Invalid ID" });
      return;
    }

    try {
      const copied = await copyTask(id, req.userId!);
      res.status(201).json(copied);
    } catch (err) {
      next(err);
    }
  },
);

// タスクを削除する: DELETE /api/tasks/:id
router.delete(
  "/:id",
  async (req: Request, res: Response, next: NextFunction) => {
    const id = parseId(req.params.id);
    if (!id) {
      res.status(400).json({ error: "Invalid ID" });
      return;
    }
    try {
      const deleted = await deleteTask(id, req.userId!);
      if (!deleted) {
        throw new NotFoundError("Task not found");
      }
      res.json({ success: true });
    } catch (err) {
      next(err);
    }
  },
);

/** タスク CRUD・移動・スナップショット保存 API の Express ルーター。 */
export default router;
