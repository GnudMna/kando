# Kando Frontend

Kando のフロントエンド（React + TypeScript + Vite）です。

## 役割

- かんばんビュー / リストビューの表示
- 行・カラム・タスクの作成、編集、削除
- タスク詳細（サブタスク、チェックリスト、コメント、期限）の編集 UI
- バックエンド API との通信と UI 状態同期

## 主な画面機能

- かんばん表示とリスト表示の切り替え
- カラム・タスクのドラッグ&ドロップ並び替え
- タスク横断検索（本文、サブタスク、チェックリスト、コメント）
- 期限切れ / 期限間近の視覚強調
- 期限間近しきい値（日数）のユーザー設定
- ライト / ダークテーマ切り替え

## 必要環境

- Node.js 20+
- npm 10+

## セットアップ

```bash
npm install
```

## 開発起動

```bash
npm run dev -- --host
```

デフォルト URL: http://localhost:5173

## 本番ビルド

```bash
npm run build
npm run preview
```

## 環境変数

| 変数名         | 説明                        | 既定値                      |
| -------------- | --------------------------- | --------------------------- |
| `VITE_API_URL` | バックエンド API ベース URL | `http://localhost:3001/api` |

`.env.local` 例:

```bash
VITE_API_URL=http://localhost:3001/api
```

## ローカル保存される設定

- `kando-theme`: テーマ（`light` / `dark`）
- `kando-due-soon-days`: 期限間近と判定する日数（`0`〜`30`）

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
    ├── api/          # API クライアント
    ├── components/   # 画面コンポーネント
    ├── hooks/        # 状態管理フック
    ├── test/         # ユニットテスト
    ├── types/        # 型定義
    └── utils/        # 日付/検索などの純粋関数
```
