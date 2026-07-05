import { useState, memo, useEffect } from "react";
import { Droppable, Draggable } from "@hello-pangea/dnd";
import type { DraggableProvided } from "@hello-pangea/dnd";
import { createPortal } from "react-dom";
import { Plus, Trash2, GripVertical } from "lucide-react";
import { TaskCard } from "../TaskCard";
import type { Column, Task } from "../../types";
import { getDueHighlight } from "../../utils/dueDate";
import type { DueHighlightResult } from "../../utils/dueDate";
import { taskDragPortalTarget } from "./constants";

/** カラム内で初回に描画するタスク数（超過分は「さらに表示」）。 */
const INITIAL_VISIBLE_TASKS = 30;
const TASK_LOAD_MORE_STEP = 30;

interface BoardColumnProps {
  column: Column;
  rowId: number;
  colProvided: DraggableProvided;
  onRenameColumn: (colId: number, title: string) => Promise<void>;
  onRemoveColumn: (colId: number) => Promise<void>;
  onAddTask: (colId: number, rowId: number) => Promise<void>;
  onDeleteTask: (colId: number, taskId: number) => Promise<void>;
  onCopyTask: (colId: number, taskId: number) => Promise<void>;
  onTaskUpdated: (task: Task) => void;
  onEditTask: (task: Task, colId: number) => void;
  taskDueHighlights: Map<number, DueHighlightResult>;
  dueSoonDays: number;
  confirmAction: (message: string, onConfirm: () => void) => void;
}

/**
 * カラムヘッダー（インライン編集）とタスク一覧を管理する memoized コンポーネント。
 */
export const BoardColumn = memo(function BoardColumn({
  column,
  rowId,
  colProvided,
  onRenameColumn,
  onRemoveColumn,
  onAddTask,
  onDeleteTask,
  onCopyTask,
  onTaskUpdated,
  onEditTask,
  taskDueHighlights,
  dueSoonDays,
  confirmAction,
}: BoardColumnProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(column.title);
  const [visibleTaskCount, setVisibleTaskCount] = useState(
    INITIAL_VISIBLE_TASKS,
  );

  useEffect(() => {
    setVisibleTaskCount(INITIAL_VISIBLE_TASKS);
  }, [column.id, column.tasks.length]);

  const visibleTasks = column.tasks.slice(0, visibleTaskCount);
  const hiddenTaskCount = column.tasks.length - visibleTasks.length;

  const {
    innerRef: columnInnerRef,
    draggableProps: columnDraggableProps,
    dragHandleProps: columnDragHandleProps,
  } = colProvided;

  const handleSave = async () => {
    const title = editTitle.trim();
    if (title) await onRenameColumn(column.id, title);
    setIsEditing(false);
  };

  const handleStartEditing = () => {
    setEditTitle(column.title);
    setIsEditing(true);
  };

  return (
    <div
      className="column-container"
      ref={columnInnerRef}
      {...columnDraggableProps}
    >
      <div className="column-header">
        <div
          {...columnDragHandleProps}
          className="column-drag-handle"
          title="ドラッグして並び替え"
        >
          <GripVertical size={14} />
        </div>
        {isEditing ? (
          <input
            autoFocus
            className="column-title-input"
            value={editTitle}
            onChange={(e) => setEditTitle(e.target.value)}
            onBlur={() => void handleSave()}
            onKeyDown={(e) => {
              if (e.key === "Enter") void handleSave();
              if (e.key === "Escape") setIsEditing(false);
            }}
          />
        ) : (
          <button
            type="button"
            className="column-title board-title-button"
            title="クリックして編集"
            onClick={handleStartEditing}
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
              () => void onRemoveColumn(column.id),
            )
          }
        >
          <Trash2 size={16} />
        </button>
      </div>
      <Droppable droppableId={column.id.toString()} type="task">
        {(taskProvided) => (
          <div
            className="column-body"
            ref={taskProvided.innerRef}
            {...taskProvided.droppableProps}
          >
            {visibleTasks.map((task, index) => (
              <Draggable
                draggableId={`task-${task.id}`}
                index={index}
                key={`task-${task.id}`}
              >
                {(taskDragProvided, taskDragSnapshot) => {
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
                        onDeleteTask={onDeleteTask}
                        onCopyTask={onCopyTask}
                        onTaskUpdated={onTaskUpdated}
                        onEditTask={onEditTask}
                      />
                    </div>
                  );

                  if (taskDragSnapshot.isDragging && taskDragPortalTarget) {
                    return createPortal(taskCardNode, taskDragPortalTarget);
                  }

                  return taskCardNode;
                }}
              </Draggable>
            ))}
            {hiddenTaskCount > 0 && (
              <button
                type="button"
                className="column-load-more-tasks text-btn text-muted"
                onClick={() =>
                  setVisibleTaskCount((count) => count + TASK_LOAD_MORE_STEP)
                }
              >
                さらに {hiddenTaskCount} 件のタスクを表示
              </button>
            )}
            {taskProvided.placeholder}
          </div>
        )}
      </Droppable>
      <div className="column-add-task">
        <button
          type="button"
          className="btn column-add-task-btn"
          onClick={() => void onAddTask(column.id, rowId)}
        >
          <Plus size={16} /> タスクを追加
        </button>
      </div>
    </div>
  );
});
