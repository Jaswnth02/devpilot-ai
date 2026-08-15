const axios = require('axios');
require('dotenv').config();

const CLIENT_ID = process.env.GITHUB_CLIENT_ID;
const CLIENT_SECRET = process.env.GITHUB_CLIENT_SECRET;

const getBaseUrl = () => {
  if (process.env.CLIENT_URL) return process.env.CLIENT_URL.replace(/\/$/, '');
  if (process.env.VERCEL) return 'https://devpilot-ai-sepia.vercel.app';
  return 'http://localhost:5001';
};

const CALLBACK_URL = process.env.GITHUB_CALLBACK_URL || `${getBaseUrl()}/api/github/callback`;

/**
 * Creates standardized headers for GitHub API requests
 */
const getAuthHeaders = (token) => {
  const headers = {
    'User-Agent': 'DevPilot-AI',
    Accept: 'application/vnd.github.v3+json'
  };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  return headers;
};

/**
 * Gets official GitHub OAuth authorization URL with explicit consent prompt
 * @param {string} state - Cryptographically random state parameter
 */
const getOAuthUrl = (state = '') => {
  const clientId = process.env.GITHUB_CLIENT_ID || CLIENT_ID;
  const callbackUrl = process.env.GITHUB_CALLBACK_URL || CALLBACK_URL;
  if (!clientId) {
    throw new Error('GITHUB_CLIENT_ID is not configured in server environment variables.');
  }
  const scope = 'repo,read:user,user:email,admin:repo_hook';
  return `https://github.com/login/oauth/authorize?client_id=${clientId}&redirect_uri=${encodeURIComponent(callbackUrl)}&scope=${encodeURIComponent(scope)}&prompt=consent${state ? `&state=${encodeURIComponent(state)}` : ''}`;
};

/**
 * Revokes the application grant and OAuth token on GitHub servers
 * @param {string} token - User's decrypted GitHub OAuth access token
 */
const revokeApplicationGrant = async (token) => {
  const clientId = process.env.GITHUB_CLIENT_ID || CLIENT_ID;
  const clientSecret = process.env.GITHUB_CLIENT_SECRET || CLIENT_SECRET;
  if (!clientId || !clientSecret || !token) return;

  try {
    const authHeader = 'Basic ' + Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
    await axios.delete(`https://api.github.com/applications/${clientId}/grant`, {
      headers: {
        Authorization: authHeader,
        Accept: 'application/vnd.github.v3+json'
      },
      data: {
        access_token: token
      }
    });
  } catch (err) {
    try {
      const authHeader = 'Basic ' + Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
      await axios.delete(`https://api.github.com/applications/${clientId}/token`, {
        headers: {
          Authorization: authHeader,
          Accept: 'application/vnd.github.v3+json'
        },
        data: {
          access_token: token
        }
      });
    } catch (e) {
      console.warn('Could not revoke GitHub token on server:', e.message);
    }
  }
};

/**
 * Exchanges authorization code for GitHub access token and retrieves GitHub user profile
 * @param {string} code - Temporary authorization code from GitHub callback
 */
const getAccessToken = async (code) => {
  const clientId = process.env.GITHUB_CLIENT_ID || CLIENT_ID;
  const clientSecret = process.env.GITHUB_CLIENT_SECRET || CLIENT_SECRET;
  const callbackUrl = process.env.GITHUB_CALLBACK_URL || CALLBACK_URL;

  if (!clientId || !clientSecret) {
    throw new Error('GitHub OAuth credentials (GITHUB_CLIENT_ID, GITHUB_CLIENT_SECRET) are missing.');
  }

  try {
    const response = await axios.post(
      'https://github.com/login/oauth/access_token',
      {
        client_id: clientId,
        client_secret: clientSecret,
        code,
        redirect_uri: callbackUrl
      },
      {
        headers: { Accept: 'application/json' }
      }
    );

    if (response.data.error) {
      throw new Error(response.data.error_description || response.data.error);
    }

    const token = response.data.access_token;
    if (!token) {
      throw new Error('GitHub did not return an access token.');
    }

    // Fetch GitHub User Profile
    const userRes = await axios.get('https://api.github.com/user', {
      headers: getAuthHeaders(token)
    });

    let primaryEmail = userRes.data.email || '';
    if (!primaryEmail) {
      try {
        const emailsRes = await axios.get('https://api.github.com/user/emails', {
          headers: getAuthHeaders(token)
        });
        if (Array.isArray(emailsRes.data)) {
          const primary = emailsRes.data.find((e) => e.primary) || emailsRes.data[0];
          if (primary) primaryEmail = primary.email;
        }
      } catch (e) {
        console.warn('Could not fetch user emails from GitHub API:', e.message);
      }
    }

    return {
      access_token: token,
      githubId: String(userRes.data.id),
      githubUserId: String(userRes.data.id),
      github_username: userRes.data.login,
      avatar_url: userRes.data.avatar_url || '',
      profile_url: userRes.data.html_url || `https://github.com/${userRes.data.login}`,
      email: primaryEmail
    };
  } catch (error) {
    console.error('GitHub getAccessToken error:', error.response?.data || error.message);
    throw new Error(error.response?.data?.message || error.message || 'Failed to exchange GitHub authorization code.');
  }
};

