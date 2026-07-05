// validate ミドルウェア。parseId / validateBodyのユニットテスト
import { describe, it, expect } from "vitest";
import { parseId, validateBody } from "../middleware/validate";
import {
  validateTestBodySchema,
  validateTestPositivePositionSchema,
  validateTestPositionSchema,
  validateTestRowAndPositionSchema,
  validateTestRowIdSchema,
  validateTestScoreSchema,
  validateTestTitleMaxSchema,
} from "@kando/types/validation";
import type { Request, Response, NextFunction } from "express";

/**
 * レスポンス検証用の簡易モックを作成する。
 * @returns `statusCode` と `body` を保持するモック Response
 */
function mockRes() {
  const res = {
    statusCode: 200,
    body: null as unknown,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(body: unknown) {
      this.body = body;
      return this;
    },
  };
  return res as unknown as Response & { statusCode: number; body: unknown };
}

describe("parseId", () => {
  it("正常な ID 文字列に対して正の整数を返す", () => {
    expect(parseId("42")).toBe(42);
    expect(parseId("1")).toBe(1);
    expect(parseId("0007")).toBe(7);
  });

  it("0 または負の値に対して null を返す", () => {
    expect(parseId("0")).toBeNull();
    expect(parseId("-5")).toBeNull();
  });

  it("数値以外の文字列に対して null を返す", () => {
    expect(parseId("abc")).toBeNull();
    expect(parseId("")).toBeNull();
    expect(parseId("12abc")).toBeNull();
    expect(parseId("1.5")).toBeNull();
    expect(parseId("1e3")).toBeNull();
  });

  it("文字列以外のパラメータに対して null を返す", () => {
    expect(parseId(undefined)).toBeNull();
    expect(parseId(["42"])).toBeNull();
  });

  it("安全な整数範囲を超える値に対して null を返す", () => {
    const tooLarge = `${Number.MAX_SAFE_INTEGER + 1}`;
    expect(parseId(tooLarge)).toBeNull();
  });
});

describe("validateBody", () => {
  const middleware = validateBody(validateTestBodySchema);

  it("有効なボディの場合は next() を呼び出す", () => {
    const req = { body: { title: "Test", position: 1000 } } as Request;
    const res = mockRes();
    let called = false;
    const next: NextFunction = () => {
      called = true;
    };
    middleware(req, res, next);
    expect(called).toBe(true);
  });

  it("必須フィールドが欠落している場合は 400 を返す", () => {
    const req = { body: { position: 1000 } } as Request;
    const res = mockRes();
    const next: NextFunction = () => {};
    middleware(req, res, next);
    expect(res.statusCode).toBe(400);
    expect((res.body as { error: string }).error).toMatch(
      /'title' is required/,
    );
  });

  it("文字列フィールドが空の場合は 400 を返す", () => {
    const req = { body: { title: "   ", position: 1000 } } as Request;
    const res = mockRes();
    const next: NextFunction = () => {};
    middleware(req, res, next);
    expect(res.statusCode).toBe(400);
    expect((res.body as { error: string }).error).toMatch(
      /'title' must not be empty/,
    );
  });

  it("フィールドの型が正しくない場合は 400 を返す", () => {
    const req = {
      body: { title: "Test", position: "not-a-number" },
    } as Request;
    const res = mockRes();
    const next: NextFunction = () => {};
    middleware(req, res, next);
    expect(res.statusCode).toBe(400);
    expect((res.body as { error: string }).error).toMatch(
      /'position' must be a number/,
    );
  });

  it("maxLength を超える場合は 400 を返す", () => {
    const maxMiddleware = validateBody(validateTestTitleMaxSchema);
    const req = { body: { title: "a".repeat(11) } } as Request;
    const res = mockRes();
    const next: NextFunction = () => {};
    maxMiddleware(req, res, next);
    expect(res.statusCode).toBe(400);
    expect((res.body as { error: string }).error).toMatch(
      /'title' must be 10 characters or fewer/,
    );
  });

  it("maxLength 以内の場合は next() を呼び出す", () => {
    const maxMiddleware = validateBody(validateTestTitleMaxSchema);
    const req = { body: { title: "a".repeat(10) } } as Request;
    const res = mockRes();
    let called = false;
    const next: NextFunction = () => {
      called = true;
    };
    maxMiddleware(req, res, next);
    expect(called).toBe(true);
  });

  it("number が NaN または Infinity の場合は 400 を返す", () => {
    const posMiddleware = validateBody(validateTestPositionSchema);

    const reqNaN = { body: { position: Number.NaN } } as Request;
    const resNaN = mockRes();
    posMiddleware(reqNaN, resNaN, (() => {}) as NextFunction);
    expect(resNaN.statusCode).toBe(400);
    expect((resNaN.body as { error: string }).error).toMatch(
      /'position' must be a finite number/,
    );

    const reqInf = { body: { position: Number.POSITIVE_INFINITY } } as Request;
    const resInf = mockRes();
    posMiddleware(reqInf, resInf, (() => {}) as NextFunction);
    expect(resInf.statusCode).toBe(400);
    expect((resInf.body as { error: string }).error).toMatch(
      /'position' must be a finite number/,
    );
  });

  it("integer 指定時に小数を拒否する", () => {
    const rowMiddleware = validateBody(validateTestRowIdSchema);
    const req = { body: { row_id: 1.25 } } as Request;
    const res = mockRes();
    rowMiddleware(req, res, (() => {}) as NextFunction);
    expect(res.statusCode).toBe(400);
    expect((res.body as { error: string }).error).toMatch(
      /'row_id' must be an integer/,
    );
  });

  it("positive 指定時に 0 以下を拒否する", () => {
    const positiveMiddleware = validateBody(validateTestPositivePositionSchema);
    const req = { body: { position: 0 } } as Request;
    const res = mockRes();
    positiveMiddleware(req, res, (() => {}) as NextFunction);
    expect(res.statusCode).toBe(400);
    expect((res.body as { error: string }).error).toMatch(
      /'position' must be greater than 0/,
    );
  });

  it("min / max を満たさない場合は 400 を返す", () => {
    const scoreMiddleware = validateBody(validateTestScoreSchema);

    const reqTooSmall = { body: { score: -1 } } as Request;
    const resTooSmall = mockRes();
    scoreMiddleware(reqTooSmall, resTooSmall, (() => {}) as NextFunction);
    expect(resTooSmall.statusCode).toBe(400);
    expect((resTooSmall.body as { error: string }).error).toMatch(
      /'score' must be greater than or equal to 0/,
    );

    const reqTooLarge = { body: { score: 101 } } as Request;
    const resTooLarge = mockRes();
    scoreMiddleware(reqTooLarge, resTooLarge, (() => {}) as NextFunction);
    expect(resTooLarge.statusCode).toBe(400);
    expect((resTooLarge.body as { error: string }).error).toMatch(
      /'score' must be less than or equal to 100/,
    );
  });

  it("number 制約をすべて満たす場合は next() を呼び出す", () => {
    const combinedMiddleware = validateBody(validateTestRowAndPositionSchema);
    const req = { body: { row_id: 3, position: 2.5 } } as Request;
    const res = mockRes();
    let called = false;
    const next: NextFunction = () => {
      called = true;
    };
    combinedMiddleware(req, res, next);
    expect(called).toBe(true);
  });
});
