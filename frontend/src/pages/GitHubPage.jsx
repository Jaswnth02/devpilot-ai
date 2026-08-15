import React, { useState, useEffect, useContext } from 'react';
import api from '../utils/api';
import { AuthContext } from '../context/AuthContext';
import { SocketContext } from '../context/SocketContext';
import {
  Github,
  Search,
  CheckCircle,
  AlertCircle,
  ExternalLink,
  RefreshCw,
  FolderGit2,
  FileCode,
  Sparkles,
  Lock,
  Globe,
  Star,
  GitFork,
  X,
  Layers,
  ArrowRight,
  ShieldCheck,
  Zap,
  Trash2,
  GitCommit,
  GitBranch,
  Clock,
  User,
  Plus,
  Radio,
  Check
} from 'lucide-react';

const GitHubPage = () => {
  const { user } = useContext(AuthContext);
  const { socket } = useContext(SocketContext);

  // Status & Connection state
  const [connectionStatus, setConnectionStatus] = useState({
    connected: false,
    username: '',
    avatar: '',
    profileUrl: '',
    lastSyncedAt: null
  });
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);

  // Sync state: 'idle' | 'syncing' | 'success' | 'failed'
  const [syncStatus, setSyncStatus] = useState('idle');

  // Projects & Repositories state
  const [projects, setProjects] = useState([]);
  const [repositories, setRepositories] = useState([]);

  // Search & Filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [visibilityFilter, setVisibilityFilter] = useState('All'); // 'All' | 'Public' | 'Private'

  // Modals state
  const [showConnectModal, setShowConnectModal] = useState(false);
  const [showDisconnectGitHubModal, setShowDisconnectGitHubModal] = useState(false);
  const [importingRepo, setImportingRepo] = useState(null);
  const [targetProjectId, setTargetProjectId] = useState('');
  const [isSubmittingConnect, setIsSubmittingConnect] = useState(false);

  // GitHub Account Live Verification State
  const [verifyUsername, setVerifyUsername] = useState('');
  const [verifyToken, setVerifyToken] = useState('');
  const [showTokenInput, setShowTokenInput] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [verificationResult, setVerificationResult] = useState(null);
  const [verifyError, setVerifyError] = useState(null);
  const [isConnectingVerified, setIsConnectingVerified] = useState(false);

  // Commit Activity Stream
  const [commits, setCommits] = useState([]);
  const [message, setMessage] = useState(null);

  // Helper to format relative time
  const formatTimeAgo = (dateInput) => {
    if (!dateInput) return 'Never';
    const date = new Date(dateInput);
    if (isNaN(date.getTime())) return 'Never';
    const seconds = Math.floor((new Date() - date) / 1000);
    if (seconds < 60) return 'Just now';
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  };

  // 1. Fetch All Status & Repositories
  const fetchAllData = async (shouldAutoSync = false) => {
    try {
      setLoading(true);
      const [statusRes, projRes] = await Promise.all([
        api.get('/api/github/status').catch(() => ({ data: { connected: false } })),
        api.get('/api/projects').catch(() => ({ data: [] }))
      ]);

      const statusData = statusRes.data || { connected: false };
      setConnectionStatus(statusData);
      setProjects(projRes.data || []);

      if (statusData.connected) {
        if (shouldAutoSync) {
          // Automatic sync on load
          await handleSyncRepositories(false);
        } else {
          const reposRes = await api.get('/api/github/repos').catch(() => ({ data: { repositories: [] } }));
          setRepositories(reposRes.data?.repositories || []);
        }

        // Fetch recent commits from any connected project
        const firstConnected = projRes.data?.find(p => p.githubRepository?.githubRepositoryId);
        if (firstConnected) {
          const repoDetailRes = await api.get(`/api/github/repositories/${firstConnected.id || firstConnected._id}`).catch(() => ({ data: null }));
          if (repoDetailRes.data && repoDetailRes.data.commits) {
            setCommits(repoDetailRes.data.commits);
          }
        }
      } else {
        setRepositories([]);
      }
    } catch (err) {
      console.error('Failed to load GitHub page data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Check if redirected with connected query params
    const params = new URLSearchParams(window.location.search);
    if (params.get('connected') === 'true') {
      setMessage({ type: 'success', text: `GitHub account connected successfully! Welcome @${params.get('username') || ''}` });
      window.history.replaceState({}, document.title, window.location.pathname);
    } else if (params.get('error')) {
      setMessage({ type: 'error', text: `GitHub connection note: ${params.get('error')}` });
      window.history.replaceState({}, document.title, window.location.pathname);
    }

    fetchAllData(true);
  }, []);

  // Listen for real-time WebSocket push activity events
  useEffect(() => {
    if (!socket) return;
    socket.on('github_activity', (newCommit) => {
      setCommits(prev => [newCommit, ...prev.slice(0, 14)]);
      setMessage({ type: 'success', text: `New commit pushed: "${newCommit.message}" by @${newCommit.author_username}` });
    });
    return () => {
      socket.off('github_activity');
    };
  }, [socket]);

  // 2a. Live GitHub Account Verification Action
  const handleVerifyAccount = async (e) => {
    if (e) e.preventDefault();
    if (!verifyUsername || !verifyUsername.trim()) {
      setVerifyError('Please enter a GitHub username to verify.');
      return;
    }

    setIsVerifying(true);
    setVerifyError(null);
    setVerificationResult(null);

    try {
      const res = await api.post('/api/github/verify-account', {
        username: verifyUsername.trim(),
        token: verifyToken ? verifyToken.trim() : null
      });

      if (res.data?.verified && res.data.user) {
        setVerificationResult(res.data.user);
      } else {
        setVerifyError('Could not verify GitHub account. Please check the username.');
      }
    } catch (err) {
      console.error('GitHub Verification error:', err);
      setVerifyError(err.response?.data?.error || `GitHub user "@${verifyUsername}" not found.`);
    } finally {
      setIsVerifying(false);
    }
  };

  // 2b. Confirm Connection for Verified GitHub Account
  const handleConfirmConnectVerified = async () => {
    if (!verificationResult?.username) return;

    setIsConnectingVerified(true);
    try {
      const res = await api.post('/api/github/connect-verified', {
        username: verificationResult.username,
        personalAccessToken: verifyToken ? verifyToken.trim() : null
      });

      if (res.data?.success) {
        setConnectionStatus({
          connected: true,
          username: res.data.connection.username,
          avatar: res.data.connection.avatar,
          profileUrl: res.data.connection.profileUrl,
          email: res.data.connection.email,
          lastSyncedAt: res.data.connection.lastSyncedAt || new Date()
        });
        setRepositories(res.data.repositories || []);
        setShowConnectModal(false);
        setVerificationResult(null);
        setVerifyUsername('');
        setVerifyToken('');
        setMessage({
          type: 'success',
          text: `✓ GitHub account @${res.data.connection.username} verified and connected successfully!`
        });
      }
    } catch (err) {
      console.error('Connect verified error:', err);
      setMessage({ type: 'error', text: err.response?.data?.error || 'Failed to connect verified GitHub account.' });
    } finally {
      setIsConnectingVerified(false);
    }
  };

  // 2c. Direct Connect GitHub OAuth Action
  const handleConnectGitHub = async () => {
    setConnecting(true);
    try {
      const res = await api.get('/api/github/auth');
      if (res.data?.url) {
        window.location.href = res.data.url;
      } else {
        window.location.href = `${api.defaults.baseURL || ''}/api/github/connect`;
      }
    } catch (err) {
      console.error('Connect GitHub error:', err);
      // Fallback redirect directly
      window.location.href = `${api.defaults.baseURL || ''}/api/github/connect`;
    }
  };

  // 3. Synchronize Repositories Action
  const handleSyncRepositories = async (showToast = true) => {
    setSyncStatus('syncing');
    try {
      const res = await api.post('/api/github/sync');
      if (res.data?.repositories) {
        setRepositories(res.data.repositories);
        setConnectionStatus(prev => ({
          ...prev,
          lastSyncedAt: res.data.syncedAt || new Date()
        }));
        setSyncStatus('success');
        if (showToast) {
          setMessage({
            type: 'success',
            text: `Successfully synchronized ${res.data.repositories.length} repositories with GitHub!`
          });
        }
        setTimeout(() => setSyncStatus('idle'), 3000);
      }
    } catch (err) {
      console.error('Sync repositories error:', err);
      setSyncStatus('failed');
      if (showToast) {
        setMessage({ type: 'error', text: 'Failed to synchronize repositories. Please try again.' });
      }
      setTimeout(() => setSyncStatus('idle'), 3000);
    }
  };

  // 4. Disconnect GitHub Account
  const handleDisconnectGitHub = async () => {
    setDisconnecting(true);
    try {
      await api.delete('/api/github/disconnect');
      setConnectionStatus({ connected: false, username: '', avatar: '', profileUrl: '', lastSyncedAt: null });
      setRepositories([]);
      setShowDisconnectGitHubModal(false);
      setMessage({ type: 'success', text: 'GitHub account disconnected successfully.' });
    } catch (err) {
      console.error('Disconnect GitHub error:', err);
      setMessage({ type: 'error', text: 'Failed to disconnect GitHub account.' });
    } finally {
      setDisconnecting(false);
    }
  };

  // 5. Connect Repository to Project Modal Action
  const handleOpenConnectModal = (repo) => {
    setImportingRepo(repo);
    // Preselect first project if available
    if (projects.length > 0) {
      setTargetProjectId(projects[0].id || projects[0]._id);
    }
  };

  const handleConfirmConnectProject = async (e) => {
    e.preventDefault();
    if (!importingRepo || !targetProjectId) return;

    setIsSubmittingConnect(true);
    try {
      const res = await api.post(`/api/github/repos/${importingRepo.id}/connect`, {
        projectId: targetProjectId,
        repositoryName: importingRepo.name,
        repositoryOwner: importingRepo.owner,
        repositoryUrl: importingRepo.html_url,
        description: importingRepo.description,
        isPrivate: importingRepo.private,
        language: importingRepo.language,
        stars: importingRepo.stargazers_count,
        forks: importingRepo.forks_count,
        defaultBranch: importingRepo.default_branch
      });

      setMessage({
        type: 'success',
        text: `Repository "${importingRepo.full_name}" successfully connected to project!`
      });
      setImportingRepo(null);
      // Refresh projects to reflect connected repo
      const projRes = await api.get('/api/projects').catch(() => ({ data: [] }));
      setProjects(projRes.data || []);
    } catch (err) {
      console.error('Connect repo error:', err);
      setMessage({
        type: 'error',
        text: err.response?.data?.error || 'Failed to connect repository to project.'
      });
    } finally {
      setIsSubmittingConnect(false);
    }
  };

  // Filter repositories
  const filteredRepositories = repositories.filter(repo => {
    const matchesSearch = 
      repo.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (repo.description && repo.description.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (repo.language && repo.language.toLowerCase().includes(searchQuery.toLowerCase()));

    const matchesVisibility = 
      visibilityFilter === 'All' ||
      (visibilityFilter === 'Public' && !repo.private) ||
      (visibilityFilter === 'Private' && repo.private);

    return matchesSearch && matchesVisibility;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[calc(100vh-200px)]">
        <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Toast Notification Banner */}
      {message && (
        <div className={`p-4 rounded-xl text-xs flex items-center justify-between border shadow-sm animate-fadeIn ${
          message.type === 'success' ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-rose-50 border-rose-200 text-rose-800'
        }`}>
          <div className="flex items-center space-x-2">
            {message.type === 'success' ? <CheckCircle className="h-4 w-4 text-emerald-600 shrink-0" /> : <AlertCircle className="h-4 w-4 text-rose-600 shrink-0" />}
            <span className="font-semibold">{message.text}</span>
          </div>
          <button onClick={() => setMessage(null)} className="text-slate-400 hover:text-slate-700">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Main Header */}
      <div>
        <h1 className="text-3xl font-extrabold text-slate-900">GitHub Synchronization</h1>
        <p className="text-slate-500 text-sm mt-1">Connect your GitHub account, browse repositories, and link them directly to project workspaces.</p>
      </div>

      {!connectionStatus.connected ? (
        /* NOT CONNECTED STATE WITH VERIFICATION OPTIONS */
        <div className="bg-white p-8 md:p-12 rounded-3xl border border-slate-200 shadow-sm text-center max-w-2xl mx-auto space-y-6 animate-fadeIn">
          <div className="mx-auto bg-gradient-to-tr from-slate-900 via-indigo-950 to-slate-800 p-5 rounded-2xl w-fit text-white shadow-lg shadow-indigo-100 flex items-center justify-center">
            <Github className="h-12 w-12 text-white" />
          </div>
          <div className="space-y-2">
            <div className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full bg-indigo-50 border border-indigo-100 text-indigo-700 text-xs font-semibold">
              <ShieldCheck className="h-3.5 w-3.5 text-indigo-600" />
              <span>GitHub API Identity Verification</span>
            </div>
            <h3 className="text-2xl font-extrabold text-slate-900">Connect & Verify GitHub Account</h3>
            <p className="text-xs text-slate-500 max-w-lg mx-auto leading-relaxed">
              Verify your GitHub developer identity to securely synchronize repositories, stream commit logs, and link project codebases directly to DevPilot AI workspaces.
            </p>
          </div>

          <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
            <button
              onClick={() => {
                setShowConnectModal(true);
                setVerifyError(null);
                setVerificationResult(null);
              }}
              className="w-full sm:w-auto px-6 py-3.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-md hover:shadow-lg transition-all flex items-center justify-center space-x-2 active:scale-[0.98]"
            >
              <ShieldCheck className="h-4 w-4" />
              <span>Verify & Connect GitHub</span>
            </button>

            <button
              onClick={handleConnectGitHub}
              disabled={connecting}
              className="w-full sm:w-auto px-6 py-3.5 bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs rounded-xl shadow-md transition-all flex items-center justify-center space-x-2 disabled:opacity-50 active:scale-[0.98]"
            >
              <Github className="h-4 w-4" />
              <span>{connecting ? 'Redirecting to OAuth...' : 'Authorize via GitHub OAuth'}</span>
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-4 border-t border-slate-100 text-left text-xs">
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 space-y-1">
              <div className="font-bold text-slate-800 flex items-center space-x-1.5">
                <Check className="h-3.5 w-3.5 text-emerald-600" />
                <span>Live Verification</span>
              </div>
              <p className="text-[11px] text-slate-500">Validates GitHub handle and permissions via official API.</p>
            </div>
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 space-y-1">
              <div className="font-bold text-slate-800 flex items-center space-x-1.5">
                <Check className="h-3.5 w-3.5 text-indigo-600" />
                <span>Auto Sync</span>
              </div>
              <p className="text-[11px] text-slate-500">Imports repositories and branches into project tasks.</p>
            </div>
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 space-y-1">
              <div className="font-bold text-slate-800 flex items-center space-x-1.5">
                <Check className="h-3.5 w-3.5 text-purple-600" />
                <span>Real-Time Stream</span>
              </div>
              <p className="text-[11px] text-slate-500">Webhooks push commit activities to your team feed.</p>
            </div>
          </div>
        </div>
      ) : (
        /* CONNECTED STATE */
        <div className="space-y-6">
          {/* Top Status & Sync Action Bar */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div className="flex items-center space-x-4">
              <div className="relative">
                <img
                  src={connectionStatus.avatar || `https://avatars.githubusercontent.com/u/180279780?v=4`}
                  alt={connectionStatus.username}
                  className="h-12 w-12 rounded-full border-2 border-indigo-200 shadow-sm"
                />
                <div className="absolute -bottom-1 -right-1 bg-emerald-500 h-4 w-4 rounded-full border-2 border-white flex items-center justify-center">
                  <Check className="h-2.5 w-2.5 text-white" />
                </div>
              </div>

              <div>
                <div className="flex items-center space-x-2">
                  <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                    <CheckCircle className="h-3 w-3 text-emerald-600" />
                    <span>GitHub Connected</span>
                  </span>
                  <a
                    href={connectionStatus.profileUrl || `https://github.com/${connectionStatus.username}`}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs font-mono font-bold text-slate-700 hover:text-indigo-600 inline-flex items-center space-x-1"
                  >
                    <span>@{connectionStatus.username}</span>
                    <ExternalLink className="h-3 w-3 text-slate-400" />
                  </a>
                </div>
                <p className="text-xs text-slate-500 mt-1 flex items-center space-x-1.5">
                  <Clock className="h-3.5 w-3.5 text-slate-400" />
                  <span>Last synced: <strong className="text-slate-700">{formatTimeAgo(connectionStatus.lastSyncedAt)}</strong></span>
                </p>
              </div>
            </div>

            {/* Sync & Disconnect Action Buttons */}
            <div className="flex items-center space-x-3">
              <button
                onClick={() => handleSyncRepositories(true)}
                disabled={syncStatus === 'syncing'}
                className="px-4 py-2.5 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 text-indigo-700 font-semibold text-xs rounded-xl transition-all flex items-center space-x-2 shadow-xs disabled:opacity-50"
              >
                <RefreshCw className={`h-4 w-4 text-indigo-600 ${syncStatus === 'syncing' ? 'animate-spin' : ''}`} />
                <span>
                  {syncStatus === 'syncing' ? 'Syncing...' : syncStatus === 'success' ? 'Sync Successful ✓' : 'Sync Repositories'}
                </span>
              </button>

              <button
                onClick={() => setShowDisconnectGitHubModal(true)}
                className="px-4 py-2.5 bg-slate-100 hover:bg-rose-50 hover:text-rose-700 hover:border-rose-200 border border-slate-200 text-slate-700 font-semibold text-xs rounded-xl transition-all"
              >
                Disconnect GitHub
              </button>
            </div>
          </div>

          {/* Search & Filter Bar */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="relative flex-1 w-full">
              <Search className="absolute left-3.5 top-3 h-4 w-4 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search repositories by name, language, or description..."
                className="w-full py-2.5 pl-10 pr-4 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-indigo-600 focus:bg-white"
              />
            </div>

            <div className="flex items-center space-x-1 bg-slate-100 p-1 rounded-xl border border-slate-200 shrink-0">
              {['All', 'Public', 'Private'].map((tab) => (
                <button
                  key={tab}
                  onClick={() => setVisibilityFilter(tab)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                    visibilityFilter === tab
                      ? 'bg-white text-indigo-700 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {tab}
                </button>
              ))}
            </div>
          </div>

          {/* Repositories Count */}
          <div className="flex items-center justify-between text-xs text-slate-500 px-1">
            <span>Showing <strong className="text-slate-800">{filteredRepositories.length}</strong> of {repositories.length} accessible repositories</span>
            <span>Source of truth: GitHub API</span>
          </div>

          {/* Repositories Grid */}
          {filteredRepositories.length === 0 ? (
            <div className="bg-white p-12 text-center rounded-2xl border border-slate-200 shadow-sm space-y-3">
              <FolderGit2 className="h-10 w-10 text-slate-300 mx-auto" />
              <h4 className="text-sm font-bold text-slate-900">No repositories matched your search</h4>
              <p className="text-xs text-slate-500">Try adjusting your filter or click "Sync Repositories" to fetch newly created repositories from GitHub.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {filteredRepositories.map((repo) => {
                // Check if this repository is already connected to any project
                const connectedProject = projects.find(p => 
                  String(p.githubRepository?.githubRepositoryId) === String(repo.id) ||
                  p.githubRepository?.name?.toLowerCase() === repo.name?.toLowerCase()
                );

                return (
                  <div
                    key={repo.id}
                    className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between hover:border-indigo-300 hover:shadow-md transition-all duration-200 group"
                  >
                    <div>
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <h3 className="text-sm font-bold text-slate-900 truncate group-hover:text-indigo-600 transition-colors" title={repo.name}>
                            {repo.name}
                          </h3>
                          <p className="text-[11px] text-slate-400 font-mono mt-0.5 truncate">{repo.full_name}</p>
                        </div>

                        <span className={`inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-[10px] font-bold shrink-0 ${
                          repo.private
                            ? 'bg-amber-50 text-amber-700 border border-amber-200'
                            : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                        }`}>
                          {repo.private ? <Lock className="h-3 w-3 text-amber-600" /> : <Globe className="h-3 w-3 text-emerald-600" />}
                          <span>{repo.private ? 'Private' : 'Public'}</span>
                        </span>
                      </div>

                      <p className="text-xs text-slate-600 mt-3 line-clamp-2 leading-relaxed">
                        {repo.description || 'No description provided.'}
                      </p>

                      {/* Language & Stats */}
                      <div className="mt-4 flex items-center space-x-3 text-[11px] text-slate-500">
                        {repo.language && (
                          <span className="px-2 py-0.5 rounded bg-slate-100 border border-slate-200 font-medium text-slate-700 text-[10px]">
                            {repo.language}
                          </span>
                        )}

                        <div className="flex items-center space-x-1">
                          <Star className="h-3.5 w-3.5 text-amber-500" />
                          <span>{repo.stargazers_count}</span>
                        </div>

                        <div className="flex items-center space-x-1">
                          <GitFork className="h-3.5 w-3.5 text-slate-400" />
                          <span>{repo.forks_count}</span>
                        </div>
                      </div>

                      {connectedProject && (
                        <div className="mt-3 p-2 rounded-lg bg-indigo-50 border border-indigo-100 text-[11px] text-indigo-700 flex items-center space-x-1.5">
                          <CheckCircle className="h-3.5 w-3.5 text-indigo-600 shrink-0" />
                          <span className="truncate">Linked to <strong>{connectedProject.name}</strong></span>
                        </div>
                      )}
                    </div>

                    {/* Bottom Action Footer */}
                    <div className="border-t border-slate-100 pt-4 mt-5 flex items-center justify-between">
                      <a
                        href={repo.html_url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-xs font-semibold text-slate-500 hover:text-slate-800 inline-flex items-center space-x-1"
                      >
                        <span>View on GitHub</span>
                        <ExternalLink className="h-3 w-3 text-slate-400" />
                      </a>

                      <button
                        onClick={() => handleOpenConnectModal(repo)}
                        className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs rounded-xl transition-all shadow-xs active:scale-[0.98]"
                      >
                        {connectedProject ? 'Change Project' : 'Connect to Project'}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Live Commit Stream */}
          {commits.length > 0 && (
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
              <div className="flex items-center space-x-2">
                <GitCommit className="h-5 w-5 text-indigo-600" />
                <h3 className="text-base font-bold text-slate-900">Recent Connected Repository Activity</h3>
              </div>

              <div className="divide-y divide-slate-100 max-h-60 overflow-y-auto pr-1">
                {commits.map((c, idx) => (
                  <div key={c._id || idx} className="py-3 flex items-start justify-between gap-4">
                    <div className="flex items-start space-x-2.5">
                      <div className="h-2 w-2 rounded-full bg-indigo-600 mt-1.5 shrink-0"></div>
                      <div>
                        <p className="text-xs font-semibold text-slate-900">{c.message}</p>
                        <p className="text-[10px] text-slate-500 mt-0.5">
                          by <strong className="text-slate-700">@{c.author_username}</strong> • {formatTimeAgo(c.committed_at)}
                        </p>
                      </div>
                    </div>
                    {c.url && (
                      <a href={c.url} target="_blank" rel="noreferrer" className="text-[10px] font-mono text-indigo-600 hover:underline shrink-0">
                        {c.sha ? c.sha.substring(0, 7) : 'view'}
                      </a>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* MODAL: Connect Repository to Project */}
      {importingRepo && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-white w-full max-w-lg rounded-2xl border border-slate-200 p-6 space-y-5 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div className="flex items-center space-x-2.5">
                <div className="p-2 rounded-xl bg-indigo-50 border border-indigo-100 text-indigo-600">
                  <FolderGit2 className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-900">Connect Repository</h3>
                  <p className="text-xs text-slate-500 font-mono">{importingRepo.full_name}</p>
                </div>
              </div>
              <button onClick={() => setImportingRepo(null)} className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 transition-colors">
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleConfirmConnectProject} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">Select Target Project Workspace</label>
                {projects.length === 0 ? (
                  <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl text-center text-xs text-slate-500">
                    No active projects found. Please create a project first.
                  </div>
                ) : (
                  <select
                    value={targetProjectId}
                    onChange={(e) => setTargetProjectId(e.target.value)}
                    required
                    className="w-full p-3 rounded-xl bg-slate-50 border border-slate-300 text-slate-900 text-xs focus:outline-none focus:border-indigo-600 focus:bg-white"
                  >
                    {projects.map((p) => (
                      <option key={p.id || p._id} value={p.id || p._id}>
                        {p.name} ({p.projectCode})
                      </option>
                    ))}
                  </select>
                )}
              </div>

              {/* Selected Repo Preview Details */}
              <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-2 text-xs">
                <div className="flex justify-between">
                  <span className="text-slate-500">Repository Name:</span>
                  <span className="font-semibold text-slate-900">{importingRepo.name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Default Branch:</span>
                  <span className="font-mono font-semibold text-indigo-700">{importingRepo.default_branch}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Language:</span>
                  <span className="font-semibold text-slate-700">{importingRepo.language}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Visibility:</span>
                  <span className="font-semibold text-slate-700">{importingRepo.private ? 'Private' : 'Public'}</span>
                </div>
              </div>

              <div className="flex justify-end space-x-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setImportingRepo(null)}
                  className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingConnect || !targetProjectId}
                  className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs rounded-xl shadow-sm transition-all disabled:opacity-50 flex items-center space-x-1.5"
                >
                  {isSubmittingConnect ? <span>Connecting...</span> : <span>Connect Repository</span>}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Verify & Connect GitHub Account */}
      {showConnectModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-white w-full max-w-lg rounded-3xl border border-slate-200 p-6 md:p-8 space-y-6 shadow-2xl relative">
            <button
              onClick={() => {
                setShowConnectModal(false);
                setVerificationResult(null);
                setVerifyError(null);
              }}
              className="absolute top-6 right-6 p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
            >
              <X className="h-5 w-5" />
            </button>

            {/* Modal Header */}
            <div className="flex items-center space-x-3.5">
              <div className="p-3 bg-gradient-to-tr from-slate-900 to-indigo-900 text-white rounded-2xl shadow-md shadow-indigo-100">
                <Github className="h-6 w-6" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-900">Connect & Verify GitHub</h3>
                <p className="text-xs text-slate-500 mt-0.5">Verify your GitHub developer profile before linking</p>
              </div>
            </div>

            {verifyError && (
              <div className="p-3.5 bg-rose-50 border border-rose-200 text-rose-800 text-xs rounded-xl flex items-center space-x-2 animate-fadeIn">
                <AlertCircle className="h-4 w-4 shrink-0 text-rose-600" />
                <span>{verifyError}</span>
              </div>
            )}

            {!verificationResult ? (
              /* STEP 1: VERIFY USERNAME */
              <form onSubmit={handleVerifyAccount} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-slate-700">
                    GitHub Username or Profile Link
                  </label>
                  <div className="relative">
                    <Github className="absolute left-3.5 top-3.5 h-4 w-4 text-slate-400" />
                    <input
                      type="text"
                      value={verifyUsername}
                      onChange={(e) => {
                        setVerifyUsername(e.target.value);
                        setVerifyError(null);
                      }}
                      placeholder="e.g. Jaswnth02 or https://github.com/Jaswnth02"
                      required
                      className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-indigo-600 focus:bg-white transition-all font-mono"
                    />
                  </div>
                  <p className="text-[11px] text-slate-400">
                    We will live-query GitHub's official API to verify that the account exists and retrieve public repositories.
                  </p>
                </div>

                {/* Optional PAT Toggle */}
                <div className="pt-1">
                  <button
                    type="button"
                    onClick={() => setShowTokenInput(!showTokenInput)}
                    className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 flex items-center space-x-1"
                  >
                    <span>{showTokenInput ? '− Hide Personal Access Token (Optional)' : '+ Add Personal Access Token for Private Repos'}</span>
                  </button>

                  {showTokenInput && (
                    <div className="mt-2.5 p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-2 animate-fadeIn">
                      <label className="block text-[11px] font-bold text-slate-700">
                        GitHub Personal Access Token (PAT)
                      </label>
                      <input
                        type="password"
                        value={verifyToken}
                        onChange={(e) => setVerifyToken(e.target.value)}
                        placeholder="ghp_xxxxxxxxxxxxxxxxxxxx"
                        className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-mono text-slate-900 placeholder-slate-400 focus:outline-none focus:border-indigo-600"
                      />
                      <p className="text-[10px] text-slate-400">
                        Token will be securely AES-256 encrypted. Requires <code className="bg-slate-200 px-1 rounded">repo</code> scope for private repos.
                      </p>
                    </div>
                  )}
                </div>

                <div className="pt-3 flex flex-col sm:flex-row items-center justify-between gap-3">
                  <button
                    type="button"
                    onClick={handleConnectGitHub}
                    disabled={connecting}
                    className="w-full sm:w-auto px-4 py-3 text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-xl text-xs font-semibold transition-colors flex items-center justify-center space-x-1.5"
                  >
                    <Github className="h-3.5 w-3.5" />
                    <span>{connecting ? 'Redirecting...' : 'OAuth Redirect'}</span>
                  </button>

                  <button
                    type="submit"
                    disabled={isVerifying || !verifyUsername.trim()}
                    className="w-full sm:w-auto px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl shadow-md transition-all flex items-center justify-center space-x-2 disabled:opacity-50 active:scale-[0.98]"
                  >
                    <ShieldCheck className="h-4 w-4" />
                    <span>{isVerifying ? 'Verifying with GitHub...' : 'Verify GitHub Account'}</span>
                  </button>
                </div>
              </form>
            ) : (
              /* STEP 2: VERIFIED PROFILE CONFIRMATION */
              <div className="space-y-5 animate-fadeIn">
                {/* Verified Success Alert */}
                <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-center space-x-3 text-xs text-emerald-800">
                  <div className="p-1.5 bg-emerald-100 rounded-xl text-emerald-700 shrink-0">
                    <Check className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="font-bold text-emerald-900">GitHub Identity Verified ✓</p>
                    <p className="text-emerald-700 text-[11px] mt-0.5">
                      Account authenticated via GitHub API. Review details and confirm connection.
                    </p>
                  </div>
                </div>

                {/* Identity Card */}
                <div className="p-5 bg-gradient-to-br from-slate-50 to-indigo-50/40 rounded-2xl border border-indigo-100 space-y-4">
                  <div className="flex items-center space-x-4">
                    <img
                      src={verificationResult.avatarUrl || `https://avatars.githubusercontent.com/${verificationResult.username}`}
                      alt={verificationResult.username}
                      className="h-16 w-16 rounded-2xl border-2 border-white shadow-md"
                    />
                    <div className="space-y-1">
                      <div className="flex items-center space-x-2">
                        <h4 className="text-base font-extrabold text-slate-900">{verificationResult.fullName || verificationResult.username}</h4>
                        <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                          <CheckCircle className="h-3 w-3 text-emerald-600" />
                          <span>Verified</span>
                        </span>
                      </div>
                      <a
                        href={verificationResult.profileUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="text-xs font-mono font-bold text-indigo-600 hover:underline inline-flex items-center space-x-1"
                      >
                        <span>@{verificationResult.username}</span>
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    </div>
                  </div>

                  {verificationResult.bio && (
                    <p className="text-xs text-slate-600 italic bg-white/70 p-2.5 rounded-xl border border-indigo-50">
                      "{verificationResult.bio}"
                    </p>
                  )}

                  {/* Account Stats */}
                  <div className="grid grid-cols-2 gap-3 pt-1">
                    <div className="p-3 bg-white rounded-xl border border-slate-200/80 text-center">
                      <span className="block text-lg font-extrabold text-slate-900">{verificationResult.publicRepos || 0}</span>
                      <span className="text-[11px] font-medium text-slate-500">Public Repositories</span>
                    </div>
                    <div className="p-3 bg-white rounded-xl border border-slate-200/80 text-center">
                      <span className="block text-lg font-extrabold text-slate-900">{verificationResult.followers || 0}</span>
                      <span className="text-[11px] font-medium text-slate-500">Followers</span>
                    </div>
                  </div>
                </div>

                {/* Modal Action Buttons */}
                <div className="flex items-center justify-between pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setVerificationResult(null);
                      setVerifyError(null);
                    }}
                    className="px-4 py-2.5 text-xs font-semibold text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors"
                  >
                    Change Username
                  </button>

                  <button
                    type="button"
                    onClick={handleConfirmConnectVerified}
                    disabled={isConnectingVerified}
                    className="px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl shadow-md hover:shadow-lg transition-all flex items-center space-x-2 disabled:opacity-50 active:scale-[0.98]"
                  >
                    <CheckCircle className="h-4 w-4" />
                    <span>{isConnectingVerified ? 'Connecting & Syncing...' : `Confirm & Connect @${verificationResult.username}`}</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* MODAL: Disconnect GitHub Confirmation */}
      {showDisconnectGitHubModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-white w-full max-w-md rounded-2xl border border-slate-200 p-6 space-y-4 shadow-2xl">
            <h3 className="text-base font-bold text-slate-900">Disconnect GitHub Account?</h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              Are you sure you want to disconnect @{connectionStatus.username}? Your stored OAuth token will be cleared. You can reconnect at any time.
            </p>
            <div className="flex justify-end space-x-2.5 pt-2">
              <button
                type="button"
                onClick={() => setShowDisconnectGitHubModal(false)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDisconnectGitHub}
                disabled={disconnecting}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold rounded-xl shadow-sm transition-colors"
              >
                {disconnecting ? 'Disconnecting...' : 'Yes, Disconnect'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default GitHubPage;
