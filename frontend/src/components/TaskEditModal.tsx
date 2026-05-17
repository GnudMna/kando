// タスク内容・チェックリスト・サブタスクの編集を行い、保存時に API へまとめて反映する
import { useId, useState, useRef } from "react";
import { createPortal } from "react-dom";
import {
  X,
  Trash2,
  Plus,
  CheckSquare,
  Square,
  CornerDownRight,
  GripVertical,
  CircleCheck,
  Circle,
} from "lucide-react";
import type {
  Task,
  LocalTask,
  LocalSubtask,
  LocalChecklistItem,
  TempId,
} from "../types";
import * as api from "../api/boardApi";
import { formatDueDate, normalizeDueDateValue } from "../utils/dueDate";
import { POSITION_GAP } from "../utils/constants";
import { tempId, isTemp } from "../utils/localId";
import { CommentSection } from "./CommentSection";

interface Props {
  task: Task;
  onClose: (reason: "saved" | "dismiss") => void;
  onTaskUpdated: (task: Task) => void;
}

/**
 * タスク詳細を編集するモーダルコンポーネント。
 * @param task - 編集対象タスク
 * @param onClose - モーダルを閉じるコールバック
 * @param onTaskUpdated - 保存後タスクを反映するコールバック
 * @returns タスク編集モーダルの JSX 要素
 */
