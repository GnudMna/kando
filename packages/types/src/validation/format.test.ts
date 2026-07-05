import { describe, expect, it } from "vitest";
import { z } from "zod";
import { formatZodError } from "./format.js";

describe("formatZodError", () => {
  it("カスタムメッセージをそのまま返す", () => {
    const error = z.object({ title: z.string() }).safeParse({ title: 1 }).error;
    expect(error).toBeDefined();

    const schema = z.object({
      title: z.string().superRefine((_value, ctx) => {
        ctx.addIssue({
          code: "custom",
          message: "'title' must not be empty",
        });
      }),
    });
    const customError = schema.safeParse({ title: "x" }).error;
    expect(formatZodError(customError!)).toBe("'title' must not be empty");
  });

  it("Exactly で始まるメッセージをそのまま返す", () => {
    const schema = z.object({}).superRefine((_value, ctx) => {
      ctx.addIssue({
        code: "custom",
        message: "Exactly one of 'task_id' or 'subtask_id' is required",
      });
    });
    const error = schema.safeParse({}).error;
    expect(formatZodError(error!)).toBe(
      "Exactly one of 'task_id' or 'subtask_id' is required",
    );
  });

  it("パス付きメッセージを整形する", () => {
    const schema = z.object({
      items: z.array(z.object({ name: z.string().min(1) })),
    });
    const error = schema.safeParse({ items: [{ name: "" }] }).error;
    expect(formatZodError(error!)).toContain("items[0].name");
  });

  it("issue がない場合は既定メッセージを返す", () => {
    const emptyError = { issues: [] } as z.ZodError;
    expect(formatZodError(emptyError)).toBe("Invalid request body");
  });
});
