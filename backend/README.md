# Kando Backend

Kando のバックエンド API（Express + TypeScript + PostgreSQL）です。

## 役割

- ユーザー登録・ログイン・ JWT 発行（`/api/auth`）
- ボード階層（rows -> columns -> tasks -> subtasks/checklists/comments）の取得
- 行・カラム・タスク・サブタスク・チェックリスト・コメントの CRUD
- タスク編集内容の一括保存（`PUT /api/tasks/:id/snapshot`）
- マイグレーションによるスキーマ更新と初期データ投入

## 必要環境

- Node.js 20+
- npm 10+
- PostgreSQL

## セットアップ

```bash
npm install
```

## 環境変数

| 変数名         | 必須     | 説明                                                                          | 既定値                 |
| -------------- | -------- | ----------------------------------------------------------------------------- | ---------------------- |
| `DATABASE_URL` | はい     | PostgreSQL 接続文字列                                                         | なし                   |
| `PORT`         | いいえ   | API 待ち受けポート                                                            | `3001`                 |
| `NODE_ENV`     | いいえ   | 実行環境 (`production` で挙動変更)                                            | `development`          |
| `CORS_ORIGIN`  | 条件付き | CORS 許可オリジン（`NODE_ENV=production` では必須、カンマ区切りで複数指定可） | `*`（production 以外） |

`.env` 例:

```bash
DATABASE_URL=postgres://kando_user:kando_password@localhost:5432/kanban_db
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

| ファイル                            | 内容                               |
| ----------------------------------- | ---------------------------------- |
| `20260101000000_initial_schema.sql` | テーブル・インデックス・制約の作成 |
| `20260101000001_seed_data.sql`      | 初期データ投入・レガシーデータ移行 |

### レガシー DB からの移行

旧 `migrate.ts`（単一スクリプト方式）で構築済みの DB は、起動時に自動検出されます。
`users` テーブルが存在し `pgmigrations` に記録がない場合、既存マイグレーションを fake モードで履歴登録のみ行い、スキーマ変更は実行しません。

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

- 仕様のソース: `packages/types/src/openapi/`
- リクエストボディは既存の Zod スキーマと同期（単一の真実の源）
- 認証方式: HttpOnly Cookie（`token`）を優先、`Authorization: Bearer <JWT>` にフォールバック

Docker Compose 起動時:

- http://localhost:8080/api/openapi.json
- http://localhost:8080/api/docs

### ヘルスチェック

| メソッド | パス            | 説明                         |
| -------- | --------------- | ---------------------------- |
| `GET`    | `/api/health`   | DB 接続を含むヘルスチェック  |
| `GET`    | `/api/liveness` | アプリが応答可能かを確認する |

### 認証

| メソッド | パス                 | 説明                                                 |
| -------- | -------------------- | ---------------------------------------------------- |
| `GET`    | `/api/auth/status`   | ユーザー登録済みかどうかを返す（認証不要）           |
| `POST`   | `/api/auth/register` | 新規ユーザー登録・JWT 発行（パスワード 12 文字以上） |
| `POST`   | `/api/auth/login`    | ログイン・JWT 発行                                   |

補足:

- `/api/auth/*` には認証レートリミットが適用される（15 分間に 10 リクエスト）
- 発行された JWT は HttpOnly Cookie（`token`）に保存される。API クライアント向けには `Authorization: Bearer <token>` ヘッダーも利用可能（有効期限 7 日）
- 認証不要エンドポイント: `/api/health`、`/api/liveness`、`/api/auth/*`、`/api/openapi.json`、`/api/docs`

### ボード取得

| メソッド | パス         | 説明                   |
| -------- | ------------ | ---------------------- |
| `GET`    | `/api/board` | 行単位で階層構造を返却 |

クエリパラメータ（任意）:

- `row_id`: 正の整数
- `limit`: `1` 〜 `100`
- `offset`: `0` 以上の整数

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

| メソッド | パス                      | 説明                         |
| -------- | ------------------------- | ---------------------------- |
| `POST`   | `/api/tasks`              | タスク作成                   |
| `PUT`    | `/api/tasks/:id`          | タスク本文・期限更新         |
| `PUT`    | `/api/tasks/:id/snapshot` | タスク詳細を一括保存         |
| `PUT`    | `/api/tasks/:id/move`     | 所属カラム・並び順更新       |
| `DELETE` | `/api/tasks/:id`          | タスク削除（配下は CASCADE） |

補足:

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

## タスクスナップショット保存 API

`PUT /api/tasks/:id/snapshot` は、編集モーダル全体を 1 回で保存するための API です。
タスク本体、サブタスク、チェックリスト、コメントを単一トランザクションで同期します。

リクエスト例:

```json
{
  "content": "タスク本文",
  "due_date": "2026-12-01",
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

| コマンド                   | 説明                                      |
| -------------------------- | ----------------------------------------- |
| `npm run migrate:dev`      | マイグレーションを TypeScript で実行      |
| `npm run migrate`          | ビルド済みマイグレーションを実行          |
| `npm run migrate:create`   | 新しい SQL マイグレーションファイルを作成 |
| `npm run migrate:down`     | 直前のマイグレーションをロールバック      |
| `npm run dev`              | 開発サーバー起動（`tsx watch server.ts`） |
| `npm run build`            | TypeScript ビルド (`dist/` 生成)          |
| `npm run start`            | 本番サーバー起動 (`dist/server.js`)       |
| `npm run lint`             | ESLint 実行                               |
| `npm run lint:fix`         | ESLint 自動修正                           |
| `npm run format`           | Prettier 整形                             |
| `npm run typecheck`        | TypeScript 型チェック                     |
| `npm run test`             | テスト実行                                |
| `npm run test:integration` | 統合テスト実行                            |
| `npm run test:coverage`    | カバレッジ付きテスト実行                  |
| `npm run test:watch`       | Vitest watch                              |

## テスト

```bash
npm run test
```

統合テストのみ:

```bash
npm run test:integration
```

カバレッジ付きテスト:

```bash
npm run test:coverage
```

## ディレクトリ構成

```text
backend/
├── middleware/   # エラーハンドリング / 認証 / ロギング / バリデーション
├── migrations/   # バージョン管理された SQL マイグレーション
├── repositories/ # DB アクセス層
├── routes/       # API ルーティング
├── services/     # ビジネスロジック
├── tests/        # Vitest テスト
├── db.ts         # DB 接続と接続待機
├── migrate.ts    # マイグレーション実行エントリーポイント
├── server.ts     # Express エントリーポイント
└── types.ts      # 型定義
```
