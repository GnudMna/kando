/** React Query のクエリキー定義（キャッシュの単一ソース）。 */
export const queryKeys = {
  board: {
    all: ["board"] as const,
    list: () => [...queryKeys.board.all, "list"] as const,
  },
  memos: {
    all: ["memos"] as const,
    list: () => [...queryKeys.memos.all, "list"] as const,
  },
} as const;
