// Expressアプリケーションのエントリーポイント
// 各種ミドルウェアのセットアップ、ルーティング登録、サーバー起動を担う
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { initDBWithRetry, pool } from './db.js';
import { errorHandler } from './middleware/errorHandler.js';
import { requestLogger } from './middleware/requestLogger.js';
import boardRouter from './routes/board.js';
import rowsRouter from './routes/rows.js';
import columnsRouter from './routes/columns.js';
import tasksRouter from './routes/tasks.js';
import subtasksRouter from './routes/subtasks.js';
import checklistItemsRouter from './routes/checklistItems.js';

const app = express();

// 本番環境では CORS_ORIGIN の明示的な指定を必須にする
if (process.env.NODE_ENV === 'production' && !process.env.CORS_ORIGIN) {
  console.error('FATAL: CORS_ORIGIN environment variable must be set in production');
  process.exit(1);
}

// セキュリティヘッダーを付与する
app.use(helmet());
// CORS設定: 許可オリジンは環境変数 CORS_ORIGIN で制御する
app.use(cors({
  origin: process.env.CORS_ORIGIN ?? '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
}));
// リクエストボディをJSONとして解析する（100kB上限でDoSを防ぐ）
app.use(express.json({ limit: '100kb' }));
// リクエストのメソッド・パス・ステータス・レスポンス時間をログ出力する
app.use(requestLogger);

// ヘルスチェックエンドポイント（ロードバランサー・コンテナオーケストレーター向け）
app.get('/api/health', async (_req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ status: 'ok' });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`Health check failed: ${message}`);
    res.status(503).json({ status: 'error' });
  }
});

// 各リソースのAPIルートを登録する
app.use('/api/board', boardRouter);
app.use('/api/rows', rowsRouter);
app.use('/api/columns', columnsRouter);
app.use('/api/tasks', tasksRouter);
app.use('/api/subtasks', subtasksRouter);
app.use('/api/checklist-items', checklistItemsRouter);

// グローバルエラーハンドラーを登録する（最後に配置する必要がある）
app.use(errorHandler);

const PORT = process.env.PORT ?? 3001;

async function startServer(): Promise<void> {
  try {
    // DB 初期化が完了するまで API の待ち受けを開始しない
    await initDBWithRetry();
    app.listen(PORT, () => {
      console.log(`Backend listening on port ${PORT}`);
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`FATAL: Unable to initialize database: ${message}`);
    process.exit(1);
  }
}

void startServer();
