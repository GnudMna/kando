// シンプルなリクエストロギングミドルウェア
// メソッド・パス・ステータスコード・レスポンス時間を標準出力に記録する
import { Request, Response, NextFunction } from "express";

/**
 * HTTP リクエスト/レスポンスをコンソールに記録するミドルウェア。
 * 開発・本番環境のトラブルシューティングに使用する。
 * @param req - Express リクエスト
 * @param res - Express レスポンス
 * @param next - 次のミドルウェアへ処理を渡す関数
 * @returns なし
 */
export function requestLogger(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const start = Date.now();
  res.on("finish", () => {
    const ms = Date.now() - start;
    console.log(`${req.method} ${req.path} ${res.statusCode} ${ms}ms`);
  });
  next();
}
