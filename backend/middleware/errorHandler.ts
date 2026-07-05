import { Request, Response, NextFunction } from "express";
import { HttpError } from "../errors.js";

/**
 * Express のグローバルエラーハンドラーミドルウェア。
 * `HttpError` はそのステータスコードで返す。
 * それ以外は本番環境では汎用メッセージ、開発環境ではエラー詳細を 500 で返す。
 * @param err - スローされたエラーオブジェクト
 * @param _req - Express リクエスト(使用しない)
 * @param res - Express レスポンス
 * @param _next - 次のミドルウェア(使用しない)
 */
export function errorHandler(
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void {
  if (err instanceof HttpError) {
    res.status(err.status).json({ error: err.message });
    return;
  }

  console.error(err);
  // 本番環境では詳細なエラーメッセージを返さず、汎用メッセージを返す
  const isProduction = process.env.NODE_ENV === "production";
  res
    .status(500)
    .json({ error: isProduction ? "Internal server error" : err.message });
}
