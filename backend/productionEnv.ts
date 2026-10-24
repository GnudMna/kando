/** 開発用の既定シークレット。本番ではこの値での起動を拒否する。 */
export const DEV_AUTH_SECRET = "dev-only-secret-change-in-production";

/**
 * 本番起動に必要な環境変数を検査する。
 * @param env - 検査対象の環境変数
 * @returns 問題がなければ `null`。あれば標準エラーへ出すメッセージ
 */
export function productionEnvError(env: NodeJS.ProcessEnv): string | null {
  if (env.NODE_ENV !== "production") {
    return null;
  }
  if (!env.CORS_ORIGIN) {
    return "FATAL: CORS_ORIGIN environment variable must be set in production";
  }
  if (!env.AUTH_SECRET) {
    return "FATAL: AUTH_SECRET environment variable must be set in production";
  }
  if (env.AUTH_SECRET === DEV_AUTH_SECRET) {
    return "FATAL: AUTH_SECRET must not use the development placeholder in production";
  }
  return null;
}

/**
 * 信頼するリバースプロキシの段数を読み取る。
 * クライアント IP(レートリミットのキー)は、この段数だけ `X-Forwarded-For` の末尾から遡って決まる。
 * 前段に TLS 用プロキシを足した場合は段数を増やさないと、全ユーザーがプロキシ 1 つの IP にまとまる。
 * @param env - 検査対象の環境変数
 * @returns 段数。`TRUST_PROXY` が未指定なら 1。0 以上の整数でなければ `null`
 */
export function trustProxyHops(env: NodeJS.ProcessEnv): number | null {
  const raw = env.TRUST_PROXY?.trim();
  if (!raw) return 1;
  if (!/^\d+$/.test(raw)) return null;
  return Number(raw);
}

/**
 * 認証 Cookie に Secure 属性を付けるか。
 * `COOKIE_SECURE` が明示されていればそれを優先する。未指定時は本番だけ true。
 * @param env - 検査対象の環境変数
 * @returns Secure を付ける場合は true
 */
export function isCookieSecure(env: NodeJS.ProcessEnv): boolean {
  if (env.COOKIE_SECURE === "true") return true;
  if (env.COOKIE_SECURE === "false") return false;
  return env.NODE_ENV === "production";
}
