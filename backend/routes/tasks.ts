import { Router, Request, Response, NextFunction } from "express";
import type { TaskSnapshotPayload } from "@kando/types";
import { parseId, validateBody } from "../middleware/validate.js";
import {
  createTaskBodySchema,
  moveTaskBodySchema,
  taskSnapshotBodySchema,
  updateTaskBodySchema,
} from "@kando/types/validation";
import { HttpError, NotFoundError } from "../errors.js";
import {
  createTask,
  updateTask,
  saveTaskSnapshot,
  moveTask,
  copyTask,
  deleteTask,
  getTask,
} from "../services/tasksService.js";

const router = Router();

const DATE_ONLY_RE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * 期限日を `YYYY-MM-DD` の厳密形式で検証する。
 * 未指定/`null` はそのまま返し、明示指定時のみバリデーションする。
 * @param rawDueDate - 受信した期限日
 * @returns 検証済み期限日。未指定/`null` は入力値を維持
 * @throws HttpError `YYYY-MM-DD` 形式ではない場合
 */
function normalizeDueDate(
  rawDueDate: string | null | undefined,
): string | null | undefined {
  if (rawDueDate === undefined || rawDueDate === null) {
    return rawDueDate;
  }

  if (!DATE_ONLY_RE.test(rawDueDate)) {
    throw new HttpError(400, "Invalid due_date format: must be YYYY-MM-DD");
  }

  const parsed = new Date(`${rawDueDate}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime())) {
    throw new HttpError(400, "Invalid due_date: not a valid calendar date");
  }

  if (parsed.toISOString().slice(0, 10) !== rawDueDate) {
    throw new HttpError(400, "Invalid due_date: not a valid calendar date");
  }

  return rawDueDate;
}

/**
 * GET /api/tasks/:id
 * タスク詳細(サブタスク・チェックリスト・コメント含む)を取得する。
 */
router.get("/:id", async (req: Request, res: Response, next: NextFunction) => {
  const id = parseId(req.params.id);
  if (!id) {
    res.status(400).json({ error: "Invalid ID" });
    return;
  }

  try {
    const task = await getTask(id, req.userId!);
    res.json(task);
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/tasks
 * 新しいタスクを作成する。
 */
router.post(
  "/",
  validateBody(createTaskBodySchema),
  async (req: Request, res: Response, next: NextFunction) => {
    const { column_id, content, due_date, position } = req.body as {
      column_id: number;
      content: string;
      due_date?: string | null;
      position: number;
    };

    let normalizedDueDate: string | null;
    try {
      normalizedDueDate = normalizeDueDate(due_date) ?? null;
    } catch {
      res
        .status(400)
        .json({ error: "'due_date' must be in YYYY-MM-DD format" });
      return;
    }

    try {
      const task = await createTask(
        column_id,
        content,
        normalizedDueDate,
        position,
        req.userId!,
      );
      res.json(task);
    } catch (err) {
      next(err);
    }
  },
);

/**
 * PUT /api/tasks/:id
 * タスクの内容・期限・完了状態を部分更新する。
 */
router.put(
  "/:id",
  validateBody(updateTaskBodySchema),
  async (req: Request, res: Response, next: NextFunction) => {
    const id = parseId(req.params.id);
    if (!id) {
      res.status(400).json({ error: "Invalid ID" });
      return;
    }

    const body = req.body as {
      content?: string | null;
      due_date?: string | null;
      completed?: boolean;
    };
    const contentProvided = Object.prototype.hasOwnProperty.call(
      body,
      "content",
    );
    const dueDateProvided = Object.prototype.hasOwnProperty.call(
      body,
      "due_date",
    );
    const completedProvided = Object.prototype.hasOwnProperty.call(
      body,
      "completed",
    );

    if (!contentProvided && !dueDateProvided && !completedProvided) {
      res.status(400).json({
        error:
          "At least one of 'content', 'due_date', or 'completed' is required",
      });
      return;
    }

    if (contentProvided && typeof body.content !== "string") {
      res.status(400).json({ error: "'content' must be a string" });
      return;
    }

    let normalizedDueDate: string | null | undefined;
    try {
      normalizedDueDate = normalizeDueDate(body.due_date);
    } catch {
      res
        .status(400)
        .json({ error: "'due_date' must be in YYYY-MM-DD format" });
      return;
    }

    const patch: {
      content?: string;
      due_date?: string | null;
      completed?: boolean;
    } = {};
    if (contentProvided) patch.content = body.content as string;
    if (dueDateProvided) patch.due_date = normalizedDueDate ?? null;
    if (completedProvided) patch.completed = body.completed as boolean;

    try {
      const task = await updateTask(id, patch, req.userId!);
      res.json(task);
    } catch (err) {
      next(err);
    }
  },
);

/**
 * PUT /api/tasks/:id/snapshot
 * タスク編集モーダルの内容を単一トランザクションで一括保存する。
 */
router.put(
  "/:id/snapshot",
  validateBody(taskSnapshotBodySchema),
  async (req: Request, res: Response, next: NextFunction) => {
    const id = parseId(req.params.id);
    if (!id) {
      res.status(400).json({ error: "Invalid ID" });
      return;
    }

    const payload = req.body as TaskSnapshotPayload;

    let normalizedDueDate: string | null;
    try {
      normalizedDueDate = normalizeDueDate(payload.due_date) ?? null;
    } catch {
      res
        .status(400)
        .json({ error: "'due_date' must be in YYYY-MM-DD format" });
      return;
    }

    try {
      const task = await saveTaskSnapshot(
        id,
        payload,
        normalizedDueDate,
        req.userId!,
      );
      res.json(task);
    } catch (err) {
      if (err instanceof HttpError) {
        res.status(err.status).json({ error: err.message });
        return;
      }
      next(err);
    }
  },
);

/**
 * PUT /api/tasks/:id/move
 * タスクを別カラムへ移動する。
 */
router.put(
  "/:id/move",
  validateBody(moveTaskBodySchema),
  async (req: Request, res: Response, next: NextFunction) => {
    const id = parseId(req.params.id);
    if (!id) {
      res.status(400).json({ error: "Invalid ID" });
      return;
    }
    const { column_id, position } = req.body as {
      column_id: number;
      position: number;
    };
    try {
      const task = await moveTask(id, column_id, position, req.userId!);
      res.json(task);
    } catch (err) {
      next(err);
    }
  },
);

/**
 * POST /api/tasks/:id/copy
 * タスクを複製する(未完了状態でコピー)。
 */
router.post(
  "/:id/copy",
  async (req: Request, res: Response, next: NextFunction) => {
    const id = parseId(req.params.id);
    if (!id) {
      res.status(400).json({ error: "Invalid ID" });
      return;
    }

    try {
      const copied = await copyTask(id, req.userId!);
      res.status(201).json(copied);
    } catch (err) {
      next(err);
    }
  },
);

/**
 * DELETE /api/tasks/:id
 * タスクを削除する。
 */
router.delete(
  "/:id",
  async (req: Request, res: Response, next: NextFunction) => {
    const id = parseId(req.params.id);
    if (!id) {
      res.status(400).json({ error: "Invalid ID" });
      return;
    }
    try {
      const deleted = await deleteTask(id, req.userId!);
      if (!deleted) {
        throw new NotFoundError("Task not found");
      }
      res.json({ success: true });
    } catch (err) {
      next(err);
    }
  },
);

/** タスク CRUD・移動・スナップショット保存 API の Express ルーター。 */
export default router;
