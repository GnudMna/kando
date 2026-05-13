// タスク内容・チェックリスト・サブタスクの編集を行い、保存時に API へまとめて反映する
import { useId, useState, useRef, useMemo, type ReactNode } from "react";
import { createPortal } from "react-dom";
import {
  X,
  Trash2,
  Plus,
  CheckSquare,
  Square,
  CornerDownRight,
  GripVertical,
} from "lucide-react";
import type {
  Task,
  LocalTask,
  LocalSubtask,
  LocalChecklistItem,
  LocalTaskComment,
  TempId,
} from "../types";
import * as api from "../api/boardApi";
import { formatDueDate, normalizeDueDateValue } from "../utils/dueDate";

// 一時的な新規レコード用 ID のカウンター
let _tempId = 0;
/**
 * 一時的な新規レコード用 ID を生成する。
 * DB 保存前の項目に付与するために使用する。
 * @returns "__new__{n}" 形式の一意な文字列 ID
 */
function tempId(): TempId {
  return `__new__${++_tempId}` as TempId;
}
/**
 * 値が一時 ID（まだ DB 保存前）かどうかを判定する型ガード。
 * @param id - 検査する ID
 * @returns 一時 ID の場合 true（id は TempId に絞り込まれる）
 */
function isTemp(id: number | TempId): id is TempId {
  return typeof id === "string";
}

const POSITION_GAP = 1000;

