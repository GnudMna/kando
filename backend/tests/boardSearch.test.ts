import { describe, expect, it } from "vitest";
import { filterBoardToNonEmptyTasks } from "../routes/board.js";
import type { Row } from "../types.js";

describe("filterBoardToNonEmptyTasks", () => {
  it("タスクのないカラムと行を除外する", () => {
    const rows: Row[] = [
      {
        id: 1,
        title: "行1",
        position: 1000,
        columns: [
          {
            id: 10,
            title: "Todo",
            position: 1000,
            row_id: 1,
            tasks: [
              {
                id: 100,
                column_id: 10,
                content: "一致",
                due_date: null,
                position: 1000,
                completed: false,
                subtasks: [],
                checklists: [],
                comments: [],
              },
            ],
          },
          {
            id: 11,
            title: "Done",
            position: 2000,
            row_id: 1,
            tasks: [],
          },
        ],
      },
      {
        id: 2,
        title: "行2",
        position: 2000,
        columns: [
          {
            id: 20,
            title: "Todo",
            position: 1000,
            row_id: 2,
            tasks: [],
          },
        ],
      },
    ];

    const filtered = filterBoardToNonEmptyTasks(rows);
    expect(filtered).toHaveLength(1);
    expect(filtered[0].columns).toHaveLength(1);
    expect(filtered[0].columns[0].tasks).toHaveLength(1);
  });
});
