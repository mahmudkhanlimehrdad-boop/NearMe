import 'dotenv/config';
import express from 'express';
import fs from 'fs';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';
import { isAdult18Plus, sanitizeAndValidateContact } from './src/utils/validation';
import {
  VIP_PLAN_PRICES_CENTS,
  verifyWebhookRequest,
  type PaymentPlanId,
} from './src/utils/payments';
import type { ContactMethod } from './src/types/nearme';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT || 3000);

async function startServer() {
  const app = express();
  const httpServer = http.createServer(app);

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

  app.post('/api/payments/create-checkout', async (req, res) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({ ok: false, error: 'Authentication required' });
      return;
    }

    const providerSecret = process.env.PAYMENT_PROVIDER_SECRET;
    const webhookSecret = process.env.PAYMENT_WEBHOOK_SECRET;
    const missingCredentials: string[] = [];
    if (!providerSecret) missingCredentials.push('PAYMENT_PROVIDER_SECRET');
    if (!webhookSecret) missingCredentials.push('PAYMENT_WEBHOOK_SECRET');

    if (missingCredentials.length > 0 || !providerSecret) {
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

    const selectedPlan = VIP_PLAN_PRICES_CENTS[plan as PaymentPlanId];
    if (providerSecret.startsWith('sk_')) {
      const origin = process.env.APP_URL || `${req.protocol}://${req.get('host')}`;
      const body = new URLSearchParams({
        mode: 'subscription',
        'line_items[0][price_data][currency]': 'usd',
        'line_items[0][price_data][unit_amount]': String(selectedPlan.amountCents),
        'line_items[0][price_data][recurring][interval]': 'month',
        'line_items[0][price_data][recurring][interval_count]': String(selectedPlan.intervalMonths),
        'line_items[0][price_data][product_data][name]': selectedPlan.label,
        'line_items[0][quantity]': '1',
        success_url: `${origin}/subscription/history?checkout=success`,
        cancel_url: `${origin}/subscription?checkout=cancelled`,
        'metadata[plan]': plan,
      });

      try {
        const stripeRes = await fetch('https://api.stripe.com/v1/checkout/sessions', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${providerSecret}`,
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: body.toString(),
        });
        const sessionData = (await stripeRes.json()) as { url?: string; error?: { message?: string } };
        if (!stripeRes.ok || !sessionData.url) {
          res.status(502).json({
            ok: false,
            error: sessionData.error?.message || 'Unable to create Stripe checkout session.',
          });
          return;
        }
        res.json({ ok: true, checkoutUrl: sessionData.url });
        return;
      } catch (err) {
        res.status(502).json({
          ok: false,
          error: err instanceof Error ? err.message : 'Payment provider request failed.',
        });
        return;
      }
    }

    res.status(501).json({
      ok: false,
      error: 'Configure a valid Stripe secret key (sk_...) in PAYMENT_PROVIDER_SECRET for hosted checkout.',
    });
  });

  app.post('/api/payments/webhook', (req, res) => {
    const rawBody = (req as express.Request & { rawBody?: Buffer }).rawBody;
    const verification = verifyWebhookRequest(
      rawBody,
      {
        nearmeSignature: req.headers['x-nearme-signature'],
        stripeSignature: req.headers['stripe-signature'],
      },
      process.env.PAYMENT_WEBHOOK_SECRET
    );

    if (!verification.valid) {
      const statusCode =
        verification.reason === 'PAYMENT_WEBHOOK_SECRET is not configured'
          ? 503
          : verification.reason?.startsWith('Missing')
            ? 400
            : 401;
      res.status(statusCode).json({ ok: false, error: verification.reason });
      return;
    }

    res.json({ received: true, provider: verification.provider });
  });

  const isProd = process.env.NODE_ENV === 'production' && fs.existsSync(path.join(__dirname, 'dist'));
  if (!isProd) {
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: false,
        ws: { server: httpServer },
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.join(__dirname, 'dist');
    app.use(
      express.static(distDir, {
        setHeaders: (res, filePath) => {
          if (filePath.endsWith('.webmanifest')) {
            res.setHeader('Content-Type', 'application/manifest+json; charset=utf-8');
          }
          if (path.basename(filePath) === 'sw.js' || path.basename(filePath).startsWith('workbox-')) {
            res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
          }
        },
      })
    );
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`NearMe server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start NearMe server:', err);
  process.exit(1);
});
