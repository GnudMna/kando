// タスクに対する CRUD・移動エンドポイントを定義するルーター
import { Router, Request, Response, NextFunction } from "express";
import type { PoolClient } from "pg";
import { pool } from "../db.js";
import type {
  DbChecklistItem,
  DbSubtask,
  DbTask,
  DbTaskComment,
  Task,
} from "../types.js";
import { parseId, validateBody } from "../middleware/validate.js";

const router = Router();
const TASK_RETURNING_COLUMNS =
  "id, column_id, content, due_date::text AS due_date, position";

const DATE_ONLY_RE = /^\d{4}-\d{2}-\d{2}$/;

type TaskSnapshotChecklistInput = {
  id?: number;
  content: string;
  completed: boolean;
};

type TaskSnapshotSubtaskInput = {
  id?: number;
  content: string;
  checklists: TaskSnapshotChecklistInput[];
};

type TaskSnapshotCommentInput = {
  id?: number;
  content: string;
};

type TaskSnapshotPayload = {
  content: string;
  due_date: string | null;
  checklists: TaskSnapshotChecklistInput[];
  subtasks: TaskSnapshotSubtaskInput[];
  comments: TaskSnapshotCommentInput[];
};

class HttpError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

function normalizeDueDate(
  rawDueDate: string | null | undefined,
): string | null | undefined {
  if (rawDueDate === undefined || rawDueDate === null) {
    return rawDueDate;
  }

  if (!DATE_ONLY_RE.test(rawDueDate)) {
    throw new Error("INVALID_DUE_DATE");
  }

  const parsed = new Date(`${rawDueDate}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error("INVALID_DUE_DATE");
  }

  if (parsed.toISOString().slice(0, 10) !== rawDueDate) {
    throw new Error("INVALID_DUE_DATE");
  }

  return rawDueDate;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
}

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

  return {
    content,
    due_date,
    checklists,
    subtasks,
    comments,
  };
}

function calcPosition(index: number): number {
  return (index + 1) * 1000;
}

function idsToDelete(existingIds: Set<number>, keepIds: Set<number>): number[] {
  const ids: number[] = [];
  for (const id of existingIds) {
    if (!keepIds.has(id)) {
      ids.push(id);
    }
  }
  return ids;
}

function pushToGroupMap<K, V>(map: Map<K, V[]>, key: K, value: V): void {
  const bucket = map.get(key);
  if (bucket) {
    bucket.push(value);
    return;
  }
  map.set(key, [value]);
}

async function syncTaskChecklists(
  client: PoolClient,
  taskId: number,
  checklists: TaskSnapshotChecklistInput[],
): Promise<void> {
  const existingResult = await client.query<{ id: number }>(
    "SELECT id FROM checklist_items WHERE task_id = $1 AND subtask_id IS NULL FOR UPDATE",
    [taskId],
  );

  const existingIds = new Set(existingResult.rows.map((row) => row.id));
  const keepIds = new Set<number>();

  for (const checklist of checklists) {
    if (checklist.id === undefined) continue;
    if (!existingIds.has(checklist.id)) {
      throw new HttpError(
        400,
        `'checklists.id' contains unknown id ${checklist.id}`,
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

  for (const [index, checklist] of checklists.entries()) {
    const position = calcPosition(index);
    if (checklist.id !== undefined) {
      await client.query(
        "UPDATE checklist_items SET content = $1, completed = $2, position = $3 WHERE id = $4",
        [checklist.content, checklist.completed, position, checklist.id],
      );
      continue;
    }

    await client.query(
      "INSERT INTO checklist_items (task_id, subtask_id, content, completed, position) VALUES ($1, NULL, $2, $3, $4)",
      [taskId, checklist.content, checklist.completed, position],
    );
  }
}

async function syncSubtaskChecklists(
  client: PoolClient,
  subtaskId: number,
  checklists: TaskSnapshotChecklistInput[],
): Promise<void> {
  const existingResult = await client.query<{ id: number }>(
    "SELECT id FROM checklist_items WHERE subtask_id = $1 FOR UPDATE",
    [subtaskId],
  );

  const existingIds = new Set(existingResult.rows.map((row) => row.id));
  const keepIds = new Set<number>();

  for (const checklist of checklists) {
    if (checklist.id === undefined) continue;
    if (!existingIds.has(checklist.id)) {
      throw new HttpError(
        400,
        `'subtasks.checklists.id' contains unknown id ${checklist.id}`,
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

  for (const [index, checklist] of checklists.entries()) {
    const position = calcPosition(index);
    if (checklist.id !== undefined) {
      await client.query(
        "UPDATE checklist_items SET content = $1, completed = $2, position = $3 WHERE id = $4",
        [checklist.content, checklist.completed, position, checklist.id],
      );
      continue;
    }

    await client.query(
      "INSERT INTO checklist_items (task_id, subtask_id, content, completed, position) VALUES (NULL, $1, $2, $3, $4)",
      [subtaskId, checklist.content, checklist.completed, position],
    );
  }
}

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

  for (const [index, comment] of comments.entries()) {
    const position = calcPosition(index);
    if (comment.id !== undefined) {
      await client.query(
        "UPDATE task_comments SET content = $1, position = $2 WHERE id = $3",
        [comment.content, position, comment.id],
      );
      continue;
    }

    await client.query(
      "INSERT INTO task_comments (task_id, content, position) VALUES ($1, $2, $3)",
      [taskId, comment.content, position],
    );
  }
}

async function fetchTaskSnapshot(
  client: PoolClient,
  taskId: number,
): Promise<Task | null> {
  const taskResult = await client.query<DbTask>(
    `SELECT ${TASK_RETURNING_COLUMNS} FROM tasks WHERE id = $1`,
    [taskId],
  );
  const task = taskResult.rows[0];
  if (!task) return null;

  const subtasksResult = await client.query<DbSubtask>(
    "SELECT * FROM subtasks WHERE task_id = $1 ORDER BY id ASC",
    [taskId],
  );

  const taskChecklistResult = await client.query<DbChecklistItem>(
    "SELECT * FROM checklist_items WHERE task_id = $1 AND subtask_id IS NULL ORDER BY position ASC",
    [taskId],
  );

  const commentsResult = await client.query<DbTaskComment>(
    "SELECT * FROM task_comments WHERE task_id = $1 ORDER BY position ASC, created_at ASC, id ASC",
    [taskId],
  );

  let subtaskChecklistRows: DbChecklistItem[] = [];
  const subtaskIds = subtasksResult.rows.map((subtask) => subtask.id);
  if (subtaskIds.length > 0) {
    const subtaskChecklistResult = await client.query<DbChecklistItem>(
      "SELECT * FROM checklist_items WHERE subtask_id = ANY($1::int[]) ORDER BY subtask_id ASC, position ASC",
      [subtaskIds],
    );
    subtaskChecklistRows = subtaskChecklistResult.rows;
  }

  const checklistBySubtaskId = new Map<number, DbChecklistItem[]>();
  for (const checklist of subtaskChecklistRows) {
    if (checklist.subtask_id === null) continue;
    pushToGroupMap(checklistBySubtaskId, checklist.subtask_id, checklist);
  }

  return {
    ...task,
    checklists: taskChecklistResult.rows,
    comments: commentsResult.rows,
    subtasks: subtasksResult.rows.map((subtask) => ({
      ...subtask,
      checklists: checklistBySubtaskId.get(subtask.id) ?? [],
    })),
  };
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
    position: { type: "number", required: true, positive: true },
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
    };
    const contentProvided = Object.prototype.hasOwnProperty.call(
      body,
      "content",
    );
    const dueDateProvided = Object.prototype.hasOwnProperty.call(
      body,
      "due_date",
    );

    if (!contentProvided && !dueDateProvided) {
      res
        .status(400)
        .json({ error: "At least one of 'content' or 'due_date' is required" });
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
    const values: Array<string | number | null> = [];

    if (contentProvided) {
      updates.push(`content = $${values.length + 1}`);
      values.push(body.content as string);
    }

    if (dueDateProvided) {
      updates.push(`due_date = $${values.length + 1}`);
      values.push(normalizedDueDate ?? null);
    }

    values.push(id);

    try {
      const result = await pool.query<DbTask>(
        `UPDATE tasks SET ${updates.join(", ")} WHERE id = $${values.length} RETURNING ${TASK_RETURNING_COLUMNS}`,
        values,
      );
      if (!result.rows[0]) {
        res.status(404).json({ error: "Task not found" });
        return;
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
        "SELECT id FROM tasks WHERE id = $1 FOR UPDATE",
        [id],
      );
      if (!taskLockResult.rows[0]) {
        throw new HttpError(404, "Task not found");
      }

      await client.query(
        "UPDATE tasks SET content = $1, due_date = $2 WHERE id = $3",
        [payload.content, normalizedDueDate, id],
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

      for (const subtask of payload.subtasks) {
        if (subtask.id !== undefined) {
          if (!existingSubtaskIds.has(subtask.id)) {
            throw new HttpError(
              400,
              `'subtasks.id' contains unknown id ${subtask.id}`,
            );
          }
          keepSubtaskIds.add(subtask.id);
          await client.query("UPDATE subtasks SET content = $1 WHERE id = $2", [
            subtask.content,
            subtask.id,
          ]);
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

      await syncTaskChecklists(client, id, payload.checklists);

      for (const subtask of resolvedSubtasks) {
        await syncSubtaskChecklists(client, subtask.id, subtask.checklists);
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
      const result = await pool.query<DbTask>(
        `UPDATE tasks SET column_id = $1, position = $2 WHERE id = $3 RETURNING ${TASK_RETURNING_COLUMNS}`,
        [column_id, position, id],
      );
      if (!result.rows[0]) {
        res.status(404).json({ error: "Task not found" });
        return;
      }
      res.json(result.rows[0]);
    } catch (err) {
      next(err);
    }
  },
);

// タスクを削除する（サブタスク・チェックリストも CASCADE で削除される）: DELETE /api/tasks/:id
router.delete(
  "/:id",
  async (req: Request, res: Response, next: NextFunction) => {
    const id = parseId(req.params.id);
    if (!id) {
      res.status(400).json({ error: "Invalid ID" });
      return;
    }
    try {
      await pool.query("DELETE FROM tasks WHERE id = $1", [id]);
      res.json({ success: true });
    } catch (err) {
      next(err);
    }
  },
);

export default router;
