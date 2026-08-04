const { Project, ProjectMember, User, Skill, Task, GitHubRepository } = require('../models');

const createProject = async (req, res) => {
  try {
    const { name, description, tech_stack, deadline, memberIds } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'Project name is required.' });
    }

    const project = await Project.create({
      name,
      description,
      tech_stack,
      deadline,
      status: 'Planning'
    });

    // Auto-add the creator as a project member
    await ProjectMember.create({
      project_id: project.id,
      user_id: req.user.id
    });

    // Add other members if provided
    if (memberIds && Array.isArray(memberIds)) {
      const uniqueIds = [...new Set(memberIds)].filter(id => id !== req.user.id);
      for (const userId of uniqueIds) {
        const userExists = await User.findByPk(userId);
        if (userExists) {
          await ProjectMember.create({
            project_id: project.id,
            user_id: userId
          });
        }
      }
    }

    // Retrieve full project with members
    const fullProject = await Project.findByPk(project.id, {
      include: [
        {
          model: User,
          through: { attributes: [] },
          attributes: { exclude: ['password'] }
        }
      ]
    });

    res.status(201).json(fullProject);
  } catch (error) {
    console.error('Create project error:', error);
    res.status(500).json({ error: 'Failed to create project.' });
  }
};

const getProjects = async (req, res) => {
  try {
    // Developers should see projects they are members of. Owners/Admins see all (or those they belong to, let's return projects they belong to, or if Admin, return all)
    let projects;
    if (req.user.role === 'Admin') {
      projects = await Project.findAll({
        include: [
          {
            model: User,
            through: { attributes: [] },
            attributes: { exclude: ['password'] }
          }
        ]
      });
    } else {
      projects = await Project.findAll({
        include: [
          {
            model: User,
            through: { attributes: [] },
            where: { id: req.user.id },
            attributes: []
          },
          {
            model: User,
            as: 'Users',
            through: { attributes: [] },
            attributes: { exclude: ['password'] }
          }
        ]
      });
    }
    res.status(200).json(projects);
  } catch (error) {
    console.error('Get projects error:', error);
    res.status(500).json({ error: 'Failed to retrieve projects.' });
  }
};

const getProjectById = async (req, res) => {
  try {
    const { id } = req.params;
    const project = await Project.findByPk(id, {
      include: [
        {
          model: User,
          through: { attributes: [] },
          attributes: { exclude: ['password'] },
          include: [{ model: Skill, through: { attributes: [] } }]
        },
        {
          model: Task,
          include: [{ model: User, as: 'Assignee', attributes: ['id', 'name', 'email'] }]
        },
        {
          model: GitHubRepository
        }
      ]
    });

    if (!project) {
      return res.status(404).json({ error: 'Project not found.' });
    }

    res.status(200).json(project);
  } catch (error) {
    console.error('Get project error:', error);
    res.status(500).json({ error: 'Failed to retrieve project details.' });
  }
};

const updateProject = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, tech_stack, deadline, status } = req.body;

    const project = await Project.findByPk(id);
    if (!project) {
      return res.status(404).json({ error: 'Project not found.' });
    }

    await project.update({
      name: name || project.name,
      description: description !== undefined ? description : project.description,
      tech_stack: tech_stack !== undefined ? tech_stack : project.tech_stack,
      deadline: deadline !== undefined ? deadline : project.deadline,
      status: status || project.status
    });

    const updatedProject = await Project.findByPk(id, {
      include: [{ model: User, through: { attributes: [] }, attributes: { exclude: ['password'] } }]
    });

    res.status(200).json(updatedProject);
  } catch (error) {
    console.error('Update project error:', error);
    res.status(500).json({ error: 'Failed to update project.' });
  }
};

const deleteProject = async (req, res) => {
  try {
    const { id } = req.params;
    const project = await Project.findByPk(id);
    if (!project) {
      return res.status(404).json({ error: 'Project not found.' });
    }

    await project.destroy();
    res.status(200).json({ message: 'Project deleted successfully.' });
  } catch (error) {
    console.error('Delete project error:', error);
    res.status(500).json({ error: 'Failed to delete project.' });
  }
};

const addProjectMember = async (req, res) => {
  try {
    const { id } = req.params; // Project ID
    const { userId } = req.body;

    const project = await Project.findByPk(id);
    if (!project) {
      return res.status(404).json({ error: 'Project not found.' });
    }

    const user = await User.findByPk(userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found.' });
    }

    const existingMember = await ProjectMember.findOne({
      where: { project_id: id, user_id: userId }
    });

    if (existingMember) {
      return res.status(400).json({ error: 'User is already a member of this project.' });
    }

    await ProjectMember.create({
      project_id: id,
      user_id: userId
    });

    const members = await Project.findByPk(id, {
      include: [{ model: User, through: { attributes: [] }, attributes: { exclude: ['password'] } }]
    });

    res.status(200).json(members.Users);
  } catch (error) {
    console.error('Add project member error:', error);
    res.status(500).json({ error: 'Failed to add project member.' });
  }
};

const removeProjectMember = async (req, res) => {
  try {
    const { id, userId } = req.params;

    const project = await Project.findByPk(id);
    if (!project) {
      return res.status(404).json({ error: 'Project not found.' });
    }

    const member = await ProjectMember.findOne({
      where: { project_id: id, user_id: userId }
    });

    if (!member) {
      return res.status(404).json({ error: 'User is not a member of this project.' });
    }

    await member.destroy();
    res.status(200).json({ message: 'Member removed successfully.' });
  } catch (error) {
    console.error('Remove project member error:', error);
    res.status(500).json({ error: 'Failed to remove member.' });
  }
};

const getSkills = async (req, res) => {
  try {
    const skills = await Skill.findAll({ order: [['name', 'ASC']] });
    res.status(200).json(skills);
  } catch (error) {
    console.error('Get skills error:', error);
    res.status(500).json({ error: 'Failed to retrieve skills.' });
  }
};

const createSkill = async (req, res) => {
  try {
    const { name } = req.body;
    if (!name) {
      return res.status(400).json({ error: 'Skill name is required.' });
    }
    const [skill, created] = await Skill.findOrCreate({
      where: { name: name.trim() }
    });
    res.status(created ? 201 : 200).json(skill);
  } catch (error) {
    console.error('Create skill error:', error);
    res.status(500).json({ error: 'Failed to create skill.' });
  }
};

module.exports = {
  createProject,
  getProjects,
  getProjectById,
  updateProject,
  deleteProject,
  addProjectMember,
  removeProjectMember,
  getSkills,
  createSkill
};
