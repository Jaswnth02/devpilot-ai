const { Sequelize } = require('sequelize');
const path = require('path');
require('dotenv').config();

const databaseUrl = process.env.DATABASE_URL;
let sequelize;

if (databaseUrl && databaseUrl.startsWith('mysql:')) {
  console.log('Connecting to database using MySQL dialect...');
  sequelize = new Sequelize(databaseUrl, {
    dialect: 'mysql',
    logging: false,
    dialectOptions: {
      decimalNumbers: true
    }
  });
} else {
  console.log('Connecting to database using local SQLite fallback...');
  const storagePath = path.join(__dirname, '../../devpilot.sqlite');
  sequelize = new Sequelize({
    dialect: 'sqlite',
    storage: storagePath,
    logging: false
  });
}

module.exports = sequelize;