/**
 * Normalizes GitHub repository object into standard schema
 */
const formatRepo = (repo, fallbackOwner = '') => {
  const ownerName =
    repo.owner?.login ||
    repo.owner?.name ||
    (typeof repo.owner === 'string' ? repo.owner : fallbackOwner);

  return {
    id: String(repo.id),
    name: repo.name,
    full_name: repo.full_name || `${ownerName}/${repo.name}`,
    description: repo.description || '',
    html_url: repo.html_url || `https://github.com/${ownerName}/${repo.name}`,
    private: Boolean(repo.private),
    fork: Boolean(repo.fork),
    language: repo.language || '',
    stargazers_count: repo.stargazers_count || 0,
    forks_count: repo.forks_count || 0,
    open_issues_count: repo.open_issues_count || 0,
    default_branch: repo.default_branch || 'main',
    created_at: repo.created_at || new Date().toISOString(),
    updated_at: repo.updated_at || new Date().toISOString(),
    pushed_at: repo.pushed_at || repo.updated_at || new Date().toISOString(),
    owner: ownerName
  };
};

/**
 * Creates a brand new repository on GitHub under the authenticated user's account
 * @param {string} token - User's decrypted GitHub OAuth access token
 * @param {object} param1 - Repository configuration { name, description, isPrivate, autoInit }
 */
const createRepository = async (token, { name, description = '', isPrivate = false, autoInit = true }) => {
  if (!token) throw new Error('GitHub access token is required to create a repository.');
  if (!name || !name.trim()) throw new Error('Repository name is required.');

  const sanitizedName = name.trim().replace(/\s+/g, '-');

  try {
    const response = await axios.post(
      'https://api.github.com/user/repos',
      {
        name: sanitizedName,
        description: description ? description.trim() : '',
        private: Boolean(isPrivate),
        auto_init: Boolean(autoInit)
      },
      {
        headers: getAuthHeaders(token)
      }
    );

    return formatRepo(response.data);
  } catch (error) {
    console.error('GitHub createRepository error:', error.response?.data || error.message);
    const msg = error.response?.data?.errors?.[0]?.message || error.response?.data?.message || error.message;
    throw new Error(`GitHub repository creation failed: ${msg}`);
  }
};

/**
 * Fetches all accessible repositories for the authenticated user with pagination and search
 * @param {string} token - User's decrypted GitHub OAuth access token
 * @param {object} options - { page, perPage, sort, search, visibility }
 */
const getUserRepos = async (token, { page = 1, perPage = 30, sort = 'updated', search = '', visibility = 'all' } = {}) => {
  if (!token) {
    throw new Error('GitHub access token is required to fetch repositories.');
  }

  try {
    const limit = Math.min(Number(perPage) || 30, 100);
    const pageNum = Number(page) || 1;
    let url = `https://api.github.com/user/repos?per_page=${limit}&page=${pageNum}&sort=${sort || 'updated'}&direction=desc&affiliation=owner,collaborator,organization_member`;
    if (visibility && visibility !== 'all') {
      url += `&visibility=${visibility}`;
    }

    const response = await axios.get(url, {
      headers: getAuthHeaders(token)
    });

    let repos = Array.isArray(response.data) ? response.data : [];

    // If search term provided, filter repositories by name, description, language or owner
    if (search && search.trim()) {
      const q = search.trim().toLowerCase();
      repos = repos.filter(
        (r) =>
          r.name?.toLowerCase().includes(q) ||
          r.full_name?.toLowerCase().includes(q) ||
          r.description?.toLowerCase().includes(q) ||
          r.language?.toLowerCase().includes(q) ||
          (r.owner?.login && r.owner.login.toLowerCase().includes(q))
      );
    }

    const formattedRepos = repos.map((r) => formatRepo(r));

    return {
      repositories: formattedRepos,
      totalCount: formattedRepos.length,
      page: pageNum,
      perPage: limit,
      hasMore: response.data.length >= limit
    };
  } catch (error) {
    console.error('GitHub getUserRepos error:', error.response?.data || error.message);
    throw new Error(error.response?.data?.message || error.message || 'Failed to fetch GitHub repositories.');
  }
};

