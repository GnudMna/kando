import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ListView } from "../components/ListView";
import {
  baseTask,
  sampleBoardRows,
  taskWithChecklists,
  taskWithSubtasks,
} from "./testUtils";
import type { DueHighlightResult } from "../utils/dueDate";

describe("ListView", () => {
  const onRowHeaderRender = vi.fn((row: { title: string }) => (
    <h2>{row.title}</h2>
  ));
  const onTaskClick = vi.fn();
  const onDeleteTask = vi.fn();
  const onAddTask = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  const renderListView = (
    overrides?: Partial<React.ComponentProps<typeof ListView>>,
  ) => {
    const rows = structuredClone(sampleBoardRows);
    rows[0].columns[0].tasks = [baseTask];
    const taskDueHighlights = new Map<number, DueHighlightResult>([
      [baseTask.id, { status: "none", daysUntilDue: null }],
    ]);

    return render(
      <ListView
        rows={rows}
        taskDueHighlights={taskDueHighlights}
        onRowHeaderRender={onRowHeaderRender}
        onTaskClick={onTaskClick}
        onDeleteTask={onDeleteTask}
        onAddTask={onAddTask}
        {...overrides}
      />,
    );
  };

  it("タスクとステータス列を表示する", () => {
    renderListView();
    expect(screen.getByText("テストタスク")).toBeInTheDocument();
    expect(screen.getByText("カラム1")).toBeInTheDocument();
    expect(screen.getByText("行1")).toBeInTheDocument();
  });

  it("タスク行クリックで onTaskClick を呼ぶ", () => {
    renderListView();
    fireEvent.click(screen.getByText("テストタスク"));
    expect(onTaskClick).toHaveBeenCalledWith(baseTask, 10);
  });

  it("削除ボタンで onDeleteTask を呼ぶ", () => {
    renderListView();
    fireEvent.click(screen.getByTitle("削除"));
    expect(onDeleteTask).toHaveBeenCalledWith(10, baseTask.id);
  });

  it("タスク追加ボタンで onAddTask を呼ぶ", () => {
    renderListView();
    fireEvent.click(screen.getAllByRole("button", { name: /タスクを追加/ })[0]);
    expect(onAddTask).toHaveBeenCalledWith(10, 1);
  });

  it("タスクがない行は空状態を表示する", () => {
    const emptyRows = structuredClone(sampleBoardRows);
    emptyRows[1].columns[0].tasks = [];

    renderListView({
      rows: emptyRows,
      taskDueHighlights: new Map(),
    });

    expect(screen.getByText("タスクがありません")).toBeInTheDocument();
  });

  it("サブタスクとチェックリストを表示する", () => {
    const rows = structuredClone(sampleBoardRows);
    rows[0].columns[0].tasks = [taskWithSubtasks];

    renderListView({
      rows,
      taskDueHighlights: new Map([
        [taskWithSubtasks.id, { status: "none", daysUntilDue: null }],
      ]),
    });

    expect(screen.getByText("サブタスク1")).toBeInTheDocument();
    expect(screen.getByText(/サブチェック/)).toBeInTheDocument();
  });

  it("タスク直下のチェックリストを表示する", () => {
    const rows = structuredClone(sampleBoardRows);
    rows[0].columns[0].tasks = [taskWithChecklists];

    renderListView({
      rows,
      taskDueHighlights: new Map([
        [taskWithChecklists.id, { status: "none", daysUntilDue: null }],
      ]),
    });

    expect(screen.getByText(/チェック項目A/)).toBeInTheDocument();
    expect(screen.getByText(/チェック項目B/)).toBeInTheDocument();
  });

  it("期限切れラベルを表示する", () => {
    const overdueTask = { ...baseTask, due_date: "2026-05-21" };
    const rows = structuredClone(sampleBoardRows);
    rows[0].columns[0].tasks = [overdueTask];

    renderListView({
      rows,
      taskDueHighlights: new Map([
        [overdueTask.id, { status: "overdue", daysUntilDue: -2 }],
      ]),
    });

    expect(screen.getByText("2日遅れ")).toBeInTheDocument();
    expect(screen.getByText(/2026\/05\/21/)).toBeInTheDocument();
  });
});
