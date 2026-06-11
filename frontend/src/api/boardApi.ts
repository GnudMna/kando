// バックエンド API との通信を担う関数群
// VITE_API_URL 環境変数でベース URL を切り替え可能
import type {
  Row,
  Column,
  Task,
  Subtask,
  ChecklistItem,
  TaskComment,
  TaskSnapshotPayload,
  Memo,
} from "@kando/types";

/** タスク編集モーダルの一括保存ペイロード型（`@kando/types` から再エクスポート）。 */
export type { TaskSnapshotPayload } from "@kando/types";
/** メモエンティティ型（`@kando/types` から再エクスポート）。 */
export type { Memo } from "@kando/types";

const API_URL = import.meta.env.VITE_API_URL ?? "/api";

/** `fetchBoard` のクエリパラメータオプション。 */
export interface FetchBoardOptions {
  /** 特定行のみ取得する場合の行 ID */
  row_id?: number;
  /** 取得件数の上限 */
  limit?: number;
  /** スキップする件数（ページング用） */
  offset?: number;
}

/**
 * バックエンド API クライアント。
 * - 認証は HttpOnly Cookie で行う（トークンを JS で保持しない）
 * - 401 受信時にコールバックを呼ぶ（ログアウト処理）
 */
class BoardApiClient {
  private onUnauthorized: (() => void) | null = null;

  /**
   * 401 受信時に呼び出すコールバックを登録する。
   * @param callback - 未認証検知時の処理
   * @returns なし
   */
  setOnUnauthorized(callback: () => void): void {
    this.onUnauthorized = callback;
  }

  /**
   * 認証 Cookie 付きで HTTP リクエストを送信し、JSON レスポンスを返す。
   * @param url - リクエスト URL
   * @param options - `fetch` に渡すオプション
   * @returns パース済み JSON ボディ
   */
  async request<T>(url: string, options?: RequestInit): Promise<T> {
    const res = await fetch(url, {
      ...options,
      credentials: "include",
      headers: {
        ...((options?.headers as Record<string, string>) ?? {}),
      },
    });
    if (!res.ok) {
      if (res.status === 401 && this.onUnauthorized) {
        this.onUnauthorized();
      }
      const body = await res.json().catch(() => ({}));
      throw new Error(body?.error ?? `HTTP ${res.status}`);
    }
    return res.json() as Promise<T>;
  }

  /**
   * JSON ボディ付きリクエスト用の `RequestInit` を生成する。
   * @param method - HTTP メソッド
   * @param body - シリアライズするリクエストボディ
   * @returns `fetch` に渡す `RequestInit`
   */
  json(method: string, body: unknown): RequestInit {
    return {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    };
  }
}

const client = new BoardApiClient();

/**
 * 401 Unauthorized 受信時のコールバックを登録する。
 * @param callback - ログアウト処理など呼び出したい関数
 * @returns なし
 */
export function setOnUnauthorized(callback: () => void): void {
  client.setOnUnauthorized(callback);
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
  return client.request<Row[]>(url);
};

// 行（プロジェクト）の操作
/**
 * 新しい行を作成する。
 * @param title - タイトル
 * @param position - 表示順
 * @returns 作成した行を解決する Promise
 */
export const createRow = (title: string, position: number): Promise<Row> =>
  client.request<Row>(
    `${API_URL}/rows`,
    client.json("POST", { title, position }),
  );

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
  client.request<Row>(
    `${API_URL}/rows/with-default-columns`,
    client.json("POST", { title, position }),
  );

/**
 * 行のタイトルを更新する。
 * @param id - 行 ID
 * @param title - 新たなタイトル
 * @returns 更新後の行を解決する Promise
 */
export const updateRow = (id: number, title: string): Promise<Row> =>
  client.request<Row>(`${API_URL}/rows/${id}`, client.json("PUT", { title }));

/**
 * 行を削除する（配下のカラム・タスクも連鎖削除）。
 * @param id - 行 ID
 * @returns 完了時に解決される Promise
 */
export const deleteRow = (id: number): Promise<void> =>
  client.request<void>(`${API_URL}/rows/${id}`, { method: "DELETE" });

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
  client.request<Column>(
    `${API_URL}/columns`,
    client.json("POST", { title, position, row_id }),
  );

/**
 * カラムのタイトルを更新する。
 * @param id - カラム ID
 * @param title - 新たなタイトル
 * @returns 更新後のカラムを解決する Promise
 */