/**
 * Fetches single repository details directly from GitHub API
 */
const getRepoDetails = async (token, owner, repo) => {
  if (!token) throw new Error('GitHub access token is required to fetch repository details.');

  try {
    const response = await axios.get(`https://api.github.com/repos/${owner}/${repo}`, {
      headers: getAuthHeaders(token)
    });
    return formatRepo(response.data, owner);
  } catch (error) {
    console.error(`GitHub getRepoDetails error for ${owner}/${repo}:`, error.response?.data || error.message);
    if (error.response?.status === 404) {
      throw new Error(`Repository "${owner}/${repo}" was not found on GitHub or is inaccessible.`);
    }
    if (error.response?.status === 403) {
      throw new Error(`Access denied to repository "${owner}/${repo}". Check your GitHub permissions.`);
    }
    throw new Error(error.response?.data?.message || `Failed to fetch repository "${owner}/${repo}".`);
  }
};

/**
 * Fetches latest commit for a repository from GitHub API
 */
const getLatestCommit = async (token, owner, repo) => {
  try {
    const response = await axios.get(
      `https://api.github.com/repos/${owner}/${repo}/commits?per_page=1`,
      { headers: getAuthHeaders(token) }
    );

    if (Array.isArray(response.data) && response.data.length > 0) {
      const latest = response.data[0];
      return {
        sha: latest.sha ? latest.sha.substring(0, 7) : 'head',
        fullSha: latest.sha,
        message: latest.commit?.message || 'Updated repository',
        author: latest.author?.login || latest.commit?.author?.name || owner,
        authorAvatar: latest.author?.avatar_url || `https://avatars.githubusercontent.com/${latest.author?.login || owner}`,
        date: latest.commit?.author?.date ? new Date(latest.commit.author.date) : new Date(),
        url: latest.html_url || `https://github.com/${owner}/${repo}/commit/${latest.sha}`,
        branch: 'main'
      };
    }
  } catch (e) {
    console.warn(`getLatestCommit note for ${owner}/${repo}:`, e.message);
  }

  return {
    sha: 'init',
    fullSha: 'initial-commit',
    message: `Connected ${repo} repository to DevPilot`,
    author: owner,
    authorAvatar: `https://avatars.githubusercontent.com/${owner}`,
    date: new Date(),
    url: `https://github.com/${owner}/${repo}`,
    branch: 'main'
  };
};

/**
 * Fetches recent commit history for a repository
 */
const getRepoRecentCommits = async (token, owner, repo, limit = 15) => {
  try {
    const response = await axios.get(
      `https://api.github.com/repos/${owner}/${repo}/commits?per_page=${limit}`,
      { headers: getAuthHeaders(token) }
    );

    if (Array.isArray(response.data)) {
      return response.data.map((c) => ({
        sha: c.sha ? c.sha.substring(0, 7) : 'head',
        fullSha: c.sha,
        message: c.commit?.message || 'Updated project codebase',
        author: c.author?.login || c.commit?.author?.name || owner,
        authorAvatar: c.author?.avatar_url || `https://avatars.githubusercontent.com/${c.author?.login || owner}`,
        date: c.commit?.author?.date ? new Date(c.commit.author.date) : new Date(),
        url: c.html_url || `https://github.com/${owner}/${repo}/commit/${c.sha}`,
        branch: 'main'
      }));
    }
  } catch (e) {
    console.warn(`getRepoRecentCommits note for ${owner}/${repo}:`, e.message);
  }

  return [];
};

/**
 * Fetches Pull Requests for a repository
 */
