// フロントエンドで使用するデータ型の定義
// バックエンドの API レスポンス型に対応している

/**
 * DB 保存前の一時 ID を表すブランデッド型。
 * 通常の string と区別することで、一時 ID を実 DB ID として誤用するのを防ぐ。
 */
export type TempId = string & { readonly __brand: "TempId" };

/**
 * チェックリスト項目（API レスポンス・永続化済みデータ）。
 * `task_id` または `subtask_id` のどちらかに紐付く。
 * @property id - 項目 ID
 * @property task_id - タスク直下に属する場合の親タスク ID
 * @property subtask_id - サブタスク配下に属する場合の親サブタスク ID
 * @property content - 項目内容
 * @property completed - 完了フラグ
 * @property position - 表示順
 */
export interface ChecklistItem {
  id: number;
  task_id: number | null;
  subtask_id: number | null;
  content: string;
  completed: boolean;
  position: number;
}

/**
 * タスクコメント。
 * @property id - コメント ID
 * @property task_id - 親タスク ID
 * @property content - コメント本文
 * @property created_at - 作成日時
 * @property position - 表示順
 */
export interface TaskComment {
  id: number;
  task_id: number;
  content: string;
  created_at: string;
  position: number;
}

/**
 * サブタスク（タスク配下の子タスク）。
 * @property id - サブタスク ID
 * @property task_id - 親タスク ID
 * @property content - サブタスク内容
 * @property checklists - 配下チェックリスト
 */
export interface Subtask {
  id: number;
  task_id: number;
  content: string;
  checklists: ChecklistItem[];
}

/**
 * タスク。
 * @property id - タスク ID
 * @property column_id - 所属カラム ID
 * @property content - タスク内容
 * @property due_date - 期限日（未設定時は null）
 * @property position - 表示順
 * @property subtasks - 子サブタスク
 * @property checklists - タスク直下チェックリスト
 * @property comments - コメント一覧
 */
export interface Task {
  id: number;
  column_id: number;
  content: string;
  due_date: string | null;
  position: number;
  subtasks: Subtask[];
  checklists: ChecklistItem[];
  comments: TaskComment[];
}

/**
 * カラム（ステータス列）。
 * @property id - カラム ID
 * @property title - カラム名
 * @property position - 表示順
 * @property row_id - 親行 ID
 * @property tasks - 配下タスク
 */
export interface Column {
  id: number;
  title: string;
  position: number;
  row_id: number;
  tasks: Task[];
}

/**
 * 行（プロジェクト単位、最上位ノード）。
 * @property id - 行 ID
 * @property title - 行タイトル
 * @property position - 表示順
 * @property columns - 配下カラム
 */
export interface Row {
  id: number;
  title: string;
  position: number;
  columns: Column[];
}

// ---- ローカル編集状態用の型（TaskEditModal 内でのみ使用）----
// DB 保存前の一時 ID（TempId）を許容するバリアント

/**
 * ローカル編集中のチェックリスト項目。
 * `id` と `subtask_id` は一時 ID を許容する。
 */
export interface LocalChecklistItem extends Omit<
  ChecklistItem,
  "id" | "subtask_id"
> {
  id: number | TempId;
  subtask_id: number | TempId | null;
}

/**
 * ローカル編集中のタスクコメント。
 * `id` は一時 ID を許容する。
 */
export interface LocalTaskComment extends Omit<TaskComment, "id"> {
  id: number | TempId;
}

/**
 * ローカル編集中のサブタスク。
 * `id` は一時 ID を許容する。
 */
export interface LocalSubtask extends Omit<Subtask, "id" | "checklists"> {
  id: number | TempId;
  checklists: LocalChecklistItem[];
}

/**
 * ローカル編集中のタスク。
 * 子要素はすべて一時 ID を許容する型へ置き換える。
 */
export interface LocalTask extends Omit<
  Task,
  "subtasks" | "checklists" | "comments"
> {
  subtasks: LocalSubtask[];
  checklists: LocalChecklistItem[];
  comments: LocalTaskComment[];
}
