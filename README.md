<div align="center">
  <img src="frontend/public/favicon.svg" width="128" height="128" alt="Kando Logo">
  <h1 align="center">Kando</h1>
  <p>シンプルで高機能なかんばんボードアプリ
  </p>

[![React](https://img.shields.io/badge/React-19-61DAFB?logo=react)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-6.0-3178C6?logo=typescript)](https://www.typescriptlang.org/)
[![Vite](https://img.shields.io/badge/Vite-8.0-646CFF?logo=vite)](https://vite.dev/)
[![Node.js](https://img.shields.io/badge/Node.js-Express-339933?logo=node.js)](https://nodejs.org/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-18-4169E1?logo=postgresql)](https://www.postgresql.org/)
[![Docker](https://img.shields.io/badge/Docker-Compose-2496ED?logo=docker)](https://www.docker.com/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow?logo=opensourceinitiative)](LICENSE)

</div>

---

## ✨ 機能

- 🗂️ **かんばんビュー** — 行・カラム・タスクを自由に作成・編集・削除
- 📋 **リストビュー** — タスクを一覧で確認
- 🖱️ **ドラッグ＆ドロップ** — タスクをカラム間で直感的に並び替え
- 📝 **サブタスク** — タスクに子タスクを追加して細分化
- ✅ **チェックリスト** — タスク・サブタスクにチェックリスト項目を追加
- 🔤 **インライン編集** — 行・カラム名をその場で編集

---

## 🛠️ 技術スタック

| 領域 | 技術 |
|------|------|
| **フロントエンド** | React 19, TypeScript, Vite, @hello-pangea/dnd, lucide-react |
| **バックエンド** | Node.js, Express, TypeScript |
| **データベース** | PostgreSQL 18 |
| **インフラ** | Docker, Docker Compose, Nginx, Supervisor |
| **テスト** | Vitest, Testing Library |
| **Lint/Format** | ESLint, TypeScript-ESLint |

---

## 🚀 起動方法

### Docker Compose（推奨）

```bash
docker compose up --build
```

起動後、ブラウザで [http://localhost:8080](http://localhost:8080) を開く。

| サービス | URL |
|----------|-----|
| フロントエンド | http://localhost:8080 |
| バックエンド API | http://localhost:3001 |

### ローカル開発

事前に PostgreSQL が起動していること、および `DATABASE_URL` 環境変数が設定されていることを確認してください。

```bash
# Linux / macOS
./scripts/linux/dev.sh

# Windows
scripts\windows\dev.bat
```

| サービス | URL |
|----------|-----|
| フロントエンド (Vite) | http://localhost:5173 |
| バックエンド API | http://localhost:3001 |

---

## 🧰 開発用スクリプト

| スクリプト | 説明 |
|---|---|
| `./scripts/linux/dev.sh` / `scripts\\windows\\dev.bat` | frontend + backend を同時起動 |
| `./scripts/linux/test.sh` / `scripts\\windows\\test.bat` | backend/frontend の `lint` → `typecheck` → `test` を順番に実行 |
| `./scripts/linux/format.sh` / `scripts\\windows\\format.bat` | backend/frontend の `eslint --fix` を実行 |

補足: `format` は Prettier ではなく ESLint の自動修正です。

---

## 🧪 テスト

```bash
# Linux / macOS
./scripts/linux/test.sh
```
```powershell
# Windows
scripts\windows\test.bat
```

バックエンドの統合テストのみ実行する場合:

```bash
npm --prefix backend run test:integration
```

---

## 📘 サブプロジェクト README

- frontend: [frontend/README.md](frontend/README.md)

---

## 🗂️ プロジェクト構成

```
kando/
├── backend/          # Express API サーバー
│   ├── routes/       # エンドポイント定義
│   ├── middleware/   # 認証・バリデーション・ロガー
│   └── server.ts
├── frontend/         # React フロントエンド
│   └── src/
│       ├── api/          # API クライアント
│       ├── components/   # UI コンポーネント
│       ├── hooks/        # カスタムフック
│       └── types/        # 型定義
├── scripts/          # 開発用スクリプト
├── compose.yaml      # Docker Compose 設定
└── Dockerfile        # マルチステージビルド
```

---

## 📄 ライセンス

[MIT](LICENSE) © 2026 GnudMna
