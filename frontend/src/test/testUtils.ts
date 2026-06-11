import { vi } from "vitest";
import type { Mock } from "vitest";
import type { Row, Task } from "../types";

/** Vitest でモックする `fetch` レスポンスの最小形状。 */
export type FetchResponse = {
  ok: boolean;
  status?: number;
  json: () => Promise<unknown>;
};

/** `createFetchMock` が返す `fetch` モック関数の型。 */
export type FetchMock = Mock<(
  request: RequestInfo,
  init?: RequestInit,
) => Promise<FetchResponse>>;

/**
 * `fetch` の Vitest モックを生成する。
 * @returns 未設定の `fetch` モック関数
 */
export const createFetchMock = (): FetchMock => vi.fn<(
  request: RequestInfo,
  init?: RequestInit,
) => Promise<FetchResponse>>();

/**
 * 次の `fetch` 呼び出しに JSON レスポンスを返すようモックを設定する。
 * @param fetchMock - 設定対象の fetch モック
 * @param body - レスポンスボディ
 * @param status - HTTP ステータスコード（既定: 200）
 * @returns なし
 */
export const respondWithJson = <T>(
  fetchMock: FetchMock,
  body: T,
  status = 200,
): void => {
  fetchMock.mockResolvedValueOnce({
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  });
};

/**
 * 次の `fetch` 呼び出しにエラーレスポンスを返すようモックを設定する。
 * @param fetchMock - 設定対象の fetch モック
 * @param status - HTTP ステータスコード
 * @param body - エラーレスポンスボディ
 * @returns なし
 */
export const respondWithJsonError = (
  fetchMock: FetchMock,
  status: number,
  body: unknown,
): void => {
  fetchMock.mockResolvedValueOnce({
    ok: false,
    status,
    json: async () => body,
  });
};

/** `TaskCard` コンポーネントの props（テスト用）。 */
export interface TaskCardProps {
  task: Task;
  columnId: number;
  dueHighlight: { status: "none" | "overdue" | "soon"; daysUntilDue: number | null };
  onDeleteTask: (colId: number, taskId: number) => void;
  onCopyTask: (colId: number, taskId: number) => void;
  onTaskUpdated: (task: Task) => void;
  onEditTask: (task: Task, colId: number) => void;
}

/** テスト用の最小タスクデータ。 */
export const baseTask: Task = {
  id: 1,
  column_id: 10,
  content: "テストタスク",
  due_date: null,
  position: 1000,
  completed: false,
  subtasks: [],
  checklists: [],
  comments: [],
};

/** チェックリスト付きのテスト用タスクデータ。 */
export const taskWithChecklists: Task = {
  ...baseTask,
  checklists: [
    {
      id: 101,
      task_id: 1,
      subtask_id: null,
      content: "チェック項目A",
      completed: false,
      position: 1000,
    },
    {
      id: 102,
      task_id: 1,
      subtask_id: null,
      content: "チェック項目B",
      completed: true,
      position: 2000,
    },
  ],
};

/** サブタスク付きのテスト用タスクデータ。 */
export const taskWithSubtasks: Task = {
  ...baseTask,
  subtasks: [
    {
      id: 201,
      task_id: 1,
      content: "サブタスク1",
      checklists: [
        {
          id: 301,
          task_id: null,
          subtask_id: 201,
          content: "サブチェック",
          completed: false,
          position: 1000,
        },
      ],
    },
  ],
};

/**
 * `TaskCard` コンポーネントのテスト用 props を生成する。
 * @param overrides - 上書きする props の一部
 * @returns デフォルト値付きの `TaskCardProps`
 */
export const createTaskCardProps = (
  overrides?: Partial<TaskCardProps>,
): TaskCardProps => ({
  task: baseTask,
  columnId: 10,
  dueHighlight: { status: "none", daysUntilDue: null },
  onDeleteTask: vi.fn(),
  onCopyTask: vi.fn(),
  onTaskUpdated: vi.fn(),
  onEditTask: vi.fn(),
  ...overrides,
});

/**
 * `useBoard` フックのモック戻り値を生成する。
 * @param overrides - 上書きする戻り値プロパティ
 * @returns サンプルボードデータ付きのモック戻り値
 */
export const createMockUseBoardReturn = (
  overrides?: Record<string, unknown>,
) => ({
  rows: structuredClone(sampleBoardRows),
  isLoading: false,
  isLoadingMore: false,
  hasMore: false,
  operationError: null,
  clearError: vi.fn(),
  loadMoreRows: vi.fn().mockResolvedValue(undefined),
  addRow: vi.fn().mockResolvedValue(undefined),
  renameRow: vi.fn().mockResolvedValue(undefined),
  removeRow: vi.fn().mockResolvedValue(undefined),
  addColumn: vi.fn().mockResolvedValue(undefined),
  renameColumn: vi.fn().mockResolvedValue(undefined),
  removeColumn: vi.fn().mockResolvedValue(undefined),
  addTask: vi.fn().mockResolvedValue(null),
  removeTask: vi.fn().mockResolvedValue(undefined),
  copyTask: vi.fn().mockResolvedValue(null),
  updateTask: vi.fn(),
  moveTask: vi.fn().mockResolvedValue(undefined),
  moveColumn: vi.fn().mockResolvedValue(undefined),
  ...overrides,
});

/** `useBoard` モック等で使うサンプルボード行データ。 */
export const sampleBoardRows: Row[] = [
  {
    id: 1,
    title: "行1",
    position: 1000,
    columns: [
      { id: 10, row_id: 1, title: "カラム1", position: 1000, tasks: [baseTask] },
      { id: 11, row_id: 1, title: "カラム2", position: 2000, tasks: [] },
    ],
  },
  {
    id: 2,
    title: "行2",
    position: 2000,
    columns: [
      { id: 20, row_id: 2, title: "カラム3", position: 1000, tasks: [] },
    ],
  },
];
