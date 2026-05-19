/**
 * 共有 API 型パッケージ
 * - バックエンド・フロントエンドの両方で同じ型を参照するための共通定義
 */

/** DB の `rows` テーブルに対応する行レコード。 */
export interface DbRow {
  /** 行の一意 ID */
  id: number;
  /** 行タイトル */
  title: string;
  /** 表示順を表す浮動小数点値 */
  position: number;
}

/** DB の `columns` テーブルに対応するカラムレコード。 */
export interface DbColumn {
  /** カラムの一意 ID */
  id: number;
  /** カラムタイトル */
  title: string;
  /** 表示順を表す浮動小数点値 */
  position: number;
  /** 所属行の ID */
  row_id: number;
}

/** DB の `tasks` テーブルに対応するタスクレコード。 */
export interface DbTask {
  /** タスクの一意 ID */
  id: number;
  /** 所属カラムの ID */
  column_id: number;
  /** タスク内容 */
  content: string;
  /** 期限日（`YYYY-MM-DD` 形式、未設定の場合は `null`） */
  due_date: string | null;
  /** 表示順を表す浮動小数点値 */
  position: number;
  /** 完了済みフラグ */
  completed: boolean;
}

/** DB の `task_comments` テーブルに対応するコメントレコード。 */
export interface DbTaskComment {
  /** コメントの一意 ID */
  id: number;
  /** 親タスクの ID */
  task_id: number;
  /** コメント内容 */
  content: string;
  /** 作成日時（ISO 8601 形式） */
  created_at: string;
  /** 表示順を表す浮動小数点値 */
  position: number;
}

/** DB の `subtasks` テーブルに対応するサブタスクレコード。 */
export interface DbSubtask {
  /** サブタスクの一意 ID */
  id: number;
  /** 親タスクの ID */
  task_id: number;
  /** サブタスク内容 */
  content: string;
}

/** DB の `checklist_items` テーブルに対応するチェックリスト項目レコード。 */
export interface DbChecklistItem {
  /** チェックリスト項目の一意 ID */
  id: number;
  /** 紐付くタスクの ID（サブタスク配下の場合は `null`） */
  task_id: number | null;
  /** 紐付くサブタスクの ID（タスク直下の場合は `null`） */
  subtask_id: number | null;
  /** 項目内容 */
  content: string;
  /** 完了済みフラグ */
  completed: boolean;
  /** 表示順を表す浮動小数点値 */
  position: number;
}

/** API レスポンスで使用するチェックリスト項目型。 */
export interface ChecklistItem extends DbChecklistItem {}
/** API レスポンスで使用するタスクコメント型。 */
export interface TaskComment extends DbTaskComment {}

/** チェックリスト項目を含むサブタスク型。 */
export interface Subtask extends DbSubtask {
  /** 配下のチェックリスト項目 */
  checklists: ChecklistItem[];
}

/** サブタスク・チェックリスト・コメントを含むタスク型。 */
export interface Task extends DbTask {
  /** 配下のサブタスク */
  subtasks: Subtask[];
  /** タスク直下のチェックリスト項目 */
  checklists: ChecklistItem[];
  /** タスクコメント */
  comments: TaskComment[];
}

/** タスク一覧を含むカラム型。 */
export interface Column extends DbColumn {
  /** カラム内のタスク */
  tasks: Task[];
}

/** カラム一覧を含む行型。 */
export interface Row extends DbRow {
  /** 行内のカラム */
  columns: Column[];
}

/** タスク一括保存ペイロードのチェックリスト項目。 */
export interface TaskSnapshotChecklistPayload {
  /** 既存項目の ID（新規の場合は省略） */
  id?: number;
  /** 項目内容 */
  content: string;
  /** 完了済みフラグ */
  completed: boolean;
}

/** タスク一括保存ペイロードのサブタスク。 */
export interface TaskSnapshotSubtaskPayload {
  /** 既存サブタスクの ID（新規の場合は省略） */
  id?: number;
  /** サブタスク内容 */
  content: string;
  /** 配下チェックリスト */
  checklists: TaskSnapshotChecklistPayload[];
}

/** タスク一括保存ペイロードのコメント。 */
export interface TaskSnapshotCommentPayload {
  /** 既存コメントの ID（新規の場合は省略） */
  id?: number;
  /** コメント内容 */
  content: string;
}

/** タスク編集モーダルの一括保存 API に渡すペイロード。 */
export interface TaskSnapshotPayload {
  /** タスク内容 */
  content: string;
  /** 期限日（`YYYY-MM-DD` 形式、未設定の場合は `null`） */
  due_date: string | null;
  /** 完了済みフラグ */
  completed: boolean;
  /** タスク直下のチェックリスト項目 */
  checklists: TaskSnapshotChecklistPayload[];
  /** サブタスク */
  subtasks: TaskSnapshotSubtaskPayload[];
  /** コメント */
  comments: TaskSnapshotCommentPayload[];
}

/** DB の `memos` テーブルに対応するメモレコード。 */
export interface DbMemo {
  /** メモの一意 ID */
  id: number;
  /** 所有ユーザーの ID */
  user_id: number;
  /** メモタイトル */
  title: string;
  /** メモ内容 */
  content: string;
  /** 作成日時（ISO 8601 形式） */
  created_at: string;
  /** 更新日時（ISO 8601 形式） */
  updated_at: string;
}

/** API レスポンスで使用するメモ型。 */
export interface Memo extends DbMemo {
  /** 紐付くタスクの一覧 */
  tasks: { id: number; content: string }[];
}
