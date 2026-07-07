/**
 * Express クエリパラメータ用の Zod フィールドビルダー。
 * クエリ値は文字列または string[] として渡される。
 */
import { z } from "zod";

/**
 * 任意の正の整数クエリパラメータを定義する。未指定時は `null`。
 * @param field - エラーメッセージに使用するフィールド名
 * @param options - 上限値などのオプション
 * @returns 検証済み正の整数または `null` を返す Zod スキーマ
 */
export function optionalPositiveIntQueryField(
  field: string,
  options: { max?: number } = {},
) {
  const { max } = options;
  return z
    .unknown()
    .optional()
    .superRefine((raw, ctx) => {
      if (raw === undefined) return;
      if (Array.isArray(raw) || typeof raw !== "string") {
        ctx.addIssue({
          code: "custom",
          message: `'${field}' must be an integer`,
        });
        return;
      }
      const normalized = raw.trim();
      if (!/^\d+$/.test(normalized)) {
        ctx.addIssue({
          code: "custom",
          message: `'${field}' must be an integer`,
        });
        return;
      }
      const value = Number(normalized);
      if (!Number.isSafeInteger(value) || value <= 0) {
        ctx.addIssue({
          code: "custom",
          message: `'${field}' must be a positive integer`,
        });
        return;
      }
      if (max !== undefined && value > max) {
        ctx.addIssue({
          code: "custom",
          message: `'${field}' must be an integer between 1 and ${max}`,
        });
      }
    })
    .transform((raw): number | null => {
      if (raw === undefined) return null;
      return Number((raw as string).trim());
    });
}

/**
 * 任意の非負整数クエリパラメータを定義する。未指定時は `null`。
 * @param field - エラーメッセージに使用するフィールド名
 * @returns 検証済み非負整数または `null` を返す Zod スキーマ
 */
export function optionalNonNegativeIntQueryField(field: string) {
  return z
    .unknown()
    .optional()
    .superRefine((raw, ctx) => {
      if (raw === undefined) return;
      if (Array.isArray(raw) || typeof raw !== "string") {
        ctx.addIssue({
          code: "custom",
          message: `'${field}' must be an integer`,
        });
        return;
      }
      const normalized = raw.trim();
      if (!/^\d+$/.test(normalized)) {
        ctx.addIssue({
          code: "custom",
          message: `'${field}' must be an integer`,
        });
        return;
      }
      const value = Number(normalized);
      if (!Number.isSafeInteger(value) || value < 0) {
        ctx.addIssue({
          code: "custom",
          message: `'${field}' must be a non-negative integer`,
        });
      }
    })
    .transform((raw): number | null => {
      if (raw === undefined) return null;
      return Number((raw as string).trim());
    });
}

/**
 * `detail` クエリパラメータを定義する。未指定時は `summary`。
 * @returns 検証済み詳細度を返す Zod スキーマ
 */
export function detailQueryField() {
  return z
    .unknown()
    .optional()
    .superRefine((raw, ctx) => {
      if (raw === undefined) return;
      if (Array.isArray(raw) || typeof raw !== "string") {
        ctx.addIssue({
          code: "custom",
          message: "'detail' must be 'summary' or 'full'",
        });
        return;
      }
      const normalized = raw.trim().toLowerCase();
      if (normalized !== "summary" && normalized !== "full") {
        ctx.addIssue({
          code: "custom",
          message: "'detail' must be 'summary' or 'full'",
        });
      }
    })
    .transform((raw): "summary" | "full" => {
      if (raw === undefined) return "summary";
      const normalized = (raw as string).trim().toLowerCase();
      return normalized === "full" ? "full" : "summary";
    });
}

/**
 * 検索クエリ文字列パラメータを定義する。未指定・空文字は `null`。
 * @param field - エラーメッセージに使用するフィールド名
 * @param maxLength - 許容最大文字数
 * @returns 正規化済み検索文字列または `null` を返す Zod スキーマ
 */
export function searchQueryField(field: string, maxLength: number) {
  return z
    .unknown()
    .optional()
    .superRefine((raw, ctx) => {
      if (raw === undefined) return;
      if (Array.isArray(raw) || typeof raw !== "string") {
        ctx.addIssue({
          code: "custom",
          message: `'${field}' must be a string`,
        });
        return;
      }
      const normalized = raw.trim();
      if (normalized && normalized.length > maxLength) {
        ctx.addIssue({
          code: "custom",
          message: `'${field}' must be at most ${maxLength} characters`,
        });
      }
    })
    .transform((raw): string | null => {
      if (raw === undefined) return null;
      const normalized = (raw as string).trim();
      return normalized || null;
    });
}
