const crypto = require('crypto');
const MongoProject = require('../models/mongo/Project');

/**
 * Generate a unique 6-character Project Code formatted as DP-XXXXXX
 */
const generateUniqueProjectCode = async () => {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Upper alphanumeric without ambiguous characters
  let code = '';
  let isUnique = false;
  let attempts = 0;

  while (!isUnique && attempts < 100) {
    attempts++;
    let randomChars = '';
    for (let i = 0; i < 6; i++) {
      const randomIndex = crypto.randomInt(0, chars.length);
      randomChars += chars[randomIndex];
    }
    code = `DP-${randomChars}`;

    // Check if code already exists in MongoDB
    const existing = await MongoProject.findOne({ projectCode: code });
    if (!existing) {
      isUnique = true;
    }
  }

  if (!isUnique) {
    // Fallback timestamp hex string if collision limit reached
    code = `DP-${Date.now().toString(36).toUpperCase().slice(-6)}`;
  }

  return code;
};

module.exports = {
  generateUniqueProjectCode
};
