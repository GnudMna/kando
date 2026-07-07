import { Router, Request, Response, NextFunction } from "express";
import { parseId, validateBody } from "../middleware/validate.js";
import {
  createSubtaskBodySchema,
  updateSubtaskBodySchema,
} from "@kando/types/validation";
import {
  createSubtask,
  updateSubtask,
  deleteSubtask,
} from "../services/subtasksService.js";

const router = Router();

router.post(
  "/",
  validateBody(createSubtaskBodySchema),
  /**
   * POST /api/subtasks
   * サブタスクを作成する。
   */
  async (req: Request, res: Response, next: NextFunction) => {
    const { task_id, content } = req.body as {
      task_id: number;
      content: string;
    };
    try {
      const subtask = await createSubtask(task_id, content, req.userId!);
      res.json(subtask);
    } catch (err) {
      next(err);
    }
  },
);

router.put(
  "/:id",
  validateBody(updateSubtaskBodySchema),
  /**
   * PUT /api/subtasks/:id
   * サブタスク内容を更新する。
   */
  async (req: Request, res: Response, next: NextFunction) => {
    const id = parseId(req.params.id);
    if (!id) {
      res.status(400).json({ error: "Invalid ID" });
      return;
    }
    const { content } = req.body as { content: string };
    try {
      const subtask = await updateSubtask(id, content, req.userId!);
      res.json(subtask);
    } catch (err) {
      next(err);
    }
  },
);

router.delete(
  "/:id",
  /**
   * DELETE /api/subtasks/:id
   * サブタスクを削除する(配下のチェックリストも CASCADE で削除される)。
   */
  async (req: Request, res: Response, next: NextFunction) => {
    const id = parseId(req.params.id);
    if (!id) {
      res.status(400).json({ error: "Invalid ID" });
      return;
    }
    try {
      await deleteSubtask(id, req.userId!);
      res.json({ success: true });
    } catch (err) {
      next(err);
    }
  },
);

/** サブタスク CRUD API の Express ルーター。 */
export default router;
