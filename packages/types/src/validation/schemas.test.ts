import { describe, expect, it } from "vitest";
import {
  createChecklistItemBodySchema,
  createTaskBodySchema,
  formatZodError,
  loginBodySchema,
  registerBodySchema,
  taskSnapshotBodySchema,
  updateTaskBodySchema,
} from "./index.js";

describe("registerBodySchema / loginBodySchema", () => {
  it("有効な認証ボディを受け入れる", () => {
    const body = { username: "alice", password: "secret123" };
    expect(registerBodySchema.safeParse(body).success).toBe(true);
    expect(loginBodySchema.safeParse(body).success).toBe(true);
  });

  it("空のユーザー名を拒否する", () => {
    const result = registerBodySchema.safeParse({
      username: "  ",
      password: "secret123",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(formatZodError(result.error)).toBe("'username' must not be empty");
    }
  });
});

describe("createTaskBodySchema", () => {
  const validBody = {
    column_id: 1,
    content: "タスク",
    position: 1000,
  };

  it("due_date なしで作成できる", () => {
    expect(createTaskBodySchema.safeParse(validBody).success).toBe(true);
  });

  it("空の due_date を拒否する", () => {
    const result = createTaskBodySchema.safeParse({
      ...validBody,
      due_date: "   ",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(formatZodError(result.error)).toBe("'due_date' must not be empty");
    }
  });

  it("長すぎる due_date を拒否する", () => {
    const result = createTaskBodySchema.safeParse({
      ...validBody,
      due_date: "12345678901",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(formatZodError(result.error)).toBe(
        "'due_date' must be 10 characters or fewer",
      );
    }
  });
});

describe("updateTaskBodySchema", () => {
  it("due_date を null でクリアできる", () => {
    expect(updateTaskBodySchema.safeParse({ due_date: null }).success).toBe(
      true,
    );
  });

  it("completed を更新できる", () => {
    expect(updateTaskBodySchema.safeParse({ completed: true }).success).toBe(
      true,
    );
  });
});

describe("createChecklistItemBodySchema", () => {
  it("task_id のみ指定で成功する", () => {
    expect(
      createChecklistItemBodySchema.safeParse({
        content: "項目",
        task_id: 1,
      }).success,
    ).toBe(true);
  });

  it("task_id と subtask_id の同時指定を拒否する", () => {
    const result = createChecklistItemBodySchema.safeParse({
      content: "項目",
      task_id: 1,
      subtask_id: 2,
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(formatZodError(result.error)).toBe(
        "Exactly one of 'task_id' or 'subtask_id' is required",
      );
    }
  });
});

describe("taskSnapshotBodySchema", () => {
  const validSnapshot = {
    content: "タスク",
    due_date: null,
    checklists: [{ content: "項目", completed: false }],
    subtasks: [
      {
        content: "サブ",
        checklists: [{ content: "サブ項目", completed: true }],
      },
    ],
    comments: [{ content: "コメント" }],
  };

  it("有効なスナップショットを受け入れる", () => {
    expect(taskSnapshotBodySchema.safeParse(validSnapshot).success).toBe(true);
  });

  it("重複 ID を拒否する", () => {
    const result = taskSnapshotBodySchema.safeParse({
      ...validSnapshot,
      checklists: [
        { id: 1, content: "A", completed: false },
        { id: 1, content: "B", completed: true },
      ],
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(formatZodError(result.error)).toBe("Duplicate 'checklists.id': 1");
    }
  });

  it("サブタスク内チェックリストの重複 ID を拒否する", () => {
    const result = taskSnapshotBodySchema.safeParse({
      ...validSnapshot,
      subtasks: [
        {
          content: "サブ",
          checklists: [
            { id: 5, content: "A", completed: false },
            { id: 5, content: "B", completed: true },
          ],
        },
      ],
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(formatZodError(result.error)).toBe(
        "Duplicate 'subtasks[0].checklists.id': 5",
      );
    }
  });
});
