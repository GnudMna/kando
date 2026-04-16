// バックエンド API との通信を担う関数群
// VITE_API_URL 環境変数でベース URL を切り替え可能
import type { Row, Column, Task, Subtask, ChecklistItem } from '../types';

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3001/api';

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
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  };
}

/** ボード全体のデータ（行 → カラム → タスク の階層構造）を取得する */
export const fetchBoard = (): Promise<Row[]> =>
  request<Row[]>(`${API_URL}/board`);

// 行（プロジェクト）の操作
/** 新しい行を作成する。@param title タイトル @param position 表示順 */
export const createRow = (title: string, position: number): Promise<Row> =>
  request<Row>(`${API_URL}/rows`, json('POST', { title, position }));

/** 行のタイトルを更新する。@param id 行 ID @param title 新たなタイトル */
export const updateRow = (id: number, title: string): Promise<Row> =>
  request<Row>(`${API_URL}/rows/${id}`, json('PUT', { title }));

/** 行を削除する（配下のカラム・タスクも連鎖削除）。@param id 行 ID */
export const deleteRow = (id: number): Promise<void> =>
  request<void>(`${API_URL}/rows/${id}`, { method: 'DELETE' });

// カラム（ステータス列）の操作
/**
 * 新しいカラムを作成する。
 * @param title カラム名 @param position 表示順 @param row_id 所属行 ID
 */
export const createColumn = (
  title: string,
  position: number,
  row_id: number
): Promise<Column> =>
  request<Column>(`${API_URL}/columns`, json('POST', { title, position, row_id }));

/** カラムのタイトルを更新する。@param id カラム ID @param title 新たなタイトル */
export const updateColumn = (id: number, title: string): Promise<Column> =>
  request<Column>(`${API_URL}/columns/${id}`, json('PUT', { title }));

/** カラムを削除する（配下タスクも連鎖削除）。@param id カラム ID */
export const deleteColumn = (id: number): Promise<void> =>
  request<void>(`${API_URL}/columns/${id}`, { method: 'DELETE' });

// タスクの操作
/**
 * 新しいタスクを作成する。
 * @param column_id 所属カラム ID @param content タスク内容 @param position 表示順
 */
export const createTask = (
  column_id: number,
  content: string,
  position: number
): Promise<Task> =>
  request<Task>(`${API_URL}/tasks`, json('POST', { column_id, content, position }));

/** タスクの内容を更新する。@param id タスク ID @param content 新たな内容 */
export const updateTask = (id: number, content: string): Promise<Task> =>
  request<Task>(`${API_URL}/tasks/${id}`, json('PUT', { content }));

/**
 * タスクを別のカラムへ移動する。
 * @param id タスク ID @param column_id 移動先カラム ID @param position 移動先表示順
 */
export const moveTask = (
  id: number,
  column_id: number,
  position: number
): Promise<Task> =>
  request<Task>(`${API_URL}/tasks/${id}/move`, json('PUT', { column_id, position }));

/** タスクを削除する（サブタスク・チェックリストも連鎖削除）。@param id タスク ID */
export const deleteTask = (id: number): Promise<void> =>
  request<void>(`${API_URL}/tasks/${id}`, { method: 'DELETE' });

// サブタスクの操作
/** 新しいサブタスクを作成する。@param task_id 親タスク ID @param content 内容 */
export const createSubtask = (task_id: number, content: string): Promise<Subtask> =>
  request<Subtask>(`${API_URL}/subtasks`, json('POST', { task_id, content }));

/** サブタスクの内容を更新する。@param id サブタスク ID @param content 新たな内容 */
export const updateSubtask = (id: number, content: string): Promise<Subtask> =>
  request<Subtask>(`${API_URL}/subtasks/${id}`, json('PUT', { content }));

/** サブタスクを削除する（配下チェックリストも連鎖削除）。@param id サブタスク ID */
export const deleteSubtask = (id: number): Promise<void> =>
  request<void>(`${API_URL}/subtasks/${id}`, { method: 'DELETE' });

// チェックリスト項目の操作
/**
 * チェックリスト項目を作成する。task_id または subtask_id のいずれかが必要。
 * @param content 項目内容
 * @param task_id タスク直下に紐付ける場合に指定
 * @param subtask_id サブタスク配下に紐付ける場合に指定
 */
export const createChecklistItem = (
  content: string,
  task_id?: number | null,
  subtask_id?: number | null
): Promise<ChecklistItem> =>
  request<ChecklistItem>(
    `${API_URL}/checklist-items`,
    json('POST', { task_id: task_id ?? null, subtask_id: subtask_id ?? null, content })
  );

/**
 * チェックリスト項目の content または completed を更新する。
 * @param id 項目 ID
 * @param patch 更新するフィールド（completed または content）
 */
export const updateChecklistItem = (
  id: number,
  patch: { completed?: boolean; content?: string }
): Promise<ChecklistItem> =>
  request<ChecklistItem>(`${API_URL}/checklist-items/${id}`, json('PUT', patch));

/** チェックリスト項目を削除する。@param id 項目 ID */
export const deleteChecklistItem = (id: number): Promise<void> =>
  request<void>(`${API_URL}/checklist-items/${id}`, { method: 'DELETE' });
