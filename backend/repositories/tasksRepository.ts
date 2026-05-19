// タスク関連の DB クエリを提供するリポジトリ層
import type { PoolClient } from "pg";
import type {
  DbTask,
  Task,
  TaskSnapshotChecklistPayload,
  TaskSnapshotCommentPayload,
} from "@kando/types";
import { HttpError } from "../errors.js";

export const TASK_RETURNING_COLUMNS =
  "id, column_id, content, due_date::text AS due_date, position, completed";

/**
 * 並び順を 1000 刻みで採番する。
 */
export function calcPosition(index: number): number {
  return (index + 1) * 1000;
}

/**
 * 既存 ID 群から keep 対象を除いた削除対象 ID を返す。
 */
export function idsToDelete(
  existingIds: Set<number>,
  keepIds: Set<number>,
): number[] {
  const ids: number[] = [];
  for (const id of existingIds) {
    if (!keepIds.has(id)) {
      ids.push(id);
    }
  }
  return ids;
}

/**
 * チェックリストをスナップショット内容に合わせて同期する。
 */
export async function syncChecklists(
  client: PoolClient,
  parent: { type: "task"; id: number } | { type: "subtask"; id: number },
  checklists: TaskSnapshotChecklistPayload[],
): Promise<void> {
  const isTask = parent.type === "task";
  const existingResult = await client.query<{ id: number }>(
    isTask
      ? "SELECT id FROM checklist_items WHERE task_id = $1 AND subtask_id IS NULL FOR UPDATE"
      : "SELECT id FROM checklist_items WHERE subtask_id = $1 FOR UPDATE",
    [parent.id],
  );

  const existingIds = new Set(existingResult.rows.map((row) => row.id));
  const keepIds = new Set<number>();
  const errorFieldPath = isTask ? "checklists" : "subtasks.checklists";

  for (const checklist of checklists) {
    if (checklist.id === undefined) continue;
    if (!existingIds.has(checklist.id)) {
      throw new HttpError(
        400,
        `'${errorFieldPath}.id' contains unknown id ${checklist.id}`,
      );
    }
    keepIds.add(checklist.id);
  }

  const removeIds = idsToDelete(existingIds, keepIds);
  if (removeIds.length > 0) {
    await client.query(
      "DELETE FROM checklist_items WHERE id = ANY($1::int[])",
      [removeIds],
    );
  }

  const toUpdate: Array<{
    id: number;
    content: string;
    completed: boolean;
    position: number;
  }> = [];
  const toInsert: Array<{
    content: string;
    completed: boolean;
    position: number;
  }> = [];

  for (const [index, checklist] of checklists.entries()) {
    const position = calcPosition(index);
    if (checklist.id !== undefined) {
      toUpdate.push({
        id: checklist.id,
        content: checklist.content,
        completed: checklist.completed,
        position,
      });
    } else {
      toInsert.push({
        content: checklist.content,
        completed: checklist.completed,
        position,
      });
    }
  }

  if (toUpdate.length > 0) {
    await client.query(
      `UPDATE checklist_items SET
         content   = updates.content,
         completed = updates.completed,
         position  = updates.position
       FROM unnest($1::int[], $2::text[], $3::bool[], $4::int[])
         AS updates(id, content, completed, position)
       WHERE checklist_items.id = updates.id`,
      [
        toUpdate.map((u) => u.id),
        toUpdate.map((u) => u.content),
        toUpdate.map((u) => u.completed),
        toUpdate.map((u) => u.position),
      ],
    );
  }

  if (toInsert.length > 0) {
    if (isTask) {
      await client.query(
        `INSERT INTO checklist_items (task_id, subtask_id, content, completed, position)
         SELECT $1, NULL, content, completed, position
         FROM unnest($2::text[], $3::bool[], $4::int[])
           AS t(content, completed, position)`,
        [
          parent.id,
          toInsert.map((i) => i.content),
          toInsert.map((i) => i.completed),
          toInsert.map((i) => i.position),
        ],
      );
    } else {
      await client.query(
        `INSERT INTO checklist_items (task_id, subtask_id, content, completed, position)
         SELECT NULL, $1, content, completed, position
         FROM unnest($2::text[], $3::bool[], $4::int[])
           AS t(content, completed, position)`,
        [
          parent.id,
          toInsert.map((i) => i.content),
          toInsert.map((i) => i.completed),
          toInsert.map((i) => i.position),
        ],
      );
    }
  }
}

/**
 * タスクコメントをスナップショット内容に合わせて同期する。
 */
