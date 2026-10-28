import express from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import checklistItemsRouter from "../routes/checklistItems.js";
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
type MockedPool = {
  query: MockFn;
  connect: MockFn;
};
const mockedPool = pool as unknown as MockedPool;

/**
 * checklist-items ルーターテスト用の Express アプリを生成する。
 * @returns checklist-items API をマウントした Express アプリ
 */
function createApp() {
  const app = express();
  app.use(express.json());
  // テスト用: 認証済みユーザー。id=99をシミュレートする
  app.use((_req, _res, next) => {
    (_req as express.Request & { userId?: number }).userId = 99;
    next();
  });
  app.use("/api/checklist-items", checklistItemsRouter);
  app.use(errorHandler);
  return app;
}

describe("checklist-items router", () => {
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

  it("POST /api/checklist-items は有効入力なら作成して親タスクの revision を進める", async () => {
    const client = setupTransactionClient(mockedPool.connect, (sql) => {
      if (sql.includes("FOR UPDATE")) return { rows: [{ id: 1 }] };
      if (sql.includes("MAX(position)")) {
        return { rows: [{ next_position: 1000 }] };
      }
      if (sql.includes("INSERT INTO checklist_items")) {
        return {
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
        };
      }
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
      position: 1000,
    });

    const statements = issuedStatements(client);
    expect(statements[0][0]).toContain("FOR UPDATE");
    expect(statements[0][0]).toContain("r.user_id = $2");
    expect(statements[0][1]).toEqual([1, 99]);
    expect(statements[1]).toEqual([
      "SELECT COALESCE(MAX(position), 0) + 1000 AS next_position FROM checklist_items WHERE task_id = $1",
      [1],
    ]);
    expect(statements[2][0]).toContain("INSERT INTO checklist_items");
    expect(statements[2][1]).toEqual([1, null, "項目", 1000]);
    expect(statements[3]).toEqual([BUMP_REVISION_SQL, [1]]);
    expect(transactionControls(client)).toEqual(["BEGIN", "COMMIT"]);
    expect(client.release).toHaveBeenCalledTimes(1);
  });

  it("POST /api/checklist-items は subtask_id 指定時も親タスクをロックして revision を進める", async () => {
    const client = setupTransactionClient(mockedPool.connect, (sql) => {
      if (sql.includes("FOR UPDATE")) return { rows: [{ id: 7 }] };
      if (sql.includes("MAX(position)")) {
        return { rows: [{ next_position: 2000 }] };
      }
      if (sql.includes("INSERT INTO checklist_items")) {
        return {
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
        };
      }
    });

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

    const statements = issuedStatements(client);
    expect(statements[0][0]).toContain("FROM subtasks s");
    expect(statements[0][0]).toContain("FOR UPDATE OF t");
    expect(statements[0][0]).toContain("r.user_id = $2");
    expect(statements[0][1]).toEqual([20, 99]);
    expect(statements[1]).toEqual([
      "SELECT COALESCE(MAX(position), 0) + 1000 AS next_position FROM checklist_items WHERE subtask_id = $1",
      [20],
    ]);
    expect(statements[2][1]).toEqual([null, 20, "サブタスク項目", 2000]);
    expect(statements[3]).toEqual([BUMP_REVISION_SQL, [7]]);
    expect(transactionControls(client)).toEqual(["BEGIN", "COMMIT"]);
    expect(client.release).toHaveBeenCalledTimes(1);
  });

  it("POST /api/checklist-items は親サブタスクが無ければ 404 で revision を進めない", async () => {
    const client = setupTransactionClient(mockedPool.connect, () => undefined);

    const res = await request(createApp())
      .post("/api/checklist-items")
      .send({ subtask_id: 20, content: "項目" });

    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: "Subtask not found" });
    expect(issuedStatements(client)).toHaveLength(1);
    expect(transactionControls(client)).toEqual(["BEGIN", "ROLLBACK"]);
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

  it("PUT /api/checklist-items/:id は有効入力なら更新して親タスクの revision を進める", async () => {
    const client = setupTransactionClient(mockedPool.connect, (sql) => {
      if (sql.includes("FOR UPDATE OF t")) return { rows: [{ id: 1 }] };
      if (sql.includes("UPDATE checklist_items SET")) {
        return {
          rows: [
            {
              id: 5,
              task_id: 1,
              subtask_id: null,
              content: "更新後",
              completed: true,
            },
          ],
        };
      }
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

    const statements = issuedStatements(client);
    expect(statements[0][0]).toContain("FROM checklist_items ci");
    expect(statements[0][1]).toEqual([5, 99]);
    expect(statements[1][0]).toContain("UPDATE checklist_items SET");
    expect(statements[1][1]).toEqual([true, "更新後", 5, 99]);
    expect(statements[2]).toEqual([BUMP_REVISION_SQL, [1]]);
    expect(transactionControls(client)).toEqual(["BEGIN", "COMMIT"]);
    expect(client.release).toHaveBeenCalledTimes(1);
  });

  it("PUT /api/checklist-items/:id は対象が無ければ 404 で revision を進めない", async () => {
    const client = setupTransactionClient(mockedPool.connect, () => undefined);

    const res = await request(createApp())
      .put("/api/checklist-items/5")
      .send({ completed: true });

    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: "Checklist item not found" });
    expect(issuedStatements(client)).toHaveLength(1);
    expect(transactionControls(client)).toEqual(["BEGIN", "ROLLBACK"]);
  });

  it("DELETE /api/checklist-items/:id は削除して親タスクの revision を進める", async () => {
    const client = setupTransactionClient(mockedPool.connect, (sql) => {
      if (sql.includes("FOR UPDATE OF t")) return { rows: [{ id: 1 }] };
      if (sql.includes("DELETE FROM checklist_items")) return { rowCount: 1 };
    });

    const res = await request(createApp()).delete("/api/checklist-items/5");

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ success: true });
    const statements = issuedStatements(client);
    expect(statements[1][0]).toContain(
      "DELETE FROM checklist_items WHERE id = $1",
    );
    expect(statements[1][1]).toEqual([5, 99]);
    expect(statements[2]).toEqual([BUMP_REVISION_SQL, [1]]);
    expect(transactionControls(client)).toEqual(["BEGIN", "COMMIT"]);
  });

  it("DELETE /api/checklist-items/:id は対象が無ければ 404 で revision を進めない", async () => {
    const client = setupTransactionClient(mockedPool.connect, () => undefined);

    const res = await request(createApp()).delete("/api/checklist-items/5");

    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: "Checklist item not found" });
    expect(issuedStatements(client)).toHaveLength(1);
    expect(transactionControls(client)).toEqual(["BEGIN", "ROLLBACK"]);
  });
});
