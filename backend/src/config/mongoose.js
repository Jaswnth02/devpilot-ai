const mongoose = require('mongoose');

const connectMongoDB = async () => {
  try {
    const mongoURI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/devpilot';
    const conn = await mongoose.connect(mongoURI);
    console.log(`MongoDB Connected: ${conn.connection.host}`);
    return conn;
  } catch (error) {
    console.error(`MongoDB Connection Error: ${error.message}`);
    // For coexistence, we might not want to crash the entire application if MongoDB fails
    // but instead log the error and allow Sequelize to continue if needed.
    // However, we log it clearly so that the user knows it failed.
  }
};

module.exports = connectMongoDB;
