import type { JWTPayload } from "jose";
import { SignJWT } from "jose";
import type { CookieOptions } from "express";
import { isCookieSecure } from "./productionEnv.js";

/** JWT に載せるトークン世代のクレーム名。 */
export const TOKEN_VERSION_CLAIM = "tv";

/** JWT の有効期限。 */
const TOKEN_EXPIRY = "7d";

/**
 * JWT ペイロードからトークン世代を読む。
 * 未設定や不正値は 0 とみなす。導入前に発行したトークンを既存セッションとして扱う。
 * @param payload - 検証済み JWT ペイロード
 * @returns 0 以上のトークン世代
 */
export function readTokenVersion(payload: JWTPayload): number {
  const value = payload[TOKEN_VERSION_CLAIM];
  if (typeof value === "number" && Number.isInteger(value) && value >= 0) {
    return value;
  }
  return 0;
}

/**
 * 認証 Cookie の属性を返す。
 * @param maxAge - 設定時のみ付与する有効期限(ms)。削除時は省略する
 * @returns Express の Cookie オプション
 */
export function authCookieOptions(maxAge?: number): CookieOptions {
  return {
    httpOnly: true,
    secure: isCookieSecure(process.env),
    sameSite: "lax",
    path: "/",
    ...(maxAge === undefined ? {} : { maxAge }),
  };
}

/**
 * ユーザー ID とトークン世代を含む JWT を署名する。
 * @param userId - JWT の subject
 * @param tokenVersion - 失効判定に使う世代
 * @returns 署名済み JWT
 */
export async function signAuthToken(
  userId: number,
  tokenVersion: number,
): Promise<string> {
  const secret = process.env.AUTH_SECRET;
  if (!secret) {
    throw new Error("AUTH_SECRET is not set");
  }
  return new SignJWT({ [TOKEN_VERSION_CLAIM]: tokenVersion })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(String(userId))
    .setIssuedAt()
    .setExpirationTime(TOKEN_EXPIRY)
    .sign(new TextEncoder().encode(secret));
}
