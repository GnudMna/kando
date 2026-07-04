import { useCallback } from "react";
import type { Task } from "../../types";
import * as api from "../../api/boardApi";
import { POSITION_GAP } from "../../utils/constants";
import type { BoardActionContext } from "./types";

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
  const addTask = useCallback(
    async (colId: number, rowId: number): Promise<Task | null> => {
      try {
        const row = rowsRef.current.find((r) => r.id === rowId);
        const col = row?.columns.find((c) => c.id === colId);
        if (!col) return null;
        const position =
          col.tasks.length > 0
            ? col.tasks[col.tasks.length - 1].position + POSITION_GAP
            : POSITION_GAP;
        const newTask = await api.createTask(colId, "新しいタスク", position);
        setRows((prev) =>
          prev.map((r) =>
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
        return newTask;
      } catch (err) {
        console.error(err);
        setOperationError("タスクの追加に失敗しました");
        return null;
      }
    },
    [rowsRef, setRows, setOperationError],
  );

  const removeTask = useCallback(
    async (colId: number, taskId: number) => {
      try {
        await api.deleteTask(taskId);
        setRows((prev) =>
          prev.map((r) => ({
            ...r,
            columns: r.columns.map((c) =>
              c.id === colId
                ? { ...c, tasks: c.tasks.filter((t) => t.id !== taskId) }
                : c,
            ),
          })),
        );
      } catch (err) {
        console.error(err);
        setOperationError("タスクの削除に失敗しました");
      }
    },
    [setRows, setOperationError],
  );

  const copyTask = useCallback(
    async (colId: number, taskId: number): Promise<Task | null> => {
      try {
        const copied = await api.copyTask(taskId);
        setRows((prev) =>
          prev.map((r) => ({
            ...r,
            columns: r.columns.map((c) =>
              c.id === colId ? { ...c, tasks: [...c.tasks, copied] } : c,
            ),
          })),
        );
        return copied;
      } catch (err) {
        console.error(err);
        setOperationError("タスクのコピーに失敗しました");
        return null;
      }
    },
    [setRows, setOperationError],
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
      taskId: number,
    ) => {
      const rows = rowsRef.current;
      const indexMap = boardIndexesRef.current.columnLocationByDroppableId;
      const srcInfo = indexMap.get(srcDroppableId);
      const dstInfo = indexMap.get(dstDroppableId);
      if (!srcInfo || !dstInfo) return;

      const srcRow = rows[srcInfo.rowIndex];
      const dstRow = rows[dstInfo.rowIndex];
      if (!srcRow || !dstRow) return;

      const srcCol = srcRow.columns[srcInfo.columnIndex];
      const dstCol = dstRow.columns[dstInfo.columnIndex];
      if (!srcCol || !dstCol) return;

      const isSameCol = srcDroppableId === dstDroppableId;
      const maxDstIndex = isSameCol
        ? srcCol.tasks.length - 1
        : dstCol.tasks.length;
      if (
        srcIndex < 0 ||
        srcIndex >= srcCol.tasks.length ||
        dstIndex < 0 ||
        dstIndex > maxDstIndex
      ) {
        return;
      }

      const prevRows = rows;
      const srcTasks = [...srcCol.tasks];
      const dstTasks = isSameCol ? srcTasks : [...dstCol.tasks];
      const destColId = dstCol.id;

      const [movedTask] = srcTasks.splice(srcIndex, 1);
      if (!movedTask) return;
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

      setRows(newRows);

      try {
        await api.moveTask(taskId, destColId, newPosition);
      } catch (err) {
        console.error("Failed to move task:", err);
        setRows(prevRows);
        setOperationError("タスクの移動に失敗しました");
      }
    },
    [boardIndexesRef, rowsRef, setRows, setOperationError],
  );

  return { addTask, removeTask, copyTask, updateTask, moveTask };
}
