import express from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import rowsRouter from "../routes/rows.js";
import columnsRouter from "../routes/columns.js";
import tasksRouter from "../routes/tasks.js";
import subtasksRouter from "../routes/subtasks.js";
import checklistItemsRouter from "../routes/checklistItems.js";
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

const mockedPool = pool as unknown as MockedPool;

/**
 * DELETE 系 API のルーターテスト用 Express アプリを生成する。
 * @returns 主要ルーターをマウントした Express アプリ
 */
function createApp() {
  const app = express();
  app.use(express.json());
  // テスト用: 認証済みユーザー。id=99をシミュレートする
  app.use((_req, _res, next) => {
    (_req as express.Request & { userId?: number }).userId = 99;
    next();
  });
  app.use("/api/rows", rowsRouter);
  app.use("/api/columns", columnsRouter);
  app.use("/api/tasks", tasksRouter);
  app.use("/api/subtasks", subtasksRouter);
  app.use("/api/checklist-items", checklistItemsRouter);
  app.use("/api/task-comments", taskCommentsRouter);
  app.use(errorHandler);
  return app;
}

type DeleteCase = {
  path: string;
  notFoundMessage: string;
};

const cases: DeleteCase[] = [
  {
    path: "/api/rows/1",
    notFoundMessage: "Row not found",
  },
  {
    path: "/api/columns/1",
    notFoundMessage: "Column not found",
  },
  {
    path: "/api/tasks/1",
    notFoundMessage: "Task not found",
  },
  {
    path: "/api/subtasks/1",
    notFoundMessage: "Subtask not found",
  },
  {
    path: "/api/checklist-items/1",
    notFoundMessage: "Checklist item not found",
  },
  {
    path: "/api/task-comments/1",
    notFoundMessage: "Comment not found",
  },
];

describe("DELETE API response consistency", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  for (const testCase of cases) {
    it(`${testCase.path} は削除対象がある場合 success を返す`, async () => {
      mockedPool.query.mockResolvedValueOnce({ rowCount: 1, rows: [] });

      const res = await request(createApp()).delete(testCase.path);

      expect(res.status).toBe(200);
      expect(res.body).toEqual({ success: true });
    });

    it(`${testCase.path} は削除対象がない場合 404 を返す`, async () => {
      mockedPool.query.mockResolvedValueOnce({ rowCount: 0, rows: [] });

      const res = await request(createApp()).delete(testCase.path);

      expect(res.status).toBe(404);
      expect(res.body).toEqual({ error: testCase.notFoundMessage });
    });
  }
});
