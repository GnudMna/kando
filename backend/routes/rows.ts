// 行（プロジェクト単位）に対する CRUD エンドポイントを定義するルーター
import { Router, Request, Response, NextFunction } from "express";
import { pool } from "../db.js";
import type { DbRow, DbColumn, Row } from "../types.js";
import { parseId, validateBody } from "../middleware/validate.js";

const router = Router();
const DEFAULT_COLUMN_TITLES = ["未着手", "進行中", "完了"];
const DEFAULT_COLUMN_POSITION_GAP = 1000;

// 新しい行を作成する: POST /api/rows
router.post(
  "/",
  validateBody({
    title: { type: "string", required: true, notEmpty: true, maxLength: 200 },
    position: { type: "number", required: true, positive: true },
  }),
  /**
   * 行を作成する。
   * @param req - `title` と `position` を含むリクエスト
   * @param res - 作成した行を返すレスポンス
   * @param next - エラーハンドラへ委譲する関数
   * @returns 作成処理完了時に解決される Promise
   */
  async (req: Request, res: Response, next: NextFunction) => {
    const { title, position } = req.body as { title: string; position: number };
    try {
      const result = await pool.query<DbRow>(
        "INSERT INTO rows (title, position) VALUES ($1, $2) RETURNING *",
        [title, position],
      );
      res.json(result.rows[0]);
    } catch (err) {
      next(err);
    }
  },
);

// 行とデフォルト3カラムを一括作成する: POST /api/rows/with-default-columns
// DB トランザクションで処理し、途中失敗時はすべてロールバックする
router.post(
  "/with-default-columns",
  validateBody({
    title: { type: "string", required: true, notEmpty: true, maxLength: 200 },
    position: { type: "number", required: true, positive: true },
  }),
  /**
   * 行とデフォルト3カラムを単一トランザクションで作成する。
   * @param req - `title` と `position` を含むリクエスト
   * @param res - デフォルトカラムを含む行を返すレスポンス
   * @param next - エラーハンドラへ委譲する関数
   * @returns 作成処理完了時に解決される Promise
   */
  async (req: Request, res: Response, next: NextFunction) => {
    const { title, position } = req.body as { title: string; position: number };
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const rowResult = await client.query<DbRow>(
        "INSERT INTO rows (title, position) VALUES ($1, $2) RETURNING *",
        [title, position],
      );
      const row = rowResult.rows[0];

      const columns: DbColumn[] = [];
      for (const [index, columnTitle] of DEFAULT_COLUMN_TITLES.entries()) {
        const columnPosition = (index + 1) * DEFAULT_COLUMN_POSITION_GAP;
        const columnResult = await client.query<DbColumn>(
          "INSERT INTO columns (title, position, row_id) VALUES ($1, $2, $3) RETURNING *",
          [columnTitle, columnPosition, row.id],
        );
        columns.push(columnResult.rows[0]);
      }

      await client.query("COMMIT");

      const rowWithDefaultColumns: Row = {
        ...row,
        columns: columns.map((column) => ({ ...column, tasks: [] })),
      };
      res.json(rowWithDefaultColumns);
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

// 行のタイトルを更新する: PUT /api/rows/:id
router.put(
  "/:id",
  validateBody({
    title: { type: "string", required: true, notEmpty: true, maxLength: 200 },
  }),
  /**
   * 行タイトルを更新する。
   * @param req - パスパラメータ `id` と本文 `title` を含むリクエスト
   * @param res - 更新結果を返すレスポンス
   * @param next - エラーハンドラへ委譲する関数
   * @returns 更新処理完了時に解決される Promise
   */
  async (req: Request, res: Response, next: NextFunction) => {
    const id = parseId(req.params.id);
    if (!id) {
      res.status(400).json({ error: "Invalid ID" });
      return;
    }
    const { title } = req.body as { title: string };
    try {
      const result = await pool.query<DbRow>(
        "UPDATE rows SET title = $1 WHERE id = $2 RETURNING *",
        [title, id],
      );
      if (!result.rows[0]) {
        res.status(404).json({ error: "Row not found" });
        return;
      }
      res.json(result.rows[0]);
    } catch (err) {
      next(err);
    }
  },
);

// 行を削除する（配下のカラム・タスクも CASCADE で削除される）: DELETE /api/rows/:id
router.delete(
  "/:id",
  /**
   * 行を削除する。
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
      const result = await pool.query("DELETE FROM rows WHERE id = $1", [id]);
      if ((result.rowCount ?? 0) === 0) {
        res.status(404).json({ error: "Row not found" });
        return;
      }
      res.json({ success: true });
    } catch (err) {
      next(err);
    }
  },
);

export default router;
