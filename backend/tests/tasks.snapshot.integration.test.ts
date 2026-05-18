import express from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import tasksRouter from "../routes/tasks.js";
import { errorHandler } from "../middleware/errorHandler.js";
import { pool } from "../db.js";

vi.mock("../db.js", () => ({
  pool: {
    query: vi.fn(),
    connect: vi.fn(),
  },
}));

type MockFn = ReturnType<typeof vi.fn>;
type MockedClient = {
  query: MockFn;
  release: MockFn;
};
type MockedPool = {
  query: MockFn;
  connect: MockFn;
};

const mockedPool = pool as unknown as MockedPool;

/**
 * tasks ルーター統合テスト用の Express アプリを生成する。
 * @returns tasks API をマウントした Express アプリ
 */
function createApp() {
  const app = express();
  app.use(express.json());
  // テスト用: 認証済みユーザー（id=99）をシミュレートする
  app.use((_req, _res, next) => {
    (_req as express.Request & { userId?: number }).userId = 99;
    next();
  });
  app.use("/api/tasks", tasksRouter);
  app.use(errorHandler);
  return app;
}

describe("tasks snapshot integration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("PUT /api/tasks/:id/snapshot は単一トランザクションで保存してネスト済みタスクを返す", async () => {
    const client: MockedClient = {
      query: vi.fn(),
      release: vi.fn(),
    };
    mockedPool.connect.mockResolvedValue(client);

    client.query.mockImplementation(
      async (sql: unknown, _params?: unknown[]) => {
        const statement = String(sql);

        if (statement === "BEGIN" || statement === "COMMIT") {
          return { rows: [] };
        }

        if (
          statement.includes("JOIN rows r ON r.id = c.row_id") &&
          statement.includes("FOR UPDATE")
        ) {
          return { rows: [{ id: 1 }] };
        }

        if (
          statement.startsWith(
            "UPDATE tasks SET content = $1, due_date = $2, completed = $3 WHERE id = $4",
          )
        ) {
          return { rows: [] };
        }

        if (
          statement.startsWith(
            "SELECT id FROM subtasks WHERE task_id = $1 FOR UPDATE",
          )
        ) {
          return { rows: [{ id: 11 }] };
        }

        if (
          statement.startsWith("UPDATE subtasks SET content = updates.content")
        ) {
          return { rows: [] };
        }

        if (
          statement.startsWith(
            "SELECT id FROM checklist_items WHERE task_id = $1 AND subtask_id IS NULL FOR UPDATE",
          )
        ) {
          return { rows: [{ id: 21 }] };
        }

        if (
          statement.startsWith(
            "SELECT id FROM checklist_items WHERE subtask_id = $1 FOR UPDATE",
          )
        ) {
          return { rows: [{ id: 31 }] };
        }

        if (statement.startsWith("UPDATE checklist_items SET\n")) {
          return { rows: [] };
        }

        if (
          statement.startsWith(
            "SELECT id FROM task_comments WHERE task_id = $1 FOR UPDATE",
          )
        ) {
          return { rows: [{ id: 41 }] };
        }

        if (statement.startsWith("UPDATE task_comments SET\n")) {
          return { rows: [] };
        }

        if (
          statement.includes("FROM tasks t") &&
          statement.includes("COALESCE((SELECT subtasks FROM agg_subtasks)")
        ) {
          return {
            rows: [
              {
                id: 1,
                column_id: 10,
                content: "更新タスク",
                due_date: "2026-12-01",
                position: 1000,
                completed: false,
                subtasks: [
                  {
                    id: 11,
                    task_id: 1,
                    content: "更新サブタスク",
                    checklists: [
                      {
                        id: 31,
                        task_id: null,
                        subtask_id: 11,
                        content: "更新サブチェック",
                        completed: true,
                        position: 1000,
                      },
                    ],
                  },
                ],
                checklists: [
                  {
                    id: 21,
                    task_id: 1,
                    subtask_id: null,
                    content: "更新チェック",
                    completed: false,
                    position: 1000,
                  },
                ],
                comments: [
                  {
                    id: 41,
                    task_id: 1,
                    content: "更新コメント",
                    created_at: "2026-04-18T00:00:00.000Z",
                    position: 1000,
                  },
                ],
              },
            ],
          };
        }

        throw new Error(`Unexpected SQL: ${statement}`);
      },
    );

    const res = await request(createApp())
      .put("/api/tasks/1/snapshot")
      .send({
        content: "更新タスク",
        due_date: "2026-12-01",
        completed: false,
        checklists: [
          {
            id: 21,
            content: "更新チェック",
            completed: false,
          },
        ],
        subtasks: [
          {
            id: 11,
            content: "更新サブタスク",
            checklists: [
              {
                id: 31,
                content: "更新サブチェック",
                completed: true,
              },
            ],
          },
        ],
        comments: [
          {
            id: 41,
            content: "更新コメント",
          },
        ],
      });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      id: 1,
      column_id: 10,
      content: "更新タスク",
      due_date: "2026-12-01",
      position: 1000,
      completed: false,
      checklists: [
        {
          id: 21,
          task_id: 1,
          subtask_id: null,
          content: "更新チェック",
          completed: false,
          position: 1000,
        },
      ],
      comments: [
        {
          id: 41,
          task_id: 1,
          content: "更新コメント",
          created_at: "2026-04-18T00:00:00.000Z",
          position: 1000,
        },
      ],
      subtasks: [
        {
          id: 11,
          task_id: 1,
          content: "更新サブタスク",
          checklists: [
            {
              id: 31,
              task_id: null,
              subtask_id: 11,
              content: "更新サブチェック",
              completed: true,
              position: 1000,
            },
          ],
        },
      ],
    });

    expect(client.query).toHaveBeenCalledWith("BEGIN");
    expect(client.query).toHaveBeenCalledWith("COMMIT");
    expect(client.release).toHaveBeenCalledTimes(1);
  });

  it("PUT /api/tasks/:id/snapshot は不正な body で 400 を返す", async () => {
    const res = await request(createApp()).put("/api/tasks/1/snapshot").send({
      content: "   ",
      due_date: null,
      checklists: [],
      subtasks: [],
      comments: [],
    });

    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: "'content' must not be empty" });
    expect(mockedPool.connect).not.toHaveBeenCalled();
  });

  it("PUT /api/tasks/:id/snapshot は対象タスクが無い場合ロールバックして 404 を返す", async () => {
    const client: MockedClient = {
      query: vi.fn(),
      release: vi.fn(),
    };
    mockedPool.connect.mockResolvedValue(client);

    client.query.mockImplementation(async (sql: unknown) => {
      const statement = String(sql);
      if (statement === "BEGIN" || statement === "ROLLBACK") {
        return { rows: [] };
      }
      if (
        statement.includes("JOIN rows r ON r.id = c.row_id") &&
        statement.includes("FOR UPDATE")
      ) {
        return { rows: [] };
      }
      throw new Error(`Unexpected SQL: ${statement}`);
    });

    const res = await request(createApp()).put("/api/tasks/999/snapshot").send({
      content: "更新タスク",
      due_date: null,
      completed: false,
      checklists: [],
      subtasks: [],
      comments: [],
    });

    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: "Task not found" });
    expect(client.query).toHaveBeenCalledWith("ROLLBACK");
    expect(client.release).toHaveBeenCalledTimes(1);
  });
});
