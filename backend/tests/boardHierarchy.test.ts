// buildBoardHierarchy の純粋関数テスト
// フラットな DB レコード群から期待するネスト構造へ変換できることを検証する
import { describe, it, expect } from "vitest";
import { buildBoardHierarchy } from "../services/boardService.js";
import type {
  DbRow,
  DbColumn,
  DbTask,
  DbSubtask,
  DbChecklistItem,
  DbTaskComment,
} from "../types";

describe("buildBoardHierarchy", () => {
  it("線形グルーピングで正しくネスト構造を組み立てる", () => {
    const rows: DbRow[] = [
      { id: 1, title: "Row 1", position: 1000 },
      { id: 2, title: "Row 2", position: 2000 },
    ];

    const columns: DbColumn[] = [
      { id: 11, title: "Column A", position: 1000, row_id: 1 },
      { id: 12, title: "Column B", position: 2000, row_id: 1 },
      { id: 21, title: "Column C", position: 1000, row_id: 2 },
      { id: 99, title: "Orphan Column", position: 9999, row_id: 999 },
    ];

    const tasks: DbTask[] = [
      {
        id: 101,
        column_id: 11,
        content: "Task 1",
        due_date: "2026-06-01",
        position: 1000,
      },
      {
        id: 102,
        column_id: 11,
        content: "Task 2",
        due_date: null,
        position: 2000,
      },
      {
        id: 201,
        column_id: 21,
        content: "Task 3",
        due_date: "2026-06-15",
        position: 1000,
      },
      {
        id: 999,
        column_id: 999,
        content: "Orphan Task",
        due_date: null,
        position: 1,
      },
    ];

    const subtasks: DbSubtask[] = [
      { id: 1001, task_id: 101, content: "Subtask 1-1" },
      { id: 1002, task_id: 101, content: "Subtask 1-2" },
      { id: 2001, task_id: 201, content: "Subtask 3-1" },
    ];

    const checklistItems: DbChecklistItem[] = [
      {
        id: 5001,
        task_id: 101,
        subtask_id: null,
        content: "Task 1 checklist",
        completed: false,
        position: 1000,
      },
      {
        id: 5002,
        task_id: null,
        subtask_id: 1001,
        content: "Subtask 1-1 checklist",
        completed: true,
        position: 1000,
      },
      {
        id: 5003,
        task_id: 201,
        subtask_id: null,
        content: "Task 3 checklist",
        completed: false,
        position: 1000,
      },
      {
        id: 5999,
        task_id: null,
        subtask_id: null,
        content: "Invalid checklist",
        completed: false,
        position: 9999,
      },
    ];

    const taskComments: DbTaskComment[] = [
      {
        id: 7001,
        task_id: 101,
        content: "Task 1 comment A",
        created_at: "2026-01-01T00:00:00.000Z",
        position: 1000,
      },
      {
        id: 7002,
        task_id: 101,
        content: "Task 1 comment B",
        created_at: "2026-01-02T00:00:00.000Z",
        position: 2000,
      },
      {
        id: 7003,
        task_id: 201,
        content: "Task 3 comment",
        created_at: "2026-01-03T00:00:00.000Z",
        position: 1000,
      },
      {
        id: 7999,
        task_id: 999,
        content: "Orphan task comment",
        created_at: "2026-01-04T00:00:00.000Z",
        position: 1000,
      },
    ];

    const board = buildBoardHierarchy(
      rows,
      columns,
      tasks,
      subtasks,
      checklistItems,
      taskComments,
    );

    expect(board).toHaveLength(2);

    expect(board[0].id).toBe(1);
    expect(board[0].columns.map((c) => c.id)).toEqual([11, 12]);

    const row1colA = board[0].columns[0];
    expect(row1colA.tasks.map((t) => t.id)).toEqual([101, 102]);

    const task1 = row1colA.tasks[0];
    expect(task1.due_date).toBe("2026-06-01");
    expect(task1.checklists.map((c) => c.id)).toEqual([5001]);
    expect(task1.subtasks.map((s) => s.id)).toEqual([1001, 1002]);
    expect(task1.subtasks[0].checklists.map((c) => c.id)).toEqual([5002]);
    expect(task1.comments.map((c) => c.id)).toEqual([7001, 7002]);

    expect(board[1].id).toBe(2);
    expect(board[1].columns.map((c) => c.id)).toEqual([21]);
    expect(board[1].columns[0].tasks.map((t) => t.id)).toEqual([201]);
    expect(board[1].columns[0].tasks[0].checklists.map((c) => c.id)).toEqual([
      5003,
    ]);
    expect(board[1].columns[0].tasks[0].comments.map((c) => c.id)).toEqual([
      7003,
    ]);
  });
});
