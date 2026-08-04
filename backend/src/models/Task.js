const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Task = sequelize.define('Task', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  title: {
    type: DataTypes.STRING,
    allowNull: false
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  module: {
    type: DataTypes.STRING,
    allowNull: false
  },
  required_skills: {
    type: DataTypes.TEXT,
    allowNull: true,
    get() {
      const rawValue = this.getDataValue('required_skills');
      return rawValue ? JSON.parse(rawValue) : [];
    },
    set(value) {
      this.setDataValue('required_skills', JSON.stringify(value || []));
    }
  },
  priority: {
    type: DataTypes.ENUM('Low', 'Medium', 'High'),
    defaultValue: 'Medium',
    allowNull: false
  },
  status: {
    type: DataTypes.ENUM('To Do', 'In Progress', 'In Review', 'Completed', 'Blocked'),
    defaultValue: 'To Do',
    allowNull: false
  },
  deadline: {
    type: DataTypes.DATEONLY,
    allowNull: true
  },
  complexity: {
    type: DataTypes.ENUM('Low', 'Medium', 'High'),
    defaultValue: 'Medium',
    allowNull: false
  },
  assigned_user_id: {
    type: DataTypes.INTEGER,
    allowNull: true
  },
  project_id: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  github_issue_number: {
    type: DataTypes.INTEGER,
    allowNull: true
  }
}, {
  tableName: 'tasks',
  timestamps: true
});

module.exports = Task;
