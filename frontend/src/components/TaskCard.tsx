// タスクカードコンポーネント
// かんばんボード上でタスクの内容・チェックリスト・サブタスクを表示し
// チェック状態の切り替えや削除確認ダイアログを提供する
import { useState } from 'react';
import { Trash2, CheckSquare, Square, CornerDownRight } from 'lucide-react';
import type { Task } from '../types';
import { ConfirmDialog } from './ConfirmDialog';
import * as api from '../api/boardApi';

interface Props {
  task: Task;
  columnId: number;
  onDeleteTask: (colId: number, taskId: number) => void;
  onTaskUpdated: (task: Task) => void;
  onEditTask: (task: Task) => void;
}

/**
 * かんばんボード上のタスクカードコンポーネント。
 * タスク内容・チェックリスト・サブタスクを表示し、
 * チェック状態の即時切り替えおよび削除確認ダイアログを提供する。
 * @param task - 表示するタスクデータ
 * @param columnId - タスクが属するカラム ID
 * @param onDeleteTask - タスク削除コールバック
 * @param onTaskUpdated - タスク更新時のコールバック
 * @param onEditTask - タスク編集開始時のコールバック
 */
export function TaskCard({ task, columnId, onDeleteTask, onTaskUpdated, onEditTask }: Props) {
  const [confirmDelete, setConfirmDelete] = useState(false);

  /**
   * チェックリスト項目の完了状態を切り替えて API に保存する。
   * 成功時は onTaskUpdated で親コンポーネントの state を更新する。
   * @param item - 対象チェックリスト項目（id と completed が必要）
   * @param type - 'タスク直下' なら 'task'、'サブタスク配下' なら 'subtask'
   * @param subtaskId - type が 'subtask' の場合の親サブタスク ID
   */
  const toggleChecklist = async (
    item: { id: number | string; completed: boolean },
    type: 'task' | 'subtask',
    subtaskId?: number | string
  ) => {
    try {
      const updatedItem = await api.updateChecklistItem(item.id, {
        completed: !item.completed,
      });
      // ディープコピーで immutable に state を更新する
      const newTask = JSON.parse(JSON.stringify(task)) as Task;
      if (type === 'task') {
        const idx = newTask.checklists.findIndex((c) => c.id === item.id);
        newTask.checklists[idx] = updatedItem;
      } else if (subtaskId !== undefined) {
        const subIndex = newTask.subtasks.findIndex((s) => s.id === subtaskId);
        const idx = newTask.subtasks[subIndex].checklists.findIndex(
          (c) => c.id === item.id
        );
        newTask.subtasks[subIndex].checklists[idx] = updatedItem;
      }
      onTaskUpdated(newTask);
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <>
      <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
        <div
          className="task-content"
          style={{ fontWeight: '600', cursor: 'pointer' }}
          onClick={() => onEditTask(task)}
          title="クリックして編集"
        >
          {task.content}
        </div>

        {task.checklists.length > 0 && (
          <div className="task-checklists">
            {task.checklists.map((c) => (
              <div key={c.id} className="checklist-item">
                <button
                  className="checklist-toggle"
                  onClick={() => void toggleChecklist(c, 'task')}
                >
                  {c.completed ? (
                    <CheckSquare size={14} className="accent" />
                  ) : (
                    <Square size={14} className="text-muted" />
                  )}
                </button>
                <span
                  className={
                    c.completed ? 'checklist-text completed text-muted' : 'checklist-text'
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
                  <div
                    style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}
                  >
                    <CornerDownRight size={14} className="text-muted" />
                    <span className="subtask-title">{subtask.content}</span>
                  </div>
                </div>

                {subtask.checklists.length > 0 && (
                  <div
                    className="task-checklists"
                    style={{ marginLeft: '1rem', marginTop: '0.25rem' }}
                  >
                    {subtask.checklists.map((c) => (
                      <div key={c.id} className="checklist-item">
                        <button
                          className="checklist-toggle"
                          onClick={() =>
                            void toggleChecklist(c, 'subtask', subtask.id)
                          }
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
                              ? 'checklist-text completed text-muted'
                              : 'checklist-text'
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

        <div
          className="task-actions"
          style={{ position: 'absolute', top: '0.5rem', right: '0.5rem' }}
        >
          <button
            className="action-btn"
            onClick={(e) => {
              e.stopPropagation();
              setConfirmDelete(true);
            }}
            title="タスク削除"
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
}
