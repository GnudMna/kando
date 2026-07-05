import type { Row } from "../../types";
import { POSITION_GAP } from "../../utils/constants";
import type { BoardIndexes } from "./boardIndexes";

type MoveTaskParams = {
  rows: Row[];
  indexMap: BoardIndexes["columnLocationByDroppableId"];
  srcDroppableId: string;
  dstDroppableId: string;
  srcIndex: number;
  dstIndex: number;
};

type MoveTaskResult = {
  newRows: Row[];
  taskId: number;
  destColId: number;
  newPosition: number;
};

/**
 * タスク移動の楽観的更新結果を計算する。無効な操作の場合は `null`。
 * @param params.rows - 現在の行配列
 * @param params.indexMap - ドロップ先カラムの位置マップ
 * @param params.srcDroppableId - 移動元ドロップゾーン ID
 * @param params.dstDroppableId - 移動先ドロップゾーン ID
 * @param params.srcIndex - 移動元インデックス
 * @param params.dstIndex - 移動先インデックス
 * @returns 楽観的更新結果。無効な操作の場合は `null`
 */
export function computeMoveTaskUpdate({
  rows,
  indexMap,
  srcDroppableId,
  dstDroppableId,
  srcIndex,
  dstIndex,
}: MoveTaskParams): MoveTaskResult | null {
  const srcInfo = indexMap.get(srcDroppableId);
  const dstInfo = indexMap.get(dstDroppableId);
  if (!srcInfo || !dstInfo) return null;

  const srcRow = rows[srcInfo.rowIndex];
  const dstRow = rows[dstInfo.rowIndex];
  if (!srcRow || !dstRow) return null;

  const srcCol = srcRow.columns[srcInfo.columnIndex];
  const dstCol = dstRow.columns[dstInfo.columnIndex];
  if (!srcCol || !dstCol) return null;

  const isSameCol = srcDroppableId === dstDroppableId;
  const maxDstIndex = isSameCol ? srcCol.tasks.length - 1 : dstCol.tasks.length;
  if (
    srcIndex < 0 ||
    srcIndex >= srcCol.tasks.length ||
    dstIndex < 0 ||
    dstIndex > maxDstIndex
  ) {
    return null;
  }

  const srcTasks = [...srcCol.tasks];
  const dstTasks = isSameCol ? srcTasks : [...dstCol.tasks];
  const destColId = dstCol.id;

  const [movedTask] = srcTasks.splice(srcIndex, 1);
  if (!movedTask) return null;
  dstTasks.splice(dstIndex, 0, movedTask);

  const prev = dstTasks[dstIndex - 1];
  const next = dstTasks[dstIndex + 1];
  let newPosition: number;
  if (prev && next) {
    newPosition = (prev.position + next.position) / 2;
  } else if (prev) {
    newPosition = prev.position + POSITION_GAP;
  } else if (next) {
    newPosition = next.position / 2;
  } else {
    newPosition = POSITION_GAP;
  }
  dstTasks[dstIndex] = {
    ...movedTask,
    column_id: destColId,
    position: newPosition,
  };

  const newRows = [...rows];
  if (isSameCol) {
    const nextColumns = [...srcRow.columns];
    nextColumns[srcInfo.columnIndex] = {
      ...srcCol,
      tasks: dstTasks,
    };
    newRows[srcInfo.rowIndex] = {
      ...srcRow,
      columns: nextColumns,
    };
  } else if (srcInfo.rowIndex === dstInfo.rowIndex) {
    const nextColumns = [...srcRow.columns];
    nextColumns[srcInfo.columnIndex] = {
      ...srcCol,
      tasks: srcTasks,
    };
    nextColumns[dstInfo.columnIndex] = {
      ...dstCol,
      tasks: dstTasks,
    };
    newRows[srcInfo.rowIndex] = {
      ...srcRow,
      columns: nextColumns,
    };
  } else {
    const nextSrcColumns = [...srcRow.columns];
    nextSrcColumns[srcInfo.columnIndex] = {
      ...srcCol,
      tasks: srcTasks,
    };
    newRows[srcInfo.rowIndex] = {
      ...srcRow,
      columns: nextSrcColumns,
    };

    const nextDstColumns = [...dstRow.columns];
    nextDstColumns[dstInfo.columnIndex] = {
      ...dstCol,
      tasks: dstTasks,
    };
    newRows[dstInfo.rowIndex] = {
      ...dstRow,
      columns: nextDstColumns,
    };
  }

  return {
    newRows,
    taskId: movedTask.id,
    destColId,
    newPosition,
  };
}

type MoveColumnParams = {
  rows: Row[];
  rowIndexById: BoardIndexes["rowIndexById"];
  rowId: number;
  srcIndex: number;
  dstIndex: number;
  colId: number;
};

type MoveColumnResult = {
  newRows: Row[];
  newPosition: number;
};

/**
 * カラム移動の楽観的更新結果を計算する。無効な操作の場合は `null`。
 * @param params.rows - 現在の行配列
 * @param params.rowIndexById - 行 ID → インデックスのマップ
 * @param params.rowId - 対象行 ID
 * @param params.srcIndex - 移動元カラムインデックス
 * @param params.dstIndex - 移動先カラムインデックス
 * @returns 楽観的更新結果。無効な操作の場合は `null`
 */
export function computeMoveColumnUpdate({
  rows,
  rowIndexById,
  rowId,
  srcIndex,
  dstIndex,
}: MoveColumnParams): MoveColumnResult | null {
  const rowIdx = rowIndexById.get(rowId);
  if (rowIdx === undefined) return null;

  const row = rows[rowIdx];
  if (!row) return null;
  if (
    srcIndex < 0 ||
    srcIndex >= row.columns.length ||
    dstIndex < 0 ||
    dstIndex >= row.columns.length
  ) {
    return null;
  }

  const cols = [...row.columns];
  const [movedCol] = cols.splice(srcIndex, 1);
  if (!movedCol) return null;
  cols.splice(dstIndex, 0, movedCol);

  const prev = cols[dstIndex - 1];
  const next = cols[dstIndex + 1];
  let newPosition: number;
  if (prev && next) {
    newPosition = (prev.position + next.position) / 2;
  } else if (prev) {
    newPosition = prev.position + POSITION_GAP;
  } else if (next) {
    newPosition = next.position / 2;
  } else {
    newPosition = POSITION_GAP;
  }
  cols[dstIndex] = { ...movedCol, position: newPosition };

  const newRows = [...rows];
  newRows[rowIdx] = { ...row, columns: cols };

  return { newRows, newPosition };
}
