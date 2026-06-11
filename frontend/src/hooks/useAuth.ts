// 認証状態を管理するカスタムフック
import { useState, useEffect, useCallback } from "react";
import * as api from "../api/boardApi";
import { setOnUnauthorized } from "../api/boardApi";

/** 認証フローの現在フェーズ。 */
export type AuthStatus =
  | "checking" // 認証要否を確認中
  | "unregistered" // ユーザー未登録（初回セットアップ）
  | "unauthenticated" // 未ログイン
  | "authenticated"; // 認証済み

/** `useAuth` フックの戻り値型。 */
export interface UseAuthReturn {
  /** 現在の認証フェーズ */
  status: AuthStatus;
  /** ログイン処理（失敗時は `error` にメッセージを設定） */
  login: (username: string, password: string) => Promise<void>;
  /** 新規ユーザー登録（失敗時は `error` にメッセージを設定） */
  register: (username: string, password: string) => Promise<void>;
  /** ログアウト処理（ローカル状態を未ログインへ遷移） */
  logout: () => void;
  /** 直近の認証エラーメッセージ。なければ `null` */
  error: string | null;
  /** 表示中のエラーメッセージをクリアする */
  clearError: () => void;
}

/**
 * 認証状態を管理するカスタムフック。
 *
 * - マウント時に Cookie の JWT を検証して認証状態を決定する
 * - トークンは HttpOnly Cookie で管理し、JS からは操作しない
 * - API が 401 を返した場合は自動的に未ログイン状態へ遷移する
 *
 * @returns 認証状態・ログイン/登録/ログアウトハンドラー・エラー情報
 */
export function useAuth(): UseAuthReturn {
  const [status, setStatus] = useState<AuthStatus>("checking");
  const [error, setError] = useState<string | null>(null);

  // 401 受信時に強制ログアウトするコールバックを登録する
  const handleUnauthorized = useCallback(() => {
    setStatus("unauthenticated");
  }, []);

  useEffect(() => {
    setOnUnauthorized(handleUnauthorized);
  }, [handleUnauthorized]);

  // マウント時: Cookie の JWT を検証し、無効なら登録状況を確認する
  useEffect(() => {
    let cancelled = false;

    (async () => {
      const authenticated = await api.verify();
      if (cancelled) return;

      if (authenticated) {
        setStatus("authenticated");
        return;
      }

      try {
        const result = await api.checkStatus();
        if (!cancelled) {
          setStatus(result.hasUsers ? "unauthenticated" : "unregistered");
        }
      } catch {
        if (!cancelled) setStatus("unauthenticated");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const login = useCallback(async (username: string, password: string) => {
    setError(null);
    try {
      await api.login(username, password);
      setStatus("authenticated");
    } catch (err) {
      setError(err instanceof Error ? err.message : "ログインに失敗しました");
    }
  }, []);

  const register = useCallback(async (username: string, password: string) => {
    setError(null);
    try {
      await api.register(username, password);
      setStatus("authenticated");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "ユーザー登録に失敗しました",
      );
    }
  }, []);

  const logout = useCallback(() => {
    void api.logout();
    setStatus("unauthenticated");
  }, []);

  const clearError = useCallback(() => setError(null), []);

  return { status, login, register, logout, error, clearError };
}
