const crypto = require('crypto');
require('dotenv').config();

const SECRET_KEY = crypto
  .createHash('sha256')
  .update(process.env.JWT_SECRET || 'devpilot_super_secret_encryption_key_2026')
  .digest();

const ALGORITHM = 'aes-256-cbc';

/**
 * Encrypts sensitive text (e.g. GitHub Access Token) using AES-256-CBC
 */
function encryptToken(text) {
  if (!text) return text;
  try {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv(ALGORITHM, SECRET_KEY, iv);
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    return `${iv.toString('hex')}:${encrypted}`;
  } catch (err) {
    console.error('Token encryption error:', err.message);
    return text;
  }
}

/**
 * Decrypts encrypted text back to original string
 */
function decryptToken(encryptedText) {
  if (!encryptedText) return encryptedText;
  if (!encryptedText.includes(':')) return encryptedText; // Fallback if plain string
  try {
    const [ivHex, encrypted] = encryptedText.split(':');
    const iv = Buffer.from(ivHex, 'hex');
    const decipher = crypto.createDecipheriv(ALGORITHM, SECRET_KEY, iv);
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  } catch (err) {
    console.error('Token decryption error:', err.message);
    return encryptedText;
  }
}

module.exports = {
  encryptToken,
  decryptToken
};
