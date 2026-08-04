const express = require('express');
const { getUsers, updateProfile } = require('../controllers/userController');
const authMiddleware = require('../middleware/auth');

const router = express.Router();

router.use(authMiddleware);

router.get('/', getUsers);
router.put('/:id', updateProfile);

module.exports = router;
