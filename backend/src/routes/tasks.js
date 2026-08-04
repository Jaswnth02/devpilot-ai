const express = require('express');
const {
  createTask,
  getTaskById,
  updateTask,
  deleteTask,
  addComment,
  getComments,
  reportIssue,
  getIssues
} = require('../controllers/taskController');
const authMiddleware = require('../middleware/auth');

const router = express.Router();

router.use(authMiddleware);

router.post('/', createTask);
router.get('/:id', getTaskById);
router.put('/:id', updateTask);
router.delete('/:id', deleteTask);

// Comments
router.post('/:id/comments', addComment);
router.get('/:id/comments', getComments);

// Issues
router.post('/:id/issues', reportIssue);
router.get('/:id/issues', getIssues);

module.exports = router;
