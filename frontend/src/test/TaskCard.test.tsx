// TaskCard コンポーネントのユニットテスト
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { TaskCard } from "../components/TaskCard";
import * as api from "../api/boardApi";
import type { Task } from "../types";
import {
  baseTask,
  createQueryWrapper,
  createTaskCardProps,
  taskWithChecklists,
  taskWithSubtasks,
} from "./testUtils";

vi.mock("../api/boardApi");

describe("TaskCard", () => {
  const renderTaskCard = (
    overrides?: Partial<ReturnType<typeof createTaskCardProps>>,
  ) => {
    const props = createTaskCardProps(overrides);
    render(<TaskCard {...props} />, { wrapper: createQueryWrapper() });
    return props;
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("タスク内容が表示されること", () => {
    renderTaskCard();
    expect(screen.getByText("テストタスク")).toBeInTheDocument();
  });

  it("タスクをクリックすると onEditTask が呼ばれること", () => {
    const props = renderTaskCard();
    fireEvent.click(screen.getByText("テストタスク"));
    expect(props.onEditTask).toHaveBeenCalledWith(baseTask, 10);
  });

  it("チェックリスト項目が表示されること", () => {
    renderTaskCard({ task: taskWithChecklists });
    expect(screen.getByText("チェック項目A")).toBeInTheDocument();
    expect(screen.getByText("チェック項目B")).toBeInTheDocument();
  });

  it("期限がある場合に期限が表示されること", () => {
    renderTaskCard({ task: { ...baseTask, due_date: "2026-05-21" } });
    expect(screen.getByText(/2026\/05\/21/)).toBeInTheDocument();
  });

  it("期限切れ状態のラベルが表示されること", () => {
    renderTaskCard({
      task: { ...baseTask, due_date: "2026-05-21" },
      dueHighlight: { status: "overdue", daysUntilDue: -2 },
    });
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
    renderTaskCard({ task: taskWithChecklists, onTaskUpdated });

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

  it("完了トグル後にサーバーの revision を反映し子要素を保持すること", async () => {
    // PUT /tasks/:id のレスポンスは子要素を含まないタスク行のみ
    vi.mocked(api.updateTask).mockResolvedValue({
      id: 1,
      column_id: 10,
      content: "テストタスク",
      due_date: null,
      position: 1000,
      completed: true,
      revision: 2,
    } as Task);

    const onTaskUpdated = vi.fn();
    renderTaskCard({ task: taskWithChecklists, onTaskUpdated });
    fireEvent.click(
      screen.getByRole("button", { name: "タスク「テストタスク」を完了にする" }),
    );

    await waitFor(() => {
      expect(api.updateTask).toHaveBeenCalledWith(1, { completed: true });
      expect(onTaskUpdated).toHaveBeenCalledWith({
        ...taskWithChecklists,
        completed: true,
        revision: 2,
      });
    });
  });

  it("API エラー時に onTaskUpdated が呼ばれないこと", async () => {
    vi.mocked(api.updateChecklistItem).mockRejectedValue(
      new Error("network error"),
    );
    const onTaskUpdated = vi.fn();
    renderTaskCard({ task: taskWithChecklists, onTaskUpdated });
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
    renderTaskCard();
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
    const props = renderTaskCard();
    fireEvent.click(
      screen.getByRole("button", { name: "タスク「テストタスク」を削除" }),
    );
    fireEvent.click(screen.getByText("削除する"));
    expect(props.onDeleteTask).toHaveBeenCalledWith(10, 1);
  });

  it("確認ダイアログでキャンセルすると onDeleteTask が呼ばれないこと", () => {
    const props = renderTaskCard();
    fireEvent.click(
      screen.getByRole("button", { name: "タスク「テストタスク」を削除" }),
    );
    fireEvent.click(screen.getByText("キャンセル"));
    expect(props.onDeleteTask).not.toHaveBeenCalled();
  });

  it("サブタスクが表示されること", () => {
    renderTaskCard({ task: taskWithSubtasks });
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

    renderTaskCard({ task: taskWithSubtasks, onTaskUpdated });

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
