const mongoose = require('mongoose');
const crypto = require('crypto');
const assert = require('assert');
require('dotenv').config();

const OAuthState = require('../models/mongo/OAuthState');
const GitHubConnection = require('../models/mongo/GitHubConnection');
const Project = require('../models/mongo/Project');
const githubService = require('../services/githubService');
const { encryptToken, decryptToken } = require('../utils/cryptoUtil');

async function testFullDatabaseAndWebhookFlow() {
  console.log('====================================================');
  console.log('DEV-PILOT DATABASE & WEBHOOK FLOW INTEGRATION TEST');
  console.log('====================================================\n');

  const mongoUri = process.env.MONGODB_URI;
  if (!mongoUri) {
    console.log('Skipping database test: MONGODB_URI not defined in .env');
    return;
  }

  await mongoose.connect(mongoUri);
  console.log('✓ Connected to MongoDB for end-to-end testing\n');

  try {
    // 1. Test OAuthState Lifecycle (Crypto token, Single-Use, Expiration)
    console.log('--- Step 1: Testing OAuthState Lifecycle ---');
    const stateToken = crypto.randomBytes(32).toString('hex');
    const testUserId = new mongoose.Types.ObjectId();
    const testProjectId = new mongoose.Types.ObjectId();

    const createdState = await OAuthState.create({
      state: stateToken,
      userId: testUserId,
      projectId: testProjectId,
      returnUrl: `/projects/${testProjectId}?tab=github`,
      expiresAt: new Date(Date.now() + 15 * 60 * 1000)
    });

    assert.strictEqual(createdState.used, false, 'State must initially be unused');
    console.log('  ✓ OAuthState record created with 15min TTL index');

    // Retrieve state
    const foundState = await OAuthState.findOne({ state: stateToken, used: false });
    assert.notStrictEqual(foundState, null, 'Unused state must be found');

    // Mark as used
    foundState.used = true;
    await foundState.save();

    // Verify it cannot be reused
    const reusedState = await OAuthState.findOne({ state: stateToken, used: false });
    assert.strictEqual(reusedState, null, 'Used state cannot be retrieved again');
    console.log('  ✓ OAuthState single-use enforcement verified');

    // Cleanup state
    await OAuthState.deleteOne({ _id: createdState._id });

    // 2. Test User Account Isolation (GitHub User ID mapping)
    console.log('\n--- Step 2: Testing User Account Isolation ---');
    const stableGithubUserId = '180279780';
    const rawAccessToken = 'gho_real_production_token_' + Date.now();
    const encryptedToken = encryptToken(rawAccessToken);

    const connection = await GitHubConnection.findOneAndUpdate(
      { userId: testUserId.toString() },
      {
        userId: testUserId.toString(),
        githubUserId: stableGithubUserId,
        githubId: stableGithubUserId,
        username: 'testdeveloper',
        email: 'testdeveloper@github.com',
        accessToken: encryptedToken,
        avatar: 'https://avatars.githubusercontent.com/u/180279780?v=4',
        profileUrl: 'https://github.com/testdeveloper',
        status: 'active',
        connectedAt: new Date()
      },
      { upsert: true, new: true }
    );

    assert.strictEqual(connection.githubUserId, stableGithubUserId, 'GitHub User ID must match stable identifier');
    assert.strictEqual(decryptToken(connection.accessToken), rawAccessToken, 'Decrypted token must match raw token');
    console.log('  ✓ GitHub connection securely saved and mapped to User ID');

    // 3. Test Project Model Integration Schema
    console.log('\n--- Step 3: Testing Project Integration Setup ---');
    const testProject = await Project.create({
      name: 'Automated Test Project ' + Date.now(),
      projectCode: 'TEST-' + Math.floor(1000 + Math.random() * 9000),
      description: 'Project for testing GitHub integration',
      ownerId: testUserId.toString(),
      githubIntegration: {
        connected: true,
        repositoryId: '987654321',
        repositoryName: 'online-book-store',
        repositoryFullName: 'testdeveloper/online-book-store',
        repositoryOwner: 'testdeveloper',
        repositoryUrl: 'https://github.com/testdeveloper/online-book-store',
        defaultBranch: 'main',
        visibility: 'public',
        webhookActive: true,
        webhookId: '12345678',
        lastSyncedAt: new Date(),
        latestCommit: {
          sha: 'd1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0',
          message: 'Initial project repository structure',
          author: 'testdeveloper',
          date: new Date(),
          url: 'https://github.com/testdeveloper/online-book-store/commit/d1a2b3c'
        },
        recentCommits: [
          {
            sha: 'd1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0',
            message: 'Initial project repository structure',
            author: 'testdeveloper',
            branch: 'main',
            date: new Date(),
            url: 'https://github.com/testdeveloper/online-book-store/commit/d1a2b3c'
          }
        ]
      }
    });

    assert.strictEqual(testProject.githubIntegration.connected, true);
    assert.strictEqual(testProject.githubIntegration.repositoryFullName, 'testdeveloper/online-book-store');
    console.log('  ✓ Project GitHub integration schema persisted correctly');

    // 4. Test Webhook Push Event Ingestion and Commit Stream Update
    console.log('\n--- Step 4: Testing Webhook Push Event Ingestion ---');
    const secret = process.env.GITHUB_WEBHOOK_SECRET || 'devpilotwebhooksecret';
    const newCommitSha = 'f9e8d7c6b5a43210f9e8d7c6b5a43210f9e8d7c6';
    const newCommitMessage = 'Implement real-time inventory updates via Webhooks';

    const webhookPayload = JSON.stringify({
      ref: 'refs/heads/main',
      repository: {
        id: 987654321,
        name: 'online-book-store',
        full_name: 'testdeveloper/online-book-store',
        owner: { name: 'testdeveloper', login: 'testdeveloper' }
      },
      commits: [
        {
          id: newCommitSha,
          message: newCommitMessage,
          timestamp: new Date().toISOString(),
          author: { name: 'testdeveloper', username: 'testdeveloper' },
          url: `https://github.com/testdeveloper/online-book-store/commit/${newCommitSha}`
        }
      ],
      head_commit: {
        id: newCommitSha,
        message: newCommitMessage,
        timestamp: new Date().toISOString(),
        author: { name: 'testdeveloper', username: 'testdeveloper' },
        url: `https://github.com/testdeveloper/online-book-store/commit/${newCommitSha}`
      }
    });

    const validSignature = 'sha256=' + crypto.createHmac('sha256', secret).update(webhookPayload).digest('hex');
    const isSignatureValid = githubService.verifyWebhookSignature(webhookPayload, validSignature, secret);
    assert.strictEqual(isSignatureValid, true, 'HMAC signature verification must succeed');
    console.log('  ✓ Webhook HMAC-SHA256 signature verified against secret');

    // Simulate updating project with webhook payload
    const parsed = JSON.parse(webhookPayload);
    const updatedCommit = {
      sha: parsed.head_commit.id,
      message: parsed.head_commit.message,
      author: parsed.head_commit.author?.username || parsed.head_commit.author?.name || 'developer',
      branch: parsed.ref?.replace('refs/heads/', '') || 'main',
      date: new Date(parsed.head_commit.timestamp),
      url: parsed.head_commit.url
    };

    testProject.githubIntegration.latestCommit = updatedCommit;
    testProject.githubIntegration.recentCommits.unshift(updatedCommit);
    testProject.githubIntegration.lastSyncedAt = new Date();
    await testProject.save();

    // Verify persisted updates
    const refreshedProject = await Project.findById(testProject._id);
    assert.strictEqual(refreshedProject.githubIntegration.latestCommit.sha, newCommitSha);
    assert.strictEqual(refreshedProject.githubIntegration.latestCommit.message, newCommitMessage);
    assert.strictEqual(refreshedProject.githubIntegration.recentCommits.length, 2);
    console.log('  ✓ Live commit stream updated in MongoDB from webhook payload');

    // Cleanup test data
    await Project.deleteOne({ _id: testProject._id });
    await GitHubConnection.deleteOne({ _id: connection._id });
    console.log('\n✓ Cleaned up test artifacts from MongoDB database');

    console.log('\n====================================================');
    console.log('ALL DATABASE & WEBHOOK TESTS PASSED SUCCESSFULLY!');
    console.log('====================================================\n');
  } catch (err) {
    console.error('Test execution failed:', err);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
  }
}

testFullDatabaseAndWebhookFlow().catch(console.error);
