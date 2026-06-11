/** HTTP ステータス付きで呼び出し元へ返す業務エラー。 */
export class HttpError extends Error {
  /**
   * HTTP ステータス付き業務エラーを生成する。
   * @param status - HTTP ステータスコード
   * @param message - エラーメッセージ
   * @returns `HttpError` インスタンス
   */
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "HttpError";
  }
}

/** 404 Not Found エラー。 */
export class NotFoundError extends HttpError {
  /**
   * 404 Not Found エラーを生成する。
   * @param message - エラーメッセージ
   * @returns `NotFoundError` インスタンス
   */
  constructor(message: string) {
    super(404, message);
    this.name = "NotFoundError";
  }
}

/** 409 Conflict エラー。 */
export class ConflictError extends HttpError {
  /**
   * 409 Conflict エラーを生成する。
   * @param message - エラーメッセージ
   * @returns `ConflictError` インスタンス
   */
  constructor(message: string) {
    super(409, message);
    this.name = "ConflictError";
  }
}
