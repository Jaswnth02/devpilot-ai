const githubService = require('../services/githubService');
const socketService = require('../services/socketService');
const { GitHubAccount, GitHubRepository, GitHubCommit, GitHubPullRequest, GitHubIssue, Project, Task } = require('../models');
const jwt = require('jsonwebtoken');
require('dotenv').config();

const JWT_SECRET = process.env.JWT_SECRET || 'supersecretdevpilotkey';

const getAuthUrl = (req, res) => {
  try {
    // Generate OAuth URL. Pass user ID/token in state to associate account
    const token = jwt.sign({ id: req.user.id }, JWT_SECRET, { expiresIn: '15m' });
    const url = `${githubService.getOAuthUrl()}&state=${token}`;
    res.status(200).json({ url });
  } catch (error) {
    console.error('Error generating GitHub Auth URL:', error);
    res.status(500).json({ error: 'Failed to generate GitHub Auth URL.' });
  }
};

const callback = async (req, res) => {
  const { code, state } = req.query;

  if (!code) {
    return res.redirect(`${process.env.CLIENT_URL || 'http://localhost:5173'}/github/callback?error=code_missing`);
  }

  try {
    // Identify user from state token
    let userId = null;
    try {
      const decoded = jwt.verify(state, JWT_SECRET);
      userId = decoded.id;
    } catch (err) {
      return res.status(401).send('State validation failed or expired. Please re-authenticate.');
    }

    const { access_token, github_username } = await githubService.getAccessToken(code);

    // Upsert GitHub account for user
    await GitHubAccount.upsert({
      user_id: userId,
      github_username,
      access_token
    });

    res.redirect(`${process.env.CLIENT_URL || 'http://localhost:5173'}/github/callback?success=true&username=${github_username}`);
  } catch (error) {
    console.error('GitHub Callback Error:', error);
    res.redirect(`${process.env.CLIENT_URL || 'http://localhost:5173'}/github/callback?error=auth_failed`);
  }
};

const getRepositories = async (req, res) => {
  try {
    const account = await GitHubAccount.findOne({ where: { user_id: req.user.id } });
    if (!account) {
      return res.status(400).json({ error: 'GitHub account not connected.' });
    }

    const repos = await githubService.getUserRepos(account.access_token);
    res.status(200).json(repos);
  } catch (error) {
    console.error('Error fetching repositories:', error);
    res.status(500).json({ error: 'Failed to retrieve GitHub repositories.' });
  }
};

const linkRepository = async (req, res) => {
  try {
    const { projectId, owner, repoName } = req.body;

    if (!projectId || !owner || !repoName) {
      return res.status(400).json({ error: 'Project ID, owner, and repository name are required.' });
    }

    const project = await Project.findByPk(projectId);
    if (!project) {
      return res.status(404).json({ error: 'Project not found.' });
    }

    const account = await GitHubAccount.findOne({ where: { user_id: req.user.id } });
    if (!account) {
      return res.status(400).json({ error: 'Connect your GitHub account first.' });
    }

    const webhookSecret = 'webhook_secret_' + Math.random().toString(36).substring(7);
    const webhookUrl = `${req.protocol}://${req.get('host')}/api/github/webhook`;

    // Create webhook
    await githubService.createWebhook(account.access_token, owner, repoName, webhookUrl, webhookSecret);

    // Save repository relation
    const [repo, created] = await GitHubRepository.findOrCreate({
      where: { project_id: projectId },
      defaults: {
        owner,
        repo_name: repoName,
        webhook_secret: webhookSecret
      }
    });

    if (!created) {
      await repo.update({ owner, repo_name: repoName, webhook_secret: webhookSecret });
    }

    // Trigger initial sync in the background
    syncDataInternal(project.id, account.access_token, owner, repoName, repo.id).catch(err => {
      console.error('Initial background sync failed:', err);
    });

    res.status(200).json({ message: 'Repository linked successfully.', repo });
  } catch (error) {
    console.error('Link repository error:', error);
    res.status(500).json({ error: 'Failed to link GitHub repository.' });
  }
};

const syncData = async (req, res) => {
  try {
    const { projectId } = req.body;
    if (!projectId) {
      return res.status(400).json({ error: 'Project ID is required.' });
    }

    const repo = await GitHubRepository.findOne({ where: { project_id: projectId } });
    if (!repo) {
      return res.status(404).json({ error: 'No GitHub repository linked to this project.' });
    }

    const account = await GitHubAccount.findOne({ where: { user_id: req.user.id } });
    if (!account) {
      return res.status(400).json({ error: 'Your GitHub account is not connected.' });
    }

    await syncDataInternal(projectId, account.access_token, repo.owner, repo.repo_name, repo.id);
    res.status(200).json({ message: 'Synchronization triggered successfully.' });
  } catch (error) {
    console.error('Sync data error:', error);
    res.status(500).json({ error: 'Sync failed.' });
  }
};

