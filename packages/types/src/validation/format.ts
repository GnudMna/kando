/**
 * Zod バリデーションエラーを API レスポンス形式へ変換するユーティリティ。
 */
import type { ZodError } from "zod";
import { formatFieldPath } from "./fields.js";

/**
 * フィールドパスを付けずにそのまま返すべきユーザー向けメッセージか判定する。
 * @param message - Zod issue のメッセージ
 * @returns 独立した表示用メッセージなら `true`
 */
function isStandaloneUserMessage(message: string): boolean {
  return /[\u3040-\u30ff\u4e00-\u9faf]/.test(message);
}

/**
 * Zod エラーを API の `{ error: string }` 形式へ変換する。
 * 複数エラーがある場合は先頭の 1 件のみを返す。
 * @param error - Zod のパースエラー
 * @returns クライアント向けエラーメッセージ
 */
export function formatZodError(error: ZodError): string {
  const issue = error.issues[0];
  if (!issue) {
    return "Invalid request body";
  }

  if (
    issue.message.startsWith("'") ||
    issue.message.startsWith("Exactly") ||
    issue.message.startsWith("Duplicate")
  ) {
    return issue.message;
  }

  const path = formatFieldPath(issue.path);
  if (path && !isStandaloneUserMessage(issue.message)) {
    return `'${path}' ${issue.message}`;
  }

  return issue.message;
}
