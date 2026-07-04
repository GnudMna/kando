import { useEffect, useRef } from "react";
import { Plus, FileText, X } from "lucide-react";
import type { Memo } from "../../api/boardApi";
import * as api from "../../api/boardApi";
import { invalidateMemoCache } from "./memoCache";

interface MemoLinkSectionProps {
  taskId: number;
  allMemos: Memo[] | null;
  linkedMemoIds: Set<number>;
  onLinkedMemoIdsChange: (updater: (prev: Set<number>) => Set<number>) => void;
  memoLinkError: string | null;
  onMemoLinkErrorChange: (error: string | null) => void;
  showMemoPicker: boolean;
  onShowMemoPickerChange: (show: boolean) => void;
}

/**
 * タスクに関連付けられたメモの表示・追加・解除 UI。
 */
export function MemoLinkSection({
  taskId,
  allMemos,
  linkedMemoIds,
  onLinkedMemoIdsChange,
  memoLinkError,
  onMemoLinkErrorChange,
  showMemoPicker,
  onShowMemoPickerChange,
}: MemoLinkSectionProps) {
  const pickerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!showMemoPicker) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
        onShowMemoPickerChange(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showMemoPicker, onShowMemoPickerChange]);

  return (
    <div className="modal-section">
      <div className="memo-link-header">
        <label className="modal-label">
          <FileText
            size={13}
            aria-hidden="true"
            style={{ verticalAlign: "middle", marginRight: "0.3rem" }}
          />
          関連メモ
        </label>
        {allMemos !== null &&
          allMemos.filter((m) => !linkedMemoIds.has(m.id)).length > 0 && (
            <div className="memo-picker-wrap" ref={pickerRef}>
              <button
                type="button"
                className="btn memo-picker-trigger"
                onClick={() => onShowMemoPickerChange(!showMemoPicker)}
                aria-expanded={showMemoPicker}
                aria-haspopup="listbox"
              >
                <Plus size={13} />
                メモを追加
              </button>
              {showMemoPicker && (
                <div
                  className="memo-picker-dropdown"
                  role="listbox"
                  aria-label="メモを選択"
                >
                  {allMemos
                    .filter((m) => !linkedMemoIds.has(m.id))
                    .map((memo) => (
                      <button
                        key={memo.id}
                        type="button"
                        className="memo-picker-item"
                        role="option"
                        aria-selected="false"
                        onClick={() => {
                          onMemoLinkErrorChange(null);
                          api
                            .linkMemoTask(memo.id, taskId)
                            .then(() => {
                              invalidateMemoCache();
                              onLinkedMemoIdsChange(
                                (prev) => new Set([...prev, memo.id]),
                              );
                              onShowMemoPickerChange(false);
                            })
                            .catch((err: unknown) => {
                              onMemoLinkErrorChange(
                                err instanceof Error
                                  ? err.message
                                  : "関連付けに失敗しました",
                              );
                            });
                        }}
                      >
                        <FileText size={12} aria-hidden="true" />
                        {memo.title.trim() || "（タイトルなし）"}
                      </button>
                    ))}
                </div>
              )}
            </div>
          )}
      </div>

      {allMemos === null && (
        <p className="text-muted" style={{ fontSize: "0.8rem" }}>
          読み込み中…
        </p>
      )}
      {allMemos !== null && allMemos.length === 0 && (
        <p className="text-muted" style={{ fontSize: "0.8rem" }}>
          メモがありません。メモ帳からメモを作成してください。
        </p>
      )}
      {memoLinkError && (
        <p
          style={{
            color: "var(--danger-color)",
            fontSize: "0.8rem",
            marginTop: "0.25rem",
          }}
        >
          {memoLinkError}
        </p>
      )}
      {allMemos !== null && linkedMemoIds.size > 0 && (
        <div className="memo-linked-chips">
          {allMemos
            .filter((m) => linkedMemoIds.has(m.id))
            .map((memo) => (
              <div key={memo.id} className="memo-linked-chip">
                <button
                  type="button"
                  className="memo-linked-chip-open"
                  aria-label={`「${memo.title || "メモ"}」を開く`}
                  onClick={() => {
                    window.dispatchEvent(
                      new CustomEvent("kando:open-memo", {
                        detail: { memoId: memo.id },
                      }),
                    );
                  }}
                >
                  <FileText size={11} aria-hidden="true" />
                  <span className="memo-linked-chip-title">
                    {memo.title.trim() || "（タイトルなし）"}
                  </span>
                </button>
                <button
                  type="button"
                  className="memo-linked-chip-remove"
                  aria-label={`「${memo.title || "メモ"}」の関連付けを解除`}
                  onClick={() => {
                    onMemoLinkErrorChange(null);
                    api
                      .unlinkMemoTask(memo.id, taskId)
                      .then(() => {
                        invalidateMemoCache();
                        onLinkedMemoIdsChange((prev) => {
                          const next = new Set(prev);
                          next.delete(memo.id);
                          return next;
                        });
                      })
                      .catch((err: unknown) => {
                        onMemoLinkErrorChange(
                          err instanceof Error
                            ? err.message
                            : "解除に失敗しました",
                        );
                      });
                  }}
                >
                  <X size={11} />
                </button>
              </div>
            ))}
        </div>
      )}
      {allMemos !== null && allMemos.length > 0 && linkedMemoIds.size === 0 && (
        <p className="text-muted" style={{ fontSize: "0.8rem" }}>
          関連付けられたメモはありません
        </p>
      )}
    </div>
  );
}
