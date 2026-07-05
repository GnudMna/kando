import { useContext } from "react";
import { AppNavigationContext } from "./appNavigationContext";

/**
 * アプリ内ナビゲーション(メモ帳・タスク編集)のコンテキストを取得する。
 * @returns `AppNavigationContextValue`
 */
export function useAppNavigation() {
  const ctx = useContext(AppNavigationContext);
  if (!ctx) {
    throw new Error(
      "useAppNavigation must be used within AppNavigationProvider",
    );
  }
  return ctx;
}