const URL_REGEX = /https?:\/\/[^\s<>'"]+/g;

/**
 * プレーンテキストセグメントの改行を <br /> に変換した ReactNode 配列を返す。
 * @param segment - 変換対象のテキスト文字列
 * @param keyPrefix - 生成する <br /> 要素の React key プレフィックス
 * @returns 改行を <br /> に置き換えた ReactNode の配列
 */
function renderLineBreaks(segment: string, keyPrefix: string): ReactNode[] {
  return segment
    .split("\n")
    .flatMap((line, i, arr) =>
      i < arr.length - 1 ? [line, <br key={`${keyPrefix}-br-${i}`} />] : [line],
    );
}

/**
 * テキスト内の URL を <a> リンクに、改行を <br /> に変換した ReactNode 配列を返す。
 * @param text - 変換対象のコメントテキスト
 * @returns URL をリンク化し改行を <br /> に置き換えた ReactNode の配列
 */
function renderTextWithLinks(text: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  URL_REGEX.lastIndex = 0;
  while ((match = URL_REGEX.exec(text)) !== null) {
    if (match.index > lastIndex) {
      nodes.push(
        ...renderLineBreaks(text.slice(lastIndex, match.index), `${lastIndex}`),
      );
    }
    const url = match[0];
    nodes.push(
      <a
        key={match.index}
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="comment-link"
        onClick={(e) => e.stopPropagation()}
      >
        {url}
      </a>,
    );
    lastIndex = match.index + url.length;
  }
  if (lastIndex < text.length) {
    nodes.push(...renderLineBreaks(text.slice(lastIndex), `${lastIndex}`));
  }
  return nodes;
}

type CommentSortMode = "oldest" | "newest" | "manual";

/**
 * コメント作成日時を UI 表示向けの文字列へ整形する。
 * @param value - ISO 形式の日時文字列
 * @returns `ja-JP` ロケール文字列。変換失敗時は "時刻不明"
 */
function formatCommentTimestamp(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "時刻不明";
  }
  return date.toLocaleString("ja-JP", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

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
  // コメント表示順の切替（古い順 / 最新順 / 手動）
  const [commentSortMode, setCommentSortMode] =
    useState<CommentSortMode>("newest");
  const commentDragFromIndex = useRef<number | null>(null);
  const [commentDragOverIndex, setCommentDragOverIndex] = useState<
    number | null
  >(null);
  // コメントのインライン編集状態
  const [editingCommentId, setEditingCommentId] = useState<
    number | TempId | null
  >(null);
  const [editingCommentContent, setEditingCommentContent] = useState("");
  // コメント追加フォームの表示状態と入力値
  const [newCommentContent, setNewCommentContent] = useState("");
  const [addingComment, setAddingComment] = useState(false);
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
        const position = (prev.checklists.length + 1) * 1000;
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
                    position: (s.checklists.length + 1) * 1000,
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

  /**
   * 新しいコメントをローカル state に追加する。
   * 保存は saveAndClose 呼び出し時にまとめて行う。
   * @returns なし
   */
  const addComment = () => {
    const content = newCommentContent.trim();
    if (!content) return;

    const newComment: LocalTaskComment = {
      id: tempId(),
      task_id: task.id,
      content,
      created_at: new Date().toISOString(),
      position: (localTask.comments.length + 1) * POSITION_GAP,
    };
    setLocalTask((prev) => ({
      ...prev,
      comments: [...prev.comments, newComment],
    }));
    setNewCommentContent("");
    setAddingComment(false);
  };

  /**
   * コメント編集を開始する。
   * @param commentId - 編集対象のコメント ID
   * @param content - 現在のコメント内容
   * @returns なし
   */
  const beginCommentEdit = (commentId: number | TempId, content: string) => {
    setEditingCommentId(commentId);
    setEditingCommentContent(content);
  };

  /**
   * コメント編集を確定してローカル state を更新する。
   * @param commentId - 編集対象のコメント ID
   * @returns なし
   */
  const saveCommentEdit = (commentId: number | TempId) => {
    const content = editingCommentContent.trim();
    if (!content) {
      setEditingCommentId(null);
      setEditingCommentContent("");
      return;
    }
    setLocalTask((prev) => ({
      ...prev,
      comments: prev.comments.map((comment) =>
        comment.id === commentId ? { ...comment, content } : comment,
      ),
    }));
    setEditingCommentId(null);
    setEditingCommentContent("");
  };

  /**
   * コメント編集をキャンセルする。
   * @returns なし
   */
  const cancelCommentEdit = () => {
    setEditingCommentId(null);
    setEditingCommentContent("");
  };

  /**
   * コメントをローカル state から削除する。
   * @param commentId - 削除対象のコメント ID
   * @returns なし
   */
  const removeComment = (commentId: number | TempId) => {
    setLocalTask((prev) => ({
      ...prev,
      comments: prev.comments.filter((comment) => comment.id !== commentId),
    }));
    if (editingCommentId === commentId) {
      cancelCommentEdit();
    }
  };

  const visibleComments = useMemo(() => {
    const withIndex = localTask.comments.map((comment, index) => ({
      comment,
      index,
    }));

    if (commentSortMode === "manual") {
      return withIndex;
    }

    const direction = commentSortMode === "newest" ? -1 : 1;
    return [...withIndex].sort((a, b) => {
      const rawA = new Date(a.comment.created_at).getTime();
      const rawB = new Date(b.comment.created_at).getTime();
      const timeA = Number.isFinite(rawA) ? rawA : 0;
      const timeB = Number.isFinite(rawB) ? rawB : 0;

      if (timeA !== timeB) {
        return (timeA - timeB) * direction;
      }
      return a.index - b.index;
    });
  }, [localTask.comments, commentSortMode]);

  /**
   * 手動ソートモードでコメント配列を並び替える。
   * @param fromIndex - 移動元インデックス
   * @param toIndex - 移動先インデックス
   * @returns なし
   */
  const moveCommentInManualMode = (fromIndex: number, toIndex: number) => {
    if (commentSortMode !== "manual" || fromIndex === toIndex) return;

    setLocalTask((prev) => {
      const comments = [...prev.comments];
      const [moved] = comments.splice(fromIndex, 1);
      comments.splice(toIndex, 0, moved);
      return { ...prev, comments };
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

          <div className="modal-section modal-section-comments">
            <label className="modal-label">コメント</label>

            <div
              className="comment-sort-controls"
              role="group"
              aria-label="コメント表示順を選択"
            >
              <button
                type="button"
                className={`btn btn-compact ${commentSortMode === "oldest" ? "btn-primary" : ""}`}
                onClick={() => setCommentSortMode("oldest")}
                aria-pressed={commentSortMode === "oldest"}
              >
                古い順
              </button>
              <button
                type="button"
                className={`btn btn-compact ${commentSortMode === "newest" ? "btn-primary" : ""}`}
                onClick={() => setCommentSortMode("newest")}
                aria-pressed={commentSortMode === "newest"}
              >
                最新順
              </button>
              <button
                type="button"
                className={`btn btn-compact ${commentSortMode === "manual" ? "btn-primary" : ""}`}
                onClick={() => setCommentSortMode("manual")}
                aria-pressed={commentSortMode === "manual"}
              >
                手動順
              </button>
            </div>

            {commentSortMode === "manual" && (
              <span className="text-muted">
                手動順ではコメントをドラッグして並び替えできます
              </span>
            )}

            {visibleComments.length === 0 ? (
              <span className="text-muted">コメントはまだありません</span>
            ) : (
              <div className="task-comments">
                {visibleComments.map(({ comment, index }, visibleIndex) => (
                  <div
                    key={comment.id}
                    className={[
                      "task-comment-item",
                      commentSortMode === "manual" ? "comment-manual" : "",
                      commentDragOverIndex === visibleIndex
                        ? "comment-drag-over"
                        : "",
                    ]
                      .join(" ")
                      .trim()}
                    draggable={commentSortMode === "manual"}
                    onDragStart={(e) => {
                      if (commentSortMode !== "manual") return;
                      e.dataTransfer.effectAllowed = "move";
                      commentDragFromIndex.current = index;
                    }}
                    onDragOver={(e) => {
                      if (commentSortMode !== "manual") return;
                      e.preventDefault();
                      setCommentDragOverIndex(visibleIndex);
                    }}
                    onDrop={(e) => {
                      if (commentSortMode !== "manual") return;
                      e.preventDefault();
                      if (commentDragFromIndex.current === null) return;
                      moveCommentInManualMode(
                        commentDragFromIndex.current,
                        index,
                      );
                      commentDragFromIndex.current = null;
                      setCommentDragOverIndex(null);
                    }}
                    onDragEnd={() => {
                      commentDragFromIndex.current = null;
                      setCommentDragOverIndex(null);
                    }}
                  >
                    <div className="task-comment-header">
                      <div className="task-comment-meta">
                        {commentSortMode === "manual" && (
                          <span
                            className="comment-drag-handle"
                            aria-hidden="true"
                          >
                            <GripVertical size={12} />
                          </span>
                        )}
                        <span className="task-comment-time">
                          {formatCommentTimestamp(comment.created_at)}
                        </span>
                      </div>
                      <button
                        type="button"
                        className="checklist-del modal-del-btn"
                        onClick={() => removeComment(comment.id)}
                        aria-label={`コメント「${comment.content}」を削除`}
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>

                    {editingCommentId === comment.id ? (
                      <div
                        className="add-sub-form"
                        style={{ marginTop: "0.2rem" }}
                      >
                        <textarea
                          className="task-content-input"
                          style={{ resize: "vertical" }}
                          rows={3}
                          autoFocus
                          value={editingCommentContent}
                          onChange={(e) =>
                            setEditingCommentContent(e.target.value)
                          }
                          onKeyDown={(e) => {
                            if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
                              saveCommentEdit(comment.id);
                            }
                            if (e.key === "Escape") {
                              cancelCommentEdit();
                            }
                          }}
                        />
                        <div className="form-actions">
                          <button
                            type="button"
                            className="btn btn-primary"
                            style={{
                              padding: "0.25rem 0.5rem",
                              fontSize: "0.75rem",
                            }}
                            onClick={() => saveCommentEdit(comment.id)}
                          >
                            保存
                          </button>
                          <button
                            type="button"
                            className="btn"
                            style={{
                              padding: "0.25rem 0.5rem",
                              fontSize: "0.75rem",
                            }}
                            onClick={cancelCommentEdit}
                          >
                            キャンセル
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div
                        className="task-comment-content-btn"
                        onClick={(e) => {
                          if ((e.target as HTMLElement).tagName !== "A") {
                            beginCommentEdit(comment.id, comment.content);
                          }
                        }}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            beginCommentEdit(comment.id, comment.content);
                          }
                        }}
                        role="button"
                        tabIndex={0}
                        title="クリックして編集"
                      >
                        {renderTextWithLinks(comment.content)}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {addingComment ? (
              <div className="add-sub-form" style={{ marginTop: "0.5rem" }}>
                <textarea
                  autoFocus
                  rows={3}
                  placeholder="コメントを入力..."
                  className="task-content-input"
                  style={{ resize: "vertical" }}
                  value={newCommentContent}
                  onChange={(e) => setNewCommentContent(e.target.value)}
                  onKeyDown={(e) => {
                    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
                      addComment();
                    }
                    if (e.key === "Escape") {
                      setAddingComment(false);
                      setNewCommentContent("");
                    }
                  }}
                />
                <div className="form-actions">
                  <button
                    type="button"
                    className="btn btn-primary"
                    style={{ padding: "0.25rem 0.5rem", fontSize: "0.75rem" }}
                    onClick={addComment}
                  >
                    追加
                  </button>
                  <button
                    type="button"
                    className="btn"
                    style={{ padding: "0.25rem 0.5rem", fontSize: "0.75rem" }}
                    onClick={() => {
                      setAddingComment(false);
                      setNewCommentContent("");
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
                onClick={() => {
                  setAddingComment(true);
                  setNewCommentContent("");
                }}
              >
                <Plus size={12} /> コメントを追加
              </button>
            )}
          </div>

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
