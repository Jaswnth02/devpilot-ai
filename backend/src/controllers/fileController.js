const fs = require('fs');
const path = require('path');
const { ProjectFile, Project, ProjectMember, User } = require('../models');
const socketService = require('../services/socketService');

// Helper to check if user has access to the project
const checkProjectAccess = async (projectId, userId, userRole) => {
  if (userRole === 'Admin') return true;

  // Check if user is a member of the project
  const member = await ProjectMember.findOne({
    where: { project_id: projectId, user_id: userId }
  });

  return !!member;
};

// Upload file controller
const uploadFile = async (req, res) => {
  try {
    const projectId = req.params.id;
    const userId = req.user.id;

    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded.' });
    }

    const project = await Project.findByPk(projectId);
    if (!project) {
      // Clean up the uploaded file
      fs.unlinkSync(req.file.path);
      return res.status(404).json({ error: 'Project not found.' });
    }

    // Authorization check
    const hasAccess = await checkProjectAccess(projectId, userId, req.user.role);
    if (!hasAccess) {
      fs.unlinkSync(req.file.path);
      return res.status(403).json({ error: 'You do not have access to upload files to this project.' });
    }

    // Save metadata to database
    const projectFile = await ProjectFile.create({
      original_name: req.file.originalname,
      filename: req.file.filename,
      file_path: req.file.path,
      mime_type: req.file.mimetype,
      file_size: req.file.size,
      project_id: projectId,
      uploaded_by_user_id: userId
    });

    // Retrieve full record with uploader info
    const fullFileRecord = await ProjectFile.findByPk(projectFile.id, {
      include: [
        {
          model: User,
          as: 'Uploader',
          attributes: ['id', 'name', 'email']
        }
      ]
    });

    // Notify project room of the new file
    socketService.sendUpdateToProject(projectId, 'file_uploaded', fullFileRecord);

    res.status(201).json(fullFileRecord);
  } catch (error) {
    console.error('Upload file error:', error);
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    res.status(500).json({ error: 'Failed to upload file.' });
  }
};

// Get all files for a project
const getProjectFiles = async (req, res) => {
  try {
    const projectId = req.params.id;
    const userId = req.user.id;

    const project = await Project.findByPk(projectId);
    if (!project) {
      return res.status(404).json({ error: 'Project not found.' });
    }

    // Authorization check
    const hasAccess = await checkProjectAccess(projectId, userId, req.user.role);
    if (!hasAccess) {
      return res.status(403).json({ error: 'You do not have access to view files in this project.' });
    }

    const files = await ProjectFile.findAll({
      where: { project_id: projectId },
      include: [
        {
          model: User,
          as: 'Uploader',
          attributes: ['id', 'name', 'email']
        }
      ],
      order: [['createdAt', 'DESC']]
    });

    res.status(200).json(files);
  } catch (error) {
    console.error('Get project files error:', error);
    res.status(500).json({ error: 'Failed to retrieve files.' });
  }
};

// Download file controller
const downloadFile = async (req, res) => {
  try {
    const { fileId } = req.params;
    const userId = req.user.id;

    const file = await ProjectFile.findByPk(fileId);
    if (!file) {
      return res.status(404).json({ error: 'File not found.' });
    }

    // Authorization check
    const hasAccess = await checkProjectAccess(file.project_id, userId, req.user.role);
    if (!hasAccess) {
      return res.status(403).json({ error: 'You do not have access to download this file.' });
    }

    const resolvedPath = path.resolve(file.file_path);
    if (!fs.existsSync(resolvedPath)) {
      return res.status(404).json({ error: 'Physical file not found on server storage.' });
    }

    res.download(resolvedPath, file.original_name);
  } catch (error) {
    console.error('Download file error:', error);
    res.status(500).json({ error: 'Failed to download file.' });
  }
};

// Delete file controller
const deleteFile = async (req, res) => {
  try {
    const { fileId } = req.params;
    const userId = req.user.id;

    const file = await ProjectFile.findByPk(fileId);
    if (!file) {
      return res.status(404).json({ error: 'File not found.' });
    }

    // Authorization check: Only Admin, Project Owner, or the uploader can delete
    const isUploader = file.uploaded_by_user_id === userId;
    const isOwner = req.user.role === 'Project Owner';
    const isAdmin = req.user.role === 'Admin';

    if (!isUploader && !isOwner && !isAdmin) {
      return res.status(403).json({ error: 'You do not have permission to delete this file.' });
    }

    // Delete from disk first
    const resolvedPath = path.resolve(file.file_path);
    if (fs.existsSync(resolvedPath)) {
      await fs.promises.unlink(resolvedPath);
    }

    // Delete from database
    const projectId = file.project_id;
    await file.destroy();

    // Notify project room
    socketService.sendUpdateToProject(projectId, 'file_deleted', { fileId });

    res.status(200).json({ message: 'File deleted successfully.', fileId });
  } catch (error) {
    console.error('Delete file error:', error);
    res.status(500).json({ error: 'Failed to delete file.' });
  }
};

module.exports = {
  uploadFile,
  getProjectFiles,
  downloadFile,
  deleteFile
};
