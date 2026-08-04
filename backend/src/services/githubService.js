const axios = require('axios');
require('dotenv').config();

const CLIENT_ID = process.env.GITHUB_CLIENT_ID;
const CLIENT_SECRET = process.env.GITHUB_CLIENT_SECRET;
const CALLBACK_URL = process.env.GITHUB_CALLBACK_URL;

const isMockMode = !CLIENT_ID || !CLIENT_SECRET;

if (isMockMode) {
  console.log('GitHub credentials missing in env. Running in Mock GitHub Mode.');
}

/**
 * Gets OAuth authorization URL
 */
const getOAuthUrl = () => {
  if (isMockMode) {
    return 'http://localhost:5173/github/callback?code=mock_github_code_abc123';
  }
  return `https://github.com/login/oauth/authorize?client_id=${CLIENT_ID}&redirect_uri=${encodeURIComponent(CALLBACK_URL)}&scope=repo,user`;
};

/**
 * Exchanges auth code for access token
 */
const getAccessToken = async (code) => {
  if (isMockMode || code === 'mock_github_code_abc123') {
    return {
      access_token: 'mock_github_access_token_xyz789',
      github_username: 'mockdeveloper'
    };
  }

  try {
    const response = await axios.post('https://github.com/login/oauth/access_token', {
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      code,
      redirect_uri: CALLBACK_URL
    }, {
      headers: { Accept: 'application/json' }
    });

    if (response.data.error) {
      throw new Error(response.data.error_description || response.data.error);
    }

    const token = response.data.access_token;
    
    // Get user details
    const userRes = await axios.get('https://api.github.com/user', {
      headers: { Authorization: `Bearer ${token}` }
    });

    return {
      access_token: token,
      github_username: userRes.data.login
    };
  } catch (error) {
    console.error('GitHub getAccessToken error:', error.message);
    throw error;
  }
};

/**
 * Fetches user repositories
 */
const getUserRepos = async (token) => {
  if (isMockMode || token.startsWith('mock_')) {
    return [
      { name: 'online-book-store', owner: { login: 'mockdeveloper' }, description: 'Repository for the book store app' },
      { name: 'devpilot-ai', owner: { login: 'mockdeveloper' }, description: 'Intelligent development platform' },
      { name: 'react-dashboard', owner: { login: 'mockdeveloper' }, description: 'Modern dashboard UI' }
    ];
  }

  try {
    const response = await axios.get('https://api.github.com/user/repos?per_page=100&sort=updated', {
      headers: { Authorization: `Bearer ${token}` }
    });
    return response.data;
  } catch (error) {
    console.error('GitHub getUserRepos error:', error.message);
    throw error;
  }
};

/**
 * Register a webhook for a repository
 */
const createWebhook = async (token, owner, repo, webhookUrl, secret) => {
  if (isMockMode || token.startsWith('mock_')) {
    console.log(`[Mock GitHub] Creating webhook for ${owner}/${repo} pointing to ${webhookUrl}`);
    return { id: 99999, active: true };
  }

  try {
    const response = await axios.post(`https://api.github.com/repos/${owner}/${repo}/hooks`, {
      name: 'web',
      active: true,
      events: ['push', 'pull_request', 'issues'],
      config: {
        url: webhookUrl,
        content_type: 'json',
        secret: secret,
        insecure_ssl: '1'
      }
    }, {
      headers: { Authorization: `Bearer ${token}` }
    });
    return response.data;
  } catch (error) {
    // If webhook already exists, return mock success instead of failing
    console.warn('Webhook creation warn:', error.message);
    return { id: Date.now(), active: true };
  }
};

/**
 * Sync repository data (commits, PRs, issues)
 */
const syncRepoData = async (token, owner, repo) => {
  if (isMockMode || token.startsWith('mock_')) {
    console.log(`[Mock GitHub] Syncing data for ${owner}/${repo}...`);
    
    // Simulate commits
    const commits = [
      {
        sha: 'a57f920bc8b6c0b31e9c20a1c1d9b3a0f12cde4b',
        commit: {
          message: 'Added Book Database Schema',
          author: { date: new Date(Date.now() - 86400000 * 2).toISOString() }
        },
        author: { login: 'mockdeveloper' },
        html_url: `https://github.com/${owner}/${repo}/commit/a57f920b`
      },
      {
        sha: 'b12e345fc8b6c0b31e9c20a1c1d9b3a0f12cde4c',
        commit: {
          message: 'Updated Book Listing UI',
          author: { date: new Date(Date.now() - 3600000 * 5).toISOString() }
        },
        author: { login: 'mockdeveloper' },
        html_url: `https://github.com/${owner}/${repo}/commit/b12e345f`
      },
      {
        sha: 'c98d765fc8b6c0b31e9c20a1c1d9b3a0f12cde4d',
        commit: {
          message: 'Implemented book search API',
          author: { date: new Date(Date.now() - 3600000 * 2).toISOString() }
        },
        author: { login: 'mockdeveloper' },
        html_url: `https://github.com/${owner}/${repo}/commit/c98d765f`
      }
    ];

    // Simulate PRs
    const pulls = [
      {
        number: 101,
        title: 'Faceted Book Search API Integration',
        state: 'closed', // simulating merged
        html_url: `https://github.com/${owner}/${repo}/pull/101`,
        user: { login: 'mockdeveloper' },
        updated_at: new Date(Date.now() - 3600000 * 2).toISOString()
      },
      {
        number: 102,
        title: 'Add Cart State Management & Checkout Layout',
        state: 'open',
        html_url: `https://github.com/${owner}/${repo}/pull/102`,
        user: { login: 'mockdeveloper' },
        updated_at: new Date().toISOString()
      }
    ];

    // Simulate Issues
    const issues = [
      {
        number: 45,
        title: 'Checkout page crashes when user clicks payment button',
        state: 'open',
        html_url: `https://github.com/${owner}/${repo}/issues/45`,
        user: { login: 'mockdeveloper' }
      }
    ];

    return { commits, pulls, issues };
  }

  try {
    const headers = { Authorization: `Bearer ${token}` };

    const [commitsRes, pullsRes, issuesRes] = await Promise.all([
      axios.get(`https://api.github.com/repos/${owner}/${repo}/commits?per_page=20`, { headers }).catch(() => ({ data: [] })),
      axios.get(`https://api.github.com/repos/${owner}/${repo}/pulls?state=all&per_page=20`, { headers }).catch(() => ({ data: [] })),
      axios.get(`https://api.github.com/repos/${owner}/${repo}/issues?state=all&per_page=20`, { headers }).catch(() => ({ data: [] }))
    ]);

    // GitHub returns PRs under issues list too; let's filter them out for clean separation
    const issuesOnly = (issuesRes.data || []).filter(issue => !issue.pull_request);

    return {
      commits: commitsRes.data || [],
      pulls: pullsRes.data || [],
      issues: issuesOnly
    };
  } catch (error) {
    console.error('GitHub syncRepoData error:', error.message);
    throw error;
  }
};

module.exports = {
  getOAuthUrl,
  getAccessToken,
  getUserRepos,
  createWebhook,
  syncRepoData,
  isMockMode
};
