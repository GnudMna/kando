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

const mockedPool = pool as unknown as MockedPool;

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
  });

  it("POST /api/checklist-items は有効入力なら作成して 200 を返す", async () => {
    mockedPool.query.mockResolvedValueOnce({
      rows: [
        {
          id: 10,
          task_id: 1,
          subtask_id: null,
          content: "項目",
          completed: false,
        },
      ],
    });

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
    });

    const [sql, params] = mockedPool.query.mock.calls[0] as [string, unknown[]];
    expect(sql).toContain("INSERT INTO checklist_items");
    expect(params).toEqual([1, null, "項目"]);
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
