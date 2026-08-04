const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const GitHubPullRequest = sequelize.define('GitHubPullRequest', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  repo_id: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  pr_number: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  title: {
    type: DataTypes.STRING,
    allowNull: false
  },
  state: {
    type: DataTypes.ENUM('open', 'closed', 'merged'),
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
  },
  updated_at: {
    type: DataTypes.DATE,
    allowNull: false
  }
}, {
  tableName: 'github_pull_requests',
  timestamps: true
});

module.exports = GitHubPullRequest;
