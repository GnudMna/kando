import { CircleCheck, Circle } from "lucide-react";
import type { LocalTask } from "../../types";
import { formatDueDate } from "../../utils/dueDate";

interface TaskDetailsFieldsProps {
  localTask: LocalTask;
  onLocalTaskChange: (updater: (prev: LocalTask) => LocalTask) => void;
  taskContentInputId: string;
  taskDueDateInputId: string;
}

/**
 * タスク本文・期限・完了状態の入力フィールドを描画する。
 * @param localTask - 編集中のローカルタスク
 * @param onLocalTaskChange - ローカルタスク更新コールバック
 * @param taskContentInputId - タスク内容入力の `id` 属性
 * @param taskDueDateInputId - 期限日入力の `id` 属性
 * @returns 入力フィールドの JSX 要素
 */
export function TaskDetailsFields({
  localTask,
  onLocalTaskChange,
  taskContentInputId,
  taskDueDateInputId,
}: TaskDetailsFieldsProps) {
  return (
    <>
      <div className="modal-section">
        <label htmlFor={taskContentInputId} className="modal-label">
          タスク内容
        </label>
        <textarea
          id={taskContentInputId}
          className="task-content-input"
          value={localTask.content}
          onChange={(e) =>
            onLocalTaskChange((prev) => ({ ...prev, content: e.target.value }))
          }
          rows={3}
          autoFocus
          style={{ resize: "vertical" }}
        />
      </div>

      <div className="modal-section">
        <label htmlFor={taskDueDateInputId} className="modal-label">
          期限
        </label>
        <input
          id={taskDueDateInputId}
          type="date"
          className="task-content-input due-date-input"
          value={localTask.due_date ?? ""}
          onChange={(e) =>
            onLocalTaskChange((prev) => ({
              ...prev,
              due_date: e.target.value || null,
            }))
          }
        />
        <span className="text-muted">
          {localTask.due_date
            ? `現在の期限: ${formatDueDate(localTask.due_date)}`
            : "期限未設定"}
        </span>
      </div>

      <div className="modal-section">
        <button
          type="button"
          className={`modal-complete-btn${localTask.completed ? " modal-complete-btn-done" : ""}`}
          onClick={() =>
            onLocalTaskChange((prev) => ({
              ...prev,
              completed: !prev.completed,
            }))
          }
        >
          {localTask.completed ? (
            <CircleCheck size={16} />
          ) : (
            <Circle size={16} />
          )}
          {localTask.completed
            ? "完了済み（クリックで戻す）"
            : "未完了（クリックで完了にする）"}
        </button>
      </div>
    </>
  );
}
