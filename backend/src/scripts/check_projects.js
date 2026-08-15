const mongoose = require('mongoose');
require('dotenv').config({ path: __dirname + '/../../.env' });
const MongoProject = require('../models/mongo/Project');
const MongoUser = require('../models/mongo/User');

async function checkProjects() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('✓ Connected to MongoDB\n');

  const users = await MongoUser.find();
  console.log('=== USERS ===');
  users.forEach(u => {
    console.log(`User: ${u.fullName} | Email: ${u.email} | ID: ${u._id} | Role: ${u.role} | WorkspaceRole: ${u.workspaceRole}`);
  });

  const projects = await MongoProject.find();
  console.log('\n=== PROJECTS ===');
  projects.forEach(p => {
    console.log(`Project: ${p.name} | ID: ${p._id} | OwnerId: ${p.ownerId} | Code: ${p.projectCode}`);
  });

  await mongoose.disconnect();
}

checkProjects().catch(console.error);
