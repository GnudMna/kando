// taskSearch ユーティリティのユニットテスト
// タスク一致判定・階層フィルタ・件数集計の挙動を検証する
import { describe, it, expect } from "vitest";
import type { Row, Task } from "../types";
import {
  countTasks,
  filterRowsByTaskQuery,
  taskMatchesQuery,
} from "../utils/taskSearch";

// ネスト構造。サブタスク/チェックリスト/コメントを含む検索対象タスク
const baseTask: Task = {
  id: 1,
  column_id: 10,
  content: "Prepare API docs",
  due_date: null,
  position: 1000,
  completed: false,
  revision: 1,
  subtasks: [
    {
      id: 101,
      task_id: 1,
      content: "Review with team",
      checklists: [
        {
          id: 201,
          task_id: null,
          subtask_id: 101,
          content: "Collect feedback",
          completed: false,
          position: 1000,
        },
      ],
    },
  ],
  checklists: [
    {
      id: 202,
      task_id: 1,
      subtask_id: null,
      content: "Send estimate",
      completed: false,
      position: 1000,
    },
  ],
  comments: [
    {
      id: 301,
      task_id: 1,
      content: "Shared with stakeholders",
      created_at: "2026-04-10T10:00:00.000Z",
      position: 1000,
    },
  ],
};

// 期限日を持つ別タスク
const secondTask: Task = {
  id: 2,
  column_id: 11,
  content: "Fix login bug",
  due_date: "2026-04-30",
  position: 1000,
  completed: false,
  revision: 1,
  subtasks: [],
  checklists: [],
  comments: [],
};

// 複数行・複数カラムを含むテスト用ボード
const rows: Row[] = [
  {
    id: 1,
    title: "Project A",
    position: 1000,
    columns: [
      {
        id: 10,
        row_id: 1,
        title: "Todo",
        position: 1000,
        tasks: [baseTask],
      },
      {
        id: 11,
        row_id: 1,
        title: "Doing",
        position: 2000,
        tasks: [secondTask],
      },
    ],
  },
  {
    id: 2,
    title: "Project B",
    position: 2000,
    columns: [
      {
        id: 20,
        row_id: 2,
        title: "Todo",
        position: 1000,
        tasks: [
          {
            id: 3,
            column_id: 20,
            content: "Write onboarding guide",
            due_date: null,
            position: 1000,
            completed: false,
            revision: 1,
            subtasks: [],
            checklists: [],
            comments: [],
          },
        ],
      },
    ],
  },
];

describe("taskSearch", () => {
  it("taskMatchesQuery should match task content case-insensitively", () => {
    expect(taskMatchesQuery(baseTask, "api DOCS")).toBe(true);
    expect(taskMatchesQuery(baseTask, "unknown")).toBe(false);
  });

  it("taskMatchesQuery should match nested fields", () => {
    expect(taskMatchesQuery(baseTask, "review with team")).toBe(true);
    expect(taskMatchesQuery(baseTask, "collect feedback")).toBe(true);
    expect(taskMatchesQuery(baseTask, "send estimate")).toBe(true);
    expect(taskMatchesQuery(baseTask, "stakeholders")).toBe(true);
  });

  it("filterRowsByTaskQuery should keep only matched rows, columns, and tasks", () => {
    const filtered = filterRowsByTaskQuery(rows, "login");

    expect(filtered).toHaveLength(1);
    expect(filtered[0].id).toBe(1);
    expect(filtered[0].columns).toHaveLength(1);
    expect(filtered[0].columns[0].id).toBe(11);
    expect(filtered[0].columns[0].tasks).toHaveLength(1);
    expect(filtered[0].columns[0].tasks[0].id).toBe(2);
  });

  it("filterRowsByTaskQuery should return original rows when query is blank", () => {
    const filtered = filterRowsByTaskQuery(rows, "   ");

    expect(filtered).toBe(rows);
  });

  it("countTasks should return total task count", () => {
    expect(countTasks(rows)).toBe(3);
  });
});
