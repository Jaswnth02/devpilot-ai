const express = require('express');
const {
  createProject,
  getProjects,
  getProjectById,
  updateProject,
  deleteProject,
  addProjectMember,
  removeProjectMember,
  getSkills,
  createSkill
} = require('../controllers/projectController');
const authMiddleware = require('../middleware/auth');

const router = express.Router();

// Apply auth middleware to all project routes
router.use(authMiddleware);

// Project CRUD
router.get('/', getProjects);
router.post('/', createProject);
router.get('/:id', getProjectById);
router.put('/:id', updateProject);
router.delete('/:id', deleteProject);

// Members management
router.post('/:id/members', addProjectMember);
router.delete('/:id/members/:userId', removeProjectMember);

// Skills dictionary routes (under project namespace for convenience, or globally)
router.get('/meta/skills', getSkills);
router.post('/meta/skills', createSkill);

module.exports = router;
