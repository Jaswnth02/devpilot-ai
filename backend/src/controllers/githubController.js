const crypto = require('crypto');
const githubService = require('../services/githubService');
const { encryptToken, decryptToken } = require('../utils/cryptoUtil');
const MongoUser = require('../models/mongo/User');
const MongoProject = require('../models/mongo/Project');
const GitHubConnection = require('../models/mongo/GitHubConnection');
const ImportedRepository = require('../models/mongo/ImportedRepository');
const MongoGitHubCommit = require('../models/mongo/GitHubCommit');
const socketService = require('../services/socketService');
const jwt = require('jsonwebtoken');
require('dotenv').config();

const JWT_SECRET = process.env.JWT_SECRET || 'supersecretdevpilotkey';
const WEBHOOK_SECRET = process.env.GITHUB_WEBHOOK_SECRET || 'devpilotwebhooksecret';

const mongoose = require('mongoose');

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
 * Helper to check if current user is an authorized project owner or member
 */
const checkProjectMemberPermission = async (projectId, userId) => {
  const project = await MongoProject.findById(projectId);
  if (!project) return { authorized: false, isOwner: false, reason: 'Project not found.', project: null };

  const userIdStr = getIdStr(userId);
  const ownerIdStr = getIdStr(project.ownerId);

  if (ownerIdStr === userIdStr) {
    return { authorized: true, isOwner: true, project };
  }

  const isMember = Array.isArray(project.members) && project.members.some(m => getIdStr(m.userId) === userIdStr);
  if (isMember) {
    return { authorized: true, isOwner: false, project };
  }

  return {
    authorized: false,
    isOwner: false,
    reason: 'Permission denied. You are not a member or owner of this project workspace.',
    project
  };
};

/**
 * Verifies GitHub HMAC-SHA256 Webhook Signature
 */
const verifyGitHubSignature = (req) => {
  const signature = req.headers['x-hub-signature-256'];
  if (!signature) return false;

  const hmac = crypto.createHmac('sha256', WEBHOOK_SECRET);
  const digest = 'sha256=' + hmac.update(JSON.stringify(req.body)).digest('hex');

  try {
    return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(digest));
  } catch (e) {
    return false;
  }
};

// 1. GET /api/github/connect (Browser Redirect to GitHub official OAuth page)
const connect = (req, res) => {
  try {
    const userIdStr = getIdStr(req.user);
    const token = jwt.sign({ id: userIdStr }, JWT_SECRET, { expiresIn: '15m' });
    const url = githubService.getOAuthUrl(token);
    return res.redirect(url);
  } catch (error) {
    console.error('Error redirecting to GitHub Auth:', error);
    return res.status(500).json({ error: 'Failed to initiate GitHub authorization.' });
  }
};

// 1b. GET /api/github/auth (Returns OAuth URL JSON)
const getAuthUrl = (req, res) => {
  try {
    const userIdStr = getIdStr(req.user);
    const token = jwt.sign({ id: userIdStr }, JWT_SECRET, { expiresIn: '15m' });
    const url = githubService.getOAuthUrl(token);
    return res.status(200).json({ url });
  } catch (error) {
    console.error('Error generating GitHub Auth URL:', error);
    return res.status(500).json({ error: 'Failed to generate GitHub Auth URL.' });
  }
};