export async function syncTaskComments(
  client: PoolClient,
  taskId: number,
  comments: TaskSnapshotCommentPayload[],
): Promise<void> {
  const existingResult = await client.query<{ id: number }>(
    "SELECT id FROM task_comments WHERE task_id = $1 FOR UPDATE",
    [taskId],
  );

  const existingIds = new Set(existingResult.rows.map((row) => row.id));
  const keepIds = new Set<number>();

  for (const comment of comments) {
    if (comment.id === undefined) continue;
    if (!existingIds.has(comment.id)) {
      throw new HttpError(
        400,
        `'comments.id' contains unknown id ${comment.id}`,
      );
    }
    keepIds.add(comment.id);
  }

  const removeIds = idsToDelete(existingIds, keepIds);
  if (removeIds.length > 0) {
    await client.query("DELETE FROM task_comments WHERE id = ANY($1::int[])", [
      removeIds,
    ]);
  }

  const toUpdate: Array<{ id: number; content: string; position: number }> = [];
  const toInsert: Array<{ content: string; position: number }> = [];

  for (const [index, comment] of comments.entries()) {
    const position = calcPosition(index);
    if (comment.id !== undefined) {
      toUpdate.push({ id: comment.id, content: comment.content, position });
    } else {
      toInsert.push({ content: comment.content, position });
    }
  }

  if (toUpdate.length > 0) {
    await client.query(
      `UPDATE task_comments SET
         content  = updates.content,
         position = updates.position
       FROM unnest($1::int[], $2::text[], $3::int[])
         AS updates(id, content, position)
       WHERE task_comments.id = updates.id`,
      [
        toUpdate.map((u) => u.id),
        toUpdate.map((u) => u.content),
        toUpdate.map((u) => u.position),
      ],
    );
  }

  if (toInsert.length > 0) {
    await client.query(
      `INSERT INTO task_comments (task_id, content, position)
       SELECT $1, content, position
       FROM unnest($2::text[], $3::int[])
         AS t(content, position)`,
      [taskId, toInsert.map((i) => i.content), toInsert.map((i) => i.position)],
    );
  }
}

/**
 * 1件のタスクと関連子要素（サブタスク・チェックリスト・コメント）を単一 CTE クエリで
 * 再取得し、API レスポンスのスナップショット形式へ組み立てて返す。
 */
export async function fetchTaskSnapshot(
  client: PoolClient,
  taskId: number,
): Promise<Task | null> {
  const result = await client.query<
    DbTask & {
      subtasks: Task["subtasks"];
      checklists: Task["checklists"];
      comments: Task["comments"];
    }
  >(
    `WITH
       sub_cl AS (
         SELECT
           ci.subtask_id,
           json_agg(
             json_build_object(
               'id', ci.id,
               'task_id', ci.task_id,
               'subtask_id', ci.subtask_id,
               'content', ci.content,
               'completed', ci.completed,
               'position', ci.position
             ) ORDER BY ci.position ASC
           ) AS checklists
         FROM checklist_items ci
         WHERE ci.subtask_id IN (SELECT id FROM subtasks WHERE task_id = $1)
         GROUP BY ci.subtask_id
       ),
       agg_subtasks AS (
         SELECT json_agg(
           json_build_object(
             'id', s.id,
             'task_id', s.task_id,
             'content', s.content,
             'checklists', COALESCE(sc.checklists, '[]'::json)
           ) ORDER BY s.id ASC
         ) AS subtasks
         FROM subtasks s
         LEFT JOIN sub_cl sc ON sc.subtask_id = s.id
         WHERE s.task_id = $1
       ),
       task_cl AS (
         SELECT json_agg(
           json_build_object(
             'id', ci.id,
             'task_id', ci.task_id,
             'subtask_id', ci.subtask_id,
             'content', ci.content,
             'completed', ci.completed,
             'position', ci.position
           ) ORDER BY ci.position ASC
         ) AS checklists
         FROM checklist_items ci
         WHERE ci.task_id = $1 AND ci.subtask_id IS NULL
       ),
       task_cmt AS (
         SELECT json_agg(
           json_build_object(
             'id', tc.id,
             'task_id', tc.task_id,
             'content', tc.content,
             'created_at', tc.created_at,
             'position', tc.position
           ) ORDER BY tc.position ASC, tc.created_at ASC, tc.id ASC
         ) AS comments
         FROM task_comments tc
         WHERE tc.task_id = $1
       )
     SELECT
       t.id,
       t.column_id,
       t.content,
       t.due_date::text AS due_date,
       t.position,
       t.completed,
       COALESCE((SELECT subtasks FROM agg_subtasks), '[]'::json) AS subtasks,
       COALESCE((SELECT checklists FROM task_cl), '[]'::json) AS checklists,
       COALESCE((SELECT comments FROM task_cmt), '[]'::json) AS comments
     FROM tasks t
     WHERE t.id = $1`,
    [taskId],
  );

  const row = result.rows[0];
  if (!row) return null;
  return row as Task;
}

/**
 * タスクを作成し、空の子要素を付けて返す。
 * 所有権確認は呼び出し元（サービス層）が行う。
 */
export async function insertTask(
  client: PoolClient,
  column_id: number,
  content: string,
  due_date: string | null,
  position: number,
): Promise<Task> {
  const result = await client.query<DbTask>(
    `INSERT INTO tasks (column_id, content, due_date, position)
     VALUES ($1, $2, $3, $4)
     RETURNING ${TASK_RETURNING_COLUMNS}`,
    [column_id, content, due_date, position],
  );
  return { ...result.rows[0], subtasks: [], checklists: [], comments: [] };
}
