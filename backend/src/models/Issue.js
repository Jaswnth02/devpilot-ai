const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Issue = sequelize.define('Issue', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  task_id: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  reported_by_user_id: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: false
  },
  status: {
    type: DataTypes.ENUM('Open', 'Resolved'),
    defaultValue: 'Open',
    allowNull: false
  },
  ai_category: {
    type: DataTypes.STRING,
    allowNull: true
  },
  ai_priority: {
    type: DataTypes.STRING,
    allowNull: true
  },
  ai_causes: {
    type: DataTypes.TEXT,
    allowNull: true,
    get() {
      const rawValue = this.getDataValue('ai_causes');
      return rawValue ? JSON.parse(rawValue) : [];
    },
    set(value) {
      this.setDataValue('ai_causes', JSON.stringify(value || []));
    }
  },
  ai_suggestions: {
    type: DataTypes.TEXT,
    allowNull: true,
    get() {
      const rawValue = this.getDataValue('ai_suggestions');
      return rawValue ? JSON.parse(rawValue) : [];
    },
    set(value) {
      this.setDataValue('ai_suggestions', JSON.stringify(value || []));
    }
  }
}, {
  tableName: 'issues',
  timestamps: true
});

module.exports = Issue;
