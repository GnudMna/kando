// TaskCard コンポーネントのユニットテスト
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { TaskCard } from "../components/TaskCard";
import type { Task } from "../types";
import * as api from "../api/boardApi";

vi.mock("../api/boardApi");

const baseTask: Task = {
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

const taskWithChecklists: Task = {
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

const taskWithSubtasks: Task = {
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

describe("TaskCard", () => {
  const defaultProps = {
    task: baseTask,
    columnId: 10,
    dueHighlight: { status: "none" as const, daysUntilDue: null },
    onDeleteTask: vi.fn(),
    onTaskUpdated: vi.fn(),
    onEditTask: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("タスク内容が表示されること", () => {
    render(<TaskCard {...defaultProps} />);
    expect(screen.getByText("テストタスク")).toBeInTheDocument();
  });

  it("タスクをクリックすると onEditTask が呼ばれること", () => {
    render(<TaskCard {...defaultProps} />);
    fireEvent.click(screen.getByText("テストタスク"));
    expect(defaultProps.onEditTask).toHaveBeenCalledWith(baseTask);
  });

  it("チェックリスト項目が表示されること", () => {
    render(<TaskCard {...defaultProps} task={taskWithChecklists} />);
    expect(screen.getByText("チェック項目A")).toBeInTheDocument();
    expect(screen.getByText("チェック項目B")).toBeInTheDocument();
  });

  it("期限がある場合に期限が表示されること", () => {
    render(
      <TaskCard
        {...defaultProps}
        task={{ ...baseTask, due_date: "2026-05-21" }}
      />,
    );
    expect(screen.getByText(/2026\/05\/21/)).toBeInTheDocument();
  });

  it("期限切れ状態のラベルが表示されること", () => {
    render(
      <TaskCard
        {...defaultProps}
        task={{ ...baseTask, due_date: "2026-05-21" }}
        dueHighlight={{ status: "overdue", daysUntilDue: -2 }}
      />,
    );
    expect(screen.getByText("2日遅れ")).toBeInTheDocument();
  });

  it("チェックリストのトグルで API が呼ばれ onTaskUpdated が実行されること", async () => {
    const updatedItem = {
      id: 101,
      task_id: 1,
      subtask_id: null,
      content: "チェック項目A",
      completed: true,
      position: 1000,
    };
    vi.mocked(api.updateChecklistItem).mockResolvedValue(updatedItem);

    const onTaskUpdated = vi.fn();
    render(
      <TaskCard
        {...defaultProps}
        task={taskWithChecklists}
        onTaskUpdated={onTaskUpdated}
      />,
    );

    // 未完了のチェックリストボタンをクリック
    fireEvent.click(
      screen.getByRole("button", {
        name: "チェックリスト「チェック項目A」を完了にする",
      }),
    );

    await waitFor(() => {
      expect(api.updateChecklistItem).toHaveBeenCalledWith(101, {
        completed: true,
      });
      expect(onTaskUpdated).toHaveBeenCalledWith(
        expect.objectContaining({
          checklists: expect.arrayContaining([
            expect.objectContaining({ id: 101, completed: true }),
          ]),
        }),
      );
    });
  });

  it("API エラー時に onTaskUpdated が呼ばれないこと", async () => {
    vi.mocked(api.updateChecklistItem).mockRejectedValue(
      new Error("network error"),
    );
    const onTaskUpdated = vi.fn();
    render(
      <TaskCard
        {...defaultProps}
        task={taskWithChecklists}
        onTaskUpdated={onTaskUpdated}
      />,
    );
    fireEvent.click(
      screen.getByRole("button", {
        name: "チェックリスト「チェック項目A」を完了にする",
      }),
    );

    await waitFor(() => {
      expect(onTaskUpdated).not.toHaveBeenCalled();
    });
  });

  it("削除ボタンをクリックすると確認ダイアログが表示されること", () => {
    render(<TaskCard {...defaultProps} />);
    const deleteBtn = screen.getByRole("button", {
      name: "タスク「テストタスク」を削除",
    });
    fireEvent.click(deleteBtn);
    expect(
      screen.getByText("「テストタスク」を削除しますか？"),
    ).toBeInTheDocument();
    expect(screen.getByText("削除する")).toBeInTheDocument();
  });

  it("確認ダイアログで削除を確定すると onDeleteTask が呼ばれること", () => {
    render(<TaskCard {...defaultProps} />);
    fireEvent.click(
      screen.getByRole("button", { name: "タスク「テストタスク」を削除" }),
    );
    fireEvent.click(screen.getByText("削除する"));
    expect(defaultProps.onDeleteTask).toHaveBeenCalledWith(10, 1);
  });

  it("確認ダイアログでキャンセルすると onDeleteTask が呼ばれないこと", () => {
    render(<TaskCard {...defaultProps} />);
    fireEvent.click(
      screen.getByRole("button", { name: "タスク「テストタスク」を削除" }),
    );
    fireEvent.click(screen.getByText("キャンセル"));
    expect(defaultProps.onDeleteTask).not.toHaveBeenCalled();
  });

  it("サブタスクが表示されること", () => {
    render(<TaskCard {...defaultProps} task={taskWithSubtasks} />);
    expect(screen.getByText("サブタスク1")).toBeInTheDocument();
    expect(screen.getByText("サブチェック")).toBeInTheDocument();
  });

  it("サブタスク配下のチェックリストをトグルできること", async () => {
    const updatedItem = {
      id: 301,
      task_id: null,
      subtask_id: 201,
      content: "サブチェック",
      completed: true,
      position: 1000,
    };
    vi.mocked(api.updateChecklistItem).mockResolvedValue(updatedItem);
    const onTaskUpdated = vi.fn();

    render(
      <TaskCard
        {...defaultProps}
        task={taskWithSubtasks}
        onTaskUpdated={onTaskUpdated}
      />,
    );

    fireEvent.click(
      screen.getByRole("button", {
        name: "サブタスク「サブタスク1」のチェックリスト「サブチェック」を完了にする",
      }),
    );

    await waitFor(() => {
      expect(api.updateChecklistItem).toHaveBeenCalledWith(301, {
        completed: true,
      });
      expect(onTaskUpdated).toHaveBeenCalledWith(
        expect.objectContaining({
          subtasks: expect.arrayContaining([
            expect.objectContaining({
              checklists: expect.arrayContaining([
                expect.objectContaining({ id: 301, completed: true }),
              ]),
            }),
          ]),
        }),
      );
    });
  });
});
