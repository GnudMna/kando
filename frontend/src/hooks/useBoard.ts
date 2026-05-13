// かんばんボードの状態管理カスタムフック
// rows（行）の CRUD・タスクの移動など、ボード操作全般のロジックを提供する
import { useState, useEffect, useCallback, useRef } from "react";
import type { Row, Task } from "../types";
import * as api from "../api/boardApi";

// タスク・カラム・行の position 間隔。新規追加時はこの値を加算する
const POSITION_GAP = 1000;

type ColumnLocation = {
  rowIndex: number;
  columnIndex: number;
};

type BoardIndexes = {
  rowIndexById: Map<number, number>;
  columnLocationByDroppableId: Map<string, ColumnLocation>;
};

/**
 * 行配列から検索用インデックスを構築する。
 * @param rows - ボード行配列
 * @returns 行 ID とドロップ領域 ID を高速参照するためのインデックス
 */
function buildBoardIndexes(rows: Row[]): BoardIndexes {
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
  // 最新の rows と派生インデックスを ref で保持し、コールバックの deps から rows を除去する
  const rowsRef = useRef<Row[]>([]);
  const boardIndexesRef = useRef<BoardIndexes>({
    rowIndexById: new Map<number, number>(),
    columnLocationByDroppableId: new Map<string, ColumnLocation>(),
  });

  useEffect(() => {
    rowsRef.current = rows;
    boardIndexesRef.current = buildBoardIndexes(rows);
  }, [rows]);

  const clearError = useCallback(() => setOperationError(null), []);

  /**
   * API からボードデータを取得して rows を更新する。
   * 失敗時はコンソールエラーのみ出力し UI は維持する。
   * @returns 読み込み完了時に解決される Promise
   */
  const loadBoard = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await api.fetchBoard();
      setRows(data);
    } catch (err) {
      console.error("Failed to fetch board:", err);
      setOperationError("ボードの読み込みに失敗しました");
    } finally {
      setIsLoading(false);
    }
  }, []);

  // マウント時に一度だけボードデータを読み込む
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadBoard();
  }, [loadBoard]);

  /**
   * 新しい行を作成する。行とデフォルト3カラムをバックエンドで一括作成する。
   * @param title - 行のタイトル
   * @returns 作成処理完了時に解決される Promise
   */
  const addRow = useCallback(async (title: string) => {
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
  }, []);

  /**
   * 行のタイトルを変更する。
   * @param rowId - 対象行 ID
   * @param title - 新たなタイトル
   * @returns 更新完了時に解決される Promise
   */
  const renameRow = useCallback(async (rowId: number, title: string) => {
    try {
      await api.updateRow(rowId, title);
      setRows((prev) =>
        prev.map((r) => (r.id === rowId ? { ...r, title } : r)),
      );
    } catch (err) {
      console.error(err);
      setOperationError("行名の変更に失敗しました");
    }
  }, []);

  /**
   * 行を削除する（配下のカラム・タスクも連鎖削除）。
   * @param rowId - 削除対象の行 ID
   * @returns 削除完了時に解決される Promise
   */
  const removeRow = useCallback(async (rowId: number) => {
    try {
      await api.deleteRow(rowId);
      setRows((prev) => prev.filter((r) => r.id !== rowId));
    } catch (err) {
      console.error(err);
      setOperationError("行の削除に失敗しました");
    }
  }, []);

  /**
   * 指定した行に新しいカラムを追加する。
   * position は既存カラムの最大 position + 1000 となる。
   * @param rowId - カラムを追加する行 ID
   * @param title - 新たなカラムタイトル
   * @returns 追加完了時に解決される Promise
   */
  const addColumn = useCallback(async (rowId: number, title: string) => {
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
  }, []);

  /**
   * カラムのタイトルを変更する。
   * @param colId - 対象カラム ID
   * @param title - 新たなタイトル
   * @returns 更新完了時に解決される Promise
   */
  const renameColumn = useCallback(async (colId: number, title: string) => {
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
  }, []);

  /**
   * カラムを削除する（配下タスクも連鎖削除）。
   * @param colId - 削除対象のカラム ID
   * @returns 削除完了時に解決される Promise
   */
  const removeColumn = useCallback(async (colId: number) => {
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
    [],
  );

  /**
   * タスクを削除して state からも取り除く。
   * @param colId - タスクが属するカラム ID
   * @param taskId - 削除するタスク ID
   * @returns 削除完了時に解決される Promise
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
              : c,
          ),
        })),
      );
    } catch (err) {
      console.error(err);
      setOperationError("タスクの削除に失敗しました");
    }
  }, []);

  /**
   * タスクをコピーして同一カラムの末尾に追加する。
   * @param colId - タスクが属するカラム ID
   * @param taskId - コピー元タスク ID
   * @returns 複製されたタスク、失敗時は null
   */
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
    [],
  );

  /**
   * state 内の特定タスクを更新済みデータに置き換える。
   * API 呼び出しは呼び出し側が完了後に呼び出すこと。
   * @param updatedTask - 更新済み Task オブジェクト
   * @returns なし
   */
  const updateTask = useCallback((updatedTask: Task) => {
    setRows((prev) =>
      prev.map((r) => ({
        ...r,
        columns: r.columns.map((c) => ({
          ...c,
          tasks: c.tasks.map((t) =>
            t.id === updatedTask.id ? updatedTask : t,
          ),
        })),
      })),
    );
  }, []);

  /**
   * カラムをドラッグ&ドロップで同一行内で並び替える。
   * 楽観的更新で UI を即時反映し、API 失敗時は元の state にロールバックする。
   * @param rowId - カラムが属する行 ID
   * @param srcIndex - 移動元カラムインデックス
   * @param dstIndex - 移動先カラムインデックス
   * @param colId - 移動するカラム ID
   * @returns 移動処理完了時に解決される Promise
   */
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
    [],
  );

  /**
   * タスクをドラッグ&ドロップで別カラムへ移動する。
   * 楽観的更新で UI を即時反映し、API 失敗時は元の state にロールバックする。
   * @param srcDroppableId - 移動元カラム ID 文字列
   * @param dstDroppableId - 移動先カラム ID 文字列
   * @param srcIndex - 移動元のタスクリスト内インデックス
   * @param dstIndex - 移動先のタスクリスト内インデックス
   * @param taskId - 移動するタスク ID
   * @returns 移動処理完了時に解決される Promise
   */
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

      // 楽観的更新用に現在の state を退避しておく
      const prevRows = rows;
      const srcTasks = [...srcCol.tasks];
      const dstTasks = isSameCol ? srcTasks : [...dstCol.tasks];
      const destColId = dstCol.id;

      // 移動元から取り出して移動先に挿入する
      const [movedTask] = srcTasks.splice(srcIndex, 1);
      if (!movedTask) return;
      dstTasks.splice(dstIndex, 0, movedTask);

      // 移動後の隣タスクの position から中間値を計算する（他のタスクは変更しない）
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
        // API 失敗時は元の state に戻す（楽観的更新のロールバック）
        console.error("Failed to move task:", err);
        setRows(prevRows);
        setOperationError("タスクの移動に失敗しました");
      }
    },
    [],
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
    copyTask,
    updateTask,
    moveTask,
    moveColumn,
  };
}
