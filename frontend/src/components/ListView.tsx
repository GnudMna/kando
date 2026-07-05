import { useLayoutEffect, useRef, useState, useEffect } from "react";
import { useWindowVirtualizer } from "@tanstack/react-virtual";
import { Plus, Trash2 } from "lucide-react";
import type { Row, Task } from "../types";
import {
  formatDueDate,
  getDueStatusLabel,
  type DueHighlightResult,
} from "../utils/dueDate";
import { isE2eTestMode } from "../utils/e2e";

/** `ListView` コンポーネントの props。 */
interface Props {
  rows: Row[];
  taskDueHighlights: Map<number, DueHighlightResult>;
  onRowHeaderRender: (row: Row) => React.ReactNode;
  onTaskClick: (task: Task, colId: number) => void;
  onDeleteTask: (colId: number, taskId: number) => void;
  onAddTask: (colId: number, rowId: number) => void;
}

/**
 * 1行分のリストビューブロックを描画する。
 */
function ListRowBlock({
  row,
  taskDueHighlights,
  onRowHeaderRender,
  onTaskClick,
  onDeleteTask,
  onAddTask,
}: {
  row: Row;
  taskDueHighlights: Map<number, DueHighlightResult>;
  onRowHeaderRender: (row: Row) => React.ReactNode;
  onTaskClick: (task: Task, colId: number) => void;
  onDeleteTask: (colId: number, taskId: number) => void;
  onAddTask: (colId: number, rowId: number) => void;
}) {
  return (
    <div className="board-row">
      {onRowHeaderRender(row)}
      <div className="list-view-body">
        <div className="list-view-header-row">
          <span className="list-view-col list-view-col-task">タスク</span>
          <span className="list-view-col list-view-col-status">ステータス</span>
          <span className="list-view-col list-view-col-due">期限</span>
          <span className="list-view-col list-view-col-actions" />
        </div>

        {row.columns.flatMap((column) =>
          column.tasks.flatMap((task) => [
            (() => {
              const dueHighlight = taskDueHighlights.get(task.id);
              const dueLabel = dueHighlight
                ? getDueStatusLabel(dueHighlight)
                : null;
              const rowDueClass =
                !dueHighlight || dueHighlight.status === "none"
                  ? ""
                  : ` task-${dueHighlight.status}`;
              const dueDateClass =
                !dueHighlight || dueHighlight.status === "none"
                  ? ""
                  : ` list-due-date-${dueHighlight.status}`;

              return (
                <div
                  key={task.id}
                  className={`list-view-row${rowDueClass}`}
                  onClick={() => onTaskClick(task, column.id)}
                >
                  <span className="list-view-col list-view-col-task">
                    {task.content}
                  </span>
                  <span className="list-view-col list-view-col-status">
                    <span className="status-badge">{column.title}</span>
                  </span>
                  <span className="list-view-col list-view-col-due">
                    {task.due_date ? (
                      <span className="list-due-cell">
                        <span className={`list-due-date${dueDateClass}`}>
                          {formatDueDate(task.due_date)}
                        </span>
                        {dueLabel && dueHighlight && (
                          <span
                            className={`list-due-state list-due-state-${dueHighlight.status}`}
                          >
                            {dueLabel}
                          </span>
                        )}
                      </span>
                    ) : (
                      <span className="text-muted">-</span>
                    )}
                  </span>
                  <span
                    className="list-view-col list-view-col-actions"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <button
                      className="action-btn"
                      onClick={() => onDeleteTask(column.id, task.id)}
                      title="削除"
                    >
                      <Trash2 size={14} />
                    </button>
                  </span>
                </div>
              );
            })(),

            ...task.subtasks.flatMap((subtask) => [
              <div
                key={`sub-${subtask.id}`}
                className="list-view-row list-view-subtask-row"
                onClick={() => onTaskClick(task, column.id)}
              >
                <span className="list-view-col list-view-col-task">
                  <span className="list-subtask-indent">↳</span>
                  {subtask.content}
                </span>
                <span className="list-view-col list-view-col-status" />
                <span className="list-view-col list-view-col-due" />
                <span className="list-view-col list-view-col-actions" />
              </div>,

              ...subtask.checklists.map((item) => (
                <div
                  key={`subcl-${item.id}`}
                  className="list-view-row list-view-subtask-row"
                  onClick={() => onTaskClick(task, column.id)}
                >
                  <span className="list-view-col list-view-col-task list-view-col-task-deep">
                    <span className="list-subtask-indent">↳</span>
                    <span
                      className={`list-checklist-item${item.completed ? " list-checklist-checked" : ""}`}
                    >
                      {item.completed ? "☑" : "☐"} {item.content}
                    </span>
                  </span>
                  <span className="list-view-col list-view-col-status" />
                  <span className="list-view-col list-view-col-due" />
                  <span className="list-view-col list-view-col-actions" />
                </div>
              )),
            ]),

            ...task.checklists.map((item) => (
              <div
                key={`cl-${item.id}`}
                className="list-view-row list-view-subtask-row"
                onClick={() => onTaskClick(task, column.id)}
              >
                <span className="list-view-col list-view-col-task">
                  <span className="list-subtask-indent">↳</span>
                  <span
                    className={`list-checklist-item${item.completed ? " list-checklist-checked" : ""}`}
                  >
                    {item.completed ? "☑" : "☐"} {item.content}
                  </span>
                </span>
                <span className="list-view-col list-view-col-status" />
                <span className="list-view-col list-view-col-due" />
                <span className="list-view-col list-view-col-actions" />
              </div>
            )),
          ]),
        )}

        {row.columns.every((c) => c.tasks.length === 0) && (
          <div className="list-view-empty">タスクがありません</div>
        )}

        {row.columns.length > 0 && (
          <div className="list-view-add-row">
            <button
              type="button"
              className="text-btn text-muted"
              onClick={() => onAddTask(row.columns[0].id, row.id)}
            >
              <Plus size={14} /> タスクを追加
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * リストビューコンポーネント(行単位の仮想スクロール)。
 * @param rows - 表示する行配列
 * @param taskDueHighlights - タスク ID → 期限強調状態のマップ
 * @param onRowHeaderRender - 行ヘッダー描画コールバック
 * @param onTaskClick - タスククリックコールバック
 * @param onDeleteTask - タスク削除コールバック
 * @param onAddTask - タスク追加コールバック
 * @returns リストビューの JSX 要素
 */
export function ListView({
  rows,
  taskDueHighlights,
  onRowHeaderRender,
  onTaskClick,
  onDeleteTask,
  onAddTask,
}: Props) {
  if (isE2eTestMode) {
    return (
      <div className="kanban-rows">
        {rows.map((row) => (
          <ListRowBlock
            key={row.id}
            row={row}
            taskDueHighlights={taskDueHighlights}
            onRowHeaderRender={onRowHeaderRender}
            onTaskClick={onTaskClick}
            onDeleteTask={onDeleteTask}
            onAddTask={onAddTask}
          />
        ))}
      </div>
    );
  }

  return (
    <VirtualizedListView
      rows={rows}
      taskDueHighlights={taskDueHighlights}
      onRowHeaderRender={onRowHeaderRender}
      onTaskClick={onTaskClick}
      onDeleteTask={onDeleteTask}
      onAddTask={onAddTask}
    />
  );
}

function VirtualizedListView({
  rows,
  taskDueHighlights,
  onRowHeaderRender,
  onTaskClick,
  onDeleteTask,
  onAddTask,
}: Props) {
  const listRef = useRef<HTMLDivElement>(null);
  const [scrollMargin, setScrollMargin] = useState(0);

  useLayoutEffect(() => {
    if (listRef.current) {
      setScrollMargin(listRef.current.offsetTop);
    }
  }, [rows.length]);

  const virtualizer = useWindowVirtualizer({
    count: rows.length,
    estimateSize: () => 280,
    overscan: 2,
    scrollMargin,
    measureElement: (element) => element.getBoundingClientRect().height,
  });

  const prevRowCountRef = useRef(rows.length);
  useEffect(() => {
    if (rows.length > prevRowCountRef.current) {
      virtualizer.scrollToIndex(rows.length - 1, { align: "start" });
    }
    prevRowCountRef.current = rows.length;
  }, [rows.length, virtualizer]);

  return (
    <div
      ref={listRef}
      className="kanban-rows list-view-virtual"
      style={{ height: virtualizer.getTotalSize(), position: "relative" }}
    >
      {virtualizer.getVirtualItems().map((virtualRow) => {
        const row = rows[virtualRow.index];
        return (
          <div
            key={row.id}
            data-index={virtualRow.index}
            ref={virtualizer.measureElement}
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              width: "100%",
              transform: `translateY(${virtualRow.start}px)`,
            }}
          >
            <ListRowBlock
              row={row}
              taskDueHighlights={taskDueHighlights}
              onRowHeaderRender={onRowHeaderRender}
              onTaskClick={onTaskClick}
              onDeleteTask={onDeleteTask}
              onAddTask={onAddTask}
            />
          </div>
        );
      })}
    </div>
  );
}
