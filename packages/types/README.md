# @kando/types

Kando のバックエンド・フロントエンド共有型パッケージです。

## 役割

- ドメイン型（`Row`, `Task`, `Memo` 等）の単一の定義源
- リクエストバリデーション用 Zod スキーマ（`@kando/types/validation`）
- OpenAPI 3.1 仕様の生成元（`@kando/types/openapi`）

バックエンドの `validateBody` と OpenAPI ドキュメントは、いずれもこのパッケージのスキーマを参照します。

## エクスポート

| サブパス | 内容 | 主な利用者 |
| -------- | ---- | ---------- |
| `@kando/types` | ドメイン型 + validation の再エクスポート | frontend, backend |
| `@kando/types/validation` | Zod スキーマ（`createTaskBodySchema` 等） | backend（`middleware/validate`） |
| `@kando/types/openapi` | OpenAPI ドキュメント生成関数 | backend（`scripts/generate-openapi.ts`） |

## ディレクトリ構成

```text
packages/types/
└── src/
    ├── index.ts          # ドメイン型定義
    ├── validation/       # Zod スキーマ（fields, schemas, format）
    └── openapi/          # OpenAPI パス・コンポーネント定義
```

## ビルド

```bash
npm --workspace @kando/types run build
```

`backend` の `dev` / `build` / `test` は実行前にこのビルドを自動で行います。

## OpenAPI 仕様の更新手順

1. `src/validation/` または `src/openapi/` のスキーマ・パス定義を変更
2. `npm --workspace @kando/types run test` でスナップショットテストを確認
3. `npm --workspace backend run openapi:generate` で `backend/openapi/openapi.json` を再生成
4. `GET /api/openapi.json` および Swagger UI に反映される

## テスト

```bash
npm --workspace @kando/types run test
npm --workspace @kando/types run test:coverage
```

## 関連ドキュメント

- [backend/README.md](../../backend/README.md) — API エンドポイント一覧・OpenAPI 配信
- [README.md](../../README.md) — プロジェクト全体
