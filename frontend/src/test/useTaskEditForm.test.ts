import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { useTaskEditForm } from "../hooks/useTaskEditForm";
import * as api from "../api/boardApi";
import * as tasksApi from "../api/tasks";
import * as memosApi from "../api/memos";
import {
  baseTask,
  taskWithChecklists,
  taskWithSubtasks,
  createQueryWrapper,
} from "./testUtils";
import type { Memo } from "../api/boardApi";
import type { Task } from "../types";

vi.mock("../api/boardApi");
vi.mock("../api/memos");

describe("useTaskEditForm", () => {
  const onClose = vi.fn();
  const onTaskUpdated = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    onClose.mockReset();
    onTaskUpdated.mockReset();
    vi.mocked(memosApi.fetchMemos).mockResolvedValue([]);
    vi.spyOn(tasksApi, "fetchTask").mockResolvedValue(baseTask);
  });

  const renderForm = (task = baseTask) =>
    renderHook(() => useTaskEditForm({ task, onClose, onTaskUpdated }), {
      wrapper: createQueryWrapper(),
    });

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

  describe("下書き(onCreate 指定)", () => {
    const draftTask: Task = { ...baseTask, id: 0, revision: 0 };
    const onCreate = vi.fn();

    beforeEach(() => {
      onCreate.mockReset();
    });

    const renderDraft = () =>
      renderHook(
        () =>
          useTaskEditForm({ task: draftTask, onClose, onTaskUpdated, onCreate }),
        { wrapper: createQueryWrapper() },
      );

    it("保存時は saveTaskSnapshot ではなく onCreate を呼ぶ", async () => {
      const created = { ...baseTask, id: 50 };
      onCreate.mockResolvedValue(created);

      const { result } = renderDraft();
      act(() => {
        result.current.setLocalTask((prev) => ({ ...prev, content: "新規" }));
      });
      await act(async () => {
        await result.current.saveAndClose();
      });

      expect(onCreate).toHaveBeenCalledWith(
        expect.objectContaining({ content: "新規" }),
        [],
      );
      expect(api.saveTaskSnapshot).not.toHaveBeenCalled();
      expect(onTaskUpdated).toHaveBeenCalledWith(created);
      expect(onClose).toHaveBeenCalledWith("saved");
    });

    it("onCreate 失敗時はモーダルを閉じず saveError をセットする", async () => {
      onCreate.mockRejectedValue(new Error("network"));

      const { result } = renderDraft();
      await act(async () => {
        await result.current.saveAndClose();
      });

      expect(onClose).not.toHaveBeenCalled();
      expect(result.current.saveError).toBe(
        "保存中にエラーが発生しました。再試行してください。",
      );
    });
  });

  it("サマリータスクは詳細読み込み完了前に保存しない", async () => {
    const summaryTask: Task = {
      ...taskWithChecklists,
      checklists: [],
      checklist_count: 2,
    };
    vi.spyOn(tasksApi, "fetchTask").mockImplementation(
      () =>
        new Promise(() => {
          /* 意図的に未解決 */
        }),
    );

    const { result } = renderForm(summaryTask);

    await act(async () => {
      await result.current.saveAndClose();
    });

    expect(api.saveTaskSnapshot).not.toHaveBeenCalled();
    expect(result.current.saveError).toBe(
      "タスク詳細の読み込み中です。完了してから保存してください。",
    );
  });

  it("サマリータスクは詳細取得後にチェックリスト付きで保存する", async () => {
    const summaryTask: Task = {
      ...taskWithChecklists,
      checklists: [],
      checklist_count: 2,
    };
    vi.spyOn(tasksApi, "fetchTask").mockResolvedValue(taskWithChecklists);
    vi.mocked(api.saveTaskSnapshot).mockResolvedValue(taskWithChecklists);

    const { result } = renderForm(summaryTask);

    await waitFor(() => {
      expect(result.current.isLoadingDetails).toBe(false);
    });

    await act(async () => {
      await result.current.saveAndClose();
    });

    expect(tasksApi.fetchTask).toHaveBeenCalledWith(summaryTask.id);
    expect(api.saveTaskSnapshot).toHaveBeenCalledWith(
      summaryTask.id,
      expect.objectContaining({
        checklists: expect.arrayContaining([
          expect.objectContaining({ id: 101 }),
        ]),
      }),
    );
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

  describe("関連メモ", () => {
    const makeMemo = (id: number, taskIds: number[]): Memo => ({
      id,
      user_id: 1,
      title: `メモ${id}`,
      content: "内容",
      created_at: "2026-01-01T00:00:00.000Z",
      updated_at: "2026-01-01T00:00:00.000Z",
      tasks: taskIds.map((tid) => ({ id: tid, content: "タスク" })),
    });

    beforeEach(() => {
      vi.mocked(memosApi.fetchMemos).mockResolvedValue([
        makeMemo(1, [baseTask.id]),
        makeMemo(2, []),
        makeMemo(3, []),
      ]);
      vi.mocked(memosApi.linkMemoTask).mockResolvedValue(makeMemo(2, []));
      vi.mocked(memosApi.unlinkMemoTask).mockResolvedValue(makeMemo(1, []));
      vi.mocked(api.saveTaskSnapshot).mockResolvedValue(baseTask);
    });

    const renderLoaded = async () => {
      const rendered = renderForm();
      await waitFor(() => {
        expect(rendered.result.current.allMemos).toHaveLength(3);
      });
      return rendered;
    };

    it("取得したメモ一覧から関連付け済みメモ ID を導出する", async () => {
      const { result } = await renderLoaded();
      expect([...result.current.linkedMemoIds]).toEqual([1]);
    });

    it("メモ一覧の取得に失敗するとエラーを返し allMemos は空になる", async () => {
      vi.mocked(memosApi.fetchMemos).mockRejectedValue(new Error("x"));
      const { result } = renderForm();
      await waitFor(() => {
        expect(result.current.memoLinkError).toBe(
          "メモ一覧の読み込みに失敗しました",
        );
      });
      expect(result.current.allMemos).toEqual([]);
    });

    it("選択を変更しても保存するまで API を呼ばない", async () => {
      const { result } = await renderLoaded();
      act(() => {
        result.current.setLinkedMemoIds((prev) => new Set([...prev, 2]));
      });

      expect(result.current.linkedMemoIds.has(2)).toBe(true);
      expect(memosApi.linkMemoTask).not.toHaveBeenCalled();
      expect(memosApi.unlinkMemoTask).not.toHaveBeenCalled();
    });

    it("保存時に追加・解除の差分だけを反映する", async () => {
      const { result } = await renderLoaded();
      act(() => {
        result.current.setLinkedMemoIds(() => new Set([2, 3]));
      });

      await act(async () => {
        await result.current.saveAndClose();
      });

      expect(memosApi.linkMemoTask).toHaveBeenCalledTimes(2);
      expect(memosApi.linkMemoTask).toHaveBeenCalledWith(2, baseTask.id);
      expect(memosApi.linkMemoTask).toHaveBeenCalledWith(3, baseTask.id);
      expect(memosApi.unlinkMemoTask).toHaveBeenCalledTimes(1);
      expect(memosApi.unlinkMemoTask).toHaveBeenCalledWith(1, baseTask.id);
      expect(onClose).toHaveBeenCalledWith("saved");
    });

    it("変更がなければ紐付け API を呼ばない", async () => {
      const { result } = await renderLoaded();

      await act(async () => {
        await result.current.saveAndClose();
      });

      expect(memosApi.linkMemoTask).not.toHaveBeenCalled();
      expect(memosApi.unlinkMemoTask).not.toHaveBeenCalled();
    });

    it("紐付けに失敗してもタスクは保存済みとして閉じる", async () => {
      vi.mocked(memosApi.linkMemoTask).mockRejectedValue(new Error("x"));
      const { result } = await renderLoaded();
      act(() => {
        result.current.setLinkedMemoIds((prev) => new Set([...prev, 2]));
      });

      await act(async () => {
        await result.current.saveAndClose();
      });

      expect(onTaskUpdated).toHaveBeenCalledWith(baseTask);
      expect(onClose).toHaveBeenCalledWith("saved");
      expect(result.current.saveError).toBeNull();
    });

    it("下書きは選択したメモ ID を onCreate に渡す", async () => {
      const onCreate = vi.fn().mockResolvedValue({ ...baseTask, id: 50 });
      const { result } = renderHook(
        () =>
          useTaskEditForm({
            task: { ...baseTask, id: 0, revision: 0 },
            onClose,
            onTaskUpdated,
            onCreate,
          }),
        { wrapper: createQueryWrapper() },
      );
      await waitFor(() => {
        expect(result.current.allMemos).toHaveLength(3);
      });
      act(() => {
        result.current.setLinkedMemoIds(() => new Set([2, 99]));
      });

      await act(async () => {
        await result.current.saveAndClose();
      });

      // 存在しない ID(99)は除外される
      expect(onCreate).toHaveBeenCalledWith(expect.anything(), [2]);
      expect(memosApi.linkMemoTask).not.toHaveBeenCalled();
    });
  });
});
