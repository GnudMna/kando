import { useMutation } from "@tanstack/react-query";
import { useCallback } from "react";
import type { Row, Task } from "../../types";
import {
  copyTask as copyTaskApi,
  createTask,
  deleteTask,
  moveTask as moveTaskApi,
} from "../../api/tasks";
import { POSITION_GAP } from "../../utils/constants";
import { computeMoveTaskUpdate } from "./boardOptimisticUpdates";
import type { BoardActionContext } from "./types";
import { useBoardMutationContext } from "./useBoardMutationContext";

/**
 * タスクの CRUD・更新・並び替え操作を提供する。
 * @param ctx - ボード操作コンテキスト
 * @returns タスク操作ハンドラー
 */
export function useTaskActions({
  rowsRef,
  boardIndexesRef,
  setRows,
  setOperationError,
}: BoardActionContext) {
  const { setBoardRows, getBoardRows, onMutationError } =
    useBoardMutationContext(setOperationError);

  const addTaskMutation = useMutation({
    mutationFn: ({
      colId,
      position,
    }: {
      colId: number;
      position: number;
      rowId: number;
    }) => createTask(colId, "新しいタスク", position),
    onSuccess: (newTask, { rowId, colId }) => {
      setBoardRows((rows) =>
        rows.map((r) =>
          r.id === rowId
            ? {
                ...r,
                columns: r.columns.map((c) =>
                  c.id === colId ? { ...c, tasks: [...c.tasks, newTask] } : c,
                ),
              }
            : r,
        ),
      );
    },
    onError: onMutationError("タスクの追加に失敗しました"),
  });

  const removeTaskMutation = useMutation({
    mutationFn: ({ taskId }: { taskId: number; colId: number }) =>
      deleteTask(taskId),
    onSuccess: (_result, { colId, taskId }) => {
      setBoardRows((rows) =>
        rows.map((r) => ({
          ...r,
          columns: r.columns.map((c) =>
            c.id === colId
              ? { ...c, tasks: c.tasks.filter((t) => t.id !== taskId) }
              : c,
          ),
        })),
      );
    },
    onError: onMutationError("タスクの削除に失敗しました"),
  });

  const copyTaskMutation = useMutation({
    mutationFn: ({ taskId }: { taskId: number; colId: number }) =>
      copyTaskApi(taskId),
    onSuccess: (copied, { colId }) => {
      setBoardRows((rows) =>
        rows.map((r) => ({
          ...r,
          columns: r.columns.map((c) =>
            c.id === colId ? { ...c, tasks: [...c.tasks, copied] } : c,
          ),
        })),
      );
    },
    onError: onMutationError("タスクのコピーに失敗しました"),
  });

  const moveTaskMutation = useMutation({
    mutationFn: ({
      taskId,
      destColId,
      newPosition,
    }: {
      taskId: number;
      destColId: number;
      newPosition: number;
      optimisticRows: Row[];
    }) => moveTaskApi(taskId, destColId, newPosition),
    onMutate: ({ optimisticRows }) => {
      const prevRows = getBoardRows();
      setRows(optimisticRows);
      return { prevRows };
    },
    onError: (err, _variables, context) => {
      if (context?.prevRows) {
        setRows(context.prevRows);
      }
      onMutationError("タスクの移動に失敗しました")(err);
    },
  });

  const addTask = useCallback(
    async (colId: number, rowId: number): Promise<Task | null> => {
      const row = rowsRef.current.find((r) => r.id === rowId);
      const col = row?.columns.find((c) => c.id === colId);
      if (!col) return null;
      const position =
        col.tasks.length > 0
          ? col.tasks[col.tasks.length - 1].position + POSITION_GAP
          : POSITION_GAP;
      try {
        return await addTaskMutation.mutateAsync({ colId, rowId, position });
      } catch {
        return null;
      }
    },
    [addTaskMutation, rowsRef],
  );

  const removeTask = useCallback(
    async (colId: number, taskId: number) => {
      try {
        await removeTaskMutation.mutateAsync({ colId, taskId });
      } catch {
        /* mutation onError が UI エラーを処理する */
      }
    },
    [removeTaskMutation],
  );

  const copyTask = useCallback(
    async (colId: number, taskId: number): Promise<Task | null> => {
      try {
        return await copyTaskMutation.mutateAsync({ colId, taskId });
      } catch {
        return null;
      }
    },
    [copyTaskMutation],
  );

  const updateTask = useCallback(
    (updatedTask: Task) => {
      setRows((prev) => {
        const colKey = updatedTask.column_id.toString();
        const location =
          boardIndexesRef.current.columnLocationByDroppableId.get(colKey);

        if (!location) {
          return prev.map((r) => ({
            ...r,
            columns: r.columns.map((c) => ({
              ...c,
              tasks: c.tasks.map((t) =>
                t.id === updatedTask.id ? updatedTask : t,
              ),
            })),
          }));
        }

        const { rowIndex, columnIndex } = location;
        const row = prev[rowIndex];
        const col = row.columns[columnIndex];
        const newCols = [...row.columns];
        newCols[columnIndex] = {
          ...col,
          tasks: col.tasks.map((t) =>
            t.id === updatedTask.id ? updatedTask : t,
          ),
        };
        const newRows = [...prev];
        newRows[rowIndex] = { ...row, columns: newCols };
        return newRows;
      });
    },
    [boardIndexesRef, setRows],
  );

  const moveTask = useCallback(
    async (
      srcDroppableId: string,
      dstDroppableId: string,
      srcIndex: number,
      dstIndex: number,
      _taskId: number,
    ) => {
      const result = computeMoveTaskUpdate({
        rows: rowsRef.current,
        indexMap: boardIndexesRef.current.columnLocationByDroppableId,
        srcDroppableId,
        dstDroppableId,
        srcIndex,
        dstIndex,
      });
      if (!result) return;

      try {
        await moveTaskMutation.mutateAsync({
          taskId: result.taskId,
          destColId: result.destColId,
          newPosition: result.newPosition,
          optimisticRows: result.newRows,
        });
      } catch {
        /* mutation onError が UI エラーを処理する */
      }
    },
    [boardIndexesRef, moveTaskMutation, rowsRef],
  );

  return { addTask, removeTask, copyTask, updateTask, moveTask };
}
