import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../repositories/columnsRepository.js", () => ({
  updateColumnTitle: vi.fn(),
  moveColumn: vi.fn(),
  deleteColumn: vi.fn(),
}));

vi.mock("../db.js", () => ({
  pool: {
    query: vi.fn(),
    connect: vi.fn(),
  },
}));

import * as repository from "../repositories/columnsRepository.js";
import * as service from "../services/columnsService.js";
import { pool } from "../db.js";

const INSERT_SELECT_QUERY = `INSERT INTO columns (title, position, row_id)
     SELECT $1, $2, id FROM rows WHERE id = $3 AND user_id = $4
     RETURNING id, title, position, row_id`;

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

  it("createColumn は INSERT...SELECT クエリを発行してカラムを返す", async () => {
    const column: Column = {
      id: 10,
      title: "新カラム",
      position: 1000,
      row_id: 1,
    };
    // INSERT...SELECT が行を返すようモックする。所有権確認と挿入を1クエリで処理
    mockedPool.query.mockResolvedValueOnce({ rows: [column] });

    const result = await service.createColumn("新カラム", 1000, 1, 99);

    expect(result).toEqual(column);
    expect(mockedPool.query).toHaveBeenCalledWith(INSERT_SELECT_QUERY, [
      "新カラム",
      1000,
      1,
      99,
    ]);
    expect(mockedPool.query).toHaveBeenCalledTimes(1);
  });

  it("createColumn は所有権チェックが失敗したら null を返す", async () => {
    // INSERT...SELECT が何も返さない場合。row が見つからないは null
    mockedPool.query.mockResolvedValueOnce({ rows: [] });

    const result = await service.createColumn("新カラム", 1000, 1, 99);

    expect(result).toBeNull();
    expect(mockedPool.query).toHaveBeenCalledTimes(1);
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

  it("moveColumn はトランザクション内で repository を呼び出して position を更新する", async () => {
    const column: Column = {
      id: 10,
      title: "カラム",
      position: 2000,
      row_id: 1,
    };
    const client = { query: vi.fn(), release: vi.fn() };
    client.query.mockImplementation(async (sql: unknown) => {
      const statement = String(sql);
      if (statement === "BEGIN" || statement === "COMMIT") return { rows: [] };
      return { rows: [] };
    });
    vi.mocked(pool.connect).mockResolvedValue(client as never);
    const rebalanced = [{ id: 11, position: 1000 }];
    vi.mocked(repository.moveColumn).mockResolvedValue({ column, rebalanced });

    const result = await service.moveColumn(10, 2000, 99);

    expect(result).toEqual({ column, rebalanced });
    expect(repository.moveColumn).toHaveBeenCalledWith(client, 10, 2000, 99);
    expect(client.release).toHaveBeenCalled();
  });

  it("deleteColumn は repository を呼び出して削除結果を返す", async () => {
    vi.mocked(repository.deleteColumn).mockResolvedValue(true);

    const result = await service.deleteColumn(10, 99);

    expect(result).toBe(true);
    expect(repository.deleteColumn).toHaveBeenCalledWith(pool, 10, 99);
  });
});
