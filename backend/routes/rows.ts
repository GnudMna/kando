import { Router } from "express";
import {
  createRow,
  createRowWithDefaultColumns,
  deleteRow,
  updateRowTitle,
} from "../services/rowsService.js";
import { parseId, validateBody } from "../middleware/validate.js";
import { asyncHandler } from "../middleware/asyncHandler.js";
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
   */
  asyncHandler(async (req, res) => {
    const { title, position } = req.body as { title: string; position: number };
    const row = await createRow(title, position, req.userId!);
    res.json(row);
  }),
);

router.post(
  "/with-default-columns",
  validateBody(createRowBodySchema),
  /**
   * POST /api/rows/with-default-columns
   * 行とデフォルト3カラムを単一トランザクションで作成する。
   */
  asyncHandler(async (req, res) => {
    const { title, position } = req.body as { title: string; position: number };
    const rowWithDefaultColumns = await createRowWithDefaultColumns(
      title,
      position,
      req.userId!,
    );
    res.json(rowWithDefaultColumns);
  }),
);

router.put(
  "/:id",
  validateBody(updateRowTitleBodySchema),
  /**
   * PUT /api/rows/:id
   * 行タイトルを更新する。
   */
  asyncHandler(async (req, res) => {
    const id = parseId(req.params.id);
    if (!id) {
      res.status(400).json({ error: "Invalid ID" });
      return;
    }
    const { title } = req.body as { title: string };
    const row = await updateRowTitle(id, title, req.userId!);
    if (!row) {
      throw new NotFoundError("Row not found");
    }
    res.json(row);
  }),
);

router.delete(
  "/:id",
  /**
   * DELETE /api/rows/:id
   * 行を削除する(配下のカラム・タスクも CASCADE で削除される)。
   */
  asyncHandler(async (req, res) => {
    const id = parseId(req.params.id);
    if (!id) {
      res.status(400).json({ error: "Invalid ID" });
      return;
    }
    const deleted = await deleteRow(id, req.userId!);
    if (!deleted) {
      throw new NotFoundError("Row not found");
    }
    res.json({ success: true });
  }),
);

/** 行(プロジェクト)CRUD API の Express ルーター。 */
export default router;
