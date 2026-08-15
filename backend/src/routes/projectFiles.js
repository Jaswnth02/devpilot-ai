const express = require('express');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const authMiddleware = require('../middleware/auth');
const {
  uploadFile,
  getProjectFiles,
  downloadFile,
  deleteFile
} = require('../controllers/fileController');

const os = require('os');
const router = express.Router();

// Ensure uploads directory exists
const uploadDir = process.env.VERCEL
  ? path.join(os.tmpdir(), 'uploads')
  : path.join(__dirname, '../../uploads');

try {
  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
  }
} catch (err) {
  console.warn('Could not initialize upload directory:', err.message);
}

// Multer configuration
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    // Unique prefix to prevent namespace collision
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    // Sanitize the file name to prevent directory traversal or script injection
    const sanitizedName = file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_');
    cb(null, uniqueSuffix + '-' + sanitizedName);
  }
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 20 * 1024 * 1024 // 20 MB size limit
  }
});

// All endpoints require authentication
router.use(authMiddleware);

// API Mappings (Mounted on /api/projects)
router.post('/:id/files', upload.single('file'), uploadFile);
router.get('/:id/files', getProjectFiles);
router.get('/files/download/:fileId', downloadFile);
router.delete('/files/:fileId', deleteFile);

module.exports = router;
