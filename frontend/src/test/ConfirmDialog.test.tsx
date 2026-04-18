// ConfirmDialog コンポーネントのユニットテスト
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ConfirmDialog } from "../components/ConfirmDialog";

describe("ConfirmDialog", () => {
  it("メッセージが表示されること", () => {
    render(
      <ConfirmDialog
        message="本当に削除しますか？"
        onConfirm={() => {}}
        onCancel={() => {}}
      />,
    );
    expect(
      screen.getByRole("dialog", { name: "削除の確認" }),
    ).toBeInTheDocument();
    expect(screen.getByText("本当に削除しますか？")).toBeInTheDocument();
  });

  it("削除ボタン押下で onConfirm が呼ばれること", () => {
    const onConfirm = vi.fn();
    render(
      <ConfirmDialog
        message="削除しますか？"
        onConfirm={onConfirm}
        onCancel={() => {}}
      />,
    );
    fireEvent.click(screen.getByText("削除する"));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it("キャンセルボタン押下で onCancel が呼ばれること", () => {
    const onCancel = vi.fn();
    render(
      <ConfirmDialog
        message="削除しますか？"
        onConfirm={() => {}}
        onCancel={onCancel}
      />,
    );
    fireEvent.click(screen.getByText("キャンセル"));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it("オーバーレイクリックで onCancel が呼ばれること", () => {
    const onCancel = vi.fn();
    render(
      <ConfirmDialog
        message="削除しますか？"
        onConfirm={() => {}}
        onCancel={onCancel}
      />,
    );
    fireEvent.click(screen.getByTestId("confirm-dialog-overlay"));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });
});
