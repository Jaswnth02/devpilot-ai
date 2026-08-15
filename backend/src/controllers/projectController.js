const MongoProject = require('../models/mongo/Project');
const MongoUser = require('../models/mongo/User');
const MongoTask = require('../models/mongo/Task');
const ProjectJoinRequest = require('../models/mongo/ProjectJoinRequest');
const { generateUniqueProjectCode } = require('../utils/projectCodeGenerator');
const { Project: SqlProject, ProjectMember: SqlProjectMember, User: SqlUser } = require('../models');
const socketService = require('../services/socketService');

// Helper to convert IDs to strings
const getIdStr = (userObj) => {
  if (!userObj) return '';
  return (userObj._id || userObj.id || userObj).toString();
};

// 0. GENERATE DRAFT PROJECT CODE
const getGeneratedCode = async (req, res) => {
  try {
    const code = await generateUniqueProjectCode();
    return res.status(200).json({ projectCode: code });
  } catch (error) {
    console.error('Generate project code error:', error);
    return res.status(500).json({ error: 'Failed to generate project code.' });
  }
};

// 1. CREATE PROJECT (Generates DP-XXXXXX Project Code and sets Owner & Allocated Members)
const createProject = async (req, res) => {
  try {
    const { name, description, tech_stack, technologyStack, deadline, targetDeadline, projectCode: customCode, memberIds } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Project name is required.' });
    }

    if (!description || !description.trim()) {
      return res.status(400).json({ error: 'Project description is required.' });
    }

    const userIdStr = getIdStr(req.user);
    if (!userIdStr) {
      return res.status(401).json({ error: 'User authentication required.' });
    }

    let projectCode = customCode ? customCode.trim().toUpperCase() : null;
    if (!projectCode || projectCode.length < 5) {
      projectCode = await generateUniqueProjectCode();
    } else {
      const existing = await MongoProject.findOne({ projectCode });
      if (existing) {
        projectCode = await generateUniqueProjectCode();
      }
    }

    const membersArray = [
      {
        userId: userIdStr,
        projectRole: 'Project Owner',
        joinedAt: new Date()
      }
    ];

    if (memberIds && Array.isArray(memberIds)) {
      const uniqueMemberIds = [...new Set(memberIds)].filter(id => id.toString() !== userIdStr);
      for (const mId of uniqueMemberIds) {
        const memberUser = await MongoUser.findById(mId);
        if (memberUser) {
          membersArray.push({
            userId: memberUser._id.toString(),
            projectRole: memberUser.workspaceRole || memberUser.role || 'Developer',
            joinedAt: new Date()
          });
        }
      }
    }

    const mongoProject = await MongoProject.create({
      name: name.trim(),
      description: description.trim(),
      tech_stack: tech_stack || technologyStack || 'React, Node.js, Express, MongoDB',
      technologyStack: technologyStack || tech_stack || 'React, Node.js, Express, MongoDB',
      deadline: deadline || targetDeadline || '',
      targetDeadline: targetDeadline || deadline || '',
      ownerId: userIdStr,
      projectCode,
      status: 'Planning',
      members: membersArray
    });

    const populatedProject = await MongoProject.findById(mongoProject._id)
      .populate('ownerId', 'fullName name email workspaceRole role experienceLevel skills')
      .populate('members.userId', 'fullName name email workspaceRole role experienceLevel skills');

    try {
      const sqlProj = await SqlProject.create({
        name: mongoProject.name,
        description: mongoProject.description,
        tech_stack: mongoProject.tech_stack,
        deadline: mongoProject.deadline,
        status: 'Planning'
      });
      if (req.user.id && typeof req.user.id === 'number') {
        await SqlProjectMember.create({ project_id: sqlProj.id, user_id: req.user.id });
      }
    } catch (e) {
      console.warn('SQLite sync warning:', e.message);
    }

    return res.status(201).json({
      id: populatedProject._id.toString(),
      _id: populatedProject._id.toString(),
      name: populatedProject.name,
      description: populatedProject.description,
      tech_stack: populatedProject.tech_stack,
      technologyStack: populatedProject.technologyStack,
      deadline: populatedProject.deadline,
      projectCode: populatedProject.projectCode,
      ownerId: populatedProject.ownerId,
      status: populatedProject.status,
      members: populatedProject.members,
      createdAt: populatedProject.createdAt
    });
  } catch (error) {
    console.error('Create project error:', error);
    return res.status(500).json({ error: 'Failed to create project.' });
  }
};

