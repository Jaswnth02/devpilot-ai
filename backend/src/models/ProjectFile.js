const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const ProjectFile = sequelize.define('ProjectFile', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  original_name: {
    type: DataTypes.STRING,
    allowNull: false
  },
  filename: {
    type: DataTypes.STRING,
    allowNull: false
  },
  file_path: {
    type: DataTypes.STRING,
    allowNull: false
  },
  mime_type: {
    type: DataTypes.STRING,
    allowNull: false
  },
  file_size: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  project_id: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  uploaded_by_user_id: {
    type: DataTypes.INTEGER,
    allowNull: true
  }
}, {
  tableName: 'project_files',
  timestamps: true
});

module.exports = ProjectFile;
