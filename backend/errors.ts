/** HTTP ステータス付きで呼び出し元へ返す業務エラー。 */
export class HttpError extends Error {
  /**
   * @param status - HTTP ステータスコード
   * @param message - エラーメッセージ
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
   * @param message - エラーメッセージ
   */
  constructor(message: string) {
    super(404, message);
    this.name = "NotFoundError";
  }
}

/** 409 Conflict エラー。 */
export class ConflictError extends HttpError {
  /**
   * @param message - エラーメッセージ
   */
  constructor(message: string) {
    super(409, message);
    this.name = "ConflictError";
  }
}