// 2. JOIN PROJECT API (Using Project Code e.g. DP-X7K9M2)
const joinProject = async (req, res) => {
  try {
    const { projectCode } = req.body;

    if (!projectCode || !projectCode.trim()) {
      return res.status(400).json({ error: 'Project code is required.' });
    }

    const normalizedCode = projectCode.trim().toUpperCase();
    const userIdStr = getIdStr(req.user);

    const requestingUser = await MongoUser.findById(userIdStr, 'fullName name email workspaceRole role experienceLevel skills');

    const project = await MongoProject.findOne({ projectCode: normalizedCode });

    if (!project) {
      if (normalizedCode.startsWith('DP-')) {
        const draftPayload = {
          id: `draft_${Date.now()}`,
          requestId: `draft_${Date.now()}`,
          projectCode: normalizedCode,
          user: requestingUser,
          userId: userIdStr,
          status: 'pending',
          requestedAt: new Date()
        };

        socketService.emitToCodeRoom(normalizedCode, 'join_request_created', draftPayload);

        return res.status(201).json({
          success: true,
          message: 'Join request sent successfully! The project owner will see your profile live on their screen.',
          request: draftPayload
        });
      }

      return res.status(404).json({ error: 'Invalid project code. No matching project found.' });
    }

    const ownerIdStr = getIdStr(project.ownerId);

    if (ownerIdStr === userIdStr) {
      return res.status(400).json({ error: 'You are the owner of this project.' });
    }

    const isAlreadyMember = project.members.some(m => getIdStr(m.userId) === userIdStr);
    if (isAlreadyMember) {
      return res.status(400).json({ error: 'You are already an approved member of this project.' });
    }

    let joinRequest = await ProjectJoinRequest.findOne({
      projectId: project._id,
      userId: userIdStr
    });

    if (joinRequest) {
      if (joinRequest.status === 'pending') {
        return res.status(400).json({ error: 'You already have a pending join request for this project.' });
      }
      if (joinRequest.status === 'approved') {
        return res.status(400).json({ error: 'You are already an approved member of this project.' });
      }
      if (joinRequest.status === 'rejected') {
        joinRequest.status = 'pending';
        joinRequest.requestedAt = new Date();
        joinRequest.reviewedAt = null;
        joinRequest.reviewedBy = null;
        await joinRequest.save();
      }
    } else {
      joinRequest = await ProjectJoinRequest.create({
        projectId: project._id,
        userId: userIdStr,
        status: 'pending',
        requestedAt: new Date()
      });
    }

    const socketPayload = {
      id: joinRequest._id.toString(),
      requestId: joinRequest._id.toString(),
      projectId: project._id.toString(),
      projectName: project.name,
      projectCode: project.projectCode,
      user: requestingUser,
      userId: userIdStr,
      status: 'pending',
      requestedAt: joinRequest.requestedAt
    };

    socketService.sendUpdateToProject(project._id.toString(), 'join_request_created', socketPayload);
    socketService.sendNotificationToUser(ownerIdStr, socketPayload);
    socketService.emitToCodeRoom(project.projectCode, 'join_request_created', socketPayload);

    return res.status(201).json({
      success: true,
      message: 'Join request sent successfully. Waiting for project owner approval.',
      request: socketPayload
    });
  } catch (error) {
    console.error('Join project error:', error);
    return res.status(500).json({ error: 'Failed to send project join request.' });
  }
};

// 3. GET PROJECTS (Returns projects where user is owner or member)
const getProjects = async (req, res) => {
  try {
    const userIdStr = getIdStr(req.user);

    let mongoProjects = [];
    if (req.user.role === 'Admin') {
      mongoProjects = await MongoProject.find({})
        .populate('ownerId', 'fullName name email workspaceRole role experienceLevel skills')
        .populate('members.userId', 'fullName name email workspaceRole role experienceLevel skills')
        .sort({ createdAt: -1 });
    } else {
      mongoProjects = await MongoProject.find({
        $or: [
          { ownerId: userIdStr },
          { 'members.userId': userIdStr }
        ]
      })
        .populate('ownerId', 'fullName name email workspaceRole role experienceLevel skills')
        .populate('members.userId', 'fullName name email workspaceRole role experienceLevel skills')
        .sort({ createdAt: -1 });
    }

    const formattedProjects = mongoProjects.map(p => ({
      id: p._id.toString(),
      _id: p._id.toString(),
      name: p.name,
      description: p.description,
      tech_stack: p.tech_stack || p.technologyStack,
      technologyStack: p.technologyStack || p.tech_stack,
      deadline: p.deadline || p.targetDeadline,
      projectCode: p.projectCode,
      ownerId: p.ownerId,
      isOwner: getIdStr(p.ownerId) === userIdStr,
      status: p.status,
      members: p.members,
      githubIntegration: p.githubIntegration,
      githubRepository: p.githubRepository,
      createdAt: p.createdAt
    }));

    return res.status(200).json(formattedProjects);
  } catch (error) {
    console.error('Get projects error:', error);
    return res.status(500).json({ error: 'Failed to retrieve projects.' });
  }
};

