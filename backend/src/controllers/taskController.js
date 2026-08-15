const mongoose = require('mongoose');
const MongoTask = require('../models/mongo/Task');
const MongoProject = require('../models/mongo/Project');
const MongoUser = require('../models/mongo/User');
const { Task, TaskDependency, User, Comment, Issue, Project } = require('../models');

// Helper to recalculate workload for a user
const recalculateUserWorkload = async (userId) => {
  if (!userId) return;
  try {
    const userIdStr = userId.toString();
    if (mongoose.isValidObjectId(userIdStr)) {
      const activeTasksCount = await MongoTask.countDocuments({
        assigned_user_id: userId,
        status: { $in: ['To Do', 'In Progress', 'Blocked', 'In Review'] }
      });
      await MongoUser.findByIdAndUpdate(userId, { current_workload: activeTasksCount });
    }

    const activeSqlTasksCount = await Task.count({
      where: {
        assigned_user_id: userId,
        status: ['To Do', 'In Progress', 'Blocked', 'In Review']
      }
    });
    await User.update(
      { current_workload: activeSqlTasksCount },
      { where: { id: userId } }
    );
  } catch (error) {
    console.error('Error recalculating user workload:', error);
  }
};

const formatMongoTask = (task) => {
  if (!task) return null;
  const doc = task.toObject ? task.toObject() : task;
  return {
    ...doc,
    id: doc._id ? doc._id.toString() : doc.id,
    _id: doc._id ? doc._id.toString() : doc.id,
    projectId: doc.projectId ? doc.projectId.toString() : doc.project_id,
    project_id: doc.projectId ? doc.projectId.toString() : doc.project_id,
    assigned_user_id: doc.assigned_user_id?._id ? doc.assigned_user_id._id.toString() : (doc.assigned_user_id ? doc.assigned_user_id.toString() : null),
    Assignee: doc.assigned_user_id && typeof doc.assigned_user_id === 'object' && doc.assigned_user_id._id ? {
      id: doc.assigned_user_id._id.toString(),
      _id: doc.assigned_user_id._id.toString(),
      name: doc.assigned_user_id.fullName || doc.assigned_user_id.name,
      email: doc.assigned_user_id.email
    } : null,
    Dependencies: Array.isArray(doc.dependencies) ? doc.dependencies.map(d => ({ id: d, title: `Task #${d}` })) : [],
    Comments: (doc.comments || []).map(c => ({
      id: c._id ? c._id.toString() : c.id,
      content: c.content,
      createdAt: c.createdAt,
      User: c.User || { id: c.user_id, name: c.userName || 'Team Member', email: c.userEmail }
    })),
    Issues: (doc.issues || []).map(i => ({
      id: i._id ? i._id.toString() : i.id,
      description: i.description,
      status: i.status || 'Open',
      ai_category: i.ai_category,
      ai_priority: i.ai_priority,
      ai_causes: i.ai_causes,
      ai_suggestions: i.ai_suggestions,
      createdAt: i.createdAt,
      Reporter: i.Reporter || { id: i.reported_by_user_id, name: i.reporterName || 'Developer' }
    }))
  };
};

