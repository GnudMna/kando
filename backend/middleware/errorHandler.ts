import { STATUS_CODES } from "node:http";
import { Request, Response, NextFunction } from "express";
import { HttpError } from "../errors.js";

/**
 * ミドルウェアが付与した `status` / `statusCode` から 4xx ステータスを取り出す。
 * @param err - スローされたエラーオブジェクト
 * @returns 4xx のステータスコード。該当しなければ null
 */
function getClientErrorStatus(err: Error): number | null {
  const { status, statusCode } = err as {
    status?: unknown;
    statusCode?: unknown;
  };
  for (const value of [status, statusCode]) {
    if (typeof value === "number" && value >= 400 && value < 500) {
      return value;
    }
  }
  return null;
}

/**
 * クライアント向けエラーメッセージを決める。
 * body-parser のメッセージにはリクエスト内容の断片が含まれるため、既知の種別は固定文言にする。
 * @param err - スローされたエラーオブジェクト
 * @param status - 4xx のステータスコード
 * @returns レスポンスに含めるメッセージ
 */
function clientErrorMessage(err: Error, status: number): string {
  const type = (err as { type?: unknown }).type;
  if (type === "entity.parse.failed") return "Invalid JSON";
  if (type === "entity.too.large" || status === 413) {
    return "Request body too large";
  }
  return STATUS_CODES[status] ?? "Bad request";
}

/**
 * Express のグローバルエラーハンドラーミドルウェア。
 * `HttpError` はそのステータスコードで返す。
 * body-parser 等が付与した 4xx(不正 JSON は 400、巨大ボディは 413)もそのステータスで返す。
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

  // body-parser 等が付与する 4xx は、クライアント起因のエラーとしてそのまま返す
  const clientStatus = getClientErrorStatus(err);
  if (clientStatus !== null) {
    res
      .status(clientStatus)
      .json({ error: clientErrorMessage(err, clientStatus) });
    return;
  }

  console.error(err);
  // 本番環境では詳細なエラーメッセージを返さず、汎用メッセージを返す
  const isProduction = process.env.NODE_ENV === "production";
  res
    .status(500)
    .json({ error: isProduction ? "Internal server error" : err.message });
}
