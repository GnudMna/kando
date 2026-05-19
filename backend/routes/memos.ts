// メモに対する CRUD エンドポイントを定義するルーター
import { Router, Request, Response, NextFunction } from "express";
import { pool } from "../db.js";
import type { DbMemo } from "@kando/types";
import { parseId, validateBody } from "../middleware/validate.js";
import { NotFoundError } from "../errors.js";

const router = Router();

/** メモに紐付くタスク一覧を含むメモを1件取得するヘルパー。 */
async function getMemoWithTasks(
  memoId: number,
  userId: number,
): Promise<(DbMemo & { tasks: { id: number; content: string }[] }) | null> {
  const result = await pool.query<
    DbMemo & { tasks: { id: number; content: string }[] }
  >(
    `SELECT m.*,
       COALESCE(
         JSON_AGG(JSON_BUILD_OBJECT('id', t.id, 'content', t.content)
           ORDER BY t.id) FILTER (WHERE t.id IS NOT NULL),
         '[]'
       ) AS tasks
     FROM memos m
     LEFT JOIN task_memo_links tml ON tml.memo_id = m.id
     LEFT JOIN tasks t ON t.id = tml.task_id
     WHERE m.id = $1 AND m.user_id = $2
     GROUP BY m.id`,
    [memoId, userId],
  );
  return result.rows[0] ?? null;
}

// メモ一覧を取得する: GET /api/memos
router.get(
  "/",
  /**
   * 認証ユーザーのメモを更新日時降順で返す（紐付くタスク情報を含む）。
   * @param req - 認証済みリクエスト
   * @param res - メモ配列を返すレスポンス
   * @param next - エラーハンドラへ委譲する関数
   */
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await pool.query<
        DbMemo & { tasks: { id: number; content: string }[] }
      >(
        `SELECT m.*,
           COALESCE(
             JSON_AGG(JSON_BUILD_OBJECT('id', t.id, 'content', t.content)
               ORDER BY t.id) FILTER (WHERE t.id IS NOT NULL),
             '[]'
           ) AS tasks
         FROM memos m
         LEFT JOIN task_memo_links tml ON tml.memo_id = m.id
         LEFT JOIN tasks t ON t.id = tml.task_id
         WHERE m.user_id = $1
         GROUP BY m.id
         ORDER BY m.updated_at DESC`,
        [req.userId!],
      );
      res.json(result.rows);
    } catch (err) {
      next(err);
    }
  },
);

// メモを作成する: POST /api/memos
router.post(
  "/",
  validateBody({
    title: { type: "string", maxLength: 255 },
    content: { type: "string", maxLength: 50000 },
  }),
  /**
   * 新しいメモを作成する。
   * @param req - `title` と `content` を含むリクエスト
   * @param res - 作成したメモを返すレスポンス
   * @param next - エラーハンドラへ委譲する関数
   */
  async (req: Request, res: Response, next: NextFunction) => {
    const { title = "", content = "" } = req.body as {
      title?: string;
      content?: string;
    };
    try {
      const result = await pool.query<DbMemo>(
        "INSERT INTO memos (user_id, title, content) VALUES ($1, $2, $3) RETURNING *",
        [req.userId!, title, content],
      );
      res.status(201).json({ ...result.rows[0], tasks: [] });
    } catch (err) {
      next(err);
    }
  },
);

// メモを更新する: PUT /api/memos/:id
router.put(
  "/:id",
  validateBody({
    title: { type: "string", maxLength: 255 },
    content: { type: "string", maxLength: 50000 },
  }),
  /**
   * 指定 ID のメモを更新する。
   * @param req - パスパラメータ `id`、更新値を含むリクエスト
   * @param res - 更新後メモを返すレスポンス
   * @param next - エラーハンドラへ委譲する関数
   */
  async (req: Request, res: Response, next: NextFunction) => {
    const id = parseId(req.params.id);
    if (!id) {
      res.status(400).json({ error: "Invalid memo id" });
      return;
    }
    const { title, content } = req.body as {
      title?: string;
      content?: string;
    };
    try {
      const result = await pool.query<DbMemo>(
        `UPDATE memos
         SET title = COALESCE($1, title),
             content = COALESCE($2, content),
             updated_at = NOW()
         WHERE id = $3 AND user_id = $4
         RETURNING *`,
        [title ?? null, content ?? null, id, req.userId!],
      );
      if ((result.rowCount ?? 0) === 0) {
        throw new NotFoundError("Memo not found");
      }
      const updated = await getMemoWithTasks(id, req.userId!);
      res.json(updated);
    } catch (err) {
      next(err);
    }
  },
);

