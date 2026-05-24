import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { authRouter } from './routes/auth';
import { eventRouter } from './routes/event';
import { musicRouter } from './routes/music';
import { betterAuth } from './betterAuth';

import { toNodeHandler } from 'better-auth/node';

const app = express();
// Use BACKEND_PORT from .env (fallback 4000)
const PORT = Number(process.env.BACKEND_PORT) || 4000;

// CORS – only allow the front‑end domain (defined in .env)
app.use(
  cors({
    origin: process.env.CORS_ORIGIN || 'http://localhost:5173',
    credentials: true,
  })
);

app.use(express.json());

// BetterAuth Node handler for Express
app.all('/api/auth/*splat', toNodeHandler(betterAuth));

// Existing API routes
app.use('/api/auth-local', authRouter); // fallback for token‑based login (kept from earlier code)
app.use('/api/events', eventRouter);
app.use('/api/music', musicRouter);

// Basic health check
app.get('/api/health', (_req, res) => res.json({ status: 'ok' }));

app.listen(PORT, () => {
  console.log(`🚀 Server listening on http://localhost:${PORT}`);
});
