import type { Pool } from "pg";
import { pool } from "../db.js";
import type { DbTask, Task, TaskSnapshotPayload } from "@kando/types";
import { ConflictError, HttpError, NotFoundError } from "../errors.js";
import { appendPosition, assignPosition } from "../positionSlot.js";
import {
  TASK_RETURNING_COLUMNS,
  calcPosition,
  fetchTaskSnapshot,
  insertTask,
  idsToDelete,
  lockTasksInColumns,
  syncChecklists,
  syncTaskComments,
  updateTaskPositions,
} from "../repositories/tasksRepository.js";

/**
 * タスクを作成する。カラムの所有権を確認してから INSERT する。
 * @param column_id - タスクを追加するカラム ID
 * @param content - タスク本文
 * @param due_date - 期限日(`YYYY-MM-DD`)。未設定は `null`
 * @param position - カラム内の表示順
 * @param userId - 操作ユーザーの ID
 * @returns 作成したタスク(子要素は空配列)
 * @throws NotFoundError カラムがユーザーのものでない場合
 */
export async function createTask(
  column_id: number,
  content: string,
  due_date: string | null,
  position: number,
  userId: number,
): Promise<Task> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const colCheck = await client.query<{ id: number }>(
      `SELECT c.id FROM columns c
       JOIN rows r ON r.id = c.row_id
       WHERE c.id = $1 AND r.user_id = $2`,
      [column_id, userId],
    );
    if (!colCheck.rows[0]) {
      throw new NotFoundError("Column not found");
    }
    const locked = await lockTasksInColumns(client, [column_id]);
    const placed = assignPosition(locked, null, position);
    await updateTaskPositions(client, placed.rebalance);
    const created = await insertTask(
      client,
      column_id,
      content,
      due_date,
      placed.position,
    );
    await client.query("COMMIT");
    return created;
  } catch (err) {
    try {
      await client.query("ROLLBACK");
    } catch (rollbackErr) {
      console.error("Rollback failed:", rollbackErr);
    }
    throw err;
  } finally {
    client.release();
  }
}

type TaskPatch = {
  content?: string;
  due_date?: string | null;
  completed?: boolean;
};

/**
 * タスクのフィールドを部分更新する。
 * @param id - 更新対象タスク ID
 * @param patch - 更新するフィールド(`content` / `due_date` / `completed`)
 * @param userId - 操作ユーザーの ID
 * @returns 更新後タスク
 * @throws NotFoundError タスクがユーザーのものでない場合
 */
export async function updateTask(
  id: number,
  patch: TaskPatch,
  userId: number,
): Promise<Task> {
  const updates: string[] = [];
  const values: Array<string | number | boolean | null> = [];

  // hasOwnProperty でキーの「存在」を判定し、due_date: null(期限クリア)と
  // キー未指定(フィールドを変更しない)を区別する
  if (Object.prototype.hasOwnProperty.call(patch, "content")) {
    updates.push(`content = $${values.length + 1}`);
    values.push(patch.content as string);
  }
  if (Object.prototype.hasOwnProperty.call(patch, "due_date")) {
    updates.push(`due_date = $${values.length + 1}`);
    values.push(patch.due_date ?? null);
  }
  if (Object.prototype.hasOwnProperty.call(patch, "completed")) {
    updates.push(`completed = $${values.length + 1}`);
    values.push(patch.completed as boolean);
  }
  if (updates.length > 0) {
    updates.push("revision = revision + 1");
  }

  values.push(id);
  values.push(userId);

  const result = await (pool as Pool).query<DbTask>(
    `UPDATE tasks SET ${updates.join(", ")}
     WHERE id = $${values.length - 1}
       AND column_id IN (
         SELECT c.id FROM columns c
         JOIN rows r ON r.id = c.row_id
         WHERE r.user_id = $${values.length}
       )
     RETURNING ${TASK_RETURNING_COLUMNS}`,
    values,
  );
  if (!result.rows[0]) {
    throw new NotFoundError("Task not found");
  }
  return result.rows[0] as Task;
}

