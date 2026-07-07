<div align="center">
  <img src="frontend/public/favicon.svg" width="128" height="128" alt="Kando Logo">
  <h1 align="center">Kando</h1>
  <p>行ベースで管理できる、実用志向のかんばんボードアプリ</p>

[![React](https://img.shields.io/badge/React-19-61DAFB?logo=react)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-6.0-3178C6?logo=typescript)](https://www.typescriptlang.org/)
[![Vite](https://img.shields.io/badge/Vite-8.0-646CFF?logo=vite)](https://vite.dev/)
[![Node.js](https://img.shields.io/badge/Node.js-Express-339933?logo=node.js)](https://nodejs.org/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-18-4169E1?logo=postgresql)](https://www.postgresql.org/)
[![Docker](https://img.shields.io/badge/Docker-Compose-2496ED?logo=docker)](https://www.docker.com/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow?logo=opensourceinitiative)](LICENSE)

</div>

---

## ✨ 現在の機能

- 🔐 **ユーザー認証**: 登録・ログイン・ログアウトに対応（JWT ベース、HttpOnly Cookie、有効期限 7 日、パスワード 12 文字以上）
- 🗂️ **行ベースのかんばん管理**: 行（プロジェクト）ごとに複数カラムを管理
- 🧱 **行作成時のデフォルト列生成**: 「未着手 / 進行中 / 完了」を自動作成
- 🔀 **ドラッグ&ドロップ並び替え**: カラム・タスクの順序変更と列間移動に対応
- 🧾 **リストビュー切り替え**: かんばん表示と一覧表示をワンクリックで切替
- 🔎 **横断検索**: タスク本文、サブタスク、チェックリスト、コメントを対象に検索
- 📅 **期限管理と強調表示**: 期限切れ・期限間近を自動判定（しきい値は 0〜30 日で調整可能）
- 🧰 **タスク編集モーダル**: タスク本文、期限、完了状態、サブタスク、チェックリスト、コメントを一括編集
- ✅ **完了ステータス**: タスクの完了/未完了を切り替え（完了時は期限強調を抑制）
- 💾 **スナップショット保存**: 編集モーダルの内容を単一 API でトランザクション保存（詳細データ読み込み完了後）
- 📋 **タスクのコピー**: サブタスク・チェックリスト・コメントを含めて複製
- 📝 **メモ帳**: メモの作成・編集・自動保存、タスクとの相互リンク
- ⚡ **段階的データ読み込み**: ボードは 20 行ずつ取得し、タスク詳細は表示時に遅延読み込み
- 🌓 **テーマ切り替え**: ダーク/ライトモードをローカル保存
- ⚠️ **操作エラー通知**: API 失敗時に共通バナーでユーザーへ通知

---

## 🏗️ アーキテクチャ

| レイヤー | 実装 |
|---|---|
| フロントエンド | React 19 + TypeScript + Vite + TanStack Query |
| バックエンド | Express + TypeScript（`routes → services → repositories` の 3 層構成） |
| 共有型 | `@kando/types`（型定義・Zod バリデーション・OpenAPI 生成） |
| DB | PostgreSQL 18 |
| 配信 | Nginx（SPA フォールバック対応） |
| プロセス管理 | 各コンテナで単一サービスを実行（frontend / backend / db） |

`compose.yaml` では `db`（PostgreSQL）、`backend`（Node.js API）、`frontend`（Nginx で静的Reactアプリ配信）を起動します。
`backend` コンテナ内では起動時に `npm run migrate`（`node-pg-migrate` によるバージョン管理マイグレーション）を実行したあと、API サーバーを開始します。

バックエンドの `validateBody` / `validateQuery`、フロントのログインフォーム、OpenAPI 仕様はいずれも `@kando/types/validation` の Zod スキーマを参照します。

---

## 🚀 クイックスタート（Docker Compose 推奨）

```bash
docker compose up --build
```

起動後:

- フロントエンド: http://localhost:8080
- バックエンド API: Docker ネットワーク内のみ（クライアントPCからは直接アクセスしない）
- ヘルスチェック: http://localhost:8080/api/health

### 初回セットアップ

1. ブラウザで http://localhost:8080 を開く
2. ユーザーが未登録の場合、**初回セットアップ画面**（ユーザー登録）が表示される
3. ユーザー名とパスワード（12 文字以上）を入力して登録する
4. 登録完了後、自動的にログインされボード画面へ遷移する

2回目以降はログイン画面から既存アカウントでサインインします。`GET /api/auth/status` が `{ "hasUsers": false }` を返す間は登録画面が表示されます。

### Compose 環境変数（任意）

| 変数名 | 既定値 | 用途 |
|---|---|---|
| `POSTGRES_USER` | `kando_user` | DB ユーザー |
| `POSTGRES_PASSWORD` | `kando_password` | DB パスワード |
| `POSTGRES_DB` | `kanban_db` | DB 名 |
| `AUTH_SECRET` | `dev-only-secret-change-in-production` | JWT 署名シークレット（**本番では必ず変更**） |

例:

```bash
POSTGRES_USER=my_user POSTGRES_PASSWORD=my_pass POSTGRES_DB=my_db AUTH_SECRET=$(openssl rand -hex 32) docker compose up --build
```

---

## 💻 ローカル開発

### 開発環境の選び方

| 方式 | 向いている用途 |
|---|---|
| Docker Compose | 本番に近い構成（Nginx 配信）で手早く動かす（上記クイックスタート参照） |
| Dev Container | VS Code / Cursor 上で DB 付き開発環境を再現（下記参照） |
| ネイティブ | ホストに Node.js + PostgreSQL を直接入れて開発 |

### Dev Container（VS Code / Cursor）

`.devcontainer/` を使うと、`app`（Node.js 24）と `db`（PostgreSQL 18）が起動する開発用コンテナ内で作業できます。

1. エディタで「**Dev Containers: Reopen in Container**」を実行
2. `postCreateCommand` により frontend / backend の依存関係がインストールされる
3. ターミナルで `./scripts/linux/dev.sh` または[手動起動](#手動起動)を実行

転送される主なポート:

| ポート | 用途 |
|---|---|
| `5173` | フロントエンド（Vite 開発サーバー） |
| `3001` | バックエンド API |
| `5432` | PostgreSQL |
| `8080` | Nginx（Compose 本番構成を別途起動した場合） |

Docker Compose との違い: frontend / backend / db の 3 サービス構成ではなく、**開発用 app コンテナ + db** の 2 サービスです。Nginx による静的配信は含まれません。

### 前提

- Node.js 20+（Dev Container 内は Node.js 24）
- npm 11+（`packageManager`: npm@11.9.0）
- PostgreSQL（Dev Container / Compose 利用時はホストへのインストール不要）

### 環境変数

ルートの `.env.example` をコピーして利用します。Vite は **`frontend/.env`** を読み込むため、`VITE_*` 変数はそこへ渡してください（`.env.local` も利用可）。

```bash
cp .env.example .env
# バックエンド用（bash / zsh）
set -a && source .env && set +a
# フロントエンド用（VITE_* のみ frontend/.env へ）
grep '^VITE_' .env > frontend/.env
```

| ファイル | 読み込み対象 | 用途 |
|---|---|---|
| ルート `.env` | Docker Compose、`dev.sh` 実行時のシェル | DB 接続・JWT シークレット等 |
| `frontend/.env` | Vite 開発サーバー | `VITE_API_URL` 等 |

最低限必要な変数:

```bash
export DATABASE_URL=postgres://kando_user:kando_password@localhost:5432/kanban_db
export AUTH_SECRET=your-secret-key  # 本番環境では必須
export CORS_ORIGIN=http://localhost:5173
```

Docker Compose 利用時はルート `.env` を置くだけで自動読み込みされます（上記「Compose 環境変数」参照）。

### API 通信（ローカル開発）

開発時、ブラウザからの `/api/*` リクエストは Vite 開発サーバー（`:5173`）のプロキシ経由でバックエンド（`:3001`）へ転送されます。

```text
Browser → http://localhost:5173/api/...
       → Vite proxy（frontend/vite.config.ts）
       → http://localhost:3001/api/...
```

そのため `VITE_API_URL=/api`（既定）のままで動作します。バックエンドを別ホストやポートで動かす場合のみ、`frontend/.env` で上書きしてください。

### ワンコマンド起動

```bash
# Linux / macOS
npm run dev
# または
./scripts/linux/dev.sh
```

```powershell
# Windows（npm run dev は Linux 用スクリプトのため dev:win を使用）
npm run dev:win
# または
scripts\windows\dev.bat
```

いずれも `migrate:dev` 実行後、backend（`:3001`）と frontend（`:5173`）を同時起動します。

### 手動起動

```bash
npm install
npm --workspace backend run migrate:dev
```

別ターミナルで:

```bash
npm --workspace backend run dev
```

別ターミナルで:

```bash
npm --workspace frontend run dev -- --host
```

---

## 🧰 開発スクリプト

| スクリプト | 説明 |
|---|---|
| `npm run dev` | 開発サーバー起動（Linux / macOS） |
| `npm run dev:win` | 開発サーバー起動（Windows） |
| `npm run test` | 品質チェック（Linux / macOS） |
| `npm run test:win` | 品質チェック（Windows） |
| `npm run test:coverage` | ルートワークスペースのテストカバレッジを生成 |
| `npm run test:ci` | CI 向けに compliance/lint/typecheck/test/e2e を実行 |
| `npm run test:e2e` | Playwright による E2E テストを実行 |
| `npm run test:e2e:install` | Playwright の Chromium をインストール |
| `npm run check:compliance` | 依存関係のライセンス・監査チェック（Linux / macOS） |
| `npm run check:compliance:win` | 依存関係のライセンス・監査チェック（Windows） |
| `npm run lint` | backend/frontend の ESLint を実行 |
| `./scripts/linux/dev.sh` / `scripts\windows\dev.bat` | 開発起動スクリプト（`migrate:dev` 実行後に backend/frontend を起動） |
| `./scripts/linux/test.sh` / `scripts\windows\test.bat` | 品質チェックスクリプト（lint/typecheck/test） |
| `./scripts/linux/format.sh` / `scripts\windows\format.bat` | backend/frontend の `lint:fix` と `format` を実行 |
| `./scripts/linux/db-backup.sh` / `scripts\windows\db-backup.bat` | Compose 上の DB を論理バックアップ（`.sql`） |
| `./scripts/linux/db-restore.sh` / `scripts\windows\db-restore.bat` | `.sql` から DB 復元（`public` スキーマを再作成） |

---

## 🧪 テスト

全体チェック:

```bash
# Linux / macOS
npm run test
# または
./scripts/linux/test.sh
```

```powershell
# Windows
npm run test:win
# または
scripts\windows\test.bat
```

個別実行:

```bash
# 共有型パッケージ（Zod スキーマ・OpenAPI 生成元）
npm --workspace @kando/types run test
npm --workspace @kando/types run test:coverage

# backend（単体テスト: services / middleware 等）
npm --workspace backend run test
# backend（ルーターテスト: DB モックで HTTP 結合を検証）
npm --workspace backend run test:router
npm --workspace backend run test:coverage

# frontend
npm --workspace frontend run test
npm --workspace frontend run test:coverage
```

E2E テスト（Playwright）:

```bash
npm run test:e2e:install   # 初回のみ
npm run test:e2e
```

CI 用チェック:

```bash
npm run test:ci
```

---

## 🗄️ DB バックアップ / 復元

バックアップ:

```bash
# Linux / macOS
./scripts/linux/db-backup.sh
```

```powershell
# Windows
scripts\windows\db-backup.bat
```

復元（破壊的操作）:

```bash
# Linux / macOS
./scripts/linux/db-restore.sh backups/kanban_db-YYYYMMDD-HHMMSS.sql
```

```powershell
# Windows
scripts\windows\db-restore.bat backups\kanban_db-YYYYMMDD-HHMMSS.sql
```

補足:

- 復元時は既存 `public` スキーマを削除して再作成します。
- Linux 版は `--yes` を付与すると確認プロンプトを省略できます。

---

## 🔌 API 概要

エンドポイントの一覧・リクエスト/レスポンス形式・認証の詳細は **[backend/README.md](backend/README.md)** を参照してください。

| ドメイン | ベースパス | 概要 |
| -------- | ---------- | ---- |
| ヘルス | `/api/health`, `/api/liveness` | 死活監視 |
| 認証 | `/api/auth` | 登録・ログイン・ログアウト・初回判定 |
| ボード | `/api/board` | 行単位の階層取得（ページング・`detail` 対応） |
| 行 | `/api/rows` | 行 CRUD・デフォルト列付き作成 |
| カラム | `/api/columns` | カラム CRUD・並び替え |
| タスク | `/api/tasks` | タスク CRUD・スナップショット保存・コピー |
| サブタスク | `/api/subtasks` | サブタスク CRUD |
| チェックリスト | `/api/checklist-items` | チェックリスト項目 CRUD |
| コメント | `/api/task-comments` | コメント CRUD |
| メモ | `/api/memos` | メモ CRUD・タスクリンク |

**OpenAPI（機械可読）:** `GET /api/openapi.json` / Swagger UI `GET /api/docs`（Compose 起動時: http://localhost:8080/api/docs）

**横断的な仕様:**

- `/api/auth/*` 以外は JWT 認証必須（HttpOnly Cookie または `Authorization: Bearer <token>`）
- リクエストバリデーションは [`@kando/types`](packages/types/README.md) の Zod スキーマで統一（リクエストボディ + クエリパラメータ）
- ログイン/登録フォームも同一 Zod スキーマで送信前検証

---

## 📘 ドキュメント

| ドキュメント | 内容 |
| ------------ | ---- |
| [README.md](README.md)（本ファイル） | 概要・起動・テスト・プロジェクト構成 |
| [backend/README.md](backend/README.md) | API エンドポイント・環境変数・マイグレーション |
| [frontend/README.md](frontend/README.md) | 画面機能・フロントエンド構成・Vite 設定 |
| [packages/types/README.md](packages/types/README.md) | 共有型・Zod スキーマ・OpenAPI 生成 |
| [CHANGELOG.md](CHANGELOG.md) | 変更履歴 |

---

## 🗂️ プロジェクト構成

npm workspace で 3 パッケージを管理しています。

| パッケージ | パス | 役割 |
| ---------- | ---- | ---- |
| ルート | `.` | 開発スクリプト・E2E・Compose |
| `kando-backend` | `backend/` | Express API・DB マイグレーション |
| `kando-frontend` | `frontend/` | React SPA |
| `@kando/types` | `packages/types/` | 共有型・Zod・OpenAPI 生成元 |

```text
.
├── backend/              # Express API
│   ├── middleware/       # 認証・asyncHandler・validateBody/validateQuery・エラー処理
│   ├── migrations/       # node-pg-migrate 用 SQL
│   ├── repositories/     # DB アクセス層（board, rows, columns, tasks, memos 等）
│   ├── routes/           # HTTP ルーター（薄いハンドラ）
│   ├── scripts/          # OpenAPI JSON 生成など
│   ├── services/         # ビジネスロジック（board, rows, columns, tasks, memos 等）
│   ├── tests/
│   ├── migrate.ts
│   └── server.ts
├── frontend/             # React + Vite
│   ├── public/
│   └── src/
│       ├── api/          # ドメイン別 API クライアント
│       ├── components/   # ErrorBanner, LoginScreen, KanbanBoard 等
│       ├── hooks/        # useBoard/, useTaskEditForm 等
│       ├── providers/    # TanStack Query・OperationErrorProvider・ナビゲーション
│       ├── test/
│       ├── types/
│       └── utils/
├── packages/
│   └── types/            # @kando/types（共有型・Zod・OpenAPI）
│       └── src/
│           ├── openapi/
│           └── validation/   # schemas, fields, queryFields
├── .devcontainer/        # Dev Container（VS Code / Cursor）
├── e2e/                  # Playwright E2E テスト
├── scripts/              # dev / test / format / db-backup（linux・windows）
├── .env.example
├── compose.yaml
└── package.json          # workspace ルート
```

---

## 📄 ライセンス

[MIT](LICENSE) © 2026 GnudMna
