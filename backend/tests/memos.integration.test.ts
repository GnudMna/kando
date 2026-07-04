import express from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import memosRouter from "../routes/memos.js";
import { errorHandler } from "../middleware/errorHandler.js";
import { pool } from "../db.js";

vi.mock("../db.js", () => ({
  pool: {
    query: vi.fn(),
    connect: vi.fn(),
  },
}));

type MockFn = ReturnType<typeof vi.fn>;
type MockedPool = {
  query: MockFn;
  connect: MockFn;
};

const mockedPool = pool as unknown as MockedPool;

const sampleMemo = {
  id: 1,
  user_id: 99,
  title: "メモA",
  content: "内容A",
  created_at: "2026-01-01T00:00:00.000Z",
  updated_at: "2026-01-01T00:00:00.000Z",
  tasks: [],
};

/**
 * memos ルーター統合テスト用の Express アプリを生成する。
 * @returns memos API をマウントした Express アプリ
 */
function createApp() {
  const app = express();
  app.use(express.json());
  app.use((_req, _res, next) => {
    (_req as express.Request & { userId?: number }).userId = 99;
    next();
  });
  app.use("/api/memos", memosRouter);
  app.use(errorHandler);
  return app;
}

describe("memos router integration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("GET /api/memos はユーザーのメモ一覧を返す", async () => {
    mockedPool.query.mockResolvedValueOnce({ rows: [sampleMemo] });

    const res = await request(createApp()).get("/api/memos");

    expect(res.status).toBe(200);
    expect(res.body).toEqual([sampleMemo]);
    const [sql, params] = mockedPool.query.mock.calls[0] as [string, unknown[]];
    expect(sql).toContain("WHERE m.user_id = $1");
    expect(params).toEqual([99]);
  });

  it("POST /api/memos はメモを作成する", async () => {
    mockedPool.query.mockResolvedValueOnce({
      rows: [
        {
          id: 2,
          user_id: 99,
          title: "新規",
          content: "本文",
          created_at: "2026-01-02T00:00:00.000Z",
          updated_at: "2026-01-02T00:00:00.000Z",
        },
      ],
    });

    const res = await request(createApp())
      .post("/api/memos")
      .send({ title: "新規", content: "本文" });

    expect(res.status).toBe(201);
    expect(res.body.title).toBe("新規");
    expect(res.body.tasks).toEqual([]);
    const [sql, params] = mockedPool.query.mock.calls[0] as [string, unknown[]];
    expect(sql).toContain("INSERT INTO memos");
    expect(params).toEqual([99, "新規", "本文"]);
  });

  it("PUT /api/memos/:id はメモを更新する", async () => {
    const updatedMemo = {
      ...sampleMemo,
      title: "更新後",
      content: "更新本文",
    };
    mockedPool.query
      .mockResolvedValueOnce({ rowCount: 1, rows: [updatedMemo] })
      .mockResolvedValueOnce({ rows: [updatedMemo] });

    const res = await request(createApp())
      .put("/api/memos/1")
      .send({ title: "更新後", content: "更新本文" });

    expect(res.status).toBe(200);
    expect(res.body).toEqual(updatedMemo);
    const [updateSql] = mockedPool.query.mock.calls[0] as [string];
    expect(updateSql).toContain("WHERE id = $3 AND user_id = $4");
  });

  it("PUT /api/memos/:id は不正 ID を 400 で拒否する", async () => {
    const res = await request(createApp())
      .put("/api/memos/abc")
      .send({ title: "更新後" });

    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: "Invalid memo id" });
    expect(mockedPool.query).not.toHaveBeenCalled();
  });

  it("PUT /api/memos/:id は存在しないメモを 404 で返す", async () => {
    mockedPool.query.mockResolvedValueOnce({ rowCount: 0, rows: [] });

    const res = await request(createApp())
      .put("/api/memos/999")
      .send({ title: "更新後" });

    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: "Memo not found" });
  });

  it("DELETE /api/memos/:id はメモを削除する", async () => {
    mockedPool.query.mockResolvedValueOnce({ rowCount: 1, rows: [] });

    const res = await request(createApp()).delete("/api/memos/1");

    expect(res.status).toBe(204);
    const [sql, params] = mockedPool.query.mock.calls[0] as [string, unknown[]];
    expect(sql).toContain("DELETE FROM memos WHERE id = $1 AND user_id = $2");
    expect(params).toEqual([1, 99]);
  });

  it("DELETE /api/memos/:id は存在しないメモを 404 で返す", async () => {
    mockedPool.query.mockResolvedValueOnce({ rowCount: 0, rows: [] });

    const res = await request(createApp()).delete("/api/memos/999");

    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: "Memo not found" });
  });

  it("POST /api/memos/:id/tasks はタスクを関連付ける", async () => {
    const linkedMemo = {
      ...sampleMemo,
      tasks: [{ id: 10, content: "タスク" }],
    };
    mockedPool.query
      .mockResolvedValueOnce({ rowCount: 1, rows: [{ id: 1 }] })
      .mockResolvedValueOnce({ rowCount: 1, rows: [{ id: 10 }] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [linkedMemo] });

    const res = await request(createApp())
      .post("/api/memos/1/tasks")
      .send({ task_id: 10 });

    expect(res.status).toBe(200);
    expect(res.body.tasks).toHaveLength(1);
    const linkSql = mockedPool.query.mock.calls[2]?.[0] as string;
    expect(linkSql).toContain("INSERT INTO task_memo_links");
  });

  it("POST /api/memos/:id/tasks は所有権のないメモを 404 で返す", async () => {
    mockedPool.query.mockResolvedValueOnce({ rowCount: 0, rows: [] });

    const res = await request(createApp())
      .post("/api/memos/1/tasks")
      .send({ task_id: 10 });

    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: "Memo not found" });
  });

  it("POST /api/memos/:id/tasks は所有権のないタスクを 404 で返す", async () => {
    mockedPool.query
      .mockResolvedValueOnce({ rowCount: 1, rows: [{ id: 1 }] })
      .mockResolvedValueOnce({ rowCount: 0, rows: [] });

    const res = await request(createApp())
      .post("/api/memos/1/tasks")
      .send({ task_id: 10 });

    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: "Task not found" });
  });

  it("DELETE /api/memos/:id/tasks/:taskId は関連付けを解除する", async () => {
    mockedPool.query
      .mockResolvedValueOnce({ rowCount: 1, rows: [{ id: 1 }] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [sampleMemo] });

    const res = await request(createApp()).delete("/api/memos/1/tasks/10");

    expect(res.status).toBe(200);
    expect(res.body).toEqual(sampleMemo);
    const unlinkSql = mockedPool.query.mock.calls[1]?.[0] as string;
    expect(unlinkSql).toContain(
      "DELETE FROM task_memo_links WHERE task_id = $1 AND memo_id = $2",
    );
  });

  it("DELETE /api/memos/:id/tasks/:taskId は不正 ID を 400 で拒否する", async () => {
    const res = await request(createApp()).delete("/api/memos/1/tasks/abc");

    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: "Invalid id" });
    expect(mockedPool.query).not.toHaveBeenCalled();
  });
});
