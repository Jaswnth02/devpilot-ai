const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
require('dotenv').config({ path: __dirname + '/../../.env' });
const sequelize = require('../config/database');
const MongoUser = require('../models/mongo/User');
const { User: SqlUser } = require('../models');

const developers = [
  {
    email: 'chandrut@devpilotai.in',
    password: 'chandrut@123',
    fullName: 'Chandru T',
    role: 'Developer',
    workspaceRole: 'Developer / Engineer',
    experienceLevel: 'Mid-Level',
    skills: ['React', 'Node.js', 'JavaScript', 'Tailwind CSS', 'Git']
  },
  {
    email: 'kaviyat@devpilotai.in',
    password: 'kaviyat@123',
    fullName: 'Kaviya T',
    role: 'Developer',
    workspaceRole: 'Developer / Engineer',
    experienceLevel: 'Senior',
    skills: ['TypeScript', 'Node.js', 'Express', 'MongoDB', 'PostgreSQL', 'Docker']
  },
  {
    email: 'kavincb@devpilotai.in',
    password: 'kavincb@123',
    fullName: 'Kavin CB',
    role: 'Developer',
    workspaceRole: 'Developer / Engineer',
    experienceLevel: 'Mid-Level',
    skills: ['Python', 'FastAPI', 'Machine Learning', 'SQL', 'REST APIs']
  },
  {
    email: 'mistigaa@devpilotai.in',
    password: 'mistigaa@123',
    fullName: 'Mistiga A',
    role: 'Developer',
    workspaceRole: 'Developer / Engineer',
    experienceLevel: 'Entry-Level',
    skills: ['UI/UX', 'React', 'CSS', 'Figma', 'JavaScript']
  }
];

async function seedDevelopers() {
  console.log('======================================================');
  console.log('SEEDING 4 DEVELOPER ACCOUNTS');
  console.log('======================================================\n');

  // Connect MongoDB
  if (process.env.MONGODB_URI) {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✓ Connected to MongoDB');
  }

  // Connect SQLite
  await sequelize.authenticate();
  console.log('✓ Connected to SQLite\n');

  for (const dev of developers) {
    console.log(`Processing: ${dev.fullName} (${dev.email})...`);

    // 1. Upsert in MongoDB
    await MongoUser.deleteOne({ email: dev.email.toLowerCase() });
    const mongoUser = new MongoUser({
      fullName: dev.fullName,
      name: dev.fullName,
      email: dev.email.toLowerCase(),
      password: dev.password, // Pre-save hook will hash it with bcrypt
      workspaceRole: dev.workspaceRole,
      role: dev.role,
      experienceLevel: dev.experienceLevel,
      experience_level: dev.experienceLevel,
      skills: dev.skills,
      isEmailVerified: true,
      availability: true,
      current_workload: 0
    });
    await mongoUser.save();
    console.log(`  ✓ MongoDB User ID: ${mongoUser._id}`);

    // 2. Upsert in SQL / SQLite
    const hashedPassword = await bcrypt.hash(dev.password, 10);
    const [sqlUser, created] = await SqlUser.findOrCreate({
      where: { email: dev.email.toLowerCase() },
      defaults: {
        name: dev.fullName,
        email: dev.email.toLowerCase(),
        password: hashedPassword,
        role: dev.role,
        experience_level: dev.experienceLevel,
        availability: true,
        current_workload: 0
      }
    });

    if (!created) {
      sqlUser.password = hashedPassword;
      sqlUser.name = dev.fullName;
      sqlUser.role = dev.role;
      await sqlUser.save();
    }
    console.log(`  ✓ SQL User ID: ${sqlUser.id}`);
  }

  console.log('\n======================================================');
  console.log('ALL 4 DEVELOPER ACCOUNTS CREATED & VERIFIED!');
  console.log('======================================================\n');

  await mongoose.disconnect();
  await sequelize.close();
}

seedDevelopers().catch(err => {
  console.error('Error seeding developer accounts:', err);
  process.exit(1);
});
