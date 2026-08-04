const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const User = sequelize.define('User', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  name: {
    type: DataTypes.STRING,
    allowNull: false
  },
  email: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true,
    validate: {
      isEmail: true
    }
  },
  password: {
    type: DataTypes.STRING,
    allowNull: false
  },
  role: {
    type: DataTypes.ENUM('Admin', 'Project Owner', 'Developer'),
    defaultValue: 'Developer',
    allowNull: false
  },
  experience_level: {
    type: DataTypes.ENUM('Junior', 'Mid', 'Senior'),
    defaultValue: 'Mid',
    allowNull: false
  },
  availability: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
    allowNull: false
  },
  current_workload: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    allowNull: false
  }
}, {
  tableName: 'users',
  timestamps: true
});

module.exports = User;
