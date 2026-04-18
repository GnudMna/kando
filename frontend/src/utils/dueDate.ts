const DATE_PREFIX_RE = /^(\d{4})-(\d{2})-(\d{2})(?:$|T)/;
const DAY_MS = 24 * 60 * 60 * 1000;

export type DueHighlightStatus = "none" | "soon" | "overdue";

export interface DueHighlightResult {
  status: DueHighlightStatus;
  daysUntilDue: number | null;
}

function extractDateParts(
  value: string,
): { year: number; month: number; day: number } | null {
  const match = DATE_PREFIX_RE.exec(value);
  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);

  const utcMs = Date.UTC(year, month - 1, day);
  const date = new Date(utcMs);

  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null;
  }

  return { year, month, day };
}

function toDateOnlyString(parts: {
  year: number;
  month: number;
  day: number;
}): string {
  return `${parts.year.toString().padStart(4, "0")}-${parts.month
    .toString()
    .padStart(2, "0")}-${parts.day.toString().padStart(2, "0")}`;
}

function parseDueDateToUtcMs(value: string): number | null {
  const parts = extractDateParts(value);
  if (!parts) return null;

  const utcMs = Date.UTC(parts.year, parts.month - 1, parts.day);

  return utcMs;
}

export function normalizeDueDateValue(value: string | null): string | null {
  if (!value) return null;

  const parts = extractDateParts(value);
  if (!parts) return null;

  return toDateOnlyString(parts);
}

function normalizeDueSoonDays(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.floor(value));
}

export function getDueHighlight(
  dueDate: string | null,
  dueSoonDays: number,
  now = new Date(),
): DueHighlightResult {
  if (!dueDate) {
    return { status: "none", daysUntilDue: null };
  }

  const dueUtcMs = parseDueDateToUtcMs(dueDate);
  if (dueUtcMs === null) {
    return { status: "none", daysUntilDue: null };
  }

  const todayUtcMs = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  const daysUntilDue = Math.trunc((dueUtcMs - todayUtcMs) / DAY_MS);

  if (daysUntilDue < 0) {
    return { status: "overdue", daysUntilDue };
  }

  if (daysUntilDue <= normalizeDueSoonDays(dueSoonDays)) {
    return { status: "soon", daysUntilDue };
  }

  return { status: "none", daysUntilDue };
}

export function getDueStatusLabel(result: DueHighlightResult): string | null {
  if (result.status === "none" || result.daysUntilDue === null) {
    return null;
  }

  if (result.status === "overdue") {
    return `${Math.abs(result.daysUntilDue)}日遅れ`;
  }

  if (result.daysUntilDue === 0) {
    return "今日が期限";
  }

  if (result.daysUntilDue === 1) {
    return "明日が期限";
  }

  return `あと${result.daysUntilDue}日`;
}

export function formatDueDate(value: string): string {
  const normalized = normalizeDueDateValue(value);
  if (normalized === null) {
    return value;
  }

  const utcMs = parseDueDateToUtcMs(normalized);
  if (utcMs === null) return value;

  return new Date(utcMs).toLocaleDateString("ja-JP", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: "UTC",
  });
}
