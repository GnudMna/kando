import { Router, Request, Response, NextFunction } from "express";
import {
  createColumn,
  deleteColumn,
  moveColumn,
  updateColumnTitle,
} from "../services/columnsService.js";
import { parseId, validateBody } from "../middleware/validate.js";
import {
  createColumnBodySchema,
  moveColumnBodySchema,
  updateColumnTitleBodySchema,
} from "@kando/types/validation";
import { NotFoundError } from "../errors.js";

const router = Router();

router.post(
  "/",
  validateBody(createColumnBodySchema),
  /**
   * POST /api/columns
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

router.put(
  "/:id",
  validateBody(updateColumnTitleBodySchema),
  /**
   * PUT /api/columns/:id
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

router.put(
  "/:id/move",
  validateBody(moveColumnBodySchema),
  /**
   * PUT /api/columns/:id/move
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

router.delete(
  "/:id",
  /**
   * DELETE /api/columns/:id
   * カラムを削除する(配下のタスクも CASCADE で削除される)。
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

/** カラム CRUD・並び替え API の Express ルーター。 */
export default router;
