import express from "express";
import request from "supertest";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import columnsRouter from "../routes/columns.js";
import { errorHandler } from "../middleware/errorHandler.js";

vi.mock("../services/columnsService.js", () => ({
  createColumn: vi.fn(),
  updateColumnTitle: vi.fn(),
  moveColumn: vi.fn(),
  deleteColumn: vi.fn(),
}));

import * as mockedService from "../services/columnsService.js";

type Column = {
  id: number;
  title: string;
  position: number;
  row_id: number;
};

/**
 * columns ルーターテスト用の Express アプリを生成する。
 * @returns columns API をマウントした Express アプリ
 */
function createApp() {
  const app = express();
  app.use(express.json());
  // テスト用: 認証済みユーザー（id=99）をシミュレートする
  app.use((_req, _res, next) => {
    (_req as express.Request & { userId?: number }).userId = 99;
    next();
  });
  app.use("/api/columns", columnsRouter);
  app.use(errorHandler);
  return app;
}

describe("columns router", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterAll(() => {
    vi.resetAllMocks();
  });

  it("POST /api/columns はカラムを作成して返す", async () => {
    const column: Column = {
      id: 20,
      row_id: 1,
      title: "新カラム",
      position: 3000,
    };
    vi.mocked(mockedService.createColumn).mockResolvedValue(column);

    const res = await request(createApp())
      .post("/api/columns")
      .send({ title: "新カラム", position: 3000, row_id: 1 });

    expect(res.status).toBe(200);
    expect(res.body).toEqual(column);
    expect(mockedService.createColumn).toHaveBeenCalledWith(
      "新カラム",
      3000,
      1,
      99,
    );
  });

  it("PUT /api/columns/:id はカラムタイトルを更新する", async () => {
    const updated: Column = {
      id: 20,
      row_id: 1,
      title: "変更後",
      position: 3000,
    };
    vi.mocked(mockedService.updateColumnTitle).mockResolvedValue(updated);

    const res = await request(createApp())
      .put("/api/columns/20")
      .send({ title: "変更後" });

    expect(res.status).toBe(200);
    expect(res.body).toEqual(updated);
    expect(mockedService.updateColumnTitle).toHaveBeenCalledWith(
      20,
      "変更後",
      99,
    );
  });

  it("PUT /api/columns/:id/move はカラムの表示順を更新する", async () => {
    const moved: Column = {
      id: 20,
      row_id: 1,
      title: "カラム",
      position: 5000,
    };
    vi.mocked(mockedService.moveColumn).mockResolvedValue(moved);

    const res = await request(createApp())
      .put("/api/columns/20/move")
      .send({ position: 5000 });

    expect(res.status).toBe(200);
    expect(res.body).toEqual(moved);
    expect(mockedService.moveColumn).toHaveBeenCalledWith(20, 5000, 99);
  });

  it("DELETE /api/columns/:id はカラムを削除する", async () => {
    vi.mocked(mockedService.deleteColumn).mockResolvedValue(true);

    const res = await request(createApp()).delete("/api/columns/20");

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ success: true });
    expect(mockedService.deleteColumn).toHaveBeenCalledWith(20, 99);
  });
});
