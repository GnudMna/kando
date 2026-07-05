/**
 * API バリデーション用の Zod フィールドビルダー。
 * 既存 API のエラーメッセージ形式。`'field' is required` 等と互換性を保つ。
 */
import { z } from "zod";

/**
 * Zod のフィールドパスを API エラーメッセージ形式へ変換する。
 * @param path - Zod issue の path 配列
 * @returns `checklists[0].content` 形式のフィールドパス
 */
export function formatFieldPath(path: PropertyKey[]): string {
  let result = "";
  for (const segment of path) {
    if (typeof segment === "number") {
      result += `[${segment}]`;
    } else {
      result += result ? `.${String(segment)}` : String(segment);
    }
  }
  return result;
}

/**
 * 必須の非空文字列フィールドを定義する。
 * @param field - エラーメッセージに使用するフィールド名
 * @param maxLength - 許容最大文字数
 * @returns 検証済み文字列を返す Zod スキーマ
 */
export function requiredString(field: string, maxLength: number) {
  return z
    .string({
      error: (issue) => {
        if (issue.input === undefined) {
          return `'${field}' is required`;
        }
        return `'${field}' must be a string`;
      },
    })
    .superRefine((value, ctx) => {
      if (value.trim().length === 0) {
        ctx.addIssue({
          code: "custom",
          message: `'${field}' must not be empty`,
        });
      }
      if (value.length > maxLength) {
        ctx.addIssue({
          code: "custom",
          message: `'${field}' must be ${maxLength} characters or fewer`,
        });
      }
    });
}

/**
 * 任意の文字列フィールドを定義する。未指定可、指定時は型・長さを検証。
 * @param field - エラーメッセージに使用するフィールド名
 * @param maxLength - 許容最大文字数
 * @returns 検証済み文字列を返す Zod スキーマ
 */
export function optionalString(field: string, maxLength: number) {
  return z
    .string({
      error: () => `'${field}' must be a string`,
    })
    .superRefine((value, ctx) => {
      if (value.length > maxLength) {
        ctx.addIssue({
          code: "custom",
          message: `'${field}' must be ${maxLength} characters or fewer`,
        });
      }
    })
    .optional();
}

/**
 * 任意の非空文字列フィールドを定義する。未指定可、指定時は空文字不可。
 * @param field - エラーメッセージに使用するフィールド名
 * @param maxLength - 許容最大文字数
 * @returns 検証済み文字列を返す Zod スキーマ
 */
export function optionalNonEmptyString(field: string, maxLength: number) {
  return z
    .string({
      error: () => `'${field}' must be a string`,
    })
    .superRefine((value, ctx) => {
      if (value.trim().length === 0) {
        ctx.addIssue({
          code: "custom",
          message: `'${field}' must not be empty`,
        });
      }
      if (value.length > maxLength) {
        ctx.addIssue({
          code: "custom",
          message: `'${field}' must be ${maxLength} characters or fewer`,
        });
      }
    })
    .optional();
}

/**
 * 数値フィールドを定義する。
 * @param field - エラーメッセージに使用するフィールド名
 * @param options - 必須指定などのオプション
 * @returns 検証済み数値を返す Zod スキーマ
 */
export function numberField(
  field: string,
  options: { required?: boolean } = {},
) {
  const required = options.required ?? true;
  return z.number({
    error: (issue) => {
      if (typeof issue.input === "number" && !Number.isFinite(issue.input)) {
        return `'${field}' must be a finite number`;
      }
      if (issue.input === undefined && required) {
        return `'${field}' is required`;
      }
      return `'${field}' must be a number`;
    },
  });
}

/**
 * 正の数値フィールドを定義する。
 * @param field - エラーメッセージに使用するフィールド名
 * @param options - 整数指定・必須指定などのオプション
 * @returns 検証済み正の数値を返す Zod スキーマ
 */
export function positiveNumberField(
  field: string,
  options: { integer?: boolean; required?: boolean } = {},
) {
  const { integer = false, required = true } = options;
  return numberField(field, { required }).superRefine((value, ctx) => {
    if (integer && !Number.isInteger(value)) {
      ctx.addIssue({
        code: "custom",
        message: `'${field}' must be an integer`,
      });
    }
    if (value <= 0) {
      ctx.addIssue({
        code: "custom",
        message: `'${field}' must be greater than 0`,
      });
    }
  });
}

/**
 * 範囲付き数値フィールドを定義する。
 * @param field - エラーメッセージに使用するフィールド名
 * @param options - 最小値・最大値・必須指定
 * @returns 検証済み数値を返す Zod スキーマ
 */
export function rangedNumberField(
  field: string,
  options: { min: number; max: number; required?: boolean },
) {
  const { min, max, required = true } = options;
  return numberField(field, { required }).superRefine((value, ctx) => {
    if (value < min) {
      ctx.addIssue({
        code: "custom",
        message: `'${field}' must be greater than or equal to ${min}`,
      });
    }
    if (value > max) {
      ctx.addIssue({
        code: "custom",
        message: `'${field}' must be less than or equal to ${max}`,
      });
    }
  });
}

/**
 * 任意の正の数値フィールドを定義する。
 * @param field - エラーメッセージに使用するフィールド名
 * @param options - 整数指定などのオプション
 * @returns 検証済み正の数値を返す Zod スキーマ
 */
export function optionalPositiveNumberField(
  field: string,
  options: { integer?: boolean } = {},
) {
  const { integer = false } = options;
  return numberField(field, { required: false })
    .superRefine((value, ctx) => {
      if (integer && !Number.isInteger(value)) {
        ctx.addIssue({
          code: "custom",
          message: `'${field}' must be an integer`,
        });
      }
      if (value <= 0) {
        ctx.addIssue({
          code: "custom",
          message: `'${field}' must be greater than 0`,
        });
      }
    })
    .optional();
}

/**
 * 任意の boolean フィールドを定義する。
 * @param field - エラーメッセージに使用するフィールド名
 * @returns 検証済み boolean を返す Zod スキーマ
 */
export function optionalBooleanField(field: string) {
  return z
    .boolean({
      error: () => `'${field}' must be a boolean`,
    })
    .optional();
}
