import { useState, useRef, useEffect } from "react";
import type { Task, LocalTask, LocalSubtask, LocalChecklistItem, TempId } from "../types";
import type { Memo } from "../api/boardApi";
import * as api from "../api/boardApi";
import { normalizeDueDateValue } from "../utils/dueDate";
import { POSITION_GAP } from "../utils/constants";
import { tempId, isTemp } from "../utils/localId";
import {
  getCachedMemos,
  setCachedMemos,
} from "../components/taskEdit/memoCache";

interface UseTaskEditFormOptions {
  task: Task;
  onClose: (reason: "saved" | "dismiss") => void;
  onTaskUpdated: (task: Task) => void;
}

/**
 * TaskEditModal のローカル編集状態と保存ロジックを管理する。
 */
export function useTaskEditForm({
  task,
  onClose,
  onTaskUpdated,
}: UseTaskEditFormOptions) {
  const [localTask, setLocalTask] = useState<LocalTask>(() => {
    const cloned = structuredClone(task) as LocalTask;
    cloned.due_date = normalizeDueDateValue(cloned.due_date);
    return cloned;
  });
  const [editingSubtaskId, setEditingSubtaskId] = useState<
    number | TempId | null
  >(null);
  const [editingSubtaskContent, setEditingSubtaskContent] = useState("");
  const [newSubtaskContent, setNewSubtaskContent] = useState("");
  const [addingSubtask, setAddingSubtask] = useState(false);
  const [addingChecklist, setAddingChecklist] = useState<
    "task" | number | TempId | null
  >(null);
  const dragStateRef = useRef<{
    parentKey: "task" | number | TempId;
    index: number;
  } | null>(null);
  const [dragOverKey, setDragOverKey] = useState<{
    parentKey: "task" | number | TempId;
    index: number;
  } | null>(null);
  const [newChecklistContent, setNewChecklistContent] = useState("");
  const [saveError, setSaveError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [allMemos, setAllMemos] = useState<Memo[] | null>(() => getCachedMemos());
  const [linkedMemoIds, setLinkedMemoIds] = useState<Set<number>>(() => {
    const cached = getCachedMemos();
    if (!cached) return new Set<number>();
    return new Set(
      cached
        .filter((m) => m.tasks.some((t) => t.id === task.id))
        .map((m) => m.id),
    );
  });
  const [memoLinkError, setMemoLinkError] = useState<string | null>(null);
  const [showMemoPicker, setShowMemoPicker] = useState(false);

  useEffect(() => {
    if (getCachedMemos()) return;

    let cancelled = false;
    api
      .fetchMemos()
      .then((memos) => {
        if (cancelled) return;
        setCachedMemos(memos);
        setAllMemos(memos);
        const linked = new Set(
          memos
            .filter((m) => m.tasks.some((t) => t.id === task.id))
            .map((m) => m.id),
        );
        setLinkedMemoIds(linked);
      })
      .catch(() => {
        if (!cancelled) setAllMemos([]);
      });
    return () => {
      cancelled = true;
    };
  }, [task.id]);

  const saveAndClose = async () => {
    setSaveError(null);
    setIsSaving(true);
    try {
      const final: LocalTask = structuredClone(localTask) as LocalTask;
      final.due_date = normalizeDueDateValue(final.due_date);
      const payload: api.TaskSnapshotPayload = {
        content: final.content,
        due_date: final.due_date,
        completed: final.completed,
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

  const removeSubtask = (subId: number | TempId) => {
    setLocalTask((prev) => ({
      ...prev,
      subtasks: prev.subtasks.filter((s) => s.id !== subId),
    }));
  };

  const addChecklistItem = (
    type: "task" | "subtask",
    subtaskId: number | TempId | null = null,
  ) => {
    if (!newChecklistContent.trim()) return;
    setLocalTask((prev) => {
      if (type === "task") {
        const position = (prev.checklists.length + 1) * POSITION_GAP;
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
                    position: (s.checklists.length + 1) * POSITION_GAP,
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

  return {
    localTask,
    setLocalTask,
    editingSubtaskId,
    setEditingSubtaskId,
    editingSubtaskContent,
    setEditingSubtaskContent,
    newSubtaskContent,
    setNewSubtaskContent,
    addingSubtask,
    setAddingSubtask,
    addingChecklist,
    setAddingChecklist,
    dragStateRef,
    dragOverKey,
    setDragOverKey,
    newChecklistContent,
    setNewChecklistContent,
    saveError,
    isSaving,
    allMemos,
    linkedMemoIds,
    setLinkedMemoIds,
    memoLinkError,
    setMemoLinkError,
    showMemoPicker,
    setShowMemoPicker,
    saveAndClose,
    addSubtask,
    saveSubtaskEdit,
    removeSubtask,
    addChecklistItem,
    moveChecklistItem,
    toggleChecklist,
    removeChecklist,
  };
}
