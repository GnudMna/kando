import express from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import boardRouter from "../routes/board.js";
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
 * board ルーターテスト用の Express アプリを生成する。
 * @returns board API をマウントした Express アプリ
 */
function createApp() {
  const app = express();
  app.use(express.json());
  // テスト用: 認証済みユーザー（id=99）をシミュレートする
  app.use((_req, _res, next) => {
    (_req as express.Request & { userId?: number }).userId = 99;
    next();
  });
  app.use("/api/board", boardRouter);
  app.use(errorHandler);
  return app;
}

describe("board router", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("GET /api/board は不正な limit を 400 で拒否する", async () => {
    const res = await request(createApp()).get("/api/board?limit=101");

    expect(res.status).toBe(400);
    expect(res.body).toEqual({
      error: "'limit' must be an integer between 1 and 100",
    });
    expect(mockedPool.query).not.toHaveBeenCalled();
  });

  it("GET /api/board は不正な row_id を 400 で拒否する", async () => {
    const res = await request(createApp()).get("/api/board?row_id=abc");

    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: "'row_id' must be an integer" });
    expect(mockedPool.query).not.toHaveBeenCalled();
  });

  it("GET /api/board は対象行配下のみを取得して階層を返す", async () => {
    const expectedRow = {
      id: 2,
      title: "行2",
      position: 2000,
      columns: [
        {
          id: 10,
          title: "Todo",
          position: 1000,
          row_id: 2,
          tasks: [
            {
              id: 100,
              column_id: 10,
              content: "Task",
              due_date: null,
              position: 1000,
              completed: false,
              subtasks: [],
              checklists: [],
              comments: [],
            },
          ],
        },
      ],
    };

    mockedPool.query
      .mockResolvedValueOnce({
        rows: [{ id: 2, title: "行2", position: 2000 }],
      })
      .mockResolvedValueOnce({ rows: [expectedRow] });

    const res = await request(createApp()).get(
      "/api/board?row_id=2&limit=1&offset=0",
    );

    expect(res.status).toBe(200);
    expect(res.body).toEqual([expectedRow]);

    expect(mockedPool.query).toHaveBeenCalledTimes(2);

    const [rowsSql, rowsParams] = mockedPool.query.mock.calls[0] as [
      string,
      unknown[],
    ];
    expect(rowsSql).toContain("SELECT * FROM rows");
    expect(rowsSql).toContain("WHERE user_id = $1");
    expect(rowsSql).toContain("AND id = $2");
    expect(rowsSql).toContain("LIMIT $3");
    expect(rowsSql).toContain("OFFSET $4");
    expect(rowsParams).toEqual([99, 2, 1, 0]);

    const [cteSql, cteParams] = mockedPool.query.mock.calls[1] as [
      string,
      unknown[],
    ];
    expect(cteSql).toContain("WITH");
    expect(cteSql).toContain("agg_cols");
    expect(cteSql).toContain("ANY($1::int[])");
    expect(cteParams).toEqual([[2]]);
  });

  it("GET /api/board は tasks が空なら下位テーブル取得を省略する", async () => {
    const expectedRow = {
      id: 2,
      title: "行2",
      position: 2000,
      columns: [
        {
          id: 10,
          title: "Todo",
          position: 1000,
          row_id: 2,
          tasks: [],
        },
      ],
    };

    mockedPool.query
      .mockResolvedValueOnce({
        rows: [{ id: 2, title: "行2", position: 2000 }],
      })
      .mockResolvedValueOnce({ rows: [expectedRow] });

    const res = await request(createApp()).get("/api/board?row_id=2");

    expect(res.status).toBe(200);
    expect(res.body).toEqual([expectedRow]);
    expect(mockedPool.query).toHaveBeenCalledTimes(2);
  });
});
