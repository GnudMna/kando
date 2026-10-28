import type { PoolClient } from "pg";
import type { PositionSlot } from "../positionSlot.js";
import type {
  DbTask,
  Task,
  TaskSnapshotChecklistPayload,
  TaskSnapshotCommentPayload,
} from "@kando/types";
import { HttpError } from "../errors.js";
import type { Queryable } from "./rowsRepository.js";

/** タスク INSERT/UPDATE の `RETURNING` 句で取得するカラム一覧。 */
export const TASK_RETURNING_COLUMNS =
  "id, column_id, content, due_date::text AS due_date, position, completed, revision";

/**
 * タスクの `revision` を 1 進める。
 * サブタスク・チェックリスト・コメントを個別 API で変更したときに呼び、
 * 開きっぱなしの編集モーダルからのスナップショット保存を 409 にする。
 * @param client - トランザクション中のクライアント(対象タスクは事前にロックしておく)
 * @param taskId - 子要素が属するタスク ID
 */
export async function bumpTaskRevision(
  client: Queryable,
  taskId: number,
): Promise<void> {
  await client.query("UPDATE tasks SET revision = revision + 1 WHERE id = $1", [
    taskId,
  ]);
}

/**
 * 配列インデックスから並び順用の position 値を 1000 刻みで採番する。
 * @param index - 0 始まりの配列インデックス
 * @returns `(index + 1) * 1000` の position 値
 */
export function calcPosition(index: number): number {
  return (index + 1) * 1000;
}

/**
 * カラムを ID 順にロックしてから、配下タスクを ID 順にロックして返す。
 * 移動とコピーが同じ順でロックすることで、position 採番の競合とデッドロックを避ける。
 * @param client - トランザクション中のクライアント
 * @param columnIds - ロックするカラム ID
 * @returns ロック済みタスクの ID・所属カラム・position
 */
export async function lockTasksInColumns(
  client: PoolClient,
  columnIds: number[],
): Promise<Array<PositionSlot & { column_id: number }>> {
  const ids = [...new Set(columnIds)].sort((a, b) => a - b);
  await client.query(
    "SELECT id FROM columns WHERE id = ANY($1::int[]) ORDER BY id FOR UPDATE",
    [ids],
  );
  const result = await client.query<PositionSlot & { column_id: number }>(
    `SELECT id, column_id, position FROM tasks
     WHERE column_id = ANY($1::int[])
     ORDER BY id
     FOR UPDATE`,
    [ids],
  );
  return result.rows;
}

/**
 * ロック中のタスク position を振り直す。
 * @param client - トランザクション中のクライアント
 * @param updates - 更新するタスク ID と position
 */
export async function updateTaskPositions(
  client: PoolClient,
  updates: PositionSlot[],
): Promise<void> {
  if (updates.length === 0) return;
  await client.query(
    `UPDATE tasks SET position = data.position
     FROM unnest($1::int[], $2::float8[]) AS data(id, position)
     WHERE tasks.id = data.id`,
    [updates.map((item) => item.id), updates.map((item) => item.position)],
  );
}

/**
 * 既存 ID 集合から保持対象を除いた、削除すべき ID の配列を返す。
 * @param existingIds - DB 上に存在する ID 集合
 * @param keepIds - スナップショットで保持する ID 集合
 * @returns 削除対象の ID 配列(順序は `existingIds` の走査順)
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
 * チェックリストをスナップショット内容に合わせて DB と同期する。
 *
 * スナップショットに含まれない既存項目は削除し、ID 付き項目は更新、
 * ID なし項目は新規挿入する。未知の ID が含まれる場合は 400 エラーを投げる。
 *
 * @param client - トランザクション中の DB クライアント
 * @param parent - 親エンティティ(タスクまたはサブタスク)
 * @param checklists - 同期後のチェックリスト内容
 * @returns 同期完了時に解決される Promise
 */
export async function syncChecklists(
  client: PoolClient,
  parent: { type: "task"; id: number } | { type: "subtask"; id: number },
  checklists: TaskSnapshotChecklistPayload[],
): Promise<void> {
  const isTask = parent.type === "task";
  // FOR UPDATE: 同一トランザクション内の並行更新を直列化し、削除対象の判定を安定させる
  const existingResult = await client.query<{ id: number }>(
    isTask
      ? "SELECT id FROM checklist_items WHERE task_id = $1 AND subtask_id IS NULL FOR UPDATE"
      : "SELECT id FROM checklist_items WHERE subtask_id = $1 FOR UPDATE",
    [parent.id],
  );

  const existingIds = new Set(existingResult.rows.map((row) => row.id));
  const keepIds = new Set<number>();
  const errorFieldPath = isTask ? "checklists" : "subtasks.checklists";

  // id なし行はこのループでは keep 対象に含めない(後段の INSERT で新規作成する)
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
 * タスクコメントをスナップショット内容に合わせて DB と同期する。
 *
 * スナップショットに含まれない既存コメントは削除し、ID 付き項目は更新、
 * ID なし項目は新規挿入する。未知の ID が含まれる場合は 400 エラーを投げる。
 *
 * @param client - トランザクション中の DB クライアント
 * @param taskId - 対象タスク ID
 * @param comments - 同期後のコメント内容
 * @returns 同期完了時に解決される Promise
 */
export async function syncTaskComments(
  client: PoolClient,
  taskId: number,
  comments: TaskSnapshotCommentPayload[],
): Promise<void> {
  // FOR UPDATE: 同一トランザクション内の並行更新を直列化し、削除対象の判定を安定させる
  const existingResult = await client.query<{ id: number }>(
    "SELECT id FROM task_comments WHERE task_id = $1 FOR UPDATE",
    [taskId],
  );

  const existingIds = new Set(existingResult.rows.map((row) => row.id));
  const keepIds = new Set<number>();

  // id なし行はこのループでは keep 対象に含めない(後段の INSERT で新規作成する)
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
 * 1件のタスクと関連子要素(サブタスク・チェックリスト・コメント)を単一 CTE クエリで
 * 再取得し、API レスポンスのスナップショット形式へ組み立てて返す。
 *
 * @param client - DB クライアント
 * @param taskId - 取得対象のタスク ID
 * @returns タスクスナップショット。該当レコードがない場合は `null`
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
       t.revision,
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
 * タスクを作成し、空の子要素(サブタスク・チェックリスト・コメント)を付けて返す。
 * 所有権確認は呼び出し元(サービス層)が行う。
 *
 * @param client - DB クライアント
 * @param column_id - タスクを追加するカラム ID
 * @param content - タスク本文
 * @param due_date - 期限日(`YYYY-MM-DD`)。未設定は `null`
 * @param position - カラム内の表示順
 * @returns 作成されたタスク(子要素は空配列)
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
