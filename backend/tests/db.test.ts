import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.hoisted(() => {
  process.env.DATABASE_URL =
    process.env.DATABASE_URL ?? "postgres://test:test@localhost:5432/test_db";
});

import { pool, waitForDbWithRetry } from "../db.js";

describe("waitForDbWithRetry", () => {
  let querySpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    querySpy = vi.spyOn(pool, "query");
  });

  afterEach(() => {
    querySpy.mockRestore();
  });

  it("初回の接続確認に成功する", async () => {
    querySpy.mockResolvedValueOnce({ rows: [{ "?column?": 1 }] });

    await expect(waitForDbWithRetry(3, 1)).resolves.toBeUndefined();
    expect(querySpy).toHaveBeenCalledTimes(1);
    expect(querySpy).toHaveBeenCalledWith("SELECT 1");
  });

  it("失敗後にリトライして接続に成功する", async () => {
    querySpy
      .mockRejectedValueOnce(new Error("connection refused"))
      .mockResolvedValueOnce({ rows: [{ "?column?": 1 }] });

    await expect(waitForDbWithRetry(3, 1)).resolves.toBeUndefined();
    expect(querySpy).toHaveBeenCalledTimes(2);
  });

  it("全リトライ失敗時はエラーを投げる", async () => {
    querySpy.mockRejectedValue(new Error("connection refused"));

    await expect(waitForDbWithRetry(2, 1)).rejects.toThrow(
      "DB connection failed after all retries",
    );
    expect(querySpy).toHaveBeenCalledTimes(2);
  });
});
