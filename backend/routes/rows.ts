// 行（プロジェクト単位）に対する CRUD エンドポイントを定義するルーター
import { Router, Request, Response, NextFunction } from "express";
import {
  createRow,
  createRowWithDefaultColumns,
  deleteRow,
  updateRowTitle,
} from "../services/rowsService.js";
import { parseId, validateBody } from "../middleware/validate.js";

const router = Router();

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
      const row = await createRow(title, position, req.userId!);
      res.json(row);
    } catch (err) {
      next(err);
    }
  },
);

// 行とデフォルト3カラムを一括作成する: POST /api/rows/with-default-columns
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
    try {
      const rowWithDefaultColumns = await createRowWithDefaultColumns(
        title,
        position,
        req.userId!,
      );
      res.json(rowWithDefaultColumns);
    } catch (err) {
      next(err);
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
      const row = await updateRowTitle(id, title, req.userId!);
      if (!row) {
        res.status(404).json({ error: "Row not found" });
        return;
      }
      res.json(row);
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
      const deleted = await deleteRow(id, req.userId!);
      if (!deleted) {
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
