// カラム（ステータス列）に対する CRUD エンドポイントを定義するルーター
import { Router, Request, Response, NextFunction } from 'express';
import { pool } from '../db.js';
import type { DbColumn } from '../types.js';
import { parseId, validateBody } from '../middleware/validate.js';

const router = Router();

// 新しいカラムを作成する: POST /api/columns
router.post(
  '/',
  validateBody({
    title: { type: 'string', required: true, notEmpty: true, maxLength: 200 },
    position: { type: 'number', required: true },
    row_id: { type: 'number', required: true },
  }),
  async (req: Request, res: Response, next: NextFunction) => {
    const { title, position, row_id } = req.body as {
      title: string;
      position: number;
      row_id: number;
    };
    try {
      const result = await pool.query<DbColumn>(
        'INSERT INTO columns (title, position, row_id) VALUES ($1, $2, $3) RETURNING *',
        [title, position, row_id]
      );
      res.json(result.rows[0]);
    } catch (err) {
      next(err);
    }
  }
);

// カラムのタイトルを更新する: PUT /api/columns/:id
router.put(
  '/:id',
  validateBody({ title: { type: 'string', required: true, notEmpty: true, maxLength: 200 } }),
  async (req: Request, res: Response, next: NextFunction) => {
    const id = parseId(req.params.id);
    if (!id) { res.status(400).json({ error: 'Invalid ID' }); return; }
    const { title } = req.body as { title: string };
    try {
      const result = await pool.query<DbColumn>(
        'UPDATE columns SET title = $1 WHERE id = $2 RETURNING *',
        [title, id]
      );
      if (!result.rows[0]) { res.status(404).json({ error: 'Column not found' }); return; }
      res.json(result.rows[0]);
    } catch (err) {
      next(err);
    }
  }
);

// カラムの表示順（position）を更新する: PUT /api/columns/:id/move
router.put(
  '/:id/move',
  validateBody({ position: { type: 'number', required: true } }),
  async (req: Request, res: Response, next: NextFunction) => {
    const id = parseId(req.params.id);
    if (!id) { res.status(400).json({ error: 'Invalid ID' }); return; }
    const { position } = req.body as { position: number };
    try {
      const result = await pool.query<DbColumn>(
        'UPDATE columns SET position = $1 WHERE id = $2 RETURNING *',
        [position, id]
      );
      if (!result.rows[0]) { res.status(404).json({ error: 'Column not found' }); return; }
      res.json(result.rows[0]);
    } catch (err) {
      next(err);
    }
  }
);

// カラムを削除する（配下のタスクも CASCADE で削除される）: DELETE /api/columns/:id
router.delete('/:id', async (req: Request, res: Response, next: NextFunction) => {
  const id = parseId(req.params.id);
  if (!id) { res.status(400).json({ error: 'Invalid ID' }); return; }
  try {
    await pool.query('DELETE FROM columns WHERE id = $1', [id]);
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

export default router;
