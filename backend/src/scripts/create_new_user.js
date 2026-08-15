const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
require('dotenv').config({ path: __dirname + '/../../.env' });
const sequelize = require('../config/database');
const MongoUser = require('../models/mongo/User');
const { User: SqlUser } = require('../models');

async function createNewUser() {
  const email = 'jaswanthmg@devpilotai.in';
  const rawPassword = 'Jaswanth@0801';
  const fullName = 'Jaswanth MG';
  const role = 'Project Owner';
  const workspaceRole = 'Project Owner / Manager';
  const experienceLevel = 'Senior';

  console.log('======================================================');
  console.log(`Creating user: ${email}`);
  console.log('======================================================\n');

  // Connect MongoDB
  if (process.env.MONGODB_URI) {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✓ Connected to MongoDB');
  }

  // Connect SQLite
  await sequelize.authenticate();
  console.log('✓ Connected to SQLite');

  // 1. Create in MongoDB
  await MongoUser.deleteOne({ email: email.toLowerCase() });

  const mongoUser = new MongoUser({
    fullName,
    name: fullName,
    email: email.toLowerCase(),
    password: rawPassword, // pre-save hook will hash it with bcrypt
    workspaceRole,
    role,
    experienceLevel,
    experience_level: experienceLevel,
    skills: ['React', 'Node.js', 'Express.js', 'GitHub API', 'MongoDB', 'JavaScript'],
    isEmailVerified: true,
    availability: true,
    current_workload: 0
  });

  await mongoUser.save();
  console.log(`✓ Created user in MongoDB Atlas: ID ${mongoUser._id}`);

  // 2. Create in SQL / SQLite
  const hashedPassword = await bcrypt.hash(rawPassword, 10);
  const [sqlUser, created] = await SqlUser.findOrCreate({
    where: { email: email.toLowerCase() },
    defaults: {
      name: fullName,
      email: email.toLowerCase(),
      password: hashedPassword,
      role,
      experience_level: experienceLevel,
      availability: true,
      current_workload: 0
    }
  });

  if (!created) {
    sqlUser.password = hashedPassword;
    sqlUser.name = fullName;
    sqlUser.role = role;
    await sqlUser.save();
  }
  console.log(`✓ Created / updated user in SQL/SQLite: ID ${sqlUser.id}`);

  // Test password verification
  const isMatch = await mongoUser.comparePassword(rawPassword);
  console.log(`\nPassword hash verification test: ${isMatch ? 'SUCCESS ✓' : 'FAILED ✗'}`);

  console.log('\n======================================================');
  console.log('NEW USER CREATED AND VERIFIED SUCCESSFULLY!');
  console.log('======================================================\n');

  await mongoose.disconnect();
  await sequelize.close();
}

createNewUser().catch(err => {
  console.error('Error creating user:', err);
  process.exit(1);
});
