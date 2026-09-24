import { useState, useRef, useCallback } from "react";
import type React from "react";

/**
 * ウィンドウ要素をドラッグ可能にするカスタムフック。
 *
 * - `containerRef` をドラッグ対象の最外 div に設定する
 * - `onHandleMouseDown` をドラッグハンドル。タイトルバー等の onMouseDown に設定する
 * - `posStyle` をドラッグ対象の div の style に適用する。初回 fixed 化のみ React が管理
 * - `isDragged` が true になった後は CSS の bottom/right に代わり left/top で位置を管理する
 * - `isDragging` はドラッグ中のカーソル制御などに使用できる
 *
 * mousemove 中の座標更新は setState を経由せず containerRef への直接 style 変更で行うため、
 * ドラッグ中に React の再レンダリングが一切発生しない。
 * ドラッグ終了時のみ dragPos state を同期し、再レンダリング後も正しい座標を復元する。
 *
 * @returns ドラッグ制御オブジェクト。`containerRef`, `onHandleMouseDown`, `posStyle`, `isDragged`, `isDragging`
 */
export function useDraggable() {
  const [isDragged, setIsDragged] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  // レンダー時に posStyle へ渡す座標。ドラッグ開始・終了時にのみ更新
  const [dragPos, setDragPos] = useState<{ x: number; y: number } | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  // mousemove 中は DOM を直接変更するための座標キャッシュ。setState を経由しない
  const lastPosRef = useRef<{ x: number; y: number } | null>(null);

  const onHandleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (e.button !== 0) return;
      // 狭い画面ではパネルを全画面固定し、ドラッグで画面外に出さない
      if (window.matchMedia("(max-width: 768px)").matches) return;
      e.preventDefault();

      const el = containerRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();

      // 初回ドラッグ: fixed 化のために React state を1回だけ更新する
      if (!isDragged) {
        const initialPos = { x: rect.left, y: rect.top };
        lastPosRef.current = initialPos;
        setDragPos(initialPos);
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
        // 48px は画面上部の固定ヘッダー分の余白。モーダルがヘッダー下に隠れないようにする
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
        // ドラッグ終了時に最終座標を state へ同期し、再レンダリング後も位置を維持する
        if (lastPosRef.current) {
          setDragPos(lastPosRef.current);
        }
        window.removeEventListener("mousemove", onMouseMove);
        window.removeEventListener("mouseup", onMouseUp);
      };

      window.addEventListener("mousemove", onMouseMove);
      window.addEventListener("mouseup", onMouseUp);
    },
    [isDragged],
  );

  // fixed 化後は dragPos state から座標を復元する。レンダー中に ref を読まない
  const posStyle: React.CSSProperties =
    isDragged && dragPos !== null
      ? {
          position: "fixed",
          left: dragPos.x,
          top: dragPos.y,
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
