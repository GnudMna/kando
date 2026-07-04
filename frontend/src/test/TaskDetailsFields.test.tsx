import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { TaskDetailsFields } from "../components/taskEdit/TaskDetailsFields";
import type { LocalTask } from "../types";

describe("TaskDetailsFields", () => {
  const baseLocalTask: LocalTask = {
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

  it("タスク内容と期限未設定が表示される", () => {
    render(
      <TaskDetailsFields
        localTask={baseLocalTask}
        onLocalTaskChange={vi.fn()}
        taskContentInputId="content-id"
        taskDueDateInputId="due-id"
      />,
    );

    expect(screen.getByLabelText("タスク内容")).toHaveValue("テストタスク");
    expect(screen.getByText("期限未設定")).toBeInTheDocument();
  });

  it("期限が設定されている場合にフォーマット済み表示をする", () => {
    const taskWithDue: LocalTask = {
      ...baseLocalTask,
      due_date: "2026-12-25",
    };

    render(
      <TaskDetailsFields
        localTask={taskWithDue}
        onLocalTaskChange={vi.fn()}
        taskContentInputId="content-id"
        taskDueDateInputId="due-id"
      />,
    );

    expect(screen.getByLabelText("期限")).toHaveValue("2026-12-25");
    expect(screen.getByText(/現在の期限:/)).toBeInTheDocument();
  });

  it("完了ボタンで completed がトグルされる", () => {
    const onChange = vi.fn(
      (updater: (prev: LocalTask) => LocalTask) => updater(baseLocalTask),
    );

    render(
      <TaskDetailsFields
        localTask={baseLocalTask}
        onLocalTaskChange={onChange}
        taskContentInputId="content-id"
        taskDueDateInputId="due-id"
      />,
    );

    fireEvent.click(
      screen.getByRole("button", { name: "未完了（クリックで完了にする）" }),
    );

    const updater = onChange.mock.calls[0][0] as (prev: LocalTask) => LocalTask;
    expect(updater(baseLocalTask).completed).toBe(true);
  });

  it("完了済みタスクは完了表示になる", () => {
    render(
      <TaskDetailsFields
        localTask={{ ...baseLocalTask, completed: true }}
        onLocalTaskChange={vi.fn()}
        taskContentInputId="content-id"
        taskDueDateInputId="due-id"
      />,
    );

    expect(
      screen.getByRole("button", { name: "完了済み（クリックで戻す）" }),
    ).toBeInTheDocument();
  });
});
