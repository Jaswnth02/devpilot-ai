const express = require('express');
const {
  connect,
  getAuthUrl,
  callback,
  connectSandbox,
  getStatus,
  getRepositories,
  verifyRepository,
  importRepository,
  getRepositoryById,
  getRepositoryFiles,
  analyzeRepository,
  handleWebhook,
  disconnectRepository,
  disconnectGitHub
} = require('../controllers/githubController');
const authMiddleware = require('../middleware/auth');

const router = express.Router();

// Public Webhook & OAuth callback
router.get('/callback', callback);
router.post('/webhook', handleWebhook);

// Protected routes (require logged-in website JWT user)
router.get('/connect', authMiddleware, connect);
router.get('/auth', authMiddleware, getAuthUrl);
router.post('/connect-sandbox', authMiddleware, connectSandbox);
router.get('/status', authMiddleware, getStatus);
router.get('/repositories', authMiddleware, getRepositories);
router.post('/repositories/verify', authMiddleware, verifyRepository);
router.post('/repositories/import', authMiddleware, importRepository);
router.get('/repositories/:id', authMiddleware, getRepositoryById);
router.get('/repositories/:id/files', authMiddleware, getRepositoryFiles);
router.post('/repositories/:id/analyze', authMiddleware, analyzeRepository);
router.delete('/repositories/:id/disconnect', authMiddleware, disconnectRepository);
router.delete('/disconnect', authMiddleware, disconnectGitHub);

// Legacy aliases for compatibility
router.get('/repos', authMiddleware, getRepositories);
router.post('/link', authMiddleware, importRepository);
router.get('/linked', authMiddleware, async (req, res) => {
  try {
    const ImportedRepository = require('../models/mongo/ImportedRepository');
    const repos = await ImportedRepository.find({}).populate('projectId', 'name description projectCode ownerId');
    return res.status(200).json(repos);
  } catch (e) {
    return res.status(500).json({ error: 'Failed to list linked repositories' });
  }
});

module.exports = router;
