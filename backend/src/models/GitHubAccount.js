const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const GitHubAccount = sequelize.define('GitHubAccount', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  user_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    unique: true
  },
  github_username: {
    type: DataTypes.STRING,
    allowNull: false
  },
  access_token: {
    type: DataTypes.STRING,
    allowNull: false
  }
}, {
  tableName: 'github_accounts',
  timestamps: true
});

module.exports = GitHubAccount;
