const express = require('express');
const {
  connect,
  getAuthUrl,
  callback,
  getStatus,
  getRepositories,
  createRepository,
  connectRepositoryToProject,
  verifyRepository,
  disconnectRepositoryFromProject,
  syncProjectRepository,
  disconnectGitHub,
  handleWebhook,
  getRepositoryById,
  getRepositoryFiles,
  analyzeRepository
} = require('../controllers/githubController');
const authMiddleware = require('../middleware/auth');

const router = express.Router();

// 1. Public OAuth Callback & Webhook Listener
router.get('/callback', callback);
router.post('/webhook', handleWebhook);

// 2. Protected Authentication & Status Endpoints
router.get('/connect', authMiddleware, connect);
router.get('/auth', authMiddleware, getAuthUrl);
router.get('/status', authMiddleware, getStatus);
router.delete('/disconnect', authMiddleware, disconnectGitHub);

// 3. Repository Listing & Creation Endpoints
router.get('/repos', authMiddleware, getRepositories);
router.get('/repositories', authMiddleware, getRepositories);
router.post('/repos/create', authMiddleware, createRepository);
router.post('/create-repo', authMiddleware, createRepository);

// 4. Project-Repository Connection, Verification & Synchronization Endpoints
router.post('/repos/:repositoryId/connect', authMiddleware, connectRepositoryToProject);
router.post('/repositories/import', authMiddleware, connectRepositoryToProject);
router.post('/link', authMiddleware, connectRepositoryToProject);
router.post('/repositories/verify', authMiddleware, verifyRepository);
router.post('/repos/:repositoryId/sync', authMiddleware, syncProjectRepository);
router.post('/projects/:projectId/sync', authMiddleware, syncProjectRepository);
router.delete('/repos/:repositoryId/disconnect', authMiddleware, disconnectRepositoryFromProject);
router.delete('/repositories/:id/disconnect', authMiddleware, disconnectRepositoryFromProject);

// 5. Codebase Inspection & File Tree Endpoints
router.get('/repositories/:id', authMiddleware, getRepositoryById);
router.get('/repositories/:id/files', authMiddleware, getRepositoryFiles);
router.post('/repositories/:id/analyze', authMiddleware, analyzeRepository);

// 6. Linked Repositories compatibility route
router.get('/linked', authMiddleware, async (req, res) => {
  try {
    const MongoProject = require('../models/mongo/Project');
    const projects = await MongoProject.find({
      'githubIntegration.repositoryId': { $exists: true, $ne: null }
    }).select('name description projectCode ownerId githubIntegration githubRepository');
    return res.status(200).json(projects);
  } catch (e) {
    return res.status(500).json({ error: 'Failed to list linked repositories.' });
  }
});

module.exports = router;
