import { describe, it, expect } from "vitest";
import { validateChecklistParentRefs } from "../routes/checklistItems";

describe("validateChecklistParentRefs", () => {
  it("task_id と subtask_id が両方未指定ならエラー", () => {
    const result = validateChecklistParentRefs(undefined, undefined);
    expect(result).toEqual({
      ok: false,
      error: "Exactly one of 'task_id' or 'subtask_id' is required",
    });
  });

  it("task_id と subtask_id が両方指定ならエラー", () => {
    const result = validateChecklistParentRefs(1, 2);
    expect(result).toEqual({
      ok: false,
      error: "Exactly one of 'task_id' or 'subtask_id' is required",
    });
  });

  it("task_id のみ指定で正の整数なら有効", () => {
    const result = validateChecklistParentRefs(10, null);
    expect(result).toEqual({ ok: true, taskId: 10, subtaskId: null });
  });

  it("subtask_id のみ指定で正の整数なら有効", () => {
    const result = validateChecklistParentRefs(null, 20);
    expect(result).toEqual({ ok: true, taskId: null, subtaskId: 20 });
  });

  it("task_id が正の整数でない場合はエラー", () => {
    const result = validateChecklistParentRefs(0, null);
    expect(result).toEqual({
      ok: false,
      error: "'task_id' must be a positive integer",
    });
  });

  it("subtask_id が正の整数でない場合はエラー", () => {
    const result = validateChecklistParentRefs(null, 1.5);
    expect(result).toEqual({
      ok: false,
      error: "'subtask_id' must be a positive integer",
    });
  });
});
