import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useRef, useState } from "react";
import type { SetStateAction } from "react";
import type { Row } from "../../types";
import { fetchBoard } from "../../api/board";
import { queryKeys } from "../../api/queryKeys";
import {
  appendBoardRows,
  updateBoardRows,
  type BoardCache,
} from "./boardCache";
import {
  BOARD_PAGE_SIZE,
  buildBoardIndexes,
  type BoardIndexes,
  type ColumnLocation,
} from "./boardIndexes";

async function fetchInitialBoard(): Promise<BoardCache> {
  const rows = await fetchBoard({ limit: BOARD_PAGE_SIZE, detail: "summary" });
  return { rows, hasMore: rows.length === BOARD_PAGE_SIZE };
}

/**
 * ボードデータの取得・ページング状態を React Query で管理する。
 * @returns 行データ、読み込み状態、ページング操作
 */
export function useBoardFetch() {
  const queryClient = useQueryClient();
  const [operationError, setOperationError] = useState<string | null>(null);
  const [dismissedFailureCount, setDismissedFailureCount] = useState(0);
  const rowsRef = useRef<Row[]>([]);
  const boardIndexesRef = useRef<BoardIndexes>({
    rowIndexById: new Map<number, number>(),
    columnLocationByDroppableId: new Map<string, ColumnLocation>(),
  });

  const { data, isLoading, isError, failureCount } = useQuery({
    queryKey: queryKeys.board.list(),
    queryFn: fetchInitialBoard,
  });

  const rows = data?.rows ?? [];
  const hasMore = data?.hasMore ?? false;
  const fetchErrorMessage =
    isError && failureCount > dismissedFailureCount
      ? "ボードの読み込みに失敗しました"
      : null;

  useEffect(() => {
    const nextRows = data?.rows ?? [];
    rowsRef.current = nextRows;
    boardIndexesRef.current = buildBoardIndexes(nextRows);
  }, [data?.rows]);

  const clearError = useCallback(() => {
    setOperationError(null);
    if (isError) {
      setDismissedFailureCount(failureCount);
    }
  }, [isError, failureCount]);

  const setRows = useCallback(
    (action: SetStateAction<Row[]>) => {
      updateBoardRows(queryClient, (currentRows) =>
        typeof action === "function" ? action(currentRows) : action,
      );
    },
    [queryClient],
  );

  const loadMoreMutation = useMutation({
    mutationFn: async () => {
      const current = queryClient.getQueryData<BoardCache>(
        queryKeys.board.list(),
      );
      if (!current?.hasMore) return null;
      const more = await fetchBoard({
        limit: BOARD_PAGE_SIZE,
        offset: current.rows.length,
        detail: "summary",
      });
      return more;
    },
    onSuccess: (more) => {
      if (more === null) return;
      if (more.length > 0) {
        appendBoardRows(queryClient, more, BOARD_PAGE_SIZE);
      } else {
        queryClient.setQueryData<BoardCache>(queryKeys.board.list(), (old) =>
          old ? { ...old, hasMore: false } : old,
        );
      }
    },
    onError: (err) => {
      console.error("Failed to load more rows:", err);
      setOperationError("追加データの読み込みに失敗しました");
    },
  });

  const loadMoreRows = useCallback(async () => {
    if (loadMoreMutation.isPending) return;
    try {
      await loadMoreMutation.mutateAsync();
    } catch {
      /* mutation onError が UI エラーを処理する */
    }
  }, [loadMoreMutation]);

  return {
    rows,
    setRows,
    isLoading,
    isLoadingMore: loadMoreMutation.isPending,
    hasMore,
    operationError: operationError ?? fetchErrorMessage,
    clearError,
    setOperationError,
    loadMoreRows,
    rowsRef,
    boardIndexesRef,
  };
}
