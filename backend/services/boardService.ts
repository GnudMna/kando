import { pool } from "../db.js";
import { pushToGroupMap } from "../utils/groupMap.js";
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

export const MAX_BOARD_LIMIT = 100;
export const MAX_SEARCH_QUERY_LENGTH = 200;

/** クエリパラメータ検証失敗を 400 エラーへ変換するための内部エラー。 */
export class BoardQueryError extends Error {}

/**
 * query 文字列を正の整数として検証する。
 * @param raw - クエリ値
 * @param fieldName - エラーメッセージに表示するフィールド名
 * @param max - 許容上限(指定時のみ検証)
 * @returns 検証済みの正の整数。未指定時は `null`
 * @throws BoardQueryError 値が整数として不正な場合
 */
export function parsePositiveIntQuery(
  raw: unknown,
  fieldName: string,
  max?: number,
): number | null {
  if (raw === undefined) return null;
  if (Array.isArray(raw) || typeof raw !== "string") {
    throw new BoardQueryError(`'${fieldName}' must be an integer`);
  }

  const normalized = raw.trim();
  if (!/^\d+$/.test(normalized)) {
    throw new BoardQueryError(`'${fieldName}' must be an integer`);
  }

  const value = Number(normalized);
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new BoardQueryError(`'${fieldName}' must be a positive integer`);
  }
  if (max !== undefined && value > max) {
    throw new BoardQueryError(
      `'${fieldName}' must be an integer between 1 and ${max}`,
    );
  }
  return value;
}

/**
 * query 文字列を 0 以上の整数として検証する。
 * @param raw - クエリ値
 * @param fieldName - エラーメッセージに表示するフィールド名
 * @returns 検証済みの非負整数。未指定時は `null`
 * @throws BoardQueryError 値が整数として不正な場合
 */
export function parseNonNegativeIntQuery(
  raw: unknown,
  fieldName: string,
): number | null {
  if (raw === undefined) return null;
  if (Array.isArray(raw) || typeof raw !== "string") {
    throw new BoardQueryError(`'${fieldName}' must be an integer`);
  }

  const normalized = raw.trim();
  if (!/^\d+$/.test(normalized)) {
    throw new BoardQueryError(`'${fieldName}' must be an integer`);
  }

  const value = Number(normalized);
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new BoardQueryError(`'${fieldName}' must be a non-negative integer`);
  }
  return value;
}

/**
 * `detail` クエリを検証する。未指定時はパフォーマンス重視の `summary`。
 * @param raw - クエリ値
 * @returns 検証済み詳細度
 * @throws BoardQueryError 値が不正な場合
 */
export function parseDetailQuery(raw: unknown): BoardDetailLevel {
  if (raw === undefined) return "summary";
  if (Array.isArray(raw) || typeof raw !== "string") {
    throw new BoardQueryError("'detail' must be 'summary' or 'full'");
  }
  const normalized = raw.trim().toLowerCase();
  if (normalized === "summary" || normalized === "full") {
    return normalized;
  }
  throw new BoardQueryError("'detail' must be 'summary' or 'full'");
}

/**
 * 検索クエリ文字列を検証する。
 * @param raw - クエリ値
 * @returns 正規化済み検索文字列。未指定・空文字は `null`
 * @throws BoardQueryError 値が不正または長すぎる場合
 */
export function parseSearchQuery(raw: unknown): string | null {
  if (raw === undefined) return null;
  if (Array.isArray(raw) || typeof raw !== "string") {
    throw new BoardQueryError("'q' must be a string");
  }
  const normalized = raw.trim();
  if (!normalized) return null;
  if (normalized.length > MAX_SEARCH_QUERY_LENGTH) {
    throw new BoardQueryError(
      `'q' must be at most ${MAX_SEARCH_QUERY_LENGTH} characters`,
    );
  }
  return normalized;
}

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

export type BoardQueryParams = {
  row_id?: unknown;
  limit?: unknown;
  offset?: unknown;
  detail?: unknown;
  q?: unknown;
};

/**
 * ボード階層データを取得する。
 * @param userId - 操作ユーザー ID
 * @param query - 生のクエリパラメータ
 * @returns ネスト済み行配列
 * @throws BoardQueryError クエリパラメータが不正な場合
 */
export async function getBoard(
  userId: number,
  query: BoardQueryParams,
): Promise<Row[]> {
  const rowIdFilter = parsePositiveIntQuery(query.row_id, "row_id");
  const limit = parsePositiveIntQuery(query.limit, "limit", MAX_BOARD_LIMIT);
  const offset = parseNonNegativeIntQuery(query.offset, "offset");
  const detail = parseDetailQuery(query.detail);
  const searchQuery = parseSearchQuery(query.q);

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
