// タスクコメントに対する CRUD エンドポイントを定義するルーター
import { Router, Request, Response, NextFunction } from "express";
import { pool } from "../db.js";
import type { DbTaskComment } from "../types.js";
import { parseId, validateBody } from "../middleware/validate.js";

const router = Router();

// 新しいコメントを作成する: POST /api/task-comments
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
      const result = await pool.query<DbTaskComment>(
        `INSERT INTO task_comments (task_id, content, position)
         SELECT $1, $2, COALESCE(MAX(position), 0) + 1000
         FROM task_comments
         WHERE task_id = $1
         RETURNING *`,
        [task_id, content],
      );
      res.json(result.rows[0]);
    } catch (err) {
      next(err);
    }
  },
);

// コメント内容を更新する: PUT /api/task-comments/:id
router.put(
  "/:id",
  validateBody({
    content: {
      type: "string",
      notEmpty: true,
      maxLength: 2000,
    },
    position: {
      type: "number",
      finite: true,
      positive: true,
    },
  }),
  async (req: Request, res: Response, next: NextFunction) => {
    const id = parseId(req.params.id);
    if (!id) {
      res.status(400).json({ error: "Invalid ID" });
      return;
    }
    const { content, position } = req.body as {
      content?: string | null;
      position?: number | null;
    };

    if (content === null) {
      res.status(400).json({ error: "'content' must be a string" });
      return;
    }
    if (position === null) {
      res.status(400).json({ error: "'position' must be a number" });
      return;
    }

    const fields: string[] = [];
    const vals: unknown[] = [];
    let idx = 1;

    if (content !== undefined) {
      fields.push(`content = $${idx++}`);
      vals.push(content);
    }
    if (position !== undefined) {
      fields.push(`position = $${idx++}`);
      vals.push(position);
    }

    if (fields.length === 0) {
      res.status(400).json({ error: "No fields to update" });
      return;
    }
    vals.push(id);

    try {
      const result = await pool.query<DbTaskComment>(
        `UPDATE task_comments SET ${fields.join(", ")} WHERE id = $${idx} RETURNING *`,
        vals,
      );
      if (!result.rows[0]) {
        res.status(404).json({ error: "Comment not found" });
        return;
      }
      res.json(result.rows[0]);
    } catch (err) {
      next(err);
    }
  },
);

// コメントを削除する: DELETE /api/task-comments/:id
router.delete(
  "/:id",
  async (req: Request, res: Response, next: NextFunction) => {
    const id = parseId(req.params.id);
    if (!id) {
      res.status(400).json({ error: "Invalid ID" });
      return;
    }
    try {
      await pool.query("DELETE FROM task_comments WHERE id = $1", [id]);
      res.json({ success: true });
    } catch (err) {
      next(err);
    }
  },
);

export default router;
