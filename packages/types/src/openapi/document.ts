/**
 * Zod スキーマから OpenAPI 3.1 ドキュメントを生成する。
 */
import {
  OpenAPIRegistry,
  OpenApiGeneratorV31,
} from "@asteasolutions/zod-to-openapi";
import { registerPaths } from "./paths.js";

const API_VERSION = "0.3.1";

/**
 * Kando API の OpenAPI 3.1 ドキュメントを生成する。
 * @returns OpenAPI 3.1 ドキュメントオブジェクト
 */
export function generateOpenApiDocument(): ReturnType<
  OpenApiGeneratorV31["generateDocument"]
> {
  const registry = new OpenAPIRegistry();
  registerPaths(registry);

  const generator = new OpenApiGeneratorV31(registry.definitions);
  return generator.generateDocument({
    openapi: "3.1.0",
    info: {
      title: "Kando API",
      version: API_VERSION,
      description:
        "Kando かんばんボードアプリの REST API。\n\n" +
        "認証は HttpOnly Cookie（`token`）を優先し、未設定時は `Authorization: Bearer <JWT>` ヘッダーにフォールバックする。",
      license: {
        name: "MIT",
        url: "https://opensource.org/licenses/MIT",
      },
    },
    servers: [
      {
        url: "http://localhost:8080",
        description: "Docker Compose（nginx 経由）",
      },
      {
        url: "http://localhost:3001",
        description: "ローカル開発（バックエンド直接）",
      },
    ],
    tags: [
      { name: "System", description: "ヘルスチェック" },
      { name: "Auth", description: "認証" },
      { name: "Board", description: "ボード取得" },
      { name: "Rows", description: "行（プロジェクト）" },
      { name: "Columns", description: "カラム（ステータス列）" },
      { name: "Tasks", description: "タスク" },
      { name: "Subtasks", description: "サブタスク" },
      { name: "TaskComments", description: "タスクコメント" },
      { name: "ChecklistItems", description: "チェックリスト項目" },
      { name: "Memos", description: "メモ" },
    ],
  });
}
