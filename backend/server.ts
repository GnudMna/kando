// Expressアプリケーションのエントリーポイント
// 各種ミドルウェアのセットアップ、ルーティング登録、サーバー起動を担う
import express from "express";
import cors from "cors";
import helmet from "helmet";
import { pool, waitForDbWithRetry } from "./db.js";
import { errorHandler } from "./middleware/errorHandler.js";
import { requestLogger } from "./middleware/requestLogger.js";
import boardRouter from "./routes/board.js";
import rowsRouter from "./routes/rows.js";
import columnsRouter from "./routes/columns.js";
import tasksRouter from "./routes/tasks.js";
import subtasksRouter from "./routes/subtasks.js";
import checklistItemsRouter from "./routes/checklistItems.js";
import taskCommentsRouter from "./routes/taskComments.js";

const app = express();

// 本番環境では CORS_ORIGIN の明示的な指定を必須にする
if (process.env.NODE_ENV === "production" && !process.env.CORS_ORIGIN) {
  console.error(
    "FATAL: CORS_ORIGIN environment variable must be set in production",
  );
  process.exit(1);
}

// セキュリティヘッダーを付与する
app.use(helmet());
// CORS設定: 許可オリジンは環境変数 CORS_ORIGIN で制御する
app.use(
  cors({
    origin: process.env.CORS_ORIGIN ?? "*",
    methods: ["GET", "POST", "PUT", "DELETE"],
  }),
);
// リクエストボディをJSONとして解析する（100kB上限でDoSを防ぐ）
app.use(express.json({ limit: "100kb" }));
// リクエストのメソッド・パス・ステータス・レスポンス時間をログ出力する
app.use(requestLogger);

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

// 各リソースのAPIルートを登録する
app.use("/api/board", boardRouter);
app.use("/api/rows", rowsRouter);
app.use("/api/columns", columnsRouter);
app.use("/api/tasks", tasksRouter);
app.use("/api/subtasks", subtasksRouter);
app.use("/api/checklist-items", checklistItemsRouter);
app.use("/api/task-comments", taskCommentsRouter);

// グローバルエラーハンドラーを登録する（最後に配置する必要がある）
app.use(errorHandler);

const PORT = process.env.PORT ?? 3001;

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
