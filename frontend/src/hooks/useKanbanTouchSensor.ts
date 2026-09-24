import { useLayoutEffect, useRef } from "react";
import type {
  FluidDragActions,
  PreDragActions,
  Sensor,
} from "@hello-pangea/dnd";

/** 長押し成立までの待ち時間。指が乗っている間は揺れてもドラッグを諦めない。 */
const LONG_PRESS_MS = 160;
/** これより大きく動いたときだけ、長押し前の操作をスクロールとみなす。 */
const SLOP_PX = 36;
const EDGE_PX = 56;
const EDGE_MAX_STEP = 18;

/**
 * 指が画面端にある間、その行のカラム列を横スクロールする。
 * スマホでは1列が画面の大半を占めるため、隣の列へ移すには端での自動スクロールが必要。
 */
function scrollColumnsAtEdge(clientX: number, clientY: number) {
  document.querySelectorAll(".board-row-columns").forEach((node) => {
    if (!(node instanceof HTMLElement)) return;
    const rect = node.getBoundingClientRect();
    if (clientY < rect.top - 32 || clientY > rect.bottom + 32) return;

    const leftGap = clientX - rect.left;
    const rightGap = rect.right - clientX;
    if (leftGap < EDGE_PX) {
      node.scrollLeft -= Math.ceil(
        ((EDGE_PX - leftGap) / EDGE_PX) * EDGE_MAX_STEP,
      );
    } else if (rightGap < EDGE_PX) {
      node.scrollLeft += Math.ceil(
        ((EDGE_PX - rightGap) / EDGE_PX) * EDGE_MAX_STEP,
      );
    }
  });
}

/**
 * かんばん用タッチセンサー。
 * 標準の TouchSensor は長押し待ち中の touchmove をすべてキャンセルするため、
 * スマホでは指の微振動でドラッグが始まらない。許容範囲内の揺れは無視する。
 */
