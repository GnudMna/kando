/**
 * フロントエンド専用の型定義。
 * 共通 API 型は `@kando/types` から再利用する。
 */

import type {
  ChecklistItem,
  TaskComment,
  Subtask,
  Task,
  Column,
  Row,
} from "@kando/types";

/** かんばんボードのドメインモデル型(`@kando/types` から再エクスポート)。 */
export type { ChecklistItem, TaskComment, Subtask, Task, Column, Row };

/**
 * DB 保存前の一時 ID を表すブランデッド型。
 * 通常の string と区別することで、一時 ID を実 DB ID として誤用するのを防ぐ。
 */
export type TempId = string & { readonly __brand: "TempId" };

/**
 * ローカル編集中のチェックリスト項目。
 * `id` と `subtask_id` は一時 ID を許容する。
 */
export interface LocalChecklistItem extends Omit<
  ChecklistItem,
  "id" | "subtask_id"
> {
  id: number | TempId;
  subtask_id: number | TempId | null;
}

/**
 * ローカル編集中のタスクコメント。
 * `id` は一時 ID を許容する。
 */
export interface LocalTaskComment extends Omit<TaskComment, "id"> {
  id: number | TempId;
}

/**
 * ローカル編集中のサブタスク。
 * `id` は一時 ID を許容する。
 */
export interface LocalSubtask extends Omit<Subtask, "id" | "checklists"> {
  id: number | TempId;
  checklists: LocalChecklistItem[];
}

/**
 * ローカル編集中のタスク。
 * 子要素はすべて一時 ID を許容する型へ置き換える。
 */
export interface LocalTask extends Omit<
  Task,
  "subtasks" | "checklists" | "comments"
> {
  subtasks: LocalSubtask[];
  checklists: LocalChecklistItem[];
  comments: LocalTaskComment[];
}