// 4. GET PROJECT DETAILS & TEAM INFORMATION & TASKS
const getProjectById = async (req, res) => {
  try {
    const { id } = req.params;
    const userIdStr = getIdStr(req.user);

    const project = await MongoProject.findById(id)
      .populate('ownerId', 'fullName name email workspaceRole role experienceLevel skills')
      .populate('members.userId', 'fullName name email workspaceRole role experienceLevel skills');

    if (!project) {
      return res.status(404).json({ error: 'Project not found.' });
    }

    const isOwner = getIdStr(project.ownerId) === userIdStr;

    // Fetch pending join requests if owner
    let pendingRequests = [];
    if (isOwner) {
      const requests = await ProjectJoinRequest.find({
        projectId: project._id,
        status: 'pending'
      }).populate('userId', 'fullName name email workspaceRole role experienceLevel skills');

      pendingRequests = requests.map(r => ({
        id: r._id.toString(),
        requestId: r._id.toString(),
        user: r.userId,
        userId: r.userId ? r.userId._id.toString() : null,
        requestedAt: r.requestedAt,
        status: r.status
      }));
    }

    // Fetch tasks from MongoTask collection
    const mongoTasks = await MongoTask.find({ projectId: project._id })
      .populate('assigned_user_id', 'fullName name email workspaceRole role');

    const formattedTasks = mongoTasks.map(t => ({
      id: t._id.toString(),
      _id: t._id.toString(),
      title: t.title,
      description: t.description,
      module: t.module,
      required_skills: t.required_skills,
      priority: t.priority,
      status: t.status,
      complexity: t.complexity,
      deadline: t.deadline,
      dependencies: t.dependencies,
      assigned_user_id: t.assigned_user_id ? t.assigned_user_id._id.toString() : null,
      Assignee: t.assigned_user_id ? {
        id: t.assigned_user_id._id.toString(),
        name: t.assigned_user_id.fullName || t.assigned_user_id.name,
        email: t.assigned_user_id.email
      } : null
    }));

    return res.status(200).json({
      id: project._id.toString(),
      _id: project._id.toString(),
      name: project.name,
      description: project.description,
      tech_stack: project.tech_stack,
      technologyStack: project.technologyStack,
      deadline: project.deadline,
      projectCode: project.projectCode,
      ownerId: project.ownerId,
      isOwner,
      status: project.status,
      members: project.members,
      pendingRequests,
      Tasks: formattedTasks,
      githubIntegration: project.githubIntegration,
      githubRepository: project.githubRepository,
      createdAt: project.createdAt
    });
  } catch (error) {
    console.error('Get project details error:', error);
    return res.status(500).json({ error: 'Failed to retrieve project details.' });
  }
};

// 5. RESPOND TO JOIN REQUEST (OWNER ONLY APPROVAL / REJECTION)
const respondJoinRequest = async (req, res) => {
  try {
    const { id, requestId } = req.params;
    const { action } = req.body;

    const userIdStr = getIdStr(req.user);
    const project = await MongoProject.findById(id);

    if (!project) {
      return res.status(404).json({ error: 'Project not found.' });
    }

    if (getIdStr(project.ownerId) !== userIdStr && req.user.role !== 'Admin') {
      return res.status(403).json({ error: 'Only the project owner can approve or reject join requests.' });
    }

    const joinRequest = await ProjectJoinRequest.findById(requestId);
    if (!joinRequest || joinRequest.projectId.toString() !== project._id.toString()) {
      return res.status(404).json({ error: 'Join request not found.' });
    }

    const isApprove = action === 'accept' || action === 'approve';

    if (isApprove) {
      joinRequest.status = 'approved';
      joinRequest.reviewedAt = new Date();
      joinRequest.reviewedBy = userIdStr;
      await joinRequest.save();

      const targetUserId = joinRequest.userId.toString();
      const isAlreadyMember = project.members.some(m => getIdStr(m.userId) === targetUserId);

      if (!isAlreadyMember) {
        const targetUser = await MongoUser.findById(targetUserId);
        const userRole = targetUser ? (targetUser.workspaceRole || targetUser.role || 'Developer') : 'Developer';

        project.members.push({
          userId: targetUserId,
          projectRole: userRole,
          joinedAt: new Date()
        });
        await project.save();
      }

      socketService.sendUpdateToProject(project._id.toString(), 'join_request_updated', {
        requestId: joinRequest._id.toString(),
        projectId: project._id.toString(),
        status: 'approved',
        userId: targetUserId
      });

      return res.status(200).json({
        success: true,
        message: 'Join request approved. User added to project team.'
      });
    } else {
      joinRequest.status = 'rejected';
      joinRequest.reviewedAt = new Date();
      joinRequest.reviewedBy = userIdStr;
      await joinRequest.save();

      socketService.sendUpdateToProject(project._id.toString(), 'join_request_updated', {
        requestId: joinRequest._id.toString(),
        projectId: project._id.toString(),
        status: 'rejected',
        userId: joinRequest.userId.toString()
      });

      return res.status(200).json({
        success: true,
        message: 'Join request rejected.'
      });
    }
  } catch (error) {
    console.error('Respond join request error:', error);
    return res.status(500).json({ error: 'Failed to process join request.' });
  }
};

