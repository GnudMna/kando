import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoLinkSection } from "../components/taskEdit/MemoLinkSection";
import * as api from "../api/boardApi";
import type { Memo } from "../api/boardApi";

vi.mock("../api/boardApi");

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
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
    tasks: [],
  },
];

describe("MemoLinkSection", () => {
  const onLinkedMemoIdsChange = vi.fn(
    (updater: (prev: Set<number>) => Set<number>) => updater(new Set()),
  );
  const onMemoLinkErrorChange = vi.fn();
  const onShowMemoPickerChange = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  const renderSection = (overrides?: {
    linkedMemoIds?: Set<number>;
    showMemoPicker?: boolean;
    allMemos?: Memo[] | null;
  }) =>
    render(
      <MemoLinkSection
        taskId={10}
        allMemos={
          overrides !== undefined && "allMemos" in overrides
            ? overrides.allMemos!
            : sampleMemos
        }
        linkedMemoIds={overrides?.linkedMemoIds ?? new Set()}
        onLinkedMemoIdsChange={onLinkedMemoIdsChange}
        memoLinkError={null}
        onMemoLinkErrorChange={onMemoLinkErrorChange}
        showMemoPicker={overrides?.showMemoPicker ?? false}
        onShowMemoPickerChange={onShowMemoPickerChange}
      />,
    );

  it("読み込み中メッセージを表示する", () => {
    renderSection({ allMemos: null });
    expect(screen.getByText(/読み込み中/)).toBeInTheDocument();
  });

  it("関連付けなしメッセージを表示する", () => {
    renderSection();
    expect(
      screen.getByText("関連付けられたメモはありません"),
    ).toBeInTheDocument();
  });

  it("メモを追加ボタンでピッカーを開く", () => {
    renderSection();
    fireEvent.click(screen.getByRole("button", { name: "メモを追加" }));
    expect(onShowMemoPickerChange).toHaveBeenCalledWith(true);
  });

  it("ピッカーからメモを関連付けできる", async () => {
    vi.mocked(api.linkMemoTask).mockResolvedValue({
      ...sampleMemos[0],
      tasks: [{ id: 10, content: "タスク" }],
    });

    renderSection({ showMemoPicker: true });

    fireEvent.click(screen.getByRole("option", { name: /メモA/ }));

    await waitFor(() => {
      expect(api.linkMemoTask).toHaveBeenCalledWith(1, 10);
      expect(onLinkedMemoIdsChange).toHaveBeenCalled();
      expect(onShowMemoPickerChange).toHaveBeenCalledWith(false);
    });
  });

  it("関連付け済みメモを表示して解除できる", async () => {
    vi.mocked(api.unlinkMemoTask).mockResolvedValue({
      ...sampleMemos[0],
      tasks: [],
    });

    renderSection({ linkedMemoIds: new Set([1]) });

    fireEvent.click(
      screen.getByRole("button", { name: "「メモA」の関連付けを解除" }),
    );

    await waitFor(() => {
      expect(api.unlinkMemoTask).toHaveBeenCalledWith(1, 10);
      expect(onLinkedMemoIdsChange).toHaveBeenCalled();
    });
  });

  it("関連付け失敗時にエラーを表示する", async () => {
    vi.mocked(api.linkMemoTask).mockRejectedValue(new Error("リンク失敗"));

    const { rerender } = renderSection({ showMemoPicker: true });
    fireEvent.click(screen.getByRole("option", { name: /メモA/ }));

    await waitFor(() => {
      expect(onMemoLinkErrorChange).toHaveBeenCalledWith("リンク失敗");
    });

    rerender(
      <MemoLinkSection
        taskId={10}
        allMemos={sampleMemos}
        linkedMemoIds={new Set()}
        onLinkedMemoIdsChange={onLinkedMemoIdsChange}
        memoLinkError="リンク失敗"
        onMemoLinkErrorChange={onMemoLinkErrorChange}
        showMemoPicker={false}
        onShowMemoPickerChange={onShowMemoPickerChange}
      />,
    );

    expect(screen.getByText("リンク失敗")).toBeInTheDocument();
  });
});
