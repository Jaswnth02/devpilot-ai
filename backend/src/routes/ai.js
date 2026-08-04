const express = require('express');
const {
  generatePlan,
  importPlan,
  recommendAssignment,
  analyzeTaskIssue,
  analyzeProject
} = require('../controllers/aiController');
const authMiddleware = require('../middleware/auth');

const router = express.Router();

router.use(authMiddleware);

router.post('/generate-plan', generatePlan);
router.post('/import-plan', importPlan);
router.post('/recommend-assignment', recommendAssignment);
router.post('/analyze-issue/:issueId', analyzeTaskIssue);
router.post('/analyze-project/:projectId', analyzeProject);

module.exports = router;
