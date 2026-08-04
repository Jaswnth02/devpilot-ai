const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const GitHubIssue = sequelize.define('GitHubIssue', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  repo_id: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  issue_number: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  title: {
    type: DataTypes.STRING,
    allowNull: false
  },
  state: {
    type: DataTypes.ENUM('open', 'closed'),
    defaultValue: 'open',
    allowNull: false
  },
  url: {
    type: DataTypes.STRING,
    allowNull: true
  },
  username: {
    type: DataTypes.STRING,
    allowNull: true
  }
}, {
  tableName: 'github_issues',
  timestamps: true
});

module.exports = GitHubIssue;
