import type { QueryClient } from "@tanstack/react-query";
import type { SetStateAction } from "react";
import type { Row } from "../../types";
import { queryKeys } from "../../api/queryKeys";

/** React Query キャッシュに保持するボードデータ。 */
export type BoardCache = {
  rows: Row[];
  hasMore: boolean;
};

/**
 * ボードキャッシュ内の行配列を更新する。
 * @param queryClient - React Query クライアント
 * @param updater - 行配列を変換する関数
 */
export function updateBoardRows(
  queryClient: QueryClient,
  updater: (rows: Row[]) => Row[],
): void {
  queryClient.setQueryData<BoardCache>(queryKeys.board.list(), (old) => {
    if (!old) return old;
    return { ...old, rows: updater(old.rows) };
  });
}

/**
 * `useState` 互換の setter を React Query キャッシュ更新に橋渡しする。
 * @param queryClient - React Query クライアント
 * @returns `useState` 互換の行配列 setter
 */
export function createBoardRowsSetter(
  queryClient: QueryClient,
): (action: SetStateAction<Row[]>) => void {
  return (action) => {
    updateBoardRows(queryClient, (rows) =>
      typeof action === "function" ? action(rows) : action,
    );
  };
}

/**
 * 追加ページをボードキャッシュにマージする。
 * @param queryClient - React Query クライアント
 * @param moreRows - 追加する行配列
 * @param pageSize - 1ページあたりの行数(`hasMore` 判定に使用)
 */
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