/**
 * タスク編集モーダルのスナップショットを単一トランザクションで一括保存する。
 *
 * サブタスクは「既存更新 → 新規 INSERT → 削除 → チェックリスト同期」の順で処理する。
 * 削除を先に行うと FK/CASCADE で配下チェックリストが消えるため、新規行の ID 確定後に削除する。
 *
 * @param id - 保存対象タスク ID
 * @param payload - モーダル全体の保存ペイロード
 * @param due_date - 正規化済み期限日。未設定は `null`
 * @param userId - 操作ユーザーの ID
 * @returns 保存後タスク(全子要素を含む)
 * @throws NotFoundError タスクがユーザーのものでない場合
 * @throws HttpError バリデーションエラー
 */
export async function saveTaskSnapshot(
  id: number,
  payload: TaskSnapshotPayload,
  due_date: string | null,
  userId: number,
): Promise<Task> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const taskLockResult = await client.query<{ id: number; revision: number }>(
      `SELECT t.id, t.revision FROM tasks t
       JOIN columns c ON c.id = t.column_id
       JOIN rows r ON r.id = c.row_id
       WHERE t.id = $1 AND r.user_id = $2 FOR UPDATE`,
      [id, userId],
    );
    const lockedTask = taskLockResult.rows[0];
    if (!lockedTask) {
      throw new HttpError(404, "Task not found");
    }
    if (lockedTask.revision !== payload.revision) {
      throw new ConflictError(
        "他の変更が先に保存されています。開き直してから保存してください。",
      );
    }

    await client.query(
      `UPDATE tasks
       SET content = $1, due_date = $2, completed = $3, revision = revision + 1
       WHERE id = $4`,
      [payload.content, due_date, payload.completed, id],
    );

    const existingSubtaskResult = await client.query<{ id: number }>(
      "SELECT id FROM subtasks WHERE task_id = $1 FOR UPDATE",
      [id],
    );
    const existingSubtaskIds = new Set(
      existingSubtaskResult.rows.map((row) => row.id),
    );
    const keepSubtaskIds = new Set<number>();
    const resolvedSubtasks: Array<{
      id: number;
      checklists: (typeof payload.subtasks)[0]["checklists"];
    }> = [];

    const subtasksToUpdate = payload.subtasks.filter(
      (s): s is typeof s & { id: number } => s.id !== undefined,
    );
    for (const subtask of subtasksToUpdate) {
      if (!existingSubtaskIds.has(subtask.id)) {
        throw new HttpError(
          400,
          `'subtasks.id' contains unknown id ${subtask.id}`,
        );
      }
      keepSubtaskIds.add(subtask.id);
    }
    if (subtasksToUpdate.length > 0) {
      await client.query(
        `UPDATE subtasks SET content = updates.content
         FROM unnest($1::int[], $2::text[]) AS updates(id, content)
         WHERE subtasks.id = updates.id`,
        [
          subtasksToUpdate.map((s) => s.id),
          subtasksToUpdate.map((s) => s.content),
        ],
      );
    }

    for (const subtask of payload.subtasks) {
      if (subtask.id !== undefined) {
        resolvedSubtasks.push({
          id: subtask.id,
          checklists: subtask.checklists,
        });
        continue;
      }

      const createdSubtaskResult = await client.query<{ id: number }>(
        "INSERT INTO subtasks (task_id, content) VALUES ($1, $2) RETURNING id",
        [id, subtask.content],
      );
      const createdSubtaskId = createdSubtaskResult.rows[0]?.id;
      if (!createdSubtaskId) {
        throw new Error("Failed to create subtask");
      }
      resolvedSubtasks.push({
        id: createdSubtaskId,
        checklists: subtask.checklists,
      });
    }

    // 新規 INSERT で ID が確定してから削除する(先に DELETE すると CASCADE で子が消える)
    const subtaskIdsForDelete = idsToDelete(existingSubtaskIds, keepSubtaskIds);
    if (subtaskIdsForDelete.length > 0) {
      await client.query("DELETE FROM subtasks WHERE id = ANY($1::int[])", [
        subtaskIdsForDelete,
      ]);
    }

    await syncChecklists(client, { type: "task", id }, payload.checklists);

    for (const subtask of resolvedSubtasks) {
      await syncChecklists(
        client,
        { type: "subtask", id: subtask.id },
        subtask.checklists,
      );
    }

    await syncTaskComments(client, id, payload.comments);

    const savedTask = await fetchTaskSnapshot(client, id);
    if (!savedTask) {
      throw new HttpError(404, "Task not found");
    }

    await client.query("COMMIT");
    return savedTask;
  } catch (err) {
    try {
      await client.query("ROLLBACK");
    } catch (rollbackErr) {
      console.error("Rollback failed:", rollbackErr);
    }
    throw err;
  } finally {
    client.release();
  }
}

