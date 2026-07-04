/**
 * ビルド時に OpenAPI 3.1 仕様を JSON ファイルへ書き出す。
 * 本番ランタイムでは zod-to-openapi を呼ばず、このファイルを配信する。
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { generateOpenApiDocument } from "@kando/types/openapi";

const __dirname = dirname(fileURLToPath(import.meta.url));
const outDir = join(__dirname, "../openapi");
const outPath = join(outDir, "openapi.json");

mkdirSync(outDir, { recursive: true });
writeFileSync(outPath, JSON.stringify(generateOpenApiDocument(), null, 2));
console.log(`OpenAPI spec written to ${outPath}`);
