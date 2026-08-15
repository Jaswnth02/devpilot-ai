const mongoose = require('mongoose');
require('dotenv').config({ path: __dirname + '/../../.env' });
const sequelize = require('../config/database');
const MongoUser = require('../models/mongo/User');
const MongoProject = require('../models/mongo/Project');
const GitHubConnection = require('../models/mongo/GitHubConnection');
const OAuthState = require('../models/mongo/OAuthState');
const { User: SqlUser, Task: SqlTask, ProjectFile: SqlFile } = require('../models');

async function deleteUserData() {
  const targetEmail = 'jaswanthmg@devpilotai.in';
  console.log(`\n======================================================`);
  console.log(`Cleaning database records for: ${targetEmail}`);
  console.log(`======================================================\n`);

  // Connect MongoDB
  if (process.env.MONGODB_URI) {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✓ Connected to MongoDB');
  }

  // Connect SQLite/SQL
  await sequelize.authenticate();
  console.log('✓ Connected to SQL/SQLite database\n');

  // 1. Search in MongoDB User
  const mongoUsers = await MongoUser.find({
    email: { $regex: new RegExp(`^${targetEmail}$`, 'i') }
  });
  console.log(`Found ${mongoUsers.length} matching user(s) in MongoDB.`);

  for (const u of mongoUsers) {
    const uidStr = u._id.toString();
    console.log(`\nDeleting data for MongoDB User ID: ${uidStr} (${u.email})...`);

    // Delete GitHub Connections
    const ghRes = await GitHubConnection.deleteMany({
      $or: [{ userId: uidStr }, { email: { $regex: new RegExp(`^${targetEmail}$`, 'i') } }]
    });
    console.log(`  - Deleted ${ghRes.deletedCount} GitHubConnection record(s)`);

    // Delete OAuth States
    const stateRes = await OAuthState.deleteMany({ userId: uidStr });
    console.log(`  - Deleted ${stateRes.deletedCount} OAuthState record(s)`);

    // Delete Projects owned by user or remove user from members
    const projDeleteRes = await MongoProject.deleteMany({ ownerId: uidStr });
    console.log(`  - Deleted ${projDeleteRes.deletedCount} Project(s) owned by user`);

    const projUpdateRes = await MongoProject.updateMany(
      { 'members.userId': uidStr },
      { $pull: { members: { userId: uidStr } } }
    );
    console.log(`  - Removed from ${projUpdateRes.modifiedCount} project member list(s)`);

    // Delete User record
    await MongoUser.deleteOne({ _id: u._id });
    console.log(`  - Deleted MongoUser record`);
  }

  // 2. Search in SQL / SQLite User
  const sqlUsers = await SqlUser.findAll({
    where: sequelize.where(
      sequelize.fn('lower', sequelize.col('email')),
      targetEmail.toLowerCase()
    )
  });
  console.log(`\nFound ${sqlUsers.length} matching user(s) in SQL/SQLite.`);

  for (const su of sqlUsers) {
    console.log(`Deleting SQL user ID: ${su.id} (${su.email})...`);
    // Delete tasks assigned to user
    const taskCount = await SqlTask.destroy({ where: { assigned_user_id: su.id } });
    console.log(`  - Deleted/unassigned ${taskCount} tasks`);

    // Delete files uploaded by user
    const fileCount = await SqlFile.destroy({ where: { uploaded_by_user_id: su.id } });
    console.log(`  - Deleted ${fileCount} uploaded files`);

    // Delete SQL User
    await su.destroy();
    console.log(`  - Deleted SqlUser record`);
  }

  console.log(`\n======================================================`);
  console.log(`✓ All database records for ${targetEmail} have been deleted.`);
  console.log(`======================================================\n`);

  await mongoose.disconnect();
  await sequelize.close();
}

deleteUserData().catch(err => {
  console.error('Error deleting user data:', err);
  process.exit(1);
});
