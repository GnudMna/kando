import { describe, expect, it } from "vitest";
import {
  formatDueDate,
  getDueHighlight,
  getDueStatusLabel,
  normalizeDueDateValue,
} from "../utils/dueDate";

describe("dueDate utils", () => {
  const now = new Date(2026, 3, 18, 9, 0, 0);

  it("期限なしの場合は強調しない", () => {
    expect(getDueHighlight(null, 3, now)).toEqual({
      status: "none",
      daysUntilDue: null,
    });
  });

  it("期限切れタスクを overdue 判定する", () => {
    expect(getDueHighlight("2026-04-16", 3, now)).toEqual({
      status: "overdue",
      daysUntilDue: -2,
    });
  });

  it("閾値以内の期限を soon 判定する", () => {
    expect(getDueHighlight("2026-04-20", 3, now)).toEqual({
      status: "soon",
      daysUntilDue: 2,
    });
  });

  it("閾値外の期限は強調しない", () => {
    expect(getDueHighlight("2026-04-23", 3, now)).toEqual({
      status: "none",
      daysUntilDue: 5,
    });
  });

  it("不正な日付文字列は強調しない", () => {
    expect(getDueHighlight("2026-02-31", 7, now)).toEqual({
      status: "none",
      daysUntilDue: null,
    });
  });

  it("ISO 形式の期限文字列も判定できる", () => {
    expect(getDueHighlight("2026-04-20T00:00:00.000Z", 3, now)).toEqual({
      status: "soon",
      daysUntilDue: 2,
    });
  });

  it("状態に応じたラベルを返す", () => {
    expect(getDueStatusLabel({ status: "overdue", daysUntilDue: -1 })).toBe(
      "1日遅れ",
    );
    expect(getDueStatusLabel({ status: "soon", daysUntilDue: 0 })).toBe(
      "今日が期限",
    );
    expect(getDueStatusLabel({ status: "soon", daysUntilDue: 1 })).toBe(
      "明日が期限",
    );
    expect(getDueStatusLabel({ status: "soon", daysUntilDue: 4 })).toBe(
      "あと4日",
    );
    expect(getDueStatusLabel({ status: "none", daysUntilDue: 2 })).toBeNull();
  });

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
