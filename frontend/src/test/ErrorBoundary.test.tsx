import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ErrorBoundary } from "../components/ErrorBoundary";

function ThrowError({ shouldThrow }: { shouldThrow: boolean }) {
  if (shouldThrow) {
    throw new Error("テスト用エラー");
  }
  return <p>正常表示</p>;
}

describe("ErrorBoundary", () => {
  const consoleError = vi
    .spyOn(console, "error")
    .mockImplementation(() => undefined);

  beforeEach(() => {
    consoleError.mockClear();
  });

  it("子要素をそのまま描画する", () => {
    render(
      <ErrorBoundary>
        <ThrowError shouldThrow={false} />
      </ErrorBoundary>,
    );

    expect(screen.getByText("正常表示")).toBeInTheDocument();
  });

  it("子要素のエラー時にフォールバック UI を表示する", () => {
    render(
      <ErrorBoundary>
        <ThrowError shouldThrow />
      </ErrorBoundary>,
    );

    expect(screen.getByRole("alert", { name: undefined })).toHaveTextContent(
      "予期しないエラーが発生しました",
    );
    expect(
      screen.getByRole("button", { name: "再読み込み" }),
    ).toBeInTheDocument();
  });

  it("再読み込みボタンで location.reload を呼ぶ", async () => {
    const user = userEvent.setup();
    const reload = vi.fn();
    Object.defineProperty(window, "location", {
      configurable: true,
      value: { reload },
    });

    render(
      <ErrorBoundary>
        <ThrowError shouldThrow />
      </ErrorBoundary>,
    );

    await user.click(screen.getByRole("button", { name: "再読み込み" }));
    expect(reload).toHaveBeenCalled();
  });
});
