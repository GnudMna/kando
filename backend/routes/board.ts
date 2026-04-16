// ボード全体のデータを返す GET /api/board エンドポイント
// rows → columns → tasks → subtasks → checklist_items の順にネストして返す
import { Router, Request, Response, NextFunction } from 'express';
import { pool } from '../db';
import type { DbRow, DbColumn, DbTask, DbSubtask, DbChecklistItem, Row } from '../types';

const router = Router();

// ボード全体のデータを一括取得して階層構造に組み立てて返す
router.get('/', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    // 全テーブルを並行して取得することでパフォーマンスを最適化する
    const [rowsResult, colsResult, tasksResult, subResult, chkResult] = await Promise.all([
      pool.query<DbRow>('SELECT * FROM rows ORDER BY position ASC'),
      pool.query<DbColumn>('SELECT * FROM columns ORDER BY position ASC'),
      pool.query<DbTask>('SELECT * FROM tasks ORDER BY position ASC'),
      pool.query<DbSubtask>('SELECT * FROM subtasks ORDER BY id ASC'),
      pool.query<DbChecklistItem>('SELECT * FROM checklist_items ORDER BY id ASC'),
    ]);

    // タスクにサブタスクとチェックリストをネストする
    const tasks = tasksResult.rows.map((task) => {
      // タスク直下のチェックリスト（subtask_id が null のもの）
      const taskChecklists = chkResult.rows.filter(
        (c) => c.task_id === task.id && !c.subtask_id
      );
      // サブタスクにそれぞれのチェックリストをネストする
      const subtasks = subResult.rows
        .filter((s) => s.task_id === task.id)
        .map((sub) => ({
          ...sub,
          checklists: chkResult.rows.filter((c) => c.subtask_id === sub.id),
        }));
      return { ...task, subtasks, checklists: taskChecklists };
    });

    // カラムにタスクをネストする
    const columns = colsResult.rows.map((col) => ({
      ...col,
      tasks: tasks.filter((t) => t.column_id === col.id),
    }));

    // 行にカラムをネストして最終的なボードデータを構築する
    const rows: Row[] = rowsResult.rows.map((row) => ({
      ...row,
      columns: columns.filter((c) => c.row_id === row.id),
    }));

    res.json(rows);
  } catch (err) {
    next(err);
  }
});

export default router;
