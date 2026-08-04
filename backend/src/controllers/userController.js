const { User, Skill, UserSkill, Task } = require('../models');

const getUsers = async (req, res) => {
  try {
    const users = await User.findAll({
      attributes: { exclude: ['password'] },
      include: [
        {
          model: Skill,
          through: { attributes: [] }
        }
      ]
    });
    res.status(200).json(users);
  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({ error: 'Failed to retrieve users.' });
  }
};

const updateProfile = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, role, experience_level, availability, skills } = req.body;

    // Check permissions: users can update their own profile, Admins/Project Owners can update anyone.
    if (req.user.id !== parseInt(id) && req.user.role !== 'Admin' && req.user.role !== 'Project Owner') {
      return res.status(403).json({ error: 'Unauthorized to update this profile.' });
    }

    const user = await User.findByPk(id);
    if (!user) {
      return res.status(404).json({ error: 'User not found.' });
    }

    // Update user properties
    await user.update({
      name: name || user.name,
      role: (req.user.role === 'Admin' || req.user.role === 'Project Owner') ? (role || user.role) : user.role,
      experience_level: experience_level || user.experience_level,
      availability: availability !== undefined ? availability : user.availability
    });

    // Update skills if provided
    if (skills && Array.isArray(skills)) {
      // Clear current skills
      await UserSkill.destroy({ where: { user_id: id } });

      for (const skillName of skills) {
        if (skillName && skillName.trim()) {
          const [skill] = await Skill.findOrCreate({
            where: { name: skillName.trim() }
          });
          await UserSkill.create({
            user_id: id,
            skill_id: skill.id
          });
        }
      }
    }

    // Recalculate current workload based on open tasks (To Do, In Progress, Blocked)
    const activeTasksCount = await Task.count({
      where: {
        assigned_user_id: id,
        status: ['To Do', 'In Progress', 'Blocked']
      }
    });

    await user.update({ current_workload: activeTasksCount });

    const updatedUser = await User.findByPk(id, {
      attributes: { exclude: ['password'] },
      include: [
        {
          model: Skill,
          through: { attributes: [] }
        }
      ]
    });

    res.status(200).json(updatedUser);
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({ error: 'Failed to update user profile.' });
  }
};

module.exports = {
  getUsers,
  updateProfile
};