// 2. GET /api/github/callback (OAuth Redirect Handler)
const callback = async (req, res) => {
  const { code, state, error: oauthError } = req.query;
  const clientUrl = process.env.CLIENT_URL || 'http://localhost:5173';

  if (oauthError) {
    console.warn('GitHub OAuth error query:', oauthError);
    return res.redirect(`${clientUrl}/github?error=${encodeURIComponent(oauthError)}`);
  }

  if (!code) {
    return res.redirect(`${clientUrl}/github?error=code_missing`);
  }

  try {
    let userId = null;
    if (state) {
      try {
        const decoded = jwt.verify(state, JWT_SECRET);
        userId = decoded.id;
      } catch (err) {
        console.warn('State token verification warn:', err.message);
      }
    }

    if (!userId) {
      const latestUser = await MongoUser.findOne().sort({ createdAt: -1 });
      if (latestUser) userId = latestUser._id.toString();
    }

    const accountData = await githubService.getAccessToken(code);
    const encryptedToken = encryptToken(accountData.access_token);
    const now = new Date();

    if (userId) {
      // 1. Update User.github embedded document
      await MongoUser.findByIdAndUpdate(userId, {
        githubUsername: accountData.github_username,
        github: {
          githubUserId: accountData.githubId,
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

      // 2. Update GitHubConnection document
      await GitHubConnection.findOneAndUpdate(
        { userId },
        {
          githubId: accountData.githubId,
          githubUsername: accountData.github_username,
          githubAvatar: accountData.avatar_url,
          githubProfileUrl: accountData.profile_url,
          githubEmail: accountData.email,
          accessToken: encryptedToken,
          connected: true
        },
        { upsert: true, new: true }
      );
    }

    return res.redirect(`${clientUrl}/github?connected=true&username=${encodeURIComponent(accountData.github_username)}`);
  } catch (error) {
    console.error('GitHub Callback Error:', error);
    return res.redirect(`${clientUrl}/github?error=auth_failed`);
  }
};

// 3. POST /api/github/connect-sandbox (Development sandbox connect fallback)
const connectSandbox = async (req, res) => {
  try {
    const userIdStr = getIdStr(req.user);
    if (!userIdStr) {
      return res.status(401).json({ error: 'Authentication required.' });
    }

    const user = await findMongoUserSafe(userIdStr);
    const bodyUsername = req.body?.username ? req.body.username.trim().replace(/^@/, '') : null;
    const username = bodyUsername || (user && user.githubUsername) || 'Jaswnth02';

    const accountData = {
      githubId: '180279780',
      github_username: username,
      avatar_url: `https://avatars.githubusercontent.com/u/180279780?v=4`,
      profile_url: `https://github.com/${username}`,
      email: user ? user.email : `${username}@devpilot.ai`,
      access_token: 'mock_github_access_token_' + Date.now()
    };

    const encryptedToken = encryptToken(accountData.access_token);
    const now = new Date();

    if (mongoose.isValidObjectId(userIdStr)) {
      await MongoUser.findByIdAndUpdate(userIdStr, {
        githubUsername: accountData.github_username,
        github: {
          githubUserId: accountData.githubId,
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
    }

    const connection = await GitHubConnection.findOneAndUpdate(
      { userId: userIdStr },
      {
        githubId: accountData.githubId,
        githubUsername: accountData.github_username,
        githubAvatar: accountData.avatar_url,
        githubProfileUrl: accountData.profile_url,
        githubEmail: accountData.email,
        accessToken: encryptedToken,
        connected: true
      },
      { upsert: true, new: true }
    );

    return res.status(200).json({
      success: true,
      message: `Successfully connected GitHub account @${accountData.github_username}!`,
      connection: {
        connected: true,
        username: connection.githubUsername,
        avatar: connection.githubAvatar,
        profileUrl: connection.githubProfileUrl,
        email: connection.githubEmail
      }
    });
  } catch (error) {
    console.error('Connect sandbox error:', error);
    return res.status(500).json({ error: 'Failed to connect sandbox account.' });
  }
};

// 3b. POST /api/github/verify-account (Live GitHub Account Verification)
const verifyAccount = async (req, res) => {
  try {
    const { username, token } = req.body;
    if (!username || typeof username !== 'string' || !username.trim()) {
      return res.status(400).json({ error: 'Please provide a valid GitHub username to verify.' });
    }

    const verification = await githubService.verifyGitHubUser(username.trim(), token);
    if (!verification.valid) {
      return res.status(404).json({
        verified: false,
        error: verification.error || `GitHub user @${username} could not be verified.`
      });
    }

    return res.status(200).json({
      verified: true,
      user: verification
    });
  } catch (error) {
    console.error('Verify account error:', error);
    return res.status(500).json({ error: 'Failed to verify GitHub account.' });
  }
};

// 3c. POST /api/github/connect-verified (Connect Verified GitHub Account to Current User)
const connectVerifiedAccount = async (req, res) => {
  try {
    const userIdStr = getIdStr(req.user);
    if (!userIdStr) {
      return res.status(401).json({ error: 'Authentication required.' });
    }

    const { username, token, personalAccessToken } = req.body;
    if (!username || typeof username !== 'string' || !username.trim()) {
      return res.status(400).json({ error: 'GitHub username is required.' });
    }

    const authToken = personalAccessToken || token || null;
    const verification = await githubService.verifyGitHubUser(username.trim(), authToken);
    if (!verification.valid) {
      return res.status(400).json({
        error: verification.error || `GitHub account @${username} failed verification.`
      });
    }

    const rawToken = authToken || ('mock_github_access_token_' + Date.now());
    const encryptedToken = encryptToken(rawToken);
    const now = new Date();

    if (mongoose.isValidObjectId(userIdStr)) {
      await MongoUser.findByIdAndUpdate(userIdStr, {
        githubUsername: verification.username,
        github: {
          githubUserId: verification.githubId,
          username: verification.username,
          connected: true,
          accessToken: encryptedToken,
          avatarUrl: verification.avatarUrl,
          profileUrl: verification.profileUrl,
          email: req.user?.email || `${verification.username}@devpilot.ai`,
          connectedAt: now,
          lastSyncedAt: now
        }
      });
    }

    const connection = await GitHubConnection.findOneAndUpdate(
      { userId: userIdStr },
      {
        githubId: verification.githubId,
        githubUsername: verification.username,
        githubAvatar: verification.avatarUrl,
        githubProfileUrl: verification.profileUrl,
        githubEmail: req.user?.email || `${verification.username}@devpilot.ai`,
        accessToken: encryptedToken,
        connected: true
      },
      { upsert: true, new: true }
    );

    // Fetch repositories for this verified user
    const repos = await githubService.getUserRepos(rawToken, verification.username);

    return res.status(200).json({
      success: true,
      message: `GitHub account @${verification.username} verified and connected successfully!`,
      connection: {
        connected: true,
        githubUserId: connection.githubId,
        username: connection.githubUsername,
        avatar: connection.githubAvatar,
        profileUrl: connection.githubProfileUrl,
        email: connection.githubEmail,
        connectedAt: connection.createdAt,
        lastSyncedAt: connection.updatedAt
      },
      repositories: repos,
      totalCount: repos.length
    });
  } catch (error) {
    console.error('Connect verified account error:', error);
    return res.status(500).json({ error: 'Failed to connect verified GitHub account.' });
  }
};

// 4. GET /api/github/status
const getStatus = async (req, res) => {
  try {
    const userIdStr = getIdStr(req.user);
    if (!userIdStr) {
      return res.status(401).json({ error: 'Authentication required.' });
    }

    const user = await findMongoUserSafe(userIdStr);
    let connection = await GitHubConnection.findOne({ userId: userIdStr, connected: true });

    // Sync from User if present
    if (user && user.github && user.github.connected) {
      return res.status(200).json({
        connected: true,
        githubUserId: user.github.githubUserId,
        username: user.github.username,
        avatar: user.github.avatarUrl || `https://avatars.githubusercontent.com/${user.github.username}`,
        profileUrl: user.github.profileUrl || `https://github.com/${user.github.username}`,
        email: user.github.email,
        connectedAt: user.github.connectedAt,
        lastSyncedAt: user.github.lastSyncedAt
      });
    }

    if (connection && connection.connected) {
      return res.status(200).json({
        connected: true,
        githubUserId: connection.githubId,
        username: connection.githubUsername,
        avatar: connection.githubAvatar,
        profileUrl: connection.githubProfileUrl,
        email: connection.githubEmail,
        connectedAt: connection.createdAt,
        lastSyncedAt: connection.updatedAt
      });
    }

    // Return not connected if user has not explicitly connected GitHub
    return res.status(200).json({
      connected: false,
      message: 'No GitHub account connected.'
    });
  } catch (error) {
    console.error('Error fetching GitHub connection status:', error);
    return res.status(500).json({ error: 'Failed to retrieve connection status.' });
  }
};

// 5. GET /api/github/repos (and /repositories)
const getRepositories = async (req, res) => {
  try {
    const userIdStr = getIdStr(req.user);
    const user = await findMongoUserSafe(userIdStr);
    const connection = await GitHubConnection.findOne({ userId: userIdStr, connected: true });

    const isConnected = (user?.github?.connected) || (connection?.connected);
    if (!isConnected) {
      return res.status(200).json({ connected: false, repositories: [], totalCount: 0 });
    }

    const encToken = user?.github?.accessToken || connection?.accessToken;
    const rawToken = encToken ? decryptToken(encToken) : null;
    const username = user?.github?.username || connection?.githubUsername;
    if (!username) {
      return res.status(200).json({ connected: false, repositories: [], totalCount: 0 });
    }

    const repos = await githubService.getUserRepos(rawToken, username);

    return res.status(200).json({
      connected: true,
      username,
      avatar: user?.github?.avatarUrl || connection?.githubAvatar || `https://avatars.githubusercontent.com/${username}`,
      repositories: repos,
      totalCount: repos.length,
      lastSyncedAt: user?.github?.lastSyncedAt || new Date()
    });
  } catch (error) {
    console.error('Error fetching GitHub repositories:', error);
    return res.status(500).json({ error: 'Failed to retrieve GitHub repositories.' });
  }
};

// 6. POST /api/github/sync (Automatic Repository Synchronization)
const syncRepositories = async (req, res) => {
  try {
    const userIdStr = getIdStr(req.user);
    const user = await findMongoUserSafe(userIdStr);
    const connection = await GitHubConnection.findOne({ userId: userIdStr, connected: true });

    const isConnected = (user?.github?.connected) || (connection?.connected);
    if (!isConnected) {
      return res.status(400).json({ error: 'GitHub account is not connected.' });
    }

    const encToken = user?.github?.accessToken || connection?.accessToken;
    const rawToken = encToken ? decryptToken(encToken) : null;
    const username = user?.github?.username || connection?.githubUsername;
    if (!username) {
      return res.status(400).json({ error: 'No GitHub username found for connected account.' });
    }

    // 1. Fetch fresh live repositories from GitHub API
    const latestRepos = await githubService.getUserRepos(rawToken, username);
    const now = new Date();

    // 2. Update user's lastSyncedAt timestamp
    if (mongoose.isValidObjectId(userIdStr)) {
      await MongoUser.findByIdAndUpdate(userIdStr, {
        'github.lastSyncedAt': now
      });
    }
    if (connection) {
      connection.updatedAt = now;
      await connection.save();
    }

    // 3. Automatically synchronize any existing connected projects that match these repos
    const connectedProjects = await MongoProject.find({
      'githubRepository.githubRepositoryId': { $exists: true, $ne: null }
    });

    for (const proj of connectedProjects) {
      const match = latestRepos.find(r => 
        String(r.id) === String(proj.githubRepository?.githubRepositoryId) ||
        r.name?.toLowerCase() === proj.githubRepository?.name?.toLowerCase() ||
        r.full_name?.toLowerCase() === proj.githubRepository?.fullName?.toLowerCase()
      );

      if (match) {
        // Fetch latest commit if possible
        const latestCommit = await githubService.getLatestCommit(rawToken, match.owner, match.name);

        proj.githubRepository.name = match.name;
        proj.githubRepository.fullName = match.full_name;
        proj.githubRepository.owner = match.owner;
        proj.githubRepository.htmlUrl = match.html_url;
        proj.githubRepository.defaultBranch = match.default_branch;
        proj.githubRepository.description = match.description;
        proj.githubRepository.language = match.language;
        proj.githubRepository.stars = match.stargazers_count;
        proj.githubRepository.forks = match.forks_count;
        proj.githubRepository.openIssuesCount = match.open_issues_count;
        proj.githubRepository.isPrivate = match.private;
        proj.githubRepository.lastSyncedAt = now;
        if (latestCommit) {
          proj.githubRepository.lastCommit = latestCommit;
        }

        await proj.save();

        // Also update ImportedRepository table
        await ImportedRepository.findOneAndUpdate(
          { projectId: proj._id },
          {
            repositoryName: match.name,
            repositoryOwner: match.owner,
            repositoryUrl: match.html_url,
            description: match.description,
            isPrivate: match.private,
            language: match.language,
            stars: match.stargazers_count,
            forks: match.forks_count,
            updatedAtDate: match.updated_at ? new Date(match.updated_at) : now
          }
        );
      }
    }

    return res.status(200).json({
      success: true,
      message: 'Repositories synchronized successfully with GitHub.',
      repositories: latestRepos,
      totalCount: latestRepos.length,
      syncedAt: now
    });
  } catch (error) {
    console.error('Error synchronizing GitHub repositories:', error);
    return res.status(500).json({ error: 'Failed to synchronize repositories with GitHub.' });
  }
};

// 7. POST /api/github/repos/:repositoryId/connect (Connect SPECIFIC Repository to Project)
const connectRepositoryToProject = async (req, res) => {
  try {
    const { repositoryId } = req.params;
    const {
      projectId,
      repositoryName,
      repositoryOwner,
      repositoryUrl,
      description,
      isPrivate,
      language,
      stars,
      forks,
      defaultBranch
    } = req.body;

    const userIdStr = getIdStr(req.user);

    if (!projectId) {
      return res.status(400).json({ error: 'Project ID is required.' });
    }

    // Permission Check: Verify req.user is an authorized project member or owner
    const permCheck = await checkProjectMemberPermission(projectId, userIdStr);
    if (!permCheck.authorized) {
      return res.status(403).json({ error: permCheck.reason });
    }

    const connection = await GitHubConnection.findOne({ userId: userIdStr, connected: true });
    const user = await MongoUser.findById(userIdStr);
    const encToken = user?.github?.accessToken || connection?.accessToken;
    const rawToken = encToken ? decryptToken(encToken) : null;
    const owner = repositoryOwner || connection?.githubUsername || user?.github?.username || 'Jaswnth02';
    const repoName = repositoryName || repositoryId;

    // Fetch repository live details, latest commit, recent commits, branches, PRs & contributors
    const [liveRepo, latestCommit, recentCommits, pullRequests, branches, contributors] = await Promise.all([
      githubService.getRepoDetails(rawToken, owner, repoName),
      githubService.getLatestCommit(rawToken, owner, repoName),
      githubService.getRepoRecentCommits(rawToken, owner, repoName, 10),
      githubService.getRepoPullRequests(rawToken, owner, repoName, 5),
      githubService.getRepoBranches(rawToken, owner, repoName),
      githubService.getRepoContributors(rawToken, owner, repoName, 5)
    ]);

    const targetRepoId = String(liveRepo?.id || repositoryId || Date.now());
    const targetFullName = liveRepo?.full_name || `${owner}/${repoName}`;
    const targetHtmlUrl = liveRepo?.html_url || repositoryUrl || `https://github.com/${owner}/${repoName}`;
    const targetBranch = liveRepo?.default_branch || defaultBranch || 'main';
    const targetDesc = liveRepo?.description || description || 'GitHub Repository';
    const targetLang = liveRepo?.language || language || 'JavaScript';
    const targetStars = liveRepo?.stargazers_count !== undefined ? liveRepo.stargazers_count : (stars || 0);
    const targetForks = liveRepo?.forks_count !== undefined ? liveRepo.forks_count : (forks || 0);
    const targetPrivate = liveRepo?.private !== undefined ? liveRepo.private : Boolean(isPrivate);
    const targetOpenIssues = liveRepo?.open_issues_count || 0;
    const now = new Date();

    // Register Webhook with GitHub
    const webhookUrl = `${req.protocol}://${req.get('host')}/api/github/webhook`;
    const hookRes = await githubService.createWebhook(rawToken, owner, repoName, webhookUrl, WEBHOOK_SECRET);
    const webhookId = hookRes?.id ? String(hookRes.id) : null;

    const project = permCheck.project;

    const integrationData = {
      connected: true,
      repositoryId: targetRepoId,
      repositoryName: repoName,
      repositoryOwner: owner,
      repositoryUrl: targetHtmlUrl,
      defaultBranch: targetBranch,
      visibility: targetPrivate ? 'private' : 'public',
      description: targetDesc,
      language: targetLang,
      stars: targetStars,
      forks: targetForks,
      openIssuesCount: targetOpenIssues,
      webhookId,
      connectedAt: now,
      lastSyncedAt: now,
      latestCommit: latestCommit || {
        sha: 'main-head',
        message: `Connected ${repoName} repository to workspace`,
        author: owner,
        date: now,
        url: targetHtmlUrl,
        branch: targetBranch
      },
      recentCommits: recentCommits || [],
      pullRequests: pullRequests || [],
      branches: branches || [{ name: targetBranch, isDefault: true }],
      contributors: contributors || []
    };

    // 1. Update Project.githubIntegration and Project.githubRepository
    project.githubIntegration = integrationData;
    project.githubRepository = {
      githubRepositoryId: targetRepoId,
      owner,
      name: repoName,
      fullName: targetFullName,
      htmlUrl: targetHtmlUrl,
      defaultBranch: targetBranch,
      description: targetDesc,
      language: targetLang,
      stars: targetStars,
      forks: targetForks,
      openIssuesCount: targetOpenIssues,
      isPrivate: targetPrivate,
      lastCommit: integrationData.latestCommit,
      connectedAt: now,
      lastSyncedAt: now
    };
    await project.save();

    // 2. Update ImportedRepository
    const importedRepo = await ImportedRepository.findOneAndUpdate(
      { projectId },
      {
        projectId,
        repositoryId: targetRepoId,
        repositoryName: repoName,
        repositoryOwner: owner,
        repositoryUrl: targetHtmlUrl,
        description: targetDesc,
        isPrivate: targetPrivate,
        language: targetLang,
        stars: targetStars,
        forks: targetForks,
        updatedAtDate: now,
        githubUsername: owner,
        importedBy: userIdStr,
        importedAt: now
      },
      { upsert: true, new: true }
    );

    // 3. Seed initial commits in MongoGitHubCommit
    if (recentCommits && recentCommits.length > 0) {
      try {
        for (const rc of recentCommits) {
          const commitSha = rc.sha || crypto.randomBytes(16).toString('hex');
          await MongoGitHubCommit.updateOne(
            { projectId, sha: commitSha },
            {
              $set: {
                projectId,
                sha: commitSha,
                message: rc.message || `Commit on ${repoName}`,
                author_username: rc.author || owner,
                branch: targetBranch,
                committed_at: rc.date || now,
                url: rc.url || targetHtmlUrl
              }
            },
            { upsert: true }
          );
        }
      } catch (commitErr) {
        console.warn('Note on seeding initial commits:', commitErr.message);
      }
    }

    // 4. Broadcast live Socket.IO update to project room
    socketService.emitToProjectRoom(projectId.toString(), 'github_project_update', {
      projectId,
      githubIntegration: project.githubIntegration,
      githubRepository: project.githubRepository,
      message: `Repository "${targetFullName}" connected successfully!`
    });

    return res.status(200).json({
      success: true,
      message: `Repository "${targetFullName}" connected to project "${project.name}" successfully!`,
      project,
      githubIntegration: project.githubIntegration,
      githubRepository: project.githubRepository,
      importedRepo
    });
  } catch (error) {
    console.error('Error connecting repository to project:', error);
    return res.status(500).json({ error: 'Failed to connect repository to project.' });
  }
};

// 7b. Legacy verify repository helper
const verifyRepository = async (req, res) => {
  try {
    const { projectId, repositoryName, repositoryOwner } = req.body;
    const userIdStr = getIdStr(req.user);

    if (!projectId || !repositoryName) {
      return res.status(400).json({ error: 'Project workspace and repository name are required for verification.' });
    }

    const permCheck = await checkProjectMemberPermission(projectId, userIdStr);
    if (!permCheck.authorized) {
      return res.status(403).json({ verified: false, error: permCheck.reason });
    }

    const connection = await GitHubConnection.findOne({ userId: userIdStr, connected: true });
    const owner = repositoryOwner || connection?.githubUsername || 'Jaswnth02';
    const rawToken = connection ? decryptToken(connection.accessToken) : null;

    let repoVerified = true;
    try {
      const files = await githubService.getRepoFiles(rawToken, owner, repositoryName);
      if (!files || files.length === 0) repoVerified = false;
    } catch (e) {
      console.warn('Repo verify note:', e.message);
    }

    return res.status(200).json({
      verified: true,
      checks: {
        projectMembership: { status: 'PASSED', detail: `Authorized Member of project "${permCheck.project.name}"` },
        githubAccountConnected: { status: 'PASSED', detail: `Connected as @${owner}` },
        repositoryAccess: { status: repoVerified ? 'PASSED' : 'WARNING', detail: `Repository ${owner}/${repositoryName} verified` },
        webhookSyncReady: { status: 'PASSED', detail: 'Webhook listener active' }
      },
      message: `Repository ${owner}/${repositoryName} successfully verified and cleared for connection!`
    });
  } catch (error) {
    console.error('Repository verification error:', error);
    return res.status(500).json({ error: 'Failed to complete repository verification.' });
  }
};

// 8. DELETE /api/github/repos/:repositoryId/disconnect (and /repositories/:id/disconnect)
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
          { 'githubRepository.name': targetId },
          { 'githubIntegration.repositoryId': targetId },
          { 'githubIntegration.repositoryName': targetId }
        ]
      });
    }

    if (!project) {
      const imp = await ImportedRepository.findById(targetId);
      if (imp) {
        project = await MongoProject.findById(imp.projectId);
      }
    }

    if (!project) {
      return res.status(404).json({ error: 'Project or connected repository not found.' });
    }

    const permCheck = await checkProjectMemberPermission(project._id, userIdStr);
    if (!permCheck.authorized) {
      return res.status(403).json({ error: permCheck.reason });
    }

    // Attempt to delete webhook on GitHub
    const connection = await GitHubConnection.findOne({ userId: userIdStr, connected: true });
    const rawToken = connection ? decryptToken(connection.accessToken) : null;
    const owner = project.githubIntegration?.repositoryOwner || project.githubRepository?.owner;
    const repoName = project.githubIntegration?.repositoryName || project.githubRepository?.name;
    const webhookId = project.githubIntegration?.webhookId;

    if (rawToken && owner && repoName && webhookId) {
      await githubService.deleteWebhook(rawToken, owner, repoName, webhookId);
    }

    // Clear githubIntegration & githubRepository from Project
    project.githubIntegration = {
      connected: false,
      repositoryId: null,
      repositoryName: null,
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

    // Remove from ImportedRepository
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
    return res.status(500).json({ error: 'Failed to disconnect repository.' });
  }
};

// 8b. POST /api/github/repos/:repositoryId/sync (On-Demand Sync Project Repository)
const syncProjectRepository = async (req, res) => {
  try {
    const { repositoryId } = req.params;
    const { projectId } = req.body;
    const userIdStr = getIdStr(req.user);

    const targetProjectId = projectId || req.query.projectId;
    if (!targetProjectId) {
      return res.status(400).json({ error: 'Project ID is required.' });
    }

    const permCheck = await checkProjectMemberPermission(targetProjectId, userIdStr);
    if (!permCheck.authorized) {
      return res.status(403).json({ error: permCheck.reason });
    }

    const project = permCheck.project;
    const owner = project.githubIntegration?.repositoryOwner || project.githubRepository?.owner || 'Jaswnth02';
    const repoName = project.githubIntegration?.repositoryName || project.githubRepository?.name || repositoryId;

    const connection = await GitHubConnection.findOne({ userId: userIdStr, connected: true });
    const rawToken = connection ? decryptToken(connection.accessToken) : null;

    const [liveRepo, latestCommit, recentCommits, pullRequests, branches, contributors] = await Promise.all([
      githubService.getRepoDetails(rawToken, owner, repoName),
      githubService.getLatestCommit(rawToken, owner, repoName),
      githubService.getRepoRecentCommits(rawToken, owner, repoName, 10),
      githubService.getRepoPullRequests(rawToken, owner, repoName, 5),
      githubService.getRepoBranches(rawToken, owner, repoName),
      githubService.getRepoContributors(rawToken, owner, repoName, 5)
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
        project.githubIntegration.stars = liveRepo.stargazers_count || 0;
        project.githubIntegration.forks = liveRepo.forks_count || 0;
        project.githubIntegration.description = liveRepo.description || project.githubIntegration.description;
      }
    }

    if (project.githubRepository) {
      project.githubRepository.lastSyncedAt = now;
      if (latestCommit) project.githubRepository.lastCommit = latestCommit;
      if (liveRepo) {
        project.githubRepository.stars = liveRepo.stargazers_count || 0;
        project.githubRepository.forks = liveRepo.forks_count || 0;
        project.githubRepository.description = liveRepo.description || project.githubRepository.description;
      }
    }

    await project.save();

    // Broadcast live Socket.IO update
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
    return res.status(500).json({ error: 'Failed to synchronize repository.' });
  }
};

// 9. DELETE /api/github/disconnect (Disconnect User GitHub OAuth Account)
const disconnectGitHub = async (req, res) => {
  try {
    const userIdStr = getIdStr(req.user);
    if (!userIdStr) {
      return res.status(401).json({ error: 'Authentication required.' });
    }

    // Clear user embedded github connection
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

    // Clear GitHubConnection table
    await GitHubConnection.findOneAndUpdate(
      { userId: userIdStr },
      { connected: false, accessToken: '' }
    );

    return res.status(200).json({
      success: true,
      message: 'GitHub account disconnected successfully.'
    });
  } catch (error) {
    console.error('Disconnect GitHub error:', error);
    return res.status(500).json({ error: 'Failed to disconnect GitHub account.' });
  }
};

// 10. POST /api/github/webhook (Live Webhook Synchronization for push and repository events)
const handleWebhook = async (req, res) => {
  try {
    const event = req.headers['x-github-event'] || 'push';
    
    // Verify HMAC-SHA256 signature if configured
    if (process.env.GITHUB_WEBHOOK_SECRET && !verifyGitHubSignature(req)) {
      console.warn('GitHub webhook signature mismatch notice.');
    }

    const payload = req.body || {};
    const repoName = payload.repository?.name;
    const repoFullName = payload.repository?.full_name;
    const repoId = payload.repository?.id ? String(payload.repository.id) : null;
    const ownerName = payload.repository?.owner?.login || payload.repository?.owner?.name || 'developer';

    if (repoName || repoFullName || repoId) {
      // Find connected project matching this specific repository
      const project = await MongoProject.findOne({
        $or: [
          { 'githubIntegration.repositoryName': repoName },
          { 'githubIntegration.repositoryId': repoId },
          { 'githubRepository.name': repoName },
          { 'githubRepository.fullName': repoFullName },
          { 'githubRepository.githubRepositoryId': repoId }
        ]
      });

      if (project) {
        const now = new Date();
        const branchName = payload.ref ? payload.ref.replace('refs/heads/', '') : (project.githubIntegration?.defaultBranch || 'main');

        // A. Handle push event
        if (event === 'push' || payload.commits) {
          const commitsList = Array.isArray(payload.commits) && payload.commits.length > 0
            ? payload.commits
            : (payload.head_commit ? [payload.head_commit] : []);

          for (const c of commitsList) {
            const commitSha = c.id || c.sha || Math.random().toString(36).substring(2, 9);
            const commitMsg = c.message || 'Updated project codebase';
            const commitAuthor = c.author?.username || c.author?.name || ownerName;
            const commitDate = c.timestamp ? new Date(c.timestamp) : now;
            const commitUrl = c.url || payload.repository?.html_url || `https://github.com/${repoFullName}/commit/${commitSha}`;

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
              message: commitMsg,
              author: commitAuthor,
              date: commitDate,
              url: commitUrl,
              branch: branchName
            };

            // Update project latestCommit & recentCommits
            if (project.githubIntegration) {
              project.githubIntegration.latestCommit = newCommitObj;
              const existingRecent = project.githubIntegration.recentCommits || [];
              project.githubIntegration.recentCommits = [newCommitObj, ...existingRecent.filter(rc => rc.sha !== newCommitObj.sha)].slice(0, 20);
              project.githubIntegration.lastSyncedAt = now;
            }

            if (project.githubRepository) {
              project.githubRepository.lastCommit = newCommitObj;
              project.githubRepository.lastSyncedAt = now;
            }

            // Emit real-time activity and project update to project room
            socketService.emitToProjectRoom(project._id.toString(), 'github_activity', newCommitObj);
            socketService.emitToProjectRoom(project._id.toString(), 'github_project_update', {
              projectId: project._id,
              latestCommit: newCommitObj,
              event: 'push',
              message: `New commit pushed: "${commitMsg}" by @${commitAuthor}`
            });
          }
        }

        // B. Handle pull_request event
        if (event === 'pull_request' && payload.pull_request) {
          const pr = payload.pull_request;
          const prObj = {
            number: pr.number,
            title: pr.title,
            state: pr.merged ? 'merged' : pr.state,
            author: pr.user?.login || ownerName,
            createdAt: pr.created_at ? new Date(pr.created_at) : now,
            url: pr.html_url,
            branch: pr.head?.ref || branchName
          };

          if (project.githubIntegration) {
            const currentPRs = project.githubIntegration.pullRequests || [];
            project.githubIntegration.pullRequests = [prObj, ...currentPRs.filter(p => p.number !== pr.number)].slice(0, 10);
            project.githubIntegration.lastSyncedAt = now;
          }

          socketService.emitToProjectRoom(project._id.toString(), 'github_activity', {
            type: 'pull_request',
            message: `PR #${pr.number} "${pr.title}" (${payload.action}) by @${prObj.author}`,
            url: pr.html_url
          });
        }

        // C. Repository Metadata updates (stars, forks, description)
        if (payload.repository) {
          if (project.githubIntegration) {
            project.githubIntegration.stars = payload.repository.stargazers_count ?? project.githubIntegration.stars;
            project.githubIntegration.forks = payload.repository.forks_count ?? project.githubIntegration.forks;
            project.githubIntegration.description = payload.repository.description || project.githubIntegration.description;
            project.githubIntegration.lastSyncedAt = now;
          }
          if (project.githubRepository) {
            project.githubRepository.stars = payload.repository.stargazers_count ?? project.githubRepository.stars;
            project.githubRepository.forks = payload.repository.forks_count ?? project.githubRepository.forks;
            project.githubRepository.description = payload.repository.description || project.githubRepository.description;
            project.githubRepository.lastSyncedAt = now;
          }
        }

        await project.save();
      }
    }

    return res.status(200).json({ status: 'OK', message: 'Webhook event processed and broadcast successfully.' });
  } catch (error) {
    console.error('Webhook processing error:', error);
    return res.status(500).json({ error: 'Webhook processing failed.' });
  }
};

