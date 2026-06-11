// TaskEditModal コンポーネントのユニットテスト
import {
  describe,
  it,
  expect,
  vi,
  beforeEach,
  afterEach,
} from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TaskEditModal } from "../components/TaskEditModal";
import * as api from "../api/boardApi";
import { baseTask, taskWithChecklists } from "./testUtils";

vi.mock("../api/boardApi");

describe("TaskEditModal", () => {
  const onClose = vi.fn();
  const onTaskUpdated = vi.fn();

  const renderModal = (task = baseTask) => {
    render(
      <TaskEditModal
        task={task}
        onClose={onClose}
        onTaskUpdated={onTaskUpdated}
      />,
    );
  };

  beforeEach(() => {
    vi.clearAllMocks();
    onClose.mockReset();
    onTaskUpdated.mockReset();
    vi.mocked(api.fetchMemos).mockResolvedValue([]);
    // モジュール内メモキャッシュを無効化するため TTL 切れ後の時刻を返す
    vi.spyOn(Date, "now").mockReturnValue(Number.MAX_SAFE_INTEGER + 100_000);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("タスク内容とモーダルタイトルが表示されること", () => {
    renderModal();
    expect(
      screen.getByRole("dialog", { name: "タスクを編集" }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("タスク内容")).toHaveValue("テストタスク");
  });

  it("閉じるボタンで onClose('dismiss') が呼ばれること", () => {
    renderModal();
    fireEvent.click(screen.getByLabelText("編集モーダルを閉じる"));
    expect(onClose).toHaveBeenCalledWith("dismiss");
  });

  it("保存成功時に saveTaskSnapshot・onTaskUpdated・onClose が呼ばれること", async () => {
    const user = userEvent.setup();
    const savedTask = { ...baseTask, content: "更新後のタスク" };
    vi.mocked(api.saveTaskSnapshot).mockResolvedValue(savedTask);

    renderModal();
    const textarea = screen.getByLabelText("タスク内容");
    await user.clear(textarea);
    await user.type(textarea, "更新後のタスク");
    fireEvent.click(screen.getByRole("button", { name: "保存して閉じる" }));

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
    vi.mocked(api.saveTaskSnapshot).mockRejectedValue(new Error("network"));

    renderModal();
    fireEvent.click(screen.getByRole("button", { name: "保存して閉じる" }));

    await waitFor(() => {
      expect(
        screen.getByText("保存中にエラーが発生しました。再試行してください。"),
      ).toBeInTheDocument();
    });
    expect(onClose).not.toHaveBeenCalled();
  });

  it("チェックリスト項目をトグルして保存できること", async () => {
    const savedTask = {
      ...taskWithChecklists,
      checklists: taskWithChecklists.checklists.map((item) =>
        item.id === 101 ? { ...item, completed: true } : item,
      ),
    };
    vi.mocked(api.saveTaskSnapshot).mockResolvedValue(savedTask);

    renderModal(taskWithChecklists);
    fireEvent.click(
      screen.getByRole("button", {
        name: "チェックリスト「チェック項目A」を完了にする",
      }),
    );
    fireEvent.click(screen.getByRole("button", { name: "保存して閉じる" }));

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
    renderModal();

    fireEvent.click(screen.getByText("チェック項目を追加"));
    await user.type(
      screen.getByPlaceholderText("チェック項目..."),
      "新しいチェック項目",
    );
    fireEvent.click(screen.getByRole("button", { name: "追加" }));

    expect(screen.getByText("新しいチェック項目")).toBeInTheDocument();
  });

  it("サブタスクを追加できること", async () => {
    const user = userEvent.setup();
    renderModal();

    fireEvent.click(screen.getByText("サブタスクを追加"));
    await user.type(
      screen.getByPlaceholderText("サブタスク名..."),
      "新しいサブタスク",
    );
    fireEvent.click(screen.getByRole("button", { name: "追加" }));

    expect(screen.getByText("新しいサブタスク")).toBeInTheDocument();
  });

  it("完了状態をトグルできること", () => {
    renderModal();
    fireEvent.click(
      screen.getByRole("button", { name: "未完了（クリックで完了にする）" }),
    );
    expect(
      screen.getByRole("button", { name: "完了済み（クリックで戻す）" }),
    ).toBeInTheDocument();
  });

  it("メモ一覧取得後に空メッセージが表示されること", async () => {
    vi.spyOn(Date, "now").mockReturnValue(Number.MAX_SAFE_INTEGER + 200_000);
    vi.mocked(api.fetchMemos).mockResolvedValue([]);

    renderModal();

    await waitFor(() => {
      expect(api.fetchMemos).toHaveBeenCalledTimes(1);
      expect(
        screen.getByText("メモがありません。メモ帳からメモを作成してください。"),
      ).toBeInTheDocument();
    });
  });
});
