// validate ミドルウェア（parseId / validateBody）のユニットテスト
import { describe, it, expect } from 'vitest';
import { parseId, validateBody } from '../middleware/validate';
import type { Request, Response, NextFunction } from 'express';

// テスト用のモック Express レスポンスオブジェクトを生成するヘルパー
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

describe('parseId', () => {
  it('正常な ID 文字列に対して正の整数を返す', () => {
    expect(parseId('42')).toBe(42);
    expect(parseId('1')).toBe(1);
  });

  it('0 または負の値に対して null を返す', () => {
    expect(parseId('0')).toBeNull();
    expect(parseId('-5')).toBeNull();
  });

  it('数値以外の文字列に対して null を返す', () => {
    expect(parseId('abc')).toBeNull();
    expect(parseId('')).toBeNull();
  });
});

describe('validateBody', () => {
  const middleware = validateBody({
    title: { type: 'string', required: true, notEmpty: true },
    position: { type: 'number', required: true },
  });

  it('有効なボディの場合は next() を呼び出す', () => {
    const req = { body: { title: 'Test', position: 1000 } } as Request;
    const res = mockRes();
    let called = false;
    const next: NextFunction = () => { called = true; };
    middleware(req, res, next);
    expect(called).toBe(true);
  });

  it('必須フィールドが欠落している場合は 400 を返す', () => {
    const req = { body: { position: 1000 } } as Request;
    const res = mockRes();
    const next: NextFunction = () => {};
    middleware(req, res, next);
    expect(res.statusCode).toBe(400);
    expect((res.body as { error: string }).error).toMatch(/'title' is required/);
  });

  it('文字列フィールドが空の場合は 400 を返す', () => {
    const req = { body: { title: '   ', position: 1000 } } as Request;
    const res = mockRes();
    const next: NextFunction = () => {};
    middleware(req, res, next);
    expect(res.statusCode).toBe(400);
    expect((res.body as { error: string }).error).toMatch(/'title' must not be empty/);
  });

  it('フィールドの型が正しくない場合は 400 を返す', () => {
    const req = { body: { title: 'Test', position: 'not-a-number' } } as Request;
    const res = mockRes();
    const next: NextFunction = () => {};
    middleware(req, res, next);
    expect(res.statusCode).toBe(400);
    expect((res.body as { error: string }).error).toMatch(/'position' must be a number/);
  });
});
