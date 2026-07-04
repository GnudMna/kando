import { useRowActions } from "./useRowActions";
import { useColumnActions } from "./useColumnActions";
import { useTaskActions } from "./useTaskActions";
import { useBoardFetch } from "./useBoardFetch";

/**
 * かんばんボードの状態管理カスタムフック。
 *
 * rows の CRUD およびタスク・カラム移動のロジックを提供する。
 * マウント時に自動でボードデータを取得する。
 *
 * @returns ボード state（`rows`, `isLoading`, `hasMore` 等）と操作ハンドラー（`addRow`, `moveTask` 等）
 */
export function useBoard() {
  const fetch = useBoardFetch();
  const ctx = {
    rowsRef: fetch.rowsRef,
    boardIndexesRef: fetch.boardIndexesRef,
    setRows: fetch.setRows,
    setOperationError: fetch.setOperationError,
  };

  const rowActions = useRowActions(ctx);
  const columnActions = useColumnActions(ctx);
  const taskActions = useTaskActions(ctx);

  return {
    rows: fetch.rows,
    isLoading: fetch.isLoading,
    isLoadingMore: fetch.isLoadingMore,
    hasMore: fetch.hasMore,
    operationError: fetch.operationError,
    clearError: fetch.clearError,
    loadMoreRows: fetch.loadMoreRows,
    ...rowActions,
    ...columnActions,
    ...taskActions,
  };
}
