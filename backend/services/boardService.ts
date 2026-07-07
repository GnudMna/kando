import { pool } from "../db.js";
import { pushToGroupMap } from "../utils/groupMap.js";
import type { BoardQuery } from "@kando/types/validation";
import type {
  DbRow,
  DbColumn,
  DbTask,
  DbTaskComment,
  DbSubtask,
  DbChecklistItem,
  Row,
} from "../types.js";
import {
  fetchBoardHierarchy,
  fetchRowsForTaskIds,
  fetchUserRows,
  findMatchingTaskIds,
  type BoardDetailLevel,
} from "../repositories/boardRepository.js";

export type { BoardDetailLevel };

/**
 * 検索結果向けに、一致タスクのみを含む行階層へ整形する。
 * @param rows - 取得済み行階層
 * @returns 空カラム・空行を除外した行配列
 */
export function filterBoardToNonEmptyTasks(rows: Row[]): Row[] {
  return rows
    .map((row) => ({
      ...row,
      columns: row.columns
        .map((column) => ({
          ...column,
          tasks: column.tasks,
        }))
        .filter((column) => column.tasks.length > 0),
    }))
    .filter((row) => row.columns.length > 0);
}

type NestedSubtask = DbSubtask & { checklists: DbChecklistItem[] };
type NestedTask = DbTask & {
  subtasks: NestedSubtask[];
  checklists: DbChecklistItem[];
  comments: DbTaskComment[];
};

/**
 * フラットに取得した DB 行を rows -> columns -> tasks の階層へ組み立てる。
 * @param rows - 行レコード配列
 * @param columns - カラムレコード配列
 * @param tasks - タスクレコード配列
 * @param subtasks - サブタスクレコード配列
 * @param checklistItems - チェックリストレコード配列
 * @param taskComments - コメントレコード配列
 * @returns ネスト済みのボード階層
 */
export function buildBoardHierarchy(
  rows: DbRow[],
  columns: DbColumn[],
  tasks: DbTask[],
  subtasks: DbSubtask[],
  checklistItems: DbChecklistItem[],
  taskComments: DbTaskComment[],
): Row[] {
  const taskChecklistMap = new Map<number, DbChecklistItem[]>();
  const subtaskChecklistMap = new Map<number, DbChecklistItem[]>();
  const taskCommentMap = new Map<number, DbTaskComment[]>();

  for (const item of checklistItems) {
    if (item.subtask_id !== null) {
      pushToGroupMap(subtaskChecklistMap, item.subtask_id, item);
      continue;
    }
    if (item.task_id !== null) {
      pushToGroupMap(taskChecklistMap, item.task_id, item);
    }
  }

  for (const comment of taskComments) {
    pushToGroupMap(taskCommentMap, comment.task_id, comment);
  }

  const subtasksByTaskId = new Map<number, NestedSubtask[]>();
  for (const subtask of subtasks) {
    const nestedSubtask = {
      ...subtask,
      checklists: subtaskChecklistMap.get(subtask.id) ?? [],
    };
    pushToGroupMap(subtasksByTaskId, subtask.task_id, nestedSubtask);
  }

  const tasksByColumnId = new Map<number, NestedTask[]>();

  for (const task of tasks) {
    const nestedTask = {
      ...task,
      subtasks: subtasksByTaskId.get(task.id) ?? [],
      checklists: taskChecklistMap.get(task.id) ?? [],
      comments: taskCommentMap.get(task.id) ?? [],
    };
    pushToGroupMap(tasksByColumnId, task.column_id, nestedTask);
  }

  const columnsByRowId = new Map<
    number,
    Array<
      DbColumn & {
        tasks: NestedTask[];
      }
    >
  >();

  for (const column of columns) {
    const nestedColumn = {
      ...column,
      tasks: tasksByColumnId.get(column.id) ?? [],
    };
    pushToGroupMap(columnsByRowId, column.row_id, nestedColumn);
  }

  return rows.map((row) => ({
    ...row,
    columns: columnsByRowId.get(row.id) ?? [],
  }));
}

/**
 * ボード階層データを取得する。
 * @param userId - 操作ユーザー ID
 * @param query - 検証済みクエリパラメータ
 * @returns ネスト済み行配列
 */
export async function getBoard(
  userId: number,
  query: BoardQuery,
): Promise<Row[]> {
  const { row_id: rowIdFilter, limit, offset, detail, q: searchQuery } = query;

  if (searchQuery !== null) {
    const searchPattern = `%${searchQuery.replace(/[%_\\]/g, "\\$&")}%`;
    const matchingTaskIds = await findMatchingTaskIds(
      pool,
      userId,
      searchPattern,
    );
    if (matchingTaskIds.length === 0) {
      return [];
    }

    const rows = await fetchRowsForTaskIds(pool, userId, matchingTaskIds);
    const hierarchy = await fetchBoardHierarchy(
      pool,
      rows.map((row) => row.id),
      "full",
      matchingTaskIds,
    );
    return filterBoardToNonEmptyTasks(hierarchy);
  }

  const rows = await fetchUserRows(pool, userId, {
    rowIdFilter,
    limit,
    offset,
  });
  if (rows.length === 0) {
    return [];
  }

  return fetchBoardHierarchy(
    pool,
    rows.map((row) => row.id),
    detail,
  );
}
