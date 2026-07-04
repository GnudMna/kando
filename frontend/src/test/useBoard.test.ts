// useBoard カスタムフックのユニットテスト
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { useBoard } from "../hooks/useBoard";
import * as api from "../api/boardApi";
import { sampleBoardRows } from "./testUtils";
import type { Row, Task } from "../types";

vi.mock("../api/boardApi");

const taskA: Task = {
  id: 1,
  column_id: 10,
  content: "タスクA",
  due_date: null,
  position: 1000,
  completed: false,
  subtasks: [],
  checklists: [],
  comments: [],
};

/**
 * `useBoard` フックを Testing Library でレンダリングする。
 * @returns `renderHook` の戻り値
 */
const renderBoardHook = () => renderHook(() => useBoard());

describe("useBoard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(api.fetchBoard).mockResolvedValue(
      structuredClone(sampleBoardRows),
    );
  });

  it("マウント時にボードデータを先頭ページのみ読み込むこと", async () => {
    const { result } = await renderBoardHook();
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.rows).toHaveLength(2);
    expect(api.fetchBoard).toHaveBeenCalledTimes(1);
    expect(api.fetchBoard).toHaveBeenCalledWith({ limit: 20 });
    expect(result.current.hasMore).toBe(false);
  });

  it("初回取得がページサイズと同数のとき hasMore が true になること", async () => {
    const pageRows = Array.from({ length: 20 }, (_, index) => ({
      id: index + 1,
      title: `行${index + 1}`,
      position: (index + 1) * 1000,
      columns: [],
    }));
    vi.mocked(api.fetchBoard).mockResolvedValue(pageRows);

    const { result } = await renderBoardHook();
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.rows).toHaveLength(20);
    expect(result.current.hasMore).toBe(true);
  });

  it("loadMoreRows が次ページを末尾に追記すること", async () => {
    const extraRow: Row = {
      id: 3,
      title: "行3",
      position: 3000,
      columns: [],
    };
    vi.mocked(api.fetchBoard)
      .mockResolvedValueOnce(structuredClone(sampleBoardRows))
      .mockResolvedValueOnce([extraRow]);

    const { result } = await renderBoardHook();
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => {
      await result.current.loadMoreRows();
    });

    expect(result.current.rows).toHaveLength(3);
    expect(api.fetchBoard).toHaveBeenLastCalledWith({ limit: 20, offset: 2 });
    expect(result.current.hasMore).toBe(false);
  });

  it("fetchBoard が失敗した場合 operationError がセットされること", async () => {
    vi.mocked(api.fetchBoard).mockRejectedValue(new Error("network"));
    const { result } = await renderBoardHook();
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.operationError).toBe(
      "ボードの読み込みに失敗しました",
    );
  });

  it("clearError で operationError がクリアされること", async () => {
    vi.mocked(api.fetchBoard).mockRejectedValue(new Error("network"));
    const { result } = await renderBoardHook();
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    act(() => result.current.clearError());
    expect(result.current.operationError).toBeNull();
  });

  it("addRow が行と 3 つのデフォルトカラムを追加すること", async () => {
    const newRow: Row = {
      id: 99,
      title: "新しい行",
      position: 3000,
      columns: [
        { id: 31, row_id: 99, title: "未着手", position: 1000, tasks: [] },
        { id: 32, row_id: 99, title: "進行中", position: 2000, tasks: [] },
        { id: 33, row_id: 99, title: "完了", position: 3000, tasks: [] },
      ],
    };
    vi.mocked(api.createRowWithDefaultColumns).mockResolvedValue(newRow);

    const { result } = await renderBoardHook();
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => {
      await result.current.addRow("新しい行");
    });

    const addedRow = result.current.rows.find((r) => r.id === 99);
    expect(addedRow).toBeDefined();
    expect(addedRow?.columns).toHaveLength(3);
    expect(addedRow?.columns[0].title).toBe("未着手");
    expect(api.createRowWithDefaultColumns).toHaveBeenCalledWith(
      "新しい行",
      3000,
    );
    expect(api.createColumn).not.toHaveBeenCalled();
  });

  it("addRow が失敗した場合 operationError がセットされること", async () => {
    vi.mocked(api.createRowWithDefaultColumns).mockRejectedValue(
      new Error("fail"),
    );
    const { result } = await renderBoardHook();
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => {
      await result.current.addRow("エラー行");
    });
    expect(result.current.operationError).toBe("行の追加に失敗しました");
  });

  it("renameRow が rows 内のタイトルを更新すること", async () => {
    vi.mocked(api.updateRow).mockResolvedValue({
      id: 1,
      title: "行1-改",
      position: 1000,
      columns: [],
    });
    const { result } = await renderBoardHook();
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => {
      await result.current.renameRow(1, "行1-改");
    });
    expect(result.current.rows[0].title).toBe("行1-改");
  });

  it("removeRow が rows から行を削除すること", async () => {
    vi.mocked(api.deleteRow).mockResolvedValue();
    const { result } = await renderBoardHook();
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => {
      await result.current.removeRow(1);
    });
    expect(result.current.rows.find((r) => r.id === 1)).toBeUndefined();
    expect(result.current.rows).toHaveLength(1);
  });

  it("addColumn が指定行にカラムを追加すること", async () => {
    const newCol = {
      id: 99,
      row_id: 1,
      title: "新カラム",
      position: 3000,
      tasks: [],
    };
    vi.mocked(api.createColumn).mockResolvedValue(newCol);
    const { result } = await renderBoardHook();
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => {
      await result.current.addColumn(1, "新カラム");
    });
    const row = result.current.rows.find((r) => r.id === 1);
    expect(row?.columns).toHaveLength(3);
    expect(row?.columns[2].title).toBe("新カラム");
  });

  it("renameColumn がカラムタイトルを更新すること", async () => {
    vi.mocked(api.updateColumn).mockResolvedValue({
      id: 10,
      row_id: 1,
      title: "カラム1-改",
      position: 1000,
      tasks: [],
    });
    const { result } = await renderBoardHook();
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => {
      await result.current.renameColumn(10, "カラム1-改");
    });
    const col = result.current.rows[0].columns.find((c) => c.id === 10);
    expect(col?.title).toBe("カラム1-改");
  });

  it("removeColumn がカラムを削除すること", async () => {
    vi.mocked(api.deleteColumn).mockResolvedValue();
    const { result } = await renderBoardHook();
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => {
      await result.current.removeColumn(10);
    });
    const row = result.current.rows.find((r) => r.id === 1);
    expect(row?.columns.find((c) => c.id === 10)).toBeUndefined();
    expect(row?.columns).toHaveLength(1);
  });

  it("removeTask がタスクを削除すること", async () => {
    vi.mocked(api.deleteTask).mockResolvedValue();
    const { result } = await renderBoardHook();
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => {
      await result.current.removeTask(10, 1);
    });
    const col = result.current.rows[0].columns.find((c) => c.id === 10);
    expect(col?.tasks).toHaveLength(0);
  });

  it("updateTask が tasks 内の該当タスクを置き換えること", async () => {
    const { result } = await renderBoardHook();
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    const updated = { ...taskA, content: "更新後のタスク" };
    act(() => result.current.updateTask(updated));
    const col = result.current.rows[0].columns.find((c) => c.id === 10);
    expect(col?.tasks[0].content).toBe("更新後のタスク");
  });

  it("moveTask が同一カラム内でタスクを並び替えること", async () => {
    const taskB: Task = {
      id: 2,
      column_id: 10,
      content: "タスクB",
      due_date: null,
      position: 2000,
      completed: false,
      subtasks: [],
      checklists: [],
      comments: [],
    };
    vi.mocked(api.fetchBoard).mockResolvedValue([
      {
        id: 1,
        title: "行1",
        position: 1000,
        columns: [
          {
            id: 10,
            row_id: 1,
            title: "カラム1",
            position: 1000,
            tasks: [taskA, taskB],
          },
        ],
      },
    ]);
    vi.mocked(api.moveTask).mockResolvedValue({ ...taskA, position: 3000 });
    const { result } = await renderBoardHook();
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => {
      await result.current.moveTask("10", "10", 0, 1, 1);
    });

    const tasks = result.current.rows[0].columns[0].tasks;
    // タスクBが先頭、タスクAが後ろ
    expect(tasks[0].id).toBe(2);
    expect(tasks[1].id).toBe(1);
    // taskA の新 position は taskB(2000) + POSITION_GAP(1000) = 3000
    expect(tasks[1].position).toBe(3000);
    expect(api.moveTask).toHaveBeenCalledWith(1, 10, 3000);
  });

  it("moveTask が異なるカラム間でタスクを移動すること", async () => {
    vi.mocked(api.moveTask).mockResolvedValue({
      ...taskA,
      column_id: 11,
      position: 1000,
    });
    const { result } = await renderBoardHook();
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => {
      await result.current.moveTask("10", "11", 0, 0, 1);
    });

    const srcCol = result.current.rows[0].columns.find((c) => c.id === 10);
    const dstCol = result.current.rows[0].columns.find((c) => c.id === 11);
    expect(srcCol?.tasks).toHaveLength(0);
    expect(dstCol?.tasks).toHaveLength(1);
    expect(dstCol?.tasks[0].id).toBe(1);
    expect(dstCol?.tasks[0].column_id).toBe(11);
    // 移動先が空なので position = POSITION_GAP = 1000
    expect(dstCol?.tasks[0].position).toBe(1000);
    expect(api.moveTask).toHaveBeenCalledWith(1, 11, 1000);
  });

  it("addTask がカラムにタスクを追加すること", async () => {
    const newTask: Task = {
      id: 99,
      column_id: 10,
      content: "新しいタスク",
      due_date: null,
      position: 2000,
      completed: false,
      subtasks: [],
      checklists: [],
      comments: [],
    };
    vi.mocked(api.createTask).mockResolvedValue(newTask);

    const { result } = await renderBoardHook();
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    let created: Task | null = null;
    await act(async () => {
      created = await result.current.addTask(10, 1);
    });

    expect(created).toEqual(newTask);
    const col = result.current.rows[0].columns.find((c) => c.id === 10);
    expect(col?.tasks).toHaveLength(2);
    expect(api.createTask).toHaveBeenCalledWith(10, "新しいタスク", 2000);
  });

  it("addTask が失敗した場合 operationError がセットされること", async () => {
    vi.mocked(api.createTask).mockRejectedValue(new Error("fail"));
    const { result } = await renderBoardHook();
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => {
      await result.current.addTask(10, 1);
    });

    expect(result.current.operationError).toBe("タスクの追加に失敗しました");
  });

  it("copyTask がタスクを複製すること", async () => {
    const copied: Task = {
      ...taskA,
      id: 2,
      content: "タスクA のコピー",
    };
    vi.mocked(api.copyTask).mockResolvedValue(copied);

    const { result } = await renderBoardHook();
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    let resultTask: Task | null = null;
    await act(async () => {
      resultTask = await result.current.copyTask(10, 1);
    });

    expect(resultTask).toEqual(copied);
    const col = result.current.rows[0].columns.find((c) => c.id === 10);
    expect(col?.tasks).toHaveLength(2);
  });

  it("copyTask が失敗した場合 operationError がセットされること", async () => {
    vi.mocked(api.copyTask).mockRejectedValue(new Error("fail"));
    const { result } = await renderBoardHook();
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => {
      await result.current.copyTask(10, 1);
    });

    expect(result.current.operationError).toBe("タスクのコピーに失敗しました");
  });

  it("moveColumn がカラムの順序を変更すること", async () => {
    vi.mocked(api.moveColumn).mockResolvedValue({
      id: 11,
      row_id: 1,
      title: "カラム2",
      position: 500,
      tasks: [],
    });

    const { result } = await renderBoardHook();
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => {
      await result.current.moveColumn(1, 1, 0, 11);
    });

    const row = result.current.rows.find((r) => r.id === 1);
    expect(row?.columns[0].id).toBe(11);
    expect(row?.columns[1].id).toBe(10);
    expect(api.moveColumn).toHaveBeenCalledWith(11, 500);
  });

  it("moveColumn が API 失敗時に状態をロールバックすること", async () => {
    vi.mocked(api.moveColumn).mockRejectedValue(new Error("fail"));
    const { result } = await renderBoardHook();
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    const before = structuredClone(result.current.rows);
    await act(async () => {
      await result.current.moveColumn(1, 1, 0, 11);
    });

    expect(result.current.rows).toEqual(before);
    expect(result.current.operationError).toBe("カラムの移動に失敗しました");
  });

  it("moveTask が API 失敗時に状態をロールバックすること", async () => {
    vi.mocked(api.moveTask).mockRejectedValue(new Error("fail"));
    const { result } = await renderBoardHook();
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    const before = structuredClone(result.current.rows);
    await act(async () => {
      await result.current.moveTask("10", "11", 0, 0, 1);
    });

    expect(result.current.rows).toEqual(before);
    expect(result.current.operationError).toBe("タスクの移動に失敗しました");
  });

  it("removeTask が失敗した場合 operationError がセットされること", async () => {
    vi.mocked(api.deleteTask).mockRejectedValue(new Error("fail"));
    const { result } = await renderBoardHook();
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => {
      await result.current.removeTask(10, 1);
    });

    expect(result.current.operationError).toBe("タスクの削除に失敗しました");
    expect(result.current.rows[0].columns[0].tasks).toHaveLength(1);
  });

  it("renameColumn が失敗した場合 operationError がセットされること", async () => {
    vi.mocked(api.updateColumn).mockRejectedValue(new Error("fail"));
    const { result } = await renderBoardHook();
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => {
      await result.current.renameColumn(10, "失敗");
    });

    expect(result.current.operationError).toBe("カラム名の変更に失敗しました");
  });

  it("addColumn が失敗した場合 operationError がセットされること", async () => {
    vi.mocked(api.createColumn).mockRejectedValue(new Error("fail"));
    const { result } = await renderBoardHook();
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => {
      await result.current.addColumn(1, "失敗カラム");
    });

    expect(result.current.operationError).toBe("カラムの追加に失敗しました");
  });

  it("removeColumn が失敗した場合 operationError がセットされること", async () => {
    vi.mocked(api.deleteColumn).mockRejectedValue(new Error("fail"));
    const { result } = await renderBoardHook();
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => {
      await result.current.removeColumn(10);
    });

    expect(result.current.operationError).toBe("カラムの削除に失敗しました");
  });
});
