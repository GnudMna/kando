// useDraggable フックのユニットテスト
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import type { MouseEvent as ReactMouseEvent } from "react";
import { useDraggable } from "../hooks/useDraggable";

describe("useDraggable", () => {
  beforeEach(() => {
    vi.spyOn(window, "addEventListener");
    vi.spyOn(window, "removeEventListener");
  });

  afterEach(() => {
    vi.restoreAllMocks();
    document.body.style.cursor = "";
    document.body.style.userSelect = "";
  });

  it("初期状態では posStyle が空で isDragged が false であること", () => {
    const { result } = renderHook(() => useDraggable());

    expect(result.current.posStyle).toEqual({});
    expect(result.current.isDragged).toBe(false);
    expect(result.current.isDragging).toBe(false);
  });

  it("ドラッグ開始で isDragged と posStyle が更新されること", () => {
    const { result } = renderHook(() => useDraggable());
    const div = document.createElement("div");
    document.body.appendChild(div);
    Object.defineProperty(div, "getBoundingClientRect", {
      value: () => ({
        left: 10,
        top: 20,
        width: 200,
        height: 100,
        right: 210,
        bottom: 120,
        x: 10,
        y: 20,
        toJSON: () => ({}),
      }),
    });
    result.current.containerRef.current = div;

    act(() => {
      result.current.onHandleMouseDown({
        button: 0,
        preventDefault: vi.fn(),
        clientX: 15,
        clientY: 25,
      } as unknown as ReactMouseEvent);
    });

    expect(result.current.isDragged).toBe(true);
    expect(result.current.isDragging).toBe(true);
    expect(result.current.posStyle).toEqual(
      expect.objectContaining({
        position: "fixed",
        left: 10,
        top: 20,
      }),
    );

    document.body.removeChild(div);
  });

  it("左クリック以外ではドラッグが開始されないこと", () => {
    const { result } = renderHook(() => useDraggable());

    act(() => {
      result.current.onHandleMouseDown({
        button: 1,
        preventDefault: vi.fn(),
        clientX: 0,
        clientY: 0,
      } as unknown as ReactMouseEvent);
    });

    expect(result.current.isDragged).toBe(false);
    expect(result.current.isDragging).toBe(false);
  });
});
