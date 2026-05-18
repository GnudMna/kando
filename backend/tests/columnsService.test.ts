import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../repositories/columnsRepository.js", () => ({
  insertColumn: vi.fn(),
  updateColumnTitle: vi.fn(),
  moveColumn: vi.fn(),
  deleteColumn: vi.fn(),
}));

vi.mock("../db.js", () => ({
  pool: {
    query: vi.fn(),
  },
}));

import * as repository from "../repositories/columnsRepository.js";
import * as service from "../services/columnsService.js";
import { pool } from "../db.js";

type MockFn = ReturnType<typeof vi.fn>;
type MockedPool = { query: MockFn };
const mockedPool = pool as unknown as MockedPool;

type Column = {
  id: number;
  title: string;
  position: number;
  row_id: number;
};

describe("columnsService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("createColumn は repository を呼び出してカラムを返す", async () => {
    const column: Column = {
      id: 10,
      title: "新カラム",
      position: 1000,
      row_id: 1,
    };
    // 行の所有権チェッククエリが行を返すようモックする
    mockedPool.query.mockResolvedValueOnce({ rows: [{ id: 1 }] });
    vi.mocked(repository.insertColumn).mockResolvedValue(column);

    const result = await service.createColumn("新カラム", 1000, 1, 99);

    expect(result).toBe(column);
    expect(mockedPool.query).toHaveBeenCalledWith(
      "SELECT id FROM rows WHERE id = $1 AND user_id = $2",
      [1, 99],
    );
    expect(repository.insertColumn).toHaveBeenCalledWith(
      pool,
      "新カラム",
      1000,
      1,
    );
  });

  it("createColumn は所有権チェックが失敗したら null を返す", async () => {
    mockedPool.query.mockResolvedValueOnce({ rows: [] });

    const result = await service.createColumn("新カラム", 1000, 1, 99);

    expect(result).toBeNull();
    expect(repository.insertColumn).not.toHaveBeenCalled();
  });

  it("updateColumnTitle は repository を呼び出して更新結果を返す", async () => {
    const column: Column = {
      id: 10,
      title: "更新後",
      position: 1000,
      row_id: 1,
    };
    vi.mocked(repository.updateColumnTitle).mockResolvedValue(column);

    const result = await service.updateColumnTitle(10, "更新後", 99);

    expect(result).toBe(column);
    expect(repository.updateColumnTitle).toHaveBeenCalledWith(
      pool,
      10,
      "更新後",
      99,
    );
  });

  it("moveColumn は repository を呼び出して position を更新する", async () => {
    const column: Column = {
      id: 10,
      title: "カラム",
      position: 2000,
      row_id: 1,
    };
    vi.mocked(repository.moveColumn).mockResolvedValue(column);

    const result = await service.moveColumn(10, 2000, 99);

    expect(result).toBe(column);
    expect(repository.moveColumn).toHaveBeenCalledWith(pool, 10, 2000, 99);
  });

  it("deleteColumn は repository を呼び出して削除結果を返す", async () => {
    vi.mocked(repository.deleteColumn).mockResolvedValue(true);

    const result = await service.deleteColumn(10, 99);

    expect(result).toBe(true);
    expect(repository.deleteColumn).toHaveBeenCalledWith(pool, 10, 99);
  });
});
