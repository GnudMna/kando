import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../db.js", () => ({
  pool: {
    connect: vi.fn(),
  },
}));

vi.mock("../repositories/rowsRepository.js", () => ({
  insertRow: vi.fn(),
  insertColumn: vi.fn(),
  updateRowTitle: vi.fn(),
  deleteRow: vi.fn(),
}));

import * as repository from "../repositories/rowsRepository.js";
import * as service from "../services/rowsService.js";
import { pool } from "../db.js";

type DbRow = {
  id: number;
  title: string;
  position: number;
};

describe("rowsService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("createRow は repository を呼び出して行を作成する", async () => {
    const row: DbRow = { id: 1, title: "新しい行", position: 1000 };
    vi.mocked(repository.insertRow).mockResolvedValue(row);

    const result = await service.createRow("新しい行", 1000, 99);

    expect(result).toBe(row);
    expect(repository.insertRow).toHaveBeenCalledWith(
      pool,
      "新しい行",
      1000,
      99,
    );
  });

  it("createRowWithDefaultColumns はトランザクションで行とカラムを作成する", async () => {
    const client = {
      query: vi.fn(),
      release: vi.fn(),
    };

    vi.mocked(repository.insertRow).mockResolvedValue({
      id: 11,
      title: "新しい行",
      position: 2000,
    });
    vi.mocked(repository.insertColumn).mockImplementation(
      async (_client, title, position, row_id) => ({
        id: position / 1000 + 10,
        title,
        position,
        row_id,
      }),
    );
    vi.mocked(pool.connect).mockResolvedValue(client);

    client.query.mockResolvedValue({ rows: [] });

    const result = await service.createRowWithDefaultColumns(
      "新しい行",
      2000,
      99,
    );

    expect(result.id).toBe(11);
    expect(result.columns).toHaveLength(3);
    expect(client.query).toHaveBeenCalledWith("BEGIN");
    expect(client.query).toHaveBeenCalledWith("COMMIT");
    expect(client.release).toHaveBeenCalledTimes(1);
  });

  it("updateRowTitle は repository を呼び出して行を更新する", async () => {
    const row: DbRow = { id: 1, title: "変更後", position: 1000 };
    vi.mocked(repository.updateRowTitle).mockResolvedValue(row);

    const result = await service.updateRowTitle(1, "変更後", 99);

    expect(result).toBe(row);
    expect(repository.updateRowTitle).toHaveBeenCalledWith(
      pool,
      1,
      "変更後",
      99,
    );
  });

  it("deleteRow は repository を呼び出して削除結果を返す", async () => {
    vi.mocked(repository.deleteRow).mockResolvedValue(true);

    const result = await service.deleteRow(1, 99);

    expect(result).toBe(true);
    expect(repository.deleteRow).toHaveBeenCalledWith(pool, 1, 99);
  });
});
