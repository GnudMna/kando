import { Router, Request, Response, NextFunction } from "express";
import { parseId, validateBody } from "../middleware/validate.js";
import {
  createTaskCommentBodySchema,
  updateTaskCommentBodySchema,
} from "@kando/types/validation";
import {
  createTaskComment,
  updateTaskComment,
  deleteTaskComment,
} from "../services/taskCommentsService.js";

const router = Router();

router.post(
  "/",
  validateBody(createTaskCommentBodySchema),
  /**
   * POST /api/task-comments
   * タスクコメントを作成する。
   */
  async (req: Request, res: Response, next: NextFunction) => {
    const { task_id, content } = req.body as {
      task_id: number;
      content: string;
    };
    try {
      const comment = await createTaskComment(task_id, content, req.userId!);
      res.json(comment);
    } catch (err) {
      next(err);
    }
  },
);

router.put(
  "/:id",
  validateBody(updateTaskCommentBodySchema),
  /**
   * PUT /api/task-comments/:id
   * タスクコメントを更新する。
   */
  async (req: Request, res: Response, next: NextFunction) => {
    const id = parseId(req.params.id);
    if (!id) {
      res.status(400).json({ error: "Invalid ID" });
      return;
    }
    const { content, position } = req.body as {
      content?: string | null;
      position?: number | null;
    };

    if (content === null) {
      res.status(400).json({ error: "'content' must be a string" });
      return;
    }
    if (position === null) {
      res.status(400).json({ error: "'position' must be a number" });
      return;
    }

    const patch: { content?: string; position?: number } = {};
    if (content !== undefined) patch.content = content;
    if (position !== undefined) patch.position = position;

    if (Object.keys(patch).length === 0) {
      res.status(400).json({ error: "No fields to update" });
      return;
    }

    try {
      const comment = await updateTaskComment(id, patch, req.userId!);
      res.json(comment);
    } catch (err) {
      next(err);
    }
  },
);

router.delete(
  "/:id",
  /**
   * DELETE /api/task-comments/:id
   * タスクコメントを削除する。
   */
  async (req: Request, res: Response, next: NextFunction) => {
    const id = parseId(req.params.id);
    if (!id) {
      res.status(400).json({ error: "Invalid ID" });
      return;
    }
    try {
      await deleteTaskComment(id, req.userId!);
      res.json({ success: true });
    } catch (err) {
      next(err);
    }
  },
);

/** タスクコメント CRUD API の Express ルーター。 */
export default router;
