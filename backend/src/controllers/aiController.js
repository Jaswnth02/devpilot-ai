const geminiService = require('../services/geminiService');
const { Project, Task, TaskDependency, User, Skill, Issue, AIAnalysis } = require('../models');

const generatePlan = async (req, res) => {
  try {
    const { name, description } = req.body;
    if (!name || !description) {
      return res.status(400).json({ error: 'Project name and description are required.' });
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

    const project = await Project.findByPk(projectId);
    if (!project) {
      return res.status(404).json({ error: 'Project not found.' });
    }

    // Map to keep track of inserted tasks: Title -> ID
    const titleToIdMap = {};
    const createdTasks = [];

    // First insert all tasks
    for (const taskData of tasks) {
      const task = await Task.create({
        title: taskData.title,
        description: taskData.description,
        module: taskData.module,
        required_skills: taskData.required_skills || [],
        priority: taskData.priority || 'Medium',
        status: 'To Do',
        complexity: taskData.complexity || 'Medium',
        project_id: projectId
      });
      titleToIdMap[task.title] = task.id;
      createdTasks.push({ ...task.get({ plain: true }), tempDeps: taskData.dependencies || [] });
    }

    // Now insert dependencies
    for (const task of createdTasks) {
      if (task.tempDeps && Array.isArray(task.tempDeps)) {
        for (const depTitle of task.tempDeps) {
          const dependsOnTaskId = titleToIdMap[depTitle];
          if (dependsOnTaskId && dependsOnTaskId !== task.id) {
            await TaskDependency.create({
              task_id: task.id,
              depends_on_task_id: dependsOnTaskId
            });
          }
        }
      }
    }

    // Update project status to Active since plan is approved and imported
    await project.update({ status: 'Active' });

    res.status(201).json({ message: 'Project plan imported successfully.', taskCount: createdTasks.length });
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

    const project = await Project.findByPk(projectId, {
      include: [
        {
          model: User,
          through: { attributes: [] },
          include: [{ model: Skill, through: { attributes: [] } }]
        },
        {
          model: Task,
          where: { status: ['To Do', 'Blocked', 'In Progress', 'In Review'] } // Recommend only for incomplete tasks
        }
      ]
    });

    if (!project) {
      return res.status(404).json({ error: 'Project not found, or it has no tasks to assign.' });
    }

    const developers = project.Users || [];
    const tasks = project.Tasks || [];

    if (developers.length === 0) {
      return res.status(400).json({ error: 'Project has no assigned team members to allocate tasks to.' });
    }

    if (tasks.length === 0) {
      return res.status(400).json({ error: 'Project has no active tasks to recommend assignments for.' });
    }

    const recommendations = await geminiService.recommendAssignments(tasks, developers);
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

    const project = await Project.findByPk(projectId, {
      include: [
        {
          model: Task
        },
        {
          model: User,
          through: { attributes: [] },
          attributes: ['id', 'name', 'role', 'current_workload']
        }
      ]
    });

    if (!project) {
      return res.status(404).json({ error: 'Project not found.' });
    }

    const tasks = project.Tasks || [];
    const totalCount = tasks.length;
    const completedCount = tasks.filter(t => t.status === 'Completed').length;
    const inProgressCount = tasks.filter(t => t.status === 'In Progress').length;
    const blockedCount = tasks.filter(t => t.status === 'Blocked').length;
    const todoCount = tasks.filter(t => t.status === 'To Do').length;
    
    // Calculate overdue: anything not completed and past its deadline
    const now = new Date().toISOString().split('T')[0];
    const overdueCount = tasks.filter(t => t.status !== 'Completed' && t.deadline && t.deadline < now).length;

    // Get count of open issues on project tasks
    const taskIds = tasks.map(t => t.id);
    const openIssuesCount = await Issue.count({
      where: {
        task_id: taskIds,
        status: 'Open'
      }
    });

    const projectSummary = {
      projectId: project.id,
      name: project.name,
      description: project.description,
      metrics: {
        totalTasks: totalCount,
        completed: completedCount,
        inProgress: inProgressCount,
        todo: todoCount,
        blocked: blockedCount,
        overdue: overdueCount,
        openIssues: openIssuesCount
      },
      team: (project.Users || []).map(u => ({ name: u.name, role: u.role, workload: u.current_workload }))
    };

    const analysis = await geminiService.analyzeProjectRisk(projectSummary);

    const record = await AIAnalysis.create({
      project_id: projectId,
      risk_level: analysis.risk_level,
      reason: analysis.reason,
      recommendation: analysis.recommendation
    });

    res.status(201).json(record);
  } catch (error) {
    console.error('AI project analysis error:', error);
    res.status(500).json({ error: 'Failed to analyze project risk.' });
  }
};

module.exports = {
  generatePlan,
  importPlan,
  recommendAssignment,
  analyzeTaskIssue,
  analyzeProject
};
