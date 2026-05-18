import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as api from "../api/boardApi";
import type { Row } from "../types";

describe("boardApi", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.stubGlobal("fetch", fetchMock);
    fetchMock.mockReset();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("fetchBoard sends correct query parameters", async () => {
    const mockRows: Row[] = [
      {
        id: 1,
        title: "Project A",
        position: 1000,
        columns: [],
      },
    ];
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => mockRows,
    });

    const result = await api.fetchBoard({ row_id: 1, limit: 5, offset: 10 });

    expect(result).toEqual(mockRows);
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/board?row_id=1&limit=5&offset=10",
      { headers: {} },
    );
  });

  it("createRow posts JSON and returns created row", async () => {
    const createdRow = { id: 2, title: "New Row", position: 2000, columns: [] };
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => createdRow,
    });

    const result = await api.createRow("New Row", 2000);

    expect(result).toEqual(createdRow);
    expect(fetchMock).toHaveBeenCalledWith("/api/rows", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "New Row", position: 2000 }),
    });
  });

  it("deleteRow uses DELETE and returns void", async () => {
    fetchMock.mockResolvedValueOnce({ ok: true, json: async () => ({}) });

    await api.deleteRow(123);

    expect(fetchMock).toHaveBeenCalledWith("/api/rows/123", {
      method: "DELETE",
      headers: {},
    });
  });

  it("request throws Error with backend error message", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 500,
      json: async () => ({ error: "Internal error" }),
    });

    await expect(api.fetchBoard()).rejects.toThrow("Internal error");
  });
});
