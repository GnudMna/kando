import { vi } from "vitest";

type MockFn = ReturnType<typeof vi.fn>;

export type MockQueryResult = { rows?: unknown[]; rowCount?: number };

export type MockedTransactionClient = {
  query: MockFn;
  release: MockFn;
};

/** `bumpTaskRevision` が発行する SQL。 */
export const BUMP_REVISION_SQL =
  "UPDATE tasks SET revision = revision + 1 WHERE id = $1";

/**
 * `pool.connect()` が返すトランザクション用モッククライアントを 1 回分用意する。
 * BEGIN / COMMIT / ROLLBACK は自動で成功させ、それ以外の SQL は `handler` で振り分ける。
 * `handler` が `undefined` を返した SQL は、行なし・0 件として扱う。
 * @param connect - モック済みの `pool.connect`
 * @param handler - SQL とパラメータから結果を返す関数
 * @returns 発行された SQL を検証できるモッククライアント
 */
export function setupTransactionClient(
  connect: MockFn,
  handler: (
    sql: string,
    params: unknown[] | undefined,
  ) => MockQueryResult | void,
): MockedTransactionClient {
  const client: MockedTransactionClient = {
    query: vi.fn(async (sql: string, params?: unknown[]) => {
      if (sql === "BEGIN" || sql === "COMMIT" || sql === "ROLLBACK") {
        return { rows: [] };
      }
      return handler(sql, params) ?? { rows: [], rowCount: 0 };
    }),
    release: vi.fn(),
  };
  connect.mockResolvedValueOnce(client);
  return client;
}

/**
 * クライアントが発行した SQL を、トランザクション制御文を除いて順に取り出す。
 * @param client - モッククライアント
 * @returns 発行順の `[sql, params]`
 */
export function issuedStatements(
  client: MockedTransactionClient,
): Array<[string, unknown[] | undefined]> {
  return (
    client.query.mock.calls as Array<[string, unknown[] | undefined]>
  ).filter(([sql]) => !["BEGIN", "COMMIT", "ROLLBACK"].includes(sql));
}

/**
 * クライアントが発行した SQL のうち、トランザクション制御文だけを順に取り出す。
 * @param client - モッククライアント
 * @returns 発行順の制御文
 */
export function transactionControls(client: MockedTransactionClient): string[] {
  return (client.query.mock.calls as Array<[string]>)
    .map(([sql]) => sql)
    .filter((sql) => ["BEGIN", "COMMIT", "ROLLBACK"].includes(sql));
}
