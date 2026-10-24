# Kando Backend

Kando のバックエンド API（Express + TypeScript + PostgreSQL）です。

API のリクエスト/レスポンス型とバリデーションスキーマは [`@kando/types`](../packages/types/README.md) で定義されています。

## 役割

- ユーザー登録・ログイン・ JWT 発行（`/api/auth`）
- ボード階層（rows -> columns -> tasks -> subtasks/checklists/comments）の取得
- 行・カラム・タスク・サブタスク・チェックリスト・コメントの CRUD
- タスクのコピー（`POST /api/tasks/:id/copy`）
- メモの CRUD とタスクとのリンク（`/api/memos`）
- タスク編集内容の一括保存（`PUT /api/tasks/:id/snapshot`）
- Zod によるリクエストバリデーション（`@kando/types/validation`、ボディ + クエリ）
- マイグレーションによるスキーマ更新と初期データ投入

## アーキテクチャ

HTTP ルートは **routes → services → repositories** の 3 層構成です。ルートハンドラは薄く保ち、ビジネスロジックは `services/`、SQL は `repositories/` に集約します。

| 層              | 役割                                           | 例                                         |
| --------------- | ---------------------------------------------- | ------------------------------------------ |
| `routes/`       | HTTP 入出力、ミドルウェア適用                  | `board.ts`, `tasks.ts`                     |
| `services/`     | 所有権チェック、階層組み立て、トランザクション | `boardService.ts`, `tasksService.ts`       |
| `repositories/` | SQL 実行、行の取得・更新                       | `boardRepository.ts`, `tasksRepository.ts` |

横断的な処理:

- **`asyncHandler`**: 非同期ルートの例外を `errorHandler` へ委譲
- **`validateBody` / `validateQuery`**: Zod スキーマによる入力検証（スキーマは `@kando/types/validation`）
- **`authenticate`**: JWT 検証と `req.userId` の設定

## 必要環境

- Node.js 20+
- npm 11+
- PostgreSQL（Dev Container / Docker Compose 利用時はホストへのインストール不要）

## セットアップ

```bash
npm install
```

## 環境変数

| 変数名                | 必須     | 説明                                                                                      | 既定値                                     |
| --------------------- | -------- | ----------------------------------------------------------------------------------------- | ------------------------------------------ |
| `DATABASE_URL`        | はい     | PostgreSQL 接続文字列                                                                     | なし                                       |
| `AUTH_SECRET`         | 条件付き | JWT 署名シークレット（`NODE_ENV=production` では必須。開発用プレースホルダは拒否）        | なし                                       |
| `COOKIE_SECURE`       | いいえ   | 認証 Cookie の Secure 属性。`true` / `false`。未指定時は production だけ true             | production で true                         |
| `TRUST_PROXY`         | いいえ   | 信頼するリバースプロキシの段数（0 以上の整数）。nginx の前段にプロキシを足したら増やす    | `1`                                        |
| `PORT`                | いいえ   | API 待ち受けポート                                                                        | `3001`                                     |
| `NODE_ENV`            | いいえ   | 実行環境 (`production` で挙動変更)                                                        | `development`                              |
| `CORS_ORIGIN`         | 条件付き | CORS 許可オリジン（`NODE_ENV=production` では必須、カンマ区切りで複数指定可）             | `http://localhost:5173`（production 以外） |
| `SHUTDOWN_TIMEOUT_MS` | いいえ   | Graceful shutdown で接続の終了を待つ上限（ミリ秒）                                        | `30000`                                    |
| `E2E_TEST`            | いいえ   | `true` で認証レートリミットを無効化する（E2E 専用。`scripts/linux/e2e-server.sh` が設定） | なし                                       |

`.env` 例（ルートの `.env.example` を参照）:

```bash
DATABASE_URL=postgres://kando_user:kando_password@localhost:5432/kanban_db
AUTH_SECRET=dev-only-secret-change-in-production
PORT=3001
NODE_ENV=development
CORS_ORIGIN=http://localhost:5173
```