/**
 * タスクを別カラムへ移動する。
 * @param id - 移動対象タスク ID
 * @param column_id - 移動先カラム ID
 * @param position - 移動先カラム内の表示順
 * @param userId - 操作ユーザーの ID
 * @returns 更新後タスク
 * @throws NotFoundError タスクまたは移動先カラムがユーザーのものでない場合
 */
export async function moveTask(
  id: number,
  column_id: number,
  position: number,
  userId: number,
): Promise<Task> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const destCheck = await client.query<{ id: number }>(
      `SELECT c.id FROM columns c
       JOIN rows r ON r.id = c.row_id
       WHERE c.id = $1 AND r.user_id = $2`,
      [column_id, userId],
    );
    if (!destCheck.rows[0]) {
      throw new NotFoundError("Column not found");
    }
    const source = await client.query<{ column_id: number }>(
      `SELECT t.column_id FROM tasks t
       JOIN columns c ON c.id = t.column_id
       JOIN rows r ON r.id = c.row_id
       WHERE t.id = $1 AND r.user_id = $2`,
      [id, userId],
    );
    if (!source.rows[0]) {
      throw new NotFoundError("Task not found");
    }

    const locked = await lockTasksInColumns(client, [
      source.rows[0].column_id,
      column_id,
    ]);
    const placed = assignPosition(
      locked.filter((task) => task.column_id === column_id),
      id,
      position,
    );
    await updateTaskPositions(client, placed.rebalance);
    const result = await client.query<DbTask>(
      `UPDATE tasks SET column_id = $1, position = $2
       WHERE id = $3
       RETURNING ${TASK_RETURNING_COLUMNS}`,
      [column_id, placed.position, id],
    );
    if (!result.rows[0]) {
      throw new NotFoundError("Task not found");
    }
    await client.query("COMMIT");
    return result.rows[0] as Task;
  } catch (err) {
    try {
      await client.query("ROLLBACK");
    } catch (rollbackErr) {
      console.error("Rollback failed:", rollbackErr);
    }
    throw err;
  } finally {
    client.release();
  }
}

/**
 * タスクを同一カラムの末尾にコピーする(サブタスク・チェックリスト・コメントも複製)。
 * @param id - コピー元タスク ID
 * @param userId - 操作ユーザーの ID
 * @returns 複製したタスク(全子要素を含む)
 * @throws NotFoundError タスクがユーザーのものでない場合
 */
