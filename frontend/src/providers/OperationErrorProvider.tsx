import { useCallback, useMemo, useState, type ReactNode } from "react";
import {
  OperationErrorContext,
  type OperationErrorContextValue,
} from "./operationErrorContext";

/**
 * 操作エラー表示用の React Context プロバイダー。
 * 認証済みアプリ領域をラップし、共通エラーバナーと連携する。
 */
export function OperationErrorProvider({ children }: { children: ReactNode }) {
  const [error, setError] = useState<string | null>(null);

  const reportError = useCallback((message: string, err?: unknown) => {
    if (err !== undefined) {
      console.error(err);
    }
    setError(message);
  }, []);

  const clearError = useCallback(() => setError(null), []);

  const value = useMemo<OperationErrorContextValue>(
    () => ({ error, reportError, clearError }),
    [error, reportError, clearError],
  );

  return (
    <OperationErrorContext.Provider value={value}>
      {children}
    </OperationErrorContext.Provider>
  );
}
