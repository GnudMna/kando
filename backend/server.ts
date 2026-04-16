// Expressアプリケーションのエントリーポイント
// 各種ミドルウェアのセットアップ、ルーティング登録、サーバー起動を担う
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { initDBWithRetry } from './db.js';
import { errorHandler } from './middleware/errorHandler.js';
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

// アプリ起動時にDBの初期化を実行する（失敗時はリトライする）
initDBWithRetry();

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
app.listen(PORT, () => {
  console.log(`Backend listening on port ${PORT}`);
});
