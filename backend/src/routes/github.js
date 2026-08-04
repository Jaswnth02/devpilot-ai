const express = require('express');
const {
  getAuthUrl,
  callback,
  getRepositories,
  linkRepository,
  syncData,
  handleWebhook
} = require('../controllers/githubController');
const authMiddleware = require('../middleware/auth');
const verifyWebhookSignature = require('../middleware/githubWebhook');

const router = express.Router();

// OAuth callback (called by GitHub, public)
router.get('/callback', callback);

// Webhook endpoint (called by GitHub, validated via SHA256 signature check)
router.post('/webhook', verifyWebhookSignature, handleWebhook);

// Protected routes (require user JWT auth)
router.get('/auth', authMiddleware, getAuthUrl);
router.get('/repos', authMiddleware, getRepositories);
router.post('/link', authMiddleware, linkRepository);
router.post('/sync', authMiddleware, syncData);

module.exports = router;
