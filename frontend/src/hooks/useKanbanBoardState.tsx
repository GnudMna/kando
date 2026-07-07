import {
  useState,
  useCallback,
  useMemo,
  useEffect,
  useRef,
  useDeferredValue,
} from "react";
import type { DropResult } from "@hello-pangea/dnd";
import type { Row, Task } from "../types";
import { fetchTask } from "../api/tasks";
import { getDueHighlight } from "../utils/dueDate";
import { countTasks } from "../utils/taskSearch";
import { taskNeedsDetailLoad } from "../utils/taskSummary";
import { useBoardSearch } from "./useBoard/useBoardSearch";
import type { useBoard } from "./useBoard";
import type {
  ConfirmState,
  EditingTask,
  InlineEditState,
} from "../components/kanban/types";
import { BoardRowHeader } from "../components/kanban/BoardRowHeader";
import {
  DEFAULT_DUE_SOON_DAYS,
  DUE_SOON_DAYS_STORAGE_KEY,
  normalizeDueSoonDays,
} from "../components/kanban/constants";
import { useAppNavigation } from "../providers/useAppNavigation";
import { useOperationError } from "../providers/useOperationError";

type BoardApi = ReturnType<typeof useBoard>;

/**
 * KanbanBoard の UI 状態と操作ハンドラーを管理する。
 * @param board - `useBoard` の戻り値
 * @returns ボード UI 向けの state とハンドラー
 */
