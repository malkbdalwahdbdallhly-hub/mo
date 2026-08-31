import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import dotenv from 'dotenv';
import { apiRouter } from './server/apiRouter';
import { telegramBotService } from './server/telegram/telegramBotService';

dotenv.config();

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Request parsers
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));

  // Security headers
  app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'SAMEORIGIN');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    next();
  });

  // API Routes FIRST
  app.use('/api', apiRouter);

  // Health check
  app.get('/api/health', (req, res) => {
    res.json({
      status: 'ok',
      service: 'Makeen Platform API',
      timestamp: new Date().toISOString(),
      mockMode: process.env.MOCK_MODE === 'true',
    });
  });

  // Vite middleware for development vs static build for production
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Makeen Server running on http://0.0.0.0:${PORT}`);
    // Initialize Telegram Bot Service (polling or webhook)
    telegramBotService.init().catch((err) => {
      console.warn('⚠️ Telegram Bot startup error:', err);
    });
  });
}

startServer().catch((err) => {
  console.error('Failed to start Makeen server:', err);
  process.exit(1);
});
