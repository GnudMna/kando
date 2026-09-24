import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as api from "../api/boardApi";
import type { Column, Row, Task } from "../types";
import {
  createFetchMock,
  respondWithJson,
  respondWithJsonError,
} from "./testUtils";

describe("boardApi", () => {
  const fetchMock = createFetchMock();

  beforeEach(() => {
    vi.stubGlobal("fetch", fetchMock);
    api.setOnUnauthorized(() => undefined);
    fetchMock.mockReset();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("fetchBoard sends correct query parameters", async () => {
    const mockRows: Row[] = [
      { id: 1, title: "Project A", position: 1000, columns: [] },
    ];
    respondWithJson(fetchMock, mockRows);

    const result = await api.fetchBoard({ row_id: 1, limit: 5, offset: 10 });

    expect(result).toEqual(mockRows);
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/board?row_id=1&limit=5&offset=10",
      {
        credentials: "include",
        headers: {},
      },
    );
  });

  it("fetchBoard requests the top-level board endpoint when no options are passed", async () => {
    respondWithJson(fetchMock, []);

    const result = await api.fetchBoard();

    expect(result).toEqual([]);
    expect(fetchMock).toHaveBeenCalledWith("/api/board", {
      credentials: "include",
      headers: {},
    });
  });

  it("createRow posts JSON and returns created row", async () => {
    const createdRow = { id: 2, title: "New Row", position: 2000, columns: [] };
    respondWithJson(fetchMock, createdRow);

    const result = await api.createRow("New Row", 2000);

    expect(result).toEqual(createdRow);
    expect(fetchMock).toHaveBeenCalledWith("/api/rows", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "New Row", position: 2000 }),
    });
  });

  it("createRowWithDefaultColumns posts JSON to the correct endpoint", async () => {
    const createdRow: Row = {
      id: 3,
      title: "Default Row",
      position: 3000,
      columns: [],
    };
    respondWithJson(fetchMock, createdRow);

    const result = await api.createRowWithDefaultColumns("Default Row", 3000);

    expect(result).toEqual(createdRow);
    expect(fetchMock).toHaveBeenCalledWith("/api/rows/with-default-columns", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "Default Row", position: 3000 }),
    });
  });

  it("updateRow sends PUT and returns updated row", async () => {
    const updatedRow: Row = {
      id: 4,
      title: "Updated",
      position: 4000,
      columns: [],
    };
    respondWithJson(fetchMock, updatedRow);

    const result = await api.updateRow(4, "Updated");

    expect(result).toEqual(updatedRow);
    expect(fetchMock).toHaveBeenCalledWith("/api/rows/4", {
      method: "PUT",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "Updated" }),
    });
  });

  it("createColumn posts JSON and returns created column", async () => {
    const createdColumn: Column = {
      id: 10,
      row_id: 1,
      title: "New Column",
      position: 1000,
      tasks: [],
    };
    respondWithJson(fetchMock, createdColumn);

    const result = await api.createColumn("New Column", 1000, 1);

    expect(result).toEqual(createdColumn);
    expect(fetchMock).toHaveBeenCalledWith("/api/columns", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "New Column", position: 1000, row_id: 1 }),
    });
  });

  it("updateColumn sends PUT and returns updated column", async () => {
    const updatedColumn: Column = {
      id: 11,
      row_id: 1,
      title: "Updated Column",
      position: 2000,
      tasks: [],
    };
    respondWithJson(fetchMock, updatedColumn);

    const result = await api.updateColumn(11, "Updated Column");

    expect(result).toEqual(updatedColumn);
    expect(fetchMock).toHaveBeenCalledWith("/api/columns/11", {
      method: "PUT",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "Updated Column" }),
    });
  });

  it("moveColumn sends PUT to move endpoint and returns updated column", async () => {
    const movedColumn: Column = {
      id: 12,
      row_id: 2,
      title: "Moved Column",
      position: 5000,
      tasks: [],
    };
    respondWithJson(fetchMock, movedColumn);

    const result = await api.moveColumn(12, 5000);

    expect(result).toEqual(movedColumn);
    expect(fetchMock).toHaveBeenCalledWith("/api/columns/12/move", {
      method: "PUT",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ position: 5000 }),
    });
  });

  it("createTask posts JSON and returns created task", async () => {
    const createdTask: Task = {
      id: 101,
      column_id: 10,
      content: "New Task",
      position: 1500,
      due_date: "2026-06-01",
      completed: false,
      revision: 1,
      subtasks: [],
      checklists: [],
      comments: [],
    };
    respondWithJson(fetchMock, createdTask);

    const result = await api.createTask(10, "New Task", 1500, "2026-06-01");

    expect(result).toEqual(createdTask);
    expect(fetchMock).toHaveBeenCalledWith("/api/tasks", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        column_id: 10,
        content: "New Task",
        position: 1500,
        due_date: "2026-06-01",
      }),
    });
  });

  it("updateTask sends PUT and returns updated task", async () => {
    const updatedTask: Task = {
      id: 102,
      column_id: 11,
      content: "Updated Task",
      position: 2000,
      due_date: null,
      completed: true,
      revision: 1,
      subtasks: [],
      checklists: [],
      comments: [],
    };
    respondWithJson(fetchMock, updatedTask);

    const result = await api.updateTask(102, {
      content: "Updated Task",
      completed: true,
    });

    expect(result).toEqual(updatedTask);
    expect(fetchMock).toHaveBeenCalledWith("/api/tasks/102", {
      method: "PUT",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: "Updated Task", completed: true }),
    });
  });

  it("deleteRow uses DELETE and returns void", async () => {
    respondWithJson(fetchMock, {});

    await api.deleteRow(123);

    expect(fetchMock).toHaveBeenCalledWith("/api/rows/123", {
      method: "DELETE",
      credentials: "include",
      headers: {},
    });
  });

  it("triggers onUnauthorized callback on 401 response", async () => {
    const onUnauthorized = vi.fn();
    api.setOnUnauthorized(onUnauthorized);
    respondWithJsonError(fetchMock, 401, { error: "Unauthorized" });

    await expect(api.fetchBoard()).rejects.toThrow("Unauthorized");
    expect(onUnauthorized).toHaveBeenCalledTimes(1);
  });

  it("throws HTTP error when response JSON cannot be parsed", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 404,
      json: async () => {
        throw new Error("invalid json");
      },
    });

    await expect(api.fetchBoard()).rejects.toThrow("HTTP 404");
  });

  it("checkStatus returns auth status", async () => {
    respondWithJson(fetchMock, { hasUsers: true });

    const result = await api.checkStatus();

    expect(result).toEqual({ hasUsers: true });
    expect(fetchMock).toHaveBeenCalledWith("/api/auth/status", {
      credentials: "include",
    });
  });

  it("verify returns true when response is ok", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({}),
    });

    await expect(api.verify()).resolves.toBe(true);
  });

  it("verify returns false on network error", async () => {
    fetchMock.mockRejectedValueOnce(new Error("network"));

    await expect(api.verify()).resolves.toBe(false);
  });

  it("login posts credentials and resolves on success", async () => {
    respondWithJson(fetchMock, {});

    await expect(api.login("user", "password12345")).resolves.toBeUndefined();
    expect(fetchMock).toHaveBeenCalledWith("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ username: "user", password: "password12345" }),
    });
  });

  it("register posts credentials and resolves on success", async () => {
    respondWithJson(fetchMock, {});

    await expect(
      api.register("user", "password12345"),
    ).resolves.toBeUndefined();
    expect(fetchMock).toHaveBeenCalledWith("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ username: "user", password: "password12345" }),
    });
  });

  it("logout calls logout endpoint", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({}),
    });

    await expect(api.logout()).resolves.toBeUndefined();
    expect(fetchMock).toHaveBeenCalledWith("/api/auth/logout", {
      method: "POST",
      credentials: "include",
    });
  });

  it("fetchMemos returns memo list", async () => {
    const memos = [{ id: 1, title: "メモ", content: "本文", tasks: [] }];
    respondWithJson(fetchMock, memos);

    await expect(api.fetchMemos()).resolves.toEqual(memos);
  });

  it("deleteColumn uses DELETE", async () => {
    respondWithJson(fetchMock, {});

    await api.deleteColumn(5);

    expect(fetchMock).toHaveBeenCalledWith("/api/columns/5", {
      method: "DELETE",
      credentials: "include",
      headers: {},
    });
  });

  it("saveTaskSnapshot sends PUT with payload", async () => {
    const task: Task = {
      id: 1,
      column_id: 10,
      content: "保存後",
      due_date: null,
      position: 1000,
      completed: false,
      revision: 1,
      subtasks: [],
      checklists: [],
      comments: [],
    };
    respondWithJson(fetchMock, task);

    const payload = {
      content: "保存後",
      due_date: null,
      completed: false,
      checklists: [],
      subtasks: [],
      comments: [],
      revision: 1,
    };
    const result = await api.saveTaskSnapshot(1, payload);

    expect(result).toEqual(task);
    expect(fetchMock).toHaveBeenCalledWith("/api/tasks/1/snapshot", {
      method: "PUT",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
  });

  it("moveTask sends PUT to move endpoint", async () => {
    const task: Task = {
      id: 1,
      column_id: 11,
      content: "移動",
      due_date: null,
      position: 1500,
      completed: false,
      revision: 1,
      subtasks: [],
      checklists: [],
      comments: [],
    };
    respondWithJson(fetchMock, task);

    await api.moveTask(1, 11, 1500);

    expect(fetchMock).toHaveBeenCalledWith("/api/tasks/1/move", {
      method: "PUT",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ column_id: 11, position: 1500 }),
    });
  });

  it("deleteTask uses DELETE", async () => {
    respondWithJson(fetchMock, {});

    await api.deleteTask(7);

    expect(fetchMock).toHaveBeenCalledWith("/api/tasks/7", {
      method: "DELETE",
      credentials: "include",
      headers: {},
    });
  });

  it("copyTask posts to copy endpoint", async () => {
    const copied: Task = {
      id: 2,
      column_id: 10,
      content: "コピー",
      due_date: null,
      position: 2000,
      completed: false,
      revision: 1,
      subtasks: [],
      checklists: [],
      comments: [],
    };
    respondWithJson(fetchMock, copied);

    await expect(api.copyTask(1)).resolves.toEqual(copied);
    expect(fetchMock).toHaveBeenCalledWith("/api/tasks/1/copy", {
      method: "POST",
      credentials: "include",
      headers: {},
    });
  });

  it("createTaskComment posts JSON", async () => {
    const comment = {
      id: 1,
      task_id: 10,
      content: "コメント",
      created_at: "2026-01-01T00:00:00.000Z",
      position: 1000,
    };
    respondWithJson(fetchMock, comment);

    await expect(api.createTaskComment(10, "コメント")).resolves.toEqual(
      comment,
    );
    expect(fetchMock).toHaveBeenCalledWith("/api/task-comments", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ task_id: 10, content: "コメント" }),
    });
  });

  it("createSubtask posts JSON", async () => {
    const subtask = {
      id: 1,
      task_id: 10,
      content: "サブ",
      checklists: [],
    };
    respondWithJson(fetchMock, subtask);

    await expect(api.createSubtask(10, "サブ")).resolves.toEqual(subtask);
    expect(fetchMock).toHaveBeenCalledWith("/api/subtasks", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ task_id: 10, content: "サブ" }),
    });
  });

  it("createChecklistItem posts JSON with task_id", async () => {
    const item = {
      id: 1,
      task_id: 10,
      subtask_id: null,
      content: "項目",
      completed: false,
      position: 1000,
    };
    respondWithJson(fetchMock, item);

    await expect(api.createChecklistItem("項目", 10)).resolves.toEqual(item);
    expect(fetchMock).toHaveBeenCalledWith("/api/checklist-items", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        task_id: 10,
        subtask_id: null,
        content: "項目",
      }),
    });
  });

  it("createMemo posts JSON", async () => {
    const memo = {
      id: 1,
      user_id: 1,
      title: "タイトル",
      content: "本文",
      created_at: "2026-01-01T00:00:00.000Z",
      updated_at: "2026-01-01T00:00:00.000Z",
      tasks: [],
    };
    respondWithJson(fetchMock, memo);

    await expect(api.createMemo("タイトル", "本文")).resolves.toEqual(memo);
  });

  it("linkMemoTask posts task_id", async () => {
    const memo = {
      id: 1,
      user_id: 1,
      title: "メモ",
      content: "本文",
      created_at: "2026-01-01T00:00:00.000Z",
      updated_at: "2026-01-01T00:00:00.000Z",
      tasks: [{ id: 5, content: "タスク" }],
    };
    respondWithJson(fetchMock, memo);

    await expect(api.linkMemoTask(1, 5)).resolves.toEqual(memo);
    expect(fetchMock).toHaveBeenCalledWith("/api/memos/1/tasks", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ task_id: 5 }),
    });
  });

  it("unlinkMemoTask uses DELETE", async () => {
    const memo = {
      id: 1,
      user_id: 1,
      title: "メモ",
      content: "本文",
      created_at: "2026-01-01T00:00:00.000Z",
      updated_at: "2026-01-01T00:00:00.000Z",
      tasks: [],
    };
    respondWithJson(fetchMock, memo);

    await api.unlinkMemoTask(1, 5);
    expect(fetchMock).toHaveBeenCalledWith("/api/memos/1/tasks/5", {
      method: "DELETE",
      credentials: "include",
      headers: {},
    });
  });

  it("verify returns false when response is not ok", async () => {
    fetchMock.mockResolvedValueOnce({ ok: false, json: async () => ({}) });

    await expect(api.verify()).resolves.toBe(false);
  });

  it("login throws on error response", async () => {
    respondWithJsonError(fetchMock, 401, { error: "認証失敗" });

    await expect(api.login("user", "wrongpassword")).rejects.toThrow(
      "認証失敗",
    );
  });
});
