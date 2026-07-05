import { createContext, type Dispatch, type SetStateAction } from "react";

type OpenTaskHandler = (taskId: number) => void;
type SelectMemoHandler = (memoId: number) => void;

export interface AppNavigationContextValue {
  /** メモ帳を開き、指定メモを選択する。 */
  openMemo: (memoId: number) => void;
  /** タスク編集モーダルを開く（KanbanBoard がハンドラを登録する）。 */
  openTask: (taskId: number) => void;
  /** タスクを開くハンドラを登録する。クリーンアップ関数を返す。 */
  registerOpenTaskHandler: (handler: OpenTaskHandler) => () => void;
  /** メモ選択ハンドラを登録する（パネル表示中の切り替え用）。 */
  registerSelectMemoHandler: (handler: SelectMemoHandler) => () => void;
  memoOpen: boolean;
  setMemoOpen: Dispatch<SetStateAction<boolean>>;
  closeMemo: () => void;
  activeMemoId: number | null;
}

export const AppNavigationContext =
  createContext<AppNavigationContextValue | null>(null);
