// ボード全体のデータを返す GET /api/board エンドポイント
// rows → columns → tasks → subtasks → checklist_items の順にネストして返す
import { Router, Request, Response, NextFunction } from "express";
import { pool } from "../db.js";
import type {
  DbRow,
  DbColumn,
  DbTask,
  DbTaskComment,
  DbSubtask,
  DbChecklistItem,
  Row,
} from "../types.js";

const router = Router();

const TASK_SELECT_COLUMNS =
  "id, column_id, content, due_date::text AS due_date, position";
const MAX_BOARD_LIMIT = 100;

class BoardQueryError extends Error {}

function parsePositiveIntQuery(
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

function parseNonNegativeIntQuery(
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

function pushToGroupMap<K, V>(map: Map<K, V[]>, key: K, value: V): void {
  const bucket = map.get(key);
  if (bucket) {
    bucket.push(value);
    return;
  }
  map.set(key, [value]);
}

type NestedSubtask = DbSubtask & { checklists: DbChecklistItem[] };
type NestedTask = DbTask & {
  subtasks: NestedSubtask[];
  checklists: DbChecklistItem[];
  comments: DbTaskComment[];
};

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

// ボード全体のデータを一括取得して階層構造に組み立てて返す
router.get("/", async (req: Request, res: Response, next: NextFunction) => {
  let rowIdFilter: number | null;
  let limit: number | null;
  let offset: number | null;

  try {
    rowIdFilter = parsePositiveIntQuery(req.query.row_id, "row_id");
    limit = parsePositiveIntQuery(req.query.limit, "limit", MAX_BOARD_LIMIT);
    offset = parseNonNegativeIntQuery(req.query.offset, "offset");
  } catch (err) {
    if (err instanceof BoardQueryError) {
      res.status(400).json({ error: err.message });
      return;
    }
    next(err);
    return;
  }

  try {
    const rowQueryParams: number[] = [];
    const rowWhereClauses: string[] = [];

    if (rowIdFilter !== null) {
      rowQueryParams.push(rowIdFilter);
      rowWhereClauses.push(`id = $${rowQueryParams.length}`);
    }

    let rowsQuery = "SELECT * FROM rows";
    if (rowWhereClauses.length > 0) {
      rowsQuery += ` WHERE ${rowWhereClauses.join(" AND ")}`;
    }
    rowsQuery += " ORDER BY position ASC";

    if (limit !== null) {
      rowQueryParams.push(limit);
      rowsQuery += ` LIMIT $${rowQueryParams.length}`;
    }
    if (offset !== null) {
      rowQueryParams.push(offset);
      rowsQuery += ` OFFSET $${rowQueryParams.length}`;
    }

    const rowsResult = await pool.query<DbRow>(rowsQuery, rowQueryParams);
    const rows = rowsResult.rows;

    if (rows.length === 0) {
      res.json([]);
      return;
    }

    const rowIds = rows.map((row) => row.id);
    const colsResult = await pool.query<DbColumn>(
      "SELECT * FROM columns WHERE row_id = ANY($1::int[]) ORDER BY row_id ASC, position ASC",
      [rowIds],
    );
    const columns = colsResult.rows;

    if (columns.length === 0) {
      res.json(buildBoardHierarchy(rows, [], [], [], [], []));
      return;
    }

    const columnIds = columns.map((column) => column.id);
    const tasksResult = await pool.query<DbTask>(
      `SELECT ${TASK_SELECT_COLUMNS} FROM tasks WHERE column_id = ANY($1::int[]) ORDER BY column_id ASC, position ASC`,
      [columnIds],
    );
    const tasks = tasksResult.rows;

    if (tasks.length === 0) {
      res.json(buildBoardHierarchy(rows, columns, [], [], [], []));
      return;
    }

    const taskIds = tasks.map((task) => task.id);
    const [subResult, taskChecklistResult, cmtResult] = await Promise.all([
      pool.query<DbSubtask>(
        "SELECT * FROM subtasks WHERE task_id = ANY($1::int[]) ORDER BY task_id ASC, id ASC",
        [taskIds],
      ),
      pool.query<DbChecklistItem>(
        "SELECT * FROM checklist_items WHERE task_id = ANY($1::int[]) AND subtask_id IS NULL ORDER BY task_id ASC, position ASC",
        [taskIds],
      ),
      pool.query<DbTaskComment>(
        "SELECT * FROM task_comments WHERE task_id = ANY($1::int[]) ORDER BY task_id ASC, position ASC, created_at ASC, id ASC",
        [taskIds],
      ),
    ]);

    let subtaskChecklistRows: DbChecklistItem[] = [];
    if (subResult.rows.length > 0) {
      const subtaskIds = subResult.rows.map((subtask) => subtask.id);
      const subtaskChecklistResult = await pool.query<DbChecklistItem>(
        "SELECT * FROM checklist_items WHERE subtask_id = ANY($1::int[]) ORDER BY subtask_id ASC, position ASC",
        [subtaskIds],
      );
      subtaskChecklistRows = subtaskChecklistResult.rows;
    }

    const checklistItems = [
      ...taskChecklistResult.rows,
      ...subtaskChecklistRows,
    ];

    // Map を使って線形時間で階層構造を構築する
    res.json(
      buildBoardHierarchy(
        rows,
        columns,
        tasks,
        subResult.rows,
        checklistItems,
        cmtResult.rows,
      ),
    );
  } catch (err) {
    next(err);
  }
});

export default router;
