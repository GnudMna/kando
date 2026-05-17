/** HTTP ステータス付きで呼び出し元へ返す業務エラー。 */
export class HttpError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "HttpError";
  }
}
