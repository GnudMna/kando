import { CornerDownRight, Trash2 } from "lucide-react";
import type { LocalSubtask, TempId } from "../../types";
import type { MutableRefObject } from "react";
import { TaskChecklistSection } from "./TaskChecklistSection";

interface SubtaskCardProps {
  subtask: LocalSubtask;
  editingSubtaskId: number | TempId | null;
  editingSubtaskContent: string;
  onEditingSubtaskContentChange: (value: string) => void;
  onStartEditing: (subtask: LocalSubtask) => void;
  onSaveEdit: (subtaskId: number | TempId) => void;
  onCancelEdit: () => void;
  onRemove: (subtaskId: number | TempId) => void;
  addingChecklist: "task" | number | TempId | null;
  newChecklistContent: string;
  onNewChecklistContentChange: (value: string) => void;
  onStartAddingChecklist: (subtaskId: number | TempId) => void;
  onCancelAddingChecklist: () => void;
  onAddChecklist: (subtaskId: number | TempId) => void;
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
  onMoveChecklist: (
    parentKey: "task" | number | TempId,
    fromIndex: number,
    toIndex: number,
  ) => void;
  onToggleChecklist: (
    itemId: number | TempId,
    type: "task" | "subtask",
    subtaskId?: number | TempId | null,
  ) => void;
  onRemoveChecklist: (
    itemId: number | TempId,
    type: "task" | "subtask",
    subtaskId?: number | TempId | null,
  ) => void;
}

/**
 * サブタスク 1 件と配下チェックリストを描画する。
 */
export function SubtaskCard({
  subtask,
  editingSubtaskId,
  editingSubtaskContent,
  onEditingSubtaskContentChange,
  onStartEditing,
  onSaveEdit,
  onCancelEdit,
  onRemove,
  addingChecklist,
  newChecklistContent,
  onNewChecklistContentChange,
  onStartAddingChecklist,
  onCancelAddingChecklist,
  onAddChecklist,
  dragStateRef,
  dragOverKey,
  onDragOverKeyChange,
  onMoveChecklist,
  onToggleChecklist,
  onRemoveChecklist,
}: SubtaskCardProps) {
  return (
    <div className="subtask-card" style={{ marginBottom: "0.5rem" }}>
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
              onChange={(e) => onEditingSubtaskContentChange(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") onSaveEdit(subtask.id);
                if (e.key === "Escape") onCancelEdit();
              }}
              onBlur={() => onSaveEdit(subtask.id)}
            />
          ) : (
            <span
              className="subtask-title"
              style={{ cursor: "pointer", flex: 1 }}
              onClick={() => onStartEditing(subtask)}
              title="クリックして編集"
            >
              {subtask.content}
            </span>
          )}
        </div>
        <button
          type="button"
          className="action-btn"
          onClick={() => onRemove(subtask.id)}
          aria-label={`サブタスク「${subtask.content}」を削除`}
        >
          <Trash2 size={12} />
        </button>
      </div>

      <TaskChecklistSection
        items={subtask.checklists}
        parentKey={subtask.id}
        subtaskContent={subtask.content}
        listStyle={{ marginLeft: "1.25rem", marginTop: "0.25rem" }}
        addButtonStyle={{ marginLeft: "1.25rem", marginTop: "0.25rem" }}
        addingChecklist={addingChecklist}
        newChecklistContent={newChecklistContent}
        onNewChecklistContentChange={onNewChecklistContentChange}
        onStartAdding={() => onStartAddingChecklist(subtask.id)}
        onCancelAdding={onCancelAddingChecklist}
        onAdd={() => onAddChecklist(subtask.id)}
        dragStateRef={dragStateRef}
        dragOverKey={dragOverKey}
        onDragOverKeyChange={onDragOverKeyChange}
        onMove={onMoveChecklist}
        onToggle={onToggleChecklist}
        onRemove={onRemoveChecklist}
      />
    </div>
  );
}
