import { useCallback } from "react";
import * as api from "../../api/boardApi";
import { POSITION_GAP } from "../../utils/constants";
import type { BoardActionContext } from "./types";

/**
 * 行の CRUD 操作を提供する。
 * @param ctx - ボード操作コンテキスト
 * @returns 行操作ハンドラー
 */
export function useRowActions({
  rowsRef,
  setRows,
  setOperationError,
}: BoardActionContext) {
  const addRow = useCallback(
    async (title: string) => {
      try {
        const rows = rowsRef.current;
        const position =
          rows.length > 0
            ? rows[rows.length - 1].position + POSITION_GAP
            : POSITION_GAP;
        const newRow = await api.createRowWithDefaultColumns(title, position);
        setRows((prev) => [...prev, newRow]);
      } catch (err) {
        console.error(err);
        setOperationError("行の追加に失敗しました");
      }
    },
    [rowsRef, setRows, setOperationError],
  );

  const renameRow = useCallback(
    async (rowId: number, title: string) => {
      try {
        await api.updateRow(rowId, title);
        setRows((prev) =>
          prev.map((r) => (r.id === rowId ? { ...r, title } : r)),
        );
      } catch (err) {
        console.error(err);
        setOperationError("行名の変更に失敗しました");
      }
    },
    [setRows, setOperationError],
  );

  const removeRow = useCallback(
    async (rowId: number) => {
      try {
        await api.deleteRow(rowId);
        setRows((prev) => prev.filter((r) => r.id !== rowId));
      } catch (err) {
        console.error(err);
        setOperationError("行の削除に失敗しました");
      }
    },
    [setRows, setOperationError],
  );

  return { addRow, renameRow, removeRow };
}
