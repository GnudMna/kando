import { Router, Request, Response, NextFunction } from "express";
import {
  createRow,
  createRowWithDefaultColumns,
  deleteRow,
  updateRowTitle,
} from "../services/rowsService.js";
import { parseId, validateBody } from "../middleware/validate.js";
import {
  createRowBodySchema,
  updateRowTitleBodySchema,
} from "@kando/types/validation";
import { NotFoundError } from "../errors.js";

const router = Router();

router.post(
  "/",
  validateBody(createRowBodySchema),
  /**
   * POST /api/rows
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

router.post(
  "/with-default-columns",
  validateBody(createRowBodySchema),
  /**
   * POST /api/rows/with-default-columns
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

router.put(
  "/:id",
  validateBody(updateRowTitleBodySchema),
  /**
   * PUT /api/rows/:id
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
        throw new NotFoundError("Row not found");
      }
      res.json(row);
    } catch (err) {
      next(err);
    }
  },
);

router.delete(
  "/:id",
  /**
   * DELETE /api/rows/:id
   * 行を削除する(配下のカラム・タスクも CASCADE で削除される)。
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
        throw new NotFoundError("Row not found");
      }
      res.json({ success: true });
    } catch (err) {
      next(err);
    }
  },
);

/** 行(プロジェクト)CRUD API の Express ルーター。 */
export default router;
