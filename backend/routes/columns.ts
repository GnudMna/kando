import { Router } from "express";
import {
  createColumn,
  deleteColumn,
  moveColumn,
  updateColumnTitle,
} from "../services/columnsService.js";
import { parseId, validateBody } from "../middleware/validate.js";
import { asyncHandler } from "../middleware/asyncHandler.js";
import {
  createColumnBodySchema,
  moveColumnBodySchema,
  updateColumnTitleBodySchema,
} from "@kando/types/validation";
import { NotFoundError } from "../errors.js";
import { withRebalanced } from "../positionSlot.js";

const router = Router();

router.post(
  "/",
  validateBody(createColumnBodySchema),
  /**
   * POST /api/columns
   * カラムを作成する。
   */
  asyncHandler(async (req, res) => {
    const { title, position, row_id } = req.body as {
      title: string;
      position: number;
      row_id: number;
    };
    const column = await createColumn(title, position, row_id, req.userId!);
    if (!column) {
      throw new NotFoundError("Row not found");
    }
    res.json(column);
  }),
);

router.put(
  "/:id",
  validateBody(updateColumnTitleBodySchema),
  /**
   * PUT /api/columns/:id
   * カラムタイトルを更新する。
   */
  asyncHandler(async (req, res) => {
    const id = parseId(req.params.id);
    if (!id) {
      res.status(400).json({ error: "Invalid ID" });
      return;
    }
    const { title } = req.body as { title: string };
    const column = await updateColumnTitle(id, title, req.userId!);
    if (!column) {
      throw new NotFoundError("Column not found");
    }
    res.json(column);
  }),
);

router.put(
  "/:id/move",
  validateBody(moveColumnBodySchema),
  /**
   * PUT /api/columns/:id/move
   * カラムの表示順を更新する。
   */
  asyncHandler(async (req, res) => {
    const id = parseId(req.params.id);
    if (!id) {
      res.status(400).json({ error: "Invalid ID" });
      return;
    }
    const { position } = req.body as { position: number };
    const moved = await moveColumn(id, position, req.userId!);
    if (!moved) {
      throw new NotFoundError("Column not found");
    }
    res.json(withRebalanced(moved.column, moved.rebalanced));
  }),
);

router.delete(
  "/:id",
  /**
   * DELETE /api/columns/:id
   * カラムを削除する(配下のタスクも CASCADE で削除される)。
   */
  asyncHandler(async (req, res) => {
    const id = parseId(req.params.id);
    if (!id) {
      res.status(400).json({ error: "Invalid ID" });
      return;
    }
    const deleted = await deleteColumn(id, req.userId!);
    if (!deleted) {
      throw new NotFoundError("Column not found");
    }
    res.json({ success: true });
  }),
);

/** カラム CRUD・並び替え API の Express ルーター。 */
export default router;