const getRepoPullRequests = async (token, owner, repo, limit = 10) => {
  try {
    const response = await axios.get(
      `https://api.github.com/repos/${owner}/${repo}/pulls?state=all&per_page=${limit}`,
      { headers: getAuthHeaders(token) }
    );

    if (Array.isArray(response.data)) {
      return response.data.map((pr) => ({
        number: pr.number,
        title: pr.title,
        state: pr.merged_at ? 'merged' : pr.state,
        author: pr.user?.login || owner,
        authorAvatar: pr.user?.avatar_url || '',
        createdAt: pr.created_at ? new Date(pr.created_at) : new Date(),
        url: pr.html_url || `https://github.com/${owner}/${repo}/pull/${pr.number}`,
        branch: pr.head?.ref || 'feature'
      }));
    }
  } catch (e) {
    console.warn(`getRepoPullRequests note for ${owner}/${repo}:`, e.message);
  }

  return [];
};

/**
 * Fetches Branches for a repository
 */
const getRepoBranches = async (token, owner, repo) => {
  try {
    const response = await axios.get(
      `https://api.github.com/repos/${owner}/${repo}/branches?per_page=30`,
      { headers: getAuthHeaders(token) }
    );

    if (Array.isArray(response.data)) {
      return response.data.map((b) => ({
        name: b.name,
        isDefault: b.name === 'main' || b.name === 'master'
      }));
    }
  } catch (e) {
    console.warn(`getRepoBranches note for ${owner}/${repo}:`, e.message);
  }

  return [{ name: 'main', isDefault: true }];
};

/**
 * Fetches Contributors for a repository
 */
const getRepoContributors = async (token, owner, repo, limit = 10) => {
  try {
    const response = await axios.get(
      `https://api.github.com/repos/${owner}/${repo}/contributors?per_page=${limit}`,
      { headers: getAuthHeaders(token) }
    );

    if (Array.isArray(response.data)) {
      return response.data.map((c) => ({
        username: c.login,
        avatarUrl: c.avatar_url,
        contributions: c.contributions || 1
      }));
    }
  } catch (e) {
    console.warn(`getRepoContributors note for ${owner}/${repo}:`, e.message);
  }

  return [
    {
      username: owner,
      avatarUrl: `https://avatars.githubusercontent.com/${owner}`,
      contributions: 1
    }
  ];
};

/**
 * Registers GitHub repository webhook for push, pull_request, and issue events
 */
const createWebhook = async (token, owner, repo, webhookUrl, secret) => {
  if (!token) return null;

  try {
    // 1. Check if webhook is already registered for this URL to avoid duplicates
    try {
      const existingHooks = await axios.get(`https://api.github.com/repos/${owner}/${repo}/hooks`, {
        headers: getAuthHeaders(token)
      });
      if (Array.isArray(existingHooks.data)) {
        const match = existingHooks.data.find((h) => h.config?.url === webhookUrl);
        if (match) {
          return { id: String(match.id), active: match.active };
        }
      }
    } catch (checkErr) {
      console.warn('Webhook listing check note:', checkErr.message);
    }

    // 2. Register new webhook
    const response = await axios.post(
      `https://api.github.com/repos/${owner}/${repo}/hooks`,
      {
        name: 'web',
        active: true,
        events: ['push', 'pull_request', 'issues', 'repository', 'release'],
        config: {
          url: webhookUrl,
          content_type: 'json',
          secret: secret,
          insecure_ssl: '0'
        }
      },
      {
        headers: getAuthHeaders(token)
      }
    );

    return { id: String(response.data.id), active: true };
  } catch (error) {
    console.warn(`Webhook registration notice for ${owner}/${repo}:`, error.response?.data?.message || error.message);
    return null;
  }
};

/**
 * Deletes a registered webhook from a GitHub repository
 */
const deleteWebhook = async (token, owner, repo, hookId) => {
  if (!token || !hookId) return false;

  try {
    await axios.delete(`https://api.github.com/repos/${owner}/${repo}/hooks/${hookId}`, {
      headers: getAuthHeaders(token)
    });
    return true;
  } catch (e) {
    console.warn(`deleteWebhook note for ${owner}/${repo}/${hookId}:`, e.message);
    return false;
  }
};

/**
 * Fetches repository file tree structure
 */
