// バックエンド API との通信を担う関数群
// VITE_API_URL 環境変数でベース URL を切り替え可能
import type {
  Row,
  Column,
  Task,
  Subtask,
  ChecklistItem,
  TaskComment,
} from "../types";

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
  checklists: TaskSnapshotChecklistPayload[];
  subtasks: TaskSnapshotSubtaskPayload[];
  comments: TaskSnapshotCommentPayload[];
}

const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:3001/api";

export interface FetchBoardOptions {
  row_id?: number;
  limit?: number;
  offset?: number;
}

/**
 * 指定の URL に fetch リクエストを送信する汎用ラッパー。
 * @param url - リクエスト先 URL
 * @param options - fetch に渡す RequestInit オプション
 * @returns レスポンス JSON を型引数 T として解決する Promise
 * @throws HTTP エラーまたはネットワークエラー時に Error をスロー
 */
async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, options);
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body?.error ?? `HTTP ${res.status}`);
  }
  return res.json() as Promise<T>;
}

/**
 * JSON ボディ付きリクエストの RequestInit を生成するヘルパー。
 * @param method - HTTP メソッド（'POST' | 'PUT' など）
 * @param body - シリアライズするリクエストボディ
 * @returns Content-Type: application/json を含む RequestInit
 */
function json(method: string, body: unknown): RequestInit {
  return {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  };
}

/**
 * ボード全体のデータ（行 -> カラム -> タスク の階層構造）を取得する。
 * @param options - 行 ID フィルタやページング用オプション
 * @returns 行配列を解決する Promise
 */
export const fetchBoard = (options?: FetchBoardOptions): Promise<Row[]> => {
  const params = new URLSearchParams();

  if (options?.row_id !== undefined) {
    params.set("row_id", String(options.row_id));
  }
  if (options?.limit !== undefined) {
    params.set("limit", String(options.limit));
  }
  if (options?.offset !== undefined) {
    params.set("offset", String(options.offset));
  }

  const query = params.toString();
  const url = query ? `${API_URL}/board?${query}` : `${API_URL}/board`;
  return request<Row[]>(url);
};

// 行（プロジェクト）の操作
/**
 * 新しい行を作成する。
 * @param title - タイトル
 * @param position - 表示順
 * @returns 作成した行を解決する Promise
 */
export const createRow = (title: string, position: number): Promise<Row> =>
  request<Row>(`${API_URL}/rows`, json("POST", { title, position }));

/**
 * 行とデフォルト3カラムを一括作成する。
 * @param title - 行タイトル
 * @param position - 行の表示順
 * @returns 作成した行（デフォルトカラム含む）を解決する Promise
 */
export const createRowWithDefaultColumns = (
  title: string,
  position: number,
): Promise<Row> =>
  request<Row>(
    `${API_URL}/rows/with-default-columns`,
    json("POST", { title, position }),
  );

/**
 * 行のタイトルを更新する。
 * @param id - 行 ID
 * @param title - 新たなタイトル
 * @returns 更新後の行を解決する Promise
 */
export const updateRow = (id: number, title: string): Promise<Row> =>
  request<Row>(`${API_URL}/rows/${id}`, json("PUT", { title }));

/**
 * 行を削除する（配下のカラム・タスクも連鎖削除）。
 * @param id - 行 ID
 * @returns 完了時に解決される Promise
 */
export const deleteRow = (id: number): Promise<void> =>
  request<void>(`${API_URL}/rows/${id}`, { method: "DELETE" });

// カラム（ステータス列）の操作
/**
 * 新しいカラムを作成する。
 * @param title - カラム名
 * @param position - 表示順
 * @param row_id - 所属行 ID
 * @returns 作成したカラムを解決する Promise
 */
export const createColumn = (
  title: string,
  position: number,
  row_id: number,
): Promise<Column> =>
  request<Column>(
    `${API_URL}/columns`,
    json("POST", { title, position, row_id }),
  );

/**
 * カラムのタイトルを更新する。
 * @param id - カラム ID
 * @param title - 新たなタイトル
 * @returns 更新後のカラムを解決する Promise
 */
export const updateColumn = (id: number, title: string): Promise<Column> =>
  request<Column>(`${API_URL}/columns/${id}`, json("PUT", { title }));

/**
 * カラムを削除する（配下タスクも連鎖削除）。
 * @param id - カラム ID
 * @returns 完了時に解決される Promise
 */
export const deleteColumn = (id: number): Promise<void> =>
  request<void>(`${API_URL}/columns/${id}`, { method: "DELETE" });

/**
 * カラムの表示順を更新する。
 * @param id - カラム ID
 * @param position - 新たな表示順
 * @returns 更新後のカラムを解決する Promise
 */
export const moveColumn = (id: number, position: number): Promise<Column> =>
  request<Column>(`${API_URL}/columns/${id}/move`, json("PUT", { position }));

// タスクの操作
/**
 * 新しいタスクを作成する。
 * @param column_id - 所属カラム ID
 * @param content - タスク内容
 * @param position - 表示順
 * @param due_date - 期限（YYYY-MM-DD または `null`）
 * @returns 作成したタスクを解決する Promise
 */
