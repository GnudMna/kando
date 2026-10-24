import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../repositories/tasksRepository.js", () => ({
  TASK_RETURNING_COLUMNS:
    "id, column_id, content, due_date::text AS due_date, position, completed",
  calcPosition: vi.fn((index: number) => (index + 1) * 1000),
  fetchTaskSnapshot: vi.fn(),
  insertTask: vi.fn(),
  idsToDelete: vi.fn(),
  syncChecklists: vi.fn(),
  syncTaskComments: vi.fn(),
  lockTasksInColumns: vi.fn(async () => []),
  updateTaskPositions: vi.fn(),
}));

vi.mock("../db.js", () => ({
  pool: {
    query: vi.fn(),
    connect: vi.fn(),
  },
}));

import * as repository from "../repositories/tasksRepository.js";
import * as service from "../services/tasksService.js";
import { pool } from "../db.js";
import { NotFoundError } from "../errors.js";
import type { Task, TaskSnapshotPayload } from "@kando/types";

type MockFn = ReturnType<typeof vi.fn>;
type MockedClient = { query: MockFn; release: MockFn };
type MockedPool = { query: MockFn; connect: MockFn };

const mockedPool = pool as unknown as MockedPool;

const baseTask: Task = {
  id: 1,
  column_id: 10,
  content: "タスク",
  due_date: null,
  position: 1000,
  completed: false,
  revision: 1,
  subtasks: [],
  checklists: [],
  comments: [],
};

/**
 * `pool.connect()` 用のモッククライアントを作成する。
 * @returns モック DB クライアント
 */
function createMockClient(): MockedClient {
  return { query: vi.fn(), release: vi.fn() };
}

