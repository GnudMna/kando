/**
 * Zod スキーマに OpenAPI メタデータを付与するための初期化。
 * OpenAPI モジュール内で一度だけ呼び出す。
 */
import { extendZodWithOpenApi } from "@asteasolutions/zod-to-openapi";
import { z } from "zod";

extendZodWithOpenApi(z);

export { z };
