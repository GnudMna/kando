import type { DbChecklistItem } from "../types.js";
import type { Queryable } from "./rowsRepository.js";

export const CHECKLIST_POSITION_INCREMENT = 1000;

/**
 * タスク配下の次のチェックリスト position を取得する。
 * @param client - クエリ実行クライアント
 * @param taskId - 親タスク ID
 * @returns 次に採番する position 値
 */
export async function nextChecklistPositionForTask(
  client: Queryable,
  taskId: number,
): Promise<number> {
  const result = await client.query<{ next_position: number }>(
    `SELECT COALESCE(MAX(position), 0) + ${CHECKLIST_POSITION_INCREMENT} AS next_position FROM checklist_items WHERE task_id = $1`,
    [taskId],
  );
  return result.rows[0]?.next_position ?? CHECKLIST_POSITION_INCREMENT;
}

/**
 * サブタスク配下の次のチェックリスト position を取得する。
 * @param client - クエリ実行クライアント
 * @param subtaskId - 親サブタスク ID
 * @returns 次に採番する position 値
 */
export async function nextChecklistPositionForSubtask(
  client: Queryable,
  subtaskId: number,
): Promise<number> {
  const result = await client.query<{ next_position: number }>(
    `SELECT COALESCE(MAX(position), 0) + ${CHECKLIST_POSITION_INCREMENT} AS next_position FROM checklist_items WHERE subtask_id = $1`,
    [subtaskId],
  );
  return result.rows[0]?.next_position ?? CHECKLIST_POSITION_INCREMENT;
}

/**
 * チェックリスト項目を新規作成する。
 * @param client - クエリ実行クライアント
 * @param taskId - 親タスク ID(サブタスク配下の場合は `null`)
 * @param subtaskId - 親サブタスク ID(タスク直下の場合は `null`)
 * @param content - 項目本文
 * @param position - 表示順
 * @returns 作成されたチェックリスト項目
 */
export async function insertChecklistItem(
  client: Queryable,
  taskId: number | null,
  subtaskId: number | null,
  content: string,
  position: number,
): Promise<DbChecklistItem> {
  const result = await client.query<DbChecklistItem>(
    "INSERT INTO checklist_items (task_id, subtask_id, content, position) VALUES ($1, $2, $3, $4) RETURNING *",
    [taskId, subtaskId, content, position],
  );
  return result.rows[0];
}

type ChecklistItemPatch = {
  completed?: boolean;
  content?: string;
  position?: number;
};

/**
 * チェックリスト項目を部分更新する。
 * @param client - クエリ実行クライアント
 * @param id - 更新対象 ID
 * @param patch - 更新フィールド
 * @param userId - 操作ユーザー ID
 * @returns 更新後項目。対象なしは `null`
 */
export async function updateChecklistItem(
  client: Queryable,
  id: number,
  patch: ChecklistItemPatch,
  userId: number,
): Promise<DbChecklistItem | null> {
  const fields: string[] = [];
  const vals: unknown[] = [];
  let idx = 1;

  if (patch.completed !== undefined) {
    fields.push(`completed = $${idx++}`);
    vals.push(patch.completed);
  }
  if (patch.content !== undefined) {
    fields.push(`content = $${idx++}`);
    vals.push(patch.content);
  }
  if (patch.position !== undefined) {
    fields.push(`position = $${idx++}`);
    vals.push(patch.position);
  }

  vals.push(id);
  vals.push(userId);

  const result = await client.query<DbChecklistItem>(
    `UPDATE checklist_items SET ${fields.join(", ")} WHERE id = $${idx}
     AND (
       (task_id IS NOT NULL AND task_id IN (
         SELECT t.id FROM tasks t
         JOIN columns c ON c.id = t.column_id
         JOIN rows r ON r.id = c.row_id
         WHERE r.user_id = $${idx + 1}
       )) OR
       (subtask_id IS NOT NULL AND subtask_id IN (
         SELECT s.id FROM subtasks s
         JOIN tasks t ON t.id = s.task_id
         JOIN columns c ON c.id = t.column_id
         JOIN rows r ON r.id = c.row_id
         WHERE r.user_id = $${idx + 1}
       ))
     ) RETURNING *`,
    vals,
  );
  return result.rows[0] ?? null;
}

/**
 * チェックリスト項目を削除する。
 * @param client - クエリ実行クライアント
 * @param id - 削除対象 ID
 * @param userId - 操作ユーザー ID
 * @returns 削除件数
 */
export async function deleteChecklistItem(
  client: Queryable,
  id: number,
  userId: number,
): Promise<number> {
  const result = await client.query(
    `DELETE FROM checklist_items WHERE id = $1
     AND (
       (task_id IS NOT NULL AND task_id IN (
         SELECT t.id FROM tasks t
         JOIN columns c ON c.id = t.column_id
         JOIN rows r ON r.id = c.row_id
         WHERE r.user_id = $2
       )) OR
       (subtask_id IS NOT NULL AND subtask_id IN (
         SELECT s.id FROM subtasks s
         JOIN tasks t ON t.id = s.task_id
         JOIN columns c ON c.id = t.column_id
         JOIN rows r ON r.id = c.row_id
         WHERE r.user_id = $2
       ))
     )`,
    [id, userId],
  );
  return result.rowCount ?? 0;
}
