// dueDate ユーティリティのユニットテスト
// 期限判定・ラベル生成・日付正規化/整形の仕様を検証する
import { describe, expect, it } from "vitest";
import {
  formatDueDate,
  getDueHighlight,
  getDueStatusLabel,
  normalizeDueDateValue,
  type DueHighlightResult,
} from "../utils/dueDate";

describe("dueDate utils", () => {
  // 日付差分計算が安定するよう固定日時を利用する
  const now = new Date(2026, 3, 18, 9, 0, 0);

  type DueHighlightTestCase = [
    string | null,
    "none" | "overdue" | "soon",
    number | null,
  ];

  it.each<DueHighlightTestCase>([
    [null, "none", null],
    ["2026-04-16", "overdue", -2],
    ["2026-04-20", "soon", 2],
    ["2026-04-23", "none", 5],
    ["2026-02-31", "none", null],
    ["2026-04-20T00:00:00.000Z", "soon", 2],
  ])(
    "getDueHighlight(%s) returns { status: %s, daysUntilDue: %s }",
    (value, status, daysUntilDue) => {
      expect(getDueHighlight(value, 3, now)).toEqual({
        status,
        daysUntilDue,
      });
    },
  );

  const statusLabelCases: [DueHighlightResult, string | null][] = [
    [{ status: "overdue", daysUntilDue: -1 }, "1日遅れ"],
    [{ status: "soon", daysUntilDue: 0 }, "今日が期限"],
    [{ status: "soon", daysUntilDue: 1 }, "明日が期限"],
    [{ status: "soon", daysUntilDue: 4 }, "あと4日"],
    [{ status: "none", daysUntilDue: 2 }, null],
  ];

  it.each(statusLabelCases)(
    "getDueStatusLabel(%o) returns %s",
    (input, expected) => {
      expect(getDueStatusLabel(input)).toBe(expected);
    },
  );

  it("formatDueDate は YYYY-MM-DD を日本語日付に整形する", () => {
    expect(formatDueDate("2026-04-18")).toBe("2026/04/18");
    expect(formatDueDate("2026-04-22T00:00:00.000Z")).toBe("2026/04/22");
    expect(formatDueDate("invalid")).toBe("invalid");
  });

  it("normalizeDueDateValue は ISO 形式を YYYY-MM-DD に変換する", () => {
    expect(normalizeDueDateValue("2026-04-22T00:00:00.000Z")).toBe(
      "2026-04-22",
    );
    expect(normalizeDueDateValue("2026-04-22")).toBe("2026-04-22");
    expect(normalizeDueDateValue("invalid")).toBeNull();
    expect(normalizeDueDateValue(null)).toBeNull();
  });
});
