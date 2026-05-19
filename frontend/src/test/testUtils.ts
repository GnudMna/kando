import { vi } from "vitest";
import type { Mock } from "vitest";
import type { Row, Task } from "../types";

export type FetchResponse = {
  ok: boolean;
  status?: number;
  json: () => Promise<unknown>;
};

export type FetchMock = Mock<(
  request: RequestInfo,
  init?: RequestInit,
) => Promise<FetchResponse>>;

export const createFetchMock = (): FetchMock => vi.fn<(
  request: RequestInfo,
  init?: RequestInit,
) => Promise<FetchResponse>>();

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

export interface TaskCardProps {
  task: Task;
  columnId: number;
  dueHighlight: { status: "none" | "overdue" | "soon"; daysUntilDue: number | null };
  onDeleteTask: (colId: number, taskId: number) => void;
  onCopyTask: (colId: number, taskId: number) => void;
  onTaskUpdated: (task: Task) => void;
  onEditTask: (task: Task, colId: number) => void;
}

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
