// 行（プロジェクト単位）に対する CRUD エンドポイントを定義するルーター
import { Router, Request, Response, NextFunction } from 'express';
import { pool } from '../db';
import type { DbRow } from '../types';
import { parseId, validateBody } from '../middleware/validate';

const router = Router();

// 新しい行を作成する: POST /api/rows
router.post(
  '/',
  validateBody({
    title: { type: 'string', required: true, notEmpty: true },
    position: { type: 'number', required: true },
  }),
  async (req: Request, res: Response, next: NextFunction) => {
    const { title, position } = req.body as { title: string; position: number };
    try {
      const result = await pool.query<DbRow>(
        'INSERT INTO rows (title, position) VALUES ($1, $2) RETURNING *',
        [title, position]
      );
      res.json(result.rows[0]);
    } catch (err) {
      next(err);
    }
  }
);

// 行のタイトルを更新する: PUT /api/rows/:id
router.put(
  '/:id',
  validateBody({ title: { type: 'string', required: true, notEmpty: true } }),
  async (req: Request, res: Response, next: NextFunction) => {
    const id = parseId(req.params.id);
    if (!id) { res.status(400).json({ error: 'Invalid ID' }); return; }
    const { title } = req.body as { title: string };
    try {
      const result = await pool.query<DbRow>(
        'UPDATE rows SET title = $1 WHERE id = $2 RETURNING *',
        [title, id]
      );
      if (!result.rows[0]) { res.status(404).json({ error: 'Row not found' }); return; }
      res.json(result.rows[0]);
    } catch (err) {
      next(err);
    }
  }
);

// 行を削除する（配下のカラム・タスクも CASCADE で削除される）: DELETE /api/rows/:id
router.delete('/:id', async (req: Request, res: Response, next: NextFunction) => {
  const id = parseId(req.params.id);
  if (!id) { res.status(400).json({ error: 'Invalid ID' }); return; }
  try {
    await pool.query('DELETE FROM rows WHERE id = $1', [id]);
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

export default router;