export const updateColumn = (id: number, title: string): Promise<Column> =>
  client.request<Column>(
    `${API_URL}/columns/${id}`,
    client.json("PUT", { title }),
  );

/**
 * カラムを削除する（配下タスクも連鎖削除）。
 * @param id - カラム ID
 * @returns 完了時に解決される Promise
 */
export const deleteColumn = (id: number): Promise<void> =>
  client.request<void>(`${API_URL}/columns/${id}`, { method: "DELETE" });

/**
 * カラムの表示順を更新する。
 * @param id - カラム ID
 * @param position - 新たな表示順
 * @returns 更新後のカラムを解決する Promise
 */
export const moveColumn = (id: number, position: number): Promise<Column> =>
  client.request<Column>(
    `${API_URL}/columns/${id}/move`,
    client.json("PUT", { position }),
  );

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
  client.request<Task>(
    `${API_URL}/tasks`,
    client.json("POST", { column_id, content, position, due_date }),
  );

/**
 * タスクの内容または期限を更新する。
 * @param id - タスク ID
 * @param patch - 更新フィールド
 * @returns 更新後タスクを解決する Promise
 */
export const updateTask = (
  id: number,
  patch: { content?: string; due_date?: string | null; completed?: boolean },
): Promise<Task> =>
  client.request<Task>(`${API_URL}/tasks/${id}`, client.json("PUT", patch));

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
  client.request<Task>(
    `${API_URL}/tasks/${id}/snapshot`,
    client.json("PUT", payload),
  );

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
  client.request<Task>(
    `${API_URL}/tasks/${id}/move`,
    client.json("PUT", { column_id, position }),
  );

/**
 * タスクを削除する（サブタスク・チェックリストも連鎖削除）。
 * @param id - タスク ID
 * @returns 完了時に解決される Promise
 */
export const deleteTask = (id: number): Promise<void> =>
  client.request<void>(`${API_URL}/tasks/${id}`, { method: "DELETE" });

/**
 * タスクをコピーする（サブタスク・チェックリスト・コメントも複製）。
 * @param id - コピー元タスク ID
 * @returns 複製後タスクを解決する Promise
 */
export const copyTask = (id: number): Promise<Task> =>
  client.request<Task>(`${API_URL}/tasks/${id}/copy`, { method: "POST" });

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
  client.request<TaskComment>(
    `${API_URL}/task-comments`,
    client.json("POST", { task_id, content }),
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
  client.request<TaskComment>(
    `${API_URL}/task-comments/${id}`,
    client.json("PUT", patch),
  );

/**
 * タスクコメントを削除する。
 * @param id - コメント ID
 * @returns 完了時に解決される Promise
 */
export const deleteTaskComment = (id: number): Promise<void> =>
  client.request<void>(`${API_URL}/task-comments/${id}`, { method: "DELETE" });

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
  client.request<Subtask>(
    `${API_URL}/subtasks`,
    client.json("POST", { task_id, content }),
  );

/**
 * サブタスクの内容を更新する。
 * @param id - サブタスク ID
 * @param content - 新たな内容
 * @returns 更新後サブタスクを解決する Promise
 */
export const updateSubtask = (id: number, content: string): Promise<Subtask> =>
  client.request<Subtask>(
    `${API_URL}/subtasks/${id}`,
    client.json("PUT", { content }),
  );

/**
 * サブタスクを削除する（配下チェックリストも連鎖削除）。
 * @param id - サブタスク ID
 * @returns 完了時に解決される Promise
 */
export const deleteSubtask = (id: number): Promise<void> =>
  client.request<void>(`${API_URL}/subtasks/${id}`, { method: "DELETE" });

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
  client.request<ChecklistItem>(
    `${API_URL}/checklist-items`,
    client.json("POST", {
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
  client.request<ChecklistItem>(
    `${API_URL}/checklist-items/${id}`,
    client.json("PUT", patch),
  );

/**
 * チェックリスト項目を削除する。
 * @param id - 項目 ID
 * @returns 完了時に解決される Promise
 */
export const deleteChecklistItem = (id: number): Promise<void> =>
  client.request<void>(`${API_URL}/checklist-items/${id}`, {
    method: "DELETE",
  });

/** `checkStatus` API のレスポンス型。 */
export interface AuthStatusResult {
  /** 登録済みユーザーが 1 人以上存在するか */
  hasUsers: boolean;
}

// 認証の操作
/**
 * ユーザーが1人以上登録されているかをバックエンドに問い合わせる。
 * BoardApiClient を使わず raw fetch とし、401 時に onUnauthorized を発火させない（初回判定用）。
 * @returns ステータス情報を解決する Promise
 */
export const checkStatus = (): Promise<AuthStatusResult> =>
  fetch(`${API_URL}/auth/status`, { credentials: "include" }).then(
    async (res) => {
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body?.error ?? `HTTP ${res.status}`);
      return body as AuthStatusResult;
    },
  );

/**
 * Cookie の JWT を検証し、認証済みなら true を返す。
 * 未認証（401）なら false を返す。ネットワークエラー時も false。
 * BoardApiClient を使わず raw fetch とし、401 時に onUnauthorized を発火させない（初回判定用）。
 * @returns 認証済みかどうか
 */
export const verify = (): Promise<boolean> =>
  fetch(`${API_URL}/auth/verify`, { credentials: "include" })
    .then((res) => res.ok)
    .catch(() => false);

/**
 * ユーザー名とパスワードでログインする。Cookie に JWT がセットされる。
 * 認証フロー専用のため BoardApiClient ではなく raw fetch を使用する。
 * @param username - ユーザー名
 * @param password - パスワード
 * @returns ログイン完了時に解決される Promise
 */
export const login = (username: string, password: string): Promise<void> =>
  fetch(`${API_URL}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ username, password }),
  }).then(async (res) => {
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(body?.error ?? `HTTP ${res.status}`);
  });

/**
 * 新規ユーザーを登録する。Cookie に JWT がセットされる。
 * 既存の未割り当てデータは登録ユーザーへ移行される。
 * 認証フロー専用のため BoardApiClient ではなく raw fetch を使用する。
 * @param username - ユーザー名
 * @param password - パスワード（12文字以上）
 * @returns 登録完了時に解決される Promise
 */
export const register = (username: string, password: string): Promise<void> =>
  fetch(`${API_URL}/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ username, password }),
  }).then(async (res) => {
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(body?.error ?? `HTTP ${res.status}`);
  });

