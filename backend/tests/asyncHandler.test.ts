import { describe, expect, it, vi } from "vitest";
import type { NextFunction, Request, Response } from "express";
import { asyncHandler } from "../middleware/asyncHandler.js";

function createMocks() {
  const req = {} as Request;
  const res = {
    status: vi.fn().mockReturnThis(),
    json: vi.fn(),
  } as unknown as Response;
  const next = vi.fn() as NextFunction;
  return { req, res, next };
}

describe("asyncHandler", () => {
  it("非同期ハンドラの結果をそのまま通す", async () => {
    const { req, res, next } = createMocks();
    const handler = asyncHandler(async (_req, response) => {
      response.json({ ok: true });
    });

    await handler(req, res, next);

    expect(res.json).toHaveBeenCalledWith({ ok: true });
    expect(next).not.toHaveBeenCalled();
  });

  it("reject されたエラーを next に渡す", async () => {
    const { req, res, next } = createMocks();
    const error = new Error("boom");
    const handler = asyncHandler(async () => {
      throw error;
    });

    await handler(req, res, next);

    expect(next).toHaveBeenCalledWith(error);
  });

  it("同期 throw も next に渡す", async () => {
    const { req, res, next } = createMocks();
    const error = new Error("sync");
    const handler = asyncHandler(() => {
      throw error;
    });

    await handler(req, res, next);

    expect(next).toHaveBeenCalledWith(error);
  });
});
