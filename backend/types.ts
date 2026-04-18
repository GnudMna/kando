// DB から取得する raw なレコード型
export interface DbRow {
  id: number;
  title: string;
  position: number;
}

export interface DbColumn {
  id: number;
  title: string;
  position: number;
  row_id: number;
}

export interface DbTask {
  id: number;
  column_id: number;
  content: string;
  due_date: string | null;
  position: number;
}

export interface DbTaskComment {
  id: number;
  task_id: number;
  content: string;
  created_at: string;
  position: number;
}

export interface DbSubtask {
  id: number;
  task_id: number;
  content: string;
}

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

// API レスポンス型（ネストされたデータ込み）
export interface ChecklistItem extends DbChecklistItem {}

export interface TaskComment extends DbTaskComment {}

// サブタスクは配下のチェックリストを含む
export interface Subtask extends DbSubtask {
  checklists: ChecklistItem[];
}

// タスクはサブタスクとタスク直下のチェックリストを含む
export interface Task extends DbTask {
  subtasks: Subtask[];
  checklists: ChecklistItem[];
  comments: TaskComment[];
}

// カラムはタスクの一覧を含む
export interface Column extends DbColumn {
  tasks: Task[];
}

// 行はカラムの一覧を含む（最上位のネスト構造）
export interface Row extends DbRow {
  columns: Column[];
}
