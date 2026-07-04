import { Plus } from "lucide-react";
import type { LocalSubtask, TempId } from "../../types";
import type { MutableRefObject } from "react";
import { SubtaskCard } from "./SubtaskCard";

interface SubtaskSectionProps {
  subtasks: LocalSubtask[];
  editingSubtaskId: number | TempId | null;
  editingSubtaskContent: string;
  onEditingSubtaskContentChange: (value: string) => void;
  onStartEditingSubtask: (subtask: LocalSubtask) => void;
  onSaveSubtaskEdit: (subtaskId: number | TempId) => void;
  onCancelSubtaskEdit: () => void;
  onRemoveSubtask: (subtaskId: number | TempId) => void;
  addingSubtask: boolean;
  newSubtaskContent: string;
  onNewSubtaskContentChange: (value: string) => void;
  onStartAddingSubtask: () => void;
  onCancelAddingSubtask: () => void;
  onAddSubtask: () => void;
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
 * サブタスク一覧と追加フォームを描画する。
 */
export function SubtaskSection({
  subtasks,
  editingSubtaskId,
  editingSubtaskContent,
  onEditingSubtaskContentChange,
  onStartEditingSubtask,
  onSaveSubtaskEdit,
  onCancelSubtaskEdit,
  onRemoveSubtask,
  addingSubtask,
  newSubtaskContent,
  onNewSubtaskContentChange,
  onStartAddingSubtask,
  onCancelAddingSubtask,
  onAddSubtask,
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
}: SubtaskSectionProps) {
  return (
    <div className="modal-section">
      <label className="modal-label">サブタスク</label>
      {subtasks.map((subtask) => (
        <SubtaskCard
          key={subtask.id}
          subtask={subtask}
          editingSubtaskId={editingSubtaskId}
          editingSubtaskContent={editingSubtaskContent}
          onEditingSubtaskContentChange={onEditingSubtaskContentChange}
          onStartEditing={onStartEditingSubtask}
          onSaveEdit={onSaveSubtaskEdit}
          onCancelEdit={onCancelSubtaskEdit}
          onRemove={onRemoveSubtask}
          addingChecklist={addingChecklist}
          newChecklistContent={newChecklistContent}
          onNewChecklistContentChange={onNewChecklistContentChange}
          onStartAddingChecklist={onStartAddingChecklist}
          onCancelAddingChecklist={onCancelAddingChecklist}
          onAddChecklist={onAddChecklist}
          dragStateRef={dragStateRef}
          dragOverKey={dragOverKey}
          onDragOverKeyChange={onDragOverKeyChange}
          onMoveChecklist={onMoveChecklist}
          onToggleChecklist={onToggleChecklist}
          onRemoveChecklist={onRemoveChecklist}
        />
      ))}

      {addingSubtask ? (
        <div className="add-sub-form" style={{ marginTop: "0.5rem" }}>
          <input
            autoFocus
            placeholder="サブタスク名..."
            className="task-content-input"
            style={{ fontSize: "0.85rem" }}
            value={newSubtaskContent}
            onChange={(e) => onNewSubtaskContentChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") onAddSubtask();
              if (e.key === "Escape") onCancelAddingSubtask();
            }}
          />
          <div className="form-actions">
            <button
              type="button"
              className="btn btn-primary"
              style={{ padding: "0.25rem 0.5rem", fontSize: "0.75rem" }}
              onClick={onAddSubtask}
            >
              追加
            </button>
            <button
              type="button"
              className="btn"
              style={{ padding: "0.25rem 0.5rem", fontSize: "0.75rem" }}
              onClick={onCancelAddingSubtask}
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
          onClick={onStartAddingSubtask}
        >
          <Plus size={12} /> サブタスクを追加
        </button>
      )}
    </div>
  );
}
