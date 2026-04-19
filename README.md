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

- 🗂️ **行ベースのかんばん管理**: 行（プロジェクト）ごとに複数カラムを管理
- 🧱 **行作成時のデフォルト列生成**: 「未着手 / 進行中 / 完了」を自動作成
- 🔀 **ドラッグ&ドロップ並び替え**: カラム・タスクの順序変更と列間移動に対応
- 🧾 **リストビュー切り替え**: かんばん表示と一覧表示をワンクリックで切替
- 🔎 **横断検索**: タスク本文、サブタスク、チェックリスト、コメントを対象に検索
- 📅 **期限管理と強調表示**: 期限切れ・期限間近を自動判定（しきい値は 0〜30 日で調整可能）
- 🧰 **タスク編集モーダル**: タスク本文、期限、サブタスク、チェックリスト、コメントを一括編集
- 💾 **スナップショット保存**: 編集モーダルの内容を単一 API でトランザクション保存
- 🌓 **テーマ切り替え**: ダーク/ライトモードをローカル保存

---

## 🏗️ アーキテクチャ

| レイヤー | 実装 |
|---|---|
| フロントエンド | React 19 + TypeScript + Vite |
| バックエンド | Express + TypeScript |
| DB | PostgreSQL 18 |
| 配信 | Nginx（SPA フォールバック対応） |
| プロセス管理 | 各コンテナで単一サービスを実行（frontend / backend / db） |

`compose.yaml` では `db`（PostgreSQL）、`backend`（Node.js API）、`frontend`（Nginx で静的Reactアプリ配信）を起動します。
`backend` コンテナ内では起動時に `node dist/migrate.js` を実行したあと、API サーバーを開始します。

---

## 🚀 クイックスタート（Docker Compose 推奨）

```bash
docker compose up --build
```

起動後:

- フロントエンド: http://localhost:8080
- バックエンド API: http://localhost:3001
- ヘルスチェック: http://localhost:3001/api/health

### Compose 環境変数（任意）

| 変数名 | 既定値 | 用途 |
|---|---|---|
| `POSTGRES_USER` | `kando_user` | DB ユーザー |
| `POSTGRES_PASSWORD` | `kando_password` | DB パスワード |
| `POSTGRES_DB` | `kanban_db` | DB 名 |

例:

```bash
POSTGRES_USER=my_user POSTGRES_PASSWORD=my_pass POSTGRES_DB=my_db docker compose up --build
```

---

## 💻 ローカル開発

### 前提

- Node.js 20+
- npm 10+
- PostgreSQL

### 必須環境変数

```bash
export DATABASE_URL=postgres://kando_user:kando_password@localhost:5432/kanban_db
```

フロントエンドの API 参照先を変える場合（任意）:

```bash
export VITE_API_URL=http://localhost:3001/api
```

### ワンコマンド起動

```bash
# Linux / macOS
./scripts/linux/dev.sh
```

```powershell
# Windows
scripts\windows\dev.bat
```

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
| `npm run dev` | ルートワークスペースの開発サーバーを起動 |
| `npm run test` | ルートワークスペースの品質チェックを実行 |
| `npm run test:coverage` | ルートワークスペースのテストカバレッジを生成 |
| `npm run test:ci` | CI 向けに lint/typecheck/test:coverage を実行 |
| `npm run lint` | backend/frontend の ESLint を実行 |
| `./scripts/linux/dev.sh` / `scripts\windows\dev.bat` | 既存の開発起動スクリプト（依存関係確認・`migrate:dev` 実行後に backend/frontend を起動） |
| `./scripts/linux/test.sh` / `scripts\windows\test.bat` | 既存の品質チェックスクリプト（lint/typecheck/test） |
| `./scripts/linux/format.sh` / `scripts\windows\format.bat` | backend/frontend の `lint:fix` と `format` を実行 |
| `./scripts/linux/db-backup.sh` / `scripts\windows\db-backup.bat` | Compose 上の DB を論理バックアップ（`.sql`） |
| `./scripts/linux/db-restore.sh` / `scripts\windows\db-restore.bat` | `.sql` から DB 復元（`public` スキーマを再作成） |

---

## 🧪 テスト

全体チェック:

```bash
# Linux / macOS
./scripts/linux/test.sh
```

```powershell
# Windows
scripts\windows\test.bat
```

個別実行:

```bash
# backend
npm --workspace backend run test
npm --workspace backend run test:integration
npm --workspace backend run test:coverage

# frontend
npm --workspace frontend run test
npm --workspace frontend run test:coverage
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

主要ベースパス:

- `/api/health`
- `/api/board`
- `/api/rows`
- `/api/columns`
- `/api/tasks`
- `/api/subtasks`
- `/api/checklist-items`
- `/api/task-comments`

特記事項:

- `GET /api/board` は `row_id`, `limit`, `offset` クエリに対応
- `PUT /api/tasks/:id/snapshot` でタスク編集内容を一括保存

詳細は [backend/README.md](backend/README.md) を参照してください。

---

## 📘 サブプロジェクト README

- [backend/README.md](backend/README.md)
- [frontend/README.md](frontend/README.md)

---

## 🗂️ プロジェクト構成

```text
.
├── backend/              # Express API
│   ├── middleware/
│   ├── routes/
│   ├── tests/
│   ├── migrate.ts
│   └── server.ts
├── frontend/             # React + Vite
│   ├── public/
│   └── src/
│       ├── api/
│       ├── components/
│       ├── hooks/
│       ├── test/
│       └── utils/
├── package.json          # ルート npm workspace と開発スクリプト
├── package-lock.json     # ルート workspace lock
├── scripts/              # 開発・運用スクリプト（linux/windows）
└── compose.yaml          # Compose 定義
```

---

## 📄 ライセンス

[MIT](LICENSE) © 2026 GnudMna