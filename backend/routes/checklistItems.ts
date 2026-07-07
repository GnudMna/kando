import { Router, Request, Response, NextFunction } from "express";
import { parseId, validateBody } from "../middleware/validate.js";
import {
  createChecklistItemBodySchema,
  updateChecklistItemBodySchema,
} from "@kando/types/validation";
import {
  createChecklistItem,
  updateChecklistItem,
  deleteChecklistItem,
} from "../services/checklistItemsService.js";

const router = Router();

router.post(
  "/",
  validateBody(createChecklistItemBodySchema),
  /**
   * POST /api/checklist-items
   * チェックリスト項目を作成する。`task_id` または `subtask_id` のどちらか一方のみ必須。
   */
  async (req: Request, res: Response, next: NextFunction) => {
    const { content, task_id, subtask_id } = req.body as {
      content: string;
      task_id?: number;
      subtask_id?: number;
    };
    try {
      const item = await createChecklistItem(
        content,
        task_id ?? null,
        subtask_id ?? null,
        req.userId!,
      );
      res.json(item);
    } catch (err) {
      next(err);
    }
  },
);

router.put(
  "/:id",
  validateBody(updateChecklistItemBodySchema),
  /**
   * PUT /api/checklist-items/:id
   * チェックリスト項目を更新する。
   */
  async (req: Request, res: Response, next: NextFunction) => {
    const id = parseId(req.params.id);
    if (!id) {
      res.status(400).json({ error: "Invalid ID" });
      return;
    }
    const { completed, content, position } = req.body as {
      completed?: boolean | null;
      content?: string | null;
      position?: number | null;
    };

    if (content === null) {
      res.status(400).json({ error: "'content' must be a string" });
      return;
    }
    if (completed === null) {
      res.status(400).json({ error: "'completed' must be a boolean" });
      return;
    }
    if (position === null) {
      res.status(400).json({ error: "'position' must be a number" });
      return;
    }

    const patch: {
      completed?: boolean;
      content?: string;
      position?: number;
    } = {};
    if (completed !== undefined) patch.completed = completed;
    if (content !== undefined) patch.content = content.trim();
    if (position !== undefined) patch.position = position;

    if (Object.keys(patch).length === 0) {
      res.status(400).json({ error: "No fields to update" });
      return;
    }

    try {
      const item = await updateChecklistItem(id, patch, req.userId!);
      res.json(item);
    } catch (err) {
      next(err);
    }
  },
);

router.delete(
  "/:id",
  /**
   * DELETE /api/checklist-items/:id
   * チェックリスト項目を削除する。
   */
  async (req: Request, res: Response, next: NextFunction) => {
    const id = parseId(req.params.id);
    if (!id) {
      res.status(400).json({ error: "Invalid ID" });
      return;
    }
    try {
      await deleteChecklistItem(id, req.userId!);
      res.json({ success: true });
    } catch (err) {
      next(err);
    }
  },
);

/** チェックリスト項目 CRUD API の Express ルーター。 */
export default router;
