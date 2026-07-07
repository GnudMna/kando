import { useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "../../api/queryKeys";
import { useOperationError } from "../../providers/useOperationError";
import { createMutationErrorHandler } from "../../utils/operationError";
import { updateBoardRows, type BoardCache } from "./boardCache";

/**
 * ボードミューテーション共通のキャッシュ更新・エラーハンドリング。
 * @returns キャッシュ更新関数とエラーハンドラ
 */
export function useBoardMutationContext() {
  const { reportError } = useOperationError();
  const queryClient = useQueryClient();

  const setBoardRows = updateBoardRows.bind(null, queryClient);

  const getBoardRows = () =>
    queryClient.getQueryData<BoardCache>(queryKeys.board.list())?.rows ?? [];

  const onMutationError = (message: string) =>
    createMutationErrorHandler(reportError, message);

  return { queryClient, setBoardRows, getBoardRows, onMutationError };
}
