import { readFileSync } from "node:fs";
import { dirname, join, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { Router } from "express";
import { asyncHandler } from "../middleware/asyncHandler.js";

const router = Router();

const currentDir = dirname(fileURLToPath(import.meta.url));
/** ソース実行時は `routes/`、本番は `dist/routes/` から backend ルートへ戻る。 */
const backendRoot = currentDir.endsWith(`${sep}dist${sep}routes`)
  ? join(currentDir, "..", "..")
  : join(currentDir, "..");
const specPath = join(backendRoot, "openapi", "openapi.json");

/** ビルド時に生成した OpenAPI 仕様(初回読み込み後キャッシュ)。 */
let cachedSpec: Record<string, unknown> | null = null;

/**
 * ビルド済み OpenAPI JSON を読み込む。
 * @returns パース済み OpenAPI ドキュメント
 */
function loadOpenApiSpec(): Record<string, unknown> {
  if (cachedSpec) {
    return cachedSpec;
  }
  const raw = readFileSync(specPath, "utf-8");
  cachedSpec = JSON.parse(raw) as Record<string, unknown>;
  return cachedSpec;
}

/**
 * GET /api/openapi.json
 * OpenAPI 3.1 仕様を JSON で返す。
 */
router.get(
  "/openapi.json",
  asyncHandler((_req, res) => {
    res.json(loadOpenApiSpec());
  }),
);

/**
 * GET /api/docs
 * Swagger UI で API 仕様を閲覧する HTML ページを返す。
 */
router.get("/docs", (_req, res) => {
  res.type("html").send(`<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Kando API Docs</title>
  <link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@5/swagger-ui.css" />
</head>
<body>
  <div id="swagger-ui"></div>
  <script src="https://unpkg.com/swagger-ui-dist@5/swagger-ui-bundle.js" crossorigin></script>
  <script>
    SwaggerUIBundle({
      url: "/api/openapi.json",
      dom_id: "#swagger-ui",
      deepLinking: true,
      presets: [SwaggerUIBundle.presets.apis],
      layout: "BaseLayout",
    });
  </script>
</body>
</html>`);
});

/** OpenAPI 仕様配信ルーター。 */
export default router;
