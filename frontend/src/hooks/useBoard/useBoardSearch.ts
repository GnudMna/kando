import { useQuery } from "@tanstack/react-query";
import { fetchBoard } from "../../api/board";
import { queryKeys } from "../../api/queryKeys";

/**
 * サーバー側横断検索の結果を React Query で管理する。
 * @param searchQuery - ユーザー入力の検索文字列（トリム済みを渡す想定）
 * @returns 検索結果行・読み込み状態
 */
export function useBoardSearch(searchQuery: string) {
  const normalized = searchQuery.trim();
  const enabled = normalized.length > 0;

  const { data, isLoading, isFetching, isError } = useQuery({
    queryKey: queryKeys.board.search(normalized),
    queryFn: () => fetchBoard({ q: normalized }),
    enabled,
    staleTime: 30_000,
  });

  return {
    searchRows: data ?? [],
    isSearchLoading: enabled && (isLoading || isFetching),
    isSearchError: enabled && isError,
  };
}