const createTask = async (req, res) => {
  try {
    const {
      title,
      description,
      module,
      required_skills,
      priority,
      status,
      deadline,
      complexity,
      assigned_user_id,
      project_id,
      projectId,
      dependencies
    } = req.body;

    const targetProjectId = project_id || projectId;
    if (!title || !module || !targetProjectId) {
      return res.status(400).json({ error: 'Title, module, and project ID are required.' });
    }

    // Check MongoDB Project
    if (mongoose.isValidObjectId(targetProjectId)) {
      const mongoProject = await MongoProject.findById(targetProjectId);
      if (mongoProject) {
        const mongoTask = await MongoTask.create({
          title,
          description: description || '',
          module,
          required_skills: Array.isArray(required_skills) ? required_skills : (required_skills ? required_skills.split(',').map(s => s.trim()) : []),
          priority: priority || 'Medium',
          status: status || 'To Do',
          deadline: deadline || null,
          complexity: complexity || 'Medium',
          assigned_user_id: assigned_user_id && mongoose.isValidObjectId(assigned_user_id) ? assigned_user_id : null,
          projectId: mongoProject._id,
          project_id: mongoProject._id.toString(),
          dependencies: Array.isArray(dependencies) ? dependencies : []
        });

        if (assigned_user_id) {
          await recalculateUserWorkload(assigned_user_id);
        }

        const populatedTask = await MongoTask.findById(mongoTask._id)
          .populate('assigned_user_id', 'fullName name email workspaceRole role');

        return res.status(201).json(formatMongoTask(populatedTask));
      }
    }

    // Fallback to SQLite Project
    const project = await Project.findByPk(targetProjectId);
    if (!project) {
      return res.status(404).json({ error: 'Project not found.' });
    }

    const task = await Task.create({
      title,
      description,
      module,
      required_skills: required_skills || [],
      priority: priority || 'Medium',
      status: status || 'To Do',
      deadline,
      complexity: complexity || 'Medium',
      assigned_user_id: assigned_user_id || null,
      project_id: targetProjectId
    });

    if (dependencies && Array.isArray(dependencies)) {
      for (const depId of dependencies) {
        const depTask = await Task.findByPk(depId);
        if (depTask) {
          await TaskDependency.create({
            task_id: task.id,
            depends_on_task_id: depId
          });
        }
      }
    }

    if (assigned_user_id) {
      await recalculateUserWorkload(assigned_user_id);
    }

    const fullTask = await Task.findByPk(task.id, {
      include: [
        { model: User, as: 'Assignee', attributes: ['id', 'name', 'email'] },
        { model: Task, as: 'Dependencies', through: { attributes: [] } }
      ]
    });

    return res.status(201).json(fullTask);
  } catch (error) {
    console.error('Create task error:', error);
    return res.status(500).json({ error: error.message || 'Failed to create task.' });
  }
};

const getTaskById = async (req, res) => {
  try {
    const { id } = req.params;

    // 1. Check MongoDB Task
    if (mongoose.isValidObjectId(id)) {
      const mongoTask = await MongoTask.findById(id)
        .populate('assigned_user_id', 'fullName name email workspaceRole role');
      if (mongoTask) {
        return res.status(200).json(formatMongoTask(mongoTask));
      }
    }

    // 2. Check SQLite Task
    const task = await Task.findByPk(id, {
      include: [
        { model: User, as: 'Assignee', attributes: ['id', 'name', 'email'] },
        { model: Task, as: 'Dependencies', through: { attributes: [] } },
        { model: Task, as: 'DependentTasks', through: { attributes: [] } },
        { model: Comment, include: [{ model: User, attributes: ['id', 'name'] }] },
        { model: Issue, include: [{ model: User, as: 'Reporter', attributes: ['id', 'name'] }] }
      ]
    });

    if (!task) {
      return res.status(404).json({ error: 'Task not found.' });
    }

    return res.status(200).json(task);
  } catch (error) {
    console.error('Get task error:', error);
    return res.status(500).json({ error: 'Failed to retrieve task details.' });
  }
};

