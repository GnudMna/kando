// フロントエンドで使用するデータ型の定義
// バックエンドの API レスポンス型に対応している

// DB 保存前の一時 ID を表すブランデッド型
// 通常の string と区別することで、一時 ID を実 DB ID として誤用するのをコンパイル時に防ぐ
export type TempId = string & { readonly __brand: "TempId" };

// チェックリスト項目（API レスポンス・永続化済みデータ）
// task_id または subtask_id のどちらかに紐付く
export interface ChecklistItem {
  id: number;
  task_id: number | null;
  subtask_id: number | null;
  content: string;
  completed: boolean;
  position: number;
}

// タスクコメント
export interface TaskComment {
  id: number;
  task_id: number;
  content: string;
  created_at: string;
  position: number;
}

// サブタスク（タスク配下の子タスク、API レスポンス・永続化済みデータ）
// 配下にチェックリストを持つ
export interface Subtask {
  id: number;
  task_id: number;
  content: string;
  checklists: ChecklistItem[];
}

// タスク
// サブタスクとタスク直下のチェックリストを含む
export interface Task {
  id: number;
  column_id: number;
  content: string;
  position: number;
  subtasks: Subtask[];
  checklists: ChecklistItem[];
  comments: TaskComment[];
}

// カラム（ステータス列）
// タスクの一覧を含む
export interface Column {
  id: number;
  title: string;
  position: number;
  row_id: number;
  tasks: Task[];
}

// 行（プロジェクト単位）
// カラムの一覧を含む最上位の構造
export interface Row {
  id: number;
  title: string;
  position: number;
  columns: Column[];
}

// ---- ローカル編集状態用の型（TaskEditModal 内でのみ使用）----
// DB 保存前の一時 ID（TempId）を許容するバリアント

export interface LocalChecklistItem extends Omit<
  ChecklistItem,
  "id" | "subtask_id"
> {
  id: number | TempId;
  subtask_id: number | TempId | null;
}

export interface LocalTaskComment extends Omit<TaskComment, "id"> {
  id: number | TempId;
}

export interface LocalSubtask extends Omit<Subtask, "id" | "checklists"> {
  id: number | TempId;
  checklists: LocalChecklistItem[];
}

export interface LocalTask extends Omit<
  Task,
  "subtasks" | "checklists" | "comments"
> {
  subtasks: LocalSubtask[];
  checklists: LocalChecklistItem[];
  comments: LocalTaskComment[];
}
