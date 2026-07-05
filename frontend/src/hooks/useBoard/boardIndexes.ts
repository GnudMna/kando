import type { Row } from "../../types";

/** 初回および追加読み込みで取得する行の最大件数 */
export const BOARD_PAGE_SIZE = 20;

export type ColumnLocation = {
  rowIndex: number;
  columnIndex: number;
};

export type BoardIndexes = {
  rowIndexById: Map<number, number>;
  columnLocationByDroppableId: Map<string, ColumnLocation>;
};

/**
 * 行配列から検索用インデックスを構築する。
 * @param rows - ボード行配列
 * @returns 行 ID とドロップ領域 ID を高速参照するためのインデックス
 */
export function buildBoardIndexes(rows: Row[]): BoardIndexes {
  const rowIndexById = new Map<number, number>();
  const columnLocationByDroppableId = new Map<string, ColumnLocation>();

  for (let rowIndex = 0; rowIndex < rows.length; rowIndex++) {
    const row = rows[rowIndex];
    rowIndexById.set(row.id, rowIndex);

    for (let columnIndex = 0; columnIndex < row.columns.length; columnIndex++) {
      const column = row.columns[columnIndex];
      columnLocationByDroppableId.set(column.id.toString(), {
        rowIndex,
        columnIndex,
      });
    }
  }

  return {
    rowIndexById,
    columnLocationByDroppableId,
  };
}
