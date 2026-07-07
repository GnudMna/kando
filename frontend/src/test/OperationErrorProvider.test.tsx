import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ErrorBanner } from "../components/ErrorBanner";
import { OperationErrorProvider } from "../providers/OperationErrorProvider";
import { useOperationError } from "../providers/useOperationError";

function ErrorReporter() {
  const { error, reportError, clearError } = useOperationError();

  return (
    <div>
      <button type="button" onClick={() => reportError("操作に失敗しました")}>
        エラーを報告
      </button>
      {error && <ErrorBanner message={error} onDismiss={clearError} />}
    </div>
  );
}

describe("OperationErrorProvider", () => {
  it("reportError でエラーバナーを表示し clearError で閉じられること", () => {
    render(
      <OperationErrorProvider>
        <ErrorReporter />
      </OperationErrorProvider>,
    );

    fireEvent.click(screen.getByRole("button", { name: "エラーを報告" }));
    expect(screen.getByRole("alert")).toHaveTextContent("操作に失敗しました");

    fireEvent.click(screen.getByLabelText("エラーを閉じる"));
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});
