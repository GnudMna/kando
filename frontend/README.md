# Kando Frontend

Kando のフロントエンド（React + TypeScript + Vite）です。

## 役割

- かんばんビュー / リストビューの表示
- 行・カラム・タスクの作成、編集、削除、コピー
- タスク詳細（サブタスク、チェックリスト、コメント、期限、完了状態）の編集 UI
- メモ帳パネル（メモの CRUD、タスクとのリンク）
- バックエンド API との通信と UI 状態同期（TanStack Query）
- ログイン/登録フォームのクライアント側バリデーション（`@kando/types/validation` の Zod スキーマ）

## 主な画面機能

- ログイン / ユーザー登録画面（JWT 認証、HttpOnly Cookie、パスワード 12 文字以上・72 バイト以下）。初回起動時だけ登録画面が表示され、登録済みのログイン画面には新規登録の導線はない
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
  - 自動保存に失敗するとメモ名と理由を表示し、未保存のまま残して再送できる
  - 保存リクエストは直列化する。保存中にメモを切り替えても保存済みの状態は崩れない
  - 未保存の入力は `beforeunload` / `pagehide` で `keepalive` 付きで送信する（保存失敗の通知中に閉じるときはブラウザの離脱確認も出す）
- 新規タスクは下書きとしてモーダルを開き、「保存して閉じる」で作成とスナップショット保存を行う（保存に失敗したら作成したタスクを削除する）
- 関連メモの追加・解除は編集モーダル内の選択状態だけを更新し、保存時にサーバー上の状態との差分を反映する（紐付けの失敗はタスク保存済みのため通知のみ）
- ライト / ダークテーマ切り替え
- 操作エラー通知（`OperationErrorProvider` + 共通 `ErrorBanner`）
- タスク編集保存時の詳細読み込み待ち（サマリー状態のタスクでチェックリスト消失を防止）

## サーバーとのキャッシュ同期

楽観的更新のあと、サーバーが確定させた値を TanStack Query のキャッシュへ戻します。

- タスクの更新レスポンス（完了トグル等）は子要素を含まないため、既存タスクにマージして `revision` を取り込む。取り込まないと、次のスナップショット保存が 409 になる
- カード上のチェックリスト操作は個別 API で保存され、サーバーが親タスクの `revision` を進める。レスポンスは項目だけなので、反映後に `GET /api/tasks/:id` でタスクを取り直して `revision` だけを取り込む（タスク全体は置き換えず、連続操作の結果を巻き戻さない。`revision` は大きい方を採る）
- `TaskCard` のチェック切り替えなど連続しうる更新は、クリック時点のタスクから新しい状態を組み立てず、応答到着時点の最新タスクに差分だけを適用する（`patchTask(taskId, updater)`）。素早い連続操作で後着の応答が先行する更新を上書きしないため
- 遅延読み込みは詳細が必要な間（`needsLoad`）だけ `onLoaded` を呼ぶ。編集済みのタスクを、無効化されたクエリのキャッシュ（編集前の詳細）で上書きしないため
- メモ一覧のキャッシュは `useMemosQuery`（TanStack Query の `memos.list`）に一本化している。メモパネルでの削除は編集モーダルの選択肢にも反映される
- タスク作成・タスク移動・カラム移動のレスポンスに `rebalanced` があれば、該当アイテムの `position` だけを差し替える（表示順は変えない）

## エラー表示

| 種別             | 実装                                      | 表示箇所                   |
| ---------------- | ----------------------------------------- | -------------------------- |
| 認証エラー       | `useAuth` の `error`                      | ログイン/登録画面          |
| 操作エラー       | `OperationErrorProvider` の `reportError` | ヘッダー下の `ErrorBanner` |
| タスク編集エラー | `useTaskEditForm` の `saveError`          | 編集モーダル内             |
| レンダリング例外 | `ErrorBoundary`                           | フォールバック UI          |

ボード操作・タスク編集・遅延読み込み等の API 失敗は `reportError(message, err)` で共通バナーに集約します。`useOperationError` フックから `reportError` / `clearError` を利用します。

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

Docker では Nginx が静的ファイルを配信し、`frontend/nginx.conf` で `Content-Security-Policy` を付けます。スクリプトは同一オリジン（`'self'`）のみ、外部に許可しているのは Google Fonts の CSS / フォントだけです。`style-src` の `'unsafe-inline'` は `@hello-pangea/dnd` が `<style>` を動的に挿入するために必要です。外部のスクリプト・スタイル・フォントを追加するときは、この CSP も更新してください。なお `vite dev` / `vite preview` では CSP は付きません。

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
- ログイン画面の Zod バリデーション、`OperationErrorProvider`、タスク編集フォームの詳細読み込み待ちをテストで検証

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
    ├── components/   # 画面コンポーネント
    │   ├── ErrorBanner.tsx     # 共通操作エラーバナー
    │   ├── LoginScreen.tsx     # ログイン/登録（Zod 検証）
    │   ├── KanbanBoard.tsx, TaskEditModal.tsx, MemoPanel.tsx, ...
    │   ├── kanban/             # かんばん UI サブコンポーネント
    │   └── taskEdit/           # 編集モーダルのサブタスク・チェックリスト・メモリンク
    ├── hooks/        # 状態管理フック
    │   ├── useAuth.ts
    │   ├── useBoard/           # ボード操作（行・列・タスク・検索を分割）
    │   ├── useKanbanBoardState.tsx  # かんばん画面の状態（編集モーダルの開閉・下書きタスク等）
    │   ├── useMemos.ts         # メモ一覧クエリ・ミューテーション（メモのキャッシュはここに一本化）
    │   ├── useTaskEditForm.ts  # 編集モーダル（詳細読み込み + スナップショット保存）
    │   └── useLazyTaskDetails.ts
    ├── providers/    # React Context / TanStack Query プロバイダ
    │   ├── OperationErrorProvider.tsx  # 操作エラー Context
    │   ├── queryClient.ts
    │   └── AppNavigationProvider.tsx
    ├── test/         # ユニットテスト
    ├── types/        # 型定義
    └── utils/        # 日付/検索/operationError 等の純粋関数
```

## 関連ドキュメント

- [README.md](../README.md) — プロジェクト全体
- [backend/README.md](../backend/README.md) — API エンドポイント
- [packages/types/README.md](../packages/types/README.md) — 共有型定義
