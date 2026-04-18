const DATE_PREFIX_RE = /^(\d{4})-(\d{2})-(\d{2})(?:$|T)/;
const DAY_MS = 24 * 60 * 60 * 1000;

export type DueHighlightStatus = "none" | "soon" | "overdue";

export interface DueHighlightResult {
  status: DueHighlightStatus;
  daysUntilDue: number | null;
}

/**
 * `YYYY-MM-DD` もしくは ISO 文字列先頭の日付部分を抽出し、妥当な日付かを検証する。
 * @param value - 解析対象の文字列
 * @returns 妥当な日付パーツ。解析できない場合は `null`
 */
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

/**
 * 正規化済み日付パーツを `YYYY-MM-DD` へ変換する。
 * @param parts - 年月日パーツ
 * @returns `YYYY-MM-DD` 形式の文字列
 */
function toDateOnlyString(parts: {
  year: number;
  month: number;
  day: number;
}): string {
  return `${parts.year.toString().padStart(4, "0")}-${parts.month
    .toString()
    .padStart(2, "0")}-${parts.day.toString().padStart(2, "0")}`;
}

/**
 * 受け取った文字列を UTC の日付（00:00:00）としてミリ秒へ変換する。
 * パース失敗時は `null` を返す。
 * @param value - 日付文字列
 * @returns UTC 基準の Unix time（ms）。無効値は `null`
 */
function parseDueDateToUtcMs(value: string): number | null {
  const parts = extractDateParts(value);
  if (!parts) return null;

  const utcMs = Date.UTC(parts.year, parts.month - 1, parts.day);

  return utcMs;
}

/**
 * 期限日の入力値を `YYYY-MM-DD` に正規化する。
 * パースできない値は `null` を返し、表示側で非期限扱いにできるようにする。
 * @param value - 入力値（`YYYY-MM-DD` もしくは ISO 文字列、`null`）
 * @returns 正規化済み日付文字列。無効値や未指定は `null`
 */
export function normalizeDueDateValue(value: string | null): string | null {
  if (!value) return null;

  const parts = extractDateParts(value);
  if (!parts) return null;

  return toDateOnlyString(parts);
}

/**
 * 設定値を 0 以上の整数日へ丸める。
 * @param value - 設定された日数
 * @returns 0 以上の整数日
 */
function normalizeDueSoonDays(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.floor(value));
}

/**
 * 現在日付との差分から、期限バッジの状態と残り日数を算出する。
 * 日付比較はローカル時刻の時分秒を無視し、日単位で行う。
 * @param dueDate - 期限日（`YYYY-MM-DD`）
 * @param dueSoonDays - 「期限が近い」と判定する日数しきい値
 * @param now - 比較基準日時（テスト時に差し替え可能）
 * @returns バッジ状態と残日数
 */
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

/**
 * `getDueHighlight` の結果を UI 表示用の日本語ラベルに変換する。
 * @param result - 期限状態の計算結果
 * @returns 表示ラベル。表示不要時は `null`
 */
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

/**
 * 期限日を `ja-JP` ロケールの表示文字列へ変換する。
 * 無効値はそのまま返し、入力値の情報を失わないようにする。
 * @param value - 表示対象の期限日文字列
 * @returns ロケール変換済み文字列（変換不可時は元値）
 */
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
