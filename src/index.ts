import express, { Request, Response } from 'express';
import cors from 'cors';

import logger from './utils/log';
import env from './config/env';
import synthesize from './routes/synthesize';

// エラーハンドリング
if (env.errorHandle) {
    process.on("uncaughtException", (err) => {
        logger.error(err.toString());
    });
}

const app = express();
app.use(cors({ origin: env.origin })); // cors 設定
app.listen(env.port, env.host, () => {
    logger.info(`Server is running on: http://${env.host}:${env.port}`);
});

// restServer
const mainRouter = express.Router();
app.use('/v1', mainRouter);
app.use((req, res, next) => {
    res.status(404).send('Not Found');
});
mainRouter.get('/synthesize', synthesize);