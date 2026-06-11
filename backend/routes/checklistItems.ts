// チェックリスト項目に対する CRUD エンドポイントを定義するルーター
// チェックリストはタスク直下またはサブタスク配下に紐付けられる
import { Router, Request, Response, NextFunction } from "express";
import { pool } from "../db.js";
import type { DbChecklistItem } from "../types.js";
import { HttpError, NotFoundError } from "../errors.js";
import { parseId, validateBody } from "../middleware/validate.js";

const router = Router();

const POSITION_INCREMENT = 1000;

type ChecklistParentValidationResult =
  | { ok: true; taskId: number | null; subtaskId: number | null }
  | { ok: false; error: string };

/**
 * checklist_items の親参照（task_id / subtask_id）を検証する。
 * どちらか一方のみ指定されることを必須とする。
 * @param taskIdRaw - リクエストボディの `task_id`
 * @param subtaskIdRaw - リクエストボディの `subtask_id`
 * @returns 正常時は親 ID を含む結果、異常時はエラーメッセージを含む結果
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
  /**
   * チェックリスト項目を作成する。
   * @param req - 本文 `content` と親参照（`task_id` または `subtask_id`）を含むリクエスト
   * @param res - 作成した項目を返すレスポンス
   * @param next - エラーハンドラへ委譲する関数
   * @returns 作成処理完了時に解決される Promise
   */
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

    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      // 同一親への同時追加を直列化して position の重複採番を防ぐ。
      let nextPosition = POSITION_INCREMENT;
      if (parentRefs.taskId !== null) {
        // 親タスクの所有権を確認しつつロックを取得する
        const parentRow = await client.query(
          `SELECT t.id FROM tasks t
           JOIN columns c ON c.id = t.column_id
           JOIN rows r ON r.id = c.row_id
           WHERE t.id = $1 AND r.user_id = $2 FOR UPDATE`,
          [parentRefs.taskId, req.userId!],
        );
        if (parentRow.rowCount === 0) {
          throw new NotFoundError("Task not found");
        }
        const nextPositionResult = await client.query<{
          next_position: number;
        }>(
          `SELECT COALESCE(MAX(position), 0) + ${POSITION_INCREMENT} AS next_position FROM checklist_items WHERE task_id = $1`,
          [parentRefs.taskId],
        );
        nextPosition =
          nextPositionResult.rows[0]?.next_position ?? POSITION_INCREMENT;
      } else {
        const subtaskId = parentRefs.subtaskId;
        if (subtaskId === null) {
          throw new HttpError(500, "Invalid checklist parent refs");
        }
        // 親サブタスクの所有権を確認しつつロックを取得する
        const parentRow = await client.query(
          `SELECT s.id FROM subtasks s
           JOIN tasks t ON t.id = s.task_id
           JOIN columns c ON c.id = t.column_id
           JOIN rows r ON r.id = c.row_id
           WHERE s.id = $1 AND r.user_id = $2 FOR UPDATE`,
          [subtaskId, req.userId!],
        );
        if (parentRow.rowCount === 0) {
          throw new NotFoundError("Subtask not found");
        }
        const nextPositionResult = await client.query<{
          next_position: number;
        }>(
          `SELECT COALESCE(MAX(position), 0) + ${POSITION_INCREMENT} AS next_position FROM checklist_items WHERE subtask_id = $1`,
          [subtaskId],
        );
        nextPosition =
          nextPositionResult.rows[0]?.next_position ?? POSITION_INCREMENT;
      }

      const result = await client.query<DbChecklistItem>(
        "INSERT INTO checklist_items (task_id, subtask_id, content, position) VALUES ($1, $2, $3, $4) RETURNING *",
        [parentRefs.taskId, parentRefs.subtaskId, content.trim(), nextPosition],
      );

      await client.query("COMMIT");
      res.json(result.rows[0]);
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

// チェックリスト項目の内容・完了状態・並び順を更新する: PUT /api/checklist-items/:id
router.put(
  "/:id",
  validateBody({
    content: { type: "string", notEmpty: true, maxLength: 500 },
    completed: { type: "boolean" },
    position: { type: "number", finite: true, integer: true, positive: true },
  }),
  /**
   * チェックリスト項目を更新する。
   * @param req - パスパラメータ `id` と本文更新項目を含むリクエスト
   * @param res - 更新後項目を返すレスポンス
   * @param next - エラーハンドラへ委譲する関数
   * @returns 更新処理完了時に解決される Promise
   */
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
      vals.push(content.trim());
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
    vals.push(req.userId!);
    try {
      const result = await pool.query<DbChecklistItem>(
        `UPDATE checklist_items SET ${fields.join(", ")} WHERE id = $${idx}
         AND (
           (task_id IS NOT NULL AND task_id IN (
             SELECT t.id FROM tasks t
             JOIN columns c ON c.id = t.column_id
             JOIN rows r ON r.id = c.row_id
             WHERE r.user_id = $${idx + 1}
           )) OR
           (subtask_id IS NOT NULL AND subtask_id IN (
             SELECT s.id FROM subtasks s
             JOIN tasks t ON t.id = s.task_id
             JOIN columns c ON c.id = t.column_id
             JOIN rows r ON r.id = c.row_id
             WHERE r.user_id = $${idx + 1}
           ))
         ) RETURNING *`,
        vals,
      );
      if (!result.rows[0]) {
        throw new NotFoundError("Checklist item not found");
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
  /**
   * チェックリスト項目を削除する。
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
        `DELETE FROM checklist_items WHERE id = $1
         AND (
           (task_id IS NOT NULL AND task_id IN (
             SELECT t.id FROM tasks t
             JOIN columns c ON c.id = t.column_id
             JOIN rows r ON r.id = c.row_id
             WHERE r.user_id = $2
           )) OR
           (subtask_id IS NOT NULL AND subtask_id IN (
             SELECT s.id FROM subtasks s
             JOIN tasks t ON t.id = s.task_id
             JOIN columns c ON c.id = t.column_id
             JOIN rows r ON r.id = c.row_id
             WHERE r.user_id = $2
           ))
         )`,
        [id, req.userId!],
      );
      if ((result.rowCount ?? 0) === 0) {
        throw new NotFoundError("Checklist item not found");
      }
      res.json({ success: true });
    } catch (err) {
      next(err);
    }
  },
);

/** チェックリスト項目 CRUD API の Express ルーター。 */
export default router;