const updateTask = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      title,
      description,
      module,
      required_skills,
      priority,
      status,
      deadline,
      complexity,
      assigned_user_id,
      dependencies
    } = req.body;

    // 1. Update in MongoDB
    if (mongoose.isValidObjectId(id)) {
      const mongoTask = await MongoTask.findById(id);
      if (mongoTask) {
        const oldAssignedUserId = mongoTask.assigned_user_id ? mongoTask.assigned_user_id.toString() : null;

        // Dependency check: If setting status to 'In Progress', 'In Review', or 'Completed'
        if (status && ['In Progress', 'In Review', 'Completed'].includes(status)) {
          if (mongoTask.dependencies && mongoTask.dependencies.length > 0) {
            const incompleteDeps = await MongoTask.find({
              _id: { $in: mongoTask.dependencies.filter(d => mongoose.isValidObjectId(d)) },
              status: { $ne: 'Completed' }
            });
            if (incompleteDeps.length > 0) {
              const names = incompleteDeps.map(t => `"${t.title}"`).join(', ');
              return res.status(400).json({
                error: `Cannot change status to "${status}". Upstream dependencies must be completed first: ${names}`
              });
            }
          }
        }

        if (title !== undefined) mongoTask.title = title;
        if (description !== undefined) mongoTask.description = description;
        if (module !== undefined) mongoTask.module = module;
        if (required_skills !== undefined) mongoTask.required_skills = required_skills;
        if (priority !== undefined) mongoTask.priority = priority;
        if (status !== undefined) mongoTask.status = status;
        if (deadline !== undefined) mongoTask.deadline = deadline;
        if (complexity !== undefined) mongoTask.complexity = complexity;
        if (assigned_user_id !== undefined) {
          mongoTask.assigned_user_id = assigned_user_id && mongoose.isValidObjectId(assigned_user_id) ? assigned_user_id : null;
        }
        if (dependencies !== undefined && Array.isArray(dependencies)) {
          mongoTask.dependencies = dependencies;
        }

        await mongoTask.save();

        if (oldAssignedUserId) {
          await recalculateUserWorkload(oldAssignedUserId);
        }
        if (mongoTask.assigned_user_id) {
          await recalculateUserWorkload(mongoTask.assigned_user_id);
        }

        const updated = await MongoTask.findById(id)
          .populate('assigned_user_id', 'fullName name email workspaceRole role');
        return res.status(200).json(formatMongoTask(updated));
      }
    }

    // 2. Update in SQLite
    const task = await Task.findByPk(id, {
      include: [{ model: Task, as: 'Dependencies', through: { attributes: [] } }]
    });

    if (!task) {
      return res.status(404).json({ error: 'Task not found.' });
    }

    const oldAssignedUserId = task.assigned_user_id;

    if (status && ['In Progress', 'In Review', 'Completed'].includes(status)) {
      const currentDeps = await TaskDependency.findAll({
        where: { task_id: id }
      });

      if (currentDeps.length > 0) {
        const depIds = currentDeps.map(d => d.depends_on_task_id);
        const incompleteDeps = await Task.findAll({
          where: {
            id: depIds,
            status: ['To Do', 'In Progress', 'In Review', 'Blocked']
          }
        });

        if (incompleteDeps.length > 0) {
          const names = incompleteDeps.map(t => `"${t.title}"`).join(', ');
          return res.status(400).json({
            error: `Cannot change status to "${status}". Upstream dependencies must be completed first: ${names}`
          });
        }
      }
    }

    await task.update({
      title: title || task.title,
      description: description !== undefined ? description : task.description,
      module: module || task.module,
      required_skills: required_skills || task.required_skills,
      priority: priority || task.priority,
      status: status || task.status,
      deadline: deadline !== undefined ? deadline : task.deadline,
      complexity: complexity || task.complexity,
      assigned_user_id: assigned_user_id !== undefined ? assigned_user_id : task.assigned_user_id
    });

    if (dependencies && Array.isArray(dependencies)) {
      await TaskDependency.destroy({ where: { task_id: id } });
      for (const depId of dependencies) {
        if (depId !== task.id) {
          const depTask = await Task.findByPk(depId);
          if (depTask) {
            await TaskDependency.create({
              task_id: id,
              depends_on_task_id: depId
            });
          }
        }
      }
    }

    if (oldAssignedUserId) {
      await recalculateUserWorkload(oldAssignedUserId);
    }
    if (assigned_user_id && assigned_user_id !== oldAssignedUserId) {
      await recalculateUserWorkload(assigned_user_id);
    } else if (task.assigned_user_id) {
      await recalculateUserWorkload(task.assigned_user_id);
    }

    const updatedTask = await Task.findByPk(id, {
      include: [
        { model: User, as: 'Assignee', attributes: ['id', 'name', 'email'] },
        { model: Task, as: 'Dependencies', through: { attributes: [] } }
      ]
    });

    return res.status(200).json(updatedTask);
  } catch (error) {
    console.error('Update task error:', error);
    return res.status(500).json({ error: error.message || 'Failed to update task.' });
  }
};

