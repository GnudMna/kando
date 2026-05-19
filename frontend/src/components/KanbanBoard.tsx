// かんばんボードのメインコンポーネント
// 行・カラム・タスクのレンダリング、ドラッグ＆ドロップ、各種操作ダイアログを管理する
import {
  useState,
  useCallback,
  useMemo,
  useEffect,
  useId,
  lazy,
  Suspense,
} from "react";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";
import type { DropResult } from "@hello-pangea/dnd";
import { createPortal } from "react-dom";
import {
  Plus,
  Trash2,
  LayoutTemplate,
  List,
  Search,
  AlertCircle,
  X,
  GripVertical,
} from "lucide-react";
import { TaskCard } from "./TaskCard";
import { ConfirmDialog } from "./ConfirmDialog";

const TaskEditModal = lazy(() =>
  import("./TaskEditModal").then((m) => ({ default: m.TaskEditModal })),
);
const ListView = lazy(() =>
  import("./ListView").then((m) => ({ default: m.ListView })),
);
import { useBoard } from "../hooks/useBoard";
import type { Row, Task } from "../types";
import { getDueHighlight } from "../utils/dueDate";
import type { DueHighlightResult } from "../utils/dueDate";
import { countTasks, filterRowsByTaskQuery } from "../utils/taskSearch";

const taskDragPortalTarget =
  typeof document !== "undefined" ? document.body : null;
const DUE_SOON_DAYS_STORAGE_KEY = "kando-due-soon-days";
const DEFAULT_DUE_SOON_DAYS = 3;
const MAX_DUE_SOON_DAYS = 30;

/**
 * 期限間近の設定値を UI で扱う範囲へ正規化する。
 * @param value - 入力値
 * @returns 0 以上 MAX 以下の整数日
 */
function normalizeDueSoonDays(value: number): number {
  if (!Number.isFinite(value)) return DEFAULT_DUE_SOON_DAYS;
  return Math.max(0, Math.min(MAX_DUE_SOON_DAYS, Math.floor(value)));
}

// 現在編集中のタスクとそのカラム ID を保持する型
interface EditingTask {
  task: Task;
  colId: number;
  isNew: boolean;
}

// インライン編集中の行・カラムの ID とタイトルを保持する型
interface InlineEditState {
  id: number;
  title: string;
}

// 確認ダイアログの表示内容とコールバックを保持する型
interface ConfirmState {
  message: string;
  onConfirm: () => void;
}

/**
 * かんばんボードのメインコンポーネント。
 * 行・カラム・タスクのレンダリング、ドラッグ&ドロップ操作、カンバンビュー・リストビューの切り替え、
 * タスク編集モーダルおよび削除確認ダイアログの表示を管理する。
 * @returns かんばんボード UI の JSX 要素
 */
