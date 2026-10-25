import express from 'express';
import cors from 'cors';
import authRouter from './routes/auth.js';

const app = express();

app.use(cors());
app.use(express.json());

app.get(['/health', '/api/health'], (_req, res) => {
  res.status(200).json({ status: 'ok' });
});

app.use('/api/auth', authRouter);

export { app };
export default app;
