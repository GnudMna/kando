// リストビューコンポーネント
// かんばんビューの代替表示。全タスクをリスト形式（行→ステータス列で表示）で表示する
import { Plus, Trash2 } from "lucide-react";
import type { Row, Task } from "../types";

interface Props {
  rows: Row[];
  onRowHeaderRender: (row: Row) => React.ReactNode;
  onTaskClick: (task: Task, colId: number) => void;
  onDeleteTask: (colId: number, taskId: number) => void;
  onAddTask: (colId: number, rowId: number) => void;
}

/**
 * リストビューコンポーネント。
 * 全タスクを行 → ステータス列の半平リスト形式で表示する。
 * サブタスクとチェックリストもインデント付きで列挙する。
 * @param rows - ボード全体の行データ
 * @param onRowHeaderRender - 行ヘッダーのレンダリング関数
 * @param onTaskClick - タスククリック時のコールバック
 * @param onDeleteTask - タスク削除コールバック
 * @param onAddTask - タスク追加コールバック
 */
export function ListView({
  rows,
  onRowHeaderRender,
  onTaskClick,
  onDeleteTask,
  onAddTask,
}: Props) {
  return (
    <div className="kanban-rows">
      {rows.map((row) => (
        <div key={row.id} className="board-row">
          {onRowHeaderRender(row)}
          <div className="list-view-body">
            <div className="list-view-header-row">
              <span className="list-view-col list-view-col-task">タスク</span>
              <span className="list-view-col list-view-col-status">
                ステータス
              </span>
              <span className="list-view-col list-view-col-actions" />
            </div>

            {row.columns.flatMap((column) =>
              column.tasks.flatMap((task) => [
                <div
                  key={task.id}
                  className="list-view-row"
                  onClick={() => onTaskClick(task, column.id)}
                >
                  <span className="list-view-col list-view-col-task">
                    {task.content}
                  </span>
                  <span className="list-view-col list-view-col-status">
                    <span className="status-badge">{column.title}</span>
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
                </div>,

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
      ))}
    </div>
  );
}