export async function copyTask(id: number, userId: number): Promise<Task> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const ownerCheck = await client.query<{ column_id: number }>(
      `SELECT t.column_id FROM tasks t
       JOIN columns c ON c.id = t.column_id
       JOIN rows r ON r.id = c.row_id
       WHERE t.id = $1 AND r.user_id = $2`,
      [id, userId],
    );
    if (!ownerCheck.rows[0]) {
      throw new NotFoundError("Task not found");
    }

    const locked = await lockTasksInColumns(client, [
      ownerCheck.rows[0].column_id,
    ]);
    if (!locked.some((task) => task.id === id)) {
      throw new NotFoundError("Task not found");
    }

    const srcTask = await fetchTaskSnapshot(client, id);
    if (!srcTask) {
      throw new NotFoundError("Task not found");
    }
    const placed = appendPosition(locked);
    await updateTaskPositions(client, placed.rebalance);
    const newPosition = placed.position;

    // コピー先は未完了タスクとして作成し、チェックリストも completed: false で複製する
    const newTaskResult = await client.query<DbTask>(
      `INSERT INTO tasks (column_id, content, due_date, position, completed)
       VALUES ($1, $2, $3, $4, false)
       RETURNING ${TASK_RETURNING_COLUMNS}`,
      [
        srcTask.column_id,
        `${srcTask.content} のコピー`,
        srcTask.due_date,
        newPosition,
      ],
    );
    const newTask = newTaskResult.rows[0];
    if (!newTask) throw new Error("Failed to copy task");

    if (srcTask.checklists.length > 0) {
      await client.query(
        `INSERT INTO checklist_items (task_id, subtask_id, content, completed, position)
         SELECT $1, NULL, content, false, position
         FROM unnest($2::text[], $3::int[]) AS t(content, position)`,
        [
          newTask.id,
          srcTask.checklists.map((cl) => cl.content),
          srcTask.checklists.map((_, i) => calcPosition(i)),
        ],
      );
    }

    if (srcTask.comments.length > 0) {
      await client.query(
        `INSERT INTO task_comments (task_id, content, position)
         SELECT $1, content, position
         FROM unnest($2::text[], $3::int[]) AS t(content, position)`,
        [
          newTask.id,
          srcTask.comments.map((cm) => cm.content),
          srcTask.comments.map((_, i) => calcPosition(i)),
        ],
      );
    }

    for (const subtask of srcTask.subtasks) {
      const newSubtaskResult = await client.query<{ id: number }>(
        "INSERT INTO subtasks (task_id, content) VALUES ($1, $2) RETURNING id",
        [newTask.id, subtask.content],
      );
      const newSubtaskId = newSubtaskResult.rows[0]?.id;
      if (!newSubtaskId) throw new Error("Failed to copy subtask");

      if (subtask.checklists.length > 0) {
        await client.query(
          `INSERT INTO checklist_items (task_id, subtask_id, content, completed, position)
           SELECT NULL, $1, content, false, position
           FROM unnest($2::text[], $3::int[]) AS t(content, position)`,
          [
            newSubtaskId,
            subtask.checklists.map((cl) => cl.content),
            subtask.checklists.map((_, i) => calcPosition(i)),
          ],
        );
      }
    }

    const copied = await fetchTaskSnapshot(client, newTask.id);
    await client.query("COMMIT");
    return copied!;
  } catch (err) {
    try {
      await client.query("ROLLBACK");
    } catch (rollbackErr) {
      console.error("Rollback failed:", rollbackErr);
    }
    throw err;
  } finally {
    client.release();
  }
}

/**
 * タスク詳細(サブタスク・チェックリスト・コメント含む)を取得する。
 * @param id - 取得対象タスク ID
 * @param userId - 操作ユーザーの ID
 * @returns タスク詳細
 * @throws NotFoundError タスクがユーザーのものでない場合
 */
export async function getTask(id: number, userId: number): Promise<Task> {
  const client = await pool.connect();
  try {
    const ownerCheck = await client.query<{ id: number }>(
      `SELECT t.id FROM tasks t
       JOIN columns c ON c.id = t.column_id
       JOIN rows r ON r.id = c.row_id
       WHERE t.id = $1 AND r.user_id = $2`,
      [id, userId],
    );
    if (!ownerCheck.rows[0]) {
      throw new NotFoundError("Task not found");
    }

    const task = await fetchTaskSnapshot(client, id);
    if (!task) {
      throw new NotFoundError("Task not found");
    }
    return task;
  } finally {
    client.release();
  }
}

/**
 * タスクを削除する(サブタスク・チェックリストも CASCADE で削除)。
 * @param id - 削除対象タスク ID
 * @param userId - 操作ユーザーの ID
 * @returns `true`: 削除成功、`false`: 対象なし
 */
export async function deleteTask(id: number, userId: number): Promise<boolean> {
  const result = await pool.query(
    `DELETE FROM tasks WHERE id = $1
     AND column_id IN (
       SELECT c.id FROM columns c
       JOIN rows r ON r.id = c.row_id
       WHERE r.user_id = $2
     )`,
    [id, userId],
  );
  return (result.rowCount ?? 0) > 0;
}
