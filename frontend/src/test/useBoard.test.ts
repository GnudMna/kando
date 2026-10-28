// useBoard カスタムフックのユニットテスト
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { useBoard } from "../hooks/useBoard";
import { fetchBoard } from "../api/board";
import { createRowWithDefaultColumns, deleteRow, updateRow } from "../api/rows";
import {
  createColumn,
  deleteColumn,
  moveColumn,
  updateColumn,
} from "../api/columns";
import { copyTask, createTask, deleteTask, moveTask } from "../api/tasks";
import { createQueryWrapper, sampleBoardRows } from "./testUtils";
import type { Row, Task } from "../types";

vi.mock("../api/board");
vi.mock("../api/rows");
vi.mock("../api/columns");
vi.mock("../api/tasks");

/**
 * `useBoard` フックを Testing Library でレンダリングする。
 * @returns `renderHook` の戻り値
 */
const renderBoardHook = () =>
  renderHook(() => useBoard(), { wrapper: createQueryWrapper() });

/** React Query キャッシュ更新後の再レンダーを待つ。 */
async function waitForBoard(
  _result: { current: ReturnType<typeof useBoard> },
  assertion: () => void,
): Promise<void> {
  await waitFor(assertion);
}

const taskA: Task = {
  id: 1,
  column_id: 10,
  content: "タスクA",
  due_date: null,
  position: 1000,
  completed: false,
  revision: 1,
  subtasks: [],
  checklists: [],
  comments: [],
};

