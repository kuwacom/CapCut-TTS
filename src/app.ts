import cors from 'cors';
import express from 'express';
import env from '@/configs/env';
import { loggerMiddleware } from '@/middleware/logger';
import router from '@/routes';

/**
 * Express アプリ本体
 */
const app = express();

// cors 設定
app.use(cors({ origin: env.CORS_POLICY_ORIGIN }));

// ミドルウェア設定
app.use(express.json());
app.use(loggerMiddleware);

// ルーティング設定
app.use('/', router);

export default app;
