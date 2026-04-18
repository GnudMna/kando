// サブタスクに対する CRUD エンドポイントを定義するルーター
import { Router, Request, Response, NextFunction } from "express";
import { pool } from "../db.js";
import type { DbSubtask } from "../types.js";
import { parseId, validateBody } from "../middleware/validate.js";

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
  async (req: Request, res: Response, next: NextFunction) => {
    const { task_id, content } = req.body as {
      task_id: number;
      content: string;
    };
    try {
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
  async (req: Request, res: Response, next: NextFunction) => {
    const id = parseId(req.params.id);
    if (!id) {
      res.status(400).json({ error: "Invalid ID" });
      return;
    }
    const { content } = req.body as { content: string };
    try {
      const result = await pool.query<DbSubtask>(
        "UPDATE subtasks SET content = $1 WHERE id = $2 RETURNING *",
        [content, id],
      );
      if (!result.rows[0]) {
        res.status(404).json({ error: "Subtask not found" });
        return;
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
  async (req: Request, res: Response, next: NextFunction) => {
    const id = parseId(req.params.id);
    if (!id) {
      res.status(400).json({ error: "Invalid ID" });
      return;
    }
    try {
      const result = await pool.query("DELETE FROM subtasks WHERE id = $1", [id]);
      if ((result.rowCount ?? 0) === 0) {
        res.status(404).json({ error: "Subtask not found" });
        return;
      }
      res.json({ success: true });
    } catch (err) {
      next(err);
    }
  },
);

export default router;
