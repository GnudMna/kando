// サブタスクに対する CRUD エンドポイントを定義するルーター
import { Router, Request, Response, NextFunction } from "express";
import { pool } from "../db.js";
import type { DbSubtask } from "../types.js";
import { parseId, validateBody } from "../middleware/validate.js";
import { NotFoundError } from "../errors.js";

const router = Router();

// 新しいサブタスクを作成する: POST /api/subtasks
router.post(
  "/",
  validateBody({
    task_id: { type: "number", required: true, integer: true, positive: true },
    content: {
      type: "string",
      required: true,
      notEmpty: true,
      maxLength: 2000,
    },
  }),
  /**
   * サブタスクを作成する。
   * @param req - `task_id` と `content` を含むリクエスト
   * @param res - 作成したサブタスクを返すレスポンス
   * @param next - エラーハンドラへ委譲する関数
   * @returns 作成処理完了時に解決される Promise
   */
  async (req: Request, res: Response, next: NextFunction) => {
    const { task_id, content } = req.body as {
      task_id: number;
      content: string;
    };
    try {
      // 親タスクの所有権を確認する
      const taskCheck = await pool.query<{ id: number }>(
        `SELECT t.id FROM tasks t
         JOIN columns c ON c.id = t.column_id
         JOIN rows r ON r.id = c.row_id
         WHERE t.id = $1 AND r.user_id = $2`,
        [task_id, req.userId!],
      );
      if (!taskCheck.rows[0]) {
        throw new NotFoundError("Task not found");
      }
      const result = await pool.query<DbSubtask>(
        "INSERT INTO subtasks (task_id, content) VALUES ($1, $2) RETURNING *",
        [task_id, content],
      );
      // 新規作成時はチェックリストが空の状態で返す
      res.json({ ...result.rows[0], checklists: [] });
    } catch (err) {
      next(err);
    }
  },
);

// サブタスクの内容を更新する: PUT /api/subtasks/:id
router.put(
  "/:id",
  validateBody({
    content: {
      type: "string",
      required: true,
      notEmpty: true,
      maxLength: 2000,
    },
  }),
  /**
   * サブタスク内容を更新する。
   * @param req - パスパラメータ `id` と本文 `content` を含むリクエスト
   * @param res - 更新後サブタスクを返すレスポンス
   * @param next - エラーハンドラへ委譲する関数
   * @returns 更新処理完了時に解決される Promise
   */
  async (req: Request, res: Response, next: NextFunction) => {
    const id = parseId(req.params.id);
    if (!id) {
      res.status(400).json({ error: "Invalid ID" });
      return;
    }
    const { content } = req.body as { content: string };
    try {
      const result = await pool.query<DbSubtask>(
        `UPDATE subtasks SET content = $1
         WHERE id = $2 AND task_id IN (
           SELECT t.id FROM tasks t
           JOIN columns c ON c.id = t.column_id
           JOIN rows r ON r.id = c.row_id
           WHERE r.user_id = $3
         ) RETURNING *`,
        [content, id, req.userId!],
      );
      if (!result.rows[0]) {
        throw new NotFoundError("Subtask not found");
      }
      res.json(result.rows[0]);
    } catch (err) {
      next(err);
    }
  },
);

// サブタスクを削除する（配下のチェックリストも CASCADE で削除される）: DELETE /api/subtasks/:id
router.delete(
  "/:id",
  /**
   * サブタスクを削除する。
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
        `DELETE FROM subtasks WHERE id = $1 AND task_id IN (
           SELECT t.id FROM tasks t
           JOIN columns c ON c.id = t.column_id
           JOIN rows r ON r.id = c.row_id
           WHERE r.user_id = $2
         )`,
        [id, req.userId!],
      );
      if ((result.rowCount ?? 0) === 0) {
        throw new NotFoundError("Subtask not found");
      }
      res.json({ success: true });
    } catch (err) {
      next(err);
    }
  },
);

export default router;
