const crypto = require('crypto');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const githubService = require('../services/githubService');
const { encryptToken, decryptToken } = require('../utils/cryptoUtil');
const MongoUser = require('../models/mongo/User');
const MongoProject = require('../models/mongo/Project');
const GitHubConnection = require('../models/mongo/GitHubConnection');
const OAuthState = require('../models/mongo/OAuthState');
const ImportedRepository = require('../models/mongo/ImportedRepository');
const MongoGitHubCommit = require('../models/mongo/GitHubCommit');
const socketService = require('../services/socketService');
require('dotenv').config();

const JWT_SECRET = process.env.JWT_SECRET || 'supersecretdevpilotkey';
const WEBHOOK_SECRET = process.env.GITHUB_WEBHOOK_SECRET || 'devpilotwebhooksecret';

const getIdStr = (userObj) => {
  if (!userObj) return '';
  return (userObj._id || userObj.id || userObj).toString();
};

const findMongoUserSafe = async (userIdStr) => {
  if (!userIdStr || !mongoose.isValidObjectId(userIdStr)) {
    return null;
  }
  try {
    return await MongoUser.findById(userIdStr);
  } catch (e) {
    return null;
  }
};

/**
 * Checks if the user is an authorized project owner or member
 */
const checkProjectMemberPermission = async (projectId, userId) => {
  if (!projectId || !mongoose.isValidObjectId(projectId)) {
    return { authorized: false, isOwner: false, reason: 'Invalid project ID format.', project: null };
  }

  const project = await MongoProject.findById(projectId);
  if (!project) {
    return { authorized: false, isOwner: false, reason: 'Project not found.', project: null };
  }

  const userIdStr = getIdStr(userId);
  const ownerIdStr = getIdStr(project.ownerId);

  if (ownerIdStr === userIdStr) {
    return { authorized: true, isOwner: true, project };
  }

  const isMember =
    Array.isArray(project.members) &&
    project.members.some((m) => getIdStr(m.userId) === userIdStr);

  if (isMember) {
    return { authorized: true, isOwner: false, project };
  }

  return {
    authorized: false,
    isOwner: false,
    reason: 'Permission denied. You are not a member or owner of this project.',
    project
  };
};

/**
 * Retrieves the user's decrypted GitHub OAuth access token from their isolated GitHubConnection
 */
const getUserDecryptedToken = async (userIdStr) => {
  const connection = await GitHubConnection.findOne({
    userId: userIdStr,
    connected: true,
    status: 'active'
  });

  if (!connection || !connection.accessToken) {
    // Check fallback on user document if exists
    const user = await findMongoUserSafe(userIdStr);
    if (user?.github?.accessToken && user?.github?.connected) {
      return {
        token: decryptToken(user.github.accessToken),
        username: user.github.username,
        githubUserId: user.github.githubUserId,
        connection: null
      };
    }
    return null;
  }

  return {
    token: decryptToken(connection.accessToken),
    username: connection.githubUsername,
    githubUserId: connection.githubUserId || connection.githubId,
    connection
  };
};

/**
 * Verifies GitHub HMAC-SHA256 Webhook Signature
 */
const verifyGitHubSignature = (req) => {
  const signature = req.headers['x-hub-signature-256'];
  if (!signature) return false;

  const hmac = crypto.createHmac('sha256', WEBHOOK_SECRET);
  const payload = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
  const digest = 'sha256=' + hmac.update(payload).digest('hex');

  try {
    return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(digest));
  } catch (e) {
    return false;
  }
};

// 1. GET /api/github/auth (Returns GitHub OAuth Authorization URL with CSRF State)
const getAuthUrl = async (req, res) => {
  try {
    const userIdStr = getIdStr(req.user);
    if (!userIdStr) {
      return res.status(401).json({ error: 'Authentication required.' });
    }

    const { projectId, returnUrl } = req.query;
    const state = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes TTL

    await OAuthState.create({
      state,
      userId: userIdStr,
      projectId: projectId && mongoose.isValidObjectId(projectId) ? projectId : null,
      returnUrl: returnUrl || (projectId ? `/projects/${projectId}?tab=github` : '/github'),
      expiresAt
    });

    const url = githubService.getOAuthUrl(state);
    return res.status(200).json({ url, state });
  } catch (error) {
    console.error('Error generating GitHub Auth URL:', error);
    return res.status(500).json({ error: error.message || 'Failed to generate GitHub Auth URL.' });
  }
};

// 1b. GET /api/github/connect (Direct browser redirect to GitHub OAuth)
const connect = async (req, res) => {
  try {
    const userIdStr = getIdStr(req.user);
    if (!userIdStr) {
      return res.status(401).json({ error: 'Authentication required.' });
    }

    const { projectId, returnUrl } = req.query;
    const state = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

    await OAuthState.create({
      state,
      userId: userIdStr,
      projectId: projectId && mongoose.isValidObjectId(projectId) ? projectId : null,
      returnUrl: returnUrl || (projectId ? `/projects/${projectId}?tab=github` : '/github'),
      expiresAt
    });

    const url = githubService.getOAuthUrl(state);
    return res.redirect(url);
  } catch (error) {
    console.error('Error redirecting to GitHub Auth:', error);
    return res.status(500).json({ error: 'Failed to initiate GitHub authorization.' });
  }
};

