const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { User, Skill, UserSkill } = require('../models');
require('dotenv').config();

const JWT_SECRET = process.env.JWT_SECRET || 'supersecretdevpilotkey';

const register = async (req, res) => {
  try {
    const { name, email, password, role, experience_level, availability, skills } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ error: 'Name, email, and password are required.' });
    }

    const existingUser = await User.findOne({ where: { email } });
    if (existingUser) {
      return res.status(400).json({ error: 'Email already registered.' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await User.create({
      name,
      email,
      password: hashedPassword,
      role: role || 'Developer',
      experience_level: experience_level || 'Mid',
      availability: availability !== undefined ? availability : true,
      current_workload: 0
    });

    // Handle initial skill assignments if provided
    if (skills && Array.isArray(skills)) {
      for (const skillName of skills) {
        if (skillName && skillName.trim()) {
          const [skill] = await Skill.findOrCreate({
            where: { name: skillName.trim() }
          });
          await UserSkill.create({
            user_id: user.id,
            skill_id: skill.id
          });
        }
      }
    }

    const token = jwt.sign({ id: user.id, role: user.role }, JWT_SECRET, { expiresIn: '7d' });

    // Retrieve user with skills
    const userWithSkills = await User.findByPk(user.id, {
      include: [
        {
          model: Skill,
          through: { attributes: [] }
        }
      ]
    });

    res.status(201).json({
      token,
      user: {
        id: userWithSkills.id,
        name: userWithSkills.name,
        email: userWithSkills.email,
        role: userWithSkills.role,
        experience_level: userWithSkills.experience_level,
        availability: userWithSkills.availability,
        current_workload: userWithSkills.current_workload,
        Skills: userWithSkills.Skills
      }
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Registration failed. Server error.' });
  }
};

const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required.' });
    }

    const user = await User.findOne({
      where: { email },
      include: [
        {
          model: Skill,
          through: { attributes: [] }
        }
      ]
    });

    if (!user) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    const token = jwt.sign({ id: user.id, role: user.role }, JWT_SECRET, { expiresIn: '7d' });

    res.status(200).json({
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        experience_level: user.experience_level,
        availability: user.availability,
        current_workload: user.current_workload,
        Skills: user.Skills
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Login failed. Server error.' });
  }
};

const getMe = async (req, res) => {
  try {
    const user = await User.findByPk(req.user.id, {
      attributes: { exclude: ['password'] },
      include: [
        {
          model: Skill,
          through: { attributes: [] }
        }
      ]
    });
    res.status(200).json(user);
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({ error: 'Failed to retrieve user profile.' });
  }
};

module.exports = {
  register,
  login,
  getMe
};
