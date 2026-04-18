import express from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import taskCommentsRouter from "../routes/taskComments.js";
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
type MockedClient = {
  query: MockFn;
  release: MockFn;
};

const mockedPool = pool as unknown as MockedPool;

function setupConnectedClient(): MockedClient {
  const client: MockedClient = {
    query: vi.fn(),
    release: vi.fn(),
  };
  mockedPool.connect.mockResolvedValueOnce(client);
  return client;
}

function createApp() {
  const app = express();
  app.use(express.json());
  app.use("/api/task-comments", taskCommentsRouter);
  app.use(errorHandler);
  return app;
}

describe("task-comments router integration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("POST /api/task-comments は task_id 未指定なら 400 を返す", async () => {
    const res = await request(createApp())
      .post("/api/task-comments")
      .send({ content: "コメント" });

    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: "'task_id' is required" });
    expect(mockedPool.query).not.toHaveBeenCalled();
    expect(mockedPool.connect).not.toHaveBeenCalled();
  });

  it("POST /api/task-comments は有効入力なら作成して 200 を返す", async () => {
    const client = setupConnectedClient();
    client.query
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ id: 10 }] })
      .mockResolvedValueOnce({ rows: [{ next_position: 1000 }] })
      .mockResolvedValueOnce({
        rows: [
          {
            id: 1,
            task_id: 10,
            content: "最初のコメント",
            created_at: "2026-04-18T00:00:00.000Z",
            position: 1000,
          },
        ],
      })
      .mockResolvedValueOnce({ rows: [] });

    const res = await request(createApp())
      .post("/api/task-comments")
      .send({ task_id: 10, content: "最初のコメント" });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      id: 1,
      task_id: 10,
      content: "最初のコメント",
      created_at: "2026-04-18T00:00:00.000Z",
      position: 1000,
    });

    expect(client.query).toHaveBeenNthCalledWith(1, "BEGIN");
    expect(client.query).toHaveBeenNthCalledWith(
      2,
      "SELECT id FROM tasks WHERE id = $1 FOR UPDATE",
      [10],
    );
    expect(client.query).toHaveBeenNthCalledWith(
      3,
      "SELECT COALESCE(MAX(position), 0) + 1000 AS next_position FROM task_comments WHERE task_id = $1",
      [10],
    );
    const [insertSql, insertParams] = client.query.mock.calls[3] as [
      string,
      unknown[],
    ];
    expect(insertSql).toContain("INSERT INTO task_comments");
    expect(insertParams).toEqual([10, "最初のコメント", 1000]);
    expect(client.query).toHaveBeenNthCalledWith(5, "COMMIT");
    expect(client.release).toHaveBeenCalledTimes(1);
  });

  it("PUT /api/task-comments/:id は更新対象が存在しない場合 404 を返す", async () => {
    mockedPool.query.mockResolvedValueOnce({ rows: [] });

    const res = await request(createApp())
      .put("/api/task-comments/99")
      .send({ content: "更新" });

    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: "Comment not found" });
  });

  it("PUT /api/task-comments/:id は有効入力なら更新して 200 を返す", async () => {
    mockedPool.query.mockResolvedValueOnce({
      rows: [
        {
          id: 3,
          task_id: 10,
          content: "更新後コメント",
          created_at: "2026-04-18T00:00:00.000Z",
          position: 1000,
        },
      ],
    });

    const res = await request(createApp())
      .put("/api/task-comments/3")
      .send({ content: "更新後コメント" });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      id: 3,
      task_id: 10,
      content: "更新後コメント",
      created_at: "2026-04-18T00:00:00.000Z",
      position: 1000,
    });

    const [sql, params] = mockedPool.query.mock.calls[0] as [string, unknown[]];
    expect(sql).toContain("UPDATE task_comments SET content = $1");
    expect(params).toEqual(["更新後コメント", 3]);
  });

  it("PUT /api/task-comments/:id は position のみ更新できる", async () => {
    mockedPool.query.mockResolvedValueOnce({
      rows: [
        {
          id: 3,
          task_id: 10,
          content: "更新後コメント",
          created_at: "2026-04-18T00:00:00.000Z",
          position: 2500,
        },
      ],
    });

    const res = await request(createApp())
      .put("/api/task-comments/3")
      .send({ position: 2500 });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      id: 3,
      task_id: 10,
      content: "更新後コメント",
      created_at: "2026-04-18T00:00:00.000Z",
      position: 2500,
    });

    const [sql, params] = mockedPool.query.mock.calls[0] as [string, unknown[]];
    expect(sql).toContain("UPDATE task_comments SET position = $1");
    expect(params).toEqual([2500, 3]);
  });

  it("PUT /api/task-comments/:id は更新対象が空なら 400 を返す", async () => {
    const res = await request(createApp()).put("/api/task-comments/3").send({});

    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: "No fields to update" });
    expect(mockedPool.query).not.toHaveBeenCalled();
  });

  it("DELETE /api/task-comments/:id は削除して success を返す", async () => {
    mockedPool.query.mockResolvedValueOnce({ rowCount: 1, rows: [] });

    const res = await request(createApp()).delete("/api/task-comments/3");

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ success: true });
    expect(mockedPool.query).toHaveBeenCalledWith(
      "DELETE FROM task_comments WHERE id = $1",
      [3],
    );
  });

  it("DELETE /api/task-comments/:id は対象が存在しない場合 404 を返す", async () => {
    mockedPool.query.mockResolvedValueOnce({ rowCount: 0, rows: [] });

    const res = await request(createApp()).delete("/api/task-comments/999");

    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: "Comment not found" });
    expect(mockedPool.query).toHaveBeenCalledWith(
      "DELETE FROM task_comments WHERE id = $1",
      [999],
    );
  });
});
