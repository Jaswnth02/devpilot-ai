const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const AIAnalysis = sequelize.define('AIAnalysis', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  project_id: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  risk_level: {
    type: DataTypes.ENUM('Low', 'Medium', 'High'),
    defaultValue: 'Low',
    allowNull: false
  },
  reason: {
    type: DataTypes.TEXT,
    allowNull: false
  },
  recommendation: {
    type: DataTypes.TEXT,
    allowNull: false
  }
}, {
  tableName: 'ai_analysis',
  timestamps: true
});

module.exports = AIAnalysis;
