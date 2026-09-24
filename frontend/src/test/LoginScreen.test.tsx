import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { LoginScreen } from "../components/LoginScreen";

describe("LoginScreen", () => {
  const onLogin = vi.fn().mockResolvedValue(undefined);
  const onRegister = vi.fn().mockResolvedValue(undefined);
  const onClearError = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  const renderScreen = (
    overrides?: Partial<React.ComponentProps<typeof LoginScreen>>,
  ) =>
    render(
      <LoginScreen
        onLogin={onLogin}
        onRegister={onRegister}
        error={null}
        onClearError={onClearError}
        {...overrides}
      />,
    );

  it("ログインフォームを表示する", () => {
    renderScreen();
    expect(
      screen.getByRole("button", { name: "ログイン" }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("ユーザー名")).toBeInTheDocument();
    expect(screen.getByLabelText("パスワード")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "新規登録" }),
    ).not.toBeInTheDocument();
  });

  it("initialMode=register で登録フォームを表示する", () => {
    renderScreen({ initialMode: "register" });
    expect(
      screen.getByRole("button", { name: "アカウントを作成" }),
    ).toBeInTheDocument();
    expect(screen.getByText("（12文字以上）")).toBeInTheDocument();
  });

  it("モード切替で登録フォームに遷移する", async () => {
    const user = userEvent.setup();
    renderScreen({ allowRegister: true });

    await user.click(screen.getByRole("button", { name: "新規登録" }));

    expect(
      screen.getByRole("button", { name: "アカウントを作成" }),
    ).toBeInTheDocument();
    expect(onClearError).toHaveBeenCalled();
  });

  it("ログイン送信で onLogin を呼ぶ", async () => {
    const user = userEvent.setup();
    renderScreen();

    await user.type(screen.getByLabelText("ユーザー名"), "alice");
    await user.type(screen.getByLabelText("パスワード"), "validpassword12");
    await user.click(screen.getByRole("button", { name: "ログイン" }));

    await waitFor(() => {
      expect(onLogin).toHaveBeenCalledWith("alice", "validpassword12");
    });
  });

  it("登録送信で onRegister を呼ぶ", async () => {
    const user = userEvent.setup();
    renderScreen({ initialMode: "register" });

    await user.type(screen.getByLabelText("ユーザー名"), "newuser");
    await user.type(screen.getByLabelText(/パスワード/), "validpassword12");
    await user.click(screen.getByRole("button", { name: "アカウントを作成" }));

    await waitFor(() => {
      expect(onRegister).toHaveBeenCalledWith("newuser", "validpassword12");
    });
  });

  it("登録時に短いパスワードは送信せずエラーを表示する", async () => {
    const user = userEvent.setup();
    renderScreen({ initialMode: "register" });

    await user.type(screen.getByLabelText("ユーザー名"), "newuser");
    await user.type(screen.getByLabelText(/パスワード/), "short");
    await user.click(screen.getByRole("button", { name: "アカウントを作成" }));

    expect(onRegister).not.toHaveBeenCalled();
    expect(screen.getByRole("alert")).toHaveTextContent(
      "パスワードは12文字以上で入力してください",
    );
  });

  it("入力が空のとき送信ボタンが無効になる", () => {
    renderScreen();
    expect(screen.getByRole("button", { name: "ログイン" })).toBeDisabled();
  });

  it("エラーメッセージを表示する", () => {
    renderScreen({ error: "ログインに失敗しました" });
    expect(screen.getByRole("alert")).toHaveTextContent(
      "ログインに失敗しました",
    );
  });

  it("入力変更時に onClearError を呼ぶ", () => {
    renderScreen();
    fireEvent.change(screen.getByLabelText("ユーザー名"), {
      target: { value: "a" },
    });
    expect(onClearError).toHaveBeenCalled();
  });
});
