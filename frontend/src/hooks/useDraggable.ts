import { useState, useRef, useCallback } from "react";
import type React from "react";

/**
 * ウィンドウ要素をドラッグ可能にするカスタムフック。
 *
 * - `containerRef` をドラッグ対象の最外 div に設定する
 * - `onHandleMouseDown` をドラッグハンドル（タイトルバー等）の onMouseDown に設定する
 * - `posStyle` をドラッグ対象の div の style に適用する（初回 fixed 化のみ React が管理）
 * - `isDragged` が true になった後は CSS の bottom/right に代わり left/top で位置を管理する
 * - `isDragging` はドラッグ中のカーソル制御などに使用できる
 *
 * mousemove 中の座標更新は setState を経由せず containerRef への直接 style 変更で行うため、
 * ドラッグ中に React の再レンダリングが一切発生しない。
 */
export function useDraggable() {
  // fixed 化フラグだけ React state で管理（初回ドラッグ開始時に1回だけ変わる）
  const [isDragged, setIsDragged] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  // React state を介さず最終座標を保持しておく（再レンダリング後の style 復元用）
  const lastPosRef = useRef<{ x: number; y: number } | null>(null);

  const onHandleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (e.button !== 0) return;
      e.preventDefault();

      const el = containerRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();

      // 初回ドラッグ: fixed 化のために React state を1回だけ更新する
      if (!isDragged) {
        lastPosRef.current = { x: rect.left, y: rect.top };
        setIsDragged(true);
      }

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
        const x = Math.max(0, Math.min(window.innerWidth - elemW, rawX));
        const y = Math.max(0, Math.min(window.innerHeight - 48, rawY));

        // setState を使わず DOM を直接変更 → React 再レンダリングなし
        if (containerRef.current) {
          containerRef.current.style.left = `${x}px`;
          containerRef.current.style.top = `${y}px`;
        }
        lastPosRef.current = { x, y };
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
    },
    [isDragged],
  );

  // fixed 化後は lastPosRef から座標を復元する（再レンダリング時に style が消えるのを防ぐ）
  const posStyle: React.CSSProperties =
    isDragged && lastPosRef.current !== null
      ? {
          position: "fixed",
          left: lastPosRef.current.x,
          top: lastPosRef.current.y,
          bottom: "auto",
          right: "auto",
          margin: 0,
        }
      : {};

  return {
    containerRef,
    onHandleMouseDown,
    posStyle,
    isDragged,
    isDragging,
  };
}
