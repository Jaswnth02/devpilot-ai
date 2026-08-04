const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const TaskDependency = sequelize.define('TaskDependency', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  task_id: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  depends_on_task_id: {
    type: DataTypes.INTEGER,
    allowNull: false
  }
}, {
  tableName: 'task_dependencies',
  timestamps: false
});

module.exports = TaskDependency;