export const createTask = (
  column_id: number,
  content: string,
  position: number,
  due_date: string | null = null,
): Promise<Task> =>
  request<Task>(
    `${API_URL}/tasks`,
    json("POST", { column_id, content, position, due_date }),
  );

/**
 * タスクの内容または期限を更新する。
 * @param id - タスク ID
 * @param patch - 更新フィールド
 * @returns 更新後タスクを解決する Promise
 */
export const updateTask = (
  id: number,
  patch: { content?: string; due_date?: string | null },
): Promise<Task> => request<Task>(`${API_URL}/tasks/${id}`, json("PUT", patch));

/**
 * タスク編集モーダルの内容を一括保存する。
 * @param id - タスク ID
 * @param payload - モーダル全体の保存ペイロード
 * @returns 保存後タスクを解決する Promise
 */
export const saveTaskSnapshot = (
  id: number,
  payload: TaskSnapshotPayload,
): Promise<Task> =>
  request<Task>(`${API_URL}/tasks/${id}/snapshot`, json("PUT", payload));

/**
 * タスクを別のカラムへ移動する。
 * @param id - タスク ID
 * @param column_id - 移動先カラム ID
 * @param position - 移動先表示順
 * @returns 更新後タスクを解決する Promise
 */
export const moveTask = (
  id: number,
  column_id: number,
  position: number,
): Promise<Task> =>
  request<Task>(
    `${API_URL}/tasks/${id}/move`,
    json("PUT", { column_id, position }),
  );

/**
 * タスクを削除する（サブタスク・チェックリストも連鎖削除）。
 * @param id - タスク ID
 * @returns 完了時に解決される Promise
 */
export const deleteTask = (id: number): Promise<void> =>
  request<void>(`${API_URL}/tasks/${id}`, { method: "DELETE" });

// タスクコメントの操作
/**
 * 新しいタスクコメントを作成する。
 * @param task_id - 親タスク ID
 * @param content - コメント内容
 * @returns 作成したコメントを解決する Promise
 */
export const createTaskComment = (
  task_id: number,
  content: string,
): Promise<TaskComment> =>
  request<TaskComment>(
    `${API_URL}/task-comments`,
    json("POST", { task_id, content }),
  );

/**
 * タスクコメントを更新する。
 * @param id - コメント ID
 * @param patch - 更新フィールド
 * @returns 更新後コメントを解決する Promise
 */
export const updateTaskComment = (
  id: number,
  patch: { content?: string; position?: number },
): Promise<TaskComment> =>
  request<TaskComment>(`${API_URL}/task-comments/${id}`, json("PUT", patch));

/**
 * タスクコメントを削除する。
 * @param id - コメント ID
 * @returns 完了時に解決される Promise
 */
export const deleteTaskComment = (id: number): Promise<void> =>
  request<void>(`${API_URL}/task-comments/${id}`, { method: "DELETE" });

// サブタスクの操作
/**
 * 新しいサブタスクを作成する。
 * @param task_id - 親タスク ID
 * @param content - 内容
 * @returns 作成したサブタスクを解決する Promise
 */
export const createSubtask = (
  task_id: number,
  content: string,
): Promise<Subtask> =>
  request<Subtask>(`${API_URL}/subtasks`, json("POST", { task_id, content }));

/**
 * サブタスクの内容を更新する。
 * @param id - サブタスク ID
 * @param content - 新たな内容
 * @returns 更新後サブタスクを解決する Promise
 */
export const updateSubtask = (id: number, content: string): Promise<Subtask> =>
  request<Subtask>(`${API_URL}/subtasks/${id}`, json("PUT", { content }));

/**
 * サブタスクを削除する（配下チェックリストも連鎖削除）。
 * @param id - サブタスク ID
 * @returns 完了時に解決される Promise
 */
export const deleteSubtask = (id: number): Promise<void> =>
  request<void>(`${API_URL}/subtasks/${id}`, { method: "DELETE" });

// チェックリスト項目の操作
/**
 * チェックリスト項目を作成する。task_id または subtask_id のいずれかが必要。
 * @param content - 項目内容
 * @param task_id - タスク直下に紐付ける場合に指定
 * @param subtask_id - サブタスク配下に紐付ける場合に指定
 * @returns 作成した項目を解決する Promise
 */
export const createChecklistItem = (
  content: string,
  task_id?: number | null,
  subtask_id?: number | null,
): Promise<ChecklistItem> =>
  request<ChecklistItem>(
    `${API_URL}/checklist-items`,
    json("POST", {
      task_id: task_id ?? null,
      subtask_id: subtask_id ?? null,
      content,
    }),
  );

/**
 * チェックリスト項目の content または completed を更新する。
 * @param id - 項目 ID
 * @param patch - 更新するフィールド（completed、content、または position）
 * @returns 更新後項目を解決する Promise
 */
export const updateChecklistItem = (
  id: number,
  patch: { completed?: boolean; content?: string; position?: number },
): Promise<ChecklistItem> =>
  request<ChecklistItem>(
    `${API_URL}/checklist-items/${id}`,
    json("PUT", patch),
  );

/**
 * チェックリスト項目を削除する。
 * @param id - 項目 ID
 * @returns 完了時に解決される Promise
 */
export const deleteChecklistItem = (id: number): Promise<void> =>
  request<void>(`${API_URL}/checklist-items/${id}`, { method: "DELETE" });
