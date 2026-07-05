import { Request, Response, NextFunction } from "express";
import type { ZodType } from "zod";
import { formatZodError } from "@kando/types/validation";

/**
 * ルートパラメータを正の整数にパースする。
 * @param id - パース対象の値(文字列以外は null 扱い)
 * @returns 正の整数値、または不正な値の場合は null
 */
export function parseId(id: string | string[] | undefined): number | null {
  if (typeof id !== "string") return null;
  const normalized = id.trim();
  if (!/^\d+$/.test(normalized)) return null;
  const n = Number(normalized);
  return Number.isSafeInteger(n) && n > 0 ? n : null;
}

/**
 * Zod スキーマに基づいて req.body を検証する Express ミドルウェアを返す。
 * バリデーション失敗時は 400 を返し、成功時はパース結果で req.body を上書きして next() を呼び出す。
 * @param schema - Zod スキーマ
 * @returns Express ミドルウェア関数
 */
export function validateBody<T extends ZodType>(schema: T) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      res.status(400).json({ error: formatZodError(result.error) });
      return;
    }
    req.body = result.data;
    next();
  };
}
