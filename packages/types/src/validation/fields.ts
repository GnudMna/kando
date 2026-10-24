/**
 * API バリデーション用の Zod フィールドビルダー。
 * 既存 API のエラーメッセージ形式。`'field' is required` 等と互換性を保つ。
 */
import { z } from "zod";

/** パスワードの最小文字数。 */
export const PASSWORD_MIN_LENGTH = 12;

/** Postgres INTEGER(int4) の最大値。SERIAL の ID 列などが取り得る上限。 */
export const INT4_MAX = 2_147_483_647;

/** パスワードの最大バイト数。bcrypt が使用する入力長の上限に合わせる。 */
export const PASSWORD_MAX_BYTES = 72;

/**
 * 文字列の UTF-8 バイト数を返す。ブラウザでも動くよう Buffer ではなく TextEncoder を使う。
 * @param value - 対象文字列
 * @returns UTF-8 でのバイト数
 */
function utf8ByteLength(value: string): number {
  return new TextEncoder().encode(value).length;
}

/** パスワード最小長違反時のユーザー向けメッセージ。 */
export const PASSWORD_MIN_LENGTH_MESSAGE =
  "パスワードは12文字以上で入力してください";

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
 * 認証用パスワードフィールドを定義する。
 * @param field - エラーメッセージに使用するフィールド名
 * @param options - 最小文字数・最大バイト数・最小長エラーメッセージ
 * @returns 検証済みパスワード文字列を返す Zod スキーマ
 */
export function passwordField(
  field: string,
  options: {
    minLength?: number;
    maxBytes?: number;
    minLengthMessage?: string;
  } = {},
) {
  const {
    minLength = PASSWORD_MIN_LENGTH,
    maxBytes = PASSWORD_MAX_BYTES,
    minLengthMessage = PASSWORD_MIN_LENGTH_MESSAGE,
  } = options;
  // bcrypt は先頭 72 バイトしか使わないため、文字数ではなく UTF-8 のバイト数で検証する
  return requiredString(field, Number.POSITIVE_INFINITY).superRefine(
    (value, ctx) => {
      if (value.length < minLength) {
        ctx.addIssue({
          code: "custom",
          message: minLengthMessage,
        });
      }
      if (utf8ByteLength(value) > maxBytes) {
        ctx.addIssue({
          code: "custom",
          message: `'${field}' must be ${maxBytes} bytes or fewer`,
        });
      }
    },
  );
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
  options: { integer?: boolean; required?: boolean; max?: number } = {},
) {
  const { integer = false, required = true, max } = options;
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
    if (max !== undefined && value > max) {
      ctx.addIssue({
        code: "custom",
        message: `'${field}' must be less than or equal to ${max}`,
      });
    }
  });
}

/**
 * DB の INTEGER(int4) 列に対応する ID・カウンタ用の正の整数フィールドを定義する。
 * int4 の上限を超える値は Postgres の 22003(out of range)で 500 になるため、ここで弾く。
 * @param field - エラーメッセージに使用するフィールド名
 * @param options - 必須指定
 * @returns 検証済み正の整数を返す Zod スキーマ
 */
export function idField(field: string, options: { required?: boolean } = {}) {
  return positiveNumberField(field, {
    integer: true,
    required: options.required,
    max: INT4_MAX,
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
