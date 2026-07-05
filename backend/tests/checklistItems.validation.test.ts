import { describe, expect, it } from "vitest";
import {
  createChecklistItemBodySchema,
  formatZodError,
} from "@kando/types/validation";

describe("createChecklistItemBodySchema", () => {
  it("task_id と subtask_id が両方未指定ならエラーを返す", () => {
    const result = createChecklistItemBodySchema.safeParse({
      content: "項目",
    });
    expect(result.success).toBe(false);
    expect(formatZodError(result.error!)).toBe(
      "Exactly one of 'task_id' or 'subtask_id' is required",
    );
  });

  it("task_id と subtask_id が両方指定ならエラーを返す", () => {
    const result = createChecklistItemBodySchema.safeParse({
      content: "項目",
      task_id: 1,
      subtask_id: 2,
    });
    expect(result.success).toBe(false);
    expect(formatZodError(result.error!)).toBe(
      "Exactly one of 'task_id' or 'subtask_id' is required",
    );
  });

  it("task_id のみ指定なら成功を返す", () => {
    const result = createChecklistItemBodySchema.safeParse({
      content: "項目",
      task_id: 10,
    });
    expect(result.success).toBe(true);
  });

  it("subtask_id のみ指定なら成功を返す", () => {
    const result = createChecklistItemBodySchema.safeParse({
      content: "項目",
      subtask_id: 20,
    });
    expect(result.success).toBe(true);
  });

  it("task_id が 0 以下ならエラーを返す", () => {
    const result = createChecklistItemBodySchema.safeParse({
      content: "項目",
      task_id: 0,
    });
    expect(result.success).toBe(false);
    expect(formatZodError(result.error!)).toBe(
      "'task_id' must be greater than 0",
    );
  });

  it("subtask_id が非整数ならエラーを返す", () => {
    const result = createChecklistItemBodySchema.safeParse({
      content: "項目",
      subtask_id: 1.5,
    });
    expect(result.success).toBe(false);
    expect(formatZodError(result.error!)).toBe(
      "'subtask_id' must be an integer",
    );
  });
});
