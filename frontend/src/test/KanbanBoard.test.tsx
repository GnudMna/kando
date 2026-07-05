// KanbanBoard コンポーネントのユニットテスト
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { KanbanBoard } from "../components/KanbanBoard";
import { useBoard } from "../hooks/useBoard";
import { fetchBoard } from "../api/board";
import {
  createMockUseBoardReturn,
  createQueryWrapper,
  sampleBoardRows,
} from "./testUtils";
import type { Task } from "../types";

vi.mock("../hooks/useBoard");
vi.mock("../api/board");

vi.mock("../components/TaskEditModal", () => ({
  TaskEditModal: ({
    task,
    onClose,
  }: {
    task: Task;
    onClose: (reason: "saved" | "dismiss") => void;
  }) => (
    <div role="dialog" aria-label="タスク編集モーダル">
      <span>{task.content}</span>
      <button type="button" onClick={() => onClose("dismiss")}>
        モーダルを閉じる
      </button>
    </div>
  ),
}));

vi.mock("../components/ListView", () => ({
  ListView: ({ rows }: { rows: unknown[] }) => (
    <div data-testid="list-view">{rows.length} rows in list</div>
  ),
}));

describe("KanbanBoard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(fetchBoard).mockResolvedValue(structuredClone(sampleBoardRows));
    vi.mocked(useBoard).mockReturnValue(
      createMockUseBoardReturn() as ReturnType<typeof useBoard>,
    );
  });

  it("読み込み中はローディング表示になること", () => {
    vi.mocked(useBoard).mockReturnValue(
      createMockUseBoardReturn({
        isLoading: true,
        rows: [],
      }) as ReturnType<typeof useBoard>,
    );

    render(<KanbanBoard />, { wrapper: createQueryWrapper() });
    expect(screen.getByText("読み込み中…")).toBeInTheDocument();
  });

  it("行・カラム・タスクが表示されること", () => {
    render(<KanbanBoard />, { wrapper: createQueryWrapper() });
    expect(screen.getByText("行1")).toBeInTheDocument();
    expect(screen.getByText("行2")).toBeInTheDocument();
    expect(screen.getByText("カラム1")).toBeInTheDocument();
    expect(screen.getByText("テストタスク")).toBeInTheDocument();
  });

  it("ボード統計が表示されること", () => {
    render(<KanbanBoard />, { wrapper: createQueryWrapper() });
    const stats = screen.getByLabelText("ボード統計");
    expect(stats).toHaveTextContent("2");
    expect(stats).toHaveTextContent("3");
    expect(stats).toHaveTextContent("1");
  });

  it("行がない場合は空状態を表示すること", () => {
    vi.mocked(useBoard).mockReturnValue(
      createMockUseBoardReturn({ rows: [] }) as ReturnType<typeof useBoard>,
    );

    render(<KanbanBoard />, { wrapper: createQueryWrapper() });
    expect(screen.getByText("まだ行がありません")).toBeInTheDocument();
  });

  it("operationError がある場合はエラーバナーを表示し閉じられること", () => {
    const clearError = vi.fn();
    vi.mocked(useBoard).mockReturnValue(
      createMockUseBoardReturn({
        operationError: "ボードの読み込みに失敗しました",
        clearError,
      }) as ReturnType<typeof useBoard>,
    );

    render(<KanbanBoard />, { wrapper: createQueryWrapper() });
    expect(screen.getByRole("alert")).toHaveTextContent(
      "ボードの読み込みに失敗しました",
    );
    fireEvent.click(screen.getByLabelText("エラーを閉じる"));
    expect(clearError).toHaveBeenCalledTimes(1);
  });

  it("検索入力でリストビューに切り替わること", async () => {
    const user = userEvent.setup();
    render(<KanbanBoard />, { wrapper: createQueryWrapper() });

    await user.type(
      screen.getByPlaceholderText("タスク名・サブタスク・コメントで検索"),
      "テスト",
    );

    await waitFor(() => {
      expect(screen.getByTestId("list-view")).toBeInTheDocument();
    });
    expect(screen.getByLabelText("ボード統計")).toHaveTextContent("件ヒット");
  });

  it("hasMore が true のとき「さらに読み込む」ボタンが表示されること", () => {
    vi.mocked(useBoard).mockReturnValue(
      createMockUseBoardReturn({ hasMore: true }) as ReturnType<
        typeof useBoard
      >,
    );

    render(<KanbanBoard />, { wrapper: createQueryWrapper() });
    expect(
      screen.getByRole("button", { name: /さらに読み込む/ }),
    ).toBeInTheDocument();
  });

  it("「さらに読み込む」クリックで loadMoreRows が呼ばれること", async () => {
    const loadMoreRows = vi.fn().mockResolvedValue(undefined);
    vi.mocked(useBoard).mockReturnValue(
      createMockUseBoardReturn({
        hasMore: true,
        loadMoreRows,
      }) as ReturnType<typeof useBoard>,
    );

    render(<KanbanBoard />, { wrapper: createQueryWrapper() });
    fireEvent.click(screen.getByRole("button", { name: /さらに読み込む/ }));

    await waitFor(() => {
      expect(loadMoreRows).toHaveBeenCalledTimes(1);
    });
  });

  it("タスククリックで編集モーダルが開くこと", async () => {
    render(<KanbanBoard />, { wrapper: createQueryWrapper() });
    fireEvent.click(screen.getByText("テストタスク"));

    await waitFor(() => {
      expect(
        screen.getByRole("dialog", { name: "タスク編集モーダル" }),
      ).toBeInTheDocument();
    });
  });

  it("kando:open-task イベントで編集モーダルが開くこと", async () => {
    render(<KanbanBoard />, { wrapper: createQueryWrapper() });
    window.dispatchEvent(
      new CustomEvent("kando:open-task", { detail: { taskId: 1 } }),
    );

    await waitFor(() => {
      expect(
        screen.getByRole("dialog", { name: "タスク編集モーダル" }),
      ).toBeInTheDocument();
    });
  });

  it("行追加フォームで入力したタイトルが addRow に渡されること", async () => {
    const addRow = vi.fn().mockResolvedValue(undefined);
    vi.mocked(useBoard).mockReturnValue(
      createMockUseBoardReturn({ addRow }) as ReturnType<typeof useBoard>,
    );

    render(<KanbanBoard />, { wrapper: createQueryWrapper() });
    fireEvent.click(screen.getByRole("button", { name: /行を追加/ }));
    fireEvent.change(screen.getByLabelText("行のタイトル"), {
      target: { value: "新しい行" },
    });
    fireEvent.click(screen.getByRole("button", { name: "追加" }));

    await waitFor(() => {
      expect(addRow).toHaveBeenCalledWith("新しい行");
    });
  });

  it("ステータス追加フォームで入力した名前が addColumn に渡されること", async () => {
    const addColumn = vi.fn().mockResolvedValue(undefined);
    vi.mocked(useBoard).mockReturnValue(
      createMockUseBoardReturn({ addColumn }) as ReturnType<typeof useBoard>,
    );

    render(<KanbanBoard />, { wrapper: createQueryWrapper() });
    fireEvent.click(
      screen.getAllByRole("button", { name: /ステータスを追加/ })[0],
    );
    fireEvent.change(screen.getByLabelText("ステータス名"), {
      target: { value: "新ステータス" },
    });
    fireEvent.click(screen.getByRole("button", { name: "追加" }));

    await waitFor(() => {
      expect(addColumn).toHaveBeenCalledWith(1, "新ステータス");
    });
  });

  it("行削除の確認ダイアログで removeRow が呼ばれること", () => {
    const removeRow = vi.fn().mockResolvedValue(undefined);
    vi.mocked(useBoard).mockReturnValue(
      createMockUseBoardReturn({ removeRow }) as ReturnType<typeof useBoard>,
    );

    render(<KanbanBoard />, { wrapper: createQueryWrapper() });
    fireEvent.click(screen.getByLabelText("行「行1」を削除"));
    fireEvent.click(screen.getByText("削除する"));

    expect(removeRow).toHaveBeenCalledWith(1);
  });

  it("リストビューに切り替えできること", () => {
    render(<KanbanBoard />, { wrapper: createQueryWrapper() });
    fireEvent.click(screen.getByRole("button", { name: /リスト/ }));

    expect(screen.getByTestId("list-view")).toBeInTheDocument();
    expect(screen.getByText("2 rows in list")).toBeInTheDocument();
  });
});
