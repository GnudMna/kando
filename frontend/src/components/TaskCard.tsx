// タスクカードコンポーネント
// かんばんボード上でタスクの内容・チェックリスト・サブタスクを表示し
// チェック状態の切り替えや削除確認ダイアログを提供する
import { useState, memo } from "react";
import {
  Trash2,
  Copy,
  CheckSquare,
  Square,
  CornerDownRight,
  MessageSquare,
  CalendarDays,
  CircleCheck,
  Circle,
} from "lucide-react";
import type { Task } from "../types";
import { ConfirmDialog } from "./ConfirmDialog";
import * as api from "../api/boardApi";
import {
  formatDueDate,
  getDueStatusLabel,
  type DueHighlightResult,
} from "../utils/dueDate";

interface Props {
  task: Task;
  columnId: number;
  dueHighlight: DueHighlightResult;
  onDeleteTask: (colId: number, taskId: number) => void;
  onCopyTask: (colId: number, taskId: number) => void;
  onTaskUpdated: (task: Task) => void;
  onEditTask: (task: Task, colId: number) => void;
}

/**
 * かんばんボード上のタスクカードコンポーネント。
 * タスク内容・チェックリスト・サブタスクを表示し、
 * チェック状態の即時切り替えおよび削除確認ダイアログを提供する。
 * @param task - 表示するタスクデータ
 * @param columnId - タスクが属するカラム ID
 * @param dueHighlight - 期限強調状態
 * @param onDeleteTask - タスク削除コールバック
 * @param onTaskUpdated - タスク更新時のコールバック
 * @param onEditTask - タスク編集開始時のコールバック
 * @returns タスクカードの JSX 要素
 */
