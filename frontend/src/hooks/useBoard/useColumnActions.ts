import { useMutation } from "@tanstack/react-query";
import { useCallback } from "react";
import type { Row } from "../../types";
import {
  createColumn,
  deleteColumn,
  moveColumn as moveColumnApi,
  updateColumn,
} from "../../api/columns";
import { POSITION_GAP } from "../../utils/constants";
import { computeMoveColumnUpdate } from "./boardOptimisticUpdates";
import type { BoardActionContext } from "./types";
import { useBoardMutationContext } from "./useBoardMutationContext";

/**
 * カラムの CRUD と並び替え操作を提供する。
 * @param ctx - ボード操作コンテキスト
 * @returns カラム操作ハンドラー
 */
export function useColumnActions({
  rowsRef,
  boardIndexesRef,
  setRows,
}: BoardActionContext) {
  const { setBoardRows, getBoardRows, onMutationError } =
    useBoardMutationContext();

  const addColumnMutation = useMutation({
    mutationFn: ({
      title,
      position,
      rowId,
    }: {
      title: string;
      position: number;
      rowId: number;
    }) => createColumn(title, position, rowId),
    onSuccess: (newCol, { rowId }) => {
      setBoardRows((rows) =>
        rows.map((r) =>
          r.id === rowId
            ? { ...r, columns: [...r.columns, { ...newCol, tasks: [] }] }
            : r,
        ),
      );
    },
    onError: onMutationError("カラムの追加に失敗しました"),
  });

  const renameColumnMutation = useMutation({
    mutationFn: ({ colId, title }: { colId: number; title: string }) =>
      updateColumn(colId, title),
    onSuccess: (updated) => {
      setBoardRows((rows) =>
        rows.map((r) => ({
          ...r,
          columns: r.columns.map((c) =>
            c.id === updated.id ? { ...c, title: updated.title } : c,
          ),
        })),
      );
    },
    onError: onMutationError("カラム名の変更に失敗しました"),
  });

  const removeColumnMutation = useMutation({
    mutationFn: (colId: number) => deleteColumn(colId),
    onSuccess: (_result, colId) => {
      setBoardRows((rows) =>
        rows.map((r) => ({
          ...r,
          columns: r.columns.filter((c) => c.id !== colId),
        })),
      );
    },
    onError: onMutationError("カラムの削除に失敗しました"),
  });

  const moveColumnMutation = useMutation({
    mutationFn: ({
      colId,
      newPosition,
    }: {
      colId: number;
      newPosition: number;
      optimisticRows: Row[];
    }) => moveColumnApi(colId, newPosition),
    onMutate: ({ optimisticRows }) => {
      const prevRows = getBoardRows();
      setRows(optimisticRows);
      return { prevRows };
    },
    onError: (err, _variables, context) => {
      if (context?.prevRows) {
        setRows(context.prevRows);
      }
      onMutationError("カラムの移動に失敗しました")(err);
    },
  });

  const addColumn = useCallback(
    async (rowId: number, title: string) => {
      const row = rowsRef.current.find((r) => r.id === rowId);
      if (!row) return;
      const position =
        row.columns.length > 0
          ? row.columns[row.columns.length - 1].position + POSITION_GAP
          : POSITION_GAP;
      try {
        await addColumnMutation.mutateAsync({ title, position, rowId });
      } catch {
        /* mutation onError が UI エラーを処理する */
      }
    },
    [addColumnMutation, rowsRef],
  );

  const renameColumn = useCallback(
    async (colId: number, title: string) => {
      try {
        await renameColumnMutation.mutateAsync({ colId, title });
      } catch {
        /* mutation onError が UI エラーを処理する */
      }
    },
    [renameColumnMutation],
  );

  const removeColumn = useCallback(
    async (colId: number) => {
      try {
        await removeColumnMutation.mutateAsync(colId);
      } catch {
        /* mutation onError が UI エラーを処理する */
      }
    },
    [removeColumnMutation],
  );

  const moveColumn = useCallback(
    async (
      rowId: number,
      srcIndex: number,
      dstIndex: number,
      colId: number,
    ) => {
      const rows = rowsRef.current;
      const result = computeMoveColumnUpdate({
        rows,
        rowIndexById: boardIndexesRef.current.rowIndexById,
        rowId,
        srcIndex,
        dstIndex,
        colId,
      });
      if (!result) return;

      try {
        await moveColumnMutation.mutateAsync({
          colId,
          newPosition: result.newPosition,
          optimisticRows: result.newRows,
        });
      } catch {
        /* mutation onError が UI エラーを処理する */
      }
    },
    [boardIndexesRef, moveColumnMutation, rowsRef],
  );

  return { addColumn, renameColumn, removeColumn, moveColumn };
}
