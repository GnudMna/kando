// レートリミットの設定。server.ts から切り出し、単体でテストできるようにしている
import type { Express } from "express";
import { rateLimit } from "express-rate-limit";

const WINDOW_MS = 15 * 60 * 1000;
const TOO_MANY_REQUESTS = {
  error: "Too many requests, please try again later",
};

/** 1 IP あたりの全 API 共通の上限(15 分間)。メモ自動保存(800ms)やドラッグ操作の連続を許容する */
export const API_LIMIT = 3000;

/** 1 IP あたりの login / register の失敗回数の上限(15 分間) */
export const AUTH_FAILURE_LIMIT = 10;

/**
 * API のレートリミットを登録する。
 * - 全 API 共通: 15 分間に {@link API_LIMIT} リクエストまで
 * - login / register: ブルートフォース対策として、失敗が 15 分間に {@link AUTH_FAILURE_LIMIT} 回まで。成功したリクエストは数えない
 * - status は画面を開くたびに呼ばれるため、認証専用リミッターの対象外とする
 * @param app - リミッターを登録する Express アプリ
 * @param options - `disableAuthLimit` が true の場合、認証専用リミッターを登録しない(E2E 用)
 */
export function applyRateLimits(
  app: Express,
  options: { disableAuthLimit?: boolean } = {},
): void {
  app.use(
    "/api",
    rateLimit({
      windowMs: WINDOW_MS,
      limit: API_LIMIT,
      standardHeaders: "draft-8",
      legacyHeaders: false,
      message: TOO_MANY_REQUESTS,
    }),
  );

  if (options.disableAuthLimit) return;

  const authLimiter = rateLimit({
    windowMs: WINDOW_MS,
    limit: AUTH_FAILURE_LIMIT,
    skipSuccessfulRequests: true,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    message: TOO_MANY_REQUESTS,
  });
  app.use("/api/auth/login", authLimiter);
  app.use("/api/auth/register", authLimiter);
}
