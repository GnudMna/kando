export const taskDragPortalTarget =
  typeof document !== "undefined" ? document.body : null;

export const DUE_SOON_DAYS_STORAGE_KEY = "kando-due-soon-days";
export const DEFAULT_DUE_SOON_DAYS = 3;
export const MAX_DUE_SOON_DAYS = 30;

/**
 * 期限間近の設定値を UI で扱う範囲へ正規化する。
 * @param value - 入力値
 * @returns 0 以上 MAX 以下の整数日
 */
export function normalizeDueSoonDays(value: number): number {
  if (!Number.isFinite(value)) return DEFAULT_DUE_SOON_DAYS;
  return Math.max(0, Math.min(MAX_DUE_SOON_DAYS, Math.floor(value)));
}