describe("useBoard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(fetchBoard).mockResolvedValue(structuredClone(sampleBoardRows));
  });

  it("マウント時にボードデータを先頭ページのみ読み込むこと", async () => {
    const { result } = await renderBoardHook();
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.rows).toHaveLength(2);
    expect(fetchBoard).toHaveBeenCalledTimes(1);
    expect(fetchBoard).toHaveBeenCalledWith({ limit: 20, detail: "summary" });
    expect(result.current.hasMore).toBe(false);
  });

  it("初回取得がページサイズと同数のとき hasMore が true になること", async () => {
    const pageRows = Array.from({ length: 20 }, (_, index) => ({
      id: index + 1,
      title: `行${index + 1}`,
      position: (index + 1) * 1000,
      columns: [],
    }));
    vi.mocked(fetchBoard).mockResolvedValue(pageRows);

    const { result } = await renderBoardHook();
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.rows).toHaveLength(20);
    expect(result.current.hasMore).toBe(true);
  });

  it("loadMoreRows が次ページを末尾に追記すること", async () => {
    const pageRows = Array.from({ length: 20 }, (_, index) => ({
      id: index + 1,
      title: `行${index + 1}`,
      position: (index + 1) * 1000,
      columns: [],
    }));
    const extraRow: Row = {
      id: 21,
      title: "行21",
      position: 21000,
      columns: [],
    };
    vi.mocked(fetchBoard)
      .mockResolvedValueOnce(pageRows)
      .mockResolvedValueOnce([extraRow]);

    const { result } = await renderBoardHook();
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.hasMore).toBe(true);

    await act(async () => {
      await result.current.loadMoreRows();
    });

    await waitForBoard(result, () =>
      expect(result.current.rows).toHaveLength(21),
    );
    expect(fetchBoard).toHaveBeenLastCalledWith({
      limit: 20,
      offset: 20,
      detail: "summary",
    });
    expect(result.current.hasMore).toBe(false);
  });

  it("fetchBoard が失敗した場合 operationError がセットされること", async () => {
    vi.mocked(fetchBoard).mockRejectedValue(new Error("network"));
    const { result } = await renderBoardHook();
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    await waitForBoard(result, () =>
      expect(result.current.operationError).toBe(
        "ボードの読み込みに失敗しました",
      ),
    );
  });

  it("clearError で operationError がクリアされること", async () => {
    vi.mocked(fetchBoard).mockRejectedValue(new Error("network"));
    const { result } = await renderBoardHook();
    await waitForBoard(result, () =>
      expect(result.current.operationError).toBe(
        "ボードの読み込みに失敗しました",
      ),
    );
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
    vi.mocked(createRowWithDefaultColumns).mockResolvedValue(newRow);

    const { result } = await renderBoardHook();
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => {
      await result.current.addRow("新しい行");
    });

    await waitFor(() => {
      expect(result.current.rows.find((r) => r.id === 99)).toBeDefined();
    });
    const addedRow = result.current.rows.find((r) => r.id === 99);
    expect(addedRow).toBeDefined();
    expect(addedRow?.columns).toHaveLength(3);
    expect(addedRow?.columns[0].title).toBe("未着手");
    expect(createRowWithDefaultColumns).toHaveBeenCalledWith("新しい行", 3000);
    expect(createColumn).not.toHaveBeenCalled();
  });

  it("addRow が失敗した場合 operationError がセットされること", async () => {
    vi.mocked(createRowWithDefaultColumns).mockRejectedValue(new Error("fail"));
    const { result } = await renderBoardHook();
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => {
      await result.current.addRow("エラー行");
    });
    expect(result.current.operationError).toBe("行の追加に失敗しました");
  });

  it("renameRow が rows 内のタイトルを更新すること", async () => {
    vi.mocked(updateRow).mockResolvedValue({
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
    await waitForBoard(result, () =>
      expect(result.current.rows[0].title).toBe("行1-改"),
    );
  });

  it("removeRow が rows から行を削除すること", async () => {
    vi.mocked(deleteRow).mockResolvedValue();
    const { result } = await renderBoardHook();
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => {
      await result.current.removeRow(1);
    });
    await waitForBoard(result, () => {
      expect(result.current.rows.find((r) => r.id === 1)).toBeUndefined();
      expect(result.current.rows).toHaveLength(1);
    });
  });

  it("addColumn が指定行にカラムを追加すること", async () => {
    const newCol = {
      id: 99,
      row_id: 1,
      title: "新カラム",
      position: 3000,
      tasks: [],
    };
    vi.mocked(createColumn).mockResolvedValue(newCol);
    const { result } = await renderBoardHook();
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => {
      await result.current.addColumn(1, "新カラム");
    });
    await waitForBoard(result, () => {
      const row = result.current.rows.find((r) => r.id === 1);
      expect(row?.columns).toHaveLength(3);
      expect(row?.columns[2].title).toBe("新カラム");
    });
  });

  it("renameColumn がカラムタイトルを更新すること", async () => {
    vi.mocked(updateColumn).mockResolvedValue({
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
    await waitForBoard(result, () => {
      const col = result.current.rows[0].columns.find((c) => c.id === 10);
      expect(col?.title).toBe("カラム1-改");
    });
  });

  it("removeColumn がカラムを削除すること", async () => {
    vi.mocked(deleteColumn).mockResolvedValue();
    const { result } = await renderBoardHook();
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => {
      await result.current.removeColumn(10);
    });
    await waitForBoard(result, () => {
      const row = result.current.rows.find((r) => r.id === 1);
      expect(row?.columns.find((c) => c.id === 10)).toBeUndefined();
      expect(row?.columns).toHaveLength(1);
    });
  });

  it("removeTask がタスクを削除すること", async () => {
    vi.mocked(deleteTask).mockResolvedValue();
    const { result } = await renderBoardHook();
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => {
      await result.current.removeTask(10, 1);
    });
    await waitForBoard(result, () => {
      const col = result.current.rows[0].columns.find((c) => c.id === 10);
      expect(col?.tasks).toHaveLength(0);
    });
  });

  it("updateTask が tasks 内の該当タスクを置き換えること", async () => {
    const { result } = await renderBoardHook();
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    const updated = { ...taskA, content: "更新後のタスク" };
    act(() => result.current.updateTask(updated));
    await waitForBoard(result, () => {
      const col = result.current.rows[0].columns.find((c) => c.id === 10);
      expect(col?.tasks[0].content).toBe("更新後のタスク");
    });
  });

  it("patchTask が連続して適用されても先行する更新を保持すること", async () => {
    const { result } = await renderBoardHook();
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    act(() => {
      result.current.patchTask(taskA.id, (prev) => ({
        ...prev,
        content: "更新1",
      }));
      result.current.patchTask(taskA.id, (prev) => ({
        ...prev,
        completed: true,
      }));
    });
    await waitForBoard(result, () => {
      const col = result.current.rows[0].columns.find((c) => c.id === 10);
      expect(col?.tasks[0]).toMatchObject({ content: "更新1", completed: true });
    });
  });

  it("moveTask が同一カラム内でタスクを並び替えること", async () => {
    const taskB: Task = {
      id: 2,
      column_id: 10,
      content: "タスクB",
      due_date: null,
      position: 2000,
      completed: false,
      revision: 1,
      subtasks: [],
      checklists: [],
      comments: [],
    };
    vi.mocked(fetchBoard).mockResolvedValue([
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
    vi.mocked(moveTask).mockResolvedValue({ ...taskA, position: 3000 });
    const { result } = await renderBoardHook();
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => {
      await result.current.moveTask("10", "10", 0, 1, 1);
    });

    await waitForBoard(result, () => {
      const tasks = result.current.rows[0].columns[0].tasks;
      expect(tasks[0].id).toBe(2);
      expect(tasks[1].id).toBe(1);
      expect(tasks[1].position).toBe(3000);
    });
    expect(moveTask).toHaveBeenCalledWith(1, 10, 3000);
  });

  it("moveTask が異なるカラム間でタスクを移動すること", async () => {
    vi.mocked(moveTask).mockResolvedValue({
      ...taskA,
      column_id: 11,
      position: 1000,
    });
    const { result } = await renderBoardHook();
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => {
      await result.current.moveTask("10", "11", 0, 0, 1);
    });

    await waitForBoard(result, () => {
      const srcCol = result.current.rows[0].columns.find((c) => c.id === 10);
      const dstCol = result.current.rows[0].columns.find((c) => c.id === 11);
      expect(srcCol?.tasks).toHaveLength(0);
      expect(dstCol?.tasks).toHaveLength(1);
      expect(dstCol?.tasks[0].id).toBe(1);
      expect(dstCol?.tasks[0].column_id).toBe(11);
      expect(dstCol?.tasks[0].position).toBe(1000);
    });
    expect(moveTask).toHaveBeenCalledWith(1, 11, 1000);
  });

  it("moveTask がサーバーの振り直し結果をキャッシュに反映すること", async () => {
    const taskB: Task = { ...taskA, id: 2, content: "タスクB", position: 2000 };
    vi.mocked(fetchBoard).mockResolvedValue([
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
    vi.mocked(moveTask).mockResolvedValue({
      ...taskA,
      position: 2000,
      rebalanced: [{ id: 2, position: 1000 }],
    });
    const { result } = await renderBoardHook();
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => {
      await result.current.moveTask("10", "10", 0, 1, 1);
    });

    await waitForBoard(result, () => {
      const tasks = result.current.rows[0].columns[0].tasks;
      expect(tasks.map((t) => [t.id, t.position])).toEqual([
        [2, 1000],
        [1, 2000],
      ]);
    });
  });

  it("addTask がサーバーの振り直し結果をキャッシュに反映し rebalanced を保持しないこと", async () => {
    const newTask: Task = { ...taskA, id: 99, position: 2000 };
    vi.mocked(createTask).mockResolvedValue({
      ...newTask,
      rebalanced: [{ id: 1, position: 500 }],
    });
    const { result } = await renderBoardHook();
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => {
      await result.current.addTask(10, 1);
    });

    await waitForBoard(result, () => {
      const tasks = result.current.rows[0].columns[0].tasks;
      expect(tasks.map((t) => [t.id, t.position])).toEqual([
        [1, 500],
        [99, 2000],
      ]);
      expect(tasks[1]).not.toHaveProperty("rebalanced");
    });
  });

  it("addTask がカラムにタスクを追加すること", async () => {
    const newTask: Task = {
      id: 99,
      column_id: 10,
      content: "新しいタスク",
      due_date: null,
      position: 2000,
      completed: false,
      revision: 1,
      subtasks: [],
      checklists: [],
      comments: [],
    };
    vi.mocked(createTask).mockResolvedValue(newTask);

    const { result } = await renderBoardHook();
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    let created: Task | null = null;
    await act(async () => {
      created = await result.current.addTask(10, 1);
    });

    expect(created).toEqual(newTask);
    await waitForBoard(result, () => {
      const col = result.current.rows[0].columns.find((c) => c.id === 10);
      expect(col?.tasks).toHaveLength(2);
    });
    expect(createTask).toHaveBeenCalledWith(10, "新しいタスク", 2000);
  });

  it("addTask が失敗した場合 operationError がセットされること", async () => {
    vi.mocked(createTask).mockRejectedValue(new Error("fail"));
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
    vi.mocked(copyTask).mockResolvedValue(copied);

    const { result } = await renderBoardHook();
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    let resultTask: Task | null = null;
    await act(async () => {
      resultTask = await result.current.copyTask(10, 1);
    });

    expect(resultTask).toEqual(copied);
    await waitForBoard(result, () => {
      const col = result.current.rows[0].columns.find((c) => c.id === 10);
      expect(col?.tasks).toHaveLength(2);
    });
  });

  it("copyTask が失敗した場合 operationError がセットされること", async () => {
    vi.mocked(copyTask).mockRejectedValue(new Error("fail"));
    const { result } = await renderBoardHook();
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => {
      await result.current.copyTask(10, 1);
    });

    expect(result.current.operationError).toBe("タスクのコピーに失敗しました");
  });

  it("moveColumn がカラムの順序を変更すること", async () => {
    vi.mocked(moveColumn).mockResolvedValue({
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

    await waitForBoard(result, () => {
      const row = result.current.rows.find((r) => r.id === 1);
      expect(row?.columns[0].id).toBe(11);
      expect(row?.columns[1].id).toBe(10);
    });
    expect(moveColumn).toHaveBeenCalledWith(11, 500);
  });

  it("moveColumn がサーバーの振り直し結果をキャッシュに反映すること", async () => {
    vi.mocked(moveColumn).mockResolvedValue({
      id: 11,
      row_id: 1,
      title: "カラム2",
      position: 1000,
      tasks: [],
      rebalanced: [{ id: 10, position: 2000 }],
    });
    const { result } = await renderBoardHook();
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => {
      await result.current.moveColumn(1, 1, 0, 11);
    });

    await waitForBoard(result, () => {
      const cols = result.current.rows[0].columns;
      expect(cols.map((c) => [c.id, c.position])).toEqual([
        [11, 1000],
        [10, 2000],
      ]);
    });
  });

  it("moveColumn が API 失敗時に状態をロールバックすること", async () => {
    vi.mocked(moveColumn).mockRejectedValue(new Error("fail"));
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
    vi.mocked(moveTask).mockRejectedValue(new Error("fail"));
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
    vi.mocked(deleteTask).mockRejectedValue(new Error("fail"));
    const { result } = await renderBoardHook();
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => {
      await result.current.removeTask(10, 1);
    });

    expect(result.current.operationError).toBe("タスクの削除に失敗しました");
    expect(result.current.rows[0].columns[0].tasks).toHaveLength(1);
  });

  it("renameColumn が失敗した場合 operationError がセットされること", async () => {
    vi.mocked(updateColumn).mockRejectedValue(new Error("fail"));
    const { result } = await renderBoardHook();
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => {
      await result.current.renameColumn(10, "失敗");
    });

    expect(result.current.operationError).toBe("カラム名の変更に失敗しました");
  });

  it("addColumn が失敗した場合 operationError がセットされること", async () => {
    vi.mocked(createColumn).mockRejectedValue(new Error("fail"));
    const { result } = await renderBoardHook();
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => {
      await result.current.addColumn(1, "失敗カラム");
    });

    expect(result.current.operationError).toBe("カラムの追加に失敗しました");
  });

  it("removeColumn が失敗した場合 operationError がセットされること", async () => {
    vi.mocked(deleteColumn).mockRejectedValue(new Error("fail"));
    const { result } = await renderBoardHook();
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => {
      await result.current.removeColumn(10);
    });

    expect(result.current.operationError).toBe("カラムの削除に失敗しました");
  });
});
