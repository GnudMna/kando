import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoPanel } from "../components/MemoPanel";
import * as api from "../api/boardApi";
import type { Memo } from "../api/boardApi";

vi.mock("../api/boardApi");
vi.mock("../hooks/useDraggable", () => ({
  useDraggable: () => ({
    containerRef: { current: null },
    onHandleMouseDown: vi.fn(),
    posStyle: {},
    isDragging: false,
  }),
}));

const sampleMemos: Memo[] = [
  {
    id: 1,
    user_id: 1,
    title: "メモA",
    content: "内容A",
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
    tasks: [],
  },
  {
    id: 2,
    user_id: 1,
    title: "メモB",
    content: "内容B",
    created_at: "2026-01-02T00:00:00.000Z",
    updated_at: "2026-01-02T00:00:00.000Z",
    tasks: [{ id: 10, content: "関連タスク" }],
  },
];

describe("MemoPanel", () => {
  const onClose = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(api.fetchMemos).mockResolvedValue(structuredClone(sampleMemos));
  });

  it("読み込み後にメモ一覧を表示する", async () => {
    render(<MemoPanel onClose={onClose} />);

    expect(screen.getByText("読み込み中…")).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByText("メモA")).toBeInTheDocument();
      expect(screen.getByText("メモB")).toBeInTheDocument();
    });
    expect(api.fetchMemos).toHaveBeenCalledTimes(1);
  });

  it("initialMemoId で指定メモを選択する", async () => {
    render(<MemoPanel onClose={onClose} initialMemoId={2} />);

    await waitFor(() => {
      expect(screen.getByDisplayValue("メモB")).toBeInTheDocument();
      expect(screen.getByDisplayValue("内容B")).toBeInTheDocument();
    });
  });

  it("取得失敗時にエラーを表示する", async () => {
    vi.mocked(api.fetchMemos).mockRejectedValue(new Error("取得エラー"));

    render(<MemoPanel onClose={onClose} />);

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent("取得エラー");
    });
  });

  it("新しいメモを作成できる", async () => {
    const created: Memo = {
      id: 3,
      user_id: 1,
      title: "新しいメモ",
      content: "",
      created_at: "2026-01-03T00:00:00.000Z",
      updated_at: "2026-01-03T00:00:00.000Z",
      tasks: [],
    };
    vi.mocked(api.createMemo).mockResolvedValue(created);

    render(<MemoPanel onClose={onClose} />);
    await waitFor(() => screen.getByText("メモA"));

    fireEvent.click(screen.getByRole("button", { name: "新しいメモを作成" }));

    await waitFor(() => {
      expect(api.createMemo).toHaveBeenCalledWith("新しいメモ", "");
      expect(screen.getByDisplayValue("新しいメモ")).toBeInTheDocument();
    });
  });

  it("メモを削除できる", async () => {
    vi.mocked(api.deleteMemo).mockResolvedValue(undefined);

    render(<MemoPanel onClose={onClose} />);
    await waitFor(() => screen.getByText("メモA"));

    fireEvent.click(screen.getByRole("button", { name: "「メモA」を削除" }));

    await waitFor(() => {
      expect(api.deleteMemo).toHaveBeenCalledWith(1);
      expect(screen.queryByText("メモA")).not.toBeInTheDocument();
    });
  });

  it("メモ帳を閉じる", async () => {
    render(<MemoPanel onClose={onClose} />);
    await waitFor(() => screen.getByText("メモA"));

    fireEvent.click(screen.getByRole("button", { name: "メモ帳を閉じる" }));
    expect(onClose).toHaveBeenCalled();
  });

  it("関連タスクを表示する", async () => {
    render(<MemoPanel onClose={onClose} initialMemoId={2} />);

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: "「関連タスク」を開く" }),
      ).toBeInTheDocument();
      expect(screen.getByText("1件のタスク")).toBeInTheDocument();
    });
  });

  it("メモ内容を編集できる", async () => {
    const user = userEvent.setup();
    vi.mocked(api.updateMemo).mockResolvedValue({
      ...sampleMemos[0],
      title: "編集後",
      content: "編集本文",
    });

    render(<MemoPanel onClose={onClose} />);
    await waitFor(() => screen.getByDisplayValue("メモA"));

    const titleInput = screen.getByLabelText("メモタイトル");
    await user.clear(titleInput);
    await user.type(titleInput, "編集後");

    expect(titleInput).toHaveValue("編集後");
  });
});
