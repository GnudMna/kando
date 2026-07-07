import { useContext } from "react";
import { OperationErrorContext } from "./operationErrorContext";

/**
 * 操作エラー報告用フック。
 * @returns 現在のエラーと報告・クリア関数
 * @throws Error `OperationErrorProvider` 外で呼び出された場合
 */
export function useOperationError() {
  const ctx = useContext(OperationErrorContext);
  if (!ctx) {
    throw new Error(
      "useOperationError must be used within OperationErrorProvider",
    );
  }
  return ctx;
}
