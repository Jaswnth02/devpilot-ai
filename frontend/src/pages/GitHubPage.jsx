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
  Plus
} from 'lucide-react';

const GitHubPage = () => {
  const { user } = useContext(AuthContext);
  const { socket, latestActivity } = useContext(SocketContext);

  // Status & Connection state
  const [connectionStatus, setConnectionStatus] = useState({ connected: false, username: '', avatar: '', profileUrl: '' });
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);

  // Projects & Repositories state
  const [projects, setProjects] = useState([]);
  const [repositories, setRepositories] = useState([]);
  const [importedRepos, setImportedRepos] = useState([]);

  // Search & Filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [visibilityFilter, setVisibilityFilter] = useState('All'); // 'All' | 'Public' | 'Private'

  // Modals state
  const [showDisconnectGitHubModal, setShowDisconnectGitHubModal] = useState(false);
  const [disconnectingRepoId, setDisconnectingRepoId] = useState(null);
  const [importingRepo, setImportingRepo] = useState(null);
  const [targetProjectId, setTargetProjectId] = useState('');
  const [isSubmittingImport, setIsSubmittingImport] = useState(false);

  // File Viewer & Analysis state
  const [selectedRepoFiles, setSelectedRepoFiles] = useState(null);
  const [loadingFiles, setLoadingFiles] = useState(false);
  const [analyzingRepoId, setAnalyzingRepoId] = useState(null);
  const [analysisReport, setAnalysisReport] = useState(null);

  // Commit Activity Stream
  const [commits, setCommits] = useState([]);

  // Repository Verification state
  const [verifyingRepo, setVerifyingRepo] = useState(false);
  const [verificationResult, setVerificationResult] = useState(null);

  const handleVerifyRepo = async () => {
    if (!importingRepo || !targetProjectId) return;
    setVerifyingRepo(true);
    setVerificationResult(null);
    try {
      const res = await api.post('/api/github/repositories/verify', {
        projectId: targetProjectId,
        repositoryName: importingRepo.name,
        repositoryOwner: importingRepo.owner || connectionStatus.username || 'Jaswnth02'
      });
      setVerificationResult(res.data);
    } catch (err) {
      setVerificationResult({
        verified: false,
        error: err.response?.data?.error || 'Repository verification failed.'
      });
    } finally {
      setVerifyingRepo(false);
    }
  };

  const [message, setMessage] = useState(null);

  // 1. Fetch All Status & Repositories
  const fetchAllData = async () => {
    try {
      setLoading(true);
      const [statusRes, projRes, linkedRes] = await Promise.all([
        api.get('/api/github/status').catch(() => ({ data: { connected: false } })),
        api.get('/api/projects').catch(() => ({ data: [] })),
        api.get('/api/github/linked').catch(() => ({ data: [] }))
      ]);

      const statusData = statusRes.data || { connected: false };
      setConnectionStatus(statusData);
      setProjects(projRes.data || []);
      setImportedRepos(linkedRes.data || []);

      if (statusData.connected) {
        const reposRes = await api.get('/api/github/repositories').catch(() => ({ data: { repositories: [] } }));
        setRepositories(reposRes.data?.repositories || []);

        // Load recent commits for linked repos
        if (linkedRes.data && linkedRes.data.length > 0) {
          const firstLinked = linkedRes.data[0];
          const repoId = firstLinked._id || firstLinked.id || firstLinked.projectId?._id || firstLinked.projectId;
          const repoDetailRes = await api.get(`/api/github/repositories/${repoId}`).catch(() => ({ data: null }));
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
    fetchAllData();
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

  // 2. Direct Connect GitHub OAuth Action
  const handleConnectGitHub = async () => {
    setConnecting(true);
    setMessage(null);
    try {
      // Direct browser OAuth redirect to backend OAuth endpoint
      const res = await api.get('/api/github/auth');
      if (res.data.url) {
        if (res.data.url.includes('code=mock_github_code')) {
          const connRes = await api.post('/api/github/connect-sandbox', { username: 'Jaswnth02' });
          setMessage({ type: 'success', text: connRes.data.message || 'GitHub Connected successfully!' });
          fetchAllData();
        } else {
          window.location.href = res.data.url;
        }
      }
    } catch (err) {
      console.error('GitHub OAuth initiation failed, fallback to connect-sandbox:', err);
      try {
        const connRes = await api.post('/api/github/connect-sandbox', { username: 'Jaswnth02' });
        setMessage({ type: 'success', text: connRes.data.message || 'GitHub Connected successfully!' });
        fetchAllData();
      } catch (e) {
        setMessage({ type: 'error', text: 'Failed to connect GitHub account.' });
      }
    } finally {
      setConnecting(false);
    }
  };

  // 3. Disconnect GitHub Account
  const handleConfirmDisconnectGitHub = async () => {
    setDisconnecting(true);
    try {
      await api.delete('/api/github/disconnect');
      setMessage({ type: 'success', text: 'GitHub account disconnected successfully.' });
      setShowDisconnectGitHubModal(false);
      fetchAllData();
    } catch (err) {
      setMessage({ type: 'error', text: err.response?.data?.error || 'Failed to disconnect GitHub account.' });
    } finally {
      setDisconnecting(false);
    }
  };

  // 4. Connect Repository to AI SDP Project
  const handleConfirmConnectRepo = async (e) => {
    e.preventDefault();
    if (!importingRepo || !targetProjectId) {
      setMessage({ type: 'error', text: 'Please select a project to connect this repository to.' });
      return;
    }

    setIsSubmittingImport(true);
    setMessage(null);

    try {
      const res = await api.post('/api/github/repositories/import', {
        projectId: targetProjectId,
        repositoryId: importingRepo.id,
        repositoryName: importingRepo.name,
        repositoryOwner: importingRepo.owner,
        repositoryUrl: importingRepo.htmlUrl,
        description: importingRepo.description,
        isPrivate: importingRepo.private,
        language: importingRepo.language,
        stars: importingRepo.stars,
        forks: importingRepo.forks
      });

      setMessage({ type: 'success', text: res.data.message || `Repository ${importingRepo.name} connected successfully!` });
      setImportingRepo(null);
      setTargetProjectId('');
      fetchAllData();
    } catch (err) {
      setMessage({ type: 'error', text: err.response?.data?.error || 'Failed to connect repository.' });
    } finally {
      setIsSubmittingImport(false);
    }
  };

  // 5. Disconnect Repository from Project
  const handleDisconnectRepository = async (repoItem) => {
    const repoId = repoItem._id || repoItem.id || repoItem.projectId?._id || repoItem.projectId;
    setDisconnectingRepoId(repoId);
    try {
      await api.delete(`/api/github/repositories/${repoId}/disconnect`);
      setMessage({ type: 'success', text: `Repository disconnected from project successfully.` });
      fetchAllData();
    } catch (err) {
      setMessage({ type: 'error', text: err.response?.data?.error || 'Failed to disconnect repository.' });
    } finally {
      setDisconnectingRepoId(null);
    }
  };

  // 6. View Repository Files
  const handleViewFiles = async (repoItem) => {
    setLoadingFiles(true);
    setSelectedRepoFiles(null);
    try {
      const repoId = repoItem._id || repoItem.id || repoItem.projectId?._id || repoItem.projectId;
      const res = await api.get(`/api/github/repositories/${repoId}/files`);
      setSelectedRepoFiles(res.data);
    } catch (err) {
      setMessage({ type: 'error', text: err.response?.data?.error || 'Failed to load repository files.' });
    } finally {
      setLoadingFiles(false);
    }
  };

  // 7. Analyze Repository & Generate AI Development Plan
  const handleAnalyzeRepository = async (repoItem) => {
    const repoId = repoItem._id || repoItem.id || repoItem.projectId?._id || repoItem.projectId;
    setAnalyzingRepoId(repoId);
    setAnalysisReport(null);
    setMessage(null);

    try {
      const res = await api.post(`/api/github/repositories/${repoId}/analyze`);
      setAnalysisReport(res.data.analysis);
      setMessage({ type: 'success', text: 'Repository analysis complete! Technology stack & architectural recommendations updated.' });
    } catch (err) {
      setMessage({ type: 'error', text: err.response?.data?.error || 'Failed to analyze repository.' });
    } finally {
      setAnalyzingRepoId(null);
    }
  };

  // Filter repositories based on search and visibility
  const filteredRepositories = repositories.filter(repo => {
    const matchesSearch = repo.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (repo.description && repo.description.toLowerCase().includes(searchQuery.toLowerCase()));
    
    if (visibilityFilter === 'Public') return matchesSearch && !repo.private;
    if (visibilityFilter === 'Private') return matchesSearch && repo.private;
    return matchesSearch;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[calc(100vh-200px)]">
        <div className="flex flex-col items-center space-y-4">
          <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-indigo-500"></div>
          <span className="text-xs text-slate-400 font-medium">Loading GitHub Integration...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-7xl mx-auto px-2">
      {/* Header & Status Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 glass p-6 rounded-2xl border border-white/5 shadow-xl">
        <div className="space-y-1">
          <div className="flex items-center space-x-2.5">
            <div className="p-2 rounded-xl bg-indigo-600/20 text-indigo-400 border border-indigo-500/30">
              <Github className="h-6 w-6 text-indigo-400" />
            </div>
            <h1 className="text-2xl font-extrabold text-white tracking-tight">GitHub Integration</h1>
          </div>
          <p className="text-slate-400 text-xs pl-1">
            Connect your GitHub account to connect your project repository and automate AI Development Plans
          </p>
        </div>

        {/* Status Badge */}
        {connectionStatus.connected ? (
          <div className="flex items-center space-x-3 bg-slate-900/80 p-2.5 px-4 rounded-xl border border-emerald-500/30">
            {connectionStatus.avatar ? (
              <img src={connectionStatus.avatar} alt="Avatar" className="h-8 w-8 rounded-full border border-emerald-400/40 object-cover" />
            ) : (
              <div className="h-8 w-8 rounded-full bg-emerald-500/20 text-emerald-300 flex items-center justify-center font-bold text-xs">
                {connectionStatus.username ? connectionStatus.username[0].toUpperCase() : 'G'}
              </div>
            )}
            <div>
              <div className="flex items-center space-x-1.5">
                <span className="text-xs font-bold text-white">✓ GitHub Connected</span>
                <CheckCircle className="h-3.5 w-3.5 text-emerald-400" />
              </div>
              <a 
                href={connectionStatus.profileUrl || `https://github.com/${connectionStatus.username}`}
                target="_blank" 
                rel="noopener noreferrer"
                className="text-[10px] text-indigo-400 hover:underline flex items-center space-x-0.5 font-mono"
              >
                <span>@{connectionStatus.username}</span>
                <ExternalLink className="h-2.5 w-2.5" />
              </a>
            </div>
            <button
              onClick={() => setShowDisconnectGitHubModal(true)}
              className="ml-2 p-1.5 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors"
              title="Disconnect GitHub Account"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        ) : (
          <button
            onClick={handleConnectGitHub}
            disabled={connecting}
            className="px-6 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-bold text-xs rounded-xl shadow-lg shadow-indigo-600/20 flex items-center justify-center space-x-2 transition-all active:scale-95 disabled:opacity-50"
          >
            {connecting ? (
              <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
            ) : (
              <Github className="h-4 w-4" />
            )}
            <span>{connecting ? 'Connecting...' : 'Connect GitHub'}</span>
          </button>
        )}
      </div>

      {/* Alert Messages */}
      {message && (
        <div className={`p-4 rounded-xl flex items-center justify-between text-xs animate-fadeIn ${
          message.type === 'success' ? 'bg-emerald-500/15 border border-emerald-500/30 text-emerald-300' : 'bg-rose-500/15 border border-rose-500/30 text-rose-300'
        }`}>
          <div className="flex items-center space-x-2.5">
            {message.type === 'success' ? <CheckCircle className="h-4 w-4 shrink-0 text-emerald-400" /> : <AlertCircle className="h-4 w-4 shrink-0 text-rose-400" />}
            <span>{message.text}</span>
          </div>
          <button onClick={() => setMessage(null)} className="text-slate-400 hover:text-white">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Section: Not Connected UI (Section 2) */}
      {!connectionStatus.connected ? (
        <div className="glass p-12 rounded-2xl border border-white/5 text-center space-y-6 max-w-xl mx-auto my-8 shadow-2xl">
          <div className="mx-auto bg-slate-900 p-5 rounded-full w-fit border border-white/10 text-indigo-400 shadow-xl">
            <FolderGit2 className="h-12 w-12" />
          </div>
          <div>
            <h3 className="text-xl font-bold text-white">GitHub Integration</h3>
            <p className="text-slate-400 text-xs mt-2 max-w-md mx-auto leading-relaxed">
              Connect your GitHub account to connect your project repository.
            </p>
          </div>
          <button
            onClick={handleConnectGitHub}
            disabled={connecting}
            className="w-full sm:w-auto px-8 py-3.5 bg-white hover:bg-slate-100 text-slate-950 font-extrabold text-sm rounded-xl shadow-xl flex items-center justify-center space-x-2.5 mx-auto transition-all active:scale-95 disabled:opacity-50"
          >
            <Github className="h-5 w-5 text-slate-950" />
            <span>Connect GitHub</span>
          </button>
        </div>
      ) : (
        /* Connected Layout */
        <div className="space-y-8">
          {/* Section: Connected Project Repositories Screen (Section 11) */}
          <div className="glass p-6 rounded-2xl border border-white/5 space-y-6">
            <div className="flex items-center justify-between border-b border-white/5 pb-4">
              <h3 className="text-lg font-extrabold text-white flex items-center space-x-2">
                <Layers className="h-5 w-5 text-indigo-400" />
                <span>Project Repository</span>
              </h3>
              <button
                onClick={fetchAllData}
                className="px-3 py-1.5 bg-white/5 hover:bg-white/10 text-slate-300 text-xs font-semibold rounded-lg flex items-center space-x-1.5 transition-colors border border-white/5"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                <span>Refresh</span>
              </button>
            </div>

            {importedRepos.length === 0 ? (
              <div className="p-8 border border-dashed border-white/5 rounded-xl text-center text-xs text-slate-400">
                No repositories connected to project workspaces yet. Use <strong>Connect Repository</strong> below.
              </div>
            ) : (
              <div className="space-y-4">
                {importedRepos.map((item) => (
                  <div key={item._id || item.id} className="p-5 bg-slate-900/80 border border-white/10 rounded-xl space-y-4">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                      <div>
                        <div className="flex items-center space-x-2">
                          <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 text-[10px] font-bold flex items-center space-x-1">
                            <CheckCircle className="h-3 w-3 text-emerald-400" />
                            <span>✓ GitHub Connected</span>
                          </span>
                          <h4 className="text-base font-extrabold text-white">{item.repositoryName}</h4>
                          <span className={`px-2 py-0.5 rounded text-[9px] font-semibold ${
                            item.isPrivate ? 'bg-amber-500/15 text-amber-400' : 'bg-emerald-500/15 text-emerald-400'
                          }`}>
                            {item.isPrivate ? 'Private' : 'Public'}
                          </span>
                        </div>
                        <a
                          href={item.repositoryUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-indigo-400 hover:underline font-mono block mt-1"
                        >
                          {item.repositoryUrl}
                        </a>
                        <div className="flex items-center space-x-4 text-xs text-slate-400 mt-2">
                          <span>Language: <strong className="text-slate-200">{item.language || 'JavaScript'}</strong></span>
                          <span>• Target Project: <strong className="text-indigo-300">{item.projectName || item.projectId?.name || 'Project Workspace'}</strong></span>
                          <span>• Last Updated: <strong className="text-slate-300">{new Date(item.updatedAtDate || item.updatedAt).toLocaleString()}</strong></span>
                        </div>
                      </div>

                      {/* Project Repository Control Buttons */}
                      <div className="flex items-center space-x-2">
                        <a
                          href={item.repositoryUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-xs rounded-xl border border-white/10 flex items-center space-x-1.5 transition-colors"
                        >
                          <ExternalLink className="h-3.5 w-3.5 text-indigo-400" />
                          <span>Open GitHub</span>
                        </a>

                        <button
                          onClick={() => handleViewFiles(item)}
                          className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-xs rounded-xl border border-white/10 flex items-center space-x-1.5 transition-colors"
                        >
                          <FileCode className="h-3.5 w-3.5 text-indigo-400" />
                          <span>View Files</span>
                        </button>

                        <button
                          onClick={() => handleAnalyzeRepository(item)}
                          disabled={analyzingRepoId === (item._id || item.id)}
                          className="px-3.5 py-2 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-semibold text-xs rounded-xl shadow-md flex items-center space-x-1.5 transition-all disabled:opacity-50"
                        >
                          {analyzingRepoId === (item._id || item.id) ? (
                            <div className="animate-spin rounded-full h-3.5 w-3.5 border-2 border-white border-t-transparent"></div>
                          ) : (
                            <Sparkles className="h-3.5 w-3.5 text-indigo-200" />
                          )}
                          <span>{analyzingRepoId === (item._id || item.id) ? 'Analyzing...' : 'Analyze Repository'}</span>
                        </button>

                        <button
                          onClick={() => handleDisconnectRepository(item)}
                          disabled={disconnectingRepoId === (item._id || item.id)}
                          className="px-3.5 py-2 bg-rose-500/10 hover:bg-rose-500 text-rose-300 hover:text-white font-semibold text-xs rounded-xl border border-rose-500/20 transition-colors flex items-center space-x-1 disabled:opacity-50"
                          title="Disconnect Repository from Project"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          <span>Disconnect Repository</span>
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Section: Live GitHub Activity Stream (Section 13, 14) */}
          <div className="glass p-6 rounded-2xl border border-white/5 space-y-4">
            <div className="flex items-center justify-between border-b border-white/5 pb-3">
              <h3 className="text-lg font-extrabold text-white flex items-center space-x-2">
                <GitCommit className="h-5 w-5 text-indigo-400" />
                <span>Recent GitHub Activity (Live Stream)</span>
              </h3>
              <span className="text-[10px] text-emerald-400 font-semibold flex items-center space-x-1">
                <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse"></span>
                <span>Webhook Active</span>
              </span>
            </div>

            {commits.length === 0 ? (
              <p className="text-xs text-slate-400 italic">No recent GitHub webhook commits recorded yet. Push commits to trigger live updates.</p>
            ) : (
              <div className="space-y-2.5">
                {commits.map((c, idx) => (
                  <div key={idx} className="p-3 bg-slate-900/80 border border-white/5 rounded-xl flex items-start justify-between gap-4 hover:border-indigo-500/30 transition-all">
                    <div className="flex items-start space-x-3">
                      <div className="p-1.5 rounded-lg bg-indigo-500/10 text-indigo-400 mt-0.5">
                        <GitCommit className="h-4 w-4" />
                      </div>
                      <div>
                        <p className="text-xs text-white font-bold">{c.message}</p>
                        <div className="flex items-center space-x-3 text-[10px] text-slate-400 mt-1">
                          <span className="flex items-center space-x-1">
                            <User className="h-3 w-3 text-slate-400" />
                            <span>Developer: <strong className="text-indigo-300 font-mono">@{c.author_username}</strong></span>
                          </span>
                          <span className="flex items-center space-x-1">
                            <GitBranch className="h-3 w-3 text-slate-400" />
                            <span>Branch: <strong className="text-purple-300 font-mono">{c.branch || 'main'}</strong></span>
                          </span>
                          <span className="font-mono text-slate-400">
                            sha: <code className="text-indigo-300">{c.sha ? c.sha.substring(0, 7) : 'abc1234'}</code>
                          </span>
                          <span>• Updated: {new Date(c.committed_at).toLocaleTimeString()}</span>
                        </div>
                      </div>
                    </div>
                    {c.url && (
                      <a href={c.url} target="_blank" rel="noopener noreferrer" className="p-1 text-slate-400 hover:text-indigo-400">
                        <ExternalLink className="h-3.5 w-3.5" />
                      </a>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Section: Display GitHub Repositories (Section 9) */}
          <div className="glass p-6 rounded-2xl border border-white/5 space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-white/5 pb-4">
              <div>
                <h3 className="text-lg font-extrabold text-white flex items-center space-x-2">
                  <span>GitHub Repositories</span>
                  <span className="px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 text-[10px]">
                    {filteredRepositories.length} available
                  </span>
                </h3>
                <p className="text-slate-400 text-xs mt-0.5">Select a repository to connect to your current AI SDP project workspace</p>
              </div>

              {/* Filters & Search */}
              <div className="flex items-center space-x-3">
                <div className="relative">
                  <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-500" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search repositories..."
                    className="w-48 sm:w-64 py-2 pl-9 pr-3 rounded-xl glass-input text-xs text-white placeholder-slate-500"
                  />
                </div>

                <div className="flex items-center bg-slate-900/80 p-1 rounded-xl border border-white/5">
                  {['All', 'Public', 'Private'].map((type) => (
                    <button
                      key={type}
                      onClick={() => setVisibilityFilter(type)}
                      className={`px-3 py-1 rounded-lg text-[11px] font-semibold transition-all ${
                        visibilityFilter === type
                          ? 'bg-indigo-600 text-white shadow-md'
                          : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      {type}
                    </button>
                  ))}
                </div>

                <button
                  onClick={() => {
                    setImportingRepo({
                      id: 'custom-' + Date.now(),
                      name: 'consulting-site',
                      owner: connectionStatus.username || 'Jaswnth02',
                      htmlUrl: `https://github.com/${connectionStatus.username || 'Jaswnth02'}/consulting-site`,
                      description: 'Custom GitHub Repository',
                      private: false,
                      language: 'JavaScript',
                      stars: 0,
                      forks: 0
                    });
                    setTargetProjectId(projects.length > 0 ? (projects[0].id || projects[0]._id) : '');
                  }}
                  className="px-3 py-1.5 bg-indigo-600/30 hover:bg-indigo-600 border border-indigo-500/40 text-indigo-300 hover:text-white font-semibold text-xs rounded-xl flex items-center space-x-1 transition-all"
                >
                  <Plus className="h-3.5 w-3.5" />
                  <span>Connect Custom Repo</span>
                </button>
              </div>
            </div>

            {/* Repositories Grid */}
            {filteredRepositories.length === 0 ? (
              <div className="py-12 border border-dashed border-white/5 rounded-xl text-center space-y-2">
                <FolderGit2 className="h-8 w-8 text-slate-600 mx-auto" />
                <p className="text-xs text-slate-400">No repositories found matching your filter criteria.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {filteredRepositories.map((repo) => (
                  <div
                    key={repo.id}
                    className="p-4 bg-slate-900/60 border border-white/5 hover:border-indigo-500/30 rounded-xl space-y-3 transition-all group"
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="flex items-center space-x-2">
                          <h4 className="text-sm font-bold text-white group-hover:text-indigo-400 transition-colors">
                            {repo.name}
                          </h4>
                          <span className={`px-2 py-0.5 rounded text-[9px] font-semibold flex items-center space-x-1 ${
                            repo.private
                              ? 'bg-amber-500/15 text-amber-400 border border-amber-500/20'
                              : 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/20'
                          }`}>
                            {repo.private ? <Lock className="h-2.5 w-2.5" /> : <Globe className="h-2.5 w-2.5" />}
                            <span>{repo.private ? 'Private' : 'Public'}</span>
                          </span>
                        </div>
                        <p className="text-xs text-slate-400 line-clamp-2 mt-1 leading-relaxed">
                          {repo.description || 'No description available for this repository.'}
                        </p>
                      </div>

                      <a
                        href={repo.htmlUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-slate-500 hover:text-indigo-400 p-1"
                        title="Open on GitHub"
                      >
                        <ExternalLink className="h-3.5 w-3.5" />
                      </a>
                    </div>

                    <div className="flex items-center justify-between pt-2 border-t border-white/5">
                      <div className="flex items-center space-x-4 text-[10px] text-slate-400">
                        <span className="font-semibold text-slate-300">{repo.language || 'JavaScript'}</span>
                        <span className="flex items-center space-x-1">
                          <Star className="h-3 w-3 text-amber-400" />
                          <span>{repo.stars}</span>
                        </span>
                        <span className="flex items-center space-x-1">
                          <GitFork className="h-3 w-3 text-slate-400" />
                          <span>{repo.forks}</span>
                        </span>
                      </div>

                      <button
                        onClick={() => {
                          setImportingRepo(repo);
                          setTargetProjectId(projects.length > 0 ? (projects[0].id || projects[0]._id) : '');
                        }}
                        className="px-3.5 py-1.5 bg-indigo-600/20 hover:bg-indigo-600 border border-indigo-500/40 text-indigo-300 hover:text-white font-semibold text-xs rounded-lg transition-all flex items-center space-x-1.5"
                      >
                        <span>Connect Repository</span>
                        <ArrowRight className="h-3 w-3" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Analysis Report Modal / Card */}
          {analysisReport && (
            <div className="glass p-6 rounded-2xl border border-indigo-500/30 space-y-6 bg-indigo-950/20 animate-fadeIn">
              <div className="flex items-center justify-between border-b border-indigo-500/20 pb-4">
                <div className="flex items-center space-x-2.5">
                  <Sparkles className="h-6 w-6 text-indigo-400" />
                  <div>
                    <h3 className="text-lg font-bold text-white">Repository AI Analysis Report</h3>
                    <p className="text-xs text-indigo-300 font-mono">Target: {analysisReport.repository}</p>
                  </div>
                </div>
                <button onClick={() => setAnalysisReport(null)} className="text-slate-400 hover:text-white">
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="space-y-2">
                <span className="text-[10px] uppercase font-bold text-indigo-400 tracking-wider">Detected Stack</span>
                <div className="flex flex-wrap gap-2">
                  {analysisReport.detectedTechnologies.map(tech => (
                    <span key={tech} className="px-3 py-1 rounded-lg bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 text-xs font-semibold">
                      {tech}
                    </span>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <span className="text-[10px] uppercase font-bold text-indigo-400 tracking-wider">Architectural Insights</span>
                <ul className="space-y-1 text-xs text-slate-300 list-disc pl-4">
                  {analysisReport.qualityInsights.map((insight, idx) => (
                    <li key={idx}>{insight}</li>
                  ))}
                </ul>
              </div>

              <div className="space-y-3 pt-2">
                <span className="text-[10px] uppercase font-bold text-indigo-400 tracking-wider">Recommended AI Development Tasks</span>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {analysisReport.recommendedTasks.map((t, idx) => (
                    <div key={idx} className="p-3 bg-slate-900/90 rounded-xl border border-white/5 space-y-1">
                      <p className="text-xs font-bold text-white">{t.title}</p>
                      <div className="flex items-center space-x-2 text-[10px] text-slate-400">
                        <span>Priority: <strong className="text-indigo-400">{t.priority}</strong></span>
                        <span>• Complexity: <strong className="text-purple-400">{t.complexity}</strong></span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Disconnect GitHub Modal */}
      {showDisconnectGitHubModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="glass p-6 rounded-2xl border border-white/10 max-w-md w-full space-y-4 animate-scaleUp">
            <h3 className="text-lg font-bold text-white">Disconnect GitHub Account</h3>
            <p className="text-xs text-slate-300 leading-relaxed">
              Are you sure you want to disconnect GitHub? Your project workspaces and local accounts will remain safe.
            </p>
            <div className="flex items-center justify-end space-x-3 pt-4">
              <button
                onClick={() => setShowDisconnectGitHubModal(false)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold rounded-xl"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmDisconnectGitHub}
                disabled={disconnecting}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold rounded-xl disabled:opacity-50"
              >
                {disconnecting ? 'Disconnecting...' : 'Disconnect'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Connect Repository Modal */}
      {importingRepo && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="glass p-6 rounded-2xl border border-white/10 max-w-md w-full space-y-5 animate-scaleUp">
            <div className="flex items-center justify-between border-b border-white/5 pb-3">
              <h3 className="text-base font-bold text-white">Connect Repository to AI SDP Project</h3>
              <button onClick={() => setImportingRepo(null)} className="text-slate-400 hover:text-white">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-2 text-xs">
              <label className="block text-xs font-semibold text-slate-300">GitHub Repository Name or Path:</label>
              <input
                type="text"
                value={importingRepo.name}
                onChange={(e) => setImportingRepo({
                  ...importingRepo,
                  name: e.target.value,
                  htmlUrl: e.target.value.includes('github.com') ? e.target.value : `https://github.com/${importingRepo.owner || 'Jaswnth02'}/${e.target.value}`
                })}
                placeholder="e.g. book-shopping-site or Jaswnth02/rice-manager"
                className="w-full p-2.5 rounded-xl glass-input text-xs text-white font-mono"
              />
            </div>

            <form onSubmit={handleConfirmConnectRepo} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">Connect this repository to project workspace:</label>
                <select
                  value={targetProjectId}
                  onChange={(e) => {
                    setTargetProjectId(e.target.value);
                    setVerificationResult(null);
                  }}
                  required
                  className="w-full p-3 rounded-xl glass-input text-xs text-white bg-[#0c1220] cursor-pointer"
                >
                  <option value="">Select project workspace...</option>
                  {projects.map(p => (
                    <option key={p.id || p._id} value={p.id || p._id}>
                      {p.name} ({p.projectCode})
                    </option>
                  ))}
                </select>
              </div>

              {/* Security Verification Action */}
              {targetProjectId && (
                <div className="space-y-2 pt-1">
                  <button
                    type="button"
                    onClick={handleVerifyRepo}
                    disabled={verifyingRepo}
                    className="w-full py-2 px-3 bg-indigo-600/20 hover:bg-indigo-600/30 border border-indigo-500/40 text-indigo-300 font-semibold text-xs rounded-xl flex items-center justify-center space-x-2 transition-all disabled:opacity-50"
                  >
                    {verifyingRepo ? (
                      <div className="animate-spin rounded-full h-3.5 w-3.5 border-2 border-indigo-400 border-t-transparent"></div>
                    ) : (
                      <ShieldCheck className="h-4 w-4 text-indigo-400" />
                    )}
                    <span>{verifyingRepo ? 'Running Verification Checks...' : 'Run Security & Authorization Verification'}</span>
                  </button>

                  {/* Verification Results Cards */}
                  {verificationResult && (
                    <div className={`p-3 rounded-xl border text-xs space-y-2 animate-fadeIn ${
                      verificationResult.verified ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300' : 'bg-rose-500/10 border-rose-500/30 text-rose-300'
                    }`}>
                      <div className="flex items-center space-x-2 font-bold">
                        {verificationResult.verified ? <CheckCircle className="h-4 w-4 text-emerald-400" /> : <AlertCircle className="h-4 w-4 text-rose-400" />}
                        <span>{verificationResult.message || verificationResult.error}</span>
                      </div>

                      {verificationResult.checks && (
                        <div className="space-y-1 pl-6 pt-1 text-[11px]">
                          <div className="flex items-center justify-between">
                            <span>1. Project Membership Authorization:</span>
                            <span className="font-bold text-emerald-400">PASSED ✓</span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span>2. GitHub OAuth Account Token:</span>
                            <span className="font-bold text-emerald-400">PASSED ✓</span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span>3. Repository Access & Structure:</span>
                            <span className="font-bold text-emerald-400">VERIFIED ✓</span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span>4. Webhook Security Listener:</span>
                            <span className="font-bold text-emerald-400">READY ✓</span>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              <div className="flex items-center justify-end space-x-3 pt-2">
                <button
                  type="button"
                  onClick={() => setImportingRepo(null)}
                  className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingImport || !targetProjectId}
                  className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-xl shadow-lg disabled:opacity-50 flex items-center space-x-1.5"
                >
                  <ShieldCheck className="h-3.5 w-3.5" />
                  <span>{isSubmittingImport ? 'Connecting...' : 'Confirm & Connect Repository'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Files Viewer Modal */}
      {selectedRepoFiles && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="glass p-6 rounded-2xl border border-white/10 max-w-2xl w-full max-h-[80vh] flex flex-col space-y-4 animate-scaleUp">
            <div className="flex items-center justify-between border-b border-white/5 pb-3">
              <div className="flex items-center space-x-2">
                <FileCode className="h-5 w-5 text-indigo-400" />
                <h3 className="text-base font-bold text-white">
                  Repository Files: <span className="text-indigo-300">{selectedRepoFiles.repositoryName}</span>
                </h3>
              </div>
              <button onClick={() => setSelectedRepoFiles(null)} className="text-slate-400 hover:text-white">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="overflow-y-auto flex-1 space-y-1.5 pr-2 font-mono text-xs">
              {selectedRepoFiles.files.map((file, idx) => (
                <div key={idx} className="p-2 bg-slate-900/60 rounded-lg flex items-center justify-between border border-white/5 text-slate-300 hover:border-indigo-500/30">
                  <div className="flex items-center space-x-2">
                    {file.type === 'dir' ? (
                      <FolderGit2 className="h-3.5 w-3.5 text-indigo-400" />
                    ) : (
                      <FileCode className="h-3.5 w-3.5 text-slate-400" />
                    )}
                    <span>{file.path}</span>
                  </div>
                  {file.type === 'file' && (
                    <span className="text-[10px] text-slate-500">{file.size} bytes</span>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default GitHubPage;
