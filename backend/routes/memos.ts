import { Router, Request, Response, NextFunction } from "express";
import { parseId, validateBody } from "../middleware/validate.js";
import {
  createMemoBodySchema,
  linkMemoTaskBodySchema,
  updateMemoBodySchema,
} from "@kando/types/validation";
import {
  listMemos,
  createMemo,
  updateMemo,
  deleteMemo,
  linkTaskToMemo,
  unlinkTaskFromMemo,
} from "../services/memosService.js";

const router = Router();

router.get(
  "/",
  /**
   * GET /api/memos
   * 認証ユーザーのメモを更新日時降順で返す(紐付くタスク情報を含む)。
   */
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const memos = await listMemos(req.userId!);
      res.json(memos);
    } catch (err) {
      next(err);
    }
  },
);

router.post(
  "/",
  validateBody(createMemoBodySchema),
  /**
   * POST /api/memos
   * 新しいメモを作成する。
   */
  async (req: Request, res: Response, next: NextFunction) => {
    const { title = "", content = "" } = req.body as {
      title?: string;
      content?: string;
    };
    try {
      const memo = await createMemo(req.userId!, title, content);
      res.status(201).json(memo);
    } catch (err) {
      next(err);
    }
  },
);

router.put(
  "/:id",
  validateBody(updateMemoBodySchema),
  /**
   * PUT /api/memos/:id
   * 指定 ID のメモを更新する。
   */
  async (req: Request, res: Response, next: NextFunction) => {
    const id = parseId(req.params.id);
    if (!id) {
      res.status(400).json({ error: "Invalid memo id" });
      return;
    }
    const { title, content } = req.body as {
      title?: string;
      content?: string;
    };
    try {
      const updated = await updateMemo(id, req.userId!, title, content);
      res.json(updated);
    } catch (err) {
      next(err);
    }
  },
);

router.delete(
  "/:id",
  /**
   * DELETE /api/memos/:id
   * 指定 ID のメモを削除する。
   */
  async (req: Request, res: Response, next: NextFunction) => {
    const id = parseId(req.params.id);
    if (!id) {
      res.status(400).json({ error: "Invalid memo id" });
      return;
    }
    try {
      await deleteMemo(id, req.userId!);
      res.status(204).send();
    } catch (err) {
      next(err);
    }
  },
);

router.post(
  "/:id/tasks",
  validateBody(linkMemoTaskBodySchema),
  /**
   * POST /api/memos/:id/tasks
   * タスクとメモを関連付ける。
   */
  async (req: Request, res: Response, next: NextFunction) => {
    const memoId = parseId(req.params.id);
    if (!memoId) {
      res.status(400).json({ error: "Invalid memo id" });
      return;
    }
    const { task_id } = req.body as { task_id: number };
    try {
      const updated = await linkTaskToMemo(memoId, task_id, req.userId!);
      res.json(updated);
    } catch (err) {
      next(err);
    }
  },
);

router.delete(
  "/:id/tasks/:taskId",
  /**
   * DELETE /api/memos/:id/tasks/:taskId
   * タスクとメモの関連付けを解除する。
   */
  async (req: Request, res: Response, next: NextFunction) => {
    const memoId = parseId(req.params.id);
    const taskId = parseId(req.params.taskId);
    if (!memoId || !taskId) {
      res.status(400).json({ error: "Invalid id" });
      return;
    }
    try {
      const updated = await unlinkTaskFromMemo(memoId, taskId, req.userId!);
      res.json(updated);
    } catch (err) {
      next(err);
    }
  },
);

/** メモ CRUD・タスク関連付け API の Express ルーター。 */
export default router;
