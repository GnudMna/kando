import express from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import tasksRouter from "../routes/tasks.js";
import { errorHandler } from "../middleware/errorHandler.js";
import * as tasksService from "../services/tasksService.js";
import { NotFoundError } from "../errors.js";
import type { Task } from "@kando/types";

vi.mock("../services/tasksService.js", () => ({
  createTask: vi.fn(),
  updateTask: vi.fn(),
  saveTaskSnapshot: vi.fn(),
  moveTask: vi.fn(),
  copyTask: vi.fn(),
  deleteTask: vi.fn(),
}));

const baseTask: Task = {
  id: 1,
  column_id: 10,
  content: "タスク",
  due_date: null,
  position: 1000,
  completed: false,
  subtasks: [],
  checklists: [],
  comments: [],
};

/**
 * tasks ルーター統合テスト用の Express アプリを生成する。
 * @returns tasks API をマウントした Express アプリ
 */
function createApp() {
  const app = express();
  app.use(express.json());
  app.use((_req, _res, next) => {
    (_req as express.Request & { userId?: number }).userId = 99;
    next();
  });
  app.use("/api/tasks", tasksRouter);
  app.use(errorHandler);
  return app;
}

describe("tasks router integration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("POST /api/tasks", () => {
    it("有効入力ならタスクを作成して 200 を返す", async () => {
      vi.mocked(tasksService.createTask).mockResolvedValueOnce(baseTask);

      const res = await request(createApp()).post("/api/tasks").send({
        column_id: 10,
        content: "新タスク",
        position: 1000,
        due_date: "2026-06-01",
      });

      expect(res.status).toBe(200);
      expect(res.body).toEqual(baseTask);
      expect(tasksService.createTask).toHaveBeenCalledWith(
        10,
        "新タスク",
        "2026-06-01",
        1000,
        99,
      );
    });

    it("column_id 未指定なら 400 を返す", async () => {
      const res = await request(createApp()).post("/api/tasks").send({
        content: "新タスク",
        position: 1000,
      });

      expect(res.status).toBe(400);
      expect(res.body).toEqual({ error: "'column_id' is required" });
      expect(tasksService.createTask).not.toHaveBeenCalled();
    });

    it("不正な due_date なら 400 を返す", async () => {
      const res = await request(createApp()).post("/api/tasks").send({
        column_id: 10,
        content: "新タスク",
        position: 1000,
        due_date: "06/01/2026",
      });

      expect(res.status).toBe(400);
      expect(res.body).toEqual({
        error: "'due_date' must be in YYYY-MM-DD format",
      });
    });
  });

  describe("PUT /api/tasks/:id", () => {
    it("有効入力ならタスクを更新して 200 を返す", async () => {
      const updated = { ...baseTask, content: "更新後", completed: true };
      vi.mocked(tasksService.updateTask).mockResolvedValueOnce(updated);

      const res = await request(createApp())
        .put("/api/tasks/1")
        .send({ content: "更新後", completed: true });

      expect(res.status).toBe(200);
      expect(res.body).toEqual(updated);
      expect(tasksService.updateTask).toHaveBeenCalledWith(
        1,
        { content: "更新後", completed: true },
        99,
      );
    });

    it("不正 ID なら 400 を返す", async () => {
      const res = await request(createApp())
        .put("/api/tasks/abc")
        .send({ content: "更新" });

      expect(res.status).toBe(400);
      expect(res.body).toEqual({ error: "Invalid ID" });
    });

    it("更新フィールドが無い場合 400 を返す", async () => {
      const res = await request(createApp()).put("/api/tasks/1").send({});

      expect(res.status).toBe(400);
      expect(res.body).toEqual({
        error:
          "At least one of 'content', 'due_date', or 'completed' is required",
      });
    });

    it("due_date: null で期限をクリアできる", async () => {
      vi.mocked(tasksService.updateTask).mockResolvedValueOnce({
        ...baseTask,
        due_date: null,
      });

      const res = await request(createApp())
        .put("/api/tasks/1")
        .send({ due_date: null });

      expect(res.status).toBe(200);
      expect(tasksService.updateTask).toHaveBeenCalledWith(
        1,
        { due_date: null },
        99,
      );
    });
  });

  describe("PUT /api/tasks/:id/move", () => {
    it("有効入力ならタスクを移動して 200 を返す", async () => {
      const moved = { ...baseTask, column_id: 11, position: 2000 };
      vi.mocked(tasksService.moveTask).mockResolvedValueOnce(moved);

      const res = await request(createApp()).put("/api/tasks/1/move").send({
        column_id: 11,
        position: 2000,
      });

      expect(res.status).toBe(200);
      expect(res.body).toEqual(moved);
      expect(tasksService.moveTask).toHaveBeenCalledWith(1, 11, 2000, 99);
    });

    it("column_id 未指定なら 400 を返す", async () => {
      const res = await request(createApp())
        .put("/api/tasks/1/move")
        .send({ position: 1000 });

      expect(res.status).toBe(400);
      expect(res.body).toEqual({ error: "'column_id' is required" });
    });
  });

  describe("POST /api/tasks/:id/copy", () => {
    it("タスクをコピーして 201 を返す", async () => {
      const copied = { ...baseTask, id: 2, content: "タスク のコピー" };
      vi.mocked(tasksService.copyTask).mockResolvedValueOnce(copied);

      const res = await request(createApp()).post("/api/tasks/1/copy");

      expect(res.status).toBe(201);
      expect(res.body).toEqual(copied);
      expect(tasksService.copyTask).toHaveBeenCalledWith(1, 99);
    });

    it("対象が無い場合 404 を返す", async () => {
      vi.mocked(tasksService.copyTask).mockRejectedValueOnce(
        new NotFoundError("Task not found"),
      );

      const res = await request(createApp()).post("/api/tasks/999/copy");

      expect(res.status).toBe(404);
      expect(res.body).toEqual({ error: "Task not found" });
    });
  });

  describe("DELETE /api/tasks/:id", () => {
    it("削除成功時 200 を返す", async () => {
      vi.mocked(tasksService.deleteTask).mockResolvedValueOnce(true);

      const res = await request(createApp()).delete("/api/tasks/1");

      expect(res.status).toBe(200);
      expect(res.body).toEqual({ success: true });
    });

    it("対象が無い場合 404 を返す", async () => {
      vi.mocked(tasksService.deleteTask).mockResolvedValueOnce(false);

      const res = await request(createApp()).delete("/api/tasks/999");

      expect(res.status).toBe(404);
      expect(res.body).toEqual({ error: "Task not found" });
    });
  });

  describe("PUT /api/tasks/:id/snapshot バリデーション", () => {
    it("重複した checklists.id を拒否する", async () => {
      const res = await request(createApp())
        .put("/api/tasks/1/snapshot")
        .send({
          content: "タスク",
          due_date: null,
          completed: false,
          checklists: [
            { id: 1, content: "A", completed: false },
            { id: 1, content: "B", completed: false },
          ],
          subtasks: [],
          comments: [],
        });

      expect(res.status).toBe(400);
      expect(res.body).toEqual({ error: "Duplicate 'checklists.id': 1" });
      expect(tasksService.saveTaskSnapshot).not.toHaveBeenCalled();
    });

    it("不正な due_date 形式を拒否する", async () => {
      const res = await request(createApp()).put("/api/tasks/1/snapshot").send({
        content: "タスク",
        due_date: "2026/06/01",
        completed: false,
        checklists: [],
        subtasks: [],
        comments: [],
      });

      expect(res.status).toBe(400);
      expect(res.body).toEqual({
        error: "'due_date' must be in YYYY-MM-DD format",
      });
    });
  });
});
