import type { TempId } from "../types";

// 一時的な新規レコード用 ID のカウンター
let _counter = 0;

/**
 * 一時的な新規レコード用 ID を生成する。
 * DB 保存前の項目に付与するために使用する。
 * @returns "__new__{n}" 形式の一意な文字列 ID
 */
export function tempId(): TempId {
  return `__new__${++_counter}` as TempId;
}

/**
 * 値が一時 ID（まだ DB 保存前）かどうかを判定する型ガード。
 * @param id - 検査する ID
 * @returns 一時 ID の場合 true（id は TempId に絞り込まれる）
 */
export function isTemp(id: number | TempId): id is TempId {
  return typeof id === "string";
}
