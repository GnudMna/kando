import { describe, expect, it } from "vitest";
import {
  computeMoveColumnUpdate,
  computeMoveTaskUpdate,
} from "../hooks/useBoard/boardOptimisticUpdates";
import type { Row } from "../types";

const sampleRows: Row[] = [
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
        tasks: [
          {
            id: 1,
            column_id: 10,
            content: "A",
            due_date: null,
            position: 1000,
            completed: false,
            subtasks: [],
            checklists: [],
            comments: [],
          },
          {
            id: 2,
            column_id: 10,
            content: "B",
            due_date: null,
            position: 2000,
            completed: false,
            subtasks: [],
            checklists: [],
            comments: [],
          },
        ],
      },
      {
        id: 11,
        row_id: 1,
        title: "カラム2",
        position: 2000,
        tasks: [],
      },
    ],
  },
];

const columnLocationByDroppableId = new Map([
  ["10", { rowIndex: 0, columnIndex: 0 }],
  ["11", { rowIndex: 0, columnIndex: 1 }],
]);

describe("computeMoveTaskUpdate", () => {
  it("同一カラム内でタスクを並び替えること", () => {
    const result = computeMoveTaskUpdate({
      rows: sampleRows,
      indexMap: columnLocationByDroppableId,
      srcDroppableId: "10",
      dstDroppableId: "10",
      srcIndex: 0,
      dstIndex: 1,
    });

    expect(result).not.toBeNull();
    const tasks = result!.newRows[0].columns[0].tasks;
    expect(tasks.map((t) => t.id)).toEqual([2, 1]);
    expect(tasks[1].position).toBe(3000);
  });

  it("異なるカラム間でタスクを移動すること", () => {
    const result = computeMoveTaskUpdate({
      rows: sampleRows,
      indexMap: columnLocationByDroppableId,
      srcDroppableId: "10",
      dstDroppableId: "11",
      srcIndex: 0,
      dstIndex: 0,
    });

    expect(result).not.toBeNull();
    expect(result!.newRows[0].columns[0].tasks).toHaveLength(1);
    expect(result!.newRows[0].columns[1].tasks[0].id).toBe(1);
    expect(result!.newRows[0].columns[1].tasks[0].column_id).toBe(11);
  });

  it("無効なインデックスの場合 null を返すこと", () => {
    const result = computeMoveTaskUpdate({
      rows: sampleRows,
      indexMap: columnLocationByDroppableId,
      srcDroppableId: "10",
      dstDroppableId: "10",
      srcIndex: 5,
      dstIndex: 0,
    });
    expect(result).toBeNull();
  });
});

describe("computeMoveColumnUpdate", () => {
  const rowIndexById = new Map([[1, 0]]);

  it("カラムの順序を変更すること", () => {
    const result = computeMoveColumnUpdate({
      rows: sampleRows,
      rowIndexById,
      rowId: 1,
      srcIndex: 1,
      dstIndex: 0,
      colId: 11,
    });

    expect(result).not.toBeNull();
    expect(result!.newRows[0].columns.map((c) => c.id)).toEqual([11, 10]);
    expect(result!.newPosition).toBe(500);
  });
});
