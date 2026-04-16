// フロントエンドで使用するデータ型の定義
// バックエンドの API レスポンス型に対応している

// チェックリスト項目
// task_id または subtask_id のどちらかに紐付く
export interface ChecklistItem {
  id: number | string;
  task_id: number | null;
  subtask_id: number | string | null;
  content: string;
  completed: boolean;
}

// サブタスク（タスク配下の子タスク）
// 配下にチェックリストを持つ
export interface Subtask {
  id: number | string;
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
