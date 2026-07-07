/**
 * ミューテーション失敗時のエラーハンドラを生成する。
 * @param reportError - ユーザー向けメッセージを報告する関数
 * @param message - 表示するエラーメッセージ
 * @returns エラーオブジェクトを受け取るコールバック
 */
export function createMutationErrorHandler(
  reportError: (message: string, err?: unknown) => void,
  message: string,
) {
  return (err: unknown) => {
    reportError(message, err);
  };
}
