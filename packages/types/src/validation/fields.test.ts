import { describe, expect, it } from "vitest";
import {
  formatFieldPath,
  optionalBooleanField,
  optionalNonEmptyString,
  optionalPositiveNumberField,
  optionalString,
  positiveNumberField,
  rangedNumberField,
  requiredString,
} from "./fields.js";

describe("formatFieldPath", () => {
  it("ネストしたパスをドット記法へ変換する", () => {
    expect(formatFieldPath(["subtasks", 0, "checklists", 1, "content"])).toBe(
      "subtasks[0].checklists[1].content",
    );
  });

  it("空パスは空文字を返す", () => {
    expect(formatFieldPath([])).toBe("");
  });
});

describe("requiredString", () => {
  const schema = requiredString("title", 10);

  it("有効な文字列を受け入れる", () => {
    expect(schema.safeParse("hello").success).toBe(true);
  });

  it("未指定を拒否する", () => {
    const result = schema.safeParse(undefined);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toBe("'title' is required");
    }
  });

  it("空文字を拒否する", () => {
    const result = schema.safeParse("   ");
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toBe("'title' must not be empty");
    }
  });

  it("最大長を超える文字列を拒否する", () => {
    const result = schema.safeParse("12345678901");
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toBe(
        "'title' must be 10 characters or fewer",
      );
    }
  });
});

describe("optionalString", () => {
  const schema = optionalString("title", 5);

  it("未指定を受け入れる", () => {
    expect(schema.safeParse(undefined).success).toBe(true);
  });

  it("最大長を超える文字列を拒否する", () => {
    const result = schema.safeParse("123456");
    expect(result.success).toBe(false);
  });
});

describe("optionalNonEmptyString", () => {
  const schema = optionalNonEmptyString("content", 100);

  it("空文字を拒否する", () => {
    const result = schema.safeParse("  ");
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toBe(
        "'content' must not be empty",
      );
    }
  });
});

describe("positiveNumberField", () => {
  const schema = positiveNumberField("position", { integer: true });

  it("正の整数を受け入れる", () => {
    expect(schema.safeParse(1).success).toBe(true);
  });

  it("0 以下を拒否する", () => {
    const result = schema.safeParse(0);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toBe(
        "'position' must be greater than 0",
      );
    }
  });

  it("非整数を拒否する", () => {
    const result = schema.safeParse(1.5);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toBe(
        "'position' must be an integer",
      );
    }
  });
});

describe("optionalPositiveNumberField", () => {
  const schema = optionalPositiveNumberField("position", { integer: true });

  it("未指定を受け入れる", () => {
    expect(schema.safeParse(undefined).success).toBe(true);
  });
});

describe("rangedNumberField", () => {
  const schema = rangedNumberField("score", { min: 0, max: 100 });

  it("範囲内の値を受け入れる", () => {
    expect(schema.safeParse(50).success).toBe(true);
  });

  it("下限未満を拒否する", () => {
    const result = schema.safeParse(-1);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toBe(
        "'score' must be greater than or equal to 0",
      );
    }
  });
});

describe("optionalBooleanField", () => {
  const schema = optionalBooleanField("completed");

  it("boolean を受け入れる", () => {
    expect(schema.safeParse(true).success).toBe(true);
  });

  it("文字列を拒否する", () => {
    const result = schema.safeParse("true");
    expect(result.success).toBe(false);
  });
});
