import express from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import subtasksRouter from "../routes/subtasks.js";
import { errorHandler } from "../middleware/errorHandler.js";
import { pool } from "../db.js";

vi.mock("../db.js", () => ({
  pool: {
    query: vi.fn(),
    connect: vi.fn(),
  },
}));

type MockFn = ReturnType<typeof vi.fn>;
type MockedPool = { query: MockFn; connect: MockFn };

const mockedPool = pool as unknown as MockedPool;

/**
 * subtasks ルーターテスト用の Express アプリを生成する。
 * @returns subtasks API をマウントした Express アプリ
 */
function createApp() {
  const app = express();
  app.use(express.json());
  app.use((_req, _res, next) => {
    (_req as express.Request & { userId?: number }).userId = 99;
    next();
  });
  app.use("/api/subtasks", subtasksRouter);
  app.use(errorHandler);
  return app;
}

describe("subtasks router", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("POST /api/subtasks は task_id 未指定なら 400 を返す", async () => {
    const res = await request(createApp())
      .post("/api/subtasks")
      .send({ content: "サブタスク" });

    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: "'task_id' is required" });
    expect(mockedPool.query).not.toHaveBeenCalled();
  });

  it("POST /api/subtasks は有効入力なら作成して 200 を返す", async () => {
    mockedPool.query
      .mockResolvedValueOnce({ rows: [{ id: 1 }] })
      .mockResolvedValueOnce({
        rows: [{ id: 10, task_id: 1, content: "サブタスク" }],
      });

    const res = await request(createApp())
      .post("/api/subtasks")
      .send({ task_id: 1, content: "サブタスク" });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      id: 10,
      task_id: 1,
      content: "サブタスク",
      checklists: [],
    });
  });

  it("POST /api/subtasks は親タスクが無い場合 404 を返す", async () => {
    mockedPool.query.mockResolvedValueOnce({ rows: [] });

    const res = await request(createApp())
      .post("/api/subtasks")
      .send({ task_id: 999, content: "サブタスク" });

    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: "Task not found" });
  });

  it("PUT /api/subtasks/:id は不正 ID なら 400 を返す", async () => {
    const res = await request(createApp())
      .put("/api/subtasks/abc")
      .send({ content: "更新" });

    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: "Invalid ID" });
    expect(mockedPool.query).not.toHaveBeenCalled();
  });

  it("PUT /api/subtasks/:id は有効入力なら更新して 200 を返す", async () => {
    mockedPool.query.mockResolvedValueOnce({
      rows: [{ id: 10, task_id: 1, content: "更新後" }],
    });

    const res = await request(createApp())
      .put("/api/subtasks/10")
      .send({ content: "更新後" });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ id: 10, task_id: 1, content: "更新後" });
    expect(mockedPool.query).toHaveBeenCalledWith(
      expect.stringContaining("UPDATE subtasks SET content = $1"),
      ["更新後", 10, 99],
    );
  });

  it("PUT /api/subtasks/:id は対象が無い場合 404 を返す", async () => {
    mockedPool.query.mockResolvedValueOnce({ rows: [] });

    const res = await request(createApp())
      .put("/api/subtasks/10")
      .send({ content: "更新後" });

    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: "Subtask not found" });
  });

  it("DELETE /api/subtasks/:id は不正 ID なら 400 を返す", async () => {
    const res = await request(createApp()).delete("/api/subtasks/0");

    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: "Invalid ID" });
    expect(mockedPool.query).not.toHaveBeenCalled();
  });

  it("DELETE /api/subtasks/:id は削除成功時 200 を返す", async () => {
    mockedPool.query.mockResolvedValueOnce({ rowCount: 1 });

    const res = await request(createApp()).delete("/api/subtasks/10");

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ success: true });
  });

  it("DELETE /api/subtasks/:id は対象が無い場合 404 を返す", async () => {
    mockedPool.query.mockResolvedValueOnce({ rowCount: 0 });

    const res = await request(createApp()).delete("/api/subtasks/10");

    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: "Subtask not found" });
  });
});
