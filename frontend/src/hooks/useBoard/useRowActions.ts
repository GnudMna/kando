import { useMutation } from "@tanstack/react-query";
import { useCallback } from "react";
import {
  createRowWithDefaultColumns,
  deleteRow,
  updateRow,
} from "../../api/rows";
import { POSITION_GAP } from "../../utils/constants";
import type { BoardActionContext } from "./types";
import { useBoardMutationContext } from "./useBoardMutationContext";

/**
 * 行の CRUD 操作を提供する。
 * @param ctx - ボード操作コンテキスト
 * @returns 行操作ハンドラー
 */
export function useRowActions({
  rowsRef,
  setOperationError,
}: BoardActionContext) {
  const { setBoardRows, onMutationError } =
    useBoardMutationContext(setOperationError);

  const addRowMutation = useMutation({
    mutationFn: ({ title, position }: { title: string; position: number }) =>
      createRowWithDefaultColumns(title, position),
    onSuccess: (newRow) => {
      setBoardRows((rows) => [...rows, newRow]);
    },
    onError: onMutationError("行の追加に失敗しました"),
  });

  const renameRowMutation = useMutation({
    mutationFn: ({ rowId, title }: { rowId: number; title: string }) =>
      updateRow(rowId, title),
    onSuccess: (updated) => {
      setBoardRows((rows) =>
        rows.map((r) =>
          r.id === updated.id ? { ...r, title: updated.title } : r,
        ),
      );
    },
    onError: onMutationError("行名の変更に失敗しました"),
  });

  const removeRowMutation = useMutation({
    mutationFn: (rowId: number) => deleteRow(rowId),
    onSuccess: (_result, rowId) => {
      setBoardRows((rows) => rows.filter((r) => r.id !== rowId));
    },
    onError: onMutationError("行の削除に失敗しました"),
  });

  const addRow = useCallback(
    async (title: string) => {
      const rows = rowsRef.current;
      const position =
        rows.length > 0
          ? rows[rows.length - 1].position + POSITION_GAP
          : POSITION_GAP;
      try {
        await addRowMutation.mutateAsync({ title, position });
      } catch {
        /* mutation onError が UI エラーを処理する */
      }
    },
    [addRowMutation, rowsRef],
  );

  const renameRow = useCallback(
    async (rowId: number, title: string) => {
      try {
        await renameRowMutation.mutateAsync({ rowId, title });
      } catch {
        /* mutation onError が UI エラーを処理する */
      }
    },
    [renameRowMutation],
  );

  const removeRow = useCallback(
    async (rowId: number) => {
      try {
        await removeRowMutation.mutateAsync(rowId);
      } catch {
        /* mutation onError が UI エラーを処理する */
      }
    },
    [removeRowMutation],
  );

  return { addRow, renameRow, removeRow };
}
