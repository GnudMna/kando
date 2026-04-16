// かんばんボードの状態管理カスタムフック
// rows（行）の CRUD・タスクの移動など、ボード操作全般のロジックを提供する
import { useState, useEffect, useCallback, useRef } from 'react';
import type { Row, Task } from '../types';
import * as api from '../api/boardApi';

// タスク・カラム・行の position 間隔。新規追加時はこの値を加算する
const POSITION_GAP = 1000;

/**
 * かんばんボードの状態管理カスタムフック。
 * rows の CRUD およびタスク移動のロジックを提供する。
 * マウント時に自動でボードデータを取得する。
 * @returns ボード操作に必要な state とハンドラーのコレクション
 */
export function useBoard() {
  const [rows, setRows] = useState<Row[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [operationError, setOperationError] = useState<string | null>(null);
  // 最新の rows を ref で保持し、コールバックの deps から rows を除去する
  const rowsRef = useRef<Row[]>([]);
  useEffect(() => {
    rowsRef.current = rows;
  }, [rows]);

  const clearError = useCallback(() => setOperationError(null), []);

  /**
   * API からボードデータを取得して rows を更新する。
   * 失敗時はコンソールエラーのみ出力し UI は維持する。
   */
  const loadBoard = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await api.fetchBoard();
      setRows(data);
    } catch (err) {
      console.error('Failed to fetch board:', err);
      setOperationError('ボードの読み込みに失敗しました');
    } finally {
      setIsLoading(false);
    }
  }, []);

  // マウント時に一度だけボードデータを読み込む
  useEffect(() => {
    void loadBoard();
  }, [loadBoard]);

  /**
   * 新しい行を作成する。デフォルトで「未着手」「進行中」「完了」の 3 カラムを自動作成する。
   * @param title - 行のタイトル
   */
  const addRow = useCallback(async (title: string) => {
    try {
      const rows = rowsRef.current;
      const position =
        rows.length > 0 ? rows[rows.length - 1].position + POSITION_GAP : POSITION_GAP;
      const newRow = await api.createRow(title, position);
      const defaultStatuses = ['未着手', '進行中', '完了'];
      const newColumns = await Promise.all(
        defaultStatuses.map((statusTitle, i) =>
          api
            .createColumn(statusTitle, (i + 1) * POSITION_GAP, newRow.id)
            .then((col) => ({ ...col, tasks: [] }))
        )
      );
      setRows((prev) => [...prev, { ...newRow, columns: newColumns }]);
    } catch (err) {
      console.error(err);
      setOperationError('行の追加に失敗しました');
    }
  }, []);

  /**
   * 行のタイトルを変更する。
   * @param rowId - 対象行 ID
   * @param title - 新たなタイトル
   */
  const renameRow = useCallback(async (rowId: number, title: string) => {
    try {
      await api.updateRow(rowId, title);
      setRows((prev) =>
        prev.map((r) => (r.id === rowId ? { ...r, title } : r))
      );
    } catch (err) {
      console.error(err);
      setOperationError('行名の変更に失敗しました');
    }
  }, []);

  /**
   * 行を削除する（配下のカラム・タスクも連鎖削除）。
   * @param rowId - 削除対象の行 ID
   */
  const removeRow = useCallback(async (rowId: number) => {
    try {
      await api.deleteRow(rowId);
      setRows((prev) => prev.filter((r) => r.id !== rowId));
    } catch (err) {
      console.error(err);
      setOperationError('行の削除に失敗しました');
    }
  }, []);

  /**
   * 指定した行に新しいカラムを追加する。
   * position は既存カラムの最大 position + 1000 となる。
   * @param rowId - カラムを追加する行 ID
   * @param title - 新たなカラムタイトル
   */
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
              : r
          )
        );
      } catch (err) {
        console.error(err);
        setOperationError('カラムの追加に失敗しました');
      }
    },
    []
  );

  /**
   * カラムのタイトルを変更する。
   * @param colId - 対象カラム ID
   * @param title - 新たなタイトル
   */
  const renameColumn = useCallback(async (colId: number, title: string) => {
    try {
      await api.updateColumn(colId, title);
      setRows((prev) =>
        prev.map((r) => ({
          ...r,
          columns: r.columns.map((c) => (c.id === colId ? { ...c, title } : c)),
        }))
      );
    } catch (err) {
      console.error(err);
      setOperationError('カラム名の変更に失敗しました');
    }
  }, []);

  /**
   * カラムを削除する（配下タスクも連鎖削除）。
   * @param colId - 削除対象のカラム ID
   */
  const removeColumn = useCallback(async (colId: number) => {
    try {
      await api.deleteColumn(colId);
      setRows((prev) =>
        prev.map((r) => ({
          ...r,
          columns: r.columns.filter((c) => c.id !== colId),
        }))
      );
    } catch (err) {
      console.error(err);
      setOperationError('カラムの削除に失敗しました');
    }
  }, []);

  /**
   * 指定カラムにタスクを追加し、新規タスクを返す。
   * 呼び出し元は返値を使って編集モーダルを開けることができる。
   * @param colId - タスクを追加するカラム ID
   * @param rowId - カラムが所属する行 ID
   * @returns 作成された Task、カラムが見つからない場合は null
   */
  const addTask = useCallback(
    async (colId: number, rowId: number): Promise<Task | null> => {
      try {
        const row = rowsRef.current.find((r) => r.id === rowId);
        const col = row?.columns.find((c) => c.id === colId);
        if (!col) return null;
        const position =
          col.tasks.length > 0 ? col.tasks[col.tasks.length - 1].position + POSITION_GAP : POSITION_GAP;
        const newTask = await api.createTask(colId, '新しいタスク', position);
        setRows((prev) =>
          prev.map((r) =>
            r.id === rowId
              ? {
                  ...r,
                  columns: r.columns.map((c) =>
                    c.id === colId ? { ...c, tasks: [...c.tasks, newTask] } : c
                  ),
                }
              : r
          )
        );
        return newTask;
      } catch (err) {
        console.error(err);
        setOperationError('タスクの追加に失敗しました');
        return null;
      }
    },
    []
  );

  /**
   * タスクを削除して state からも取り除く。
   * @param colId - タスクが属するカラム ID
   * @param taskId - 削除するタスク ID
   */
  const removeTask = useCallback(async (colId: number, taskId: number) => {
    try {
      await api.deleteTask(taskId);
      setRows((prev) =>
        prev.map((r) => ({
          ...r,
          columns: r.columns.map((c) =>
            c.id === colId
              ? { ...c, tasks: c.tasks.filter((t) => t.id !== taskId) }
              : c
          ),
        }))
      );
    } catch (err) {
      console.error(err);
      setOperationError('タスクの削除に失敗しました');
    }
  }, []);

  /**
   * state 内の特定タスクを更新済みデータに置き換える。
   * API 呼び出しは呼び出し側が完了後に呼び出すこと。
   * @param updatedTask - 更新済み Task オブジェクト
   */
  const updateTask = useCallback((updatedTask: Task) => {
    setRows((prev) =>
      prev.map((r) => ({
        ...r,
        columns: r.columns.map((c) => ({
          ...c,
          tasks: c.tasks.map((t) =>
            t.id === updatedTask.id ? updatedTask : t
          ),
        })),
      }))
    );
  }, []);

  /**
   * タスクをドラッグ&ドロップで別カラムへ移動する。
   * 楽観的更新で UI を即時反映し、API 失敗時は元の state にロールバックする。
   * @param srcDroppableId - 移動元カラム ID 文字列
   * @param dstDroppableId - 移動先カラム ID 文字列
   * @param srcIndex - 移動元のタスクリスト内インデックス
   * @param dstIndex - 移動先のタスクリスト内インデックス
   * @param taskId - 移動するタスク ID
   */
  const moveTask = useCallback(
    async (
      srcDroppableId: string,
      dstDroppableId: string,
      srcIndex: number,
      dstIndex: number,
      taskId: number
    ) => {
      // カラム ID 文字列から rows 内の位置（行インデックス・列インデックス）を探す
      const rows = rowsRef.current;
      const findCol = (id: string) => {
        for (const row of rows) {
          const idx = row.columns.findIndex((c) => c.id.toString() === id);
          if (idx !== -1) return { ri: rows.indexOf(row), ci: idx };
        }
        return null;
      };

      const srcInfo = findCol(srcDroppableId);
      const dstInfo = findCol(dstDroppableId);
      if (!srcInfo || !dstInfo) return;

      // 楽観的更新用に現在の state を退避しておく
      const prevRows = rows;
      const newRows = structuredClone(rows) as Row[];
      const srcTasks = newRows[srcInfo.ri].columns[srcInfo.ci].tasks;
      const isSameCol = srcDroppableId === dstDroppableId;
      const dstTasks = isSameCol
        ? srcTasks
        : newRows[dstInfo.ri].columns[dstInfo.ci].tasks;

      // 移動元から取り出して移動先に挿入する
      const [movedTask] = srcTasks.splice(srcIndex, 1);
      dstTasks.splice(dstIndex, 0, movedTask);

      // 移動後のタスクに連番の position を振り直す
      const updatedDstTasks = dstTasks.map((t, i) => ({
        ...t,
        position: (i + 1) * POSITION_GAP,
      }));
      newRows[dstInfo.ri].columns[dstInfo.ci].tasks = updatedDstTasks;
      if (!isSameCol) {
        newRows[srcInfo.ri].columns[srcInfo.ci].tasks = srcTasks.map(
          (t, i) => ({ ...t, position: (i + 1) * POSITION_GAP })
        );
      }
      setRows(newRows);

      const destColId = newRows[dstInfo.ri].columns[dstInfo.ci].id;
      try {
        await api.moveTask(
          taskId,
          destColId,
          updatedDstTasks[dstIndex].position
        );
      } catch (err) {
        // API 失敗時は元の state に戻す（楽観的更新のロールバック）
        console.error('Failed to move task:', err);
        setRows(prevRows);
        setOperationError('タスクの移動に失敗しました');
      }
    },
    []
  );

  return {
    rows,
    isLoading,
    operationError,
    clearError,
    addRow,
    renameRow,
    removeRow,
    addColumn,
    renameColumn,
    removeColumn,
    addTask,
    removeTask,
    updateTask,
    moveTask,
  };
}