export const TaskCard = memo(function TaskCard({
  task,
  columnId,
  dueHighlight,
  onDeleteTask,
  onCopyTask,
  onTaskUpdated,
  onEditTask,
}: Props) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const dueLabel = getDueStatusLabel(dueHighlight);
  const dueClass =
    dueHighlight.status === "none"
      ? ""
      : ` task-due-date-${dueHighlight.status}`;

  /**
   * タスクの完了状態を切り替えて API に保存する。
   * @returns 更新処理完了時に解決される Promise
   */
  const toggleCompleted = async () => {
    try {
      await api.updateTask(task.id, { completed: !task.completed });
      onTaskUpdated({ ...task, completed: !task.completed });
    } catch (err) {
      console.error(err);
    }
  };

  /**
   * チェックリスト項目の完了状態を切り替えて API に保存する。
   * 成功時は onTaskUpdated で親コンポーネントの state を更新する。
   * @param item - 対象チェックリスト項目（id と completed が必要）
   * @param type - 'タスク直下' なら 'task'、'サブタスク配下' なら 'subtask'
   * @param subtaskId - type が 'subtask' の場合の親サブタスク ID
   * @returns 更新処理完了時に解決される Promise
   */
  const toggleChecklist = async (
    item: { id: number; completed: boolean },
    type: "task" | "subtask",
    subtaskId?: number,
  ) => {
    try {
      const updatedItem = await api.updateChecklistItem(item.id, {
        completed: !item.completed,
      });
      if (type === "task") {
        onTaskUpdated({
          ...task,
          checklists: task.checklists.map((c) =>
            c.id === item.id ? updatedItem : c,
          ),
        });
      } else if (subtaskId !== undefined) {
        onTaskUpdated({
          ...task,
          subtasks: task.subtasks.map((s) =>
            s.id === subtaskId
              ? {
                  ...s,
                  checklists: s.checklists.map((c) =>
                    c.id === item.id ? updatedItem : c,
                  ),
                }
              : s,
          ),
        });
      }
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <>
      <div className="task-card-inner">
        <div className="task-card-header">
          <button
            type="button"
            className="task-complete-btn"
            onClick={() => void toggleCompleted()}
            aria-label={
              task.completed
                ? `タスク「${task.content}」を未完了にする`
                : `タスク「${task.content}」を完了にする`
            }
            title={task.completed ? "未完了に戻す" : "完了にする"}
          >
            {task.completed ? (
              <CircleCheck size={15} className="task-complete-icon completed" />
            ) : (
              <Circle size={15} className="task-complete-icon text-muted" />
            )}
          </button>
          <button
            type="button"
            className={`task-content task-title-btn${task.completed ? " task-title-completed" : ""}`}
            onClick={() => onEditTask(task, columnId)}
            aria-label={`タスク「${task.content}」を編集`}
          >
            {task.content}
          </button>
        </div>

        {task.due_date && (
          <div className={`task-due-date text-muted${dueClass}`}>
            <CalendarDays size={13} />
            <span>{formatDueDate(task.due_date)}</span>
            {dueLabel && (
              <span
                className={`task-due-state task-due-state-${dueHighlight.status}`}
              >
                {dueLabel}
              </span>
            )}
          </div>
        )}

        {task.comments.length > 0 && (
          <div className="task-comment-summary text-muted">
            <MessageSquare size={13} />
            <span>{task.comments.length} 件のコメント</span>
          </div>
        )}

        {task.checklists.length > 0 && (
          <div className="task-checklists">
            {task.checklists.map((c) => (
              <div key={c.id} className="checklist-item">
                <button
                  type="button"
                  className="checklist-toggle"
                  onClick={() => void toggleChecklist(c, "task")}
                  aria-label={`チェックリスト「${c.content}」を${c.completed ? "未完了" : "完了"}にする`}
                >
                  {c.completed ? (
                    <CheckSquare size={14} className="accent" />
                  ) : (
                    <Square size={14} className="text-muted" />
                  )}
                </button>
                <span
                  className={
                    c.completed
                      ? "checklist-text completed text-muted"
                      : "checklist-text"
                  }
                >
                  {c.content}
                </span>
              </div>
            ))}
          </div>
        )}

        {task.subtasks.length > 0 && (
          <div className="subtasks-container">
            {task.subtasks.map((subtask) => (
              <div key={subtask.id} className="subtask-card">
                <div className="subtask-header">
                  <div className="subtask-title-row">
                    <CornerDownRight size={14} className="text-muted" />
                    <span className="subtask-title">{subtask.content}</span>
                  </div>
                </div>

                {subtask.checklists.length > 0 && (
                  <div className="task-checklists task-checklists-nested">
                    {subtask.checklists.map((c) => (
                      <div key={c.id} className="checklist-item">
                        <button
                          type="button"
                          className="checklist-toggle"
                          onClick={() =>
                            void toggleChecklist(c, "subtask", subtask.id)
                          }
                          aria-label={`サブタスク「${subtask.content}」のチェックリスト「${c.content}」を${c.completed ? "未完了" : "完了"}にする`}
                        >
                          {c.completed ? (
                            <CheckSquare size={14} className="accent" />
                          ) : (
                            <Square size={14} className="text-muted" />
                          )}
                        </button>
                        <span
                          className={
                            c.completed
                              ? "checklist-text completed text-muted"
                              : "checklist-text"
                          }
                        >
                          {c.content}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        <div className="task-actions">
          <button
            type="button"
            className="action-btn"
            onClick={(e) => {
              e.stopPropagation();
              onCopyTask(columnId, task.id);
            }}
            aria-label={`タスク「${task.content}」をコピー`}
            title="コピー"
          >
            <Copy size={14} />
          </button>
          <button
            type="button"
            className="action-btn"
            onClick={(e) => {
              e.stopPropagation();
              setConfirmDelete(true);
            }}
            aria-label={`タスク「${task.content}」を削除`}
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>

      {confirmDelete && (
        <ConfirmDialog
          message={`「${task.content}」を削除しますか？`}
          onConfirm={() => {
            setConfirmDelete(false);
            onDeleteTask(columnId, task.id);
          }}
          onCancel={() => setConfirmDelete(false)}
        />
      )}
    </>
  );
});
