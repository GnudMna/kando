import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createMemo, deleteMemo, fetchMemos, updateMemo } from "../api/memos";
import { queryKeys } from "../api/queryKeys";
import type { Memo } from "@kando/types";

/**
 * メモ一覧の取得・更新を React Query で管理する。
 * @returns メモ一覧クエリ結果(`data`, `isLoading`, `error` 等)
 */
export function useMemosQuery() {
  return useQuery({
    queryKey: queryKeys.memos.list(),
    queryFn: fetchMemos,
    staleTime: 60_000,
  });
}

/**
 * メモの作成・更新・削除ミューテーション。
 * @returns `create` / `update` / `remove` ミューテーションとキャッシュ操作関数
 */
export function useMemoMutations() {
  const queryClient = useQueryClient();

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: queryKeys.memos.list() });

  const setMemosCache = (updater: (memos: Memo[]) => Memo[]) => {
    queryClient.setQueryData<Memo[]>(queryKeys.memos.list(), (old) =>
      updater(old ?? []),
    );
  };

  const create = useMutation({
    mutationFn: ({ title, content }: { title: string; content: string }) =>
      createMemo(title, content),
    onSuccess: (memo) => {
      setMemosCache((memos) => [...memos, memo]);
    },
  });

  const update = useMutation({
    mutationFn: ({
      id,
      patch,
    }: {
      id: number;
      patch: { title?: string; content?: string };
    }) => updateMemo(id, patch),
    onSuccess: (memo) => {
      setMemosCache((memos) => memos.map((m) => (m.id === memo.id ? memo : m)));
    },
  });

  const remove = useMutation({
    mutationFn: (id: number) => deleteMemo(id),
    onSuccess: (_result, id) => {
      setMemosCache((memos) => memos.filter((m) => m.id !== id));
    },
  });

  return { create, update, remove, invalidate, setMemosCache };
}
