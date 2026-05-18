// カラム（ステータス列）に対する CRUD エンドポイントを定義するルーター
import { Router, Request, Response, NextFunction } from "express";
import {
  createColumn,
  deleteColumn,
  moveColumn,
  updateColumnTitle,
} from "../services/columnsService.js";
import { parseId, validateBody } from "../middleware/validate.js";
import { NotFoundError } from "../errors.js";

const router = Router();

// 新しいカラムを作成する: POST /api/columns
router.post(
  "/",
  validateBody({
    title: { type: "string", required: true, notEmpty: true, maxLength: 200 },
    position: { type: "number", required: true, positive: true },
    row_id: { type: "number", required: true, integer: true, positive: true },
  }),
  /**
   * カラムを作成する。
   * @param req - `title` `position` `row_id` を含むリクエスト
   * @param res - 作成したカラムを返すレスポンス
   * @param next - エラーハンドラへ委譲する関数
   * @returns 作成処理完了時に解決される Promise
   */
  async (req: Request, res: Response, next: NextFunction) => {
    const { title, position, row_id } = req.body as {
      title: string;
      position: number;
      row_id: number;
    };
    try {
      const column = await createColumn(title, position, row_id, req.userId!);
      if (!column) {
        throw new NotFoundError("Row not found");
      }
      res.json(column);
    } catch (err) {
      next(err);
    }
  },
);

// カラムのタイトルを更新する: PUT /api/columns/:id
router.put(
  "/:id",
  validateBody({
    title: { type: "string", required: true, notEmpty: true, maxLength: 200 },
  }),
  /**
   * カラムタイトルを更新する。
   * @param req - パスパラメータ `id` と本文 `title` を含むリクエスト
   * @param res - 更新後カラムを返すレスポンス
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
      const column = await updateColumnTitle(id, title, req.userId!);
      if (!column) {
        throw new NotFoundError("Column not found");
      }
      res.json(column);
    } catch (err) {
      next(err);
    }
  },
);

// カラムの表示順（position）を更新する: PUT /api/columns/:id/move
router.put(
  "/:id/move",
  validateBody({
    position: { type: "number", required: true, positive: true },
  }),
  /**
   * カラムの表示順を更新する。
   * @param req - パスパラメータ `id` と本文 `position` を含むリクエスト
   * @param res - 更新後カラムを返すレスポンス
   * @param next - エラーハンドラへ委譲する関数
   * @returns 更新処理完了時に解決される Promise
   */
  async (req: Request, res: Response, next: NextFunction) => {
    const id = parseId(req.params.id);
    if (!id) {
      res.status(400).json({ error: "Invalid ID" });
      return;
    }
    const { position } = req.body as { position: number };
    try {
      const column = await moveColumn(id, position, req.userId!);
      if (!column) {
        throw new NotFoundError("Column not found");
      }
      res.json(column);
    } catch (err) {
      next(err);
    }
  },
);

// カラムを削除する（配下のタスクも CASCADE で削除される）: DELETE /api/columns/:id
router.delete(
  "/:id",
  /**
   * カラムを削除する。
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
      const deleted = await deleteColumn(id, req.userId!);
      if (!deleted) {
        throw new NotFoundError("Column not found");
      }
      res.json({ success: true });
    } catch (err) {
      next(err);
    }
  },
);

export default router;
