import { useState, useRef, useCallback } from "react";
import type React from "react";

/**
 * ウィンドウ要素をドラッグ可能にするカスタムフック。
 *
 * - `containerRef` をドラッグ対象の最外 div に設定する
 * - `onHandleMouseDown` をドラッグハンドル（タイトルバー等）の onMouseDown に設定する
 * - `posStyle` をドラッグ対象の div の style に適用する
 * - `isDragged` が true になった後は CSS の bottom/right に代わり left/top で位置を管理する
 * - `isDragging` はドラッグ中のカーソル制御などに使用できる
 */
export function useDraggable() {
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const onHandleMouseDown = useCallback((e: React.MouseEvent) => {
    // 左ボタンのみ有効
    if (e.button !== 0) return;
    e.preventDefault();

    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;

    const originX = rect.left;
    const originY = rect.top;
    const elemW = rect.width;
    const mouseOriginX = e.clientX;
    const mouseOriginY = e.clientY;

    setIsDragging(true);
    document.body.style.cursor = "grabbing";
    document.body.style.userSelect = "none";

    const onMouseMove = (ev: MouseEvent) => {
      const rawX = originX + ev.clientX - mouseOriginX;
      const rawY = originY + ev.clientY - mouseOriginY;
      // ヘッダー部分が常に画面内に収まるようクランプする
      setPos({
        x: Math.max(0, Math.min(window.innerWidth - elemW, rawX)),
        y: Math.max(0, Math.min(window.innerHeight - 48, rawY)),
      });
    };

    const onMouseUp = () => {
      setIsDragging(false);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };

    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
  }, []);

  const posStyle: React.CSSProperties =
    pos !== null
      ? {
          position: "fixed",
          left: pos.x,
          top: pos.y,
          bottom: "auto",
          right: "auto",
          margin: 0,
        }
      : {};

  return {
    containerRef,
    onHandleMouseDown,
    posStyle,
    isDragged: pos !== null,
    isDragging,
  };
}