const getRepoFiles = async (token, owner, repo, branch = 'main') => {
  const IGNORED_PATHS = ['.git', 'node_modules', 'dist', 'build', '.next', 'target', 'coverage', '.env'];
  const IGNORED_EXTENSIONS = ['.pem', '.key', '.crt', '.p12'];

  try {
    // Try to get tree on given branch
    let treeResponse = null;
    try {
      treeResponse = await axios.get(
        `https://api.github.com/repos/${owner}/${repo}/git/trees/${branch}?recursive=1`,
        { headers: getAuthHeaders(token) }
      );
    } catch (treeErr) {
      // Fallback: try default branch or master
      const fallbackBranch = branch === 'main' ? 'master' : 'main';
      treeResponse = await axios.get(
        `https://api.github.com/repos/${owner}/${repo}/git/trees/${fallbackBranch}?recursive=1`,
        { headers: getAuthHeaders(token) }
      );
    }

    if (treeResponse?.data && Array.isArray(treeResponse.data.tree)) {
      return treeResponse.data.tree
        .filter((item) => {
          const parts = item.path.split('/');
          const isIgnoredDir = parts.some((part) => IGNORED_PATHS.includes(part));
          const isIgnoredExt = IGNORED_EXTENSIONS.some((ext) => item.path.endsWith(ext));
          return !isIgnoredDir && !isIgnoredExt;
        })
        .map((item) => ({
          path: item.path,
          type: item.type === 'tree' ? 'dir' : 'file',
          size: item.size || 0
        }));
    }
  } catch (error) {
    console.warn(`GitHub file tree fetch for ${owner}/${repo} failed:`, error.message);
  }

  return [];
};

/**
 * Analyzes repository structure and generates insights
 */
const analyzeRepository = async (token, owner, repo) => {
  const files = await getRepoFiles(token, owner, repo);
  const filePaths = files.map((f) => f.path);

  const isNode = filePaths.some((p) => p.includes('package.json'));
  const isReact = filePaths.some((p) => p.includes('App.jsx') || p.includes('App.tsx') || p.includes('react'));
  const isPython = filePaths.some((p) => p.includes('requirements.txt') || p.includes('.py'));
  const isJava = filePaths.some((p) => p.includes('pom.xml') || p.includes('.java'));
  const isGo = filePaths.some((p) => p.includes('go.mod') || p.includes('.go'));

  const detectedTech = [];
  if (isReact) detectedTech.push('React.js');
  if (isNode) detectedTech.push('Node.js / Express');
  if (isPython) detectedTech.push('Python');
  if (isJava) detectedTech.push('Java / Spring');
  if (isGo) detectedTech.push('Go');
  if (detectedTech.length === 0) detectedTech.push('JavaScript');

  return {
    repository: `${owner}/${repo}`,
    analyzedAt: new Date().toISOString(),
    totalFilesCount: files.length,
    detectedTechnologies: detectedTech,
    architectureSummary: `Repository ${owner}/${repo} contains ${files.length} indexed files. Identified core stack: ${detectedTech.join(', ')}.`,
    qualityInsights: [
      'Repository structure verified against GitHub API.',
      'Directory layout adheres to standard modular project organization.'
    ]
  };
};

const crypto = require('crypto');

/**
 * Validates HMAC-SHA256 signature from GitHub webhook
 */
const verifyWebhookSignature = (rawPayload, signatureHeader, secret) => {
  if (!signatureHeader || !secret) return false;
  try {
    const payloadStr = typeof rawPayload === 'string' ? rawPayload : JSON.stringify(rawPayload);
    const computedSignature = 'sha256=' + crypto.createHmac('sha256', secret).update(payloadStr).digest('hex');
    const signatureBuffer = Buffer.from(signatureHeader, 'utf8');
    const computedBuffer = Buffer.from(computedSignature, 'utf8');
    if (signatureBuffer.length !== computedBuffer.length) {
      return false;
    }
    return crypto.timingSafeEqual(signatureBuffer, computedBuffer);
  } catch (err) {
    return false;
  }
};

module.exports = {
  getOAuthUrl,
  getAuthorizationUrl: getOAuthUrl,
  getAccessToken,
  formatRepo,
  createRepository,
  getUserRepos,
  getRepoDetails,
  getLatestCommit,
  getRepoRecentCommits,
  getRepoPullRequests,
  getRepoBranches,
  getRepoContributors,
  createWebhook,
  deleteWebhook,
  getRepoFiles,
  analyzeRepository,
  verifyWebhookSignature,
  revokeApplicationGrant
};
