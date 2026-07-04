import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { useTaskEditForm } from "../hooks/useTaskEditForm";
import * as api from "../api/boardApi";
import { invalidateMemoCache } from "../components/taskEdit/memoCache";
import {
  baseTask,
  taskWithChecklists,
  taskWithSubtasks,
} from "./testUtils";

vi.mock("../api/boardApi");

describe("useTaskEditForm", () => {
  const onClose = vi.fn();
  const onTaskUpdated = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    onClose.mockReset();
    onTaskUpdated.mockReset();
    vi.mocked(api.fetchMemos).mockResolvedValue([]);
  });

  const renderForm = (task = baseTask) =>
    renderHook(() =>
      useTaskEditForm({ task, onClose, onTaskUpdated }),
    );

  it("saveAndClose が saveTaskSnapshot を呼び出して成功時にコールバックする", async () => {
    const savedTask = { ...baseTask, content: "保存後" };
    vi.mocked(api.saveTaskSnapshot).mockResolvedValue(savedTask);

    const { result } = renderForm();
    act(() => {
      result.current.setLocalTask((prev) => ({ ...prev, content: "保存後" }));
    });

    await act(async () => {
      await result.current.saveAndClose();
    });

    expect(api.saveTaskSnapshot).toHaveBeenCalledWith(
      1,
      expect.objectContaining({ content: "保存後" }),
    );
    expect(onTaskUpdated).toHaveBeenCalledWith(savedTask);
    expect(onClose).toHaveBeenCalledWith("saved");
  });

  it("saveAndClose 失敗時に saveError をセットする", async () => {
    vi.mocked(api.saveTaskSnapshot).mockRejectedValue(new Error("network"));

    const { result } = renderForm();
    await act(async () => {
      await result.current.saveAndClose();
    });

    expect(result.current.saveError).toBe(
      "保存中にエラーが発生しました。再試行してください。",
    );
    expect(onClose).not.toHaveBeenCalled();
  });

  it("addSubtask がローカル状態にサブタスクを追加する", () => {
    const { result } = renderForm();

    act(() => {
      result.current.setNewSubtaskContent("新サブタスク");
    });
    act(() => {
      result.current.addSubtask();
    });

    expect(result.current.localTask.subtasks).toHaveLength(1);
    expect(result.current.localTask.subtasks[0].content).toBe("新サブタスク");
    expect(result.current.newSubtaskContent).toBe("");
  });

  it("removeSubtask がサブタスクを削除する", () => {
    const { result } = renderForm(taskWithSubtasks);

    act(() => {
      result.current.removeSubtask(201);
    });

    expect(result.current.localTask.subtasks).toHaveLength(0);
  });

  it("removeChecklist がタスク直下のチェックリストを削除する", () => {
    const { result } = renderForm(taskWithChecklists);

    act(() => {
      result.current.removeChecklist(101, "task");
    });

    expect(result.current.localTask.checklists).toHaveLength(1);
    expect(result.current.localTask.checklists[0].id).toBe(102);
  });

  it("toggleChecklist が完了状態を反転する", () => {
    const { result } = renderForm(taskWithChecklists);

    act(() => {
      result.current.toggleChecklist(101, "task");
    });

    expect(result.current.localTask.checklists[0].completed).toBe(true);
  });

  it("addChecklistItem がサブタスク配下にチェックリストを追加する", () => {
    const { result } = renderForm(taskWithSubtasks);

    act(() => {
      result.current.setNewChecklistContent("サブ配下チェック");
    });
    act(() => {
      result.current.addChecklistItem("subtask", 201);
    });

    expect(result.current.localTask.subtasks[0].checklists).toHaveLength(2);
    expect(result.current.localTask.subtasks[0].checklists[1].content).toBe(
      "サブ配下チェック",
    );
  });

  it("moveChecklistItem がチェックリストの順序を変更する", () => {
    const { result } = renderForm(taskWithChecklists);

    act(() => {
      result.current.moveChecklistItem("task", 0, 1);
    });

    expect(result.current.localTask.checklists[0].id).toBe(102);
    expect(result.current.localTask.checklists[1].id).toBe(101);
  });

  it("saveSubtaskEdit がサブタスク内容を更新する", () => {
    const { result } = renderForm(taskWithSubtasks);

    act(() => {
      result.current.setEditingSubtaskId(201);
      result.current.setEditingSubtaskContent("編集後サブタスク");
    });
    act(() => {
      result.current.saveSubtaskEdit(201);
    });

    expect(result.current.localTask.subtasks[0].content).toBe(
      "編集後サブタスク",
    );
    expect(result.current.editingSubtaskId).toBeNull();
  });

  it("一時 ID は保存ペイロードから除外される", async () => {
    vi.mocked(api.saveTaskSnapshot).mockResolvedValue(baseTask);

    const { result } = renderForm();
    act(() => {
      result.current.setNewSubtaskContent("新規サブ");
    });
    act(() => {
      result.current.addSubtask();
    });
    act(() => {
      result.current.setNewChecklistContent("新規チェック");
    });
    act(() => {
      result.current.addChecklistItem("task");
    });

    await act(async () => {
      await result.current.saveAndClose();
    });

    const payload = vi.mocked(api.saveTaskSnapshot).mock.calls[0][1];
    expect(payload.subtasks[0].id).toBeUndefined();
    expect(payload.checklists[0].id).toBeUndefined();
  });

  it("fetchMemos 成功時に allMemos を更新する", async () => {
    invalidateMemoCache();
    vi.spyOn(Date, "now").mockReturnValue(Number.MAX_SAFE_INTEGER + 200_000);
    vi.mocked(api.fetchMemos).mockResolvedValue([
      {
        id: 1,
        user_id: 1,
        title: "メモ",
        content: "内容",
        created_at: "2026-01-01T00:00:00.000Z",
        updated_at: "2026-01-01T00:00:00.000Z",
        tasks: [],
      },
    ]);

    const { result } = renderForm();

    await waitFor(() => {
      expect(result.current.allMemos).toHaveLength(1);
    });
  });
});
