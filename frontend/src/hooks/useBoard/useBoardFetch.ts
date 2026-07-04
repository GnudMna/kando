import { useState, useEffect, useCallback, useRef } from "react";
import type { Row } from "../../types";
import * as api from "../../api/boardApi";
import {
  BOARD_PAGE_SIZE,
  buildBoardIndexes,
  type BoardIndexes,
  type ColumnLocation,
} from "./boardIndexes";

/**
 * ボードデータの取得・ページング状態を管理する。
 * @returns 行データ、読み込み状態、ページング操作
 */
export function useBoardFetch() {
  const [rows, setRows] = useState<Row[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [operationError, setOperationError] = useState<string | null>(null);
  const rowsRef = useRef<Row[]>([]);
  const boardIndexesRef = useRef<BoardIndexes>({
    rowIndexById: new Map<number, number>(),
    columnLocationByDroppableId: new Map<string, ColumnLocation>(),
  });

  useEffect(() => {
    rowsRef.current = rows;
    boardIndexesRef.current = buildBoardIndexes(rows);
  }, [rows]);

  const clearError = useCallback(() => setOperationError(null), []);

  const loadBoard = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await api.fetchBoard({ limit: BOARD_PAGE_SIZE });
      setRows(data);
      setHasMore(data.length === BOARD_PAGE_SIZE);
    } catch (err) {
      console.error("Failed to fetch board:", err);
      setOperationError("ボードの読み込みに失敗しました");
    } finally {
      setIsLoading(false);
    }
  }, []);

  const loadMoreRows = useCallback(async () => {
    setIsLoadingMore(true);
    try {
      const offset = rowsRef.current.length;
      const data = await api.fetchBoard({ limit: BOARD_PAGE_SIZE, offset });
      if (data.length > 0) {
        setRows((prev) => [...prev, ...data]);
      }
      setHasMore(data.length === BOARD_PAGE_SIZE);
    } catch (err) {
      console.error("Failed to load more rows:", err);
      setOperationError("追加データの読み込みに失敗しました");
    } finally {
      setIsLoadingMore(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadBoard();
  }, [loadBoard]);

  return {
    rows,
    setRows,
    isLoading,
    isLoadingMore,
    hasMore,
    operationError,
    clearError,
    setOperationError,
    loadMoreRows,
    rowsRef,
    boardIndexesRef,
  };
}