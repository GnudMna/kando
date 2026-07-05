import type { MutableRefObject } from "react";
import { CheckSquare, Square, GripVertical, Trash2 } from "lucide-react";
import type { LocalChecklistItem, TempId } from "../../types";

interface ChecklistItemRowProps {
  item: LocalChecklistItem;
  index: number;
  parentKey: "task" | number | TempId;
  subtaskContent?: string;
  dragStateRef: MutableRefObject<{
    parentKey: "task" | number | TempId;
    index: number;
  } | null>;
  dragOverKey: {
    parentKey: "task" | number | TempId;
    index: number;
  } | null;
  onDragOverKeyChange: (
    key: { parentKey: "task" | number | TempId; index: number } | null,
  ) => void;
  onMove: (
    parentKey: "task" | number | TempId,
    fromIndex: number,
    toIndex: number,
  ) => void;
  onToggle: (
    itemId: number | TempId,
    type: "task" | "subtask",
    subtaskId?: number | TempId | null,
  ) => void;
  onRemove: (
    itemId: number | TempId,
    type: "task" | "subtask",
    subtaskId?: number | TempId | null,
  ) => void;
}

/**
 * チェックリスト項目 1 行を描画する(ドラッグ並び替え対応)。
 * @param props - `ChecklistItemRowProps`(同ファイル interface を参照)
 * @returns チェックリスト項目行の JSX 要素
 */
export function ChecklistItemRow({
  item,
  index,
  parentKey,
  subtaskContent,
  dragStateRef,
  dragOverKey,
  onDragOverKeyChange,
  onMove,
  onToggle,
  onRemove,
}: ChecklistItemRowProps) {
  const type = parentKey === "task" ? "task" : "subtask";
  const subtaskId: number | TempId | null =
    parentKey === "task" ? null : parentKey;
  const toggleLabel =
    type === "task"
      ? `チェックリスト「${item.content}」を${item.completed ? "未完了" : "完了"}にする`
      : `サブタスク「${subtaskContent ?? ""}」のチェックリスト「${item.content}」を${item.completed ? "未完了" : "完了"}にする`;
  const removeLabel =
    type === "task"
      ? `チェックリスト「${item.content}」を削除`
      : `サブタスク「${subtaskContent ?? ""}」のチェックリスト「${item.content}」を削除`;

  return (
    <div
      className={[
        "checklist-item",
        dragOverKey?.parentKey === parentKey && dragOverKey.index === index
          ? "checklist-drag-over"
          : "",
      ]
        .join(" ")
        .trim()}
      draggable
      onDragStart={(e) => {
        e.dataTransfer.effectAllowed = "move";
        dragStateRef.current = { parentKey, index };
      }}
      onDragOver={(e) => {
        e.preventDefault();
        onDragOverKeyChange({ parentKey, index });
      }}
      onDrop={(e) => {
        e.preventDefault();
        if (dragStateRef.current?.parentKey === parentKey) {
          onMove(parentKey, dragStateRef.current.index, index);
        }
        dragStateRef.current = null;
        onDragOverKeyChange(null);
      }}
      onDragEnd={() => {
        dragStateRef.current = null;
        onDragOverKeyChange(null);
      }}
    >
      <span className="checklist-drag-handle" aria-hidden="true">
        <GripVertical size={12} />
      </span>
      <button
        type="button"
        className="checklist-toggle"
        onClick={() => onToggle(item.id, type, subtaskId)}
        aria-label={toggleLabel}
      >
        {item.completed ? (
          <CheckSquare size={14} className="accent" />
        ) : (
          <Square size={14} className="text-muted" />
        )}
      </button>
      <span
        className={
          item.completed
            ? "checklist-text completed text-muted"
            : "checklist-text"
        }
      >
        {item.content}
      </span>
      <button
        type="button"
        className="checklist-del modal-del-btn"
        onClick={() => onRemove(item.id, type, subtaskId)}
        aria-label={removeLabel}
      >
        <Trash2 size={12} />
      </button>
    </div>
  );
}
