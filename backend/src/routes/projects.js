const express = require('express');
const {
  getGeneratedCode,
  createProject,
  joinProject,
  getProjects,
  getProjectById,
  respondJoinRequest,
  removeProjectMember,
  updateProject,
  deleteProject
} = require('../controllers/projectController');
const { generatePlan } = require('../controllers/aiController');
const authMiddleware = require('../middleware/auth');

const router = express.Router();

// Apply auth middleware to all project routes
router.use(authMiddleware);

// Project CRUD & Code Generation & Joining
router.get('/generate-code', getGeneratedCode);
router.get('/', getProjects);
router.post('/', createProject);
router.post('/join', joinProject);
router.get('/:id', getProjectById);
router.get('/:id/team-info', getProjectById);
router.put('/:id', updateProject);
router.delete('/:id', deleteProject);

// Owner Join Request Approval & Member Management
router.post('/:id/join-requests/:requestId/respond', respondJoinRequest);
router.delete('/:id/members/:userId', removeProjectMember);

// Owner Only AI Plan Generation
router.post('/:id/generate-plan', generatePlan);

module.exports = router;
