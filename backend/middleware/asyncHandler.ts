import type { NextFunction, Request, RequestHandler, Response } from "express";

type AsyncRequestHandler = (
  req: Request,
  res: Response,
  next: NextFunction,
) => void | Promise<void>;

/**
 * 非同期ルートハンドラの reject を Express エラーハンドラへ委譲する。
 * 各ハンドラでの `try/catch → next(err)` ボイラープレートを省略する。
 */
export function asyncHandler(fn: AsyncRequestHandler): RequestHandler {
  return (req, res, next) => {
    try {
      Promise.resolve(fn(req, res, next)).catch(next);
    } catch (err) {
      next(err);
    }
  };
}
