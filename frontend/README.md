# Kando Frontend

Kando のフロントエンド（React + TypeScript + Vite）です。

## 役割

- かんばんビュー / リストビューの表示
- 行・列・タスク・サブタスク・チェックリストの操作 UI
- バックエンド API との通信

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

## 環境変数

| 変数名         | 説明                          | 既定値                      |
| -------------- | ----------------------------- | --------------------------- |
| `VITE_API_URL` | バックエンド API のベース URL | `http://localhost:3001/api` |

`.env.local` の例:

```bash
VITE_API_URL=http://localhost:3001/api
```

## npm scripts

| コマンド             | 説明                             |
| -------------------- | -------------------------------- |
| `npm run dev`        | 開発サーバー起動                 |
| `npm run build`      | 本番ビルド                       |
| `npm run preview`    | ビルド成果物のローカル確認       |
| `npm run lint`       | ESLint 実行                      |
| `npm run lint:fix`   | ESLint の自動修正                |
| `npm run typecheck`  | TypeScript 型チェック (`tsc -b`) |
| `npm run test`       | Vitest 実行                      |
| `npm run test:watch` | Vitest watch モード              |

## テスト方針（抜粋）

- UI テストは可能な限り `getByRole` + アクセシブル名で要素を取得する
- アイコンボタンには `aria-label` を付与し、操作対象を明確にする

## ディレクトリ構成

```
src/
├── api/          # API クライアント
├── components/   # 画面コンポーネント
├── hooks/        # 状態管理フック
├── test/         # ユニットテスト
└── types/        # 型定義
```
