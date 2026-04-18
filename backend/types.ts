/**
 * rows テーブルのレコード。
 * @property id - 行 ID
 * @property title - 行タイトル
 * @property position - 表示順
 */
export interface DbRow {
  id: number;
  title: string;
  position: number;
}

/**
 * columns テーブルのレコード。
 * @property id - カラム ID
 * @property title - カラム名
 * @property position - 表示順
 * @property row_id - 親行 ID
 */
export interface DbColumn {
  id: number;
  title: string;
  position: number;
  row_id: number;
}

/**
 * tasks テーブルのレコード。
 * @property id - タスク ID
 * @property column_id - 所属カラム ID
 * @property content - タスク内容
 * @property due_date - 期限日（YYYY-MM-DD、未設定時は null）
 * @property position - 表示順
 */
export interface DbTask {
  id: number;
  column_id: number;
  content: string;
  due_date: string | null;
  position: number;
}

/**
 * task_comments テーブルのレコード。
 * @property id - コメント ID
 * @property task_id - 親タスク ID
 * @property content - コメント内容
 * @property created_at - 作成日時
 * @property position - 表示順
 */
export interface DbTaskComment {
  id: number;
  task_id: number;
  content: string;
  created_at: string;
  position: number;
}

/**
 * subtasks テーブルのレコード。
 * @property id - サブタスク ID
 * @property task_id - 親タスク ID
 * @property content - サブタスク内容
 */
export interface DbSubtask {
  id: number;
  task_id: number;
  content: string;
}

/**
 * checklist_items テーブルのレコード。
 * `task_id` と `subtask_id` は排他的にどちらか片方のみを持つ。
 * @property id - 項目 ID
 * @property task_id - タスク直下に属する場合の親タスク ID
 * @property subtask_id - サブタスク配下に属する場合の親サブタスク ID
 * @property content - 項目内容
 * @property completed - 完了フラグ
 * @property position - 表示順
 */
export interface DbChecklistItem {
  id: number;
  // タスク直下のチェックリストの場合は task_id を持ち、subtask_id は null
  task_id: number | null;
  // サブタスク配下のチェックリストの場合は subtask_id を持ち、task_id は null
  subtask_id: number | null;
  content: string;
  completed: boolean;
  position: number;
}

/**
 * API で返すチェックリスト項目。
 * DB レコードと同一構造。
 */
export interface ChecklistItem extends DbChecklistItem {}

/**
 * API で返すタスクコメント。
 * DB レコードと同一構造。
 */
export interface TaskComment extends DbTaskComment {}

/**
 * API で返すサブタスク。
 * @property checklists - サブタスク配下のチェックリスト
 */
export interface Subtask extends DbSubtask {
  checklists: ChecklistItem[];
}

/**
 * API で返すタスク。
 * @property subtasks - 子サブタスク一覧
 * @property checklists - タスク直下のチェックリスト
 * @property comments - コメント一覧
 */
export interface Task extends DbTask {
  subtasks: Subtask[];
  checklists: ChecklistItem[];
  comments: TaskComment[];
}

/**
 * API で返すカラム。
 * @property tasks - 配下タスク一覧
 */
export interface Column extends DbColumn {
  tasks: Task[];
}

/**
 * API で返す行（最上位ノード）。
 * @property columns - 配下カラム一覧
 */
export interface Row extends DbRow {
  columns: Column[];
}
