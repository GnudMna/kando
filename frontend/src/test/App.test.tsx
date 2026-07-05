import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App from "../App";
import { useAuth } from "../hooks/useAuth";
import { createQueryWrapper } from "./testUtils";

vi.mock("../hooks/useAuth");
vi.mock("../components/KanbanBoard", () => ({
  KanbanBoard: () => <div data-testid="kanban-board">KanbanBoard</div>,
}));
vi.mock("../components/MemoPanel", () => ({
  MemoPanel: ({ onClose }: { onClose: () => void }) => (
    <div data-testid="memo-panel">
      <button type="button" onClick={onClose}>
        メモを閉じる
      </button>
    </div>
  ),
}));

describe("App", () => {
  const login = vi.fn();
  const register = vi.fn();
  const logout = vi.fn();
  const clearError = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    window.localStorage.clear();
    document.documentElement.dataset.theme = "";
  });

  const renderApp = () => render(<App />, { wrapper: createQueryWrapper() });

  it("認証確認中は何も表示しない", () => {
    vi.mocked(useAuth).mockReturnValue({
      status: "checking",
      login,
      register,
      logout,
      error: null,
      clearError,
    });

    const { container } = renderApp();
    expect(container).toBeEmptyDOMElement();
  });

  it("未登録時は登録画面を表示する", () => {
    vi.mocked(useAuth).mockReturnValue({
      status: "unregistered",
      login,
      register,
      logout,
      error: null,
      clearError,
    });

    renderApp();
    expect(
      screen.getByRole("button", { name: "アカウントを作成" }),
    ).toBeInTheDocument();
  });

  it("未ログイン時はログイン画面を表示する", () => {
    vi.mocked(useAuth).mockReturnValue({
      status: "unauthenticated",
      login,
      register,
      logout,
      error: null,
      clearError,
    });

    renderApp();
    expect(
      screen.getByRole("button", { name: "ログイン" }),
    ).toBeInTheDocument();
  });

  it("認証済み時はボードとヘッダーを表示する", () => {
    vi.mocked(useAuth).mockReturnValue({
      status: "authenticated",
      login,
      register,
      logout,
      error: null,
      clearError,
    });

    renderApp();
    expect(screen.getByText("Kando")).toBeInTheDocument();
    expect(screen.getByTestId("kanban-board")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "ログアウト" }),
    ).toBeInTheDocument();
  });

  it("テーマ切替で data-theme を更新する", async () => {
    const user = userEvent.setup();
    vi.mocked(useAuth).mockReturnValue({
      status: "authenticated",
      login,
      register,
      logout,
      error: null,
      clearError,
    });

    renderApp();
    expect(document.documentElement.dataset.theme).toBe("dark");

    await user.click(
      screen.getByRole("button", { name: "ライトモードに切り替え" }),
    );
    expect(document.documentElement.dataset.theme).toBe("light");
    expect(window.localStorage.getItem("kando-theme")).toBe("light");
  });
});
