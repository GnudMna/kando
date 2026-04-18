import express from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import checklistItemsRouter from "../routes/checklistItems.js";
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
  app.use("/api/checklist-items", checklistItemsRouter);
  app.use(errorHandler);
  return app;
}

describe("checklist-items router integration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("POST /api/checklist-items は task_id と subtask_id が同時指定なら 400 を返す", async () => {
    const res = await request(createApp())
      .post("/api/checklist-items")
      .send({ task_id: 1, subtask_id: 2, content: "項目" });

    expect(res.status).toBe(400);
    expect(res.body).toEqual({
      error: "Exactly one of 'task_id' or 'subtask_id' is required",
    });
    expect(mockedPool.query).not.toHaveBeenCalled();
    expect(mockedPool.connect).not.toHaveBeenCalled();
  });

  it("POST /api/checklist-items は参照先が未指定なら 400 を返す", async () => {
    const res = await request(createApp())
      .post("/api/checklist-items")
      .send({ content: "項目" });

    expect(res.status).toBe(400);
    expect(res.body).toEqual({
      error: "Exactly one of 'task_id' or 'subtask_id' is required",
    });
    expect(mockedPool.query).not.toHaveBeenCalled();
    expect(mockedPool.connect).not.toHaveBeenCalled();
  });

  it("POST /api/checklist-items は有効入力なら作成して 200 を返す", async () => {
    const client = setupConnectedClient();
    client.query
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ id: 1 }] })
      .mockResolvedValueOnce({ rows: [{ next_position: 1000 }] })
      .mockResolvedValueOnce({
        rows: [
          {
            id: 10,
            task_id: 1,
            subtask_id: null,
            content: "項目",
            completed: false,
            position: 1000,
          },
        ],
      })
      .mockResolvedValueOnce({ rows: [] });

    const res = await request(createApp())
      .post("/api/checklist-items")
      .send({ task_id: 1, content: "項目" });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      id: 10,
      task_id: 1,
      subtask_id: null,
      content: "項目",
      completed: false,
      position: 1000,
    });

    expect(client.query).toHaveBeenNthCalledWith(1, "BEGIN");
    expect(client.query).toHaveBeenNthCalledWith(
      2,
      "SELECT id FROM tasks WHERE id = $1 FOR UPDATE",
      [1],
    );
    expect(client.query).toHaveBeenNthCalledWith(
      3,
      "SELECT COALESCE(MAX(position), 0) + 1000 AS next_position FROM checklist_items WHERE task_id = $1",
      [1],
    );
    const [insertSql, insertParams] = client.query.mock.calls[3] as [
      string,
      unknown[],
    ];
    expect(insertSql).toContain("INSERT INTO checklist_items");
    expect(insertParams).toEqual([1, null, "項目", 1000]);
    expect(client.query).toHaveBeenNthCalledWith(5, "COMMIT");
    expect(client.release).toHaveBeenCalledTimes(1);
  });

  it("POST /api/checklist-items は subtask_id 指定時もロックして採番する", async () => {
    const client = setupConnectedClient();
    client.query
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ id: 20 }] })
      .mockResolvedValueOnce({ rows: [{ next_position: 2000 }] })
      .mockResolvedValueOnce({
        rows: [
          {
            id: 11,
            task_id: null,
            subtask_id: 20,
            content: "サブタスク項目",
            completed: false,
            position: 2000,
          },
        ],
      })
      .mockResolvedValueOnce({ rows: [] });

    const res = await request(createApp())
      .post("/api/checklist-items")
      .send({ subtask_id: 20, content: "サブタスク項目" });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      id: 11,
      task_id: null,
      subtask_id: 20,
      content: "サブタスク項目",
      completed: false,
      position: 2000,
    });

    expect(client.query).toHaveBeenNthCalledWith(1, "BEGIN");
    expect(client.query).toHaveBeenNthCalledWith(
      2,
      "SELECT id FROM subtasks WHERE id = $1 FOR UPDATE",
      [20],
    );
    expect(client.query).toHaveBeenNthCalledWith(
      3,
      "SELECT COALESCE(MAX(position), 0) + 1000 AS next_position FROM checklist_items WHERE subtask_id = $1",
      [20],
    );
    const [insertSql, insertParams] = client.query.mock.calls[3] as [
      string,
      unknown[],
    ];
    expect(insertSql).toContain("INSERT INTO checklist_items");
    expect(insertParams).toEqual([null, 20, "サブタスク項目", 2000]);
    expect(client.query).toHaveBeenNthCalledWith(5, "COMMIT");
    expect(client.release).toHaveBeenCalledTimes(1);
  });

  it("PUT /api/checklist-items/:id は更新対象が空なら 400 を返す", async () => {
    const res = await request(createApp())
      .put("/api/checklist-items/1")
      .send({});

    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: "No fields to update" });
    expect(mockedPool.query).not.toHaveBeenCalled();
  });

  it("PUT /api/checklist-items/:id は content の文字数超過を 400 で拒否する", async () => {
    const res = await request(createApp())
      .put("/api/checklist-items/1")
      .send({ content: "a".repeat(501) });

    expect(res.status).toBe(400);
    expect(res.body).toEqual({
      error: "'content' must be 500 characters or fewer",
    });
    expect(mockedPool.query).not.toHaveBeenCalled();
  });

  it("PUT /api/checklist-items/:id は有効入力なら更新して 200 を返す", async () => {
    mockedPool.query.mockResolvedValueOnce({
      rows: [
        {
          id: 5,
          task_id: 1,
          subtask_id: null,
          content: "更新後",
          completed: true,
        },
      ],
    });

    const res = await request(createApp())
      .put("/api/checklist-items/5")
      .send({ completed: true, content: "更新後" });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      id: 5,
      task_id: 1,
      subtask_id: null,
      content: "更新後",
      completed: true,
    });

    const [sql, params] = mockedPool.query.mock.calls[0] as [string, unknown[]];
    expect(sql).toContain("UPDATE checklist_items SET");
    expect(params).toEqual([true, "更新後", 5]);
  });
});