## 起動方法

### 開発

```bash
npm run migrate:dev
npm run dev
```

### 本番

```bash
npm run build
npm run migrate
npm run start
```

Docker イメージ（`backend/Dockerfile`）は root ではなく `node` ユーザーで実行します。アプリは実行時にファイルを書き込みません。

## マイグレーション

[node-pg-migrate](https://salsita.github.io/node-pg-migrate/) によるバージョン管理マイグレーションを使用しています。
マイグレーションファイルは `migrations/` ディレクトリに SQL 形式で配置されます。

```bash
# TypeScript を直接実行（開発時）
npm run migrate:dev

# ビルド済み dist/migrate.js を実行（本番）
npm run migrate

# 新しいマイグレーションファイルを作成
npm run migrate:create -- <migration_name>

# 直前のマイグレーションをロールバック（開発時）
npm run migrate:down
```

### マイグレーション履歴

| ファイル                                | 内容                                                          |
| --------------------------------------- | ------------------------------------------------------------- |
| `20260101000000_initial_schema.sql`     | テーブル・インデックス・制約の作成                            |
| `20260101000001_seed_data.sql`          | 初期データ投入・レガシーデータ移行                            |
| `20260924140000_user_token_version.sql` | `users.token_version` を追加（ログアウトで JWT を失効させる） |
| `20260924150000_task_revision.sql`      | `tasks.revision` を追加（スナップショット保存の競合検出）     |

### レガシー DB からの移行

旧 `migrate.ts`（単一スクリプト方式）で構築済みの DB は、起動時に自動検出されます。
`users` テーブルが存在し `pgmigrations` に記録がない場合、既存マイグレーションを fake モードで履歴登録のみ行い、スキーマ変更は実行しません。
その後 `repairLegacyData()` により、コメント・チェックリストの `position` 修復と XOR 制約の検証を行います。

### 新規マイグレーションの追加手順

1. `npm run migrate:create -- add_new_feature` で SQL ファイルを生成
2. `-- Up Migration` / `-- Down Migration` セクションに SQL を記述
3. `npm run migrate:dev` で適用を確認

## API エンドポイント

### OpenAPI 仕様（機械可読ドキュメント）

Zod バリデーションスキーマ（`@kando/types/validation`）からビルド時に生成した OpenAPI 3.1 仕様を配信しています。

| 形式 | URL                     | 説明                                |
| ---- | ----------------------- | ----------------------------------- |
| JSON | `GET /api/openapi.json` | OpenAPI 3.1 仕様（機械可読）        |
| HTML | `GET /api/docs`         | Swagger UI による対話的ドキュメント |

- 仕様のソース: [`packages/types/src/openapi/`](../packages/types/src/openapi/)（生成手順は [packages/types/README.md](../packages/types/README.md) 参照）
- リクエストボディ・クエリパラメータは Zod スキーマと同期（単一の真実の源）
- 認証方式: HttpOnly Cookie（`token`）を優先、`Authorization: Bearer <JWT>` にフォールバック

Docker Compose 起動時:

- http://localhost:8080/api/openapi.json
- http://localhost:8080/api/docs

### 共通仕様

- JSON ボディの上限は 100kb。`/api/memos` だけはメモ本文（最大 50,000 文字）を収めるため 512kb
- 不正な JSON は 400、ボディの上限超過は 413 を返す
- パス・ボディ・クエリの ID は PostgreSQL の `INTEGER` 上限（2147483647）以下でなければ 400 になる
- タスクとカラムの並び順は対象行をロックしてから採番する。希望位置が衝突するか間隔が潰れたときは並び全体を 1000 刻みに振り直し、`POST /api/tasks`・`PUT /api/tasks/:id/move`・`PUT /api/columns/:id/move` のレスポンスに `rebalanced: [{ id, position }]` を含める。振り直しがなければ `rebalanced` は含まれない

### ヘルスチェック

| メソッド | パス            | 説明                         |
| -------- | --------------- | ---------------------------- |
| `GET`    | `/api/health`   | DB 接続を含むヘルスチェック  |
| `GET`    | `/api/liveness` | アプリが応答可能かを確認する |

### 認証

| メソッド | パス                 | 説明                                                                                           |
| -------- | -------------------- | ---------------------------------------------------------------------------------------------- |
| `GET`    | `/api/auth/status`   | ユーザー登録済みかどうかを返す（認証不要）                                                     |
| `POST`   | `/api/auth/register` | 初回ユーザー登録・JWT 発行（パスワード 12 文字以上・UTF-8 で 72 バイト以下。登録済みなら 403） |
| `POST`   | `/api/auth/login`    | ログイン・JWT 発行                                                                             |
| `POST`   | `/api/auth/logout`   | ログアウト（トークン世代を進め、Cookie を削除）                                                |

補足:

- `/api/auth/login` と `/api/auth/register` には認証レートリミットが適用される（IP ごとに、失敗したリクエストが 15 分間に 10 回まで。成功したリクエストは数えない）。`/api/auth/status` は対象外
- 全 API には IP ごとに 15 分間 3000 リクエストの共通レートリミットが適用される
- 前段に TLS 用プロキシを置く場合は `TRUST_PROXY=2` にする。段数が足りないと全ユーザーがプロキシの IP 1 つにまとまり、1 人の失敗で全員がロックアウトされる
- 発行された JWT は HttpOnly Cookie（`token`）に保存される。API クライアント向けには `Authorization: Bearer <token>` ヘッダーも利用可能（有効期限 7 日）
- 初回起動時は `GET /api/auth/status` が `{ "hasUsers": false }` を返し、フロントエンドは登録画面を表示する。ユーザーが既にいる場合、登録は 403 になる
- JWT にはトークン世代が入り、ログアウトで世代を進める。世代が合わないトークンは 401 になる
- パスワードの上限を文字数ではなくバイト数で検証するのは、bcrypt が先頭 72 バイトしか使わず、それ以降を黙って切り捨てるため
- 認証不要エンドポイント: `/api/health`、`/api/liveness`、`/api/auth/*`、`/api/openapi.json`、`/api/docs`

### ボード取得

| メソッド | パス         | 説明                   |
| -------- | ------------ | ---------------------- |
| `GET`    | `/api/board` | 行単位で階層構造を返却 |

クエリパラメータ（任意、`boardQuerySchema` で検証）:

- `row_id`: 正の整数
- `limit`: `1` 〜 `100`（フロントエンドは 20 行ずつページング）
- `offset`: `0` 以上の整数
- `detail`: `summary`（既定）または `full`
  - `summary`: 子要素は件数のみ返し、表示時に `GET /api/tasks/:id` で遅延読み込み
  - `full`: サブタスク・チェックリスト・コメントをすべて含めて返却
- `q`: 検索文字列（最大 200 文字）。タスク本文・サブタスク・チェックリスト・コメントを横断検索し、一致タスクのみを返却

### rows

| メソッド | パス                             | 説明                     |
| -------- | -------------------------------- | ------------------------ |
| `POST`   | `/api/rows`                      | 行を作成                 |
| `POST`   | `/api/rows/with-default-columns` | 行 + デフォルト3列を作成 |
| `PUT`    | `/api/rows/:id`                  | 行タイトル更新           |
| `DELETE` | `/api/rows/:id`                  | 行削除（配下は CASCADE） |

### columns

| メソッド | パス                    | 説明                               |
| -------- | ----------------------- | ---------------------------------- |
| `POST`   | `/api/columns`          | カラム作成                         |
| `PUT`    | `/api/columns/:id`      | カラムタイトル更新                 |
| `PUT`    | `/api/columns/:id/move` | カラム並び順更新                   |
| `DELETE` | `/api/columns/:id`      | カラム削除（配下タスクは CASCADE） |

### tasks

| メソッド | パス                      | 説明                                 |
| -------- | ------------------------- | ------------------------------------ |
| `GET`    | `/api/tasks/:id`          | タスク詳細を取得                     |
| `POST`   | `/api/tasks`              | タスク作成                           |
| `PUT`    | `/api/tasks/:id`          | タスク本文・期限・完了状態を部分更新 |
| `PUT`    | `/api/tasks/:id/snapshot` | タスク詳細を一括保存                 |
| `PUT`    | `/api/tasks/:id/move`     | 所属カラム・並び順更新               |
| `POST`   | `/api/tasks/:id/copy`     | タスクを複製（配下データ含む）       |
| `DELETE` | `/api/tasks/:id`          | タスク削除（配下は CASCADE）         |

補足:

- `PUT /api/tasks/:id` のボディは `content` / `due_date` / `completed` のいずれか 1 つ以上を指定
- `due_date` は `YYYY-MM-DD` 形式（`null` で解除可）

### subtasks

| メソッド | パス                | 説明                                           |
| -------- | ------------------- | ---------------------------------------------- |
| `POST`   | `/api/subtasks`     | サブタスク作成                                 |
| `PUT`    | `/api/subtasks/:id` | サブタスク本文更新                             |
| `DELETE` | `/api/subtasks/:id` | サブタスク削除（配下チェックリストは CASCADE） |

### checklist-items

| メソッド | パス                       | 説明                           |
| -------- | -------------------------- | ------------------------------ |
| `POST`   | `/api/checklist-items`     | チェックリスト項目作成         |
| `PUT`    | `/api/checklist-items/:id` | 項目本文・完了状態・並び順更新 |
| `DELETE` | `/api/checklist-items/:id` | 項目削除                       |

補足:

- `task_id` と `subtask_id` は **どちらか一方のみ** 指定可能

### task-comments

| メソッド | パス                     | 説明                     |
| -------- | ------------------------ | ------------------------ |
| `POST`   | `/api/task-comments`     | コメント作成             |
| `PUT`    | `/api/task-comments/:id` | コメント本文・並び順更新 |
| `DELETE` | `/api/task-comments/:id` | コメント削除             |

### memos

| メソッド | パス                           | 説明                           |
| -------- | ------------------------------ | ------------------------------ |
| `GET`    | `/api/memos`                   | メモ一覧（紐付くタスクを含む） |
| `POST`   | `/api/memos`                   | メモ作成                       |
| `PUT`    | `/api/memos/:id`               | メモタイトル・本文更新         |
| `DELETE` | `/api/memos/:id`               | メモ削除                       |
| `POST`   | `/api/memos/:id/tasks`         | タスクをメモにリンク           |
| `DELETE` | `/api/memos/:id/tasks/:taskId` | タスクとメモのリンク解除       |

## タスクスナップショット保存 API

`PUT /api/tasks/:id/snapshot` は、編集モーダル全体を 1 回で保存するための API です。
タスク本体、サブタスク、チェックリスト、コメントを単一トランザクションで同期します。

フロントエンドは `detail=summary` で取得したタスクを編集する際、保存前に `GET /api/tasks/:id` で詳細を読み込みます。詳細未取得のまま保存すると、チェックリスト等が意図せず削除されるため、クライアント側でも読み込み完了を待ってからリクエストします。

`revision` には取得時のタスクの値を入れます。サーバーの現在値と一致したときだけ保存し、`revision` を 1 進めます。一致しなければ別の更新が先に入っているため 409 を返します。`PUT /api/tasks/:id` など他の更新でも `revision` は進むので、クライアントは更新レスポンスの `revision` をキャッシュへ反映する必要があります。

`id` を持つ子要素は更新、`id` のない子要素は新規作成、リクエストに含まれない既存の子要素は削除されます。並び順は配列の順になります。そのタスクに属さない `id` を指定すると 400 を返します。

リクエスト例:

```json
{
  "revision": 3,
  "content": "タスク本文",
  "due_date": "2026-12-01",
  "completed": false,
  "checklists": [{ "id": 21, "content": "項目", "completed": false }],
  "subtasks": [
    {
      "id": 11,
      "content": "サブタスク",
      "checklists": [{ "content": "新規サブ項目", "completed": false }]
    }
  ],
  "comments": [{ "content": "新しいコメント" }]
}
```

## npm scripts

| コマンド                   | 説明                                                 |
| -------------------------- | ---------------------------------------------------- |
| `npm run migrate:dev`      | マイグレーションを TypeScript で実行                 |
| `npm run migrate`          | ビルド済みマイグレーションを実行                     |
| `npm run migrate:create`   | 新しい SQL マイグレーションファイルを作成            |
| `npm run migrate:down`     | 直前のマイグレーションをロールバック                 |
| `npm run dev`              | 開発サーバー起動（`tsx watch server.ts`）            |
| `npm run build`            | TypeScript ビルド + OpenAPI JSON 生成 (`dist/` 生成) |
| `npm run openapi:generate` | `backend/openapi/openapi.json` を再生成              |
| `npm run start`            | 本番サーバー起動 (`dist/server.js`)                  |
| `npm run lint`             | ESLint 実行                                          |
| `npm run lint:fix`         | ESLint 自動修正                                      |
| `npm run format`           | Prettier 整形                                        |
| `npm run typecheck`        | TypeScript 型チェック                                |
| `npm run test`             | テスト実行                                           |
| `npm run test:router`      | ルーターテスト実行（DB モック）                      |
| `npm run test:coverage`    | カバレッジ付きテスト実行                             |
| `npm run test:watch`       | Vitest watch                                         |

## テスト

```bash
npm run test
```

ルーターテストのみ（DB はモック。HTTP ルーターとミドルウェアの結合を検証）:

```bash
npm run test:router
```

カバレッジ付きテスト:

```bash
npm run test:coverage
```

## ディレクトリ構成

```text
backend/
├── middleware/   # asyncHandler, authenticate, validateBody/validateQuery, errorHandler, requestLogger
├── migrations/   # バージョン管理された SQL マイグレーション
├── openapi/      # ビルド時生成の OpenAPI JSON（`openapi:generate`）
├── repositories/ # DB アクセス層
│   ├── boardRepository.ts
│   ├── rowsRepository.ts, columnsRepository.ts, tasksRepository.ts
│   ├── memosRepository.ts, subtasksRepository.ts
│   ├── checklistItemsRepository.ts, taskCommentsRepository.ts
│   └── ownershipRepository.ts
├── routes/       # HTTP ルーティング（薄いハンドラ）
├── scripts/      # OpenAPI 生成スクリプト等
├── services/     # ビジネスロジック
│   ├── boardService.ts
│   ├── rowsService.ts, columnsService.ts, tasksService.ts
│   ├── memosService.ts, subtasksService.ts
│   └── checklistItemsService.ts, taskCommentsService.ts
├── tests/        # Vitest テスト（services / middleware / router）
├── utils/        # groupMap 等の汎用ヘルパー
├── authToken.ts      # JWT の署名・検証（トークン世代を含む）
├── db.ts             # DB 接続と接続待機
├── errors.ts         # HTTP ステータス付きエラー
├── migrate.ts        # マイグレーション実行エントリーポイント
├── positionSlot.ts   # 並び順の採番と振り直し
├── productionEnv.ts  # 本番環境変数の検査、Cookie / プロキシ設定の解決
├── rateLimits.ts     # レートリミット設定
├── server.ts         # Express エントリーポイント
└── types.ts          # @kando/types の再エクスポート
```

## 関連ドキュメント

- [README.md](../README.md) — プロジェクト全体
- [packages/types/README.md](../packages/types/README.md) — 共有型・Zod・OpenAPI 生成
- [frontend/README.md](../frontend/README.md) — フロントエンド