/**
 * ログアウトする。バックエンドの Cookie をクリアする。
 * @returns ログアウト完了時に解決される Promise
 */
export const logout = (): Promise<void> =>
  fetch(`${API_URL}/auth/logout`, {
    method: "POST",
    credentials: "include",
  }).then(() => undefined);

// メモの操作
/**
 * メモ一覧を取得する。
 * @returns メモ配列を解決する Promise
 */
export const fetchMemos = (): Promise<Memo[]> =>
  client.request<Memo[]>(`${API_URL}/memos`);

/**
 * 新しいメモを作成する。
 * @param title - タイトル
 * @param content - 内容
 * @returns 作成したメモを解決する Promise
 */
export const createMemo = (title: string, content: string): Promise<Memo> =>
  client.request<Memo>(
    `${API_URL}/memos`,
    client.json("POST", { title, content }),
  );

/**
 * メモを更新する。
 * @param id - メモ ID
 * @param patch - 更新フィールド
 * @returns 更新後メモを解決する Promise
 */
export const updateMemo = (
  id: number,
  patch: { title?: string; content?: string },
): Promise<Memo> =>
  client.request<Memo>(`${API_URL}/memos/${id}`, client.json("PUT", patch));

/**
 * メモを削除する。
 * @param id - メモ ID
 * @returns 完了時に解決される Promise
 */
export const deleteMemo = (id: number): Promise<void> =>
  client.request<void>(`${API_URL}/memos/${id}`, { method: "DELETE" });

/**
 * タスクをメモに関連付ける。
 * @param memoId - メモ ID
 * @param taskId - タスク ID
 * @returns 更新後メモを解決する Promise
 */
export const linkMemoTask = (memoId: number, taskId: number): Promise<Memo> =>
  client.request<Memo>(
    `${API_URL}/memos/${memoId}/tasks`,
    client.json("POST", { task_id: taskId }),
  );

/**
 * タスクとメモの関連付けを解除する。
 * @param memoId - メモ ID
 * @param taskId - タスク ID
 * @returns 更新後メモを解決する Promise
 */
export const unlinkMemoTask = (memoId: number, taskId: number): Promise<Memo> =>
  client.request<Memo>(`${API_URL}/memos/${memoId}/tasks/${taskId}`, {
    method: "DELETE",
  });
