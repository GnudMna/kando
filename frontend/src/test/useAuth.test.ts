import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { useAuth } from "../hooks/useAuth";
import * as api from "../api/boardApi";

vi.mock("../api/boardApi");

describe("useAuth", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(api.setOnUnauthorized).mockImplementation(() => undefined);
  });

  it("verify 成功時は authenticated になる", async () => {
    vi.mocked(api.verify).mockResolvedValue(true);

    const { result } = renderHook(() => useAuth());

    await waitFor(() => expect(result.current.status).toBe("authenticated"));
  });

  it("未登録環境では unregistered になる", async () => {
    vi.mocked(api.verify).mockResolvedValue(false);
    vi.mocked(api.checkStatus).mockResolvedValue({ hasUsers: false });

    const { result } = renderHook(() => useAuth());

    await waitFor(() => expect(result.current.status).toBe("unregistered"));
  });

  it("登録済みで未ログイン時は unauthenticated になる", async () => {
    vi.mocked(api.verify).mockResolvedValue(false);
    vi.mocked(api.checkStatus).mockResolvedValue({ hasUsers: true });

    const { result } = renderHook(() => useAuth());

    await waitFor(() => expect(result.current.status).toBe("unauthenticated"));
  });

  it("checkStatus 失敗時は unauthenticated になる", async () => {
    vi.mocked(api.verify).mockResolvedValue(false);
    vi.mocked(api.checkStatus).mockRejectedValue(new Error("network"));

    const { result } = renderHook(() => useAuth());

    await waitFor(() => expect(result.current.status).toBe("unauthenticated"));
  });

  it("login 成功時は authenticated になる", async () => {
    vi.mocked(api.verify).mockResolvedValue(false);
    vi.mocked(api.checkStatus).mockResolvedValue({ hasUsers: true });
    vi.mocked(api.login).mockResolvedValue(undefined);

    const { result } = renderHook(() => useAuth());
    await waitFor(() => expect(result.current.status).toBe("unauthenticated"));

    await act(async () => {
      await result.current.login("alice", "validpassword12");
    });

    expect(api.login).toHaveBeenCalledWith("alice", "validpassword12");
    expect(result.current.status).toBe("authenticated");
    expect(result.current.error).toBeNull();
  });

  it("login 失敗時はエラーメッセージを設定する", async () => {
    vi.mocked(api.verify).mockResolvedValue(false);
    vi.mocked(api.checkStatus).mockResolvedValue({ hasUsers: true });
    vi.mocked(api.login).mockRejectedValue(
      new Error("ユーザー名またはパスワードが正しくありません"),
    );

    const { result } = renderHook(() => useAuth());
    await waitFor(() => expect(result.current.status).toBe("unauthenticated"));

    await act(async () => {
      await result.current.login("alice", "wrong");
    });

    expect(result.current.status).toBe("unauthenticated");
    expect(result.current.error).toBe(
      "ユーザー名またはパスワードが正しくありません",
    );
  });

  it("register 成功時は authenticated になる", async () => {
    vi.mocked(api.verify).mockResolvedValue(false);
    vi.mocked(api.checkStatus).mockResolvedValue({ hasUsers: false });
    vi.mocked(api.register).mockResolvedValue(undefined);

    const { result } = renderHook(() => useAuth());
    await waitFor(() => expect(result.current.status).toBe("unregistered"));

    await act(async () => {
      await result.current.register("newuser", "validpassword12");
    });

    expect(api.register).toHaveBeenCalledWith("newuser", "validpassword12");
    expect(result.current.status).toBe("authenticated");
  });

  it("logout で unauthenticated になる", async () => {
    vi.mocked(api.verify).mockResolvedValue(true);
    vi.mocked(api.logout).mockResolvedValue(undefined);

    const { result } = renderHook(() => useAuth());
    await waitFor(() => expect(result.current.status).toBe("authenticated"));

    act(() => {
      result.current.logout();
    });

    expect(api.logout).toHaveBeenCalled();
    expect(result.current.status).toBe("unauthenticated");
  });

  it("401 コールバックで unauthenticated になる", async () => {
    vi.mocked(api.verify).mockResolvedValue(true);
    let unauthorizedHandler: (() => void) | undefined;
    vi.mocked(api.setOnUnauthorized).mockImplementation((callback) => {
      unauthorizedHandler = callback;
    });

    const { result } = renderHook(() => useAuth());
    await waitFor(() => expect(result.current.status).toBe("authenticated"));

    act(() => {
      unauthorizedHandler?.();
    });

    expect(result.current.status).toBe("unauthenticated");
  });

  it("clearError でエラーをクリアする", async () => {
    vi.mocked(api.verify).mockResolvedValue(false);
    vi.mocked(api.checkStatus).mockResolvedValue({ hasUsers: true });
    vi.mocked(api.login).mockRejectedValue(new Error("失敗"));

    const { result } = renderHook(() => useAuth());
    await waitFor(() => expect(result.current.status).toBe("unauthenticated"));

    await act(async () => {
      await result.current.login("alice", "wrong");
    });
    expect(result.current.error).toBe("失敗");

    act(() => {
      result.current.clearError();
    });
    expect(result.current.error).toBeNull();
  });
});
