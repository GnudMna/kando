// 認証状態を管理するカスタムフック
import { useState, useEffect, useCallback } from "react";
import * as api from "../api/boardApi";
import { setAuthToken, setOnUnauthorized } from "../api/boardApi";

const TOKEN_STORAGE_KEY = "kando-auth-token";

export type AuthStatus =
  | "checking" // 認証要否を確認中
  | "unregistered" // ユーザー未登録（初回セットアップ）
  | "unauthenticated" // 未ログイン
  | "authenticated"; // 認証済み

export interface UseAuthReturn {
  status: AuthStatus;
  login: (username: string, password: string) => Promise<void>;
  register: (username: string, password: string) => Promise<void>;
  logout: () => void;
  error: string | null;
  clearError: () => void;
}

/**
 * 認証状態を管理するカスタムフック。
 * - マウント時にバックエンドのユーザー登録状況を確認する
 * - ユーザー未登録の場合は登録画面を表示する
 * - トークンを localStorage に保存し、再ロード後も維持する
 */
export function useAuth(): UseAuthReturn {
  // localStorage にトークンがあれば即座に authenticated で開始する（同期チェック）
  const [status, setStatus] = useState<AuthStatus>(() => {
    const storedToken = localStorage.getItem(TOKEN_STORAGE_KEY);
    if (storedToken) {
      setAuthToken(storedToken);
      return "authenticated";
    }
    return "checking";
  });
  const [error, setError] = useState<string | null>(null);

  // 401 受信時に強制ログアウトするコールバックを登録する
  const handleUnauthorized = useCallback(() => {
    localStorage.removeItem(TOKEN_STORAGE_KEY);
    setAuthToken(null);
    setStatus("unauthenticated");
  }, []);

  useEffect(() => {
    setOnUnauthorized(handleUnauthorized);
  }, [handleUnauthorized]);

  // トークン未保存の場合: ユーザーが登録されているかをサーバーに問い合わせる
  useEffect(() => {
    if (status !== "checking") return;
    api
      .checkStatus()
      .then((result) => {
        setStatus(result.hasUsers ? "unauthenticated" : "unregistered");
      })
      .catch(() => {
        setStatus("unauthenticated");
      });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const login = useCallback(async (username: string, password: string) => {
    setError(null);
    try {
      const result = await api.login(username, password);
      localStorage.setItem(TOKEN_STORAGE_KEY, result.token);
      setAuthToken(result.token);
      setStatus("authenticated");
    } catch (err) {
      setError(err instanceof Error ? err.message : "ログインに失敗しました");
    }
  }, []);

  const register = useCallback(async (username: string, password: string) => {
    setError(null);
    try {
      const result = await api.register(username, password);
      localStorage.setItem(TOKEN_STORAGE_KEY, result.token);
      setAuthToken(result.token);
      setStatus("authenticated");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "ユーザー登録に失敗しました",
      );
    }
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem(TOKEN_STORAGE_KEY);
    setAuthToken(null);
    setStatus("unauthenticated");
  }, []);

  const clearError = useCallback(() => setError(null), []);

  return { status, login, register, logout, error, clearError };
}
