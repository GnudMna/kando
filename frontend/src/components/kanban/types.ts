import type { Task } from "../../types";

/** 現在編集中のタスクとそのカラム ID を保持する型。 */
export interface EditingTask {
  task: Task;
  colId: number;
  /** 新規タスクの下書きか。`true` の間はサーバーに存在せず、保存時に初めて作成する */
  isNew: boolean;
  /** 新規タスクの追加先行 ID。`isNew` が `true` の場合のみ設定する */
  rowId?: number;
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
