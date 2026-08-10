const MongoUser = require('../models/mongo/User');
const { User: SqlUser } = require('../models');

// Fetch all team members (from MongoDB Atlas)
const getUsers = async (req, res) => {
  try {
    // 1. Fetch users from MongoDB Atlas
    const mongoUsers = await MongoUser.find({}, '-password').sort({ createdAt: -1 });

    // 2. Fetch users from SQLite fallback
    let sqlUsers = [];
    try {
      sqlUsers = await SqlUser.findAll({ attributes: { exclude: ['password'] } });
    } catch (e) {
      console.warn('SQLite fetch skipped:', e.message);
    }

    // 3. Normalize MongoDB Users for frontend team allocation UI
    const formattedMongoUsers = mongoUsers.map(u => ({
      id: u._id.toString(),
      _id: u._id.toString(),
      name: u.fullName || u.name || u.email.split('@')[0],
      fullName: u.fullName || u.name,
      email: u.email,
      role: u.workspaceRole || u.role || 'Developer',
      workspaceRole: u.workspaceRole || u.role || 'Developer / Engineer',
      experienceLevel: u.experienceLevel || u.experience_level || 'Mid-Level',
      experience_level: u.experience_level || u.experienceLevel || 'Mid',
      skills: u.skills || [],
      availability: u.availability !== undefined ? u.availability : true,
      current_workload: u.current_workload || 0,
      isEmailVerified: u.isEmailVerified !== undefined ? u.isEmailVerified : true
    }));

    // Combine users, avoiding duplicates by email
    const emailSet = new Set(formattedMongoUsers.map(u => u.email));
    
    for (const sqlUser of sqlUsers) {
      if (!emailSet.has(sqlUser.email)) {
        formattedMongoUsers.push({
          id: sqlUser.id,
          _id: sqlUser.id,
          name: sqlUser.name,
          fullName: sqlUser.name,
          email: sqlUser.email,
          role: sqlUser.role || 'Developer',
          workspaceRole: sqlUser.role || 'Developer / Engineer',
          experienceLevel: sqlUser.experience_level || 'Mid-Level',
          experience_level: sqlUser.experience_level || 'Mid',
          skills: [],
          availability: sqlUser.availability !== undefined ? sqlUser.availability : true,
          current_workload: sqlUser.current_workload || 0,
          isEmailVerified: true
        });
      }
    }

    res.status(200).json(formattedMongoUsers);
  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({ error: 'Failed to retrieve team members.' });
  }
};

const updateProfile = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, fullName, role, workspaceRole, experienceLevel, experience_level, availability, skills } = req.body;

    let user = null;
    if (id && typeof id === 'string' && id.length === 24) {
      user = await MongoUser.findById(id);
      if (user) {
        if (fullName || name) user.fullName = fullName || name;
        if (workspaceRole || role) user.workspaceRole = workspaceRole || role;
        if (experienceLevel || experience_level) user.experienceLevel = experienceLevel || experience_level;
        if (availability !== undefined) user.availability = availability;
        if (skills && Array.isArray(skills)) user.skills = skills;
        await user.save();

        return res.status(200).json({
          id: user._id.toString(),
          name: user.fullName || user.name,
          email: user.email,
          role: user.workspaceRole || user.role,
          experienceLevel: user.experienceLevel,
          skills: user.skills,
          availability: user.availability,
          current_workload: user.current_workload || 0
        });
      }
    }

    // Fallback SQLite update if user is numeric ID
    const sqlUser = await SqlUser.findByPk(id);
    if (!sqlUser) {
      return res.status(404).json({ error: 'User not found.' });
    }

    await sqlUser.update({
      name: name || fullName || sqlUser.name,
      role: role || workspaceRole || sqlUser.role,
      experience_level: experience_level || experienceLevel || sqlUser.experience_level,
      availability: availability !== undefined ? availability : sqlUser.availability
    });

    res.status(200).json(sqlUser);
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({ error: 'Failed to update user profile.' });
  }
};

module.exports = {
  getUsers,
  updateProfile
};
