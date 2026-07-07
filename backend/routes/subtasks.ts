import { Router } from "express";
import { parseId, validateBody } from "../middleware/validate.js";
import { asyncHandler } from "../middleware/asyncHandler.js";
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
  asyncHandler(async (req, res) => {
    const { task_id, content } = req.body as {
      task_id: number;
      content: string;
    };
    const subtask = await createSubtask(task_id, content, req.userId!);
    res.json(subtask);
  }),
);

router.put(
  "/:id",
  validateBody(updateSubtaskBodySchema),
  /**
   * PUT /api/subtasks/:id
   * サブタスク内容を更新する。
   */
  asyncHandler(async (req, res) => {
    const id = parseId(req.params.id);
    if (!id) {
      res.status(400).json({ error: "Invalid ID" });
      return;
    }
    const { content } = req.body as { content: string };
    const subtask = await updateSubtask(id, content, req.userId!);
    res.json(subtask);
  }),
);

router.delete(
  "/:id",
  /**
   * DELETE /api/subtasks/:id
   * サブタスクを削除する(配下のチェックリストも CASCADE で削除される)。
   */
  asyncHandler(async (req, res) => {
    const id = parseId(req.params.id);
    if (!id) {
      res.status(400).json({ error: "Invalid ID" });
      return;
    }
    await deleteSubtask(id, req.userId!);
    res.json({ success: true });
  }),
);

/** サブタスク CRUD API の Express ルーター。 */
export default router;