// メモを削除する: DELETE /api/memos/:id
router.delete(
  "/:id",
  /**
   * 指定 ID のメモを削除する。
   * @param req - パスパラメータ `id` を含むリクエスト
   * @param res - 空レスポンス（204）
   * @param next - エラーハンドラへ委譲する関数
   */
  async (req: Request, res: Response, next: NextFunction) => {
    const id = parseId(req.params.id);
    if (!id) {
      res.status(400).json({ error: "Invalid memo id" });
      return;
    }
    try {
      const result = await pool.query(
        "DELETE FROM memos WHERE id = $1 AND user_id = $2",
        [id, req.userId!],
      );
      if ((result.rowCount ?? 0) === 0) {
        throw new NotFoundError("Memo not found");
      }
      res.status(204).send();
    } catch (err) {
      next(err);
    }
  },
);

// メモにタスクを関連付ける: POST /api/memos/:id/tasks
router.post(
  "/:id/tasks",
  validateBody({
    task_id: { type: "number", required: true, integer: true, positive: true },
  }),
  /**
   * タスクとメモを関連付ける。
   * @param req - パスパラメータ `id` と `task_id` を含むリクエスト
   * @param res - 更新後メモを返すレスポンス
   * @param next - エラーハンドラへ委譲する関数
   */
  async (req: Request, res: Response, next: NextFunction) => {
    const memoId = parseId(req.params.id);
    if (!memoId) {
      res.status(400).json({ error: "Invalid memo id" });
      return;
    }
    const { task_id } = req.body as { task_id: number };
    try {
      // メモの所有権を確認する
      const memoCheck = await pool.query(
        "SELECT id FROM memos WHERE id = $1 AND user_id = $2",
        [memoId, req.userId!],
      );
      if ((memoCheck.rowCount ?? 0) === 0) {
        throw new NotFoundError("Memo not found");
      }
      // タスクの所有権を確認する（rows -> columns -> tasks の経路で user_id を検証）
      const taskCheck = await pool.query(
        `SELECT t.id FROM tasks t
         JOIN columns c ON c.id = t.column_id
         JOIN rows r ON r.id = c.row_id
         WHERE t.id = $1 AND r.user_id = $2`,
        [task_id, req.userId!],
      );
      if ((taskCheck.rowCount ?? 0) === 0) {
        throw new NotFoundError("Task not found");
      }
      // 重複は無視して挿入する
      await pool.query(
        "INSERT INTO task_memo_links (task_id, memo_id) VALUES ($1, $2) ON CONFLICT DO NOTHING",
        [task_id, memoId],
      );
      const updated = await getMemoWithTasks(memoId, req.userId!);
      res.json(updated);
    } catch (err) {
      next(err);
    }
  },
);

// メモとタスクの関連付けを解除する: DELETE /api/memos/:id/tasks/:taskId
router.delete(
  "/:id/tasks/:taskId",
  /**
   * タスクとメモの関連付けを解除する。
   * @param req - パスパラメータ `id` と `taskId` を含むリクエスト
   * @param res - 更新後メモを返すレスポンス
   * @param next - エラーハンドラへ委譲する関数
   */
  async (req: Request, res: Response, next: NextFunction) => {
    const memoId = parseId(req.params.id);
    const taskId = parseId(req.params.taskId);
    if (!memoId || !taskId) {
      res.status(400).json({ error: "Invalid id" });
      return;
    }
    try {
      // メモの所有権を確認する
      const memoCheck = await pool.query(
        "SELECT id FROM memos WHERE id = $1 AND user_id = $2",
        [memoId, req.userId!],
      );
      if ((memoCheck.rowCount ?? 0) === 0) {
        throw new NotFoundError("Memo not found");
      }
      await pool.query(
        "DELETE FROM task_memo_links WHERE task_id = $1 AND memo_id = $2",
        [taskId, memoId],
      );
      const updated = await getMemoWithTasks(memoId, req.userId!);
      res.json(updated);
    } catch (err) {
      next(err);
    }
  },
);

export default router;
