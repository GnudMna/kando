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
    // チェックリストのトグル後に revision を取り直すため、取得結果を既定で用意する
    vi.mocked(api.fetchTask).mockResolvedValue(baseTask);
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

  it("チェックリストのトグルで API が呼ばれ onTaskPatched が実行されること", async () => {
    const updatedItem = {
      id: 101,
      task_id: 1,
      subtask_id: null,
      content: "チェック項目A",
      completed: true,
      position: 1000,
    };
    vi.mocked(api.updateChecklistItem).mockResolvedValue(updatedItem);

    const onTaskPatched = vi.fn();
    renderTaskCard({ task: taskWithChecklists, onTaskPatched });

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
      expect(onTaskPatched).toHaveBeenCalledWith(1, expect.any(Function));
    });
    const updater = onTaskPatched.mock.calls[0][1] as (prev: Task) => Task;
    expect(updater(taskWithChecklists).checklists).toEqual([
      updatedItem,
      taskWithChecklists.checklists[1],
    ]);
  });

  it("連続トグルの応答が先行する更新を上書きしないこと", async () => {
    vi.mocked(api.updateChecklistItem).mockImplementation(async (id) => ({
      id,
      task_id: 1,
      subtask_id: null,
      content: id === 101 ? "チェック項目A" : "チェック項目B",
      completed: id === 101,
      position: id === 101 ? 1000 : 2000,
    }));
    const onTaskPatched = vi.fn();
    renderTaskCard({ task: taskWithChecklists, onTaskPatched });

    fireEvent.click(
      screen.getByRole("button", {
        name: "チェックリスト「チェック項目A」を完了にする",
      }),
    );
    fireEvent.click(
      screen.getByRole("button", {
        name: "チェックリスト「チェック項目B」を未完了にする",
      }),
    );

    // 各トグルの反映と、そのあとの revision 取り直しで合計 4 回
    await waitFor(() => expect(onTaskPatched).toHaveBeenCalledTimes(4));
    // クリック時点の task ではなく、直前の更新結果に対して順に適用する
    const result = onTaskPatched.mock.calls.reduce(
      (acc: Task, [, updater]) => (updater as (prev: Task) => Task)(acc),
      taskWithChecklists,
    );
    expect(result.checklists.map((c) => c.completed)).toEqual([true, false]);
  });

  it("チェックリストのトグル後にタスクを取り直して最新の revision を反映すること", async () => {
    vi.mocked(api.updateChecklistItem).mockResolvedValue({
      id: 101,
      task_id: 1,
      subtask_id: null,
      content: "チェック項目A",
      completed: true,
      position: 1000,
    });
    // 個別 API がサーバー側で revision を進めた後の最新タスク
    vi.mocked(api.fetchTask).mockResolvedValue({
      ...taskWithChecklists,
      revision: 5,
    });

    const onTaskPatched = vi.fn();
    renderTaskCard({ task: taskWithChecklists, onTaskPatched });
    fireEvent.click(
      screen.getByRole("button", {
        name: "チェックリスト「チェック項目A」を完了にする",
      }),
    );

    await waitFor(() => expect(onTaskPatched).toHaveBeenCalledTimes(2));
    expect(api.fetchTask).toHaveBeenCalledWith(taskWithChecklists.id);
    const refresh = onTaskPatched.mock.calls[1][1] as (prev: Task) => Task;
    // revision だけを進め、直前までの子要素の更新は保持する
    const current = { ...taskWithChecklists, revision: 3 };
    expect(refresh(current)).toEqual({ ...current, revision: 5 });
    // 応答が前後しても revision は古い値へ戻らない
    expect(refresh({ ...current, revision: 7 }).revision).toBe(7);
  });

  it("revision の取り直しに失敗してもトグル結果は残りエラーを出さないこと", async () => {
    vi.mocked(api.updateChecklistItem).mockResolvedValue({
      id: 101,
      task_id: 1,
      subtask_id: null,
      content: "チェック項目A",
      completed: true,
      position: 1000,
    });
    vi.mocked(api.fetchTask).mockRejectedValue(new Error("network error"));

    const onTaskPatched = vi.fn();
    renderTaskCard({ task: taskWithChecklists, onTaskPatched });
    fireEvent.click(
      screen.getByRole("button", {
        name: "チェックリスト「チェック項目A」を完了にする",
      }),
    );

    await waitFor(() => {
      expect(api.fetchTask).toHaveBeenCalled();
    });
    // トグル結果の反映のみで、取り直し失敗による追加の反映はない
    expect(onTaskPatched).toHaveBeenCalledTimes(1);
    const updater = onTaskPatched.mock.calls[0][1] as (prev: Task) => Task;
    expect(updater(taskWithChecklists).checklists[0]).toMatchObject({
      id: 101,
      completed: true,
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

    const onTaskPatched = vi.fn();
    renderTaskCard({ task: taskWithChecklists, onTaskPatched });
    fireEvent.click(
      screen.getByRole("button", {
        name: "タスク「テストタスク」を完了にする",
      }),
    );

    await waitFor(() => {
      expect(api.updateTask).toHaveBeenCalledWith(1, { completed: true });
      expect(onTaskPatched).toHaveBeenCalledWith(1, expect.any(Function));
    });
    const updater = onTaskPatched.mock.calls[0][1] as (prev: Task) => Task;
    expect(updater(taskWithChecklists)).toEqual({
      ...taskWithChecklists,
      completed: true,
      revision: 2,
    });
  });

  it("API エラー時に onTaskPatched が呼ばれないこと", async () => {
    vi.mocked(api.updateChecklistItem).mockRejectedValue(
      new Error("network error"),
    );
    const onTaskPatched = vi.fn();
    renderTaskCard({ task: taskWithChecklists, onTaskPatched });
    fireEvent.click(
      screen.getByRole("button", {
        name: "チェックリスト「チェック項目A」を完了にする",
      }),
    );

    await waitFor(() => {
      expect(onTaskPatched).not.toHaveBeenCalled();
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
    const onTaskPatched = vi.fn();

    renderTaskCard({ task: taskWithSubtasks, onTaskPatched });

    fireEvent.click(
      screen.getByRole("button", {
        name: "サブタスク「サブタスク1」のチェックリスト「サブチェック」を完了にする",
      }),
    );

    await waitFor(() => {
      expect(api.updateChecklistItem).toHaveBeenCalledWith(301, {
        completed: true,
      });
      expect(onTaskPatched).toHaveBeenCalledWith(1, expect.any(Function));
    });
    const updater = onTaskPatched.mock.calls[0][1] as (prev: Task) => Task;
    expect(updater(taskWithSubtasks).subtasks[0].checklists).toEqual([
      updatedItem,
    ]);
  });
});
