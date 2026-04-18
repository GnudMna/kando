import type { Row, Task } from "../types";

function normalizeQuery(query: string): string {
  return query.trim().toLocaleLowerCase();
}

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

export function taskMatchesQuery(task: Task, query: string): boolean {
  const normalizedQuery = normalizeQuery(query);
  if (!normalizedQuery) return true;

  return taskSearchTexts(task).some((text) =>
    text.toLocaleLowerCase().includes(normalizedQuery),
  );
}

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
