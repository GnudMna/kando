// グローバルエラーハンドラーミドルウェア
// すべてのルートで捕捉されなかったエラーをここで処理する
import { Request, Response, NextFunction } from 'express';

/**
 * Express のグローバルエラーハンドラーミドルウェア。
 * 未捕捉のエラーを受け取り、本番環境では汎用メッセージ、
 * それ以外ではエラーの詳細メッセージを 500 レスポンスとして返す。
 * @param err - スローされたエラーオブジェクト
 * @param _req - Express リクエスト（使用しない）
 * @param res - Express レスポンス
 * @param _next - 次のミドルウェア（使用しない）
 */
export function errorHandler(
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  console.error(err);
  // 本番環境では詳細なエラーメッセージを返さず、汎用メッセージを返す
  const isProduction = process.env.NODE_ENV === 'production';
  res.status(500).json({ error: isProduction ? 'Internal server error' : err.message });
}
