import { describe, expect, it } from "vitest";
import {
  boardQuerySchema,
  createChecklistItemBodySchema,
  createTaskBodySchema,
  formatZodError,
  loginBodySchema,
  PASSWORD_MIN_LENGTH_MESSAGE,
  registerBodySchema,
  taskSnapshotBodySchema,
  updateTaskBodySchema,
} from "./index.js";

describe("registerBodySchema / loginBodySchema", () => {
  const validPassword = "validpassword12";

  it("有効な認証ボディを受け入れる", () => {
    const body = { username: "alice", password: validPassword };
    expect(registerBodySchema.safeParse(body).success).toBe(true);
    expect(loginBodySchema.safeParse(body).success).toBe(true);
  });

  it("短いパスワードを登録で拒否する", () => {
    const result = registerBodySchema.safeParse({
      username: "alice",
      password: "short",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(formatZodError(result.error)).toBe(PASSWORD_MIN_LENGTH_MESSAGE);
    }
  });

  it("短いパスワードでもログインは受け入れる", () => {
    expect(
      loginBodySchema.safeParse({ username: "alice", password: "short" })
        .success,
    ).toBe(true);
  });

  it("空のユーザー名を拒否する", () => {
    const result = registerBodySchema.safeParse({
      username: "  ",
      password: validPassword,
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(formatZodError(result.error)).toBe("'username' must not be empty");
    }
  });
});

describe("boardQuerySchema", () => {
  it("未指定クエリを既定値で受け入れる", () => {
    const result = boardQuerySchema.safeParse({});
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toEqual({
        row_id: null,
        limit: null,
        offset: null,
        detail: "summary",
        q: null,
      });
    }
  });

  it("有効なクエリをパースする", () => {
    const result = boardQuerySchema.safeParse({
      row_id: "2",
      limit: "20",
      offset: "0",
      detail: "full",
      q: "  search  ",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toEqual({
        row_id: 2,
        limit: 20,
        offset: 0,
        detail: "full",
        q: "search",
      });
    }
  });

  it("不正な limit を拒否する", () => {
    const result = boardQuerySchema.safeParse({ limit: "101" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(formatZodError(result.error)).toBe(
        "'limit' must be an integer between 1 and 100",
      );
    }
  });

  it("不正な row_id を拒否する", () => {
    const result = boardQuerySchema.safeParse({ row_id: "abc" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(formatZodError(result.error)).toBe("'row_id' must be an integer");
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
