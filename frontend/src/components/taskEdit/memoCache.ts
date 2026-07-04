import type { Memo } from "../../api/boardApi";

const MEMO_CACHE_TTL_MS = 30_000;

let memoCacheValue: Memo[] | null = null;
let memoCacheExpiry = 0;

/**
 * TTL 内のメモ一覧キャッシュを返す。
 * @returns 有効なキャッシュ。期限切れまたは未設定時は `null`
 */
export function getCachedMemos(): Memo[] | null {
  if (memoCacheValue && Date.now() < memoCacheExpiry) return memoCacheValue;
  return null;
}

/**
 * メモ一覧キャッシュを更新する。
 * @param memos - キャッシュするメモ配列
 */
export function setCachedMemos(memos: Memo[]): void {
  memoCacheValue = memos;
  memoCacheExpiry = Date.now() + MEMO_CACHE_TTL_MS;
}

/** メモ一覧キャッシュを無効化する。 */
export function invalidateMemoCache(): void {
  memoCacheExpiry = 0;
}
