// TaskEditModal コンポーネントのユニットテスト
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TaskEditModal } from "../components/TaskEditModal";
import * as api from "../api/boardApi";
import { invalidateMemoCache } from "../components/taskEdit/memoCache";
import {
  baseTask,
  taskWithChecklists,
  taskWithSubtasks,
  createQueryWrapper,
} from "./testUtils";

vi.mock("../api/boardApi");

describe("TaskEditModal", () => {
  const onClose = vi.fn();
  const onTaskUpdated = vi.fn();

  /** メモキャッシュを温めてからモーダルを描画し、初期表示が安定するまで待つ。 */
  const renderModal = async (task = baseTask) => {
    render(
      <TaskEditModal
        task={task}
        onClose={onClose}
        onTaskUpdated={onTaskUpdated}
      />,
      { wrapper: createQueryWrapper() },
    );

    await waitFor(() => {
      expect(
        screen.getByRole("dialog", { name: "タスクを編集" }),
      ).toBeInTheDocument();
    });
  };

  /** 保存処理（非同期 state 更新）が完了するまで待つ。 */
  const waitForSaveToSettle = async () => {
    await waitFor(() => {
      const saveButton = screen.queryByRole("button", {
        name: "保存して閉じる",
      });
      if (saveButton) {
        expect(saveButton).not.toBeDisabled();
      }
    });
  };

  beforeEach(() => {
    vi.clearAllMocks();
    onClose.mockReset();
    onTaskUpdated.mockReset();
    vi.mocked(api.fetchMemos).mockResolvedValue([]);
  });

  it("タスク内容とモーダルタイトルが表示されること", async () => {
    await renderModal();
    expect(screen.getByLabelText("タスク内容")).toHaveValue("テストタスク");
  });

  it("閉じるボタンで onClose('dismiss') が呼ばれること", async () => {
    const user = userEvent.setup();
    await renderModal();
    await user.click(screen.getByLabelText("編集モーダルを閉じる"));
    expect(onClose).toHaveBeenCalledWith("dismiss");
  });

  it("保存成功時に saveTaskSnapshot・onTaskUpdated・onClose が呼ばれること", async () => {
    const user = userEvent.setup();
    const savedTask = { ...baseTask, content: "更新後のタスク" };
    vi.mocked(api.saveTaskSnapshot).mockResolvedValue(savedTask);

    await renderModal();
    const textarea = screen.getByLabelText("タスク内容");
    await user.clear(textarea);
    await user.type(textarea, "更新後のタスク");
    await user.click(screen.getByRole("button", { name: "保存して閉じる" }));

    await waitFor(() => {
      expect(api.saveTaskSnapshot).toHaveBeenCalledWith(
        1,
        expect.objectContaining({ content: "更新後のタスク" }),
      );
      expect(onTaskUpdated).toHaveBeenCalledWith(savedTask);
      expect(onClose).toHaveBeenCalledWith("saved");
    });
  });

  it("保存失敗時にエラーメッセージが表示されること", async () => {
    const user = userEvent.setup();
    vi.mocked(api.saveTaskSnapshot).mockRejectedValue(new Error("network"));

    await renderModal();
    await user.click(screen.getByRole("button", { name: "保存して閉じる" }));

    await waitFor(() => {
      expect(
        screen.getByText("保存中にエラーが発生しました。再試行してください。"),
      ).toBeInTheDocument();
    });
    await waitForSaveToSettle();
    expect(onClose).not.toHaveBeenCalled();
  });

  it("チェックリスト項目をトグルして保存できること", async () => {
    const user = userEvent.setup();
    const savedTask = {
      ...taskWithChecklists,
      checklists: taskWithChecklists.checklists.map((item) =>
        item.id === 101 ? { ...item, completed: true } : item,
      ),
    };
    vi.mocked(api.saveTaskSnapshot).mockResolvedValue(savedTask);

    await renderModal(taskWithChecklists);
    await user.click(
      screen.getByRole("button", {
        name: "チェックリスト「チェック項目A」を完了にする",
      }),
    );
    await user.click(screen.getByRole("button", { name: "保存して閉じる" }));

    await waitFor(() => {
      expect(api.saveTaskSnapshot).toHaveBeenCalledWith(
        1,
        expect.objectContaining({
          checklists: expect.arrayContaining([
            expect.objectContaining({
              content: "チェック項目A",
              completed: true,
            }),
          ]),
        }),
      );
    });
  });

  it("チェックリスト項目を追加できること", async () => {
    const user = userEvent.setup();
    await renderModal();

    await user.click(screen.getByText("チェック項目を追加"));
    await user.type(
      screen.getByPlaceholderText("チェック項目..."),
      "新しいチェック項目",
    );
    await user.click(screen.getByRole("button", { name: "追加" }));

    expect(screen.getByText("新しいチェック項目")).toBeInTheDocument();
  });

  it("サブタスクを追加できること", async () => {
    const user = userEvent.setup();
    await renderModal();

    await user.click(screen.getByText("サブタスクを追加"));
    await user.type(
      screen.getByPlaceholderText("サブタスク名..."),
      "新しいサブタスク",
    );
    await user.click(screen.getByRole("button", { name: "追加" }));

    expect(screen.getByText("新しいサブタスク")).toBeInTheDocument();
  });

  it("完了状態をトグルできること", async () => {
    const user = userEvent.setup();
    await renderModal();
    await user.click(
      screen.getByRole("button", { name: "未完了（クリックで完了にする）" }),
    );
    expect(
      screen.getByRole("button", { name: "完了済み（クリックで戻す）" }),
    ).toBeInTheDocument();
  });

  it("メモ一覧取得後に空メッセージが表示されること", async () => {
    invalidateMemoCache();
    vi.spyOn(Date, "now").mockReturnValue(Number.MAX_SAFE_INTEGER + 200_000);
    vi.mocked(api.fetchMemos).mockResolvedValue([]);

    render(
      <TaskEditModal
        task={baseTask}
        onClose={onClose}
        onTaskUpdated={onTaskUpdated}
      />,
      { wrapper: createQueryWrapper() },
    );

    await waitFor(() => {
      expect(api.fetchMemos).toHaveBeenCalledTimes(1);
    });
    await waitFor(() => {
      expect(
        screen.getByText(
          "メモがありません。メモ帳からメモを作成してください。",
        ),
      ).toBeInTheDocument();
    });
  });

  it("期限付きタスクを保存できること", async () => {
    const user = userEvent.setup();
    const taskWithDue = { ...baseTask, due_date: "2026-12-25" };
    vi.mocked(api.saveTaskSnapshot).mockResolvedValue(taskWithDue);

    await renderModal(taskWithDue);
    expect(screen.getByLabelText("期限")).toHaveValue("2026-12-25");
    await user.click(screen.getByRole("button", { name: "保存して閉じる" }));

    await waitFor(() => {
      expect(api.saveTaskSnapshot).toHaveBeenCalledWith(
        1,
        expect.objectContaining({ due_date: "2026-12-25" }),
      );
    });
  });

  it("チェックリスト項目を削除できること", async () => {
    const user = userEvent.setup();
    await renderModal(taskWithChecklists);
    await user.click(
      screen.getByRole("button", {
        name: "チェックリスト「チェック項目A」を削除",
      }),
    );
    expect(screen.queryByText("チェック項目A")).not.toBeInTheDocument();
  });

  it("サブタスクを削除できること", async () => {
    const user = userEvent.setup();
    await renderModal(taskWithSubtasks);
    await user.click(
      screen.getByRole("button", {
        name: "サブタスク「サブタスク1」を削除",
      }),
    );
    expect(screen.queryByText("サブタスク1")).not.toBeInTheDocument();
  });
});