const deleteTask = async (req, res) => {
  try {
    const { id } = req.params;

    if (mongoose.isValidObjectId(id)) {
      const mongoTask = await MongoTask.findById(id);
      if (mongoTask) {
        const assignedUserId = mongoTask.assigned_user_id;
        await MongoTask.deleteOne({ _id: id });
        if (assignedUserId) {
          await recalculateUserWorkload(assignedUserId);
        }
        return res.status(200).json({ message: 'Task deleted successfully.' });
      }
    }

    const task = await Task.findByPk(id);
    if (!task) {
      return res.status(404).json({ error: 'Task not found.' });
    }

    const assignedUserId = task.assigned_user_id;
    await task.destroy();

    if (assignedUserId) {
      await recalculateUserWorkload(assignedUserId);
    }

    return res.status(200).json({ message: 'Task deleted successfully.' });
  } catch (error) {
    console.error('Delete task error:', error);
    return res.status(500).json({ error: 'Failed to delete task.' });
  }
};

const addComment = async (req, res) => {
  try {
    const { id } = req.params;
    const { content } = req.body;

    if (!content) {
      return res.status(400).json({ error: 'Comment content is required.' });
    }

    const currentUserId = req.user?.id || req.user?._id;
    const currentUserName = req.user?.fullName || req.user?.name || 'Developer';
    const currentUserEmail = req.user?.email || '';

    // 1. Check MongoTask
    if (mongoose.isValidObjectId(id)) {
      const mongoTask = await MongoTask.findById(id);
      if (mongoTask) {
        const newComment = {
          user_id: currentUserId ? currentUserId.toString() : null,
          userName: currentUserName,
          userEmail: currentUserEmail,
          content,
          createdAt: new Date(),
          User: {
            id: currentUserId ? currentUserId.toString() : null,
            name: currentUserName,
            email: currentUserEmail
          }
        };

        mongoTask.comments.push(newComment);
        await mongoTask.save();

        const createdComment = mongoTask.comments[mongoTask.comments.length - 1];
        return res.status(201).json({
          id: createdComment._id ? createdComment._id.toString() : createdComment.id,
          task_id: id,
          content: createdComment.content,
          createdAt: createdComment.createdAt,
          User: createdComment.User
        });
      }
    }

    // 2. Check SQLite Task
    const task = await Task.findByPk(id);
    if (!task) {
      return res.status(404).json({ error: 'Task not found.' });
    }

    const comment = await Comment.create({
      task_id: id,
      user_id: currentUserId,
      content
    });

    const fullComment = await Comment.findByPk(comment.id, {
      include: [{ model: User, attributes: ['id', 'name', 'email'] }]
    });

    return res.status(201).json(fullComment);
  } catch (error) {
    console.error('Add comment error:', error);
    return res.status(500).json({ error: error.message || 'Failed to post comment.' });
  }
};

const getComments = async (req, res) => {
  try {
    const { id } = req.params;

    if (mongoose.isValidObjectId(id)) {
      const mongoTask = await MongoTask.findById(id);
      if (mongoTask) {
        const comments = (mongoTask.comments || []).map(c => ({
          id: c._id ? c._id.toString() : c.id,
          task_id: id,
          content: c.content,
          createdAt: c.createdAt,
          User: c.User || { id: c.user_id, name: c.userName || 'Team Member', email: c.userEmail }
        }));
        return res.status(200).json(comments);
      }
    }

    const comments = await Comment.findAll({
      where: { task_id: id },
      include: [{ model: User, attributes: ['id', 'name', 'email'] }],
      order: [['createdAt', 'ASC']]
    });
    return res.status(200).json(comments);
  } catch (error) {
    console.error('Get comments error:', error);
    return res.status(500).json({ error: 'Failed to load comments.' });
  }
};

