import { useCallback, useRef, useState, type ReactNode } from "react";
import {
  AppNavigationContext,
  type AppNavigationContextValue,
} from "./appNavigationContext";

type OpenTaskHandler = (taskId: number) => void;
type SelectMemoHandler = (memoId: number) => void;

/** メモ帳・タスク編集間のナビゲーション状態を提供する。 */
export function AppNavigationProvider({ children }: { children: ReactNode }) {
  const [memoOpen, setMemoOpen] = useState(false);
  const [activeMemoId, setActiveMemoId] = useState<number | null>(null);
  const openTaskHandlerRef = useRef<OpenTaskHandler | null>(null);
  const selectMemoHandlerRef = useRef<SelectMemoHandler | null>(null);

  const openMemo = useCallback((memoId: number) => {
    setActiveMemoId(memoId);
    setMemoOpen(true);
    selectMemoHandlerRef.current?.(memoId);
  }, []);

  const openTask = useCallback((taskId: number) => {
    openTaskHandlerRef.current?.(taskId);
  }, []);

  const registerOpenTaskHandler = useCallback((handler: OpenTaskHandler) => {
    openTaskHandlerRef.current = handler;
    return () => {
      if (openTaskHandlerRef.current === handler) {
        openTaskHandlerRef.current = null;
      }
    };
  }, []);

  const registerSelectMemoHandler = useCallback(
    (handler: SelectMemoHandler) => {
      selectMemoHandlerRef.current = handler;
      return () => {
        if (selectMemoHandlerRef.current === handler) {
          selectMemoHandlerRef.current = null;
        }
      };
    },
    [],
  );

  const closeMemo = useCallback(() => {
    setMemoOpen(false);
    setActiveMemoId(null);
  }, []);

  const value: AppNavigationContextValue = {
    openMemo,
    openTask,
    registerOpenTaskHandler,
    registerSelectMemoHandler,
    memoOpen,
    setMemoOpen,
    closeMemo,
    activeMemoId,
  };

  return (
    <AppNavigationContext.Provider value={value}>
      {children}
    </AppNavigationContext.Provider>
  );
}
