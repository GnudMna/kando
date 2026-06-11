// メモ帳パネルコンポーネント
// メモの一覧表示・作成・編集・削除を管理する
import { useState, useEffect, useCallback, useRef } from "react";
import { Plus, Trash2, X, FileText } from "lucide-react";
import type { Memo } from "../api/boardApi";
import {
  fetchMemos,
  createMemo,
  updateMemo,
  deleteMemo,
} from "../api/boardApi";
import { useDraggable } from "../hooks/useDraggable";

const memoDateFormatter = new Intl.DateTimeFormat("ja-JP", {
  month: "short",
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

function formatDate(iso: string): string {
  return memoDateFormatter.format(new Date(iso));
}

interface MemoPanelProps {
  onClose: () => void;
  initialMemoId?: number;
}

const AUTOSAVE_DELAY_MS = 800;

/**
 * メモ帳パネル。
 * メモの一覧・作成・編集・削除・自動保存を提供する。
 */
export function MemoPanel({ onClose, initialMemoId }: MemoPanelProps) {
  const [memos, setMemos] = useState<Memo[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editContent, setEditContent] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // 自動保存タイマー
  const autosaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // 直前に保存済みの値（差分判定に使用）
  const savedRef = useRef<{ title: string; content: string } | null>(null);

  const selectedMemo = memos.find((m) => m.id === selectedId) ?? null;

  // 初回マウント時にメモ一覧を取得する
  useEffect(() => {
    let cancelled = false;
    fetchMemos()
      .then((data) => {
        if (cancelled) return;
        setMemos(data);
        const target = initialMemoId
          ? (data.find((m) => m.id === initialMemoId) ?? data[0])
          : data[0];
        if (target) {
          setSelectedId(target.id);
          setEditTitle(target.title);
          setEditContent(target.content);
          savedRef.current = { title: target.title, content: target.content };
        }
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "取得に失敗しました");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // initialMemoId はマウント時の初期選択にのみ使用するため依存配列に含めない
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // メモ選択時にエディターを初期化する
  const handleSelect = useCallback(
    (memo: Memo) => {
      // 未保存変更を即時保存してから切り替える
      if (autosaveTimer.current) {
        clearTimeout(autosaveTimer.current);
        autosaveTimer.current = null;
      }
      if (
        selectedId !== null &&
        savedRef.current &&
        (editTitle !== savedRef.current.title ||
          editContent !== savedRef.current.content)
      ) {
        updateMemo(selectedId, {
          title: editTitle,
          content: editContent,
        })
          .then((updated) => {
            setMemos((prev) =>
              prev.map((m) => (m.id === updated.id ? updated : m)),
            );
          })
          .catch(() => {});
      }
      setSelectedId(memo.id);
      setEditTitle(memo.title);
      setEditContent(memo.content);
      savedRef.current = { title: memo.title, content: memo.content };
    },
    [selectedId, editTitle, editContent],
  );

  // 自動保存をスケジュールする
  const scheduleAutosave = useCallback(
    (title: string, content: string) => {
      if (autosaveTimer.current) clearTimeout(autosaveTimer.current);
      autosaveTimer.current = setTimeout(async () => {
        if (selectedId === null) return;
        if (
          savedRef.current?.title === title &&
          savedRef.current?.content === content
        )
          return;
        setSaving(true);
        try {
          const updated = await updateMemo(selectedId, { title, content });
          setMemos((prev) =>
            prev.map((m) => (m.id === updated.id ? updated : m)),
          );
          savedRef.current = { title, content };
        } catch {
          // 自動保存失敗は静かに無視する
        } finally {
          setSaving(false);
        }
      }, AUTOSAVE_DELAY_MS);
    },
    [selectedId],
  );

  const handleTitleChange = useCallback(
    (value: string) => {
      setEditTitle(value);
      scheduleAutosave(value, editContent);
    },
    [editContent, scheduleAutosave],
  );

  const handleContentChange = useCallback(
    (value: string) => {
      setEditContent(value);
      scheduleAutosave(editTitle, value);
    },
    [editTitle, scheduleAutosave],
  );

  // 新しいメモを作成する
  const handleCreate = useCallback(async () => {
    try {
      const memo = await createMemo("新しいメモ", "");
      setMemos((prev) => [memo, ...prev]);
      setSelectedId(memo.id);
      setEditTitle(memo.title);
      setEditContent(memo.content);
      savedRef.current = { title: memo.title, content: memo.content };
    } catch (err) {
      setError(err instanceof Error ? err.message : "作成に失敗しました");
    }
  }, []);

  // メモを削除する
  const handleDelete = useCallback(
    async (id: number) => {
      try {
        await deleteMemo(id);
        const next = memos.filter((m) => m.id !== id);
        setMemos(next);
        if (selectedId === id) {
          if (next.length > 0) {
            setSelectedId(next[0].id);
            setEditTitle(next[0].title);
            setEditContent(next[0].content);
            savedRef.current = {
              title: next[0].title,
              content: next[0].content,
            };
          } else {
            setSelectedId(null);
            setEditTitle("");
            setEditContent("");
            savedRef.current = null;
          }
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "削除に失敗しました");
      }
    },
    [memos, selectedId],
  );

  // アンマウント時に未保存変更を保存する
  useEffect(() => {
    return () => {
      if (autosaveTimer.current) {
        clearTimeout(autosaveTimer.current);
      }
    };
  }, []);

  // パネルが開いている状態で kando:open-memo イベントを受け取ったらメモを切り替える
  useEffect(() => {
    const handler = (e: Event) => {
      const memoId = (e as CustomEvent<{ memoId: number }>).detail.memoId;
      const target = memos.find((m) => m.id === memoId);
      if (target) handleSelect(target);
    };
    window.addEventListener("kando:open-memo", handler);
    return () => window.removeEventListener("kando:open-memo", handler);
  }, [memos, handleSelect]);

  const { containerRef, onHandleMouseDown, posStyle, isDragging } =
    useDraggable();

  return (
    <div
      className="memo-panel"
      role="dialog"
      aria-label="メモ帳"
      style={posStyle}
      ref={containerRef}
    >
      {/* ヘッダー */}
      <div
        className="memo-panel-header drag-handle"
        onMouseDown={onHandleMouseDown}
        style={{ cursor: isDragging ? "grabbing" : "grab" }}
      >
        <div className="memo-panel-title">
          <FileText size={16} aria-hidden="true" />
          <span>メモ帳</span>
          {saving && (
            <span className="memo-saving-indicator" aria-live="polite">
              保存中…
            </span>
          )}
        </div>
        <div className="memo-panel-actions">
          <button
            type="button"
            className="btn memo-add-btn"
            onClick={handleCreate}
            aria-label="新しいメモを作成"
            title="新しいメモ"
          >
            <Plus size={15} />
          </button>
          <button
            type="button"
            className="btn memo-close-btn"
            onClick={onClose}
            aria-label="メモ帳を閉じる"
            title="閉じる"
          >
            <X size={15} />
          </button>
        </div>
      </div>

      {error && (
        <div className="memo-error" role="alert">
          {error}
          <button
            type="button"
            className="memo-error-dismiss"
            onClick={() => setError(null)}
            aria-label="エラーを閉じる"
          >
            <X size={12} />
          </button>
        </div>
      )}

      <div className="memo-panel-body">
        {/* サイドバー: メモ一覧 */}
        <div className="memo-list" role="list" aria-label="メモ一覧">
          {loading && <div className="memo-list-empty">読み込み中…</div>}
          {!loading && memos.length === 0 && (
            <div className="memo-list-empty">
              メモがありません。「＋」で作成してください。
            </div>
          )}
          {memos.map((memo) => (
            <div
              key={memo.id}
              className={`memo-list-item${selectedId === memo.id ? " memo-list-item--active" : ""}`}
              role="listitem"
              onClick={() => handleSelect(memo)}
              onKeyDown={(e) => e.key === "Enter" && handleSelect(memo)}
              tabIndex={0}
              aria-current={selectedId === memo.id ? "true" : undefined}
            >
              <div className="memo-list-item-title">
                {memo.title.trim() || "（タイトルなし）"}
              </div>
              <div className="memo-list-item-meta">
                {formatDate(memo.updated_at)}
                {memo.tasks.length > 0 && (
                  <span
                    className="memo-task-badge"
                    title={memo.tasks.map((t) => t.content).join(", ")}
                  >
                    {memo.tasks.length}件のタスク
                  </span>
                )}
              </div>
              <button
                type="button"
                className="memo-delete-btn"
                onClick={(e) => {
                  e.stopPropagation();
                  void handleDelete(memo.id);
                }}
                aria-label={`「${memo.title || "メモ"}」を削除`}
                title="削除"
              >
                <Trash2 size={12} />
              </button>
            </div>
          ))}
        </div>

        {/* エディター */}
        <div className="memo-editor">
          {selectedMemo === null && !loading ? (
            <div className="memo-editor-empty">
              メモを選択するか、新しいメモを作成してください。
            </div>
          ) : (
            <>
              <input
                type="text"
                className="memo-title-input"
                value={editTitle}
                onChange={(e) => handleTitleChange(e.target.value)}
                placeholder="タイトル"
                aria-label="メモタイトル"
                maxLength={255}
              />
              <textarea
                className="memo-content-input"
                value={editContent}
                onChange={(e) => handleContentChange(e.target.value)}
                placeholder="メモを入力…"
                aria-label="メモ内容"
              />
              {selectedMemo && selectedMemo.tasks.length > 0 && (
                <div className="memo-linked-tasks">
                  <div className="memo-linked-tasks-label">関連タスク</div>
                  <div className="memo-linked-tasks-list">
                    {selectedMemo.tasks.map((t) => (
                      <button
                        key={t.id}
                        type="button"
                        className="memo-linked-task-chip"
                        onClick={() => {
                          window.dispatchEvent(
                            new CustomEvent("kando:open-task", {
                              detail: { taskId: t.id },
                            }),
                          );
                        }}
                        aria-label={`「${t.content}」を開く`}
                      >
                        {t.content}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
