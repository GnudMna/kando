import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { Plus, Trash2, X, FileText } from "lucide-react";
import { updateMemo, type Memo } from "../api/memos";
import { useMemoMutations, useMemosQuery } from "../hooks/useMemos";
import { useDraggable } from "../hooks/useDraggable";
import { useAppNavigation } from "../providers/useAppNavigation";

const memoDateFormatter = new Intl.DateTimeFormat("ja-JP", {
  month: "short",
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

/**
 * ISO 日時文字列をメモ一覧向けの短い表示形式へ変換する。
 * @param iso - ISO 8601 形式の日時文字列
 * @returns `ja-JP` ロケールの表示文字列
 */
function formatDate(iso: string): string {
  return memoDateFormatter.format(new Date(iso));
}

/** `MemoPanel` コンポーネントの props。 */
interface MemoPanelProps {
  /** パネルを閉じるコールバック */
  onClose: () => void;
}

const AUTOSAVE_DELAY_MS = 800;

type MemoDraft = {
  id: number;
  title: string;
  content: string;
};

function resolveInitialTarget(
  memos: Memo[],
  initialMemoId?: number,
): Memo | null {
  if (memos.length === 0) return null;
  if (initialMemoId != null) {
    return memos.find((m) => m.id === initialMemoId) ?? memos[0];
  }
  return memos[0];
}

/**
 * メモ帳パネル。
 * メモの一覧・作成・編集・削除・自動保存を提供する。
 * @param onClose - パネルを閉じるコールバック
 * @returns メモ帳パネルの JSX 要素
 */
export function MemoPanel({ onClose }: MemoPanelProps) {
  const { data: memos = [], isLoading, error: queryError } = useMemosQuery();
  const { create, update, remove } = useMemoMutations();
  const { activeMemoId, openTask, registerSelectMemoHandler } =
    useAppNavigation();
  const updateMutationRef = useRef(update);
  const createMutationRef = useRef(create);
  const removeMutationRef = useRef(remove);

  useEffect(() => {
    updateMutationRef.current = update;
    createMutationRef.current = create;
    removeMutationRef.current = remove;
  }, [update, create, remove]);

  const initialTarget = useMemo(
    () => resolveInitialTarget(memos, activeMemoId ?? undefined),
    [memos, activeMemoId],
  );

  const [userDraft, setUserDraft] = useState<MemoDraft | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<{
    memoId: number;
    message: string;
  } | null>(null);
  const [saving, setSaving] = useState(false);

  const selectedId = userDraft?.id ?? initialTarget?.id ?? null;
  const editTitle = userDraft?.title ?? initialTarget?.title ?? "";
  const editContent = userDraft?.content ?? initialTarget?.content ?? "";

  const autosaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const savedRef = useRef<{ title: string; content: string } | null>(null);
  const selectedIdRef = useRef<number | null>(null);
  const draftRef = useRef({ title: "", content: "" });
  // 保存リクエストを直列化するためのチェーン(古いリクエストが後着して上書きするのを防ぐ)
  const saveChainRef = useRef<Promise<void>>(Promise.resolve());
  const pendingSavesRef = useRef(0);
  const saveErrorRef = useRef(saveError);

  const selectedMemo = memos.find((m) => m.id === selectedId) ?? null;
  const memosRef = useRef(memos);
  const loading = isLoading;
  const displayError =
    error ??
    saveError?.message ??
    (queryError instanceof Error
      ? queryError.message
      : queryError
        ? "取得に失敗しました"
        : null);

  useEffect(() => {
    selectedIdRef.current = selectedId;
  }, [selectedId]);

  useEffect(() => {
    saveErrorRef.current = saveError;
  }, [saveError]);

  useEffect(() => {
    draftRef.current = { title: editTitle, content: editContent };
  }, [editTitle, editContent]);

  useEffect(() => {
    if (selectedId === null || savedRef.current !== null) return;
    savedRef.current = { title: editTitle, content: editContent };
  }, [selectedId, editTitle, editContent]);

  const applyDraft = useCallback((draft: MemoDraft) => {
    setUserDraft(draft);
    savedRef.current = { title: draft.title, content: draft.content };
  }, []);

  /**
   * メモを保存する。リクエストは直列化され、先に発行した保存が必ず先に完了する。
   * 失敗時は `saveError` に記録し、`savedRef` を更新しない(未保存のまま残す)。
   * @param memoId - 保存対象のメモ ID
   * @param title - 保存するタイトル
   * @param content - 保存する内容
   * @returns 保存の完了(失敗しても reject しない)
   */
  const persist = useCallback(
    (memoId: number, title: string, content: string): Promise<void> => {
      pendingSavesRef.current += 1;
      setSaving(true);
      const run = async () => {
        try {
          await updateMutationRef.current.mutateAsync({
            id: memoId,
            patch: { title, content },
          });
          // 保存中に別メモへ切り替わっていた場合、現在のメモの保存済み状態を壊さない
          if (selectedIdRef.current === memoId) {
            savedRef.current = { title, content };
          }
          setSaveError((prev) => (prev?.memoId === memoId ? null : prev));
        } catch (err) {
          const label =
            memosRef.current.find((m) => m.id === memoId)?.title.trim() ||
            "無題のメモ";
          const reason = err instanceof Error ? err.message : "不明なエラー";
          setSaveError({
            memoId,
            message: `「${label}」の保存に失敗しました(${reason})。内容は保存されていません`,
          });
        } finally {
          pendingSavesRef.current -= 1;
          if (pendingSavesRef.current === 0) setSaving(false);
        }
      };
      const next = saveChainRef.current.then(run);
      saveChainRef.current = next;
      return next;
    },
    [],
  );

  const handleSelect = useCallback(
    (memo: Memo) => {
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
        void persist(selectedId, editTitle, editContent);
      }
      setUserDraft({
        id: memo.id,
        title: memo.title,
        content: memo.content,
      });
      savedRef.current = { title: memo.title, content: memo.content };
    },
    [selectedId, editTitle, editContent, persist],
  );

  const scheduleAutosave = useCallback(() => {
    if (autosaveTimer.current) clearTimeout(autosaveTimer.current);
    autosaveTimer.current = setTimeout(() => {
      autosaveTimer.current = null;
      const memoId = selectedIdRef.current;
      const { title, content } = draftRef.current;
      if (memoId === null) return;
      if (
        savedRef.current?.title === title &&
        savedRef.current?.content === content
      ) {
        return;
      }
      void persist(memoId, title, content);
    }, AUTOSAVE_DELAY_MS);
  }, [persist]);

  const flushPendingSave = useCallback(() => {
    if (autosaveTimer.current) {
      clearTimeout(autosaveTimer.current);
      autosaveTimer.current = null;
    }
    const memoId = selectedIdRef.current;
    const { title, content } = draftRef.current;
    if (memoId === null || !savedRef.current) return;
    if (
      savedRef.current.title === title &&
      savedRef.current.content === content
    )
      return;
    void persist(memoId, title, content);
  }, [persist]);

  const handleTitleChange = useCallback(
    (value: string) => {
      if (selectedId === null) return;
      setUserDraft((prev) => ({
        id: selectedId,
        title: value,
        content: prev?.content ?? editContent,
      }));
      draftRef.current = { title: value, content: draftRef.current.content };
      scheduleAutosave();
    },
    [selectedId, editContent, scheduleAutosave],
  );

  const handleContentChange = useCallback(
    (value: string) => {
      if (selectedId === null) return;
      setUserDraft((prev) => ({
        id: selectedId,
        title: prev?.title ?? editTitle,
        content: value,
      }));
      draftRef.current = { title: draftRef.current.title, content: value };
      scheduleAutosave();
    },
    [selectedId, editTitle, scheduleAutosave],
  );

  const handleCreate = useCallback(async () => {
    try {
      const memo = await createMutationRef.current.mutateAsync({
        title: "新しいメモ",
        content: "",
      });
      applyDraft({
        id: memo.id,
        title: memo.title,
        content: memo.content,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "作成に失敗しました");
    }
  }, [applyDraft]);

  const handleDelete = useCallback(
    async (id: number) => {
      try {
        await removeMutationRef.current.mutateAsync(id);
        const next = memos.filter((m) => m.id !== id);
        if (selectedId === id) {
          if (next.length > 0) {
            applyDraft({
              id: next[0].id,
              title: next[0].title,
              content: next[0].content,
            });
          } else {
            setUserDraft(null);
            savedRef.current = null;
          }
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "削除に失敗しました");
      }
    },
    [memos, selectedId, applyDraft],
  );

  useEffect(() => {
    return () => {
      flushPendingSave();
    };
  }, [flushPendingSave]);

  useEffect(() => {
    // タブを閉じる/リロードする際、デバウンス待ちや保存失敗中の入力を keepalive で送り直す
    const handlePageLeave = (e: BeforeUnloadEvent | PageTransitionEvent) => {
      const memoId = selectedIdRef.current;
      const { title, content } = draftRef.current;
      const saved = savedRef.current;
      const dirty =
        memoId !== null &&
        saved !== null &&
        (saved.title !== title || saved.content !== content);
      if (dirty) {
        void updateMemo(memoId, { title, content }, { keepalive: true }).catch(
          () => {},
        );
      }
      // 既に保存失敗が通知されている場合は、離脱前にブラウザの確認ダイアログで警告する
      if (e.type === "beforeunload" && dirty && saveErrorRef.current) {
        e.preventDefault();
      }
    };
    window.addEventListener("beforeunload", handlePageLeave);
    window.addEventListener("pagehide", handlePageLeave);
    return () => {
      window.removeEventListener("beforeunload", handlePageLeave);
      window.removeEventListener("pagehide", handlePageLeave);
    };
  }, []);

  useEffect(() => {
    memosRef.current = memos;
  }, [memos]);

  useEffect(() => {
    return registerSelectMemoHandler((memoId) => {
      const target = memosRef.current.find((m) => m.id === memoId);
      if (target) handleSelect(target);
    });
  }, [registerSelectMemoHandler, handleSelect]);

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
            onClick={() => void handleCreate()}
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

      {displayError && (
        <div className="memo-error" role="alert">
          {displayError}
          <button
            type="button"
            className="memo-error-dismiss"
            onClick={() => {
              setError(null);
              setSaveError(null);
            }}
            aria-label="エラーを閉じる"
          >
            <X size={12} />
          </button>
        </div>
      )}

      <div className="memo-panel-body">
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
                        onClick={() => openTask(t.id)}
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
