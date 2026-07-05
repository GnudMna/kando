import type { Task } from "../../types";

/** 現在編集中のタスクとそのカラム ID を保持する型。 */
export interface EditingTask {
  task: Task;
  colId: number;
  isNew: boolean;
}

/** インライン編集中の行・カラムの ID とタイトルを保持する型。 */
export interface InlineEditState {
  id: number;
  title: string;
}

/** 確認ダイアログの表示内容とコールバックを保持する型。 */
export interface ConfirmState {
  message: string;
  onConfirm: () => void;
}
