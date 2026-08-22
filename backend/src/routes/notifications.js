const express = require('express');
const { sendNotificationMessage, getUserNotifications } = require('../controllers/notificationController');
const authMiddleware = require('../middleware/auth');

const router = express.Router();

router.use(authMiddleware);

router.post('/send', sendNotificationMessage);
router.get('/', getUserNotifications);

module.exports = router;
