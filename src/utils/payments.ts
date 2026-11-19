import crypto from 'crypto';

export type PaymentPlanId = 'monthly' | 'quarterly' | 'annual';

export const VIP_PLAN_PRICES_CENTS: Record<PaymentPlanId, { amountCents: number; intervalMonths: number; label: string }> = {
  monthly: { amountCents: 1499, intervalMonths: 1, label: 'NearMe VIP Monthly' },
  quarterly: { amountCents: 3597, intervalMonths: 3, label: 'NearMe VIP Quarterly (3 Months)' },
  annual: { amountCents: 10788, intervalMonths: 12, label: 'NearMe VIP Annual (12 Months)' },
};

export function verifyNearMeWebhookSignature(
  rawBody: Buffer,
  signatureHeader: string,
  secret: string
): boolean {
  if (!secret || !signatureHeader || !rawBody) return false;
  const expected = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
  const sigBuf = Buffer.from(signatureHeader.trim());
  const expBuf = Buffer.from(expected);
  if (sigBuf.length !== expBuf.length) return false;
  return crypto.timingSafeEqual(sigBuf, expBuf);
}

export function verifyStripeWebhookSignature(
  rawBody: Buffer,
  stripeSignatureHeader: string,
  secret: string,
  nowSeconds: number = Math.floor(Date.now() / 1000),
  toleranceSeconds: number = 300
): boolean {
  if (!secret || !stripeSignatureHeader || !rawBody) return false;

  const parts = stripeSignatureHeader.split(',').map((part) => part.trim());
  let timestamp = '';
  const v1Signatures: string[] = [];

  for (const part of parts) {
    const eqIdx = part.indexOf('=');
    if (eqIdx <= 0) continue;
    const key = part.slice(0, eqIdx).trim();
    const val = part.slice(eqIdx + 1).trim();
    if (key === 't') timestamp = val;
    if (key === 'v1' && val) v1Signatures.push(val);
  }

  const parsedTs = Number(timestamp);
  if (!timestamp || !Number.isFinite(parsedTs) || v1Signatures.length === 0) {
    return false;
  }

  if (Math.abs(nowSeconds - parsedTs) > toleranceSeconds) {
    return false;
  }

  const signedPayload = `${timestamp}.${rawBody.toString('utf8')}`;
  const expected = crypto.createHmac('sha256', secret).update(signedPayload).digest('hex');
  const expBuf = Buffer.from(expected);

  return v1Signatures.some((sig) => {
    const sigBuf = Buffer.from(sig);
    return sigBuf.length === expBuf.length && crypto.timingSafeEqual(sigBuf, expBuf);
  });
}

export function verifyWebhookRequest(
  rawBody: Buffer | undefined,
  headers: { nearmeSignature?: string | string[]; stripeSignature?: string | string[] },
  secret: string | undefined,
  nowSeconds?: number
): { valid: boolean; provider?: 'stripe' | 'custom'; reason?: string } {
  if (!secret) {
    return { valid: false, reason: 'PAYMENT_WEBHOOK_SECRET is not configured' };
  }
  if (!rawBody || rawBody.length === 0) {
    return { valid: false, reason: 'Missing webhook payload' };
  }

  if (typeof headers.stripeSignature === 'string' && headers.stripeSignature.trim()) {
    const ok = verifyStripeWebhookSignature(rawBody, headers.stripeSignature, secret, nowSeconds);
    return ok
      ? { valid: true, provider: 'stripe' }
      : { valid: false, provider: 'stripe', reason: 'Invalid Stripe webhook signature' };
  }

  if (typeof headers.nearmeSignature === 'string' && headers.nearmeSignature.trim()) {
    const ok = verifyNearMeWebhookSignature(rawBody, headers.nearmeSignature, secret);
    return ok
      ? { valid: true, provider: 'custom' }
      : { valid: false, provider: 'custom', reason: 'Invalid webhook signature' };
  }

  return { valid: false, reason: 'Missing webhook signature header' };
}
