import type { QueryClient } from "@tanstack/react-query";
import type { SetStateAction } from "react";
import type { PositionUpdate } from "@kando/types";
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
 * サーバーが確定させたタスクの position を行配列へ反映する。
 * 並び順は変えず、position の値だけを差し替える。
 * @param rows - 現在の行配列
 * @param updates - 反映するタスク ID と position
 * @returns 更新後の行配列。変更が無い要素は同一参照を保つ
 */
export function applyTaskPositions(
  rows: Row[],
  updates: PositionUpdate[],
): Row[] {
  if (updates.length === 0) return rows;
  const positionById = new Map(updates.map((u) => [u.id, u.position]));
  return rows.map((row) => ({
    ...row,
    columns: row.columns.map((col) => ({
      ...col,
      tasks: col.tasks.map((task) => {
        const position = positionById.get(task.id);
        return position === undefined || position === task.position
          ? task
          : { ...task, position };
      }),
    })),
  }));
}

/**
 * サーバーが確定させたカラムの position を行配列へ反映する。
 * 並び順は変えず、position の値だけを差し替える。
 * @param rows - 現在の行配列
 * @param updates - 反映するカラム ID と position
 * @returns 更新後の行配列。変更が無い要素は同一参照を保つ
 */
export function applyColumnPositions(
  rows: Row[],
  updates: PositionUpdate[],
): Row[] {
  if (updates.length === 0) return rows;
  const positionById = new Map(updates.map((u) => [u.id, u.position]));
  return rows.map((row) => ({
    ...row,
    columns: row.columns.map((col) => {
      const position = positionById.get(col.id);
      return position === undefined || position === col.position
        ? col
        : { ...col, position };
    }),
  }));
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
