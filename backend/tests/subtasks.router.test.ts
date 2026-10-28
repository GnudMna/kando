import express from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import subtasksRouter from "../routes/subtasks.js";
import { errorHandler } from "../middleware/errorHandler.js";
import { pool } from "../db.js";
import {
  BUMP_REVISION_SQL,
  issuedStatements,
  setupTransactionClient,
  transactionControls,
} from "./helpers/transactionClient.js";

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

  it("POST /api/subtasks は有効入力なら作成して親タスクの revision を進める", async () => {
    const client = setupTransactionClient(mockedPool.connect, (sql) => {
      if (sql.includes("FOR UPDATE")) return { rows: [{ id: 1 }] };
      if (sql.includes("INSERT INTO subtasks")) {
        return { rows: [{ id: 10, task_id: 1, content: "サブタスク" }] };
      }
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
    const statements = issuedStatements(client);
    expect(statements[0][0]).toContain("FOR UPDATE");
    expect(statements[0][1]).toEqual([1, 99]);
    expect(statements[1][0]).toContain("INSERT INTO subtasks");
    expect(statements[2]).toEqual([BUMP_REVISION_SQL, [1]]);
    expect(transactionControls(client)).toEqual(["BEGIN", "COMMIT"]);
    expect(client.release).toHaveBeenCalledTimes(1);
  });

  it("POST /api/subtasks は親タスクが無い場合 404 で revision を進めない", async () => {
    const client = setupTransactionClient(mockedPool.connect, () => undefined);

    const res = await request(createApp())
      .post("/api/subtasks")
      .send({ task_id: 999, content: "サブタスク" });

    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: "Task not found" });
    expect(issuedStatements(client)).toHaveLength(1);
    expect(transactionControls(client)).toEqual(["BEGIN", "ROLLBACK"]);
  });

  it("PUT /api/subtasks/:id は不正 ID なら 400 を返す", async () => {
    const res = await request(createApp())
      .put("/api/subtasks/abc")
      .send({ content: "更新" });

    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: "Invalid ID" });
    expect(mockedPool.query).not.toHaveBeenCalled();
  });

  it("PUT /api/subtasks/:id は有効入力なら更新して親タスクの revision を進める", async () => {
    const client = setupTransactionClient(mockedPool.connect, (sql) => {
      if (sql.includes("FOR UPDATE OF t")) return { rows: [{ id: 1 }] };
      if (sql.includes("UPDATE subtasks SET content = $1")) {
        return { rows: [{ id: 10, task_id: 1, content: "更新後" }] };
      }
    });

    const res = await request(createApp())
      .put("/api/subtasks/10")
      .send({ content: "更新後" });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ id: 10, task_id: 1, content: "更新後" });
    const statements = issuedStatements(client);
    expect(statements[0][1]).toEqual([10, 99]);
    expect(statements[1][0]).toContain("UPDATE subtasks SET content = $1");
    expect(statements[1][1]).toEqual(["更新後", 10, 99]);
    expect(statements[2]).toEqual([BUMP_REVISION_SQL, [1]]);
    expect(transactionControls(client)).toEqual(["BEGIN", "COMMIT"]);
  });

  it("PUT /api/subtasks/:id は対象が無い場合 404 で revision を進めない", async () => {
    const client = setupTransactionClient(mockedPool.connect, () => undefined);

    const res = await request(createApp())
      .put("/api/subtasks/10")
      .send({ content: "更新後" });

    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: "Subtask not found" });
    expect(issuedStatements(client)).toHaveLength(1);
    expect(transactionControls(client)).toEqual(["BEGIN", "ROLLBACK"]);
  });

  it("DELETE /api/subtasks/:id は不正 ID なら 400 を返す", async () => {
    const res = await request(createApp()).delete("/api/subtasks/0");

    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: "Invalid ID" });
    expect(mockedPool.query).not.toHaveBeenCalled();
  });

  it("DELETE /api/subtasks/:id は削除成功時に親タスクの revision を進める", async () => {
    const client = setupTransactionClient(mockedPool.connect, (sql) => {
      if (sql.includes("FOR UPDATE OF t")) return { rows: [{ id: 1 }] };
      if (sql.includes("DELETE FROM subtasks")) return { rowCount: 1 };
    });

    const res = await request(createApp()).delete("/api/subtasks/10");

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ success: true });
    const statements = issuedStatements(client);
    expect(statements[1][0]).toContain("DELETE FROM subtasks WHERE id = $1");
    expect(statements[2]).toEqual([BUMP_REVISION_SQL, [1]]);
    expect(transactionControls(client)).toEqual(["BEGIN", "COMMIT"]);
  });

  it("DELETE /api/subtasks/:id は対象が無い場合 404 で revision を進めない", async () => {
    const client = setupTransactionClient(mockedPool.connect, () => undefined);

    const res = await request(createApp()).delete("/api/subtasks/10");

    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: "Subtask not found" });
    expect(issuedStatements(client)).toHaveLength(1);
    expect(transactionControls(client)).toEqual(["BEGIN", "ROLLBACK"]);
  });
});
