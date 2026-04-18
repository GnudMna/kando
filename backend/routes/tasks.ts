// タスクに対する CRUD・移動エンドポイントを定義するルーター
import { Router, Request, Response, NextFunction } from "express";
import { pool } from "../db.js";
import type { DbTask } from "../types.js";
import { parseId, validateBody } from "../middleware/validate.js";

const router = Router();
const TASK_RETURNING_COLUMNS =
  "id, column_id, content, due_date::text AS due_date, position";

const DATE_ONLY_RE = /^\d{4}-\d{2}-\d{2}$/;

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
