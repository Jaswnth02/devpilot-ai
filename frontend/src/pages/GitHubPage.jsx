import React, { useState, useEffect, useContext } from 'react';
import api from '../utils/api';
import { AuthContext } from '../context/AuthContext';
import { Github, Link as LinkIcon, RefreshCw, FileCode2, GitPullRequest, AlertCircle, CheckCircle } from 'lucide-react';

const GitHubPage = () => {
  const { user } = useContext(AuthContext);
  const [isConnected, setIsConnected] = useState(false);
  const [githubUser, setGithubUser] = useState('');
  const [projects, setProjects] = useState([]);
  const [repos, setRepos] = useState([]);
  
  // Link form state
  const [selectedProjectId, setSelectedProjectId] = useState('');
  const [selectedRepo, setSelectedRepo] = useState('');
  
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [message, setMessage] = useState(null);

  const fetchGitHubStatus = async () => {
    try {
      const [projRes, reposRes] = await Promise.all([
        api.get('/api/projects'),
        api.get('/api/github/repos').catch(() => ({ data: null }))
      ]);

      setProjects(projRes.data);

      if (reposRes.data) {
        setIsConnected(true);
        setRepos(reposRes.data);
        // Find if user has a linked account name
        const accountRes = await api.get('/api/auth/me');
        if (accountRes.data.GitHubAccount) {
          setGithubUser(accountRes.data.GitHubAccount.github_username);
        }
      } else {
        setIsConnected(false);
      }
    } catch (err) {
      console.error('Failed to load GitHub credentials:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchGitHubStatus();
  }, []);

  const handleConnect = async () => {
    try {
      const res = await api.get('/api/github/auth');
      // Redirect to GitHub OAuth page
      window.location.href = res.data.url;
    } catch (err) {
      console.error('GitHub authentication failed:', err);
    }
  };

  const handleLinkRepo = async (e) => {
    e.preventDefault();
    if (!selectedProjectId || !selectedRepo) return;

    const [owner, repoName] = selectedRepo.split('/');
    try {
      await api.post('/api/github/link', {
        projectId: selectedProjectId,
        owner,
        repoName
      });
      setMessage({ type: 'success', text: `Repository ${selectedRepo} linked successfully!` });
      fetchGitHubStatus();
    } catch (err) {
      setMessage({ type: 'error', text: err.response?.data?.error || 'Failed to link repository.' });
    }
  };

  const handleSyncData = async (projectId) => {
    setSyncing(true);
    try {
      await api.post('/api/github/sync', { projectId });
      setMessage({ type: 'success', text: 'GitHub data synchronized successfully!' });
      fetchGitHubStatus();
    } catch (err) {
      setMessage({ type: 'error', text: err.response?.data?.error || 'Failed to sync data.' });
    } finally {
      setSyncing(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[calc(100vh-200px)]">
        <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-indigo-500"></div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-extrabold text-white">GitHub Integration</h1>
        <p className="text-slate-400 text-sm mt-1">Connect repositories, monitor commits, and map activities to project deliverables</p>
      </div>

      {message && (
        <div className={`p-4 rounded-xl flex items-center space-x-2 text-sm ${
          message.type === 'success' ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-300' : 'bg-rose-500/10 border border-rose-500/30 text-rose-300'
        }`}>
          {message.type === 'success' ? <CheckCircle className="h-4.5 w-4.5" /> : <AlertCircle className="h-4.5 w-4.5" />}
          <span>{message.text}</span>
        </div>
      )}

      {!isConnected ? (
        /* Connected check placeholder */
        <div className="glass p-12 rounded-2xl border border-white/5 max-w-xl mx-auto text-center space-y-6">
          <div className="mx-auto bg-slate-900 p-4 rounded-full w-fit text-slate-300 border border-white/5">
            <Github className="h-10 w-10" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-slate-200">Connect GitHub Account</h3>
            <p className="text-xs text-slate-400 mt-2 max-w-sm mx-auto leading-relaxed">
              Link your developer workspace profile using GitHub OAuth to link repositories, pull requests, and commit tracks.
            </p>
          </div>
          <button
            onClick={handleConnect}
            className="px-6 py-3.5 bg-white text-slate-950 font-bold rounded-xl text-xs flex items-center justify-center space-x-2 mx-auto hover:bg-slate-100 transition-colors shadow-lg shadow-white/5 active:scale-[0.98]"
          >
            <Github className="h-4.5 w-4.5" />
            <span>Authorize via GitHub</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Link Repository Form */}
          {user.role !== 'Developer' && (
            <div className="glass p-6 rounded-2xl border border-white/5 h-fit space-y-4">
              <div className="flex items-center space-x-2 text-slate-200">
                <LinkIcon className="h-5 w-5 text-indigo-400" />
                <h3 className="text-base font-bold">Link Repo to Workspace</h3>
              </div>

              <form onSubmit={handleLinkRepo} className="space-y-4">
                <div>
                  <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1">Target Project</label>
                  <select
                    value={selectedProjectId}
                    onChange={(e) => setSelectedProjectId(e.target.value)}
                    required
                    className="w-full p-2.5 rounded-xl glass-input text-xs"
                  >
                    <option value="">Select project workspace...</option>
                    {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1">GitHub Repository</label>
                  <select
                    value={selectedRepo}
                    onChange={(e) => setSelectedRepo(e.target.value)}
                    required
                    className="w-full p-2.5 rounded-xl glass-input text-xs"
                  >
                    <option value="">Select repository...</option>
                    {repos.map((r, idx) => (
                      <option key={idx} value={`${r.owner.login}/${r.name}`}>
                        {r.owner.login}/{r.name}
                      </option>
                    ))}
                  </select>
                </div>

                <button
                  type="submit"
                  className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs rounded-xl shadow-md transition-colors"
                >
                  Link Repository
                </button>
              </form>
            </div>
          )}

          {/* Linked repositories lists */}
          <div className="lg:col-span-2 space-y-6">
            <h3 className="text-lg font-bold text-slate-200">Connected Repositories</h3>
            
            {projects.filter(p => p.GitHubRepository).length === 0 ? (
              <div className="p-10 border border-dashed border-white/5 rounded-xl text-center text-xs text-slate-500">
                No active projects linked to codebases yet. Use the Link Form to connect repos.
              </div>
            ) : (
              <div className="space-y-4">
                {projects.filter(p => p.GitHubRepository).map(p => (
                  <div key={p.id} className="glass p-5 rounded-2xl border border-white/5 space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="text-sm font-bold text-slate-200">{p.name}</h4>
                        <span className="text-[10px] text-indigo-400 font-semibold block mt-0.5">
                          Linked: {p.GitHubRepository.owner}/{p.GitHubRepository.repo_name}
                        </span>
                      </div>

                      <button
                        onClick={() => handleSyncData(p.id)}
                        disabled={syncing}
                        className="px-3 py-1.5 bg-white/5 hover:bg-white/10 text-slate-300 text-xs font-semibold rounded-lg flex items-center space-x-1.5 transition-colors border border-white/5"
                      >
                        <RefreshCw className={`h-3.5 w-3.5 ${syncing ? 'animate-spin' : ''}`} />
                        <span>Sync</span>
                      </button>
                    </div>

                    {/* Mock/Recent commits stream */}
                    <div className="border-t border-white/5 pt-4 space-y-3">
                      <span className="text-[10px] uppercase font-bold text-slate-500 pl-1">Recent Commits Cache</span>
                      
                      <div className="space-y-2">
                        <div className="p-3 bg-slate-900/60 border border-white/5 rounded-xl flex items-start space-x-2.5">
                          <FileCode2 className="h-4 w-4 text-indigo-400 shrink-0 mt-0.5" />
                          <div>
                            <p className="text-xs text-slate-200 font-medium">Added Book Database Schema</p>
                            <span className="text-[9px] text-slate-500 block mt-0.5">sha: a57f920b • mockdeveloper • 2 days ago</span>
                          </div>
                        </div>
                        
                        <div className="p-3 bg-slate-900/60 border border-white/5 rounded-xl flex items-start space-x-2.5">
                          <FileCode2 className="h-4 w-4 text-indigo-400 shrink-0 mt-0.5" />
                          <div>
                            <p className="text-xs text-slate-200 font-medium">Updated Book Listing UI</p>
                            <span className="text-[9px] text-slate-500 block mt-0.5">sha: b12e345f • mockdeveloper • 5 hours ago</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default GitHubPage;
