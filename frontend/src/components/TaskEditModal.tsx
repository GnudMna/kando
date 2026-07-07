import { useId } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { useDraggable } from "../hooks/useDraggable";
import { useTaskEditForm } from "../hooks/useTaskEditForm";
import type { Task } from "../types";
import { CommentSection } from "./CommentSection";
import { TaskDetailsFields } from "./taskEdit/TaskDetailsFields";
import { TaskChecklistSection } from "./taskEdit/TaskChecklistSection";
import { SubtaskSection } from "./taskEdit/SubtaskSection";
import { MemoLinkSection } from "./taskEdit/MemoLinkSection";

/** `TaskEditModal` コンポーネントの props。 */
interface Props {
  task: Task;
  onClose: (reason: "saved" | "dismiss") => void;
  onTaskUpdated: (task: Task) => void;
}

/**
 * タスク詳細を編集するモーダルコンポーネント。
 * チェックリスト・サブタスク・コメント・メモ連携を含む編集内容を保存時に API へ一括反映する。
 * @param task - 編集対象タスク
 * @param onClose - モーダル終了コールバック(保存または破棄の理由を渡す)
 * @param onTaskUpdated - 保存後のタスク更新コールバック
 * @returns タスク編集モーダルの JSX 要素
 */
export function TaskEditModal({ task, onClose, onTaskUpdated }: Props) {
  const form = useTaskEditForm({ task, onClose, onTaskUpdated });
  const { containerRef, onHandleMouseDown, posStyle, isDragged, isDragging } =
    useDraggable();
  const modalTitleId = useId();
  const taskContentInputId = useId();
  const taskDueDateInputId = useId();

  return createPortal(
    <div
      className="modal-overlay"
      style={
        isDragged
          ? {
              background: "transparent",
              backdropFilter: "none",
              pointerEvents: "none",
            }
          : undefined
      }
    >
      <div
        className="modal-content"
        ref={containerRef}
        style={{ ...posStyle, pointerEvents: "auto" }}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby={modalTitleId}
      >
        <div
          className="modal-header drag-handle"
          onMouseDown={onHandleMouseDown}
          style={{ cursor: isDragging ? "grabbing" : "grab" }}
        >
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
          <TaskDetailsFields
            localTask={form.localTask}
            onLocalTaskChange={form.setLocalTask}
            taskContentInputId={taskContentInputId}
            taskDueDateInputId={taskDueDateInputId}
          />

          <CommentSection
            comments={form.localTask.comments}
            taskId={task.id}
            onCommentsChange={(newComments) =>
              form.setLocalTask((prev) => ({ ...prev, comments: newComments }))
            }
          />

          <div className="modal-section">
            <label className="modal-label">チェックリスト</label>
            <TaskChecklistSection
              items={form.localTask.checklists}
              parentKey="task"
              addingChecklist={form.addingChecklist}
              newChecklistContent={form.newChecklistContent}
              onNewChecklistContentChange={form.setNewChecklistContent}
              onStartAdding={() => {
                form.setAddingChecklist("task");
                form.setNewChecklistContent("");
              }}
              onCancelAdding={() => {
                form.setAddingChecklist(null);
                form.setNewChecklistContent("");
              }}
              onAdd={() => form.addChecklistItem("task")}
              dragStateRef={form.dragStateRef}
              dragOverKey={form.dragOverKey}
              onDragOverKeyChange={form.setDragOverKey}
              onMove={form.moveChecklistItem}
              onToggle={form.toggleChecklist}
              onRemove={form.removeChecklist}
            />
          </div>

          <SubtaskSection
            subtasks={form.localTask.subtasks}
            editingSubtaskId={form.editingSubtaskId}
            editingSubtaskContent={form.editingSubtaskContent}
            onEditingSubtaskContentChange={form.setEditingSubtaskContent}
            onStartEditingSubtask={(subtask) => {
              form.setEditingSubtaskId(subtask.id);
              form.setEditingSubtaskContent(subtask.content);
            }}
            onSaveSubtaskEdit={form.saveSubtaskEdit}
            onCancelSubtaskEdit={() => form.setEditingSubtaskId(null)}
            onRemoveSubtask={form.removeSubtask}
            addingSubtask={form.addingSubtask}
            newSubtaskContent={form.newSubtaskContent}
            onNewSubtaskContentChange={form.setNewSubtaskContent}
            onStartAddingSubtask={() => form.setAddingSubtask(true)}
            onCancelAddingSubtask={() => {
              form.setAddingSubtask(false);
              form.setNewSubtaskContent("");
            }}
            onAddSubtask={form.addSubtask}
            addingChecklist={form.addingChecklist}
            newChecklistContent={form.newChecklistContent}
            onNewChecklistContentChange={form.setNewChecklistContent}
            onStartAddingChecklist={(subtaskId) => {
              form.setAddingChecklist(subtaskId);
              form.setNewChecklistContent("");
            }}
            onCancelAddingChecklist={() => {
              form.setAddingChecklist(null);
              form.setNewChecklistContent("");
            }}
            onAddChecklist={(subtaskId) =>
              form.addChecklistItem("subtask", subtaskId)
            }
            dragStateRef={form.dragStateRef}
            dragOverKey={form.dragOverKey}
            onDragOverKeyChange={form.setDragOverKey}
            onMoveChecklist={form.moveChecklistItem}
            onToggleChecklist={form.toggleChecklist}
            onRemoveChecklist={form.removeChecklist}
          />

          <MemoLinkSection
            taskId={task.id}
            allMemos={form.allMemos}
            linkedMemoIds={form.linkedMemoIds}
            onLinkedMemoIdsChange={form.setLinkedMemoIds}
            memoLinkError={form.memoLinkError}
            onMemoLinkErrorChange={form.setMemoLinkError}
            showMemoPicker={form.showMemoPicker}
            onShowMemoPickerChange={form.setShowMemoPicker}
          />
        </div>

        <div className="modal-footer">
          {form.saveError && (
            <span
              style={{
                color: "var(--danger, #e53e3e)",
                fontSize: "0.85rem",
                flex: 1,
              }}
            >
              {form.saveError}
            </span>
          )}
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => void form.saveAndClose()}
            disabled={form.isSaving || form.isLoadingDetails}
          >
            {form.isSaving
              ? "保存中..."
              : form.isLoadingDetails
                ? "読み込み中..."
                : "保存して閉じる"}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
