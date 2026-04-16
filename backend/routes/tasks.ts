// タスクに対する CRUD・移動エンドポイントを定義するルーター
import { Router, Request, Response, NextFunction } from 'express';
import { pool } from '../db.js';
import type { DbTask } from '../types.js';
import { parseId, validateBody } from '../middleware/validate.js';

const router = Router();

// 新しいタスクを作成する: POST /api/tasks
router.post(
  '/',
  validateBody({
    column_id: { type: 'number', required: true },
    content: { type: 'string', required: true, notEmpty: true },
    position: { type: 'number', required: true },
  }),
  async (req: Request, res: Response, next: NextFunction) => {
    const { column_id, content, position } = req.body as {
      column_id: number;
      content: string;
      position: number;
    };
    try {
      const result = await pool.query<DbTask>(
        'INSERT INTO tasks (column_id, content, position) VALUES ($1, $2, $3) RETURNING *',
        [column_id, content, position]
      );
      // 新規作成時はサブタスク・チェックリストが空の状態で返す
      res.json({ ...result.rows[0], subtasks: [], checklists: [] });
    } catch (err) {
      next(err);
    }
  }
);

// タスクの内容を更新する: PUT /api/tasks/:id
router.put(
  '/:id',
  validateBody({ content: { type: 'string', required: true, notEmpty: true } }),
  async (req: Request, res: Response, next: NextFunction) => {
    const id = parseId(req.params.id);
    if (!id) { res.status(400).json({ error: 'Invalid ID' }); return; }
    const { content } = req.body as { content: string };
    try {
      const result = await pool.query<DbTask>(
        'UPDATE tasks SET content = $1 WHERE id = $2 RETURNING *',
        [content, id]
      );
      if (!result.rows[0]) { res.status(404).json({ error: 'Task not found' }); return; }
      res.json(result.rows[0]);
    } catch (err) {
      next(err);
    }
  }
);

// タスクを別カラムへ移動する: PUT /api/tasks/:id/move
router.put(
  '/:id/move',
  validateBody({
    column_id: { type: 'number', required: true },
    position: { type: 'number', required: true },
  }),
  async (req: Request, res: Response, next: NextFunction) => {
    const id = parseId(req.params.id);
    if (!id) { res.status(400).json({ error: 'Invalid ID' }); return; }
    const { column_id, position } = req.body as { column_id: number; position: number };
    try {
      const result = await pool.query<DbTask>(
        'UPDATE tasks SET column_id = $1, position = $2 WHERE id = $3 RETURNING *',
        [column_id, position, id]
      );
      if (!result.rows[0]) { res.status(404).json({ error: 'Task not found' }); return; }
      res.json(result.rows[0]);
    } catch (err) {
      next(err);
    }
  }
);

// タスクを削除する（サブタスク・チェックリストも CASCADE で削除される）: DELETE /api/tasks/:id
router.delete('/:id', async (req: Request, res: Response, next: NextFunction) => {
  const id = parseId(req.params.id);
  if (!id) { res.status(400).json({ error: 'Invalid ID' }); return; }
  try {
    await pool.query('DELETE FROM tasks WHERE id = $1', [id]);
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

export default router;
