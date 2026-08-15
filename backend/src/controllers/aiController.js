const mongoose = require('mongoose');
const geminiService = require('../services/geminiService');
const MongoProject = require('../models/mongo/Project');
const MongoTask = require('../models/mongo/Task');
const { Project, Task, TaskDependency, User, Skill, Issue, AIAnalysis } = require('../models');

const getIdStr = (userObj) => {
  if (!userObj) return '';
  return (userObj._id || userObj.id || userObj).toString();
};

const generatePlan = async (req, res) => {
  try {
    const { projectId, name, description } = req.body;

    if (!name || !description) {
      return res.status(400).json({ error: 'Project name and description are required.' });
    }

    // OWNER AUTHORIZATION CHECK IF PROJECT ID IS SUPPLIED
    if (projectId) {
      const project = await MongoProject.findById(projectId);
      if (project) {
        const ownerIdStr = getIdStr(project.ownerId);
        const currentUserIdStr = getIdStr(req.user);

        if (ownerIdStr !== currentUserIdStr && req.user.role !== 'Admin') {
          return res.status(403).json({
            error: 'You do not have permission to generate the AI development plan. Only the project owner can generate the plan.'
          });
        }
      }
    }

    const plan = await geminiService.generatePlan(name, description);
    res.status(200).json(plan);
  } catch (error) {
    console.error('AI plan generation error:', error);
    res.status(500).json({ error: 'Failed to generate project plan.' });
  }
};

const importPlan = async (req, res) => {
  try {
    const { projectId, tasks } = req.body;

    if (!projectId || !tasks || !Array.isArray(tasks)) {
      return res.status(400).json({ error: 'Project ID and tasks array are required.' });
    }

    const userIdStr = getIdStr(req.user);
    const mongoProject = await MongoProject.findById(projectId);

    if (!mongoProject) {
      return res.status(404).json({ error: 'Project not found.' });
    }

    const ownerIdStr = getIdStr(mongoProject.ownerId);
    if (ownerIdStr !== userIdStr && req.user.role !== 'Admin') {
      return res.status(403).json({
        error: 'You do not have permission to import tasks into this project. Only the project owner can import plans.'
      });
    }

    mongoProject.status = 'Active';
    await mongoProject.save();

    // Delete old draft tasks if re-importing plan
    await MongoTask.deleteMany({ projectId: mongoProject._id });

    const createdTasks = [];
    for (const taskData of tasks) {
      const task = await MongoTask.create({
        title: taskData.title,
        description: taskData.description,
        module: taskData.module,
        required_skills: taskData.required_skills || [],
        priority: taskData.priority || 'Medium',
        status: 'To Do',
        complexity: taskData.complexity || 'Medium',
        projectId: mongoProject._id,
        dependencies: taskData.dependencies || []
      });

      createdTasks.push({
        id: task._id.toString(),
        _id: task._id.toString(),
        title: task.title,
        description: task.description,
        module: task.module,
        required_skills: task.required_skills,
        priority: task.priority,
        status: task.status,
        complexity: task.complexity,
        dependencies: task.dependencies,
        projectId: mongoProject._id.toString()
      });
    }

    res.status(201).json({ message: 'Project plan imported successfully.', taskCount: createdTasks.length, tasks: createdTasks });
  } catch (error) {
    console.error('Import plan error:', error);
    res.status(500).json({ error: 'Failed to import project plan.' });
  }
};

const recommendAssignment = async (req, res) => {
  try {
    const { projectId } = req.body;

    if (!projectId) {
      return res.status(400).json({ error: 'Project ID is required.' });
    }

    let project = null;
    let tasks = [];
    let developers = [];

    if (mongoose.isValidObjectId(projectId)) {
      project = await MongoProject.findById(projectId)
        .populate('members.userId', 'fullName name email workspaceRole role experienceLevel skills');
      if (project) {
        tasks = await MongoTask.find({ projectId, status: { $ne: 'Completed' } });
        developers = (project.members || []).map(m => m.userId).filter(Boolean);
      }
    }

    if (!project) {
      const sqlProject = await Project.findByPk(projectId, {
        include: [
          { model: Task, where: { status: { [require('sequelize').Op.ne]: 'Completed' } }, required: false },
          { model: User, as: 'members', include: [{ model: Skill }] }
        ]
      });
      if (sqlProject) {
        project = sqlProject;
        tasks = sqlProject.Tasks || [];
        developers = sqlProject.members || [];
      }
    }

    if (!project) {
      return res.status(404).json({ error: 'Project not found.' });
    }

    if (developers.length === 0) {
      return res.status(400).json({ error: 'Project has no assigned team members to allocate tasks to.' });
    }

    if (tasks.length === 0) {
      return res.status(400).json({ error: 'Project has no active tasks to recommend assignments for.' });
    }

    const formattedTasks = tasks.map(t => ({
      id: (t._id || t.id).toString(),
      title: t.title,
      description: t.description,
      module: t.module,
      required_skills: t.required_skills || [],
      priority: t.priority,
      complexity: t.complexity
    }));

    const formattedDevs = developers.map(d => ({
      id: (d._id || d.id).toString(),
      name: d.fullName || d.name,
      role: d.workspaceRole || d.role,
      experience_level: d.experienceLevel || d.experience_level || 'Mid',
      Skills: Array.isArray(d.skills) ? d.skills.map(s => ({ name: typeof s === 'string' ? s : s.name })) : (d.Skills || [])
    }));

    const recommendations = await geminiService.recommendAssignments(formattedTasks, formattedDevs);
    res.status(200).json(recommendations);
  } catch (error) {
    console.error('AI assignment recommendation error:', error);
    res.status(500).json({ error: 'Failed to recommend assignments.' });
  }
};

