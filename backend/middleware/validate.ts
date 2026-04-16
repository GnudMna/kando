// リクエストバリデーション用のミドルウェアおよびユーティリティ関数を提供するモジュール
import { Request, Response, NextFunction } from 'express';

/**
 * ルートパラメータの文字列を正の整数にパースする。
 * @param id - パース対象の文字列
 * @returns 正の整数値、または不正な値の場合は null
 */
export function parseId(id: string): number | null {
  const n = parseInt(id, 10);
  return isNaN(n) || n <= 0 ? null : n;
}

// フィールドのバリデーションルール定義
type FieldDef = {
  type: 'string' | 'number' | 'boolean';
  required?: boolean;
  notEmpty?: boolean;
};

// スキーマ定義: フィールド名とバリデーションルールのマップ
type Schema = Record<string, FieldDef>;

/**
 * 指定したスキーマに基づいて req.body を検証する Express ミドルウェアを返す。
 * バリデーション失敗時は 400 を返し、成功時は next() を呼び出す。
 * @param schema - フィールド名とバリデーションルールのマップ
 * @returns Express ミドルウェア関数
 */
export function validateBody(schema: Schema) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const body = req.body as Record<string, unknown>;
    for (const [key, def] of Object.entries(schema)) {
      const val = body[key];
      // 必須フィールドが未指定の場合は 400 を返す
      if (def.required && (val === undefined || val === null)) {
        res.status(400).json({ error: `'${key}' is required` });
        return;
      }
      if (val !== undefined && val !== null) {
        // 型チェック
        if (typeof val !== def.type) {
          res.status(400).json({ error: `'${key}' must be a ${def.type}` });
          return;
        }
        // 空文字チェック（notEmpty が true の場合）
        if (def.notEmpty && typeof val === 'string' && val.trim().length === 0) {
          res.status(400).json({ error: `'${key}' must not be empty` });
          return;
        }
      }
    }
    next();
  };
}