export function useKanbanBoardState(board: BoardApi) {
  const {
    rows,
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
  } = board;

  const [viewMode, setViewMode] = useState<"kanban" | "list">("kanban");
  const [searchQuery, setSearchQuery] = useState("");
  const deferredSearchQuery = useDeferredValue(searchQuery);
  const [dueSoonDays, setDueSoonDays] = useState<number>(() => {
    if (typeof window === "undefined") return DEFAULT_DUE_SOON_DAYS;
    const stored = window.localStorage.getItem(DUE_SOON_DAYS_STORAGE_KEY);
    if (stored === null) return DEFAULT_DUE_SOON_DAYS;
    return normalizeDueSoonDays(Number(stored));
  });
  const [editingTask, setEditingTask] = useState<EditingTask | null>(null);
  const [editingRow, setEditingRow] = useState<InlineEditState | null>(null);
  const [isAddingRow, setIsAddingRow] = useState(false);
  const [newRowTitle, setNewRowTitle] = useState("");
  const [addingColumnRowId, setAddingColumnRowId] = useState<number | null>(
    null,
  );
  const [newColumnTitle, setNewColumnTitle] = useState("");
  const [confirmState, setConfirmState] = useState<ConfirmState | null>(null);
  const rowsRef = useRef(rows);
  const { registerOpenTaskHandler } = useAppNavigation();
  const { reportError } = useOperationError();

  useEffect(() => {
    rowsRef.current = rows;
  }, [rows]);

  const isSearchActive = searchQuery.trim().length > 0;
  const isDeferredSearchActive = deferredSearchQuery.trim().length > 0;
  const { searchRows, isSearchLoading } = useBoardSearch(deferredSearchQuery);
  const highlightSourceRows = isDeferredSearchActive ? searchRows : rows;

  const taskDueHighlights = useMemo(() => {
    const map = new Map<number, ReturnType<typeof getDueHighlight>>();
    for (const row of highlightSourceRows) {
      for (const column of row.columns) {
        for (const task of column.tasks) {
          map.set(
            task.id,
            getDueHighlight(
              task.due_date,
              dueSoonDays,
              undefined,
              task.completed,
            ),
          );
        }
      }
    }
    return map;
  }, [highlightSourceRows, dueSoonDays]);

  const activeRows = isDeferredSearchActive ? searchRows : rows;
  const activeViewMode = isSearchActive ? "list" : viewMode;
  const matchedTaskCount = useMemo(
    () => (isDeferredSearchActive ? countTasks(searchRows) : 0),
    [isDeferredSearchActive, searchRows],
  );

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(DUE_SOON_DAYS_STORAGE_KEY, String(dueSoonDays));
  }, [dueSoonDays]);

  const confirmAction = useCallback(
    (message: string, onConfirm: () => void) => {
      setConfirmState({ message, onConfirm });
    },
    [],
  );

  const handleConfirm = useCallback(() => {
    confirmState?.onConfirm();
    setConfirmState(null);
  }, [confirmState]);

  const handleDragEnd = useCallback(
    async (result: DropResult) => {
      const { destination, source, draggableId, type } = result;
      if (!destination) return;
      if (
        destination.droppableId === source.droppableId &&
        destination.index === source.index
      ) {
        return;
      }

      if (type === "column") {
        const colId = parseInt(draggableId.replace("col-", ""), 10);
        const rowId = parseInt(source.droppableId.replace("row-", ""), 10);
        await moveColumn(rowId, source.index, destination.index, colId);
        return;
      }

      const taskId = parseInt(draggableId.replace("task-", ""), 10);
      await moveTask(
        source.droppableId,
        destination.droppableId,
        source.index,
        destination.index,
        taskId,
      );
    },
    [moveTask, moveColumn],
  );

  const startAddRow = useCallback(() => {
    setAddingColumnRowId(null);
    setNewColumnTitle("");
    setIsAddingRow(true);
    setNewRowTitle("");
  }, []);

  const cancelAddRow = useCallback(() => {
    setIsAddingRow(false);
    setNewRowTitle("");
  }, []);

  const submitAddRow = useCallback(async () => {
    const title = newRowTitle.trim();
    if (!title) return;
    await addRow(title);
    cancelAddRow();
  }, [addRow, cancelAddRow, newRowTitle]);

  const startAddColumn = useCallback((rowId: number) => {
    setAddingColumnRowId(rowId);
    setNewColumnTitle("");
  }, []);

  const cancelAddColumn = useCallback(() => {
    setAddingColumnRowId(null);
    setNewColumnTitle("");
  }, []);

  const submitAddColumn = useCallback(async () => {
    if (addingColumnRowId === null) return;
    const title = newColumnTitle.trim();
    if (!title) return;
    await addColumn(addingColumnRowId, title);
    cancelAddColumn();
  }, [addColumn, addingColumnRowId, cancelAddColumn, newColumnTitle]);

  const handleSaveRowTitle = useCallback(async () => {
    if (!editingRow) return;
    const title = editingRow.title.trim();
    if (title) await renameRow(editingRow.id, title);
    setEditingRow(null);
  }, [editingRow, renameRow]);

  const handleAddTask = useCallback(
    async (colId: number, rowId: number) => {
      const newTask = await addTask(colId, rowId);
      if (newTask) setEditingTask({ task: newTask, colId, isNew: true });
    },
    [addTask],
  );

  const handleDeleteTask = useCallback(
    async (colId: number, taskId: number) => {
      await removeTask(colId, taskId);
    },
    [removeTask],
  );

  const handleCopyTask = useCallback(
    async (colId: number, taskId: number) => {
      await copyTask(colId, taskId);
    },
    [copyTask],
  );

  const handleEditTask = useCallback(
    async (task: Task, colId: number) => {
      if (taskNeedsDetailLoad(task)) {
        try {
          const full = await fetchTask(task.id);
          updateTask(full);
          setEditingTask({ task: full, colId, isNew: false });
          return;
        } catch (err) {
          reportError("タスク詳細の読み込みに失敗しました", err);
          return;
        }
      }
      setEditingTask({ task, colId, isNew: false });
    },
    [updateTask, reportError],
  );

  useEffect(() => {
    return registerOpenTaskHandler((taskId) => {
      for (const row of rowsRef.current) {
        for (const col of row.columns) {
          const task = col.tasks.find((t) => t.id === taskId);
          if (task) {
            void handleEditTask(task, col.id);
            return;
          }
        }
      }
    });
  }, [registerOpenTaskHandler, handleEditTask]);

  const boardStats = useMemo(() => {
    let totalColumns = 0;
    let totalTasks = 0;

    for (const row of rows) {
      totalColumns += row.columns.length;
      for (const column of row.columns) {
        totalTasks += column.tasks.length;
      }
    }

    return {
      rows: rows.length,
      columns: totalColumns,
      tasks: totalTasks,
    };
  }, [rows]);

  const handleCloseTaskModal = useCallback(
    (reason: "saved" | "dismiss") => {
      if (!editingTask) return;

      const shouldDeleteUnsavedTask = editingTask.isNew && reason !== "saved";
      const colId = editingTask.colId;
      const taskId = editingTask.task.id;

      setEditingTask(null);

      if (shouldDeleteUnsavedTask) {
        void removeTask(colId, taskId);
      }
    },
    [editingTask, removeTask],
  );

  const renderRowHeader = useCallback(
    (row: Row) => (
      <BoardRowHeader
        row={row}
        editingRow={editingRow}
        onEditingRowChange={setEditingRow}
        onSaveRowTitle={handleSaveRowTitle}
        addingColumnRowId={addingColumnRowId}
        newColumnTitle={newColumnTitle}
        onNewColumnTitleChange={setNewColumnTitle}
        onSubmitAddColumn={() => void submitAddColumn()}
        onCancelAddColumn={cancelAddColumn}
        onStartAddColumn={startAddColumn}
        onRemoveRow={removeRow}
        confirmAction={confirmAction}
      />
    ),
    [
      addingColumnRowId,
      cancelAddColumn,
      confirmAction,
      editingRow,
      handleSaveRowTitle,
      newColumnTitle,
      removeRow,
      startAddColumn,
      submitAddColumn,
    ],
  );

  return {
    viewMode,
    setViewMode,
    searchQuery,
    setSearchQuery,
    dueSoonDays,
    setDueSoonDays,
    editingTask,
    isAddingRow,
    newRowTitle,
    setNewRowTitle,
    confirmState,
    setConfirmState,
    taskDueHighlights,
    isSearchActive,
    isDeferredSearchActive,
    isSearchLoading,
    activeRows,
    activeViewMode,
    matchedTaskCount,
    boardStats,
    confirmAction,
    handleConfirm,
    handleDragEnd,
    startAddRow,
    cancelAddRow,
    submitAddRow,
    editingRow,
    setEditingRow,
    addingColumnRowId,
    newColumnTitle,
    setNewColumnTitle,
    submitAddColumn,
    cancelAddColumn,
    startAddColumn,
    handleSaveRowTitle,
    handleAddTask,
    handleDeleteTask,
    handleCopyTask,
    handleEditTask,
    handleCloseTaskModal,
    renderRowHeader,
    renameColumn,
    removeColumn,
    removeRow,
    updateTask,
  };
}
