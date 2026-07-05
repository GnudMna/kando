import type { QueryClient } from "@tanstack/react-query";
import type { SetStateAction } from "react";
import type { Row } from "../../types";
import { queryKeys } from "../../api/queryKeys";

/** React Query キャッシュに保持するボードデータ。 */
export type BoardCache = {
  rows: Row[];
  hasMore: boolean;
};

/** ボードキャッシュ内の行配列を更新する。 */
export function updateBoardRows(
  queryClient: QueryClient,
  updater: (rows: Row[]) => Row[],
): void {
  queryClient.setQueryData<BoardCache>(queryKeys.board.list(), (old) => {
    if (!old) return old;
    return { ...old, rows: updater(old.rows) };
  });
}

/** `useState` 互換の setter を React Query キャッシュ更新に橋渡しする。 */
export function createBoardRowsSetter(
  queryClient: QueryClient,
): (action: SetStateAction<Row[]>) => void {
  return (action) => {
    updateBoardRows(queryClient, (rows) =>
      typeof action === "function" ? action(rows) : action,
    );
  };
}

/** 追加ページをボードキャッシュにマージする。 */
export function appendBoardRows(
  queryClient: QueryClient,
  moreRows: Row[],
  pageSize: number,
): void {
  queryClient.setQueryData<BoardCache>(queryKeys.board.list(), (old) => {
    if (!old) {
      return {
        rows: moreRows,
        hasMore: moreRows.length === pageSize,
      };
    }
    return {
      rows: [...old.rows, ...moreRows],
      hasMore: moreRows.length === pageSize,
    };
  });
}
