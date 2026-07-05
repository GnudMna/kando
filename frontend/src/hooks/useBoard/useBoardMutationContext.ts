import { useQueryClient } from "@tanstack/react-query";
import type { Dispatch, SetStateAction } from "react";
import { queryKeys } from "../../api/queryKeys";
import { updateBoardRows, type BoardCache } from "./boardCache";

/**
 * ボードミューテーション共通のキャッシュ更新・エラーハンドリング。
 * @param setOperationError - 操作エラー表示用 setter
 * @returns キャッシュ更新関数とエラーハンドラ
 */
export function useBoardMutationContext(
  setOperationError: Dispatch<SetStateAction<string | null>>,
) {
  const queryClient = useQueryClient();

  const setBoardRows = updateBoardRows.bind(null, queryClient);

  const getBoardRows = () =>
    queryClient.getQueryData<BoardCache>(queryKeys.board.list())?.rows ?? [];

  const onMutationError = (message: string) => (err: unknown) => {
    console.error(err);
    setOperationError(message);
  };

  return { queryClient, setBoardRows, getBoardRows, onMutationError };
}
