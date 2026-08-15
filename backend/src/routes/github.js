const express = require('express');
const {
  connect,
  getAuthUrl,
  callback,
  connectSandbox,
  verifyAccount,
  connectVerifiedAccount,
  getStatus,
  getRepositories,
  syncRepositories,
  connectRepositoryToProject,
  disconnectRepositoryFromProject,
  syncProjectRepository,
  verifyRepository,
  getRepositoryById,
  getRepositoryFiles,
  analyzeRepository,
  handleWebhook,
  disconnectGitHub
} = require('../controllers/githubController');
const authMiddleware = require('../middleware/auth');

const router = express.Router();

// 1. Public OAuth callback & Webhook
router.get('/callback', callback);
router.post('/webhook', handleWebhook);

// 2. Protected Authentication, Verification & Status endpoints
router.get('/connect', authMiddleware, connect);
router.get('/auth', authMiddleware, getAuthUrl);
router.post('/verify-account', authMiddleware, verifyAccount);
router.post('/connect-verified', authMiddleware, connectVerifiedAccount);
router.post('/connect-sandbox', authMiddleware, connectSandbox);
router.get('/status', authMiddleware, getStatus);
router.delete('/disconnect', authMiddleware, disconnectGitHub);

// 3. Repository Listing & Synchronization endpoints
router.get('/repos', authMiddleware, getRepositories);
router.get('/repositories', authMiddleware, getRepositories);
router.post('/sync', authMiddleware, syncRepositories);

// 4. Project-Repository Connection & Mapping endpoints
router.post('/repos/:repositoryId/connect', authMiddleware, connectRepositoryToProject);
router.post('/repositories/import', authMiddleware, connectRepositoryToProject);
router.post('/link', authMiddleware, connectRepositoryToProject);
router.post('/repos/:repositoryId/sync', authMiddleware, syncProjectRepository);
router.post('/projects/:projectId/sync', authMiddleware, syncProjectRepository);
router.delete('/repos/:repositoryId/disconnect', authMiddleware, disconnectRepositoryFromProject);
router.delete('/repositories/:id/disconnect', authMiddleware, disconnectRepositoryFromProject);
router.post('/repositories/verify', authMiddleware, verifyRepository);

// 5. Repository Inspection & File Analysis
router.get('/repositories/:id', authMiddleware, getRepositoryById);
router.get('/repositories/:id/files', authMiddleware, getRepositoryFiles);
router.post('/repositories/:id/analyze', authMiddleware, analyzeRepository);

// 6. Linked repositories listing for compatibility
router.get('/linked', authMiddleware, async (req, res) => {
  try {
    const MongoProject = require('../models/mongo/Project');
    const projects = await MongoProject.find({
      'githubRepository.githubRepositoryId': { $exists: true, $ne: null }
    }).select('name description projectCode ownerId githubRepository');
    return res.status(200).json(projects);
  } catch (e) {
    return res.status(500).json({ error: 'Failed to list linked repositories' });
  }
});

module.exports = router;
