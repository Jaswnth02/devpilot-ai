const { Task, TaskDependency, User, Comment, Issue, Project } = require('../models');

// Helper to recalculate workload for a user
const recalculateUserWorkload = async (userId) => {
  if (!userId) return;
  try {
    const activeTasksCount = await Task.count({
      where: {
        assigned_user_id: userId,
        status: ['To Do', 'In Progress', 'Blocked', 'In Review']
      }
    });
    await User.update(
      { current_workload: activeTasksCount },
      { where: { id: userId } }
    );
  } catch (error) {
    console.error('Error recalculating user workload:', error);
  }
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
      dependencies // array of task IDs
    } = req.body;

    if (!title || !module || !project_id) {
      return res.status(400).json({ error: 'Title, module, and project_id are required.' });
    }

    // Verify project exists
    const project = await Project.findByPk(project_id);
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
      project_id
    });

    // Handle dependencies
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

    res.status(201).json(fullTask);
  } catch (error) {
    console.error('Create task error:', error);
    res.status(500).json({ error: 'Failed to create task.' });
  }
};

const getTaskById = async (req, res) => {
  try {
    const { id } = req.params;
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

    res.status(200).json(task);
  } catch (error) {
    console.error('Get task error:', error);
    res.status(500).json({ error: 'Failed to retrieve task details.' });
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

    const task = await Task.findByPk(id, {
      include: [{ model: Task, as: 'Dependencies', through: { attributes: [] } }]
    });

    if (!task) {
      return res.status(404).json({ error: 'Task not found.' });
    }

    const oldAssignedUserId = task.assigned_user_id;

    // Dependeny logic check: If setting status to 'In Progress' or 'In Review' or 'Completed'
    // check if all dependencies are 'Completed'
    if (status && ['In Progress', 'In Review', 'Completed'].includes(status)) {
      const currentDeps = await TaskDependency.findAll({
        where: { task_id: id }
      });

      if (currentDeps.length > 0) {
        const depIds = currentDeps.map(d => d.depends_on_task_id);
        const incompleteDeps = await Task.findAll({
          where: {
            id: depIds,
            status: ['To Do', 'In Progress', 'In Review', 'Blocked'] // anything not completed
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

    // Update attributes
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

    // Update dependencies if provided
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

    // Recalculate workloads for old and new assignees
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

    res.status(200).json(updatedTask);
  } catch (error) {
    console.error('Update task error:', error);
    res.status(500).json({ error: 'Failed to update task.' });
  }
};

const deleteTask = async (req, res) => {
  try {
    const { id } = req.params;
    const task = await Task.findByPk(id);
    if (!task) {
      return res.status(404).json({ error: 'Task not found.' });
    }

    const assignedUserId = task.assigned_user_id;

    await task.destroy();

    if (assignedUserId) {
      await recalculateUserWorkload(assignedUserId);
    }

    res.status(200).json({ message: 'Task deleted successfully.' });
  } catch (error) {
    console.error('Delete task error:', error);
    res.status(500).json({ error: 'Failed to delete task.' });
  }
};

const addComment = async (req, res) => {
  try {
    const { id } = req.params; // Task ID
    const { content } = req.body;

    if (!content) {
      return res.status(400).json({ error: 'Comment content is required.' });
    }

    const task = await Task.findByPk(id);
    if (!task) {
      return res.status(404).json({ error: 'Task not found.' });
    }

    const comment = await Comment.create({
      task_id: id,
      user_id: req.user.id,
      content
    });

    const fullComment = await Comment.findByPk(comment.id, {
      include: [{ model: User, attributes: ['id', 'name', 'email'] }]
    });

    res.status(201).json(fullComment);
  } catch (error) {
    console.error('Add comment error:', error);
    res.status(500).json({ error: 'Failed to post comment.' });
  }
};

const getComments = async (req, res) => {
  try {
    const { id } = req.params;
    const comments = await Comment.findAll({
      where: { task_id: id },
      include: [{ model: User, attributes: ['id', 'name', 'email'] }],
      order: [['createdAt', 'ASC']]
    });
    res.status(200).json(comments);
  } catch (error) {
    console.error('Get comments error:', error);
    res.status(500).json({ error: 'Failed to load comments.' });
  }
};

const reportIssue = async (req, res) => {
  try {
    const { id } = req.params; // Task ID
    const { description } = req.body;

    if (!description) {
      return res.status(400).json({ error: 'Issue description is required.' });
    }

    const task = await Task.findByPk(id);
    if (!task) {
      return res.status(404).json({ error: 'Task not found.' });
    }

    // Initially save issue. In Phase 9, we'll run Gemini analysis on it.
    const issue = await Issue.create({
      task_id: id,
      reported_by_user_id: req.user.id,
      description,
      status: 'Open'
    });

    // Automatically set task status to 'Blocked' if an issue is reported
    await task.update({ status: 'Blocked' });
    if (task.assigned_user_id) {
      await recalculateUserWorkload(task.assigned_user_id);
    }

    const fullIssue = await Issue.findByPk(issue.id, {
      include: [{ model: User, as: 'Reporter', attributes: ['id', 'name'] }]
    });

    res.status(201).json(fullIssue);
  } catch (error) {
    console.error('Report issue error:', error);
    res.status(500).json({ error: 'Failed to record issue.' });
  }
};

const getIssues = async (req, res) => {
  try {
    const { id } = req.params;
    const issues = await Issue.findAll({
      where: { task_id: id },
      include: [{ model: User, as: 'Reporter', attributes: ['id', 'name'] }],
      order: [['createdAt', 'DESC']]
    });
    res.status(200).json(issues);
  } catch (error) {
    console.error('Get issues error:', error);
    res.status(500).json({ error: 'Failed to retrieve issues.' });
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
