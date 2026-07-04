// Expressアプリケーションのエントリーポイント
// 各種ミドルウェアのセットアップ、ルーティング登録、サーバー起動を担う
import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import helmet from "helmet";
import { rateLimit } from "express-rate-limit";
import { pool, waitForDbWithRetry } from "./db.js";
import { errorHandler } from "./middleware/errorHandler.js";
import { requestLogger } from "./middleware/requestLogger.js";
import { authenticate } from "./middleware/authenticate.js";
import authRouter from "./routes/auth.js";
import boardRouter from "./routes/board.js";
import rowsRouter from "./routes/rows.js";
import columnsRouter from "./routes/columns.js";
import tasksRouter from "./routes/tasks.js";
import subtasksRouter from "./routes/subtasks.js";
import checklistItemsRouter from "./routes/checklistItems.js";
import taskCommentsRouter from "./routes/taskComments.js";
import memosRouter from "./routes/memos.js";
import openapiRouter from "./routes/openapi.js";

const app = express();
const isProduction = process.env.NODE_ENV === "production";

// 必須の環境変数を検証する
if (!process.env.DATABASE_URL) {
  console.error("FATAL: DATABASE_URL environment variable must be set");
  process.exit(1);
}

if (isProduction && !process.env.CORS_ORIGIN) {
  console.error(
    "FATAL: CORS_ORIGIN environment variable must be set in production",
  );
  process.exit(1);
}

// AUTH_SECRET は本番環境で必須
if (isProduction && !process.env.AUTH_SECRET) {
  console.error(
    "FATAL: AUTH_SECRET environment variable must be set in production",
  );
  process.exit(1);
}

const rawPort = process.env.PORT ?? "3001";
const parsedPort = Number(rawPort);
if (!Number.isInteger(parsedPort) || parsedPort < 1 || parsedPort > 65535) {
  console.error(
    `FATAL: PORT must be an integer between 1 and 65535, got: ${rawPort}`,
  );
  process.exit(1);
}

app.disable("x-powered-by");

// リバースプロキシ（nginx等）からの X-Forwarded-For を信頼する
app.set("trust proxy", 1);

// セキュリティヘッダーを付与する（Swagger UI 用に unpkg を許可）
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'", "https://unpkg.com"],
        styleSrc: ["'self'", "'unsafe-inline'", "https://unpkg.com"],
        imgSrc: ["'self'", "data:", "https:"],
        connectSrc: ["'self'"],
        fontSrc: ["'self'", "https://unpkg.com"],
      },
    },
  }),
);

const allowedOrigins = process.env.CORS_ORIGIN
  ? process.env.CORS_ORIGIN.split(",")
      .map((origin) => origin.trim())
      .filter(Boolean)
  : [];

// 各オリジンが正当な URL 形式かを起動時に検証する
for (const origin of allowedOrigins) {
  try {
    const parsed = new URL(origin);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      console.error(
        `FATAL: CORS_ORIGIN contains an invalid origin (only http/https allowed): ${origin}`,
      );
      process.exit(1);
    }
  } catch {
    console.error(`FATAL: CORS_ORIGIN contains a malformed origin: ${origin}`);
    process.exit(1);
  }
}

// CORS設定: 許可オリジンを明示的に制御する
app.use(
  cors({
    origin: isProduction
      ? allowedOrigins.length > 0
        ? allowedOrigins
        : false
      : (process.env.CORS_ORIGIN ?? "http://localhost:5173"),
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    optionsSuccessStatus: 204,
    credentials: true,
  }),
);

// リクエストボディをJSONとして解析する（100kB上限でDoSを防ぐ）
app.use(express.json({ limit: "100kb" }));
// Cookie を解析する（HttpOnly JWT Cookie の読み取りに使用）
app.use(cookieParser());
// リクエストのメソッド・パス・ステータス・レスポンス時間をログ出力する
app.use(requestLogger);

// レートリミット: 1 IP あたり 15 分間に 300 リクエストまで
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 300,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: { error: "Too many requests, please try again later" },
});
app.use("/api", limiter);

// 認証エンドポイント専用のレートリミット: ブルートフォース攻撃対策として 15 分間に 10 リクエストまで
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: { error: "Too many requests, please try again later" },
});
if (process.env.E2E_TEST !== "true") {
  app.use("/api/auth/login", authLimiter);
  app.use("/api/auth/register", authLimiter);
  app.use("/api/auth/status", authLimiter);
}

// OpenAPI 仕様（認証不要）
app.use("/api", openapiRouter);

// ライブネスチェックエンドポイント（コンテナが応答可能かを確認）
app.get("/api/liveness", (_req, res) => {
  res.json({ status: "alive" });
});

