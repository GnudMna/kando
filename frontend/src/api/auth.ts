import { API_URL, apiClient } from "./client.js";

/** `checkStatus` API のレスポンス型。 */
export interface AuthStatusResult {
  /** 登録済みユーザーが 1 人以上存在するか */
  hasUsers: boolean;
}

/**
 * ユーザーが1人以上登録されているかをバックエンドに問い合わせる。
 * @returns 登録状況を含む認証ステータス
 */
export const checkStatus = (): Promise<AuthStatusResult> =>
  apiClient.authRequest<AuthStatusResult>(`${API_URL}/auth/status`);

/**
 * Cookie の JWT を検証し、認証済みなら true を返す。
 * @returns 認証済みなら `true`
 */
export const verify = (): Promise<boolean> =>
  fetch(`${API_URL}/auth/verify`, { credentials: "include" })
    .then((res) => res.ok)
    .catch(() => false);

/**
 * ユーザー名とパスワードでログインする。
 * @param username - ユーザー名
 * @param password - パスワード
 */
export const login = (username: string, password: string): Promise<void> =>
  apiClient
    .authRequest<void>(`${API_URL}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    })
    .then(() => undefined);

/**
 * 新規ユーザーを登録する。
 * @param username - ユーザー名
 * @param password - パスワード
 */
export const register = (username: string, password: string): Promise<void> =>
  apiClient
    .authRequest<void>(`${API_URL}/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    })
    .then(() => undefined);

/**
 * ログアウトする。
 */
export const logout = (): Promise<void> =>
  fetch(`${API_URL}/auth/logout`, {
    method: "POST",
    credentials: "include",
  }).then(() => undefined);