// 2. GET /api/github/callback (Handles GitHub OAuth callback with CSRF state verification)
const callback = async (req, res) => {
  const { code, state, error: oauthError, error_description } = req.query;
  const clientUrl = process.env.CLIENT_URL || 'http://localhost:5173';

  if (oauthError) {
    console.warn('GitHub OAuth returned error:', oauthError, error_description);
    return res.redirect(`${clientUrl}/github?error=${encodeURIComponent(error_description || oauthError)}`);
  }

  if (!code || !state) {
    return res.redirect(`${clientUrl}/github?error=${encodeURIComponent('Missing authorization code or security state.')}`);
  }

  try {
    // 1. Verify that state exists, is unused, and has not expired
    const oauthState = await OAuthState.findOne({
      state,
      used: false,
      expiresAt: { $gt: new Date() }
    });

    if (!oauthState) {
      console.warn('Invalid or expired OAuth state token:', state);
      return res.redirect(`${clientUrl}/github?error=${encodeURIComponent('GitHub authorization state expired or invalid. Please try connecting again.')}`);
    }

    // Mark state as consumed immediately to prevent replay attacks
    oauthState.used = true;
    await oauthState.save();

    const userId = oauthState.userId.toString();

    // 2. Exchange code for access token & fetch verified GitHub user profile
    const accountData = await githubService.getAccessToken(code);
    const encryptedToken = encryptToken(accountData.access_token);
    const now = new Date();

    // 3. Update or create isolated GitHubConnection record for this DevPilot user
    await GitHubConnection.findOneAndUpdate(
      { userId },
      {
        githubUserId: accountData.githubUserId,
        githubId: accountData.githubUserId,
        githubUsername: accountData.github_username,
        githubAvatar: accountData.avatar_url,
        githubProfileUrl: accountData.profile_url,
        githubEmail: accountData.email,
        accessToken: encryptedToken,
        status: 'active',
        connected: true,
        connectedAt: now
      },
      { upsert: true, new: true }
    );

    // 4. Update embedded github fields on User model
    await MongoUser.findByIdAndUpdate(userId, {
      githubUsername: accountData.github_username,
      github: {
        githubUserId: accountData.githubUserId,
        username: accountData.github_username,
        connected: true,
        accessToken: encryptedToken,
        avatarUrl: accountData.avatar_url,
        profileUrl: accountData.profile_url,
        email: accountData.email,
        connectedAt: now,
        lastSyncedAt: now
      }
    });

    // 5. Redirect user to destination
    if (oauthState.projectId) {
      return res.redirect(
        `${clientUrl}/projects/${oauthState.projectId}?tab=github&github_connected=true&username=${encodeURIComponent(accountData.github_username)}`
      );
    }

    return res.redirect(
      `${clientUrl}/github?connected=true&username=${encodeURIComponent(accountData.github_username)}`
    );
  } catch (error) {
    console.error('GitHub Callback Error:', error);
    return res.redirect(`${clientUrl}/github?error=${encodeURIComponent(error.message || 'GitHub authentication failed.')}`);
  }
};

// 3. GET /api/github/status (Returns authenticated user's isolated GitHub connection status)
const getStatus = async (req, res) => {
  try {
    const userIdStr = getIdStr(req.user);
    if (!userIdStr) {
      return res.status(401).json({ error: 'Authentication required.' });
    }

    const connection = await GitHubConnection.findOne({
      userId: userIdStr,
      connected: true,
      status: 'active'
    });

    if (connection) {
      return res.status(200).json({
        connected: true,
        githubUserId: connection.githubUserId || connection.githubId,
        username: connection.githubUsername,
        avatar: connection.githubAvatar || `https://avatars.githubusercontent.com/${connection.githubUsername}`,
        profileUrl: connection.githubProfileUrl || `https://github.com/${connection.githubUsername}`,
        email: connection.githubEmail,
        connectedAt: connection.connectedAt || connection.createdAt
      });
    }

    // Check user model embedded state
    const user = await findMongoUserSafe(userIdStr);
    if (user?.github?.connected && user?.github?.accessToken) {
      return res.status(200).json({
        connected: true,
        githubUserId: user.github.githubUserId,
        username: user.github.username,
        avatar: user.github.avatarUrl || `https://avatars.githubusercontent.com/${user.github.username}`,
        profileUrl: user.github.profileUrl || `https://github.com/${user.github.username}`,
        email: user.github.email,
        connectedAt: user.github.connectedAt
      });
    }

    return res.status(200).json({
      connected: false,
      message: 'No GitHub account connected.'
    });
  } catch (error) {
    console.error('Error fetching GitHub connection status:', error);
    return res.status(500).json({ error: 'Failed to retrieve GitHub connection status.' });
  }
};

// 4. GET /api/github/repos (Fetches repositories for authenticated user with pagination & search)
const getRepositories = async (req, res) => {
  try {
    const userIdStr = getIdStr(req.user);
    const authData = await getUserDecryptedToken(userIdStr);

    if (!authData || !authData.token) {
      return res.status(200).json({
        connected: false,
        repositories: [],
        totalCount: 0,
        message: 'GitHub account is not connected.'
      });
    }

    const { page = 1, perPage = 30, sort = 'updated', search = '', visibility = 'all' } = req.query;

    const result = await githubService.getUserRepos(authData.token, {
      page: Number(page),
      perPage: Number(perPage),
      sort,
      search,
      visibility
    });

    return res.status(200).json({
      connected: true,
      username: authData.username,
      avatar: authData.connection?.githubAvatar || `https://avatars.githubusercontent.com/${authData.username}`,
      repositories: result.repositories,
      totalCount: result.totalCount,
      page: result.page,
      perPage: result.perPage,
      hasMore: result.hasMore
    });
  } catch (error) {
    console.error('Error fetching GitHub repositories:', error);
    return res.status(500).json({ error: error.message || 'Failed to retrieve GitHub repositories.' });
  }
};

