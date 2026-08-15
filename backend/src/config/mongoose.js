const mongoose = require('mongoose');
let cachedPromise = null;

const connectMongoDB = async () => {
  if (mongoose.connection.readyState === 1) {
    return mongoose.connection;
  }

  if (cachedPromise) {
    return cachedPromise;
  }

  const mongoURI = process.env.MONGODB_URI;
  if (!mongoURI && process.env.VERCEL) {
    console.log('MONGODB_URI not set on Vercel. MongoDB features will be skipped.');
    return null;
  }

  const uri = mongoURI || 'mongodb://127.0.0.1:27017/devpilot';
  
  cachedPromise = mongoose.connect(uri, {
    serverSelectionTimeoutMS: 5000,
    socketTimeoutMS: 45000,
    bufferCommands: false
  }).then((conn) => {
    console.log(`MongoDB Connected: ${conn.connection.host}`);
    return conn;
  }).catch((error) => {
    console.error(`MongoDB Connection Error: ${error.message}`);
    cachedPromise = null;
    throw error;
  });

  return cachedPromise;
};

module.exports = connectMongoDB;
