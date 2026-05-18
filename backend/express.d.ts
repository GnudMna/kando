// Express の Request 型に userId を追加する型拡張
export {};

declare global {
  namespace Express {
    interface Request {
      /** 認証済みユーザーの DB ID（authenticate ミドルウェアが設定する） */
      userId?: number;
    }
  }
}