// Internal sync helper
const syncDataInternal = async (projectId, token, owner, repoName, repoId) => {
  console.log(`Syncing repository ${owner}/${repoName} for project ${projectId}...`);
  const { commits, pulls, issues } = await githubService.syncRepoData(token, owner, repoName);

  // Sync Commits
  for (const commit of commits) {
    await GitHubCommit.findOrCreate({
      where: { sha: commit.sha },
      defaults: {
        repo_id: repoId,
        message: commit.commit.message,
        author_username: commit.author ? commit.author.login : 'unknown',
        url: commit.html_url,
        committed_at: new Date(commit.commit.author.date)
      }
    });
  }

  // Sync Pull Requests
  for (const pr of pulls) {
    const [dbPr, created] = await GitHubPullRequest.findOrCreate({
      where: { repo_id: repoId, pr_number: pr.number },
      defaults: {
        title: pr.title,
        state: pr.state,
        url: pr.html_url,
        username: pr.user.login,
        updated_at: new Date(pr.updated_at)
      }
    });
    if (!created) {
      await dbPr.update({
        title: pr.title,
        state: pr.state,
        url: pr.html_url,
        username: pr.user.login,
        updated_at: new Date(pr.updated_at)
      });
    }
  }

  // Sync Issues
  for (const issue of issues) {
    const [dbIssue, created] = await GitHubIssue.findOrCreate({
      where: { repo_id: repoId, issue_number: issue.number },
      defaults: {
        title: issue.title,
        state: issue.state,
        url: issue.html_url,
        username: issue.user.login
      }
    });
    if (!created) {
      await dbIssue.update({
        title: issue.title,
        state: issue.state,
        url: issue.html_url,
        username: issue.user.login
      });
    }
  }

  // Send real-time reload trigger to frontend
  socketService.sendUpdateToProject(projectId, 'github_sync_completed', { success: true });
};

const handleWebhook = async (req, res) => {
  const event = req.headers['x-github-event'] || 'push';
  const payload = req.body;

  console.log(`Received GitHub Webhook event: ${event}`);

  try {
    // Locate repo based on owner and name
    const repoFullName = payload.repository ? payload.repository.full_name : '';
    if (!repoFullName) {
      return res.status(400).json({ error: 'Repository information missing from payload.' });
    }

    const [owner, name] = repoFullName.split('/');
    const repo = await GitHubRepository.findOne({
      where: { owner, repo_name: name }
    });

    if (!repo) {
      return res.status(404).json({ error: 'Repository not linked in DevPilot.' });
    }

    if (event === 'push') {
      const commits = payload.commits || [];
      for (const c of commits) {
        const sha = c.id;
        const message = c.message;
        const author = c.author ? c.author.username : 'unknown';
        const url = c.url;
        const date = c.timestamp;

        await GitHubCommit.findOrCreate({
          where: { sha },
          defaults: {
            repo_id: repo.id,
            message,
            author_username: author,
            url,
            committed_at: new Date(date)
          }
        });

        // Broadcast to project
        socketService.sendUpdateToProject(repo.project_id, 'github_activity', {
          type: 'commit',
          author,
          message,
          url
        });
      }
    } else if (event === 'pull_request') {
      const pr = payload.pull_request;
      if (pr) {
        const [dbPr, created] = await GitHubPullRequest.findOrCreate({
          where: { repo_id: repo.id, pr_number: pr.number },
          defaults: {
            title: pr.title,
            state: pr.state,
            url: pr.html_url,
            username: pr.user ? pr.user.login : 'unknown',
            updated_at: new Date(pr.updated_at)
          }
        });
        if (!created) {
          await dbPr.update({
            title: pr.title,
            state: pr.state,
            url: pr.html_url,
            username: pr.user ? pr.user.login : 'unknown',
            updated_at: new Date(pr.updated_at)
          });
        }

        // Broadcast to project
        socketService.sendUpdateToProject(repo.project_id, 'github_activity', {
          type: 'pull_request',
          author: pr.user ? pr.user.login : 'unknown',
          title: pr.title,
          state: pr.state,
          url: pr.html_url
        });
      }
    } else if (event === 'issues') {
      const issue = payload.issue;
      if (issue) {
        const [dbIssue, created] = await GitHubIssue.findOrCreate({
          where: { repo_id: repo.id, issue_number: issue.number },
          defaults: {
            title: issue.title,
            state: issue.state,
            url: issue.html_url,
            username: issue.user ? issue.user.login : 'unknown'
          }
        });
        if (!created) {
          await dbIssue.update({
            title: issue.title,
            state: issue.state,
            url: issue.html_url,
            username: issue.user ? issue.user.login : 'unknown'
          });
        }

        // Broadcast to project
        socketService.sendUpdateToProject(repo.project_id, 'github_activity', {
          type: 'issue',
          author: issue.user ? issue.user.login : 'unknown',
          title: issue.title,
          state: issue.state,
          url: issue.html_url
        });
      }
    }

    res.status(200).send('Webhook processed.');
  } catch (error) {
    console.error('Webhook processing error:', error);
    res.status(500).json({ error: 'Failed to process webhook.' });
  }
};

module.exports = {
  getAuthUrl,
  callback,
  getRepositories,
  linkRepository,
  syncData,
  handleWebhook
};
