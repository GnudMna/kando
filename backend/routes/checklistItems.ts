// チェックリスト項目に対する CRUD エンドポイントを定義するルーター
// チェックリストはタスク直下またはサブタスク配下に紐付けられる
import { Router, Request, Response, NextFunction } from 'express';
import { pool } from '../db.js';
import type { DbChecklistItem } from '../types.js';
import { parseId, validateBody } from '../middleware/validate.js';

const router = Router();

// 新しいチェックリスト項目を作成する: POST /api/checklist-items
// task_id または subtask_id のどちらかが必須
router.post(
  '/',
  validateBody({ content: { type: 'string', required: true, notEmpty: true } }),
  async (req: Request, res: Response, next: NextFunction) => {
    const { content } = req.body as { content: string };
    const body = req.body as Record<string, unknown>;
    const task_id = body.task_id;
    const subtask_id = body.subtask_id;

    // task_id と subtask_id が両方 null/undefined の場合はエラー
    if (task_id == null && subtask_id == null) {
      res.status(400).json({ error: "'task_id' or 'subtask_id' is required" });
      return;
    }
    // task_id が指定された場合は正の整数であることを検証する（null は許容）
    if (task_id != null && (!Number.isInteger(task_id) || (task_id as number) <= 0)) {
      res.status(400).json({ error: "'task_id' must be a positive integer" });
      return;
    }
    // subtask_id が指定された場合は正の整数であることを検証する（null は許容）
    if (subtask_id != null && (!Number.isInteger(subtask_id) || (subtask_id as number) <= 0)) {
      res.status(400).json({ error: "'subtask_id' must be a positive integer" });
      return;
    }
    try {
      const result = await pool.query<DbChecklistItem>(
        'INSERT INTO checklist_items (task_id, subtask_id, content) VALUES ($1, $2, $3) RETURNING *',
        [(task_id as number) ?? null, (subtask_id as number) ?? null, content]
      );
      res.json(result.rows[0]);
    } catch (err) {
      next(err);
    }
  }
);

// チェックリスト項目の内容・完了状態を更新する: PUT /api/checklist-items/:id
router.put('/:id', async (req: Request, res: Response, next: NextFunction) => {
  const id = parseId(req.params.id);
  if (!id) { res.status(400).json({ error: 'Invalid ID' }); return; }
  const { completed, content } = req.body as {
    completed?: boolean;
    content?: string;
  };

  // content が指定された場合は空文字でないことを検証する
  if (content !== undefined && (typeof content !== 'string' || content.trim().length === 0)) {
    res.status(400).json({ error: "'content' must not be empty" });
    return;
  }
  // completed が指定された場合は boolean であることを検証する
  if (completed !== undefined && typeof completed !== 'boolean') {
    res.status(400).json({ error: "'completed' must be a boolean" });
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

  // 更新フィールドが1つもない場合はエラー
  if (fields.length === 0) {
    res.status(400).json({ error: 'No fields to update' });
    return;
  }

  vals.push(id);
  try {
    const result = await pool.query<DbChecklistItem>(
      `UPDATE checklist_items SET ${fields.join(', ')} WHERE id = $${idx} RETURNING *`,
      vals
    );
    if (!result.rows[0]) { res.status(404).json({ error: 'Checklist item not found' }); return; }
    res.json(result.rows[0]);
  } catch (err) {
    next(err);
  }
});

// チェックリスト項目を削除する: DELETE /api/checklist-items/:id
router.delete('/:id', async (req: Request, res: Response, next: NextFunction) => {
  const id = parseId(req.params.id);
  if (!id) { res.status(400).json({ error: 'Invalid ID' }); return; }
  try {
    await pool.query('DELETE FROM checklist_items WHERE id = $1', [id]);
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

export default router;