describe("tasksService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("createTask", () => {
    it("カラムの所有権確認後にタスクを作成して返す", async () => {
      const client = createMockClient();
      mockedPool.connect.mockResolvedValueOnce(client);
      client.query.mockImplementation(async (sql: unknown) => {
        const statement = String(sql);
        if (statement === "BEGIN" || statement === "COMMIT") return { rows: [] };
        if (statement.includes("SELECT c.id")) return { rows: [{ id: 10 }] };
        return { rows: [] };
      });
      vi.mocked(repository.insertTask).mockResolvedValueOnce(baseTask);

      const result = await service.createTask(10, "新タスク", null, 1000, 99);

      expect(result).toEqual({ task: baseTask, rebalanced: [] });
      expect(repository.insertTask).toHaveBeenCalledWith(
        client,
        10,
        "新タスク",
        null,
        1000,
      );
      expect(client.release).toHaveBeenCalledTimes(1);
    });

    it("カラムがユーザーのものでない場合 NotFoundError を投げる", async () => {
      const client = createMockClient();
      mockedPool.connect.mockResolvedValueOnce(client);
      client.query.mockImplementation(async (sql: unknown) => {
        const statement = String(sql);
        if (statement === "BEGIN" || statement === "ROLLBACK") return { rows: [] };
        return { rows: [] };
      });

      await expect(
        service.createTask(10, "新タスク", null, 1000, 99),
      ).rejects.toThrow(NotFoundError);
      expect(repository.insertTask).not.toHaveBeenCalled();
      expect(client.release).toHaveBeenCalledTimes(1);
    });
  });

  describe("updateTask", () => {
    it("指定フィールドのみ部分更新する", async () => {
      const updated = { ...baseTask, content: "更新後", completed: true };
      mockedPool.query.mockResolvedValueOnce({ rows: [updated] });

      const result = await service.updateTask(
        1,
        { content: "更新後", completed: true },
        99,
      );

      expect(result).toEqual(updated);
      expect(mockedPool.query).toHaveBeenCalledWith(
        expect.stringContaining(
          "UPDATE tasks SET content = $1, completed = $2",
        ),
        ["更新後", true, 1, 99],
      );
    });

    it("due_date: null で期限をクリアできる", async () => {
      const updated = { ...baseTask, due_date: null };
      mockedPool.query.mockResolvedValueOnce({ rows: [updated] });

      await service.updateTask(1, { due_date: null }, 99);

      expect(mockedPool.query).toHaveBeenCalledWith(
        expect.stringContaining("due_date = $1"),
        [null, 1, 99],
      );
    });

    it("対象タスクが無い場合 NotFoundError を投げる", async () => {
      mockedPool.query.mockResolvedValueOnce({ rows: [] });

      await expect(
        service.updateTask(1, { content: "更新" }, 99),
      ).rejects.toThrow(NotFoundError);
    });
  });

  describe("moveTask", () => {
    it("タスクを別カラムへ移動する", async () => {
      const client = createMockClient();
      mockedPool.connect.mockResolvedValueOnce(client);
      const moved = { ...baseTask, column_id: 11, position: 2000 };
      client.query.mockImplementation(async (sql: unknown) => {
        const statement = String(sql);
        if (statement === "BEGIN" || statement === "COMMIT") return { rows: [] };
        if (statement.includes("SELECT c.id")) return { rows: [{ id: 11 }] };
        if (statement.includes("SELECT t.column_id")) {
          return { rows: [{ column_id: 10 }] };
        }
        if (statement.startsWith("UPDATE tasks SET column_id")) {
          return { rows: [moved] };
        }
        return { rows: [] };
      });
      vi.mocked(repository.lockTasksInColumns).mockResolvedValueOnce([
        { id: 1, column_id: 10, position: 1000 },
      ]);

      const result = await service.moveTask(1, 11, 2000, 99);

      expect(result).toEqual({ task: moved, rebalanced: [] });
    });

    it("position が衝突した場合は振り直し結果を返す", async () => {
      const client = createMockClient();
      mockedPool.connect.mockResolvedValueOnce(client);
      const moved = { ...baseTask, column_id: 11, position: 2000 };
      client.query.mockImplementation(async (sql: unknown) => {
        const statement = String(sql);
        if (statement === "BEGIN" || statement === "COMMIT") return { rows: [] };
        if (statement.includes("SELECT c.id")) return { rows: [{ id: 11 }] };
        if (statement.includes("SELECT t.column_id")) {
          return { rows: [{ column_id: 10 }] };
        }
        if (statement.startsWith("UPDATE tasks SET column_id")) {
          return { rows: [moved] };
        }
        return { rows: [] };
      });
      vi.mocked(repository.lockTasksInColumns).mockResolvedValueOnce([
        { id: 1, column_id: 10, position: 1000 },
        { id: 2, column_id: 11, position: 1000 },
      ]);

      const result = await service.moveTask(1, 11, 1000, 99);

      expect(result.rebalanced).toEqual([{ id: 2, position: 1000 }]);
      expect(repository.updateTaskPositions).toHaveBeenCalledWith(client, [
        { id: 2, position: 1000 },
      ]);
    });

    it("移動先カラムが無い場合 NotFoundError を投げる", async () => {
      const client = createMockClient();
      mockedPool.connect.mockResolvedValueOnce(client);
      client.query.mockImplementation(async (sql: unknown) => {
        const statement = String(sql);
        if (statement === "BEGIN" || statement === "ROLLBACK") return { rows: [] };
        return { rows: [] };
      });

      await expect(service.moveTask(1, 11, 2000, 99)).rejects.toThrow(
        NotFoundError,
      );
    });

    it("タスクが無い場合 NotFoundError を投げる", async () => {
      const client = createMockClient();
      mockedPool.connect.mockResolvedValueOnce(client);
      client.query.mockImplementation(async (sql: unknown) => {
        const statement = String(sql);
        if (statement === "BEGIN" || statement === "ROLLBACK") return { rows: [] };
        if (statement.includes("SELECT c.id")) return { rows: [{ id: 11 }] };
        return { rows: [] };
      });

      await expect(service.moveTask(1, 11, 2000, 99)).rejects.toThrow(
        NotFoundError,
      );
    });
  });

  describe("deleteTask", () => {
    it("削除成功時は true を返す", async () => {
      mockedPool.query.mockResolvedValueOnce({ rowCount: 1 });

      await expect(service.deleteTask(1, 99)).resolves.toBe(true);
    });

    it("対象が無い場合は false を返す", async () => {
      mockedPool.query.mockResolvedValueOnce({ rowCount: 0 });

      await expect(service.deleteTask(1, 99)).resolves.toBe(false);
    });
  });

  describe("saveTaskSnapshot", () => {
    const payload: TaskSnapshotPayload = {
      content: "更新タスク",
      due_date: "2026-12-01",
      completed: false,
      checklists: [],
      subtasks: [{ content: "新サブタスク", checklists: [] }],
      comments: [],
      revision: 1,
    };

    it("新規サブタスクを含むスナップショットを保存する", async () => {
      const client = createMockClient();
      mockedPool.connect.mockResolvedValueOnce(client);
      const savedTask = {
        ...baseTask,
        content: "更新タスク",
        subtasks: [
          {
            id: 11,
            task_id: 1,
            content: "新サブタスク",
            checklists: [],
          },
        ],
      };

      client.query.mockImplementation(async (sql: unknown) => {
        const statement = String(sql);
        if (statement === "BEGIN" || statement === "COMMIT") {
          return { rows: [] };
        }
        if (statement.includes("FOR UPDATE") && statement.includes("tasks t")) {
          return { rows: [{ id: 1, revision: 1 }] };
        }
        if (statement.includes("revision = revision + 1")) {
          return { rows: [] };
        }
        if (statement.includes("SELECT id FROM subtasks WHERE task_id")) {
          return { rows: [] };
        }
        if (statement.startsWith("INSERT INTO subtasks")) {
          return { rows: [{ id: 11 }] };
        }
        throw new Error(`Unexpected SQL: ${statement}`);
      });

      vi.mocked(repository.idsToDelete).mockReturnValue([]);
      vi.mocked(repository.fetchTaskSnapshot).mockResolvedValueOnce(savedTask);

      const result = await service.saveTaskSnapshot(
        1,
        payload,
        "2026-12-01",
        99,
      );

      expect(result).toEqual(savedTask);
      expect(repository.syncChecklists).toHaveBeenCalled();
      expect(repository.syncTaskComments).toHaveBeenCalledWith(
        client,
        1,
        payload.comments,
      );
      expect(client.query).toHaveBeenCalledWith("COMMIT");
      expect(client.release).toHaveBeenCalledTimes(1);
    });

    it("未知の subtasks.id が含まれる場合 400 を投げてロールバックする", async () => {
      const client = createMockClient();
      mockedPool.connect.mockResolvedValueOnce(client);

      client.query.mockImplementation(async (sql: unknown) => {
        const statement = String(sql);
        if (statement === "BEGIN" || statement === "ROLLBACK") {
          return { rows: [] };
        }
        if (statement.includes("FOR UPDATE") && statement.includes("tasks t")) {
          return { rows: [{ id: 1, revision: 1 }] };
        }
        if (statement.includes("revision = revision + 1")) {
          return { rows: [] };
        }
        if (statement.includes("SELECT id FROM subtasks WHERE task_id")) {
          return { rows: [{ id: 11 }] };
        }
        throw new Error(`Unexpected SQL: ${statement}`);
      });

      await expect(
        service.saveTaskSnapshot(
          1,
          {
            ...payload,
            subtasks: [{ id: 999, content: "不明", checklists: [] }],
          },
          null,
          99,
        ),
      ).rejects.toMatchObject({ status: 400 });

      expect(client.query).toHaveBeenCalledWith("ROLLBACK");
    });

    it("タスクがロックできない場合 404 を投げる", async () => {
      const client = createMockClient();
      mockedPool.connect.mockResolvedValueOnce(client);

      client.query.mockImplementation(async (sql: unknown) => {
        const statement = String(sql);
        if (statement === "BEGIN" || statement === "ROLLBACK") {
          return { rows: [] };
        }
        if (statement.includes("FOR UPDATE") && statement.includes("tasks t")) {
          return { rows: [] };
        }
        throw new Error(`Unexpected SQL: ${statement}`);
      });

      await expect(
        service.saveTaskSnapshot(1, payload, null, 99),
      ).rejects.toMatchObject({ status: 404, message: "Task not found" });
    });
  });

  describe("copyTask", () => {
    it("タスクと子要素を複製して返す", async () => {
      const client = createMockClient();
      mockedPool.connect.mockResolvedValueOnce(client);
      const sourceTask: Task = {
        ...baseTask,
        content: "元タスク",
        due_date: "2026-06-01",
        completed: true,
        checklists: [
          {
            id: 21,
            task_id: 1,
            subtask_id: null,
            content: "チェック",
            completed: true,
            position: 1000,
          },
        ],
        comments: [
          {
            id: 31,
            task_id: 1,
            content: "コメント",
            created_at: "2026-01-01T00:00:00.000Z",
            position: 1000,
          },
        ],
        subtasks: [
          {
            id: 11,
            task_id: 1,
            content: "サブ",
            checklists: [
              {
                id: 41,
                task_id: null,
                subtask_id: 11,
                content: "サブチェック",
                completed: true,
                position: 1000,
              },
            ],
          },
        ],
      };
      const copiedTask: Task = {
        ...sourceTask,
        id: 2,
        content: "元タスク のコピー",
        completed: false,
      };

      vi.mocked(repository.lockTasksInColumns).mockResolvedValueOnce([
        { id: 1, column_id: 10, position: 1000 },
      ]);
      client.query.mockImplementation(async (sql: unknown) => {
        const statement = String(sql);
        if (statement === "BEGIN" || statement === "COMMIT") {
          return { rows: [] };
        }
        if (statement.includes("SELECT t.column_id")) {
          return { rows: [{ column_id: 10 }] };
        }
        if (statement.startsWith("INSERT INTO tasks")) {
          return {
            rows: [
              {
                id: 2,
                column_id: 10,
                content: "元タスク のコピー",
                due_date: "2026-06-01",
                position: 2000,
                completed: false,
              },
            ],
          };
        }
        if (statement.includes("INSERT INTO checklist_items")) {
          return { rows: [] };
        }
        if (statement.includes("INSERT INTO task_comments")) {
          return { rows: [] };
        }
        if (statement.startsWith("INSERT INTO subtasks")) {
          return { rows: [{ id: 12 }] };
        }
        throw new Error(`Unexpected SQL: ${statement}`);
      });

      vi.mocked(repository.fetchTaskSnapshot)
        .mockResolvedValueOnce(sourceTask)
        .mockResolvedValueOnce(copiedTask);

      const result = await service.copyTask(1, 99);

      expect(result).toEqual(copiedTask);
      expect(client.query).toHaveBeenCalledWith("COMMIT");
      expect(client.release).toHaveBeenCalledTimes(1);
    });

    it("タスクが無い場合 NotFoundError を投げる", async () => {
      const client = createMockClient();
      mockedPool.connect.mockResolvedValueOnce(client);

      client.query.mockImplementation(async (sql: unknown) => {
        const statement = String(sql);
        if (statement === "BEGIN" || statement === "ROLLBACK") {
          return { rows: [] };
        }
        if (statement.includes("SELECT t.column_id")) {
          return { rows: [] };
        }
        throw new Error(`Unexpected SQL: ${statement}`);
      });

      await expect(service.copyTask(1, 99)).rejects.toThrow(NotFoundError);
      expect(client.query).toHaveBeenCalledWith("ROLLBACK");
    });
  });
});