const analyzeTaskIssue = async (req, res) => {
  try {
    const { issueId } = req.params;

    const issue = await Issue.findByPk(issueId, {
      include: [
        {
          model: Task,
          attributes: ['id', 'title', 'description', 'module', 'required_skills', 'priority', 'complexity']
        }
      ]
    });

    if (!issue) {
      return res.status(404).json({ error: 'Issue not found.' });
    }

    const analysis = await geminiService.analyzeIssue(issue.description, issue.Task);

    await issue.update({
      ai_category: analysis.ai_category,
      ai_priority: analysis.ai_priority,
      ai_causes: analysis.ai_causes,
      ai_suggestions: analysis.ai_suggestions
    });

    res.status(200).json(issue);
  } catch (error) {
    console.error('AI issue analysis error:', error);
    res.status(500).json({ error: 'Failed to analyze issue.' });
  }
};

const analyzeProject = async (req, res) => {
  try {
    const { projectId } = req.params;

    if (!projectId || projectId === 'undefined' || projectId === 'null') {
      return res.status(400).json({ error: 'Valid Project ID is required.' });
    }

    let project = null;
    let tasks = [];

    // Check MongoDB Project
    if (mongoose.isValidObjectId(projectId)) {
      project = await MongoProject.findById(projectId)
        .populate('members.userId', 'fullName name email workspaceRole role experienceLevel skills');
      if (project) {
        tasks = await MongoTask.find({ projectId });
      }
    }

    // Fallback to SQLite Project if not in Mongo
    if (!project) {
      const sqlProject = await Project.findByPk(projectId, {
        include: [{ model: Task }]
      });
      if (sqlProject) {
        project = sqlProject;
        tasks = sqlProject.Tasks || [];
      }
    }

    if (!project) {
      return res.status(404).json({ error: 'Project not found.' });
    }

    const totalCount = tasks.length;
    const completedCount = tasks.filter(t => t.status === 'Completed').length;
    const inProgressCount = tasks.filter(t => t.status === 'In Progress').length;
    const blockedCount = tasks.filter(t => t.status === 'Blocked').length;
    const todoCount = tasks.filter(t => t.status === 'To Do').length;

    const now = new Date().toISOString().split('T')[0];
    const overdueCount = tasks.filter(t => t.status !== 'Completed' && t.deadline && t.deadline < now).length;

    const projectSummary = {
      projectId: (project._id || project.id).toString(),
      name: project.name,
      description: project.description,
      metrics: {
        totalTasks: totalCount,
        completed: completedCount,
        inProgress: inProgressCount,
        todo: todoCount,
        blocked: blockedCount,
        overdue: overdueCount,
        openIssues: 0
      },
      team: (project.members || []).map(m => ({
        name: m.userId?.fullName || m.userId?.name || m.name || 'Member',
        role: m.projectRole || m.role || 'Developer',
        workload: 0
      }))
    };

    const analysis = await geminiService.analyzeProjectRisk(projectSummary);

    const responsePayload = {
      id: Date.now(),
      project_id: (project._id || project.id).toString(),
      risk_level: analysis.risk_level || 'Low',
      reason: analysis.reason || 'Normal project operations and balanced workloads.',
      recommendation: analysis.recommendation || 'Continue following current sprint priorities.',
      createdAt: new Date().toISOString()
    };

    try {
      if (typeof AIAnalysis !== 'undefined' && AIAnalysis.create) {
        await AIAnalysis.create({
          project_id: responsePayload.project_id,
          risk_level: responsePayload.risk_level,
          reason: responsePayload.reason,
          recommendation: responsePayload.recommendation
        });
      }
    } catch (dbErr) {
      console.warn('AIAnalysis table persistence note:', dbErr.message);
    }

    return res.status(200).json(responsePayload);
  } catch (error) {
    console.error('AI project analysis error:', error);
    return res.status(500).json({ error: error.message || 'Failed to analyze project risk.' });
  }
};

module.exports = {
  generatePlan,
  importPlan,
  recommendAssignment,
  analyzeTaskIssue,
  analyzeProject
};
