# Changelog

このプロジェクトの重要な変更はすべてこのファイルに記録します。

形式は [Keep a Changelog](https://keepachangelog.com/ja/1.1.0/) に準拠し、[セマンティックバージョニング](https://semver.org/lang/ja/) に従います。

## [Unreleased]

### Security

- backend の Docker イメージを root ではなく `node` ユーザーで実行する
- パスワードの上限を UTF-8 で 72 バイトとし、bcrypt による末尾の切り捨てを防ぐ

### Fixed

- サーバーが並び順を振り直したとき、レスポンスの `rebalanced` でクライアントの `position` を更新する
- 認証レートリミットは login / register の失敗だけを数え、`/api/auth/status` を対象外にした。全 API の上限を 15 分あたり 300 回から 3000 回に引き上げた
- 信頼するプロキシの段数を `TRUST_PROXY` で設定できるようにした（既定 1）
- カードの完了トグル後に編集モーダルの保存が 409 になる問題を修正
- サブタスク・チェックリスト・コメントの個別 API（作成・更新・削除）でも親タスクの `revision` を進める。以前は進まず、別端末のカード上のチェック操作がモーダルからの保存で 409 にならず上書きされていた。カード上のチェックリスト操作後は、フロントがタスクを取り直して最新の `revision` を取り込む
- 不正な JSON は 400、巨大なボディは 413 で返す（以前は 500）
- `/api/memos` のボディ上限を 512kb に広げ、最大長のメモ本文を保存できるようにした
- `INTEGER` 上限を超える ID を 400 で拒否する（以前は 500）
- 新規タスクを「保存して閉じる」を押した時点で初めてサーバーに作成する。以前は「タスクを追加」で空のタスクを先に作成し、タブを閉じたり通信が途切れたりすると空のタスクが残っていた
- 編集モーダルのメモ一覧を React Query のキャッシュに一本化した。メモパネルで削除したメモが、最大 30 秒ピッカーに残っていた
- 編集モーダルでの関連メモの追加・解除は「保存して閉じる」で確定する。以前はその場でサーバーに反映され、保存せずに閉じても元に戻らなかった

### Performance

- 横断検索のクエリを `LEFT JOIN` + `DISTINCT` から `EXISTS` に書き換えた

### Docs

- README の現在バージョン、スクリプト一覧、マイグレーション履歴、E2E の前提、API の共通仕様を最新化した

## [0.5.0] - 2026-09-24
### Security

- Compose は `NODE_ENV=production` で起動し、開発用の `AUTH_SECRET`（`dev-only-secret-change-in-production`）では起動しない
- ユーザー登録は最初の 1 人だけに制限し、ログイン画面から新規登録へ移れない
- ログアウトでトークン世代を進め、発行済み JWT を期限前に無効化する
- 所有者のない行は、初回ユーザー登録のトランザクション内だけに割り当てる

### Fixed

- タスクの一括保存は `revision` が現在値と一致するときだけ成功し、古い内容は 409 で拒否する
- タスクとカラムの並び順は対象行をロックしてから採番し、間隔が潰れたときは 1000 刻みに振り直す

### Changed

- ルートの lint / typecheck と品質チェックスクリプト（`test.sh` / `test.bat`）に `@kando/types` を含めた

### Docs

- README に初回登録、トークン失効、スナップショットの改訂番号、品質チェックの範囲を反映した

## [0.4.1] - 2026-07-07

### Added

- バックエンドの `asyncHandler` ミドルウェア（非同期ルートハンドラのエラー委譲を共通化）
- `validateQuery` ミドルウェア（クエリパラメータの Zod 検証）
- 全ドメイン向け `services/` / `repositories/` 層（board, memos, subtasks, checklistItems, taskComments 等）
- `@kando/types/validation` のクエリ用フィールド（`queryFields.ts`）と `boardQuerySchema`
- パスワード最小長（12 文字）用の `passwordField` Zod ヘルパー
- フロントの `OperationErrorProvider` と共通 `ErrorBanner`（操作エラー表示の統一）

### Changed

- バックエンドのレイヤー分離を全ルートで `routes → services → repositories` に統一
- バリデーションルール（パスワード最小長、ボード取得クエリ等）を `@kando/types` の Zod スキーマへ集約
- 全 API ルートを `asyncHandler` 化し、手動 `try/catch` を削減
- ログイン/登録画面で送信前に Zod によるクライアント側バリデーションを実行
- ボード・タスク編集・遅延読み込み等の操作エラーをアプリ共通バナーで表示
- OpenAPI 仕様にボード取得クエリとパスワード制約を反映

### Fixed

- v0.4.0 へのアップグレード後、サマリー状態のタスクをスナップショット保存するとチェックリストが消える問題を修正
- レガシー DB 向け `repairLegacyData()` を fake ベースライン時にも実行するよう変更
- ボード取得時の `checklist_count` 集計を見直し

### Test

- `asyncHandler` / `validateQuery` のユニットテストを追加
- `OperationErrorProvider` とタスク編集フォーム（詳細読み込み待ち）のテストを追加

## [0.4.0] - 2026-07-05

### Added

- Zod スキーマから生成する OpenAPI 3.1 仕様と Swagger UI
- 環境変数テンプレート `.env.example`
- 依存関係チェック用スクリプト（ライセンス・監査）

### Changed

- リクエストバリデーションを Zod に統一
- DB マイグレーションを `node-pg-migrate` によるバージョン管理方式に移行
- 巨大コンポーネントと `useBoard` を責務ごとに分割

### Chore

- 依存関係の更新

### Test

- コアロジックのテストカバレッジを強化
- Playwright による E2E テストを追加

---

## [0.3.1] - 2026-06-12

### Changed

- 行・列の追加 UI をインライン方式に変更
- 一度に読み込む行数を 20 行に制限
- 動作の軽量化

### Chore

- 依存関係を更新
- コメントを追加

### Test

- テストパターンを追加

---

## [0.3.0] - 2026-05-19

### Added

- メモ帳機能

### Changed

- 全体的な改善
- 動作速度の改善

### Test

- テストパターンを追加

---

## [0.2.0] - 2026-05-19

### Added

- ユーザー認証機能（登録・ログイン・JWT）

### Changed

- ボードクエリ・データ読み込み速度を改善
- DB のコネクションプール設定を追加
- パフォーマンスの改善
- コード品質の改善
- エラー処理の統一
- マジックナンバーの定数化
- `sync` 関数内のクエリ回数を改善
- 重複コードや二重管理を共通化

### Security

- セキュリティの改善
- 親 ID をチェックし、FK 制約違反エラーがクライアントへ伝播しないように

### Fixed

- Docker 環境での `X-Forwarded-For` エラーを修正
- `position` のバリデーションに整数チェックが含まれていなかった問題を修正
- Docker ビルドができない問題を修正

### Chore

- スクリプト実行時のパッケージインストールをオプションに
- DevContainer でのフォーマッタのルートを明示

### Docs

- README を更新

### Style

- DocString を追記

---

## [0.1.0] - 2026-05-13

### Added

- タスクのコピー機能
- 各タスクに完了ステータスを設定する機能

### Changed

- コメント内のリンクをクリックで遷移できるように
- エラーハンドリングの改善
- パフォーマンスの改善
- Kicker と SubTitle を削除

### Security

- レートリミットの設定
- `CORS_ORIGIN` のバリデーション

### Fixed

- 開発時の API 通信ができない問題を修正
- Docker コンテナが作成できない問題を修正

### Refactor

- API 通信が Docker ネットワーク内でのみ実施されるように

### Chore

- UI にアイコンを付与
- 依存パッケージの更新

---

## [0.0.4] - 2026-04-19

### Added

- ルートに npm ワークスペース設定を追加
- Graceful shutdown

### Changed

- service / repository 層に分割
- 共有型定義パッケージ（`packages/types`）を作成
- フロントエンドとバックエンドで Docker イメージを分割

### Security

- 明示的なオリジン制御を導入
- `x-powered-by` ヘッダを無効化

### Fixed

- Docker ビルドに失敗する問題を修正

### Test

- テストパターンの追加
- テスト環境の向上

---

## [0.0.3] - 2026-04-18

### Changed

- DnD 処理を最適化
- DELETE API のレスポンスの一貫性を確保
- ボード取得 API のスケーラビリティを改善
- ランタイムのスキーマ変更を分離
- タスク編集保存時の原子性を確保
- 並び順採番の競合対策
- タスク名に改行を使用できるように

### Chore

- Docker 関連ファイルを更新
- コメントの拡充

### Docs

- README を更新

---

## [0.0.2] - 2026-04-18

### Added

- タスクの検索機能
- 期限設定機能
- コメント機能
- チェックリストの並べ替え
- ステータス列の並べ替え

### Changed

- UI を改善

### Chore

- Prettier によるコード整形
- 開発体験の向上
- アクセシビリティ改善とテスト耐性改善

### Docs

- README を更新

### Test

- テスト戦略の改善
- TypeScript / TSX をテスト対象に

---

## [0.0.1] - 2026-04-17

### Added

- ベースとなるフロントエンド（React + TypeScript + Vite）
- ベースとなるバックエンド（Express + TypeScript + PostgreSQL）
- 行ベースのかんばんボード管理
- 簡易ログモジュール
- Dev Container 用の設定
- 開発用スクリプト
- フロントエンドとバックエンドを同時起動する Docker 関連ファイル

### Changed

- タイトルを変更
- セキュリティの向上

### Fixed

- 再読込後にカードの順番がリセットする不具合
- 開発用の依存関係が不足していた問題
- 相対インポートに拡張子を追加

### Refactor

- 行作成が失敗しにくくなるように改善
- ローカル状態の一時不整合を改善
- ボード取得 API の軽量化
- 数値バリデーションの厳格化
- チェックリストのデータ不整合が崩れる可能性を排除
- 起動直後のヘルスチェック判定を厳格化
- 型安全性を確保
- アーキテクチャ・設計の改善
- パフォーマンスを改善

### Chore

- Docker 関連ファイルを更新
- アイコンを作成
- git 管理ファイルを追加

### Docs

- README を更新

### Test

- テストパターンを追加

[Unreleased]: https://github.com/GnudMna/kando/compare/v0.5.0...HEAD
[0.5.0]: https://github.com/GnudMna/kando/compare/v0.4.1...v0.5.0
[0.4.1]: https://github.com/GnudMna/kando/compare/v0.4.0...v0.4.1
[0.4.0]: https://github.com/GnudMna/kando/compare/v0.3.1...v0.4.0
[0.3.1]: https://github.com/GnudMna/kando/compare/v0.3.0...v0.3.1
[0.3.0]: https://github.com/GnudMna/kando/compare/v0.2.0...v0.3.0
[0.2.0]: https://github.com/GnudMna/kando/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/GnudMna/kando/compare/v0.0.4...v0.1.0
[0.0.4]: https://github.com/GnudMna/kando/compare/v0.0.3...v0.0.4
[0.0.3]: https://github.com/GnudMna/kando/compare/v0.0.2...v0.0.3
[0.0.2]: https://github.com/GnudMna/kando/compare/v0.0.1...v0.0.2
[0.0.1]: https://github.com/GnudMna/kando/releases/tag/v0.0.1
