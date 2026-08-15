const jwt = require('jsonwebtoken');
const MongoUser = require('../models/mongo/User');
const { User: SqlUser } = require('../models');
require('dotenv').config();

const authMiddleware = async (req, res, next) => {
  try {
    let token = null;
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.split(' ')[1];
    } else if (req.query?.token) {
      token = req.query.token;
    } else if (req.headers['x-auth-token']) {
      token = req.headers['x-auth-token'];
    }

    if (!token) {
      return res.status(401).json({ error: 'Access denied. No token provided.' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'supersecretdevpilotkey');
    
    // Check MongoDB Atlas first
    let user = null;
    if (decoded.id && typeof decoded.id === 'string' && decoded.id.length === 24) {
      user = await MongoUser.findById(decoded.id);
    }
    
    // If not found in MongoDB, check SQL
    if (!user) {
      user = await SqlUser.findByPk(decoded.id);
    }

    if (!user) {
      return res.status(401).json({ error: 'Invalid token. User not found.' });
    }

    req.user = user;
    next();
  } catch (error) {
    console.error('Authentication Error:', error);
    return res.status(401).json({ error: 'Invalid or expired token.' });
  }
};

module.exports = authMiddleware;
