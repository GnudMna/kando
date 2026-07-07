# Kando Frontend

Kando のフロントエンド（React + TypeScript + Vite）です。

## 役割

- かんばんビュー / リストビューの表示
- 行・カラム・タスクの作成、編集、削除、コピー
- タスク詳細（サブタスク、チェックリスト、コメント、期限、完了状態）の編集 UI
- メモ帳パネル（メモの CRUD、タスクとのリンク）
- バックエンド API との通信と UI 状態同期（TanStack Query）

## 主な画面機能

- ログイン / ユーザー登録画面（JWT 認証、HttpOnly Cookie）。初回起動時は登録画面が表示される
- かんばん表示とリスト表示の切り替え
- カラム・タスクのドラッグ&ドロップ並び替え
- ボードの段階的読み込み（20 行ずつ取得、`detail=summary`）
- タスク詳細の遅延読み込み（カード表示時に `GET /api/tasks/:id`）
- タスク横断検索（本文、サブタスク、チェックリスト、コメント）
- 期限切れ / 期限間近の視覚強調（完了済みタスクは強調しない）
- 期限間近しきい値（日数）のユーザー設定
- タスクの完了/未完了切り替え
- タスクのコピー（サブタスク・チェックリスト・コメントを含む）
- メモ帳パネル（自動保存、タスクとの相互リンク）
- ライト / ダークテーマ切り替え

## 必要環境

- Node.js 20+
- npm 11+
- バックエンド API（`:3001`）— ルートの `./scripts/linux/dev.sh` で同時起動可能

## セットアップ

```bash
npm install
```

## 開発起動

バックエンドが `:3001` で起動している前提です。ルートから `./scripts/linux/dev.sh`（または `npm run dev`）を使うと backend / frontend をまとめて起動できます。

```bash
npm run dev -- --host
```

デフォルト URL: http://localhost:5173

### API 通信（Vite プロキシ）

開発時、`/api/*` へのリクエストは Vite が `http://localhost:3001` へプロキシします（`vite.config.ts` の `server.proxy`）。`VITE_API_URL=/api`（既定）のままで動作するため、フロントエンド単体起動時もバックエンドが `:3001` で待ち受けていれば API 通信できます。

## 本番ビルド

```bash
npm run build
npm run preview
```

## 環境変数

Vite は **`frontend/.env`** を読み込みます（`.env.local` も利用可）。ルートの `.env.example` からコピーする場合:

```bash
grep '^VITE_' ../.env > .env
```

| 変数名         | 説明                        | 既定値 |
| -------------- | --------------------------- | ------ |
| `VITE_API_URL` | バックエンド API ベース URL | `/api` |

`frontend/.env` 例:

```bash
VITE_API_URL=/api
```

## ローカル保存される設定

認証トークンは HttpOnly Cookie で管理し、JavaScript からは操作しません。

| キー                  | 内容                                |
| --------------------- | ----------------------------------- |
| `kando-theme`         | テーマ（`light` / `dark`）          |
| `kando-due-soon-days` | 期限間近と判定する日数（`0`〜`30`） |

## npm scripts

| コマンド                | 説明                             |
| ----------------------- | -------------------------------- |
| `npm run dev`           | 開発サーバー起動                 |
| `npm run build`         | 本番ビルド                       |
| `npm run preview`       | ビルド成果物確認                 |
| `npm run lint`          | ESLint 実行                      |
| `npm run lint:fix`      | ESLint 自動修正                  |
| `npm run format`        | Prettier 整形                    |
| `npm run typecheck`     | TypeScript 型チェック (`tsc -b`) |
| `npm run test`          | Vitest 実行                      |
| `npm run test:coverage` | カバレッジ付きテスト実行         |
| `npm run test:watch`    | Vitest watch                     |

## テスト方針（抜粋）

- UI テストは可能な限り `getByRole` + アクセシブル名を使用
- アイコンボタンには `aria-label` を付与して操作対象を明確化
- 期限表示・検索ロジックは `utils` のユニットテストで検証

## ディレクトリ構成

```text
frontend/
└── src/
    ├── api/          # API クライアント（ドメイン別モジュール + バレルエクスポート）
    │   ├── client.ts       # 共有 fetch クライアント（Cookie 認証）
    │   ├── index.ts        # 公開 API のバレルエクスポート
    │   ├── boardApi.ts     # 後方互換用（新規コードは @/api を使用）
    │   ├── auth.ts, board.ts, rows.ts, columns.ts, tasks.ts, ...
    │   └── memos.ts
    ├── components/   # 画面コンポーネント（LoginScreen, MemoPanel 等）
    ├── hooks/        # 状態管理フック
    │   ├── useAuth.ts
    │   ├── useBoard/       # ボード操作（行・列・タスク・検索を分割）
    │   ├── useMemos.ts
    │   └── useTaskEditForm.ts
    ├── providers/    # React Context / TanStack Query プロバイダ
    ├── test/         # ユニットテスト
    ├── types/        # 型定義
    └── utils/        # 日付/検索などの純粋関数
```

## 関連ドキュメント

- [README.md](../README.md) — プロジェクト全体
- [backend/README.md](../backend/README.md) — API エンドポイント
- [packages/types/README.md](../packages/types/README.md) — 共有型定義
