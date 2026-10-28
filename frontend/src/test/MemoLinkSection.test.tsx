import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MemoLinkSection } from "../components/taskEdit/MemoLinkSection";
import type { Memo } from "../api/boardApi";
import { createQueryWrapper } from "./testUtils";

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
  const onShowMemoPickerChange = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  const renderSection = (overrides?: {
    linkedMemoIds?: Set<number>;
    showMemoPicker?: boolean;
    allMemos?: Memo[] | null;
    memoLinkError?: string | null;
  }) =>
    render(
      <MemoLinkSection
        allMemos={
          overrides !== undefined && "allMemos" in overrides
            ? overrides.allMemos!
            : sampleMemos
        }
        linkedMemoIds={overrides?.linkedMemoIds ?? new Set()}
        onLinkedMemoIdsChange={onLinkedMemoIdsChange}
        memoLinkError={overrides?.memoLinkError ?? null}
        showMemoPicker={overrides?.showMemoPicker ?? false}
        onShowMemoPickerChange={onShowMemoPickerChange}
      />,
      { wrapper: createQueryWrapper() },
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

  it("ピッカーからメモを選ぶと選択状態のみ更新する", () => {
    renderSection({ showMemoPicker: true });

    fireEvent.click(screen.getByRole("option", { name: /メモA/ }));

    expect(onLinkedMemoIdsChange).toHaveBeenCalledTimes(1);
    const updater = onLinkedMemoIdsChange.mock.calls[0][0];
    expect([...updater(new Set([2]))]).toEqual([2, 1]);
    expect(onShowMemoPickerChange).toHaveBeenCalledWith(false);
  });

  it("関連付け済みメモの解除は選択状態のみ更新する", () => {
    renderSection({ linkedMemoIds: new Set([1]) });

    fireEvent.click(
      screen.getByRole("button", { name: "「メモA」の関連付けを解除" }),
    );

    expect(onLinkedMemoIdsChange).toHaveBeenCalledTimes(1);
    const updater = onLinkedMemoIdsChange.mock.calls[0][0];
    expect([...updater(new Set([1, 2]))]).toEqual([2]);
  });

  it("エラー文言を表示する", () => {
    renderSection({ memoLinkError: "メモ一覧の読み込みに失敗しました" });

    expect(
      screen.getByText("メモ一覧の読み込みに失敗しました"),
    ).toBeInTheDocument();
  });
});
