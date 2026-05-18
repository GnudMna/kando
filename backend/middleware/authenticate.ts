// 認証ミドルウェア: JWT を検証し userId を req に設定する
import { Request, Response, NextFunction } from "express";
import { jwtVerify } from "jose";

/** JWT 署名に使用するシークレット */
const AUTH_SECRET = process.env.AUTH_SECRET;

/**
 * JWT 認証ミドルウェア。
 * Authorization: Bearer <token> ヘッダーを検証し、
 * 有効な場合は req.userId にユーザー ID を設定して next() を呼ぶ。
 * 無効または未設定の場合は 401 を返す。
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

  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const token = authHeader.slice(7);
  const secretKey = new TextEncoder().encode(AUTH_SECRET);

  try {
    const { payload } = await jwtVerify(token, secretKey);
    const userId = Number(payload.sub);
    if (!Number.isFinite(userId) || userId <= 0) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    req.userId = userId;
    next();
  } catch {
    res.status(401).json({ error: "Unauthorized" });
  }
}
