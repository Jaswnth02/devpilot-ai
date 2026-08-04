const crypto = require('crypto');
require('dotenv').config();

const verifyWebhookSignature = (req, res, next) => {
  const signature = req.headers['x-hub-signature-256'];
  const secret = process.env.GITHUB_WEBHOOK_SECRET || 'devpilotwebhooksecret';

  // If in mock mode or checking local trigger, bypass signature verification
  if (!signature && (!process.env.GITHUB_CLIENT_ID || req.body.isMockWebhook)) {
    console.log('[Webhook Middleware] Bypassing signature verification for mock trigger.');
    return next();
  }

  if (!signature) {
    return res.status(401).json({ error: 'Signature header is missing.' });
  }

  try {
    const payload = JSON.stringify(req.body);
    const hmac = crypto.createHmac('sha256', secret);
    const digest = 'sha256=' + hmac.update(payload).digest('hex');

    // Secure comparison to prevent timing attacks
    const checksum = Buffer.from(digest, 'utf8');
    const signatureBuffer = Buffer.from(signature, 'utf8');

    if (checksum.length !== signatureBuffer.length || !crypto.timingSafeEqual(checksum, signatureBuffer)) {
      console.warn('[Webhook Middleware] Webhook signature mismatch.');
      // For developer friendliness, log warning and let it proceed if running in sandbox/local,
      // but in production it must block. We will reject if GITHUB_CLIENT_ID is set.
      if (process.env.GITHUB_CLIENT_ID) {
        return res.status(401).json({ error: 'Invalid signature.' });
      }
    }

    next();
  } catch (error) {
    console.error('Error verifying webhook signature:', error);
    return res.status(500).json({ error: 'Webhook signature validation error.' });
  }
};

module.exports = verifyWebhookSignature;
