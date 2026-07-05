/** React Query のクエリキー定義（キャッシュの単一ソース）。 */
export const queryKeys = {
  board: {
    all: ["board"] as const,
    list: () => [...queryKeys.board.all, "list"] as const,
    search: (query: string) =>
      [...queryKeys.board.all, "search", query] as const,
  },
  tasks: {
    all: ["tasks"] as const,
    detail: (id: number) => [...queryKeys.tasks.all, "detail", id] as const,
  },
  memos: {
    all: ["memos"] as const,
    list: () => [...queryKeys.memos.all, "list"] as const,
  },
} as const;
