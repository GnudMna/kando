# Kando Backend

Kando のバックエンド API（Express + TypeScript + PostgreSQL）です。

## 役割

- かんばんボード全体データの取得 (`/api/board`)
- 行・カラム・タスク・サブタスク・チェックリスト・コメントの CRUD
- アプリ起動時の DB 初期化（テーブル作成・既存スキーマ補完・初期データ投入）

## 必要環境

- Node.js 20+
- npm 10+
- PostgreSQL（Docker Compose 利用時は PostgreSQL 18）

## セットアップ

```bash
npm install
```

## 開発起動

```bash
npm run dev
```

デフォルト URL: http://localhost:3001

## 本番起動

```bash
npm run build
npm run start
```

## 環境変数

| 変数名 | 必須 | 説明 | 既定値 |
| --- | --- | --- | --- |
| `DATABASE_URL` | はい | PostgreSQL 接続文字列 | なし |
| `PORT` | いいえ | API サーバー待ち受けポート | `3001` |
| `NODE_ENV` | いいえ | 実行環境（`production` で挙動が変化） | `development` |
| `CORS_ORIGIN` | 条件付き | CORS 許可オリジン。`NODE_ENV=production` の場合は必須 | `*`（production 以外） |

`.env` 例:

```bash
DATABASE_URL=postgres://kando_user:kando_password@localhost:5432/kanban_db
PORT=3001
NODE_ENV=development
CORS_ORIGIN=http://localhost:5173
```

## API エンドポイント

ベースパスは `/api` です。

### ヘルスチェック

| メソッド | パス | 説明 |
| --- | --- | --- |
| `GET` | `/health` | DB 接続を含むヘルスチェック |

### ボード取得

| メソッド | パス | 説明 |
| --- | --- | --- |
| `GET` | `/board` | rows -> columns -> tasks -> subtasks/checklists/comments の階層で返却 |

### rows

| メソッド | パス | 説明 |
| --- | --- | --- |
| `POST` | `/rows` | 行を作成 |
| `POST` | `/rows/with-default-columns` | 行 + デフォルト3カラム（未着手/進行中/完了）を作成 |
| `PUT` | `/rows/:id` | 行タイトルを更新 |
| `DELETE` | `/rows/:id` | 行を削除（配下を CASCADE 削除） |

### columns

| メソッド | パス | 説明 |
| --- | --- | --- |
| `POST` | `/columns` | カラムを作成 |
| `PUT` | `/columns/:id` | カラムタイトルを更新 |
| `PUT` | `/columns/:id/move` | カラムの並び順（position）を更新 |
| `DELETE` | `/columns/:id` | カラムを削除（配下タスクを CASCADE 削除） |

### tasks

| メソッド | パス | 説明 |
| --- | --- | --- |
| `POST` | `/tasks` | タスクを作成 |
| `PUT` | `/tasks/:id` | タスク本文・期限を更新 |
| `PUT` | `/tasks/:id/move` | タスクの所属カラム・並び順を更新 |
| `DELETE` | `/tasks/:id` | タスクを削除（配下を CASCADE 削除） |

補足:

- `due_date` は `YYYY-MM-DD` 形式で受け付けます。

### subtasks

| メソッド | パス | 説明 |
| --- | --- | --- |
| `POST` | `/subtasks` | サブタスクを作成 |
| `PUT` | `/subtasks/:id` | サブタスク本文を更新 |
| `DELETE` | `/subtasks/:id` | サブタスクを削除（配下チェックリストを CASCADE 削除） |

### checklist-items

| メソッド | パス | 説明 |
| --- | --- | --- |
| `POST` | `/checklist-items` | チェックリスト項目を作成 |
| `PUT` | `/checklist-items/:id` | 項目本文・完了状態・並び順を更新 |
| `DELETE` | `/checklist-items/:id` | 項目を削除 |

補足:

- `task_id` と `subtask_id` はどちらか一方のみ指定可能です。

### task-comments

| メソッド | パス | 説明 |
| --- | --- | --- |
| `POST` | `/task-comments` | コメントを作成 |
| `PUT` | `/task-comments/:id` | コメント本文・並び順を更新 |
| `DELETE` | `/task-comments/:id` | コメントを削除 |

## npm scripts

| コマンド | 説明 |
| --- | --- |
| `npm run dev` | 開発サーバー起動（`tsx watch server.ts`） |
| `npm run build` | TypeScript をビルドして `dist/` を生成 |
| `npm run start` | `dist/server.js` を起動 |
| `npm run lint` | ESLint 実行 |
| `npm run lint:fix` | ESLint 自動修正 |
| `npm run format` | Prettier 整形 |
| `npm run typecheck` | TypeScript 型チェック |
| `npm run test` | バックエンドテスト一式を実行 |
| `npm run test:integration` | 統合テストのみ実行 |
| `npm run test:watch` | Vitest watch モード |

## テスト

```bash
npm run test
```

統合テストだけ実行する場合:

```bash
npm run test:integration
```

## ディレクトリ構成

```text
backend/
├── middleware/   # エラーハンドリング / ロギング / バリデーション
├── routes/       # API ルート定義
├── tests/        # Vitest テスト
├── db.ts         # DB 接続と初期化
├── server.ts     # Express エントリーポイント
└── types.ts      # DB/レスポンス型定義
```
