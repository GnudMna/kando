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
router.get("/", async (_req: Request, res: Response, next: NextFunction) => {
  try {
    // 全テーブルを並行して取得することでパフォーマンスを最適化する
    const [
      rowsResult,
      colsResult,
      tasksResult,
      subResult,
      chkResult,
      cmtResult,
    ] = await Promise.all([
      pool.query<DbRow>("SELECT * FROM rows ORDER BY position ASC"),
      pool.query<DbColumn>("SELECT * FROM columns ORDER BY position ASC"),
      pool.query<DbTask>(
        `SELECT ${TASK_SELECT_COLUMNS} FROM tasks ORDER BY position ASC`,
      ),
      pool.query<DbSubtask>("SELECT * FROM subtasks ORDER BY id ASC"),
      pool.query<DbChecklistItem>(
        "SELECT * FROM checklist_items ORDER BY position ASC",
      ),
      pool.query<DbTaskComment>(
        "SELECT * FROM task_comments ORDER BY position ASC, created_at ASC, id ASC",
      ),
    ]);

    // Map を使って線形時間で階層構造を構築する
    res.json(
      buildBoardHierarchy(
        rowsResult.rows,
        colsResult.rows,
        tasksResult.rows,
        subResult.rows,
        chkResult.rows,
        cmtResult.rows,
      ),
    );
  } catch (err) {
    next(err);
  }
});

export default router;
