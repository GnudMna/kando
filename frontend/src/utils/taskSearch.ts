import type { Row, Task } from "../types";

/**
 * 検索クエリを前後空白除去 + 小文字化して比較しやすくする。
 * @param query - ユーザー入力クエリ
 * @returns 正規化済みクエリ
 */
function normalizeQuery(query: string): string {
  return query.trim().toLocaleLowerCase();
}

/**
 * タスク検索の対象となる文字列群を平坦化して返す。
 * 親タスク本文・期限日・コメント・サブタスク・チェックリストを対象にする。
 * @param task - 検索対象タスク
 * @returns 部分一致検索に使う文字列配列
 */
function taskSearchTexts(task: Task): string[] {
  return [
    task.content,
    task.due_date ?? "",
    ...task.checklists.map((item) => item.content),
    ...task.comments.map((comment) => comment.content),
    ...task.subtasks.flatMap((subtask) => [
      subtask.content,
      ...subtask.checklists.map((item) => item.content),
    ]),
  ];
}

/**
 * 1件のタスクが検索クエリに一致するかを判定する。空クエリは常に一致扱い。
 * @param task - 判定対象タスク
 * @param query - 検索クエリ
 * @returns 一致する場合 `true`
 */
export function taskMatchesQuery(task: Task, query: string): boolean {
  const normalizedQuery = normalizeQuery(query);
  if (!normalizedQuery) return true;

  return taskSearchTexts(task).some((text) =>
    text.toLocaleLowerCase().includes(normalizedQuery),
  );
}

/**
 * 行/カラム/タスクの階層を保ったまま、クエリ一致しないタスク・空カラム・空行を除外する。
 * @param rows - フィルタ対象のボード行配列
 * @param query - 検索クエリ
 * @returns 一致タスクのみを含む新しい行配列
 */
export function filterRowsByTaskQuery(rows: Row[], query: string): Row[] {
  const normalizedQuery = normalizeQuery(query);
  if (!normalizedQuery) {
    return rows;
  }

  return rows
    .map((row) => ({
      ...row,
      columns: row.columns
        .map((column) => ({
          ...column,
          tasks: column.tasks.filter((task) =>
            taskMatchesQuery(task, normalizedQuery),
          ),
        }))
        .filter((column) => column.tasks.length > 0),
    }))
    .filter((row) => row.columns.length > 0);
}

/**
 * ボード内に存在するタスク総数を返す。
 * @param rows - 集計対象のボード行配列
 * @returns タスク総数
 */
export function countTasks(rows: Row[]): number {
  return rows.reduce(
    (rowCount, row) =>
      rowCount +
      row.columns.reduce(
        (columnCount, column) => columnCount + column.tasks.length,
        0,
      ),
    0,
  );
}
