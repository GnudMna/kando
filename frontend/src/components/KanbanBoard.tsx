// かんばんボードのメインコンポーネント
// 行・カラム・タスクのレンダリング、ドラッグ＆ドロップ、各種操作ダイアログを管理する
import { useState, useCallback, useMemo } from "react";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";
import type { DropResult } from "@hello-pangea/dnd";
import { createPortal } from "react-dom";
import {
  Plus,
  Trash2,
  LayoutTemplate,
  List,
  AlertCircle,
  X,
  GripVertical,
} from "lucide-react";
import { TaskCard } from "./TaskCard";
import { TaskEditModal } from "./TaskEditModal";
import { ConfirmDialog } from "./ConfirmDialog";
import { ListView } from "./ListView";
import { useBoard } from "../hooks/useBoard";
import type { Row, Task } from "../types";

const taskDragPortalTarget =
  typeof document !== "undefined" ? document.body : null;

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
    updateTask,
    moveTask,
    moveColumn,
  } = useBoard();

  const [viewMode, setViewMode] = useState<"kanban" | "list">("kanban");
  const [editingTask, setEditingTask] = useState<EditingTask | null>(null);
  // インライン編集中の行・カラムを管理する
  const [editingRow, setEditingRow] = useState<InlineEditState | null>(null);
  const [editingCol, setEditingCol] = useState<InlineEditState | null>(null);
  // 確認ダイアログの表示状態を管理する
  const [confirmState, setConfirmState] = useState<ConfirmState | null>(null);

  /**
   * 確認ダイアログを表示するヘルパー。
   * @param message - 確認メッセージ
   * @param onConfirm - 確定時のコールバック
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
   */
  const handleConfirm = useCallback(() => {
    confirmState?.onConfirm();
    setConfirmState(null);
  }, [confirmState]);

  /**
   * @hello-pangea/dnd のドラッグ終了イベントハンドラー。
   * ドロップ先が有効な場合のみタスク移動を実行する。
   * @param result - DnDライブラリから渡される DropResult
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
   */
  const handleAddRow = useCallback(async () => {
    const title = prompt("行のタイトルを入力してください");
    if (!title) return;
    await addRow(title);
  }, [addRow]);

  /**
   * カラム名入力ダイアログを表示して新しいカラムを追加する。
   * @param rowId - カラムを追加する行 ID
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
   */
  const handleSaveRowTitle = useCallback(async () => {
    if (!editingRow) return;
    const title = editingRow.title.trim();
    if (title) await renameRow(editingRow.id, title);
    setEditingRow(null);
  }, [editingRow, renameRow]);

  /**
   * カラム名インライン編集を確定する。内容が空の場合は保存しない。
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
   */
  const handleDeleteTask = useCallback(
    async (colId: number, taskId: number) => {
      await removeTask(colId, taskId);
    },
    [removeTask],
  );

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
          </div>

          <div className="view-switch" role="tablist" aria-label="表示モード">
            <button
              type="button"
              className={`btn btn-toggle ${viewMode === "kanban" ? "btn-primary" : ""}`}
              onClick={() => setViewMode("kanban")}
              aria-pressed={viewMode === "kanban"}
            >
              <LayoutTemplate size={16} /> かんばん
            </button>
            <button
              type="button"
              className={`btn btn-toggle ${viewMode === "list" ? "btn-primary" : ""}`}
              onClick={() => setViewMode("list")}
              aria-pressed={viewMode === "list"}
            >
              <List size={16} /> リスト
            </button>
          </div>
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
      ) : viewMode === "kanban" ? (
        <DragDropContext onDragEnd={(r) => void handleDragEnd(r)}>
          <div className="kanban-rows">
            {rows.map((row) => (
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
                                          const taskCardNode = (
                                            <div
                                              className={`task-card${taskDragSnapshot.isDragging ? " task-card-dragging" : ""}`}
                                              ref={taskDragProvided.innerRef}
                                              {...taskDragProvided.draggableProps}
                                              {...taskDragProvided.dragHandleProps}
                                            >
                                              <TaskCard
                                                task={task}
                                                columnId={column.id}
                                                onDeleteTask={handleDeleteTask}
                                                onTaskUpdated={updateTask}
                                                onEditTask={(t) =>
                                                  setEditingTask({
                                                    task: t,
                                                    colId: column.id,
                                                    isNew: false,
                                                  })
                                                }
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
        <ListView
          rows={rows}
          onRowHeaderRender={renderRowHeader}
          onTaskClick={(task, colId) =>
            setEditingTask({ task, colId, isNew: false })
          }
          onDeleteTask={handleDeleteTask}
          onAddTask={handleAddTask}
        />
      )}

      {editingTask && (
        <TaskEditModal
          task={editingTask.task}
          onClose={handleCloseTaskModal}
          onTaskUpdated={(updatedTask) => {
            updateTask(updatedTask);
          }}
        />
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
