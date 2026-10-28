import express from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import taskCommentsRouter from "../routes/taskComments.js";
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
 * task-comments ルーターテスト用の Express アプリを生成する。
 * @returns task-comments API をマウントした Express アプリ
 */
function createApp() {
  const app = express();
  app.use(express.json());
  // テスト用: 認証済みユーザー。id=99をシミュレートする
  app.use((_req, _res, next) => {
    (_req as express.Request & { userId?: number }).userId = 99;
    next();
  });
  app.use("/api/task-comments", taskCommentsRouter);
  app.use(errorHandler);
  return app;
}

describe("task-comments router", () => {
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

  it("POST /api/task-comments は有効入力なら作成して親タスクの revision を進める", async () => {
    const client = setupTransactionClient(mockedPool.connect, (sql) => {
      if (sql.includes("FOR UPDATE")) return { rows: [{ id: 10 }] };
      if (sql.includes("MAX(position)")) {
        return { rows: [{ next_position: 1000 }] };
      }
      if (sql.includes("INSERT INTO task_comments")) {
        return {
          rows: [
            {
              id: 1,
              task_id: 10,
              content: "最初のコメント",
              created_at: "2026-04-18T00:00:00.000Z",
              position: 1000,
            },
          ],
        };
      }
    });

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

    const statements = issuedStatements(client);
    expect(statements[0][0]).toContain("FOR UPDATE");
    expect(statements[0][0]).toContain("r.user_id = $2");
    expect(statements[0][1]).toEqual([10, 99]);
    expect(statements[1]).toEqual([
      "SELECT COALESCE(MAX(position), 0) + 1000 AS next_position FROM task_comments WHERE task_id = $1",
      [10],
    ]);
    expect(statements[2][0]).toContain("INSERT INTO task_comments");
    expect(statements[2][1]).toEqual([10, "最初のコメント", 1000]);
    expect(statements[3]).toEqual([BUMP_REVISION_SQL, [10]]);
    expect(transactionControls(client)).toEqual(["BEGIN", "COMMIT"]);
    expect(client.release).toHaveBeenCalledTimes(1);
  });

  it("PUT /api/task-comments/:id は更新対象が存在しない場合 404 で revision を進めない", async () => {
    const client = setupTransactionClient(mockedPool.connect, () => undefined);

    const res = await request(createApp())
      .put("/api/task-comments/99")
      .send({ content: "更新" });

    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: "Comment not found" });
    expect(issuedStatements(client)).toHaveLength(1);
    expect(transactionControls(client)).toEqual(["BEGIN", "ROLLBACK"]);
  });

  it("PUT /api/task-comments/:id は有効入力なら更新して親タスクの revision を進める", async () => {
    const client = setupTransactionClient(mockedPool.connect, (sql) => {
      if (sql.includes("FOR UPDATE OF t")) return { rows: [{ id: 10 }] };
      if (sql.includes("UPDATE task_comments SET")) {
        return {
          rows: [
            {
              id: 3,
              task_id: 10,
              content: "更新後コメント",
              created_at: "2026-04-18T00:00:00.000Z",
              position: 1000,
            },
          ],
        };
      }
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

    const statements = issuedStatements(client);
    expect(statements[0][1]).toEqual([3, 99]);
    expect(statements[1][0]).toContain("UPDATE task_comments SET content = $1");
    expect(statements[1][1]).toEqual(["更新後コメント", 3, 99]);
    expect(statements[2]).toEqual([BUMP_REVISION_SQL, [10]]);
    expect(transactionControls(client)).toEqual(["BEGIN", "COMMIT"]);
  });

  it("PUT /api/task-comments/:id は position のみ更新できる", async () => {
    const client = setupTransactionClient(mockedPool.connect, (sql) => {
      if (sql.includes("FOR UPDATE OF t")) return { rows: [{ id: 10 }] };
      if (sql.includes("UPDATE task_comments SET")) {
        return {
          rows: [
            {
              id: 3,
              task_id: 10,
              content: "更新後コメント",
              created_at: "2026-04-18T00:00:00.000Z",
              position: 2500,
            },
          ],
        };
      }
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

    const statements = issuedStatements(client);
    expect(statements[1][0]).toContain(
      "UPDATE task_comments SET position = $1",
    );
    expect(statements[1][1]).toEqual([2500, 3, 99]);
    expect(statements[2]).toEqual([BUMP_REVISION_SQL, [10]]);
  });

  it("PUT /api/task-comments/:id は更新対象が空なら 400 を返す", async () => {
    const res = await request(createApp()).put("/api/task-comments/3").send({});

    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: "No fields to update" });
    expect(mockedPool.query).not.toHaveBeenCalled();
  });

  it("DELETE /api/task-comments/:id は削除して親タスクの revision を進める", async () => {
    const client = setupTransactionClient(mockedPool.connect, (sql) => {
      if (sql.includes("FOR UPDATE OF t")) return { rows: [{ id: 10 }] };
      if (sql.includes("DELETE FROM task_comments")) return { rowCount: 1 };
    });

    const res = await request(createApp()).delete("/api/task-comments/3");

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ success: true });
    const statements = issuedStatements(client);
    expect(statements[0][1]).toEqual([3, 99]);
    expect(statements[1][0]).toContain(
      "DELETE FROM task_comments WHERE id = $1",
    );
    expect(statements[1][0]).toContain("r.user_id = $2");
    expect(statements[1][1]).toEqual([3, 99]);
    expect(statements[2]).toEqual([BUMP_REVISION_SQL, [10]]);
    expect(transactionControls(client)).toEqual(["BEGIN", "COMMIT"]);
  });

  it("DELETE /api/task-comments/:id は対象が存在しない場合 404 で revision を進めない", async () => {
    const client = setupTransactionClient(mockedPool.connect, () => undefined);

    const res = await request(createApp()).delete("/api/task-comments/999");

    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: "Comment not found" });
    const statements = issuedStatements(client);
    expect(statements).toHaveLength(1);
    expect(statements[0][1]).toEqual([999, 99]);
    expect(transactionControls(client)).toEqual(["BEGIN", "ROLLBACK"]);
  });
});
