# Changelog

このプロジェクトの重要な変更はすべてこのファイルに記録します。

形式は [Keep a Changelog](https://keepachangelog.com/ja/1.1.0/) に準拠し、[セマンティックバージョニング](https://semver.org/lang/ja/) に従います。

## [Unreleased]

### Changed

- Compose 起動を `NODE_ENV=production` にし、開発用 `AUTH_SECRET` では起動しないようにした
- ルートの lint / typecheck と品質チェックスクリプトに `@kando/types` を含めた
- ユーザー登録を初回セットアップ時だけに制限し、ログイン画面から新規登録へ切り替えられないようにした
- ログアウトでトークン世代を進め、発行済み JWT を期限前に無効化するようにした
- 所有者のない行の割り当てを、初回ユーザー登録のトランザクション内だけに限定した
- タスクの一括保存は改訂番号が一致するときだけ成功し、古い内容は 409 で拒否するようにした
- タスクとカラムの並び順は、対象行をロックしてから採番し、衝突時は 1000 刻みに振り直すようにした

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

[Unreleased]: https://github.com/GnudMna/kando/compare/v0.4.1...HEAD
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