export const useKanbanTouchSensor: Sensor = (api) => {
  const apiRef = useRef(api);
  useLayoutEffect(() => {
    apiRef.current = api;
  });

  useLayoutEffect(() => {
    let phase: "idle" | "pending" | "scrolling" | "dragging" = "idle";
    let originX = 0;
    let originY = 0;
    let pointX = 0;
    let pointY = 0;
    let lastX = 0;
    let lastY = 0;
    let timer = 0;
    let edgeFrame = 0;
    let pending: PreDragActions | null = null;
    let dragging: FluidDragActions | null = null;
    let listening = false;
    let pointerId = -1;
    let scrollAxis: "x" | "y" | null = null;
    let columnScroller: HTMLElement | null = null;

    const releasePointer = () => {
      if (pointerId < 0) return;
      const id = pointerId;
      pointerId = -1;
      if (document.documentElement.hasPointerCapture(id)) {
        document.documentElement.releasePointerCapture(id);
      }
    };

    const stopEdgeScroll = () => {
      if (edgeFrame) cancelAnimationFrame(edgeFrame);
      edgeFrame = 0;
    };

    const edgeTick = () => {
      scrollColumnsAtEdge(pointX, pointY);
      edgeFrame = requestAnimationFrame(edgeTick);
    };

    const unbindMoves = () => {
      if (!listening) return;
      listening = false;
      window.removeEventListener("pointermove", onPointerMove, true);
      window.removeEventListener("pointerup", onPointerUp, true);
      window.removeEventListener("pointercancel", onPointerCancel, true);
      window.removeEventListener("contextmenu", onContextMenu, true);
    };

    const release = () => {
      window.clearTimeout(timer);
      timer = 0;
      stopEdgeScroll();
      releasePointer();
      unbindMoves();
      phase = "idle";
      pending = null;
      dragging = null;
      scrollAxis = null;
      columnScroller = null;
    };

    const beginManualScroll = (clientX: number, clientY: number) => {
      const dx = clientX - originX;
      const dy = clientY - originY;
      scrollAxis = Math.abs(dx) > Math.abs(dy) ? "x" : "y";
      const current = pending;
      pending = null;
      window.clearTimeout(timer);
      timer = 0;
      phase = "scrolling";
      current?.abort();
    };

    const scrollByFinger = (clientX: number, clientY: number) => {
      const dx = clientX - lastX;
      const dy = clientY - lastY;
      if (scrollAxis === "x") {
        columnScroller?.scrollBy({ left: -dx });
      } else {
        window.scrollBy(0, -dy);
      }
    };

    const abortPending = () => {
      const current = pending;
      release();
      current?.abort();
    };

    const cancelDragging = () => {
      const current = dragging;
      release();
      current?.cancel({ shouldBlockNextClick: true });
    };

    function onContextMenu(event: Event) {
      if (phase !== "idle") event.preventDefault();
    }

    function onPointerMove(event: PointerEvent) {
      if (event.pointerId !== pointerId) return;
      pointX = event.clientX;
      pointY = event.clientY;

      if (phase === "pending") {
        event.preventDefault();
        const dx = pointX - originX;
        const dy = pointY - originY;
        if (dx * dx + dy * dy > SLOP_PX * SLOP_PX) {
          beginManualScroll(pointX, pointY);
          scrollByFinger(pointX, pointY);
        }
        lastX = pointX;
        lastY = pointY;
        return;
      }

      if (phase === "scrolling") {
        event.preventDefault();
        scrollByFinger(pointX, pointY);
        lastX = pointX;
        lastY = pointY;
        return;
      }

      if (phase === "dragging" && dragging) {
        event.preventDefault();
        dragging.move({ x: pointX, y: pointY });
      }
    }

    function onPointerUp(event: PointerEvent) {
      if (event.pointerId !== pointerId) return;
      if (phase === "dragging" && dragging) {
        event.preventDefault();
        const current = dragging;
        release();
        current.drop({ shouldBlockNextClick: true });
        return;
      }
      if (phase === "scrolling") {
        event.preventDefault();
        release();
        return;
      }
      abortPending();
    }

    function onPointerCancel(event: PointerEvent) {
      if (event.pointerId !== pointerId) return;
      if (phase === "dragging") cancelDragging();
      else abortPending();
    }

    const bindMoves = () => {
      if (listening) return;
      listening = true;
      window.addEventListener("pointermove", onPointerMove, {
        capture: true,
        passive: false,
      });
      window.addEventListener("pointerup", onPointerUp, true);
      window.addEventListener("pointercancel", onPointerCancel, true);
      window.addEventListener("contextmenu", onContextMenu, true);
    };

    const onPointerDown = (event: PointerEvent) => {
      if (phase !== "idle" || event.defaultPrevented) return;
      if (event.pointerType === "mouse" || !event.isPrimary) return;

      const draggableId = apiRef.current.findClosestDraggableId(event);
      if (!draggableId) return;

      const lock = apiRef.current.tryGetLock(draggableId, release, {
        sourceEvent: event,
      });
      if (!lock) return;

      pointerId = event.pointerId;
      try {
        // カードを body へ移しても、指のイベントが切れないようにする
        document.documentElement.setPointerCapture(event.pointerId);
      } catch {
        pointerId = -1;
        lock.abort();
        return;
      }

      originX = event.clientX;
      originY = event.clientY;
      pointX = originX;
      pointY = originY;
      lastX = originX;
      lastY = originY;
      pending = lock;
      phase = "pending";
      columnScroller =
        event.target instanceof Element
          ? event.target.closest(".board-row-columns")
          : null;
      bindMoves();
      timer = window.setTimeout(() => {
        if (phase !== "pending" || !pending) return;
        dragging = pending.fluidLift({ x: pointX, y: pointY });
        pending = null;
        phase = "dragging";
        edgeFrame = requestAnimationFrame(edgeTick);
      }, LONG_PRESS_MS);
    };

    window.addEventListener("pointerdown", onPointerDown, {
      capture: true,
      passive: false,
    });

    return () => {
      window.removeEventListener("pointerdown", onPointerDown, true);
      if (phase === "dragging") cancelDragging();
      else if (phase === "pending") abortPending();
      else release();
    };
  }, []);
};