const reportIssue = async (req, res) => {
  try {
    const { id } = req.params;
    const { description } = req.body;

    if (!description) {
      return res.status(400).json({ error: 'Issue description is required.' });
    }

    const currentUserId = req.user?.id || req.user?._id;
    const currentUserName = req.user?.fullName || req.user?.name || 'Developer';

    // 1. Check MongoTask
    if (mongoose.isValidObjectId(id)) {
      const mongoTask = await MongoTask.findById(id);
      if (mongoTask) {
        const newIssue = {
          reported_by_user_id: currentUserId ? currentUserId.toString() : null,
          reporterName: currentUserName,
          description,
          status: 'Open',
          createdAt: new Date(),
          Reporter: {
            id: currentUserId ? currentUserId.toString() : null,
            name: currentUserName
          }
        };

        mongoTask.issues.unshift(newIssue);
        mongoTask.status = 'Blocked';
        await mongoTask.save();

        if (mongoTask.assigned_user_id) {
          await recalculateUserWorkload(mongoTask.assigned_user_id);
        }

        const createdIssue = mongoTask.issues[0];
        return res.status(201).json({
          id: createdIssue._id ? createdIssue._id.toString() : createdIssue.id,
          task_id: id,
          description: createdIssue.description,
          status: createdIssue.status,
          createdAt: createdIssue.createdAt,
          Reporter: createdIssue.Reporter
        });
      }
    }

    // 2. Check SQLite Task
    const task = await Task.findByPk(id);
    if (!task) {
      return res.status(404).json({ error: 'Task not found.' });
    }

    const issue = await Issue.create({
      task_id: id,
      reported_by_user_id: currentUserId,
      description,
      status: 'Open'
    });

    await task.update({ status: 'Blocked' });
    if (task.assigned_user_id) {
      await recalculateUserWorkload(task.assigned_user_id);
    }

    const fullIssue = await Issue.findByPk(issue.id, {
      include: [{ model: User, as: 'Reporter', attributes: ['id', 'name'] }]
    });

    return res.status(201).json(fullIssue);
  } catch (error) {
    console.error('Report issue error:', error);
    return res.status(500).json({ error: error.message || 'Failed to record issue.' });
  }
};

const getIssues = async (req, res) => {
  try {
    const { id } = req.params;

    if (mongoose.isValidObjectId(id)) {
      const mongoTask = await MongoTask.findById(id);
      if (mongoTask) {
        const issues = (mongoTask.issues || []).map(i => ({
          id: i._id ? i._id.toString() : i.id,
          task_id: id,
          description: i.description,
          status: i.status || 'Open',
          ai_category: i.ai_category,
          ai_priority: i.ai_priority,
          ai_causes: i.ai_causes,
          ai_suggestions: i.ai_suggestions,
          createdAt: i.createdAt,
          Reporter: i.Reporter || { id: i.reported_by_user_id, name: i.reporterName || 'Developer' }
        }));
        return res.status(200).json(issues);
      }
    }

    const issues = await Issue.findAll({
      where: { task_id: id },
      include: [{ model: User, as: 'Reporter', attributes: ['id', 'name'] }],
      order: [['createdAt', 'DESC']]
    });
    return res.status(200).json(issues);
  } catch (error) {
    console.error('Get issues error:', error);
    return res.status(500).json({ error: 'Failed to retrieve issues.' });
  }
};

module.exports = {
  createTask,
  getTaskById,
  updateTask,
  deleteTask,
  addComment,
  getComments,
  reportIssue,
  getIssues
};
