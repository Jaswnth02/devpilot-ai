const mongoose = require('mongoose');
const MongoNotification = require('../models/mongo/Notification');
const MongoUser = require('../models/mongo/User');
const { Notification, User } = require('../models');
const { sendCustomNotificationEmail } = require('../services/emailService');
const socketService = require('../services/socketService');

const sendNotificationMessage = async (req, res) => {
  try {
    const { userId, email, title, message, projectName, type } = req.body;

    if (!userId || !title || !message) {
      return res.status(400).json({ error: 'User ID, title, and message content are required.' });
    }

    // 1. Fetch user to send to
    let targetUser = null;
    const userIdStr = userId.toString();
    
    if (mongoose.isValidObjectId(userIdStr)) {
      targetUser = await MongoUser.findById(userIdStr);
    }
    if (!targetUser) {
      targetUser = await User.findByPk(userIdStr);
    }

    if (!targetUser) {
      return res.status(404).json({ error: 'Target team member user not found.' });
    }

    // 2. If a custom email was provided for this line/user, update their personal email in DB
    if (email && email.trim().toLowerCase() !== targetUser.email) {
      const cleanEmail = email.trim().toLowerCase();
      if (targetUser.save) {
        targetUser.email = cleanEmail;
        await targetUser.save();
      } else if (targetUser.update) {
        await targetUser.update({ email: cleanEmail });
      }
    }

    const recipientEmail = (email && email.trim()) || targetUser.email;
    const recipientName = targetUser.fullName || targetUser.name || 'Team Member';
    const senderName = req.user ? (req.user.fullName || req.user.name) : 'Project Owner';
    const senderId = req.user ? (req.user._id || req.user.id) : null;

    // 3. Store notification record in Database (MongoDB & SQLite)
    let savedNotification = null;
    if (mongoose.isValidObjectId(userIdStr)) {
      savedNotification = await MongoNotification.create({
        userId: userIdStr,
        userEmail: recipientEmail,
        title,
        message,
        type: type || 'CustomNotification',
        sentBy: senderName,
        senderId: senderId ? senderId.toString() : null,
        isRead: false
      });
    }

    // Also fallback / store in SQLite
    try {
      const numericUserId = parseInt(userIdStr, 10);
      if (!isNaN(numericUserId)) {
        await Notification.create({
          user_id: numericUserId,
          title,
          message,
          type: 'Task',
          is_read: false
        });
      }
    } catch (e) {
      console.warn('SQLite Notification create skipped:', e.message);
    }

    // 4. Send Email to personal email address via Nodemailer
    const emailResult = await sendCustomNotificationEmail({
      userEmail: recipientEmail,
      userName: recipientName,
      title,
      message,
      senderName,
      projectName: projectName || 'DevPilot AI Workspace'
    });

    // 5. Emit real-time WebSocket notification to online user
    try {
      socketService.sendNotificationToUser(userIdStr, {
        id: savedNotification ? savedNotification._id.toString() : Date.now().toString(),
        title,
        message,
        type: type || 'CustomNotification',
        senderName,
        createdAt: new Date()
      });
    } catch (err) {
      console.warn('Socket notification error:', err.message);
    }

    return res.status(200).json({
      message: 'Notification sent and saved to database successfully.',
      emailStatus: emailResult,
      notification: savedNotification
    });
  } catch (error) {
    console.error('Send notification message error:', error);
    return res.status(500).json({ error: error.message || 'Failed to send notification.' });
  }
};

const getUserNotifications = async (req, res) => {
  try {
    const userId = req.user._id ? req.user._id.toString() : req.user.id.toString();

    let notifications = [];
    if (mongoose.isValidObjectId(userId)) {
      notifications = await MongoNotification.find({ userId }).sort({ createdAt: -1 });
    } else {
      notifications = await Notification.findAll({
        where: { user_id: userId },
        order: [['createdAt', 'DESC']]
      });
    }

    return res.status(200).json(notifications);
  } catch (error) {
    console.error('Get notifications error:', error);
    return res.status(500).json({ error: 'Failed to fetch notifications.' });
  }
};

module.exports = {
  sendNotificationMessage,
  getUserNotifications
};
