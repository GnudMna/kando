// チェックリスト項目に対する CRUD エンドポイントを定義するルーター
// チェックリストはタスク直下またはサブタスク配下に紐付けられる
import { Router, Request, Response, NextFunction } from "express";
import { pool } from "../db.js";
import type { DbChecklistItem } from "../types.js";
import { parseId, validateBody } from "../middleware/validate.js";

const router = Router();

type ChecklistParentValidationResult =
  | { ok: true; taskId: number | null; subtaskId: number | null }
  | { ok: false; error: string };

/**
 * checklist_items の親参照（task_id / subtask_id）を検証する。
 * どちらか一方のみ指定されることを必須とする。
 */
export function validateChecklistParentRefs(
  taskIdRaw: unknown,
  subtaskIdRaw: unknown,
): ChecklistParentValidationResult {
  const hasTaskId = taskIdRaw !== null && taskIdRaw !== undefined;
  const hasSubtaskId = subtaskIdRaw !== null && subtaskIdRaw !== undefined;

  if (hasTaskId === hasSubtaskId) {
    return {
      ok: false,
      error: "Exactly one of 'task_id' or 'subtask_id' is required",
    };
  }

  if (hasTaskId) {
    if (!Number.isInteger(taskIdRaw) || (taskIdRaw as number) <= 0) {
      return { ok: false, error: "'task_id' must be a positive integer" };
    }
    return { ok: true, taskId: taskIdRaw as number, subtaskId: null };
  }

  if (!Number.isInteger(subtaskIdRaw) || (subtaskIdRaw as number) <= 0) {
    return { ok: false, error: "'subtask_id' must be a positive integer" };
  }
  return { ok: true, taskId: null, subtaskId: subtaskIdRaw as number };
}

// 新しいチェックリスト項目を作成する: POST /api/checklist-items
// task_id または subtask_id のどちらか一方のみ必須
router.post(
  "/",
  validateBody({
    content: { type: "string", required: true, notEmpty: true, maxLength: 500 },
  }),
  async (req: Request, res: Response, next: NextFunction) => {
    const { content } = req.body as { content: string };
    const body = req.body as Record<string, unknown>;
    const parentRefs = validateChecklistParentRefs(
      body.task_id,
      body.subtask_id,
    );
    if (!parentRefs.ok) {
      res.status(400).json({ error: parentRefs.error });
      return;
    }

    try {
      const result = await pool.query<DbChecklistItem>(
        `INSERT INTO checklist_items (task_id, subtask_id, content, position)
         SELECT $1, $2, $3, COALESCE(MAX(position), 0) + 1000
         FROM checklist_items
         WHERE ($1::integer IS NOT NULL AND task_id = $1)
            OR ($2::integer IS NOT NULL AND subtask_id = $2)
         RETURNING *`,
        [parentRefs.taskId, parentRefs.subtaskId, content],
      );
      res.json(result.rows[0]);
    } catch (err) {
      next(err);
    }
  },
);

// チェックリスト項目の内容・完了状態・並び順を更新する: PUT /api/checklist-items/:id
router.put(
  "/:id",
  validateBody({
    content: { type: "string", notEmpty: true, maxLength: 500 },
    completed: { type: "boolean" },
    position: { type: "number", finite: true },
  }),
  async (req: Request, res: Response, next: NextFunction) => {
    const id = parseId(req.params.id);
    if (!id) {
      res.status(400).json({ error: "Invalid ID" });
      return;
    }
    const { completed, content, position } = req.body as {
      completed?: boolean | null;
      content?: string | null;
      position?: number | null;
    };

    if (content === null) {
      res.status(400).json({ error: "'content' must be a string" });
      return;
    }
    if (completed === null) {
      res.status(400).json({ error: "'completed' must be a boolean" });
      return;
    }
    if (position === null) {
      res.status(400).json({ error: "'position' must be a number" });
      return;
    }

    // 更新するフィールドを動的に構築する
    const fields: string[] = [];
    const vals: unknown[] = [];
    let idx = 1;

    if (completed !== undefined) {
      fields.push(`completed = $${idx++}`);
      vals.push(completed);
    }
    if (content !== undefined) {
      fields.push(`content = $${idx++}`);
      vals.push(content);
    }
    if (position !== undefined) {
      fields.push(`position = $${idx++}`);
      vals.push(position);
    }

    // 更新フィールドが1つもない場合はエラー
    if (fields.length === 0) {
      res.status(400).json({ error: "No fields to update" });
      return;
    }

    vals.push(id);
    try {
      const result = await pool.query<DbChecklistItem>(
        `UPDATE checklist_items SET ${fields.join(", ")} WHERE id = $${idx} RETURNING *`,
        vals,
      );
      if (!result.rows[0]) {
        res.status(404).json({ error: "Checklist item not found" });
        return;
      }
      res.json(result.rows[0]);
    } catch (err) {
      next(err);
    }
  },
);

// チェックリスト項目を削除する: DELETE /api/checklist-items/:id
router.delete(
  "/:id",
  async (req: Request, res: Response, next: NextFunction) => {
    const id = parseId(req.params.id);
    if (!id) {
      res.status(400).json({ error: "Invalid ID" });
      return;
    }
    try {
      await pool.query("DELETE FROM checklist_items WHERE id = $1", [id]);
      res.json({ success: true });
    } catch (err) {
      next(err);
    }
  },
);

export default router;
