const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const GitHubRepository = sequelize.define('GitHubRepository', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  project_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    unique: true
  },
  owner: {
    type: DataTypes.STRING,
    allowNull: false
  },
  repo_name: {
    type: DataTypes.STRING,
    allowNull: false
  },
  webhook_secret: {
    type: DataTypes.STRING,
    allowNull: true
  }
}, {
  tableName: 'github_repositories',
  timestamps: true
});

module.exports = GitHubRepository;
