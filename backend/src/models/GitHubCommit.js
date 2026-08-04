const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const GitHubCommit = sequelize.define('GitHubCommit', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  repo_id: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  sha: {
    type: DataTypes.STRING,
    allowNull: false
  },
  message: {
    type: DataTypes.TEXT,
    allowNull: false
  },
  author_username: {
    type: DataTypes.STRING,
    allowNull: true
  },
  url: {
    type: DataTypes.STRING,
    allowNull: true
  },
  committed_at: {
    type: DataTypes.DATE,
    allowNull: false
  }
}, {
  tableName: 'github_commits',
  timestamps: true
});

module.exports = GitHubCommit;