export function KanbanBoard() {
  const {
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
  } = useBoard();

  const [viewMode, setViewMode] = useState<"kanban" | "list">("kanban");
  const [searchQuery, setSearchQuery] = useState("");
  const [dueSoonDays, setDueSoonDays] = useState<number>(() => {
    if (typeof window === "undefined") return DEFAULT_DUE_SOON_DAYS;
    const stored = window.localStorage.getItem(DUE_SOON_DAYS_STORAGE_KEY);
    if (stored === null) return DEFAULT_DUE_SOON_DAYS;
    return normalizeDueSoonDays(Number(stored));
  });
  const [editingTask, setEditingTask] = useState<EditingTask | null>(null);
  // インライン編集中の行・カラムを管理する
  const [editingRow, setEditingRow] = useState<InlineEditState | null>(null);
  const [editingCol, setEditingCol] = useState<InlineEditState | null>(null);
  // 確認ダイアログの表示状態を管理する
  const [confirmState, setConfirmState] = useState<ConfirmState | null>(null);
  const dueSoonDaysInputId = useId();
  const taskSearchInputId = useId();

  const taskDueHighlights = useMemo(() => {
    const map = new Map<number, DueHighlightResult>();
    for (const row of rows) {
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
  }, [rows, dueSoonDays]);

  const filteredRows = useMemo(
    () => filterRowsByTaskQuery(rows, searchQuery),
    [rows, searchQuery],
  );
  const isSearchActive = searchQuery.trim().length > 0;
  const activeRows = isSearchActive ? filteredRows : rows;
  const activeViewMode = isSearchActive ? "list" : viewMode;
  const matchedTaskCount = useMemo(
    () => countTasks(filteredRows),
    [filteredRows],
  );

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(DUE_SOON_DAYS_STORAGE_KEY, String(dueSoonDays));
  }, [dueSoonDays]);

  /**
   * 確認ダイアログを表示するヘルパー。
   * @param message - 確認メッセージ
   * @param onConfirm - 確定時のコールバック
   * @returns なし
   */
  const confirmAction = useCallback(
    (message: string, onConfirm: () => void) => {
      setConfirmState({ message, onConfirm });
    },
    [],
  );

  /**
   * 確認ダイアログの「削除する」ボタン押下時のハンドラー。
   * コールバックを実行してダイアログを閉じる。
   * @returns なし
   */
  const handleConfirm = useCallback(() => {
    confirmState?.onConfirm();
    setConfirmState(null);
  }, [confirmState]);

  /**
   * @hello-pangea/dnd のドラッグ終了イベントハンドラー。
   * ドロップ先が有効な場合のみタスク移動を実行する。
   * @param result - DnDライブラリから渡される DropResult
   * @returns ドラッグ処理完了時に解決される Promise
   */
  const handleDragEnd = useCallback(
    async (result: DropResult) => {
      const { destination, source, draggableId, type } = result;
      if (!destination) return;
      if (
        destination.droppableId === source.droppableId &&
        destination.index === source.index
      )
        return;

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

  /**
   * 行追加ダイアログを表示して新しい行を作成する。
   * @returns 追加処理完了時に解決される Promise
   */
  const handleAddRow = useCallback(async () => {
    const title = prompt("行のタイトルを入力してください");
    if (!title) return;
    await addRow(title);
  }, [addRow]);

  /**
   * カラム名入力ダイアログを表示して新しいカラムを追加する。
   * @param rowId - カラムを追加する行 ID
   * @returns 追加処理完了時に解決される Promise
   */
  const handleAddColumn = useCallback(
    async (rowId: number) => {
      const title = prompt("ステータス名を入力してください");
      if (!title) return;
      await addColumn(rowId, title);
    },
    [addColumn],
  );

  /**
   * 行名インライン編集を確定する。内容が空の場合は保存しない。
   * @returns 保存処理完了時に解決される Promise
   */
  const handleSaveRowTitle = useCallback(async () => {
    if (!editingRow) return;
    const title = editingRow.title.trim();
    if (title) await renameRow(editingRow.id, title);
    setEditingRow(null);
  }, [editingRow, renameRow]);

  /**
   * カラム名インライン編集を確定する。内容が空の場合は保存しない。
   * @returns 保存処理完了時に解決される Promise
   */
  const handleSaveColTitle = useCallback(async () => {
    if (!editingCol) return;
    const title = editingCol.title.trim();
    if (title) await renameColumn(editingCol.id, title);
    setEditingCol(null);
  }, [editingCol, renameColumn]);

  /**
   * タスクを追加して編集モーダルを自動開く。
   * @param colId - タスクを追加するカラム ID
   * @param rowId - カラムが所属する行 ID
   * @returns 追加処理完了時に解決される Promise
   */
  const handleAddTask = useCallback(
    async (colId: number, rowId: number) => {
      const newTask = await addTask(colId, rowId);
      if (newTask) setEditingTask({ task: newTask, colId, isNew: true });
    },
    [addTask],
  );

  /**
   * タスク削除ハンドラー。
   * @param colId - タスクが属するカラム ID
   * @param taskId - 削除するタスク ID
   * @returns 削除処理完了時に解決される Promise
   */
  const handleDeleteTask = useCallback(
    async (colId: number, taskId: number) => {
      await removeTask(colId, taskId);
    },
    [removeTask],
  );

  /**
   * タスクコピーハンドラー。
   * @param colId - タスクが属するカラム ID
   * @param taskId - コピー元タスク ID
   * @returns コピー処理完了時に解決される Promise
   */
  const handleCopyTask = useCallback(
    async (colId: number, taskId: number) => {
      await copyTask(colId, taskId);
    },
    [copyTask],
  );

  /**
   * タスク編集モーダルを開くハンドラー。安定した参照を保持し TaskCard の memo を有効にする。
   * @param task - 編集対象タスク
   * @param colId - タスクが属するカラム ID
   * @returns なし
   */
  const handleEditTask = useCallback((task: Task, colId: number) => {
    setEditingTask({ task, colId, isNew: false });
  }, []);

  // MemoPanel からの kando:open-task イベントでタスク編集モーダルを開く
  useEffect(() => {
    const handler = (e: Event) => {
      const taskId = (e as CustomEvent<{ taskId: number }>).detail.taskId;
      for (const row of rows) {
        for (const col of row.columns) {
          const task = col.tasks.find((t) => t.id === taskId);
          if (task) {
            setEditingTask({ task, colId: col.id, isNew: false });
            return;
          }
        }
      }
    };
    window.addEventListener("kando:open-task", handler);
    return () => window.removeEventListener("kando:open-task", handler);
  }, [rows]);

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

  /**
   * タスク編集モーダルを閉じる際の後処理を行う。
   * @param reason - 閉じた理由（保存済み / キャンセル）
   * @returns なし
   */
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

  /**
   * 行ヘッダー（タイトル編集と操作ボタン）を描画する。
   * @param row - 描画対象の行
   * @returns 行ヘッダーの JSX 要素
   */
  const renderRowHeader = (row: Row) => (
    <div className="board-row-header">
      {editingRow?.id === row.id ? (
        <input
          autoFocus
          className="board-row-title-input"
          value={editingRow.title}
          onChange={(e) =>
            setEditingRow({ ...editingRow, title: e.target.value })
          }
          onBlur={() => void handleSaveRowTitle()}
          onKeyDown={(e) => {
            if (e.key === "Enter") void handleSaveRowTitle();
            if (e.key === "Escape") setEditingRow(null);
          }}
        />
      ) : (
        <button
          type="button"
          className="board-row-title board-title-button"
          title="クリックして編集"
          onClick={() => setEditingRow({ id: row.id, title: row.title })}
        >
          {row.title}
        </button>
      )}
      <div className="board-row-header-actions">
        <button
          type="button"
          className="btn btn-compact"
          onClick={() => void handleAddColumn(row.id)}
        >
          <Plus size={14} /> ステータスを追加
        </button>
        <button
          type="button"
          className="action-btn"
          aria-label={`行「${row.title}」を削除`}
          onClick={() =>
            confirmAction(
              `「${row.title}」行を削除しますか？配下のすべてのタスクも削除されます。`,
              () => void removeRow(row.id),
            )
          }
        >
          <Trash2 size={16} />
        </button>
      </div>
    </div>
  );

  if (isLoading) {
    return <div className="kanban-wrapper kanban-loading">読み込み中…</div>;
  }

  return (
    <div className="kanban-wrapper">
      {operationError && (
        <div role="alert" className="board-error">
          <AlertCircle size={16} />
          <span className="board-error-message">{operationError}</span>
          <button
            type="button"
            onClick={clearError}
            className="board-error-close"
            aria-label="エラーを閉じる"
          >
            <X size={16} />
          </button>
        </div>
      )}

      <div className="board-toolbar">
        <button
          type="button"
          className="btn btn-primary"
          onClick={() => void handleAddRow()}
        >
          <Plus size={16} /> 行を追加
        </button>

        <div className="board-toolbar-right">
          <div className="task-search" role="search">
            <label htmlFor={taskSearchInputId} className="task-search-label">
              タスク検索
            </label>
            <div className="task-search-input-wrap">
              <Search size={14} className="task-search-icon" />
              <input
                id={taskSearchInputId}
                type="search"
                className="task-search-input"
                placeholder="タスク名・サブタスク・コメントで検索"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.currentTarget.value)}
              />
              {isSearchActive && (
                <button
                  type="button"
                  className="task-search-clear"
                  onClick={() => setSearchQuery("")}
                  aria-label="検索キーワードをクリア"
                >
                  <X size={14} />
                </button>
              )}
            </div>
          </div>

          <div className="due-soon-setting">
            <label htmlFor={dueSoonDaysInputId} className="due-soon-label">
              期限間近の強調
            </label>
            <div className="due-soon-input-wrap">
              <input
                id={dueSoonDaysInputId}
                type="number"
                min={0}
                max={MAX_DUE_SOON_DAYS}
                step={1}
                className="due-soon-input"
                value={dueSoonDays}
                onChange={(e) => {
                  const next = e.currentTarget.valueAsNumber;
                  if (Number.isNaN(next)) return;
                  setDueSoonDays(normalizeDueSoonDays(next));
                }}
              />
              <span className="due-soon-unit">日以内</span>
            </div>
          </div>

          <div className="board-stats" aria-label="ボード統計">
            <span className="stat-pill">
              <strong>{boardStats.rows}</strong> 行
            </span>
            <span className="stat-pill">
              <strong>{boardStats.columns}</strong> 列
            </span>
            <span className="stat-pill">
              <strong>{boardStats.tasks}</strong> タスク
            </span>
            {isSearchActive && (
              <span className="stat-pill">
                <strong>{matchedTaskCount}</strong> 件ヒット
              </span>
            )}
          </div>

          <div className="view-switch" role="tablist" aria-label="表示モード">
            <button
              type="button"
              className={`btn btn-toggle ${activeViewMode === "kanban" ? "btn-primary" : ""}`}
              onClick={() => setViewMode("kanban")}
              aria-pressed={activeViewMode === "kanban"}
              disabled={isSearchActive}
              title={
                isSearchActive
                  ? "検索中はリスト表示のみ利用できます"
                  : undefined
              }
            >
              <LayoutTemplate size={16} /> かんばん
            </button>
            <button
              type="button"
              className={`btn btn-toggle ${activeViewMode === "list" ? "btn-primary" : ""}`}
              onClick={() => setViewMode("list")}
              aria-pressed={activeViewMode === "list"}
            >
              <List size={16} /> リスト
            </button>
          </div>

          {isSearchActive && (
            <p className="task-search-hint">
              検索中は並び順の整合性のためリスト表示に切り替わります。
            </p>
          )}
        </div>
      </div>

      {rows.length === 0 ? (
        <div className="board-empty-state">
          <p className="board-empty-title">まだ行がありません</p>
          <p className="board-empty-description">
            「行を追加」から最初のワークフローを作成しましょう。
          </p>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => void handleAddRow()}
          >
            <Plus size={16} /> 最初の行を追加
          </button>
        </div>
      ) : activeRows.length === 0 ? (
        <div className="board-empty-state">
          <p className="board-empty-title">該当するタスクがありません</p>
          <p className="board-empty-description">
            キーワードを変えるか、検索をクリアしてください。
          </p>
          <button
            type="button"
            className="btn"
            onClick={() => setSearchQuery("")}
          >
            <X size={16} /> 検索をクリア
          </button>
        </div>
      ) : activeViewMode === "kanban" ? (
        <DragDropContext onDragEnd={(r) => void handleDragEnd(r)}>
          <div className="kanban-rows">
            {activeRows.map((row) => (
              <div key={row.id} className="board-row">
                {renderRowHeader(row)}
                <Droppable
                  droppableId={`row-${row.id}`}
                  type="column"
                  direction="horizontal"
                >
                  {(colsProvided) => (
                    <div
                      className="board-row-columns"
                      ref={colsProvided.innerRef}
                      {...colsProvided.droppableProps}
                    >
                      {row.columns.map((column, colIndex) => (
                        <Draggable
                          key={column.id}
                          draggableId={`col-${column.id}`}
                          index={colIndex}
                        >
                          {(colProvided) => (
                            <div
                              className="column-container"
                              ref={colProvided.innerRef}
                              {...colProvided.draggableProps}
                            >
                              <div className="column-header">
                                <div
                                  {...colProvided.dragHandleProps}
                                  className="column-drag-handle"
                                  title="ドラッグして並び替え"
                                >
                                  <GripVertical size={14} />
                                </div>
                                {editingCol?.id === column.id ? (
                                  <input
                                    autoFocus
                                    className="column-title-input"
                                    value={editingCol.title}
                                    onChange={(e) =>
                                      setEditingCol({
                                        ...editingCol,
                                        title: e.target.value,
                                      })
                                    }
                                    onBlur={() => void handleSaveColTitle()}
                                    onKeyDown={(e) => {
                                      if (e.key === "Enter")
                                        void handleSaveColTitle();
                                      if (e.key === "Escape")
                                        setEditingCol(null);
                                    }}
                                  />
                                ) : (
                                  <button
                                    type="button"
                                    className="column-title board-title-button"
                                    title="クリックして編集"
                                    onClick={() =>
                                      setEditingCol({
                                        id: column.id,
                                        title: column.title,
                                      })
                                    }
                                  >
                                    {column.title}
                                  </button>
                                )}
                                <button
                                  type="button"
                                  className="action-btn"
                                  aria-label={`列「${column.title}」を削除`}
                                  onClick={() =>
                                    confirmAction(
                                      `「${column.title}」列を削除しますか？配下のすべてのタスクも削除されます。`,
                                      () => void removeColumn(column.id),
                                    )
                                  }
                                >
                                  <Trash2 size={16} />
                                </button>
                              </div>
                              <Droppable
                                droppableId={column.id.toString()}
                                type="task"
                              >
                                {(taskProvided) => (
                                  <div
                                    className="column-body"
                                    ref={taskProvided.innerRef}
                                    {...taskProvided.droppableProps}
                                  >
                                    {column.tasks.map((task, index) => (
                                      <Draggable
                                        draggableId={`task-${task.id}`}
                                        index={index}
                                        key={`task-${task.id}`}
                                      >
                                        {(
                                          taskDragProvided,
                                          taskDragSnapshot,
                                        ) => {
                                          const dueHighlight =
                                            taskDueHighlights.get(task.id) ??
                                            getDueHighlight(
                                              task.due_date,
                                              dueSoonDays,
                                              undefined,
                                              task.completed,
                                            );
                                          const dueTaskClass =
                                            dueHighlight.status === "none"
                                              ? ""
                                              : ` task-${dueHighlight.status}`;
                                          const completedClass = task.completed
                                            ? " task-completed"
                                            : "";
                                          const taskCardNode = (
                                            <div
                                              className={`task-card${taskDragSnapshot.isDragging ? " task-card-dragging" : ""}${dueTaskClass}${completedClass}`}
                                              ref={taskDragProvided.innerRef}
                                              {...taskDragProvided.draggableProps}
                                              {...taskDragProvided.dragHandleProps}
                                            >
                                              <TaskCard
                                                task={task}
                                                columnId={column.id}
                                                dueHighlight={dueHighlight}
                                                onDeleteTask={handleDeleteTask}
                                                onCopyTask={handleCopyTask}
                                                onTaskUpdated={updateTask}
                                                onEditTask={handleEditTask}
                                              />
                                            </div>
                                          );

                                          if (
                                            taskDragSnapshot.isDragging &&
                                            taskDragPortalTarget
                                          ) {
                                            return createPortal(
                                              taskCardNode,
                                              taskDragPortalTarget,
                                            );
                                          }

                                          return taskCardNode;
                                        }}
                                      </Draggable>
                                    ))}
                                    {taskProvided.placeholder}
                                  </div>
                                )}
                              </Droppable>
                              <div className="column-add-task">
                                <button
                                  type="button"
                                  className="btn column-add-task-btn"
                                  onClick={() =>
                                    void handleAddTask(column.id, row.id)
                                  }
                                >
                                  <Plus size={16} /> タスクを追加
                                </button>
                              </div>
                            </div>
                          )}
                        </Draggable>
                      ))}
                      {colsProvided.placeholder}
                    </div>
                  )}
                </Droppable>
              </div>
            ))}
          </div>
        </DragDropContext>
      ) : (
        <Suspense fallback={null}>
          <ListView
            rows={activeRows}
            taskDueHighlights={taskDueHighlights}
            onRowHeaderRender={renderRowHeader}
            onTaskClick={handleEditTask}
            onDeleteTask={handleDeleteTask}
            onAddTask={handleAddTask}
          />
        </Suspense>
      )}

      {editingTask && (
        <Suspense fallback={null}>
          <TaskEditModal
            task={editingTask.task}
            onClose={handleCloseTaskModal}
            onTaskUpdated={(updatedTask) => {
              updateTask(updatedTask);
            }}
          />
        </Suspense>
      )}

      {confirmState && (
        <ConfirmDialog
          message={confirmState.message}
          onConfirm={handleConfirm}
          onCancel={() => setConfirmState(null)}
        />
      )}
    </div>
  );
}