// 4b. POST /api/github/sync (Synchronizes user repositories from GitHub)
const syncUserRepositories = async (req, res) => {
  try {
    const userIdStr = getIdStr(req.user);
    const authData = await getUserDecryptedToken(userIdStr);

    if (!authData || !authData.token) {
      return res.status(400).json({ error: 'GitHub account is not connected.' });
    }

    const result = await githubService.getUserRepos(authData.token, {
      page: 1,
      perPage: 100,
      sort: 'updated'
    });

    if (authData.connection) {
      authData.connection.lastSyncedAt = new Date();
      await authData.connection.save().catch(() => {});
    }

    return res.status(200).json({
      connected: true,
      username: authData.username,
      avatar: authData.connection?.githubAvatar || `https://avatars.githubusercontent.com/${authData.username}`,
      repositories: result.repositories,
      totalCount: result.totalCount,
      syncedAt: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error syncing user repositories:', error);
    return res.status(500).json({ error: error.message || 'Failed to synchronize repositories.' });
  }
};

// 5. POST /api/github/repos/create (Option A: Create a NEW GitHub Repository & Auto-Connect to Project)
const createRepository = async (req, res) => {
  try {
    const userIdStr = getIdStr(req.user);
    const { projectId, name, description, visibility, isPrivate, autoInit = true } = req.body;

    if (!projectId) {
      return res.status(400).json({ error: 'Project ID is required.' });
    }

    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Repository name is required.' });
    }

    // 1. Permission check: verify user is owner or member of this project
    const permCheck = await checkProjectMemberPermission(projectId, userIdStr);
    if (!permCheck.authorized) {
      return res.status(403).json({ error: permCheck.reason });
    }

    const project = permCheck.project;

    // 2. Retrieve user's isolated GitHub credentials
    const authData = await getUserDecryptedToken(userIdStr);
    if (!authData || !authData.token) {
      return res.status(400).json({ error: 'Please connect your GitHub account before creating a repository.' });
    }

    // 3. Create repository on GitHub via official API
    const repoVisibility = visibility === 'private' || isPrivate === true;
    const createdRepo = await githubService.createRepository(authData.token, {
      name,
      description: description || project.description || '',
      isPrivate: repoVisibility,
      autoInit
    });

    // 4. Verify no other project is connected to this repository ID
    const duplicate = await MongoProject.findOne({
      _id: { $ne: project._id },
      'githubIntegration.repositoryId': String(createdRepo.id)
    });

    if (duplicate) {
      return res.status(400).json({ error: 'This repository is already connected to another DevPilot project.' });
    }

    // 5. Register Webhook with GitHub
    const webhookUrl = `${req.protocol}://${req.get('host')}/api/github/webhook`;
    const hookRes = await githubService.createWebhook(
      authData.token,
      createdRepo.owner,
      createdRepo.name,
      webhookUrl,
      WEBHOOK_SECRET
    );
    const webhookId = hookRes?.id ? String(hookRes.id) : null;

    // 6. Fetch initial commit from GitHub
    const latestCommit = await githubService.getLatestCommit(authData.token, createdRepo.owner, createdRepo.name);
    const now = new Date();

    const integrationData = {
      connected: true,
      repositoryId: String(createdRepo.id),
      repositoryName: createdRepo.name,
      repositoryFullName: createdRepo.full_name,
      repositoryOwner: createdRepo.owner,
      repositoryUrl: createdRepo.html_url,
      defaultBranch: createdRepo.default_branch || 'main',
      visibility: createdRepo.private ? 'private' : 'public',
      description: createdRepo.description || description || '',
      language: createdRepo.language || '',
      stars: 0,
      forks: 0,
      openIssuesCount: 0,
      webhookId,
      connectedAt: now,
      lastSyncedAt: now,
      latestCommit,
      recentCommits: latestCommit ? [latestCommit] : [],
      pullRequests: [],
      branches: [{ name: createdRepo.default_branch || 'main', isDefault: true }],
      contributors: [{ username: createdRepo.owner, avatarUrl: `https://avatars.githubusercontent.com/${createdRepo.owner}`, contributions: 1 }]
    };

    project.githubIntegration = integrationData;
    project.githubRepository = {
      githubRepositoryId: String(createdRepo.id),
      owner: createdRepo.owner,
      name: createdRepo.name,
      fullName: createdRepo.full_name,
      htmlUrl: createdRepo.html_url,
      defaultBranch: createdRepo.default_branch || 'main',
      description: createdRepo.description || description || '',
      language: createdRepo.language || '',
      stars: 0,
      forks: 0,
      openIssuesCount: 0,
      isPrivate: createdRepo.private,
      lastCommit: latestCommit,
      connectedAt: now,
      lastSyncedAt: now
    };

    await project.save();

    // 7. Seed initial commit in MongoGitHubCommit
    if (latestCommit?.sha) {
      await MongoGitHubCommit.updateOne(
        { projectId: project._id, sha: latestCommit.sha },
        {
          $set: {
            projectId: project._id,
            sha: latestCommit.sha,
            message: latestCommit.message,
            author_username: latestCommit.author,
            branch: latestCommit.branch || 'main',
            committed_at: latestCommit.date,
            url: latestCommit.url
          }
        },
        { upsert: true }
      );
    }

    // 8. Broadcast real-time Socket.IO update to project room
    socketService.emitToProjectRoom(project._id.toString(), 'github_project_update', {
      projectId: project._id,
      githubIntegration: project.githubIntegration,
      githubRepository: project.githubRepository,
      message: `Repository "${createdRepo.full_name}" created and connected successfully!`
    });

    return res.status(201).json({
      success: true,
      message: `Repository "${createdRepo.full_name}" created and connected to project "${project.name}" successfully!`,
      project,
      githubIntegration: project.githubIntegration,
      githubRepository: project.githubRepository,
      repository: createdRepo
    });
  } catch (error) {
    console.error('Error creating GitHub repository:', error);
    return res.status(500).json({ error: error.message || 'Failed to create GitHub repository.' });
  }
};

// 6. POST /api/github/repos/:repositoryId/connect (Option B: Import EXISTING GitHub Repository & Connect)
const connectRepositoryToProject = async (req, res) => {
  try {
    const { repositoryId } = req.params;
    const { projectId, repositoryName, repositoryOwner } = req.body;
    const userIdStr = getIdStr(req.user);

    if (!projectId) {
      return res.status(400).json({ error: 'Project ID is required.' });
    }

    // 1. Permission check
    const permCheck = await checkProjectMemberPermission(projectId, userIdStr);
    if (!permCheck.authorized) {
      return res.status(403).json({ error: permCheck.reason });
    }

    const project = permCheck.project;

    // 2. Retrieve user's isolated GitHub credentials
    const authData = await getUserDecryptedToken(userIdStr);
    if (!authData || !authData.token) {
      return res.status(400).json({ error: 'Please connect your GitHub account first.' });
    }

    const targetOwner = repositoryOwner || authData.username;
    const targetName = repositoryName || repositoryId;

    // 3. Server-side verification with GitHub API (NEVER trust frontend data blindly)
    const liveRepo = await githubService.getRepoDetails(authData.token, targetOwner, targetName);
    if (!liveRepo || !liveRepo.id) {
      return res.status(404).json({ error: `Repository "${targetOwner}/${targetName}" could not be verified on GitHub.` });
    }

    const stableRepoId = String(liveRepo.id);

    // 4. Duplicate check: prevent connecting if already connected to another project
    const duplicate = await MongoProject.findOne({
      _id: { $ne: project._id },
      'githubIntegration.repositoryId': stableRepoId
    });

    if (duplicate) {
      return res.status(400).json({ error: 'This repository is already connected to another DevPilot project.' });
    }

    // 5. Fetch live metadata from GitHub (commits, PRs, branches, contributors)
    const [latestCommit, recentCommits, pullRequests, branches, contributors] = await Promise.all([
      githubService.getLatestCommit(authData.token, liveRepo.owner, liveRepo.name),
      githubService.getRepoRecentCommits(authData.token, liveRepo.owner, liveRepo.name, 15),
      githubService.getRepoPullRequests(authData.token, liveRepo.owner, liveRepo.name, 10),
      githubService.getRepoBranches(authData.token, liveRepo.owner, liveRepo.name),
      githubService.getRepoContributors(authData.token, liveRepo.owner, liveRepo.name, 10)
    ]);

    // 6. Register Webhook on GitHub
    const webhookUrl = `${req.protocol}://${req.get('host')}/api/github/webhook`;
    const hookRes = await githubService.createWebhook(
      authData.token,
      liveRepo.owner,
      liveRepo.name,
      webhookUrl,
      WEBHOOK_SECRET
    );
    const webhookId = hookRes?.id ? String(hookRes.id) : null;
    const now = new Date();

    const integrationData = {
      connected: true,
      repositoryId: stableRepoId,
      repositoryName: liveRepo.name,
      repositoryFullName: liveRepo.full_name,
      repositoryOwner: liveRepo.owner,
      repositoryUrl: liveRepo.html_url,
      defaultBranch: liveRepo.default_branch || 'main',
      visibility: liveRepo.private ? 'private' : 'public',
      description: liveRepo.description || '',
      language: liveRepo.language || '',
      stars: liveRepo.stargazers_count || 0,
      forks: liveRepo.forks_count || 0,
      openIssuesCount: liveRepo.open_issues_count || 0,
      webhookId,
      connectedAt: now,
      lastSyncedAt: now,
      latestCommit: latestCommit || null,
      recentCommits: recentCommits || [],
      pullRequests: pullRequests || [],
      branches: branches || [{ name: liveRepo.default_branch || 'main', isDefault: true }],
      contributors: contributors || []
    };

    project.githubIntegration = integrationData;
    project.githubRepository = {
      githubRepositoryId: stableRepoId,
      owner: liveRepo.owner,
      name: liveRepo.name,
      fullName: liveRepo.full_name,
      htmlUrl: liveRepo.html_url,
      defaultBranch: liveRepo.default_branch || 'main',
      description: liveRepo.description || '',
      language: liveRepo.language || '',
      stars: liveRepo.stargazers_count || 0,
      forks: liveRepo.forks_count || 0,
      openIssuesCount: liveRepo.open_issues_count || 0,
      isPrivate: liveRepo.private,
      lastCommit: latestCommit || null,
      connectedAt: now,
      lastSyncedAt: now
    };

    await project.save();

    // 7. Seed initial commits in MongoGitHubCommit
    if (recentCommits && recentCommits.length > 0) {
      for (const rc of recentCommits) {
        await MongoGitHubCommit.updateOne(
          { projectId: project._id, sha: rc.sha },
          {
            $set: {
              projectId: project._id,
              sha: rc.sha,
              message: rc.message,
              author_username: rc.author,
              branch: rc.branch || 'main',
              committed_at: rc.date,
              url: rc.url
            }
          },
          { upsert: true }
        );
      }
    }

    // 8. Update or create ImportedRepository record for secondary compatibility
    await ImportedRepository.findOneAndUpdate(
      { projectId: project._id },
      {
        projectId: project._id,
        repositoryId: stableRepoId,
        repositoryName: liveRepo.name,
        repositoryOwner: liveRepo.owner,
        repositoryUrl: liveRepo.html_url,
        description: liveRepo.description || '',
        isPrivate: liveRepo.private,
        language: liveRepo.language || '',
        stars: liveRepo.stargazers_count || 0,
        forks: liveRepo.forks_count || 0,
        updatedAtDate: now,
        githubUsername: liveRepo.owner,
        importedBy: userIdStr,
        importedAt: now
      },
      { upsert: true, new: true }
    );

    // 9. Broadcast Socket.IO update
    socketService.emitToProjectRoom(project._id.toString(), 'github_project_update', {
      projectId: project._id,
      githubIntegration: project.githubIntegration,
      githubRepository: project.githubRepository,
      message: `Repository "${liveRepo.full_name}" connected successfully!`
    });

    return res.status(200).json({
      success: true,
      message: `Repository "${liveRepo.full_name}" access verified and connected to "${project.name}"!`,
      project,
      githubIntegration: project.githubIntegration,
      githubRepository: project.githubRepository
    });
  } catch (error) {
    console.error('Error connecting repository to project:', error);
    return res.status(500).json({ error: error.message || 'Failed to connect repository to project.' });
  }
};

// 7. POST /api/github/repositories/verify (Repository access verification endpoint)
const verifyRepository = async (req, res) => {
  try {
    const { projectId, repositoryName, repositoryOwner } = req.body;
    const userIdStr = getIdStr(req.user);

    if (!projectId || !repositoryName) {
      return res.status(400).json({ error: 'Project ID and repository name are required.' });
    }

    const permCheck = await checkProjectMemberPermission(projectId, userIdStr);
    if (!permCheck.authorized) {
      return res.status(403).json({ verified: false, error: permCheck.reason });
    }

    const authData = await getUserDecryptedToken(userIdStr);
    if (!authData || !authData.token) {
      return res.status(400).json({ verified: false, error: 'GitHub account is not connected.' });
    }

    const owner = repositoryOwner || authData.username;
    const repoDetails = await githubService.getRepoDetails(authData.token, owner, repositoryName);

    return res.status(200).json({
      verified: true,
      repository: repoDetails,
      checks: {
        authentication: { status: 'PASSED', detail: `Authenticated as @${authData.username}` },
        repositoryAccess: { status: 'PASSED', detail: `Access verified for ${repoDetails.full_name}` },
        webhookReadiness: { status: 'PASSED', detail: 'DevPilot Webhook endpoint ready' }
      },
      message: `Repository "${repoDetails.full_name}" successfully verified.`
    });
  } catch (error) {
    console.error('Repository verification error:', error);
    return res.status(400).json({ verified: false, error: error.message || 'Repository verification failed.' });
  }
};

// 8. DELETE /api/github/repos/:repositoryId/disconnect (Disconnect Repository from Project)
const disconnectRepositoryFromProject = async (req, res) => {
  try {
    const { repositoryId, id } = req.params;
    const targetId = repositoryId || id;
    const { projectId } = req.query;
    const userIdStr = getIdStr(req.user);

    let project = null;
    if (projectId) {
      project = await MongoProject.findById(projectId);
    } else {
      project = await MongoProject.findOne({
        $or: [
          { _id: targetId },
          { 'githubRepository.githubRepositoryId': targetId },
          { 'githubIntegration.repositoryId': targetId }
        ]
      });
    }

    if (!project) {
      return res.status(404).json({ error: 'Connected project or repository not found.' });
    }

    const permCheck = await checkProjectMemberPermission(project._id, userIdStr);
    if (!permCheck.authorized) {
      return res.status(403).json({ error: permCheck.reason });
    }

    // Attempt to delete webhook on GitHub
    const authData = await getUserDecryptedToken(userIdStr);
    const owner = project.githubIntegration?.repositoryOwner || project.githubRepository?.owner;
    const repoName = project.githubIntegration?.repositoryName || project.githubRepository?.name;
    const webhookId = project.githubIntegration?.webhookId;

    if (authData?.token && owner && repoName && webhookId) {
      await githubService.deleteWebhook(authData.token, owner, repoName, webhookId);
    }

    // Reset project github fields
    project.githubIntegration = {
      connected: false,
      repositoryId: null,
      repositoryName: null,
      repositoryFullName: null,
      repositoryOwner: null,
      repositoryUrl: null,
      defaultBranch: 'main',
      visibility: 'public',
      description: '',
      language: '',
      stars: 0,
      forks: 0,
      openIssuesCount: 0,
      webhookId: null,
      connectedAt: null,
      lastSyncedAt: null,
      latestCommit: null,
      recentCommits: [],
      pullRequests: [],
      branches: [],
      contributors: []
    };

    project.githubRepository = {
      githubRepositoryId: null,
      owner: null,
      name: null,
      fullName: null,
      htmlUrl: null,
      defaultBranch: 'main',
      description: '',
      language: '',
      stars: 0,
      forks: 0,
      openIssuesCount: 0,
      isPrivate: false,
      lastCommit: null,
      connectedAt: null,
      lastSyncedAt: null
    };

    await project.save();
    await ImportedRepository.deleteMany({ projectId: project._id });

    // Emit live socket event
    socketService.emitToProjectRoom(project._id.toString(), 'github_project_update', {
      projectId: project._id,
      disconnected: true,
      message: 'GitHub repository disconnected from project.'
    });

    return res.status(200).json({
      success: true,
      message: 'GitHub repository disconnected from project successfully.'
    });
  } catch (error) {
    console.error('Disconnect repository error:', error);
    return res.status(500).json({ error: error.message || 'Failed to disconnect repository.' });
  }
};

// 9. POST /api/github/repos/:repositoryId/sync (On-Demand Refresh & Sync Project Repository)
const syncProjectRepository = async (req, res) => {
  try {
    const { repositoryId } = req.params;
    const { projectId } = req.body;
    const targetProjectId = projectId || req.query.projectId;
    const userIdStr = getIdStr(req.user);

    if (!targetProjectId) {
      return res.status(400).json({ error: 'Project ID is required.' });
    }

    const permCheck = await checkProjectMemberPermission(targetProjectId, userIdStr);
    if (!permCheck.authorized) {
      return res.status(403).json({ error: permCheck.reason });
    }

    const project = permCheck.project;
    const owner = project.githubIntegration?.repositoryOwner || project.githubRepository?.owner;
    const repoName = project.githubIntegration?.repositoryName || project.githubRepository?.name || repositoryId;

    if (!owner || !repoName) {
      return res.status(400).json({ error: 'Project does not have a linked repository to sync.' });
    }

    const authData = await getUserDecryptedToken(userIdStr);
    const token = authData?.token || null;

    const [liveRepo, latestCommit, recentCommits, pullRequests, branches, contributors] = await Promise.all([
      githubService.getRepoDetails(token, owner, repoName).catch(() => null),
      githubService.getLatestCommit(token, owner, repoName),
      githubService.getRepoRecentCommits(token, owner, repoName, 15),
      githubService.getRepoPullRequests(token, owner, repoName, 10),
      githubService.getRepoBranches(token, owner, repoName),
      githubService.getRepoContributors(token, owner, repoName, 10)
    ]);

    const now = new Date();
    if (project.githubIntegration) {
      project.githubIntegration.lastSyncedAt = now;
      if (latestCommit) project.githubIntegration.latestCommit = latestCommit;
      if (recentCommits && recentCommits.length > 0) project.githubIntegration.recentCommits = recentCommits;
      if (pullRequests) project.githubIntegration.pullRequests = pullRequests;
      if (branches) project.githubIntegration.branches = branches;
      if (contributors) project.githubIntegration.contributors = contributors;
      if (liveRepo) {
        project.githubIntegration.stars = liveRepo.stargazers_count ?? project.githubIntegration.stars;
        project.githubIntegration.forks = liveRepo.forks_count ?? project.githubIntegration.forks;
        project.githubIntegration.description = liveRepo.description || project.githubIntegration.description;
      }
    }

    if (project.githubRepository) {
      project.githubRepository.lastSyncedAt = now;
      if (latestCommit) project.githubRepository.lastCommit = latestCommit;
      if (liveRepo) {
        project.githubRepository.stars = liveRepo.stargazers_count ?? project.githubRepository.stars;
        project.githubRepository.forks = liveRepo.forks_count ?? project.githubRepository.forks;
        project.githubRepository.description = liveRepo.description || project.githubRepository.description;
      }
    }

    await project.save();

    socketService.emitToProjectRoom(targetProjectId.toString(), 'github_project_update', {
      projectId: targetProjectId,
      githubIntegration: project.githubIntegration,
      githubRepository: project.githubRepository,
      message: `Repository ${owner}/${repoName} synchronized successfully.`
    });

    return res.status(200).json({
      success: true,
      message: `Repository ${owner}/${repoName} synchronized successfully!`,
      project,
      githubIntegration: project.githubIntegration,
      githubRepository: project.githubRepository
    });
  } catch (error) {
    console.error('Sync project repository error:', error);
    return res.status(500).json({ error: error.message || 'Failed to synchronize repository.' });
  }
};

// 10. DELETE /api/github/disconnect (Disconnect User's GitHub Account Connection)
const disconnectGitHub = async (req, res) => {
  try {
    const userIdStr = getIdStr(req.user);
    if (!userIdStr) {
      return res.status(401).json({ error: 'Authentication required.' });
    }

    // Clear GitHubConnection table
    await GitHubConnection.findOneAndUpdate(
      { userId: userIdStr },
      { status: 'disconnected', connected: false, accessToken: '' }
    );

    // Clear User embedded github connection
    if (mongoose.isValidObjectId(userIdStr)) {
      await MongoUser.findByIdAndUpdate(userIdStr, {
        githubUsername: null,
        github: {
          githubUserId: null,
          username: null,
          connected: false,
          accessToken: null,
          avatarUrl: null,
          profileUrl: null,
          email: null,
          connectedAt: null,
          lastSyncedAt: null
        }
      });
    }

    return res.status(200).json({
      success: true,
      message: 'GitHub account disconnected successfully.'
    });
  } catch (error) {
    console.error('Disconnect GitHub error:', error);
    return res.status(500).json({ error: error.message || 'Failed to disconnect GitHub account.' });
  }
};

// 11. POST /api/github/webhook (Live Webhook Synchronization for push, PR, issues)
const handleWebhook = async (req, res) => {
  try {
    const event = req.headers['x-github-event'] || 'push';

    // 1. Verify HMAC-SHA256 signature if configured in environment
    if (process.env.GITHUB_WEBHOOK_SECRET) {
      const isValid = verifyGitHubSignature(req);
      if (!isValid) {
        console.warn('GitHub webhook signature mismatch. Rejecting unauthorized webhook payload.');
        return res.status(401).json({ error: 'Invalid webhook signature.' });
      }
    }

    const payload = req.body || {};
    const repoName = payload.repository?.name;
    const repoFullName = payload.repository?.full_name;
    const repoId = payload.repository?.id ? String(payload.repository.id) : null;
    const ownerName = payload.repository?.owner?.login || payload.repository?.owner?.name || 'developer';

    if (!repoName && !repoFullName && !repoId) {
      return res.status(400).json({ error: 'Malformed webhook payload: repository identifier missing.' });
    }

    // 2. Find connected project matching this repository
    const project = await MongoProject.findOne({
      $or: [
        { 'githubIntegration.repositoryId': repoId },
        { 'githubIntegration.repositoryFullName': repoFullName },
        { 'githubIntegration.repositoryName': repoName },
        { 'githubRepository.githubRepositoryId': repoId },
        { 'githubRepository.fullName': repoFullName },
        { 'githubRepository.name': repoName }
      ]
    });

    if (!project) {
      console.log(`Webhook received for repository ${repoFullName || repoName}, but no matching DevPilot project found.`);
      return res.status(200).json({ status: 'IGNORED', message: 'Repository not linked to any active DevPilot project.' });
    }

    const now = new Date();
    const branchName = payload.ref
      ? payload.ref.replace('refs/heads/', '')
      : (project.githubIntegration?.defaultBranch || 'main');

    // 3. Handle push event
    if (event === 'push' || payload.commits) {
      const commitsList = Array.isArray(payload.commits) && payload.commits.length > 0
        ? payload.commits
        : (payload.head_commit ? [payload.head_commit] : []);

      for (const c of commitsList) {
        const commitSha = c.id || c.sha || crypto.randomBytes(8).toString('hex');
        const commitMsg = c.message || 'Updated project codebase';
        const commitAuthor = c.author?.username || c.author?.name || c.committer?.username || ownerName;
        const commitDate = c.timestamp ? new Date(c.timestamp) : now;
        const commitUrl = c.url || payload.repository?.html_url || `https://github.com/${repoFullName}/commit/${commitSha}`;

        // Save commit to MongoGitHubCommit
        try {
          await MongoGitHubCommit.updateOne(
            { projectId: project._id, sha: commitSha },
            {
              $set: {
                projectId: project._id,
                sha: commitSha,
                message: commitMsg,
                author_username: commitAuthor,
                branch: branchName,
                committed_at: commitDate,
                url: commitUrl
              }
            },
            { upsert: true }
          );
        } catch (wErr) {
          console.warn('Note on webhook commit saving:', wErr.message);
        }

        const newCommitObj = {
          sha: commitSha.substring(0, 7),
          fullSha: commitSha,
          message: commitMsg,
          author: commitAuthor,
          authorAvatar: `https://avatars.githubusercontent.com/${commitAuthor}`,
          date: commitDate,
          url: commitUrl,
          branch: branchName
        };

        if (project.githubIntegration) {
          project.githubIntegration.latestCommit = newCommitObj;
          const existingRecent = project.githubIntegration.recentCommits || [];
          project.githubIntegration.recentCommits = [
            newCommitObj,
            ...existingRecent.filter((rc) => rc.sha !== newCommitObj.sha)
          ].slice(0, 20);
          project.githubIntegration.lastSyncedAt = now;
        }

        if (project.githubRepository) {
          project.githubRepository.lastCommit = newCommitObj;
          project.githubRepository.lastSyncedAt = now;
        }

        // Broadcast real-time Socket.IO event
        socketService.emitToProjectRoom(project._id.toString(), 'github_activity', newCommitObj);
        socketService.emitToProjectRoom(project._id.toString(), 'github_project_update', {
          projectId: project._id,
          latestCommit: newCommitObj,
          event: 'push',
          message: `New commit pushed: "${commitMsg}" by @${commitAuthor}`
        });
      }
    }

    // 4. Handle pull_request event
    if (event === 'pull_request' && payload.pull_request) {
      const pr = payload.pull_request;
      const prObj = {
        number: pr.number,
        title: pr.title,
        state: pr.merged ? 'merged' : pr.state,
        author: pr.user?.login || ownerName,
        authorAvatar: pr.user?.avatar_url || '',
        createdAt: pr.created_at ? new Date(pr.created_at) : now,
        url: pr.html_url,
        branch: pr.head?.ref || branchName
      };

      if (project.githubIntegration) {
        const currentPRs = project.githubIntegration.pullRequests || [];
        project.githubIntegration.pullRequests = [
          prObj,
          ...currentPRs.filter((p) => p.number !== pr.number)
        ].slice(0, 15);
        project.githubIntegration.lastSyncedAt = now;
      }

      socketService.emitToProjectRoom(project._id.toString(), 'github_activity', {
        type: 'pull_request',
        message: `PR #${pr.number} "${pr.title}" (${payload.action}) by @${prObj.author}`,
        url: pr.html_url
      });

      socketService.emitToProjectRoom(project._id.toString(), 'github_project_update', {
        projectId: project._id,
        event: 'pull_request',
        message: `Pull Request #${pr.number} "${pr.title}" updated by @${prObj.author}`
      });
    }

    // 5. Handle repository metadata changes (stars, description)
    if (payload.repository) {
      if (project.githubIntegration) {
        project.githubIntegration.stars = payload.repository.stargazers_count ?? project.githubIntegration.stars;
        project.githubIntegration.forks = payload.repository.forks_count ?? project.githubIntegration.forks;
        project.githubIntegration.openIssuesCount = payload.repository.open_issues_count ?? project.githubIntegration.openIssuesCount;
        project.githubIntegration.description = payload.repository.description || project.githubIntegration.description;
        project.githubIntegration.lastSyncedAt = now;
      }
      if (project.githubRepository) {
        project.githubRepository.stars = payload.repository.stargazers_count ?? project.githubRepository.stars;
        project.githubRepository.forks = payload.repository.forks_count ?? project.githubRepository.forks;
        project.githubRepository.openIssuesCount = payload.repository.open_issues_count ?? project.githubRepository.openIssuesCount;
        project.githubRepository.description = payload.repository.description || project.githubRepository.description;
        project.githubRepository.lastSyncedAt = now;
      }
    }

    await project.save();

    return res.status(200).json({ status: 'OK', message: 'Webhook event processed and broadcast successfully.' });
  } catch (error) {
    console.error('Webhook processing error:', error);
    return res.status(500).json({ error: error.message || 'Webhook processing failed.' });
  }
};

// 12. GET /api/github/repositories/:id (Inspect single repository details)
const getRepositoryById = async (req, res) => {
  try {
    const { id } = req.params;
    const project = await MongoProject.findById(id);

    if (project && project.githubIntegration?.repositoryName) {
      const commits = await MongoGitHubCommit.find({ projectId: project._id })
        .sort({ committed_at: -1 })
        .limit(20);

      return res.status(200).json({
        projectId: project._id,
        repositoryId: project.githubIntegration.repositoryId,
        repositoryName: project.githubIntegration.repositoryName,
        repositoryFullName: project.githubIntegration.repositoryFullName,
        repositoryOwner: project.githubIntegration.repositoryOwner,
        repositoryUrl: project.githubIntegration.repositoryUrl,
        description: project.githubIntegration.description,
        visibility: project.githubIntegration.visibility,
        language: project.githubIntegration.language,
        stars: project.githubIntegration.stars,
        forks: project.githubIntegration.forks,
        defaultBranch: project.githubIntegration.defaultBranch,
        lastCommit: project.githubIntegration.latestCommit,
        lastSyncedAt: project.githubIntegration.lastSyncedAt,
        commits
      });
    }

    const imp = (await ImportedRepository.findById(id)) || (await ImportedRepository.findOne({ projectId: id }));
    if (!imp) {
      return res.status(404).json({ error: 'Connected repository not found.' });
    }

    const commits = await MongoGitHubCommit.find({ projectId: imp.projectId })
      .sort({ committed_at: -1 })
      .limit(20);

    return res.status(200).json({
      ...imp.toObject(),
      commits
    });
  } catch (error) {
    console.error('Error fetching repository details:', error);
    return res.status(500).json({ error: 'Failed to fetch repository details.' });
  }
};

// 13. GET /api/github/repositories/:id/files (Fetch repository file tree)
const getRepositoryFiles = async (req, res) => {
  try {
    const { id } = req.params;
    const userIdStr = getIdStr(req.user);

    let project = await MongoProject.findById(id);
    let repoName = project?.githubIntegration?.repositoryName || project?.githubRepository?.name;
    let repoOwner = project?.githubIntegration?.repositoryOwner || project?.githubRepository?.owner;

    if (!repoName) {
      const imp = (await ImportedRepository.findById(id)) || (await ImportedRepository.findOne({ projectId: id }));
      if (imp) {
        repoName = imp.repositoryName;
        repoOwner = imp.repositoryOwner;
      }
    }

    if (!repoName || !repoOwner) {
      return res.status(404).json({ error: 'Repository not found.' });
    }

    const authData = await getUserDecryptedToken(userIdStr);
    const token = authData?.token || null;

    const files = await githubService.getRepoFiles(token, repoOwner, repoName);

    return res.status(200).json({
      repositoryName: repoName,
      repositoryOwner: repoOwner,
      files
    });
  } catch (error) {
    console.error('Error fetching repository files:', error);
    return res.status(500).json({ error: 'Failed to fetch repository files.' });
  }
};

// 14. POST /api/github/repositories/:id/analyze (AI Codebase Analysis)
const analyzeRepository = async (req, res) => {
  try {
    const { id } = req.params;
    const userIdStr = getIdStr(req.user);

    let project = await MongoProject.findById(id);
    let repoName = project?.githubIntegration?.repositoryName || project?.githubRepository?.name;
    let repoOwner = project?.githubIntegration?.repositoryOwner || project?.githubRepository?.owner;

    if (!repoName || !repoOwner) {
      return res.status(404).json({ error: 'Connected repository not found.' });
    }

    const authData = await getUserDecryptedToken(userIdStr);
    const token = authData?.token || null;

    const analysisReport = await githubService.analyzeRepository(token, repoOwner, repoName);

    if (project && analysisReport.detectedTechnologies.length > 0) {
      project.tech_stack = analysisReport.detectedTechnologies.join(', ');
      project.technologyStack = analysisReport.detectedTechnologies.join(', ');
      await project.save();
    }

    return res.status(200).json({
      success: true,
      message: 'Repository analyzed successfully.',
      analysis: analysisReport
    });
  } catch (error) {
    console.error('Error analyzing repository:', error);
    return res.status(500).json({ error: 'Failed to analyze repository.' });
  }
};

module.exports = {
  getAuthUrl,
  connect,
  callback,
  getStatus,
  getRepositories,
  syncUserRepositories,
  createRepository,
  connectRepositoryToProject,
  verifyRepository,
  disconnectRepositoryFromProject,
  syncProjectRepository,
  disconnectGitHub,
  handleWebhook,
  getRepositoryById,
  getRepositoryFiles,
  analyzeRepository
};