export function TaskEditModal({ task, onClose, onTaskUpdated }: Props) {
  // モーダル内のローカル編集状態（保存前は外部に影響しない）
  const [localTask, setLocalTask] = useState<LocalTask>(() => {
    const cloned = structuredClone(task) as LocalTask;
    cloned.due_date = normalizeDueDateValue(cloned.due_date);
    return cloned;
  });
  // サブタスクのインライン編集状態
  const [editingSubtaskId, setEditingSubtaskId] = useState<
    number | TempId | null
  >(null);
  const [editingSubtaskContent, setEditingSubtaskContent] = useState("");
  // サブタスク追加フォームの表示状態と入力値
  const [newSubtaskContent, setNewSubtaskContent] = useState("");
  const [addingSubtask, setAddingSubtask] = useState(false);
  // チェックリスト追加フォームの表示状態（'task' | subtaskId | null）
  const [addingChecklist, setAddingChecklist] = useState<
    "task" | number | TempId | null
  >(null);
  // チェックリストドラッグ状態：親キー（'task' または subtaskId）とインデックス
  const dragState = useRef<{
    parentKey: "task" | number | TempId;
    index: number;
  } | null>(null);
  const [dragOverKey, setDragOverKey] = useState<{
    parentKey: "task" | number | TempId;
    index: number;
  } | null>(null);
  const [newChecklistContent, setNewChecklistContent] = useState("");
  // 保存中エラーとローディング状態
  const [saveError, setSaveError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const modalTitleId = useId();
  const taskContentInputId = useId();
  const taskDueDateInputId = useId();

  /**
   * ローカルの編集内容を API に保存してモーダルを閉じる。
   * タスク本体・サブタスク・チェックリスト・コメントを単一 API で一括保存する。
   * 失敗時はエラーメッセージを表示する。
   * @returns 保存処理完了時に解決される Promise
   */
  const saveAndClose = async () => {
    setSaveError(null);
    setIsSaving(true);
    try {
      const final: LocalTask = structuredClone(localTask) as LocalTask;
      final.due_date = normalizeDueDateValue(final.due_date);
      const payload: api.TaskSnapshotPayload = {
        content: final.content,
        due_date: final.due_date,
        completed: final.completed,
        checklists: final.checklists.map((checklist) => ({
          id: isTemp(checklist.id) ? undefined : checklist.id,
          content: checklist.content,
          completed: checklist.completed,
        })),
        subtasks: final.subtasks.map((subtask) => ({
          id: isTemp(subtask.id) ? undefined : subtask.id,
          content: subtask.content,
          checklists: subtask.checklists.map((checklist) => ({
            id: isTemp(checklist.id) ? undefined : checklist.id,
            content: checklist.content,
            completed: checklist.completed,
          })),
        })),
        comments: final.comments.map((comment) => ({
          id: isTemp(comment.id) ? undefined : comment.id,
          content: comment.content,
        })),
      };

      const savedTask = await api.saveTaskSnapshot(task.id, payload);
      onTaskUpdated(savedTask);
      onClose("saved");
    } catch (err) {
      console.error(err);
      setSaveError("保存中にエラーが発生しました。再試行してください。");
    } finally {
      setIsSaving(false);
    }
  };

  /**
   * 新しいサブタスクをローカル state に追加する。
   * 保存は saveAndClose 呼び出し時にまとめて行う。
   * @returns なし
   */
  const addSubtask = () => {
    if (!newSubtaskContent.trim()) return;
    const newSub: LocalSubtask = {
      id: tempId(),
      task_id: task.id,
      content: newSubtaskContent,
      checklists: [],
    };
    setLocalTask((prev) => ({ ...prev, subtasks: [...prev.subtasks, newSub] }));
    setNewSubtaskContent("");
    setAddingSubtask(false);
  };

  /**
   * サブタスクのインライン編集を確定してローカル state を更新する。
   * 内容が空の場合は編集をキャンセルする。
   * @param subtaskId - 編集対象のサブタスク ID
   * @returns なし
   */
  const saveSubtaskEdit = (subtaskId: number | TempId) => {
    if (!editingSubtaskContent.trim()) {
      setEditingSubtaskId(null);
      return;
    }
    setLocalTask((prev) => ({
      ...prev,
      subtasks: prev.subtasks.map((s) =>
        s.id === subtaskId ? { ...s, content: editingSubtaskContent } : s,
      ),
    }));
    setEditingSubtaskId(null);
  };

  /**
   * サブタスクをローカル state から削除する。
   * @param subId - 削除対象のサブタスク ID
   * @returns なし
   */
  const removeSubtask = (subId: number | TempId) => {
    setLocalTask((prev) => ({
      ...prev,
      subtasks: prev.subtasks.filter((s) => s.id !== subId),
    }));
  };

  /**
   * 新しいチェックリスト項目をローカル state に追加する。
   * @param type - 'task' の場合はタスク直下、'subtask' の場合はサブタスク配下に追加
   * @param subtaskId - type が 'subtask' の場合の親サブタスク ID
   * @returns なし
   */
  const addChecklistItem = (
    type: "task" | "subtask",
    subtaskId: number | TempId | null = null,
  ) => {
    if (!newChecklistContent.trim()) return;
    setLocalTask((prev) => {
      if (type === "task") {
        const position = (prev.checklists.length + 1) * POSITION_GAP;
        const newItem: LocalChecklistItem = {
          id: tempId(),
          content: newChecklistContent,
          completed: false,
          task_id: task.id,
          subtask_id: null,
          position,
        };
        return { ...prev, checklists: [...prev.checklists, newItem] };
      }
      return {
        ...prev,
        subtasks: prev.subtasks.map((s) =>
          s.id === subtaskId
            ? {
                ...s,
                checklists: [
                  ...s.checklists,
                  {
                    id: tempId(),
                    content: newChecklistContent,
                    completed: false,
                    task_id: null,
                    subtask_id: subtaskId,
                    position: (s.checklists.length + 1) * POSITION_GAP,
                  },
                ],
              }
            : s,
        ),
      };
    });
    setNewChecklistContent("");
    setAddingChecklist(null);
  };

  /**
   * ドラッグ&ドロップでチェックリスト項目を並び替える。
   * @param parentKey - 'task' またはサブタスク ID
   * @param fromIndex - ドラッグ元インデックス
   * @param toIndex - ドロップ先インデックス
   * @returns なし
   */
  const moveChecklistItem = (
    parentKey: "task" | number | TempId,
    fromIndex: number,
    toIndex: number,
  ) => {
    if (fromIndex === toIndex) return;
    setLocalTask((prev) => {
      if (parentKey === "task") {
        const checklists = [...prev.checklists];
        const [item] = checklists.splice(fromIndex, 1);
        checklists.splice(toIndex, 0, item);
        return { ...prev, checklists };
      }
      return {
        ...prev,
        subtasks: prev.subtasks.map((s) => {
          if (s.id !== parentKey) return s;
          const checklists = [...s.checklists];
          const [item] = checklists.splice(fromIndex, 1);
          checklists.splice(toIndex, 0, item);
          return { ...s, checklists };
        }),
      };
    });
  };

  /**
   * チェックリスト項目の完了状態をローカル state 内でトグルする。
   * 実際の API 更新は saveAndClose 時に行う。
   * @param itemId - 対象項目 ID
   * @param type - 'task' または 'subtask'
   * @param subtaskId - type が 'subtask' の場合の親サブタスク ID
   * @returns なし
   */
  const toggleChecklist = (
    itemId: number | TempId,
    type: "task" | "subtask",
    subtaskId: number | TempId | null = null,
  ) => {
    setLocalTask((prev) => {
      if (type === "task") {
        return {
          ...prev,
          checklists: prev.checklists.map((c) =>
            c.id === itemId ? { ...c, completed: !c.completed } : c,
          ),
        };
      }
      return {
        ...prev,
        subtasks: prev.subtasks.map((s) =>
          s.id === subtaskId
            ? {
                ...s,
                checklists: s.checklists.map((c) =>
                  c.id === itemId ? { ...c, completed: !c.completed } : c,
                ),
              }
            : s,
        ),
      };
    });
  };

  /**
   * チェックリスト項目をローカル state から削除する。
   * @param itemId - 削除対象項目 ID
   * @param type - 'task' または 'subtask'
   * @param subtaskId - type が 'subtask' の場合の親サブタスク ID
   * @returns なし
   */
  const removeChecklist = (
    itemId: number | TempId,
    type: "task" | "subtask",
    subtaskId: number | TempId | null = null,
  ) => {
    setLocalTask((prev) => {
      if (type === "task") {
        return {
          ...prev,
          checklists: prev.checklists.filter((c) => c.id !== itemId),
        };
      }
      return {
        ...prev,
        subtasks: prev.subtasks.map((s) =>
          s.id === subtaskId
            ? { ...s, checklists: s.checklists.filter((c) => c.id !== itemId) }
            : s,
        ),
      };
    });
  };

  return createPortal(
    <div className="modal-overlay">
      <div
        className="modal-content"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby={modalTitleId}
      >
        <div className="modal-header">
          <h3 id={modalTitleId} className="modal-title">
            タスクを編集
          </h3>
          <button
            type="button"
            className="action-btn"
            onClick={() => onClose("dismiss")}
            aria-label="編集モーダルを閉じる"
          >
            <X size={18} />
          </button>
        </div>

        <div className="modal-body">
          <div className="modal-section">
            <label htmlFor={taskContentInputId} className="modal-label">
              タスク内容
            </label>
            <textarea
              id={taskContentInputId}
              className="task-content-input"
              value={localTask.content}
              onChange={(e) =>
                setLocalTask((prev) => ({ ...prev, content: e.target.value }))
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
                setLocalTask((prev) => ({
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
                setLocalTask((prev) => ({
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

          <CommentSection
            comments={localTask.comments}
            taskId={task.id}
            onCommentsChange={(newComments) =>
              setLocalTask((prev) => ({ ...prev, comments: newComments }))
            }
          />

          <div className="modal-section">
            <label className="modal-label">チェックリスト</label>
            <div className="task-checklists">
              {localTask.checklists.map((c, i) => (
                <div
                  key={c.id}
                  className={[
                    "checklist-item",
                    dragOverKey?.parentKey === "task" && dragOverKey.index === i
                      ? "checklist-drag-over"
                      : "",
                  ]
                    .join(" ")
                    .trim()}
                  draggable
                  onDragStart={(e) => {
                    e.dataTransfer.effectAllowed = "move";
                    dragState.current = { parentKey: "task", index: i };
                  }}
                  onDragOver={(e) => {
                    e.preventDefault();
                    setDragOverKey({ parentKey: "task", index: i });
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    if (dragState.current?.parentKey === "task") {
                      moveChecklistItem("task", dragState.current.index, i);
                    }
                    dragState.current = null;
                    setDragOverKey(null);
                  }}
                  onDragEnd={() => {
                    dragState.current = null;
                    setDragOverKey(null);
                  }}
                >
                  <span className="checklist-drag-handle" aria-hidden="true">
                    <GripVertical size={12} />
                  </span>
                  <button
                    type="button"
                    className="checklist-toggle"
                    onClick={() => toggleChecklist(c.id, "task")}
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
                  <button
                    type="button"
                    className="checklist-del modal-del-btn"
                    onClick={() => removeChecklist(c.id, "task")}
                    aria-label={`チェックリスト「${c.content}」を削除`}
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              ))}
            </div>
            {addingChecklist === "task" ? (
              <ChecklistInput
                value={newChecklistContent}
                onChange={setNewChecklistContent}
                onAdd={() => addChecklistItem("task")}
                onCancel={() => {
                  setAddingChecklist(null);
                  setNewChecklistContent("");
                }}
              />
            ) : (
              <button
                type="button"
                className="text-btn text-muted"
                style={{ marginTop: "0.5rem" }}
                onClick={() => {
                  setAddingChecklist("task");
                  setNewChecklistContent("");
                }}
              >
                <Plus size={12} /> チェック項目を追加
              </button>
            )}
          </div>

          <div className="modal-section">
            <label className="modal-label">サブタスク</label>
            {localTask.subtasks.map((subtask) => (
              <div
                key={subtask.id}
                className="subtask-card"
                style={{ marginBottom: "0.5rem" }}
              >
                <div className="subtask-header">
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "0.25rem",
                      flex: 1,
                    }}
                  >
                    <CornerDownRight size={14} className="text-muted" />
                    {editingSubtaskId === subtask.id ? (
                      <input
                        autoFocus
                        className="task-content-input"
                        style={{
                          fontSize: "0.85rem",
                          padding: "0.2rem 0.4rem",
                          flex: 1,
                        }}
                        value={editingSubtaskContent}
                        onChange={(e) =>
                          setEditingSubtaskContent(e.target.value)
                        }
                        onKeyDown={(e) => {
                          if (e.key === "Enter") saveSubtaskEdit(subtask.id);
                          if (e.key === "Escape") setEditingSubtaskId(null);
                        }}
                        onBlur={() => saveSubtaskEdit(subtask.id)}
                      />
                    ) : (
                      <span
                        className="subtask-title"
                        style={{ cursor: "pointer", flex: 1 }}
                        onClick={() => {
                          setEditingSubtaskId(subtask.id);
                          setEditingSubtaskContent(subtask.content);
                        }}
                        title="クリックして編集"
                      >
                        {subtask.content}
                      </span>
                    )}
                  </div>
                  <button
                    type="button"
                    className="action-btn"
                    onClick={() => removeSubtask(subtask.id)}
                    aria-label={`サブタスク「${subtask.content}」を削除`}
                  >
                    <Trash2 size={12} />
                  </button>
                </div>

                <div
                  className="task-checklists"
                  style={{ marginLeft: "1.25rem", marginTop: "0.25rem" }}
                >
                  {subtask.checklists.map((c, j) => (
                    <div
                      key={c.id}
                      className={[
                        "checklist-item",
                        dragOverKey?.parentKey === subtask.id &&
                        dragOverKey.index === j
                          ? "checklist-drag-over"
                          : "",
                      ]
                        .join(" ")
                        .trim()}
                      draggable
                      onDragStart={(e) => {
                        e.dataTransfer.effectAllowed = "move";
                        dragState.current = { parentKey: subtask.id, index: j };
                      }}
                      onDragOver={(e) => {
                        e.preventDefault();
                        setDragOverKey({ parentKey: subtask.id, index: j });
                      }}
                      onDrop={(e) => {
                        e.preventDefault();
                        if (dragState.current?.parentKey === subtask.id) {
                          moveChecklistItem(
                            subtask.id,
                            dragState.current.index,
                            j,
                          );
                        }
                        dragState.current = null;
                        setDragOverKey(null);
                      }}
                      onDragEnd={() => {
                        dragState.current = null;
                        setDragOverKey(null);
                      }}
                    >
                      <span
                        className="checklist-drag-handle"
                        aria-hidden="true"
                      >
                        <GripVertical size={12} />
                      </span>
                      <button
                        type="button"
                        className="checklist-toggle"
                        onClick={() =>
                          toggleChecklist(c.id, "subtask", subtask.id)
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
                      <button
                        type="button"
                        className="checklist-del modal-del-btn"
                        onClick={() =>
                          removeChecklist(c.id, "subtask", subtask.id)
                        }
                        aria-label={`サブタスク「${subtask.content}」のチェックリスト「${c.content}」を削除`}
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  ))}
                </div>

                {addingChecklist === subtask.id ? (
                  <div style={{ marginLeft: "1.25rem", marginTop: "0.25rem" }}>
                    <ChecklistInput
                      value={newChecklistContent}
                      onChange={setNewChecklistContent}
                      onAdd={() => addChecklistItem("subtask", subtask.id)}
                      onCancel={() => {
                        setAddingChecklist(null);
                        setNewChecklistContent("");
                      }}
                    />
                  </div>
                ) : (
                  <button
                    type="button"
                    className="text-btn text-muted"
                    style={{ marginLeft: "1.25rem", marginTop: "0.25rem" }}
                    onClick={() => {
                      setAddingChecklist(subtask.id);
                      setNewChecklistContent("");
                    }}
                  >
                    <Plus size={12} /> チェック項目を追加
                  </button>
                )}
              </div>
            ))}

            {addingSubtask ? (
              <div className="add-sub-form" style={{ marginTop: "0.5rem" }}>
                <input
                  autoFocus
                  placeholder="サブタスク名..."
                  className="task-content-input"
                  style={{ fontSize: "0.85rem" }}
                  value={newSubtaskContent}
                  onChange={(e) => setNewSubtaskContent(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") addSubtask();
                    if (e.key === "Escape") {
                      setAddingSubtask(false);
                      setNewSubtaskContent("");
                    }
                  }}
                />
                <div className="form-actions">
                  <button
                    type="button"
                    className="btn btn-primary"
                    style={{ padding: "0.25rem 0.5rem", fontSize: "0.75rem" }}
                    onClick={addSubtask}
                  >
                    追加
                  </button>
                  <button
                    type="button"
                    className="btn"
                    style={{ padding: "0.25rem 0.5rem", fontSize: "0.75rem" }}
                    onClick={() => {
                      setAddingSubtask(false);
                      setNewSubtaskContent("");
                    }}
                  >
                    キャンセル
                  </button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                className="text-btn text-muted"
                style={{ marginTop: "0.5rem" }}
                onClick={() => setAddingSubtask(true)}
              >
                <Plus size={12} /> サブタスクを追加
              </button>
            )}
          </div>
        </div>

        <div className="modal-footer">
          {saveError && (
            <span
              style={{
                color: "var(--danger, #e53e3e)",
                fontSize: "0.85rem",
                flex: 1,
              }}
            >
              {saveError}
            </span>
          )}
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => void saveAndClose()}
            disabled={isSaving}
          >
            {isSaving ? "保存中..." : "保存して閉じる"}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

interface ChecklistInputProps {
  value: string;
  onChange: (v: string) => void;
  onAdd: () => void;
  onCancel: () => void;
}

/**
 * チェックリスト項目の入力フォームコンポーネント。
 * Enter キーで追加、Escape キーでキャンセルできる。
 * @param value - 入力内容
 * @param onChange - 入力変更コールバック
 * @param onAdd - 追加確定コールバック
 * @param onCancel - キャンセルコールバック
 * @returns 入力フォームの JSX 要素
 */
function ChecklistInput({
  value,
  onChange,
  onAdd,
  onCancel,
}: ChecklistInputProps) {
  return (
    <div className="add-sub-form" style={{ marginTop: "0.5rem" }}>
      <input
        autoFocus
        placeholder="チェック項目..."
        className="task-content-input"
        style={{ fontSize: "0.85rem", padding: "0.35rem" }}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") onAdd();
          if (e.key === "Escape") onCancel();
        }}
      />
      <div className="form-actions">
        <button
          type="button"
          className="btn btn-primary"
          style={{ padding: "0.25rem 0.5rem", fontSize: "0.75rem" }}
          onClick={onAdd}
        >
          追加
        </button>
        <button
          type="button"
          className="btn"
          style={{ padding: "0.25rem 0.5rem", fontSize: "0.75rem" }}
          onClick={onCancel}
        >
          キャンセル
        </button>
      </div>
    </div>
  );
}
