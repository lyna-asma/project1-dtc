import express from 'express';
import cors from 'cors';
import authRouter from './routes/auth.js';
import customerRouter from './routes/customer.js';

const app = express();

app.use(cors());
app.use(express.json());

app.get(['/health', '/api/health'], (_req, res) => {
  res.status(200).json({ status: 'ok' });
});

app.use('/api/auth', authRouter);
app.use('/api/customer', customerRouter);

export { app };
export default app;

