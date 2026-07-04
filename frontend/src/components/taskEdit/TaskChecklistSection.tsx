import type { MutableRefObject } from "react";
import { Plus } from "lucide-react";
import type { LocalChecklistItem, TempId } from "../../types";
import { ChecklistItemRow } from "./ChecklistItemRow";
import { ChecklistInput } from "./ChecklistInput";

interface TaskChecklistSectionProps {
  items: LocalChecklistItem[];
  parentKey: "task" | number | TempId;
  subtaskContent?: string;
  listClassName?: string;
  listStyle?: React.CSSProperties;
  addButtonStyle?: React.CSSProperties;
  addingChecklist: "task" | number | TempId | null;
  newChecklistContent: string;
  onNewChecklistContentChange: (value: string) => void;
  onStartAdding: () => void;
  onCancelAdding: () => void;
  onAdd: () => void;
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
 * チェックリスト一覧と追加フォームを描画する。
 */
export function TaskChecklistSection({
  items,
  parentKey,
  subtaskContent,
  listClassName = "task-checklists",
  listStyle,
  addButtonStyle,
  addingChecklist,
  newChecklistContent,
  onNewChecklistContentChange,
  onStartAdding,
  onCancelAdding,
  onAdd,
  dragStateRef,
  dragOverKey,
  onDragOverKeyChange,
  onMove,
  onToggle,
  onRemove,
}: TaskChecklistSectionProps) {
  return (
    <>
      <div className={listClassName} style={listStyle}>
        {items.map((item, index) => (
          <ChecklistItemRow
            key={item.id}
            item={item}
            index={index}
            parentKey={parentKey}
            subtaskContent={subtaskContent}
            dragStateRef={dragStateRef}
            dragOverKey={dragOverKey}
            onDragOverKeyChange={onDragOverKeyChange}
            onMove={onMove}
            onToggle={onToggle}
            onRemove={onRemove}
          />
        ))}
      </div>
      {addingChecklist === parentKey ? (
        <div style={parentKey !== "task" ? { marginLeft: "1.25rem", marginTop: "0.25rem" } : undefined}>
          <ChecklistInput
            value={newChecklistContent}
            onChange={onNewChecklistContentChange}
            onAdd={onAdd}
            onCancel={onCancelAdding}
          />
        </div>
      ) : (
        <button
          type="button"
          className="text-btn text-muted"
          style={addButtonStyle ?? { marginTop: "0.5rem" }}
          onClick={onStartAdding}
        >
          <Plus size={12} /> チェック項目を追加
        </button>
      )}
    </>
  );
}