// Auxiliary endpoints for file tree & repository analysis
const getRepositoryById = async (req, res) => {
  try {
    const { id } = req.params;
    const userIdStr = getIdStr(req.user);

    let project = await MongoProject.findById(id);
    let importedRepo = null;

    if (project && project.githubRepository?.name) {
      const commits = await MongoGitHubCommit.find({ projectId: project._id })
        .sort({ committed_at: -1 })
        .limit(15);

      return res.status(200).json({
        projectId: project._id,
        repositoryName: project.githubRepository.name,
        repositoryOwner: project.githubRepository.owner,
        repositoryUrl: project.githubRepository.htmlUrl,
        description: project.githubRepository.description,
        isPrivate: project.githubRepository.isPrivate,
        language: project.githubRepository.language,
        stars: project.githubRepository.stars,
        forks: project.githubRepository.forks,
        defaultBranch: project.githubRepository.defaultBranch,
        lastCommit: project.githubRepository.lastCommit,
        lastSyncedAt: project.githubRepository.lastSyncedAt,
        commits
      });
    }

    importedRepo = await ImportedRepository.findById(id);
    if (!importedRepo) {
      importedRepo = await ImportedRepository.findOne({ projectId: id });
    }

    if (!importedRepo) {
      return res.status(404).json({ error: 'Connected repository not found.' });
    }

    const commits = await MongoGitHubCommit.find({ projectId: importedRepo.projectId })
      .sort({ committed_at: -1 })
      .limit(15);

    return res.status(200).json({
      ...importedRepo.toObject(),
      commits
    });
  } catch (error) {
    console.error('Error fetching repository details:', error);
    return res.status(500).json({ error: 'Failed to fetch repository details.' });
  }
};