// 6. REMOVE PROJECT MEMBER (OWNER ONLY)
const removeProjectMember = async (req, res) => {
  try {
    const { id, userId } = req.params;
    const currentUserIdStr = getIdStr(req.user);

    const project = await MongoProject.findById(id);
    if (!project) {
      return res.status(404).json({ error: 'Project not found.' });
    }

    if (getIdStr(project.ownerId) !== currentUserIdStr && req.user.role !== 'Admin') {
      return res.status(403).json({ error: 'Only the project owner can remove team members.' });
    }

    if (getIdStr(project.ownerId) === userId) {
      return res.status(400).json({ error: 'Project owner cannot be removed from the project team.' });
    }

    project.members = project.members.filter(m => getIdStr(m.userId) !== userId);
    await project.save();

    socketService.sendUpdateToProject(project._id.toString(), 'member_removed', {
      projectId: project._id.toString(),
      userId
    });

    return res.status(200).json({ success: true, message: 'Team member removed successfully.' });
  } catch (error) {
    console.error('Remove member error:', error);
    return res.status(500).json({ error: 'Failed to remove team member.' });
  }
};

// Update Project
const updateProject = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, tech_stack, deadline, status } = req.body;
    const userIdStr = getIdStr(req.user);

    const project = await MongoProject.findById(id);
    if (!project) {
      return res.status(404).json({ error: 'Project not found.' });
    }

    if (getIdStr(project.ownerId) !== userIdStr && req.user.role !== 'Admin') {
      return res.status(403).json({ error: 'Only the project owner can edit project settings.' });
    }

    if (name) project.name = name.trim();
    if (description) project.description = description.trim();
    if (tech_stack) {
      project.tech_stack = tech_stack;
      project.technologyStack = tech_stack;
    }
    if (deadline) {
      project.deadline = deadline;
      project.targetDeadline = deadline;
    }
    if (status) project.status = status;

    await project.save();
    return res.status(200).json(project);
  } catch (error) {
    console.error('Update project error:', error);
    return res.status(500).json({ error: 'Failed to update project.' });
  }
};

// Delete Project
const deleteProject = async (req, res) => {
  try {
    const { id } = req.params;
    const userIdStr = getIdStr(req.user);

    let deleted = false;

    // 1. Check MongoDB Project
    if (mongoose.isValidObjectId(id)) {
      const mongoProject = await MongoProject.findById(id);
      if (mongoProject) {
        if (getIdStr(mongoProject.ownerId) !== userIdStr && req.user.role !== 'Admin') {
          return res.status(403).json({ error: 'Only the project owner can delete this project.' });
        }

        await MongoProject.findByIdAndDelete(id);
        await ProjectJoinRequest.deleteMany({ projectId: id });
        await MongoTask.deleteMany({ projectId: id });
        deleted = true;
      }
    }

    // 2. Fallback check SQLite Project
    if (!deleted) {
      const sqlProject = await Project.findByPk(id);
      if (sqlProject) {
        if (sqlProject.owner_id && sqlProject.owner_id.toString() !== userIdStr && req.user.role !== 'Admin') {
          return res.status(403).json({ error: 'Only the project owner can delete this project.' });
        }

        await Task.destroy({ where: { project_id: id } });
        await ProjectFile.destroy({ where: { project_id: id } });
        await sqlProject.destroy();
        deleted = true;
      }
    }

    if (!deleted) {
      return res.status(404).json({ error: 'Project not found.' });
    }

    return res.status(200).json({ success: true, message: 'Project and all associated tasks deleted successfully.' });
  } catch (error) {
    console.error('Delete project error:', error);
    return res.status(500).json({ error: error.message || 'Failed to delete project.' });
  }
};

module.exports = {
  getGeneratedCode,
  createProject,
  joinProject,
  getProjects,
  getProjectById,
  respondJoinRequest,
  removeProjectMember,
  updateProject,
  deleteProject
};
