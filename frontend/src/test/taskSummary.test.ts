import { describe, expect, it } from "vitest";
import type { Task } from "../types";
import {
  getTaskChecklistCount,
  getTaskCommentCount,
  getTaskSubtaskCount,
  isTaskSummary,
  taskNeedsDetailLoad,
} from "../utils/taskSummary";

const summaryTask: Task = {
  id: 1,
  column_id: 10,
  content: "タスク",
  due_date: null,
  position: 1000,
  completed: false,
  revision: 1,
  subtasks: [],
  checklists: [],
  comments: [],
  comment_count: 2,
  subtask_count: 1,
  checklist_count: 3,
};

const fullTask: Task = {
  ...summaryTask,
  comment_count: undefined,
  subtask_count: undefined,
  checklist_count: undefined,
  comments: [
    {
      id: 1,
      task_id: 1,
      content: "c",
      created_at: "2026-01-01T00:00:00Z",
      position: 1000,
    },
  ],
};

describe("taskSummary", () => {
  it("isTaskSummary が件数フィールドの有無を判定する", () => {
    expect(isTaskSummary(summaryTask)).toBe(true);
    expect(isTaskSummary(fullTask)).toBe(false);
  });

  it("taskNeedsDetailLoad がサマリーかつ子配列空のとき true", () => {
    expect(taskNeedsDetailLoad(summaryTask)).toBe(true);
    expect(taskNeedsDetailLoad(fullTask)).toBe(false);
  });

  it("件数ヘルパーが summary / full 双方で値を返す", () => {
    expect(getTaskCommentCount(summaryTask)).toBe(2);
    expect(getTaskSubtaskCount(summaryTask)).toBe(1);
    expect(getTaskChecklistCount(summaryTask)).toBe(3);
    expect(getTaskCommentCount(fullTask)).toBe(1);
  });
});