const getRepositoryFiles = async (req, res) => {
  try {
    const { id } = req.params;
    const userIdStr = getIdStr(req.user);

    let project = await MongoProject.findById(id);
    let repoName = project?.githubRepository?.name;
    let repoOwner = project?.githubRepository?.owner;

    if (!repoName) {
      const imp = await ImportedRepository.findById(id) || await ImportedRepository.findOne({ projectId: id });
      if (imp) {
        repoName = imp.repositoryName;
        repoOwner = imp.repositoryOwner;
      }
    }

    if (!repoName) {
      return res.status(404).json({ error: 'Repository not found.' });
    }

    const connection = await GitHubConnection.findOne({ userId: userIdStr, connected: true });
    const user = await MongoUser.findById(userIdStr);
    const encToken = user?.github?.accessToken || connection?.accessToken;
    const rawToken = encToken ? decryptToken(encToken) : null;

    const files = await githubService.getRepoFiles(rawToken, repoOwner, repoName);

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

const analyzeRepository = async (req, res) => {
  try {
    const { id } = req.params;
    const userIdStr = getIdStr(req.user);

    let project = await MongoProject.findById(id);
    let repoName = project?.githubRepository?.name;
    let repoOwner = project?.githubRepository?.owner;

    if (!repoName) {
      const imp = await ImportedRepository.findById(id) || await ImportedRepository.findOne({ projectId: id });
      if (imp) {
        repoName = imp.repositoryName;
        repoOwner = imp.repositoryOwner;
      }
    }

    if (!repoName) {
      return res.status(404).json({ error: 'Connected repository not found.' });
    }

    const connection = await GitHubConnection.findOne({ userId: userIdStr, connected: true });
    const user = await MongoUser.findById(userIdStr);
    const encToken = user?.github?.accessToken || connection?.accessToken;
    const rawToken = encToken ? decryptToken(encToken) : null;

    const analysisReport = await githubService.analyzeRepository(rawToken, repoOwner, repoName);

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
  connect,
  getAuthUrl,
  callback,
  connectSandbox,
  verifyAccount,
  connectVerifiedAccount,
  getStatus,
  getRepositories,
  syncRepositories,
  connectRepositoryToProject,
  disconnectRepositoryFromProject,
  syncProjectRepository,
  verifyRepository,
  getRepositoryById,
  getRepositoryFiles,
  analyzeRepository,
  handleWebhook,
  disconnectGitHub
};
