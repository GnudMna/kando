import { useCallback } from "react";
import * as api from "../../api/boardApi";
import { POSITION_GAP } from "../../utils/constants";
import type { BoardActionContext } from "./types";

/**
 * カラムの CRUD と並び替え操作を提供する。
 * @param ctx - ボード操作コンテキスト
 * @returns カラム操作ハンドラー
 */
export function useColumnActions({
  rowsRef,
  boardIndexesRef,
  setRows,
  setOperationError,
}: BoardActionContext) {
  const addColumn = useCallback(
    async (rowId: number, title: string) => {
      try {
        const row = rowsRef.current.find((r) => r.id === rowId);
        if (!row) return;
        const position =
          row.columns.length > 0
            ? row.columns[row.columns.length - 1].position + POSITION_GAP
            : POSITION_GAP;
        const newCol = await api.createColumn(title, position, rowId);
        setRows((prev) =>
          prev.map((r) =>
            r.id === rowId
              ? { ...r, columns: [...r.columns, { ...newCol, tasks: [] }] }
              : r,
          ),
        );
      } catch (err) {
        console.error(err);
        setOperationError("カラムの追加に失敗しました");
      }
    },
    [rowsRef, setRows, setOperationError],
  );

  const renameColumn = useCallback(
    async (colId: number, title: string) => {
      try {
        await api.updateColumn(colId, title);
        setRows((prev) =>
          prev.map((r) => ({
            ...r,
            columns: r.columns.map((c) => (c.id === colId ? { ...c, title } : c)),
          })),
        );
      } catch (err) {
        console.error(err);
        setOperationError("カラム名の変更に失敗しました");
      }
    },
    [setRows, setOperationError],
  );

  const removeColumn = useCallback(
    async (colId: number) => {
      try {
        await api.deleteColumn(colId);
        setRows((prev) =>
          prev.map((r) => ({
            ...r,
            columns: r.columns.filter((c) => c.id !== colId),
          })),
        );
      } catch (err) {
        console.error(err);
        setOperationError("カラムの削除に失敗しました");
      }
    },
    [setRows, setOperationError],
  );

  const moveColumn = useCallback(
    async (
      rowId: number,
      srcIndex: number,
      dstIndex: number,
      colId: number,
    ) => {
      const rows = rowsRef.current;
      const rowIdx = boardIndexesRef.current.rowIndexById.get(rowId);
      if (rowIdx === undefined) return;

      const row = rows[rowIdx];
      if (!row) return;
      if (
        srcIndex < 0 ||
        srcIndex >= row.columns.length ||
        dstIndex < 0 ||
        dstIndex >= row.columns.length
      ) {
        return;
      }

      const prevRows = rows;
      const cols = [...row.columns];

      const [movedCol] = cols.splice(srcIndex, 1);
      if (!movedCol) return;
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
      setRows(newRows);

      try {
        await api.moveColumn(colId, newPosition);
      } catch (err) {
        console.error("Failed to move column:", err);
        setRows(prevRows);
        setOperationError("カラムの移動に失敗しました");
      }
    },
    [boardIndexesRef, rowsRef, setRows, setOperationError],
  );

  return { addColumn, renameColumn, removeColumn, moveColumn };
}
