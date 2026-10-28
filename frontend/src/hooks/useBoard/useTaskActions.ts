import { useMutation } from "@tanstack/react-query";
import { useCallback } from "react";
import type { Row, Task } from "../../types";
import {
  copyTask as copyTaskApi,
  createTask,
  deleteTask,
  moveTask as moveTaskApi,
  saveTaskSnapshot,
  type TaskSnapshotPayload,
} from "../../api/tasks";
import { queryKeys } from "../../api/queryKeys";
import { POSITION_GAP } from "../../utils/constants";
import { isTaskSummary } from "../../utils/taskSummary";
import { applyTaskPositions } from "./boardCache";
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
}: BoardActionContext) {
  const { queryClient, setBoardRows, getBoardRows, onMutationError } =
    useBoardMutationContext();

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
    onSuccess: ({ id, position, rebalanced = [] }) => {
      // サーバーは衝突時に並び全体を振り直すため、確定した position を反映する
      setBoardRows((rows) =>
        applyTaskPositions(rows, [{ id, position }, ...rebalanced]),
      );
    },
    onError: (err, _variables, context) => {
      if (context?.prevRows) {
        setRows(context.prevRows);
      }
      onMutationError("タスクの移動に失敗しました")(err);
    },
  });

  /**
   * 編集モーダルの内容からタスクを新規作成する。
   * 保存操作の時点で初めてサーバーへ作成するため、モーダルを破棄しても空のタスクは残らない。
   * 作成後のスナップショット保存に失敗した場合は、作成したタスクを削除して呼び出し元へ再スローする。
   * @param colId - 追加先カラム ID
   * @param rowId - 追加先行 ID
   * @param payload - モーダルの保存ペイロード(`revision` は作成結果で置き換える)
   * @returns 保存後のタスク
   * @throws Error 追加先が見つからない場合、または作成・保存に失敗した場合
   */
  const createTaskFromSnapshot = useCallback(
    async (
      colId: number,
      rowId: number,
      payload: TaskSnapshotPayload,
    ): Promise<Task> => {
      const row = rowsRef.current.find((r) => r.id === rowId);
      const col = row?.columns.find((c) => c.id === colId);
      if (!col) throw new Error("追加先のカラムが見つかりません");
      const position =
        col.tasks.length > 0
          ? col.tasks[col.tasks.length - 1].position + POSITION_GAP
          : POSITION_GAP;

      const { rebalanced = [], ...created } = await createTask(
        colId,
        payload.content,
        position,
        payload.due_date,
      );
      let saved: Task;
      try {
        saved = await saveTaskSnapshot(created.id, {
          ...payload,
          revision: created.revision,
        });
      } catch (err) {
        await deleteTask(created.id).catch(() => {
          /* 削除にも失敗した場合は元のエラーを優先する */
        });
        throw err;
      }

      setBoardRows((rows) =>
        applyTaskPositions(
          rows.map((r) =>
            r.id === rowId
              ? {
                  ...r,
                  columns: r.columns.map((c) =>
                    c.id === colId ? { ...c, tasks: [...c.tasks, saved] } : c,
                  ),
                }
              : r,
          ),
          rebalanced,
        ),
      );
      return saved;
    },
    [rowsRef, setBoardRows],
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
      // 遅延読み込み用の詳細キャッシュが編集前の内容を保持しないよう同期する
      if (!isTaskSummary(updatedTask)) {
        queryClient.setQueryData(
          queryKeys.tasks.detail(updatedTask.id),
          updatedTask,
        );
      }
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
    [boardIndexesRef, queryClient, setRows],
  );

  /**
   * 最新の state 上のタスクへ差分更新を適用する。
   * 非同期応答の到着時点のタスクを基に組み立てるため、
   * 連続操作で先行する更新を古い task の再構築で上書きしない。
   * @param taskId - 対象タスク ID
   * @param updater - 直前のタスクから更新後のタスクを返す関数
   */
  const patchTask = useCallback(
    (taskId: number, updater: (prev: Task) => Task) => {
      queryClient.setQueryData<Task>(
        queryKeys.tasks.detail(taskId),
        (old) => old && updater(old),
      );
      setRows((prev) =>
        prev.map((r) => ({
          ...r,
          columns: r.columns.map((c) =>
            c.tasks.some((t) => t.id === taskId)
              ? {
                  ...c,
                  tasks: c.tasks.map((t) => (t.id === taskId ? updater(t) : t)),
                }
              : c,
          ),
        })),
      );
    },
    [queryClient, setRows],
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

  return {
    createTaskFromSnapshot,
    removeTask,
    copyTask,
    updateTask,
    patchTask,
    moveTask,
  };
}