// ヘルスチェックエンドポイント（ロードバランサー・コンテナオーケストレーター向け）
app.get(
  "/api/health",
  /**
   * API の稼働状態と DB 疎通を確認する。
   * @param _req - Express リクエスト（使用しない）
   * @param res - ヘルスチェック結果を返すレスポンス
   * @returns 応答完了時に解決される Promise
   */
  async (_req, res) => {
    try {
      await pool.query("SELECT 1");
      res.json({ status: "ok" });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`Health check failed: ${message}`);
      res.status(503).json({ status: "error" });
    }
  },
);

// 認証ルート（認証ミドルウェアの適用外）
app.use("/api/auth", authRouter);

// 認証ミドルウェアを適用する（全 API ルートで JWT 検証が必要）
app.use("/api", authenticate);

// 各リソースのAPIルートを登録する
app.use("/api/board", boardRouter);
app.use("/api/rows", rowsRouter);
app.use("/api/columns", columnsRouter);
app.use("/api/tasks", tasksRouter);
app.use("/api/subtasks", subtasksRouter);
app.use("/api/checklist-items", checklistItemsRouter);
app.use("/api/task-comments", taskCommentsRouter);
app.use("/api/memos", memosRouter);

// グローバルエラーハンドラーを登録する（最後に配置する必要がある）
app.use(errorHandler);

const PORT = parsedPort;

// Graceful shutdown 設定（ms）
const SHUTDOWN_TIMEOUT_MS = parseInt(
  (process.env.SHUTDOWN_TIMEOUT_MS as string) ?? "30000",
  10,
);

import type { Server } from "http";
import type { Socket } from "net";

let server: Server | undefined;
const connections = new Set<Socket>();
let isShuttingDown = false;
let forceShutdownTimer: NodeJS.Timeout | undefined;

/**
 * DB 接続確認後に HTTP サーバーを起動する。
 * シグナルを監視して graceful shutdown を行う。
 * @returns 起動処理完了時に解決される Promise
 */
async function startServer(): Promise<void> {
  try {
    // DB 接続可能になるまで待機し、待ち受け開始前の起動失敗を避ける
    await waitForDbWithRetry();

    server = app.listen(PORT, () => {
      console.log(`Backend listening on port ${PORT}`);
    });

    // 接続を追跡して強制終了時に破棄できるようにする
    server.on("connection", (socket: Socket) => {
      connections.add(socket);
      socket.on("close", () => connections.delete(socket));
    });

    // シグナルハンドラ
    const handleSignal = (signal: NodeJS.Signals) => {
      if (isShuttingDown) {
        console.log(`Already shutting down (signal: ${signal})`);
        return;
      }
      isShuttingDown = true;
      console.log(`Received ${signal} - starting graceful shutdown`);

      // 新しい接続受け付けを止める
      if (server) {
        server.close(async (err?: Error) => {
          if (err) {
            console.error("Error closing HTTP server:", err);
            process.exit(1);
          }

          // DB プールを閉じる
          try {
            await pool.end();
            console.log("DB pool closed");
            if (forceShutdownTimer) clearTimeout(forceShutdownTimer);
            process.exit(0);
          } catch (e) {
            console.error("Error closing DB pool:", e);
            process.exit(1);
          }
        });
      } else {
        // サーバが存在しない場合は DB を閉じて終了
        pool
          .end()
          .then(() => {
            console.log("DB pool closed");
            process.exit(0);
          })
          .catch((e) => {
            console.error("Error closing DB pool:", e);
            process.exit(1);
          });
      }

      // 強制シャットダウンタイマ
      forceShutdownTimer = setTimeout(async () => {
        console.error("Graceful shutdown timed out - forcing close");
        for (const sock of connections) {
          try {
            sock.destroy();
          } catch (e) {
            console.error("Error destroying socket:", e);
          }
        }
        try {
          await pool.end();
        } catch (e) {
          console.error("Error closing DB pool during forced shutdown:", e);
        }
        process.exit(1);
      }, SHUTDOWN_TIMEOUT_MS);
    };

    process.on("SIGINT", () => handleSignal("SIGINT"));
    process.on("SIGTERM", () => handleSignal("SIGTERM"));

    // 予期せぬ例外はログ出力して shutdown を開始する
    process.on("uncaughtException", (err) => {
      console.error("Uncaught exception:", err);
      handleSignal("SIGTERM");
    });
    // uncaughtException と異なり rejection はログのみ（進行中リクエストを優先してプロセスを継続する）
    process.on("unhandledRejection", (reason) => {
      console.error("Unhandled rejection:", reason);
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`FATAL: Unable to connect database: ${message}`);
    process.exit(1);
  }
}

void startServer();
