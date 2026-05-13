/**
 * 共有 API 型パッケージ
 * - バックエンド・フロントエンドの両方で同じ型を参照するための共通定義
 */

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
  completed: boolean;
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
  task_id: number | null;
  subtask_id: number | null;
  content: string;
  completed: boolean;
  position: number;
}

export interface ChecklistItem extends DbChecklistItem {}
export interface TaskComment extends DbTaskComment {}

export interface Subtask extends DbSubtask {
  checklists: ChecklistItem[];
}

export interface Task extends DbTask {
  subtasks: Subtask[];
  checklists: ChecklistItem[];
  comments: TaskComment[];
}

export interface Column extends DbColumn {
  tasks: Task[];
}

export interface Row extends DbRow {
  columns: Column[];
}

export interface TaskSnapshotChecklistPayload {
  id?: number;
  content: string;
  completed: boolean;
}

export interface TaskSnapshotSubtaskPayload {
  id?: number;
  content: string;
  checklists: TaskSnapshotChecklistPayload[];
}

export interface TaskSnapshotCommentPayload {
  id?: number;
  content: string;
}

export interface TaskSnapshotPayload {
  content: string;
  due_date: string | null;
  completed: boolean;
  checklists: TaskSnapshotChecklistPayload[];
  subtasks: TaskSnapshotSubtaskPayload[];
  comments: TaskSnapshotCommentPayload[];
}
