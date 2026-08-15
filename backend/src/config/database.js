const { Sequelize } = require('sequelize');
const path = require('path');
require('dotenv').config();

const databaseUrl = process.env.DATABASE_URL;
let sequelize;

if (databaseUrl && (databaseUrl.startsWith('mysql:') || databaseUrl.startsWith('mysql2:'))) {
  console.log('Connecting to database using MySQL dialect...');
  let mysql2Module;
  try {
    mysql2Module = require('mysql2');
  } catch (e) {
    console.warn('mysql2 module load warning:', e.message);
  }
  sequelize = new Sequelize(databaseUrl, {
    dialect: 'mysql',
    dialectModule: mysql2Module,
    logging: false,
    dialectOptions: {
      decimalNumbers: true
    }
  });
} else {
  console.log('Connecting to database using local SQLite fallback...');
  const storagePath = process.env.VERCEL
    ? '/tmp/devpilot.sqlite'
    : (process.env.SQLITE_PATH || path.join(__dirname, '../../devpilot.sqlite'));
  let sqlite3Module;
  try {
    sqlite3Module = require('sqlite3');
  } catch (e) {
    console.warn('sqlite3 module load warning:', e.message);
  }
  sequelize = new Sequelize({
    dialect: 'sqlite',
    dialectModule: sqlite3Module,
    storage: storagePath,
    logging: false
  });
}

module.exports = sequelize;
