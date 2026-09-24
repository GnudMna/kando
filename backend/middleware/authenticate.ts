import { Request, Response, NextFunction } from "express";
import { jwtVerify } from "jose";
import { pool } from "../db.js";
import { readTokenVersion } from "../authToken.js";

/** JWT 署名に使用するシークレット */
const AUTH_SECRET = process.env.AUTH_SECRET;

/**
 * JWT 認証ミドルウェア。
 *
 * 1. `token` HttpOnly Cookie を優先して検証する。
 * 2. Cookie がない場合は Authorization: Bearer ヘッダーにフォールバックする。
 *
 * 有効なトークンが見つかった場合は、DB 上のトークン世代と一致することを確認してから
 * `req.userId` にユーザー ID を設定して `next()` を呼ぶ。
 * 署名が無効、世代が古い、または未設定の場合は 401 を返す。
 *
 * @param req - Express リクエスト(検証成功時に `userId` が付与される)
 * @param res - Express レスポンス
 * @param next - 次のミドルウェアへ進むコールバック
 */
export async function authenticate(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  if (!AUTH_SECRET) {
    res.status(503).json({ error: "Authentication not configured" });
    return;
  }

  // Cookie 優先、なければ Authorization ヘッダーにフォールバック
  const cookieToken = req.cookies?.token as string | undefined;
  const authHeader = req.headers.authorization;
  const token =
    cookieToken ??
    (authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : undefined);

  if (!token) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const secretKey = new TextEncoder().encode(AUTH_SECRET);

  let payload;
  try {
    ({ payload } = await jwtVerify(token, secretKey));
  } catch {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const userId = Number(payload.sub);
  if (!Number.isFinite(userId) || userId <= 0) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const result = await pool.query<{ token_version: number }>(
    "SELECT token_version FROM users WHERE id = $1",
    [userId],
  );
  const currentVersion = result.rows[0]?.token_version;
  if (currentVersion === undefined || currentVersion !== readTokenVersion(payload)) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  req.userId = userId;
  next();
}
