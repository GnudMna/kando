// コメントの表示・追加・編集・削除・並び替えを担当するコンポーネント
import { useState, useRef, useMemo, type ReactNode } from "react";
import { Trash2, Plus, GripVertical } from "lucide-react";
import type { LocalTaskComment, TempId } from "../types";
import { POSITION_GAP } from "../utils/constants";
import { tempId } from "../utils/localId";

const URL_REGEX = /https?:\/\/[^\s<>'"]+/g;

/**
 * 文字列を改行で分割し、`<br>` 要素を挿入した ReactNode 配列を返す。
 * @param segment - 改行分割する文字列
 * @param keyPrefix - key 属性のプレフィックス（重複回避に使用）
 * @returns 改行配置済みの ReactNode 配列
 */
function renderLineBreaks(segment: string, keyPrefix: string): ReactNode[] {
  return segment
    .split("\n")
    .flatMap((line, i, arr) =>
      i < arr.length - 1 ? [line, <br key={`${keyPrefix}-br-${i}`} />] : [line],
    );
}

/**
 * テキスト内の URL をクリック可能な `<a>` リンクに変換した ReactNode 配列を返す。
 * @param text - リンク展開する元のテキスト
 * @returns URL を `<a>` に置換した ReactNode 配列
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
 * ISO 日時文字列を `ja-JP` ロケールの表示文字列に変換する。
 * @param value - 変換対象の ISO 日時文字列
 * @returns ロケール変換済み表示文字列。変換できない場合は `"時刻不明"`
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

interface CommentSectionProps {
  comments: LocalTaskComment[];
  taskId: number;
  onCommentsChange: (comments: LocalTaskComment[]) => void;
}

/**
 * コメントの表示・追加・編集・削除・並び替えを担当するコンポーネント。
 * @param comments - 表示・編集対象のコメント配列
 * @param taskId - 親タスク ID（新規コメント作成時に使用）
 * @param onCommentsChange - コメント配列を更新するコールバック
 * @returns コメントセクションの JSX 要素
 */
export function CommentSection({
  comments,
  taskId,
  onCommentsChange,
}: CommentSectionProps) {
  const [commentSortMode, setCommentSortMode] =
    useState<CommentSortMode>("newest");
  const commentDragFromIndex = useRef<number | null>(null);
  const [commentDragOverIndex, setCommentDragOverIndex] = useState<
    number | null
  >(null);
  const [editingCommentId, setEditingCommentId] = useState<
    number | TempId | null
  >(null);
  const [editingCommentContent, setEditingCommentContent] = useState("");
  const [newCommentContent, setNewCommentContent] = useState("");
  const [addingComment, setAddingComment] = useState(false);

  /**
   * 入力テキストから新規コメントを作成してリストに追加する。
   * @returns なし
   */
  const addComment = () => {
    const content = newCommentContent.trim();
    if (!content) return;

    const newComment: LocalTaskComment = {
      id: tempId(),
      task_id: taskId,
      content,
      created_at: new Date().toISOString(),
      position: (comments.length + 1) * POSITION_GAP,
    };
    onCommentsChange([...comments, newComment]);
    setNewCommentContent("");
    setAddingComment(false);
  };

  /**
   * コメントのインライン編集を開始する。
   * @param commentId - 編集対象コメント ID
   * @param content - 編集初期内容
   * @returns なし
   */
  const beginCommentEdit = (commentId: number | TempId, content: string) => {
    setEditingCommentId(commentId);
    setEditingCommentContent(content);
  };

  /**
   * 編集内容をコメント配列に保存してインライン編集を終了する。
   * 内容が空の場合は保存せず履歴を維持する。
   * @param commentId - 保存対象コメント ID
   * @returns なし
   */
  const saveCommentEdit = (commentId: number | TempId) => {
    const content = editingCommentContent.trim();
    if (!content) {
      setEditingCommentId(null);
      setEditingCommentContent("");
      return;
    }
    onCommentsChange(
      comments.map((comment) =>
        comment.id === commentId ? { ...comment, content } : comment,
      ),
    );
    setEditingCommentId(null);
    setEditingCommentContent("");
  };

  /**
   * インライン編集をキャンセルして編集状態をリセットする。
   * @returns なし
   */
  const cancelCommentEdit = () => {
    setEditingCommentId(null);
    setEditingCommentContent("");
  };

  /**
   * 指定 ID のコメントをリストから削除する。
   * @param commentId - 削除対象コメント ID
   * @returns なし
   */
  const removeComment = (commentId: number | TempId) => {
    onCommentsChange(comments.filter((comment) => comment.id !== commentId));
    if (editingCommentId === commentId) {
      cancelCommentEdit();
    }
  };

  /**
   * ソートモードに応じた表示用コメント配列を返す。
   * manual モードは元の順を保持し、oldest/newest は作成日時でソートする。
   */
  const visibleComments = useMemo(() => {
    const withIndex = comments.map((comment, index) => ({
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
  }, [comments, commentSortMode]);

  /**
   * 手動ソートモードのときだけコメントの順序を入れ替える。
   * @param fromIndex - 移動元インデックス
   * @param toIndex - 移動先インデックス
   * @returns なし
   */
  const moveCommentInManualMode = (fromIndex: number, toIndex: number) => {
    if (commentSortMode !== "manual" || fromIndex === toIndex) return;

    const newComments = [...comments];
    const [moved] = newComments.splice(fromIndex, 1);
    newComments.splice(toIndex, 0, moved);
    onCommentsChange(newComments);
  };

  return (
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
                moveCommentInManualMode(commentDragFromIndex.current, index);
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
                    <span className="comment-drag-handle" aria-hidden="true">
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
                <div className="add-sub-form" style={{ marginTop: "0.2rem" }}>
                  <textarea
                    className="task-content-input"
                    style={{ resize: "vertical" }}
                    rows={3}
                    autoFocus
                    value={editingCommentContent}
                    onChange={(e) => setEditingCommentContent(e.target.value)}
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
  );
}
