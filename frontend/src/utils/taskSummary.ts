import type { Task } from "../types";

/**
 * タスクが `detail=summary` で取得されたかを判定する。
 * @param task - 判定対象タスク
 * @returns サマリー取得の場合 `true`
 */
export function isTaskSummary(task: Task): boolean {
  return (
    task.comment_count !== undefined ||
    task.subtask_count !== undefined ||
    task.checklist_count !== undefined
  );
}

/**
 * サマリー状態のタスクが詳細データの遅延読み込みを必要とするか。
 * @param task - 判定対象タスク
 * @returns 詳細取得が必要な場合 `true`
 */
export function taskNeedsDetailLoad(task: Task): boolean {
  if (!isTaskSummary(task)) return false;

  const commentCount = task.comment_count ?? task.comments.length;
  const subtaskCount = task.subtask_count ?? task.subtasks.length;
  const checklistCount = task.checklist_count ?? task.checklists.length;

  return (
    (commentCount > 0 && task.comments.length === 0) ||
    (subtaskCount > 0 && task.subtasks.length === 0) ||
    (checklistCount > 0 && task.checklists.length === 0)
  );
}

/**
 * サマリー表示用のコメント件数を返す。
 * @param task - 対象タスク
 * @returns コメント件数
 */
export function getTaskCommentCount(task: Task): number {
  return task.comment_count ?? task.comments.length;
}

/**
 * サマリー表示用のサブタスク件数を返す。
 * @param task - 対象タスク
 * @returns サブタスク件数
 */
export function getTaskSubtaskCount(task: Task): number {
  return task.subtask_count ?? task.subtasks.length;
}

/**
 * サマリー表示用のチェックリスト件数を返す。
 * @param task - 対象タスク
 * @returns チェックリスト件数
 */
export function getTaskChecklistCount(task: Task): number {
  return task.checklist_count ?? task.checklists.length;
}
