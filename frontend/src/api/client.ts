/** バックエンド API のベース URL（`VITE_API_URL` で上書き可能）。 */
export const API_URL = import.meta.env.VITE_API_URL ?? "/api";

/**
 * バックエンド API クライアント。
 * - 認証は HttpOnly Cookie で行う（トークンを JS で保持しない）
 * - 401 受信時にコールバックを呼ぶ（ログアウト処理）
 */
class ApiClient {
  private onUnauthorized: (() => void) | null = null;

  /** 401 受信時に呼び出すコールバックを登録する。 */
  setOnUnauthorized(callback: () => void): void {
    this.onUnauthorized = callback;
  }

  /** 認証 Cookie 付きで HTTP リクエストを送信し、JSON レスポンスを返す。 */
  async request<T>(url: string, options?: RequestInit): Promise<T> {
    const res = await fetch(url, {
      ...options,
      credentials: "include",
      headers: {
        ...((options?.headers as Record<string, string>) ?? {}),
      },
    });
    if (!res.ok) {
      if (res.status === 401 && this.onUnauthorized) {
        this.onUnauthorized();
      }
      const body = await res.json().catch(() => ({}));
      throw new Error(body?.error ?? `HTTP ${res.status}`);
    }
    return res.json() as Promise<T>;
  }

  /** JSON ボディ付きリクエスト用の `RequestInit` を生成する。 */
  json(method: string, body: unknown): RequestInit {
    return {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    };
  }

  /** 認証フロー専用の raw fetch（401 時に onUnauthorized を発火しない）。 */
  async authRequest<T>(url: string, options?: RequestInit): Promise<T> {
    const res = await fetch(url, {
      ...options,
      credentials: "include",
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(body?.error ?? `HTTP ${res.status}`);
    }
    return body as T;
  }
}

/** 共有 API クライアントインスタンス。 */
export const apiClient = new ApiClient();

/** 401 Unauthorized 受信時のコールバックを登録する。 */
export function setOnUnauthorized(callback: () => void): void {
  apiClient.setOnUnauthorized(callback);
}
