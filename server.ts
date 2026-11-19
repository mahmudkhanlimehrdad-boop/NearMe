import 'dotenv/config';
import crypto from 'crypto';
import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';
import { isAdult18Plus, sanitizeAndValidateContact } from './src/utils/validation';
import type { ContactMethod } from './src/types/nearme';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT || 3000);

async function startServer() {
  const app = express();

  // Preserve raw body for payment webhook HMAC verification
  app.use(
    express.json({
      verify: (req, _res, buf) => {
        (req as express.Request & { rawBody?: Buffer }).rawBody = buf;
      },
    })
  );

  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', service: 'nearme-web', timestamp: new Date().toISOString() });
  });

  app.get('/api/config/status', (_req, res) => {
    const missingCredentials: string[] = [];
    if (!process.env.PAYMENT_PROVIDER_SECRET) missingCredentials.push('PAYMENT_PROVIDER_SECRET');
    if (!process.env.PAYMENT_WEBHOOK_SECRET) missingCredentials.push('PAYMENT_WEBHOOK_SECRET');

    res.json({
      paymentConfigured: missingCredentials.length === 0,
      missingCredentials,
      adminBootstrapConfigured: Boolean(process.env.ADMIN_BOOTSTRAP_SECRET),
      fcmVapidConfigured: Boolean(process.env.VITE_FIREBASE_VAPID_KEY),
    });
  });

  app.post('/api/auth/validate-age', (req, res) => {
    const { birthDate } = req.body as { birthDate?: string };
    if (!birthDate || !isAdult18Plus(birthDate)) {
      res.status(400).json({ valid: false, errorKey: 'errors.under18' });
      return;
    }
    res.json({ valid: true });
  });

  app.post('/api/contacts/validate', (req, res) => {
    const { method, value } = req.body as { method?: ContactMethod; value?: string };
    if (!method || typeof value !== 'string') {
      res.status(400).json({ valid: false, errorKey: 'errors.required' });
      return;
    }
    const result = sanitizeAndValidateContact(method, value);
    if (!result.valid) {
      res.status(400).json(result);
      return;
    }
    res.json(result);
  });

  app.post('/api/payments/create-checkout', (req, res) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({ ok: false, error: 'Authentication required' });
      return;
    }

    const missingCredentials: string[] = [];
    if (!process.env.PAYMENT_PROVIDER_SECRET) missingCredentials.push('PAYMENT_PROVIDER_SECRET');
    if (!process.env.PAYMENT_WEBHOOK_SECRET) missingCredentials.push('PAYMENT_WEBHOOK_SECRET');

    if (missingCredentials.length > 0) {
      res.status(503).json({
        ok: false,
        error: 'Payment provider secrets are not configured on the server.',
        missingCredentials,
      });
      return;
    }

    const { plan } = req.body as { plan?: string };
    if (!plan || !['monthly', 'quarterly', 'annual'].includes(plan)) {
      res.status(400).json({ ok: false, error: 'Invalid subscription plan' });
      return;
    }

    // Real provider session creation would invoke Stripe/provider REST API using process.env.PAYMENT_PROVIDER_SECRET
    res.status(501).json({
      ok: false,
      error: 'Connect your configured payment provider merchant account webhook URL before live charges.',
    });
  });

  app.post('/api/payments/webhook', (req, res) => {
    const secret = process.env.PAYMENT_WEBHOOK_SECRET;
    if (!secret) {
      res.status(503).json({ ok: false, error: 'PAYMENT_WEBHOOK_SECRET is not configured' });
      return;
    }
    const signature = req.headers['x-nearme-signature'] || req.headers['stripe-signature'];
    const rawBody = (req as express.Request & { rawBody?: Buffer }).rawBody;
    if (!signature || typeof signature !== 'string' || !rawBody) {
      res.status(400).json({ ok: false, error: 'Missing webhook signature or payload' });
      return;
    }

    const expected = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
    const sigBuf = Buffer.from(signature);
    const expBuf = Buffer.from(expected);
    if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
      res.status(401).json({ ok: false, error: 'Invalid webhook signature' });
      return;
    }

    res.json({ received: true });
  });

  const isProd = process.env.NODE_ENV === 'production' && fs.existsSync(path.join(__dirname, 'dist'));
  if (!isProd) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.join(__dirname, 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`NearMe server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start NearMe server:', err);
  process.exit(1);
});
