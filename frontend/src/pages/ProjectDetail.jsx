import React, { useState, useEffect, useContext } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../utils/api';
import { AuthContext } from '../context/AuthContext';
import { SocketContext } from '../context/SocketContext';
import { 
  Plus, Users, AlertTriangle, ShieldCheck, Cpu, 
  MessageSquare, Bug, CheckCircle, FileCode2, GitPullRequest, ArrowRightLeft, ArrowRight, Info, X, Clock, HelpCircle,
  FileText, FileArchive, Image, File, Download, Trash2, Upload, KeyRound, Copy, Check, UserCheck, UserX, Lock, Sparkles, Radio,
  Github, ExternalLink, RefreshCw, Globe, FolderGit2, Star, GitFork, GitCommit, GitBranch, Search, Activity, ShieldAlert, Layers
} from 'lucide-react';

const ProjectDetail = () => {
  const { id } = useParams();
  const { user } = useContext(AuthContext);
  const { socket, joinProjectRoom, latestActivity } = useContext(SocketContext) || {};
  const navigate = useNavigate();
  
  const [project, setProject] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedTask, setSelectedTask] = useState(null);
  const [copiedCode, setCopiedCode] = useState(false);
  
  // Modals state
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [recommendations, setRecommendations] = useState([]);
  const [recLoading, setRecLoading] = useState(false);

  // New task form state
  const [showAddTaskModal, setShowAddTaskModal] = useState(false);
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskDesc, setNewTaskDesc] = useState('');
  const [newTaskModule, setNewTaskModule] = useState('');
  const [newTaskSkills, setNewTaskSkills] = useState('');
  const [newTaskPriority, setNewTaskPriority] = useState('Medium');
  const [newTaskComplexity, setNewTaskComplexity] = useState('Medium');
  const [newTaskDeadline, setNewTaskDeadline] = useState('');

  // Task Details Modal state
  const [modalComments, setModalComments] = useState([]);
  const [newComment, setNewComment] = useState('');
  const [modalIssues, setModalIssues] = useState([]);
  const [newIssueDesc, setNewIssueDesc] = useState('');
  const [taskError, setTaskError] = useState(null);

  // Project Tabs
  const [activeTab, setActiveTab] = useState('board'); // 'board' | 'team' | 'files' | 'github'
  const [files, setFiles] = useState([]);
  const [fileUploading, setFileUploading] = useState(false);
  const [fileError, setFileError] = useState(null);

  // Pending requests and members state
  const [pendingRequests, setPendingRequests] = useState([]);
  const [actionLoading, setActionLoading] = useState(null);
  const [teamNotice, setTeamNotice] = useState(null);

  // GitHub connection & workflow states
  const [githubStatus, setGithubStatus] = useState({ connected: false, username: '', avatar: '', profileUrl: '' });
  const [loadingGithubStatus, setLoadingGithubStatus] = useState(true);
  const [connectWorkflowStep, setConnectWorkflowStep] = useState('choice'); // 'intro' | 'choice' | 'create_repo' | 'import_repo'
  const [isConnectingOAuth, setIsConnectingOAuth] = useState(false);

  // Option A (Create New Repository) form state
  const [createRepoName, setCreateRepoName] = useState('');
  const [createRepoDesc, setCreateRepoDesc] = useState('');
  const [createRepoVisibility, setCreateRepoVisibility] = useState('public');
  const [isCreatingRepo, setIsCreatingRepo] = useState(false);

  // Option B (Import Existing Repository) state
  const [availableRepos, setAvailableRepos] = useState([]);
  const [loadingRepos, setLoadingRepos] = useState(false);
  const [selectedImportRepo, setSelectedImportRepo] = useState(null);
  const [repoSearchQuery, setRepoSearchQuery] = useState('');
  const [repoVisibilityFilter, setRepoVisibilityFilter] = useState('all');
  const [isImportingRepo, setIsImportingRepo] = useState(false);

  // Disconnect & Sync states
  const [showDisconnectConfirmModal, setShowDisconnectConfirmModal] = useState(false);
  const [disconnectingRepo, setDisconnectingRepo] = useState(false);
  const [syncingRepo, setSyncingRepo] = useState(false);

  // Format relative time helper
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

  // Fetch GitHub Connection Status for authenticated user
  const fetchGithubStatus = async () => {
    setLoadingGithubStatus(true);
    try {
      const res = await api.get('/api/github/status');
      const statusData = res.data || { connected: false };
      setGithubStatus(statusData);
      return statusData;
    } catch (err) {
      setGithubStatus({ connected: false });
      return { connected: false };
    } finally {
      setLoadingGithubStatus(false);
    }
  };

  // Check URL parameters on mount
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('tab') === 'github') {
      setActiveTab('github');
    }
    if (params.get('github_connected') === 'true') {
      setActiveTab('github');
      setConnectWorkflowStep('intro');
      setTeamNotice({
        type: 'success',
        message: `GitHub account connected successfully! Welcome @${params.get('username') || ''}`
      });
      window.history.replaceState({}, document.title, window.location.pathname + '?tab=github');
    }
    fetchGithubStatus();
  }, [id]);

  // Join Socket Room for Real-Time Project Events
  useEffect(() => {
    if (id && joinProjectRoom) {
      joinProjectRoom(id);
    }
  }, [id, joinProjectRoom]);

  // Real-Time Socket Event Listeners for Live Webhook Updates
  useEffect(() => {
    if (!socket) return;

    const handleProjectUpdate = (data) => {
      if (data.projectId === id || data.project?._id === id || data.project?.id === id) {
        if (data.disconnected) {
          setProject(prev => prev ? {
            ...prev,
            githubIntegration: { connected: false },
            githubRepository: { githubRepositoryId: null }
          } : prev);
          setTeamNotice({ type: 'info', message: data.message || 'GitHub repository disconnected.' });
        } else {
          if (data.project) {
            setProject(data.project);
          } else if (data.githubIntegration) {
            setProject(prev => prev ? {
              ...prev,
              githubIntegration: data.githubIntegration,
              githubRepository: data.githubRepository || prev.githubRepository
            } : prev);
          }
          if (data.message) {
            setTeamNotice({ type: 'success', message: data.message });
          }
        }
      }
    };

    const handleActivity = (activity) => {
      if (activity.projectId === id) {
        setTeamNotice({
          type: 'success',
          message: activity.message ? `GitHub: ${activity.message}` : `New commit pushed by @${activity.author_username || 'developer'}`
        });
        fetchProject();
      }
    };

    socket.on('github_project_update', handleProjectUpdate);
    socket.on('github_activity', handleActivity);

    return () => {
      socket.off('github_project_update', handleProjectUpdate);
      socket.off('github_activity', handleActivity);
    };
  }, [socket, id]);

  // Redirect to official GitHub OAuth authorization
  const handleInitiateOAuth = async () => {
    setIsConnectingOAuth(true);
    try {
      const res = await api.get(`/api/github/auth?projectId=${id}`);
      if (res.data?.url) {
        window.location.href = res.data.url;
      } else {
        const token = localStorage.getItem('token');
        window.location.href = `${api.defaults.baseURL || ''}/api/github/connect?projectId=${id}${token ? `&token=${encodeURIComponent(token)}` : ''}`;
      }
    } catch (err) {
      console.error('Failed to initiate GitHub OAuth:', err);
      const errMsg = err.response?.data?.error || 'GitHub OAuth credentials (GITHUB_CLIENT_ID) are missing or misconfigured in server environment.';
      setTeamNotice({ type: 'error', message: errMsg });
      setIsConnectingOAuth(false);
    }
  };

  // Fetch repositories from user's GitHub account with search and filters
  const fetchAvailableRepos = async (search = '', visibility = 'all') => {
    setLoadingRepos(true);
    try {
      const res = await api.get(`/api/github/repos?search=${encodeURIComponent(search)}&visibility=${visibility}`);
      setAvailableRepos(res.data?.repositories || []);
    } catch (err) {
      console.error('Failed to load GitHub repositories:', err);
      setAvailableRepos([]);
    } finally {
      setLoadingRepos(false);
    }
  };

  // Option A: Create New Repository on GitHub & Auto-Connect
  const handleCreateNewRepo = async (e) => {
    if (e) e.preventDefault();
    if (!createRepoName || !createRepoName.trim()) {
      setTeamNotice({ type: 'error', message: 'Please enter a repository name.' });
      return;
    }

    setIsCreatingRepo(true);
    try {
      const res = await api.post('/api/github/repos/create', {
        projectId: project.id || project._id,
        name: createRepoName.trim(),
        description: createRepoDesc ? createRepoDesc.trim() : (project.description || ''),
        visibility: createRepoVisibility
      });

      if (res.data?.success) {
        setTeamNotice({
          type: 'success',
          message: `✓ Repository created & connected: ${res.data.githubIntegration?.repositoryFullName || res.data.repository?.full_name} (Webhook Active ✓)`
        });
        await fetchProject();
        setConnectWorkflowStep('choice');
      }
    } catch (err) {
      console.error('Create repo error:', err);
      setTeamNotice({
        type: 'error',
        message: err.response?.data?.error || 'Failed to create GitHub repository.'
      });
    } finally {
      setIsCreatingRepo(false);
    }
  };

  // Option B: Import & Connect Existing Verified Repository
  const handleImportSelectedRepo = async () => {
    if (!selectedImportRepo) {
      setTeamNotice({ type: 'error', message: 'Please select a repository to connect.' });
      return;
    }

    setIsImportingRepo(true);
    try {
      const res = await api.post(`/api/github/repos/${selectedImportRepo.id}/connect`, {
        projectId: project.id || project._id,
        repositoryName: selectedImportRepo.name,
        repositoryOwner: selectedImportRepo.owner
      });

      if (res.data?.success) {
        setTeamNotice({
          type: 'success',
          message: `✓ Repository access verified & connected: ${selectedImportRepo.full_name} (Webhook Active ✓)`
        });
        await fetchProject();
        setSelectedImportRepo(null);
        setConnectWorkflowStep('choice');
      }
    } catch (err) {
      console.error('Import repo error:', err);
      setTeamNotice({
        type: 'error',
        message: err.response?.data?.error || 'Failed to connect repository to project.'
      });
    } finally {
      setIsImportingRepo(false);
    }
  };

  // Disconnect Repository
  const handleDisconnectRepo = async () => {
    setDisconnectingRepo(true);
    try {
      const targetRepoId = project.githubIntegration?.repositoryId || project.githubRepository?.githubRepositoryId || project.id || project._id;
      await api.delete(`/api/github/repos/${targetRepoId}/disconnect?projectId=${project.id || project._id}`);
      setShowDisconnectConfirmModal(false);
      await fetchProject();
      setTeamNotice({ type: 'success', message: 'GitHub repository disconnected successfully.' });
      setConnectWorkflowStep('choice');
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to disconnect repository.');
    } finally {
      setDisconnectingRepo(false);
    }
  };

  // On-Demand Refresh / Sync Repository
  const handleSyncProjectRepo = async () => {
    setSyncingRepo(true);
    try {
      const targetRepoId = project.githubIntegration?.repositoryId || project.githubRepository?.githubRepositoryId || 'sync';
      await api.post(`/api/github/repos/${targetRepoId}/sync`, { projectId: project.id || project._id });
      await fetchProject();
      setTeamNotice({ type: 'success', message: 'Repository synchronized successfully with GitHub!' });
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to sync repository with GitHub.');
    } finally {
      setSyncingRepo(false);
    }
  };

  const handleOpenConnectRepoModal = () => {
    setActiveTab('github');
    setConnectWorkflowStep('choice');
  };

  // Fetch project details
  const fetchProject = async () => {
    try {
      const res = await api.get(`/api/projects/${id}`);
      setProject(res.data);
      if (res.data.pendingRequests) {
        setPendingRequests(res.data.pendingRequests);
      }
    } catch (err) {
      console.error('Failed to load project:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchFiles = async () => {
    try {
      const res = await api.get(`/api/projects/${id}/files`);
      setFiles(res.data);
    } catch (err) {
      console.error('Failed to load project files:', err);
    }
  };

  useEffect(() => {
    fetchProject();
    fetchFiles();
    joinProjectRoom(id);
  }, [id]);

  // Handle Socket activity updates in real-time
  useEffect(() => {
    if (latestActivity) {
      fetchProject();
      fetchFiles();
    }
  }, [latestActivity]);

  // Listen for file socket events
  useEffect(() => {
    if (!socket) return;

    socket.on('file_uploaded', (newFile) => {
      setFiles(prev => {
        if (prev.some(f => f.id === newFile.id)) return prev;
        return [newFile, ...prev];
      });
    });

    socket.on('file_deleted', ({ fileId }) => {
      setFiles(prev => prev.filter(f => f.id !== parseInt(fileId)));
    });

    // Real-time WebSockets listener for incoming Project Join Requests
    socket.on('join_request_created', (data) => {
      if (data.projectId === id) {
        setPendingRequests(prev => {
          if (prev.some(r => r.id === data.id || r.requestId === data.requestId)) return prev;
          return [data, ...prev];
        });
        setTeamNotice({
          type: 'success',
          message: `🔔 Live: ${data.user?.fullName || data.user?.name || 'A user'} just entered Project Code ${data.projectCode}!`
        });
      }
    });

    socket.on('join_request_updated', (data) => {
      if (data.projectId === id) {
        fetchProject();
      }
    });

    socket.on('member_removed', (data) => {
      if (data.projectId === id) {
        fetchProject();
      }
    });

    return () => {
      socket.off('file_uploaded');
      socket.off('file_deleted');
      socket.off('join_request_created');
      socket.off('join_request_updated');
      socket.off('member_removed');
    };
  }, [socket, id]);

  const handleCopyCode = () => {
    if (!project?.projectCode) return;
    navigator.clipboard.writeText(project.projectCode);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  // Owner Approve/Reject Join Request
  const handleRespondRequest = async (requestId, action) => {
    setActionLoading(requestId);
    setTeamNotice(null);
    try {
      const res = await api.post(`/api/projects/${id}/join-requests/${requestId}/respond`, { action });
      setTeamNotice({ type: 'success', message: res.data.message });
      fetchProject();
    } catch (err) {
      setTeamNotice({ type: 'error', message: err.response?.data?.error || 'Failed to process request.' });
    } finally {
      setActionLoading(null);
    }
  };

  // Owner Remove Member
  const handleRemoveMember = async (targetUserId) => {
    if (!window.confirm('Are you sure you want to remove this member from the project team?')) return;
    setActionLoading(targetUserId);
    setTeamNotice(null);
    try {
      const res = await api.delete(`/api/projects/${id}/members/${targetUserId}`);
      setTeamNotice({ type: 'success', message: res.data.message || 'Member removed.' });
      fetchProject();
    } catch (err) {
      setTeamNotice({ type: 'error', message: err.response?.data?.error || 'Failed to remove member.' });
    } finally {
      setActionLoading(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[calc(100vh-200px)]">
        <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-indigo-500"></div>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="text-center py-10">
        <h3 className="text-lg font-bold text-slate-200">Project Workspace not found</h3>
      </div>
    );
  }

  const userIdStr = user?._id || user?.id || '';
  const ownerIdStr = project.ownerId?._id || project.ownerId?.id || project.ownerId || '';
  const isOwner = project.isOwner || (userIdStr && ownerIdStr && userIdStr.toString() === ownerIdStr.toString());

  const tasks = project.Tasks || [];
  const members = project.members || [];
  const columns = ['To Do', 'In Progress', 'In Review', 'Completed', 'Blocked'];

  // Handle task selection and loading details
  const handleTaskClick = async (task) => {
    setTaskError(null);
    setSelectedTask(task);
    const targetTaskId = task.id || task._id;
    
    try {
      const [commentsRes, issuesRes] = await Promise.all([
        api.get(`/api/tasks/${targetTaskId}/comments`),
        api.get(`/api/tasks/${targetTaskId}/issues`)
      ]);
      setModalComments(commentsRes.data || []);
      setModalIssues(issuesRes.data || []);
    } catch (err) {
      console.error('Failed to load comments/issues:', err);
    }
  };

  const handleAssigneeChange = async (taskId, userId) => {
    const targetTaskId = taskId || selectedTask?.id || selectedTask?._id;
    if (!targetTaskId) return;

    try {
      setTaskError(null);
      const res = await api.put(`/api/tasks/${targetTaskId}`, {
        assigned_user_id: userId || null
      });
      setSelectedTask(res.data);
      fetchProject();
    } catch (err) {
      const errorMsg = err.response?.data?.error || 'Failed to assign task.';
      setTaskError(errorMsg);
    }
  };

  const handleStatusChange = async (taskId, newStatus) => {
    const targetTaskId = taskId || selectedTask?.id || selectedTask?._id;
    if (!targetTaskId) return;

    try {
      setTaskError(null);
      const res = await api.put(`/api/tasks/${targetTaskId}`, {
        status: newStatus
      });
      setSelectedTask(res.data);
      fetchProject();
    } catch (err) {
      const errorMsg = err.response?.data?.error || 'Failed to update task status.';
      setTaskError(errorMsg);
    }
  };

  const handleAddComment = async (e) => {
    e.preventDefault();
    if (!newComment.trim()) return;
    const targetTaskId = selectedTask?.id || selectedTask?._id;
    if (!targetTaskId) return;

    try {
      const res = await api.post(`/api/tasks/${targetTaskId}/comments`, {
        content: newComment
      });
      setModalComments(prev => [...prev, res.data]);
      setNewComment('');
    } catch (err) {
      console.error('Add comment error:', err);
    }
  };

  const handleReportIssue = async (e) => {
    e.preventDefault();
    if (!newIssueDesc.trim()) return;
    const targetTaskId = selectedTask?.id || selectedTask?._id;
    if (!targetTaskId) return;

    try {
      const res = await api.post(`/api/tasks/${targetTaskId}/issues`, {
        description: newIssueDesc
      });
      setModalIssues(prev => [res.data, ...prev]);
      setNewIssueDesc('');
      handleStatusChange(targetTaskId, 'Blocked');
    } catch (err) {
      console.error('Report issue error:', err);
    }
  };

  const handleAITriage = async (issueId) => {
    try {
      const updatedIssues = modalIssues.map(iss => 
        (iss.id === issueId || iss._id === issueId) ? { ...iss, ai_category: 'Analyzing...' } : iss
      );
      setModalIssues(updatedIssues);

      const res = await api.post(`/api/ai/analyze-issue/${issueId}`);
      setModalIssues(prev => prev.map(iss => (iss.id === issueId || iss._id === issueId) ? res.data : iss));
    } catch (err) {
      console.error('AI Triage error:', err);
    }
  };

  const handleGetRecommendations = async () => {
    setRecLoading(true);
    setShowAssignModal(true);
    try {
      const res = await api.post('/api/ai/recommend-assignment', {
        projectId: project.id || project._id
      });
      setRecommendations(res.data);
    } catch (err) {
      console.error('Failed to get recommendations:', err);
      setRecommendations([]);
    } finally {
      setRecLoading(false);
    }
  };

  const handleApplyRecommendation = async (taskId, userId) => {
    try {
      await api.put(`/api/tasks/${taskId}`, {
        assigned_user_id: userId
      });
      setRecommendations(prev => prev.filter(r => r.taskId !== taskId));
      fetchProject();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to apply recommendation.');
    }
  };

  const handleAddTask = async (e) => {
    e.preventDefault();
    if (!newTaskTitle || !newTaskModule) return;
    try {
      const skillsArray = newTaskSkills.split(',').map(s => s.trim()).filter(s => s.length > 0);
      await api.post('/api/tasks', {
        title: newTaskTitle,
        description: newTaskDesc,
        module: newTaskModule,
        required_skills: skillsArray,
        priority: newTaskPriority,
        complexity: newTaskComplexity,
        deadline: newTaskDeadline || null,
        project_id: project.id || project._id
      });
      
      setShowAddTaskModal(false);
      setNewTaskTitle('');
      setNewTaskDesc('');
      setNewTaskModule('');
      setNewTaskSkills('');
      setNewTaskPriority('Medium');
      setNewTaskComplexity('Medium');
      setNewTaskDeadline('');
      
      fetchProject();
    } catch (err) {
      console.error(err);
    }
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (file.size > 20 * 1024 * 1024) {
      setFileError('File size exceeds the 20MB limit.');
      return;
    }

    const formData = new FormData();
    formData.append('file', file);

    setFileUploading(true);
    setFileError(null);

    try {
      const res = await api.post(`/api/projects/${id}/files`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });
      setFiles(prev => {
        if (prev.some(f => f.id === res.data.id)) return prev;
        return [res.data, ...prev];
      });
    } catch (err) {
      setFileError(err.response?.data?.error || 'Failed to upload file.');
    } finally {
      setFileUploading(false);
      e.target.value = '';
    }
  };

  const handleFileDownload = async (file) => {
    try {
      const response = await api.get(`/api/projects/files/download/${file.id}`, {
        responseType: 'blob'
      });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', file.original_name);
      document.body.appendChild(link);
      link.click();
      link.parentNode.removeChild(link);
    } catch (err) {
      alert('Failed to download file.');
    }
  };

  const handleFileDelete = async (fileId) => {
    if (!window.confirm('Are you sure you want to delete this file?')) return;
    try {
      await api.delete(`/api/projects/files/${fileId}`);
      setFiles(prev => prev.filter(f => f.id !== fileId));
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to delete file.');
    }
  };

  const handleGeneratePlanClick = () => {
    if (!isOwner) {
      alert('You do not have permission to generate the AI development plan. Only the project owner can generate the plan.');
      return;
    }
    navigate('/projects/new');
  };

  return (
    <div className="space-y-6">
      {/* Workspace Header */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
        <div>
          <div className="flex items-center space-x-3 flex-wrap gap-y-2">
            <span className="text-[10px] uppercase font-bold text-indigo-600 tracking-wider">Project Workspace</span>
            
            {/* Prominent Project Code Display */}
            {project.projectCode && (
              <div className="flex items-center space-x-2 bg-indigo-50 border border-indigo-200 px-3 py-1 rounded-xl">
                <KeyRound className="h-3.5 w-3.5 text-indigo-600" />
                <span className="text-xs text-slate-500">Project Code:</span>
                <strong className="text-xs font-mono font-bold text-indigo-700 tracking-wider">{project.projectCode}</strong>
                <button
                  type="button"
                  onClick={handleCopyCode}
                  title="Copy Project Code"
                  className="p-1 hover:bg-indigo-100 text-indigo-600 rounded-md transition-colors"
                >
                  {copiedCode ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
                </button>
              </div>
            )}
          </div>

          <h1 className="text-3xl font-extrabold text-slate-900 mt-2">{project.name}</h1>
          <p className="text-slate-500 text-xs mt-1.5 max-w-xl leading-relaxed">{project.description}</p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* AI Plan Button with Strict Owner Authorization */}
          {isOwner ? (
            <button
              onClick={handleGeneratePlanClick}
              className="px-4 py-2.5 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 font-semibold text-xs text-white rounded-xl shadow-md shadow-indigo-600/20 flex items-center space-x-2 transition-all active:scale-[0.98]"
            >
              <Cpu className="h-4 w-4" />
              <span>Generate AI Development Plan</span>
            </button>
          ) : (
            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 flex items-center space-x-2 text-slate-600 text-xs" title="Only project owner can generate plan">
              <Lock className="h-4 w-4 text-amber-500 shrink-0" />
              <span>Only the project owner can generate the development plan.</span>
            </div>
          )}

          <button
            onClick={handleGetRecommendations}
            className="px-4 py-2.5 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 text-indigo-700 text-xs font-semibold rounded-xl flex items-center space-x-2 transition-colors"
          >
            <Cpu className="h-4 w-4 text-indigo-600" />
            <span>Recommend Assignments</span>
          </button>

          <button
            onClick={() => setShowAddTaskModal(true)}
            className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-700 text-xs font-semibold rounded-xl flex items-center space-x-2 transition-colors"
          >
            <Plus className="h-4 w-4" />
            <span>Add Task</span>
          </button>
        </div>
      </div>

      {/* Connected GitHub Repository Card */}
      {((project.githubIntegration?.connected && project.githubIntegration?.repositoryId) || project.githubRepository?.githubRepositoryId) ? (
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex items-start space-x-3.5">
            <div className="p-3 bg-slate-900 text-white rounded-xl shadow-inner mt-0.5">
              <Github className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2 flex-wrap gap-y-1">
                <span className="text-xs font-semibold text-slate-500">Connected Repository:</span>
                <a
                  href={project.githubIntegration?.repositoryUrl || project.githubRepository?.htmlUrl || `https://github.com/${project.githubIntegration?.repositoryFullName || project.githubRepository?.fullName || project.githubRepository?.name}`}
                  target="_blank"
                  rel="noreferrer"
                  className="text-sm font-bold text-slate-900 hover:text-indigo-600 font-mono inline-flex items-center space-x-1"
                >
                  <span>{project.githubIntegration?.repositoryFullName || project.githubIntegration?.repositoryName || project.githubRepository?.fullName || project.githubRepository?.name}</span>
                  <ExternalLink className="h-3.5 w-3.5 text-slate-400" />
                </a>
                <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                  <CheckCircle className="h-3 w-3 text-emerald-600" />
                  <span>Connected</span>
                </span>
                {(project.githubIntegration?.defaultBranch || project.githubRepository?.defaultBranch) && (
                  <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-md text-[10px] font-mono bg-slate-100 text-slate-700 border border-slate-200">
                    <GitBranch className="h-3 w-3 text-slate-500" />
                    <span>{project.githubIntegration?.defaultBranch || project.githubRepository?.defaultBranch}</span>
                  </span>
                )}
              </div>

              {(project.githubIntegration?.latestCommit?.message || project.githubRepository?.lastCommit?.message) && (
                <p className="text-xs text-slate-600 mt-1.5 flex items-center space-x-1.5">
                  <span className="font-semibold text-slate-700">Latest Commit:</span>
                  <span className="text-slate-500 truncate max-w-md">"{project.githubIntegration?.latestCommit?.message || project.githubRepository?.lastCommit?.message}"</span>
                  {(project.githubIntegration?.latestCommit?.author || project.githubRepository?.lastCommit?.author) && (
                    <span className="text-[10px] text-slate-400">by @{project.githubIntegration?.latestCommit?.author || project.githubRepository?.lastCommit?.author}</span>
                  )}
                </p>
              )}
            </div>
          </div>

          <div className="flex items-center space-x-2 shrink-0">
            <button
              onClick={handleSyncProjectRepo}
              disabled={syncingRepo}
              className="px-3.5 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 text-xs font-semibold rounded-xl flex items-center space-x-1.5 transition-colors"
            >
              <RefreshCw className={`h-3.5 w-3.5 text-indigo-600 ${syncingRepo ? 'animate-spin' : ''}`} />
              <span>{syncingRepo ? 'Syncing...' : 'Sync Now'}</span>
            </button>

            {isOwner && (
              <>
                <button
                  onClick={handleOpenConnectRepoModal}
                  className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 text-xs font-semibold rounded-xl transition-colors"
                >
                  Change Repo
                </button>
                <button
                  onClick={handleDisconnectRepo}
                  disabled={disconnectingRepo}
                  className="px-3.5 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-semibold rounded-xl transition-colors"
                >
                  {disconnectingRepo ? 'Disconnecting...' : 'Disconnect'}
                </button>
              </>
            )}
          </div>
        </div>
      ) : (
        <div className="bg-white p-4 rounded-2xl border border-dashed border-slate-300 flex items-center justify-between gap-4">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 bg-slate-100 text-slate-700 rounded-xl">
              <Github className="h-5 w-5" />
            </div>
            <div>
              <h4 className="text-xs font-bold text-slate-900">No GitHub repository connected</h4>
              <p className="text-[11px] text-slate-500">Connect a GitHub repository to track commits, branches, and sync updates automatically.</p>
            </div>
          </div>

          {isOwner && (
            <button
              onClick={handleOpenConnectRepoModal}
              className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs rounded-xl shadow-xs flex items-center space-x-1.5 transition-all shrink-0"
            >
              <Github className="h-4 w-4" />
              <span>Connect GitHub Repository</span>
            </button>
          )}
        </div>
      )}

      {/* Tab Selector */}
      <div className="flex items-center space-x-6 border-b border-slate-200 pb-2">
        <button
          onClick={() => setActiveTab('board')}
          className={`pb-2 text-sm font-bold uppercase tracking-wider transition-all relative ${
            activeTab === 'board' 
              ? 'text-indigo-600 font-extrabold' 
              : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          Kanban Board
          {activeTab === 'board' && (
            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-indigo-600 rounded-full"></div>
          )}
        </button>

        <button
          onClick={() => setActiveTab('team')}
          className={`pb-2 text-sm font-bold uppercase tracking-wider transition-all relative flex items-center space-x-2 ${
            activeTab === 'team' 
              ? 'text-indigo-600 font-extrabold' 
              : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          <span>Allocate Team Members</span>
          {pendingRequests.length > 0 ? (
            <span className="px-2 py-0.5 bg-amber-500 text-white font-extrabold text-[10px] rounded-full animate-pulse">
              {pendingRequests.length} Waiting
            </span>
          ) : (
            <span className="h-2 w-2 rounded-full bg-emerald-500 animate-ping" title="Live queue active"></span>
          )}
          {activeTab === 'team' && (
            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-indigo-600 rounded-full"></div>
          )}
        </button>

        <button
          onClick={() => setActiveTab('files')}
          className={`pb-2 text-sm font-bold uppercase tracking-wider transition-all relative ${
            activeTab === 'files' 
              ? 'text-indigo-600 font-extrabold' 
              : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          Project Files ({files.length})
          {activeTab === 'files' && (
            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-indigo-600 rounded-full"></div>
          )}
        </button>

        <button
          onClick={() => setActiveTab('github')}
          className={`pb-2 text-sm font-bold uppercase tracking-wider transition-all relative flex items-center space-x-2 ${
            activeTab === 'github' 
              ? 'text-indigo-600 font-extrabold' 
              : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          <Github className="h-4 w-4" />
          <span>GitHub & Codebase</span>
          {(project.githubIntegration?.connected || project.githubRepository?.githubRepositoryId) ? (
            <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" title="Connected & Live"></span>
          ) : (
            <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-slate-200 text-slate-600">Disconnected</span>
          )}
          {activeTab === 'github' && (
            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-indigo-600 rounded-full"></div>
          )}
        </button>
      </div>

      {activeTab === 'board' ? (
        /* Kanban Board Columns */
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4 overflow-x-auto pb-4">
          {columns.map(col => {
            const colTasks = tasks.filter(t => t.status === col);
            return (
              <div key={col} className="bg-slate-100/80 rounded-2xl p-4 border border-slate-200 min-w-[220px] flex flex-col h-[calc(100vh-320px)]">
                <div className="flex items-center justify-between mb-3 border-b border-slate-200 pb-2">
                  <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">{col}</span>
                  <span className="text-[10px] px-2 py-0.5 bg-white rounded-full font-bold text-slate-600 border border-slate-200">{colTasks.length}</span>
                </div>

                <div className="flex-1 space-y-3 overflow-y-auto pr-1">
                  {colTasks.map(task => (
                    <div
                      key={task.id}
                      onClick={() => handleTaskClick(task)}
                      className="p-4 rounded-xl bg-white border border-slate-200 hover:border-indigo-300 transition-all hover:shadow-md cursor-pointer shadow-2xs"
                    >
                      <span className="text-[9px] uppercase font-bold px-1.5 py-0.5 bg-indigo-50 text-indigo-700 border border-indigo-100 rounded">
                        {task.module}
                      </span>
                      <h4 className="text-xs font-semibold text-slate-900 mt-2 line-clamp-1">{task.title}</h4>
                      <p className="text-[11px] text-slate-500 mt-1 line-clamp-2 leading-relaxed">{task.description}</p>
                      
                      <div className="flex items-center justify-between mt-3 pt-2.5 border-t border-slate-100">
                        <div className="flex items-center space-x-1.5">
                          <span className={`h-1.5 w-1.5 rounded-full ${
                            task.priority === 'High' ? 'bg-rose-500' :
                            task.priority === 'Medium' ? 'bg-amber-500' : 'bg-slate-400'
                          }`}></span>
                          <span className="text-[9px] text-slate-500 font-bold uppercase">{task.priority}</span>
                        </div>
                        
                        {task.Assignee ? (
                          <div className="h-5 w-5 rounded-full bg-indigo-600 text-white font-bold text-[9px] flex items-center justify-center shadow-xs" title={task.Assignee.name}>
                            {task.Assignee.name.charAt(0)}
                          </div>
                        ) : (
                          <span className="text-[9px] text-slate-400 font-medium">Unassigned</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      ) : activeTab === 'team' ? (
        /* Allocate Team Members & Owner Approvals Panel */
        <div className="space-y-6">
          {teamNotice && (
            <div className={`p-4 rounded-xl text-xs flex items-center space-x-2 border animate-fadeIn ${
              teamNotice.type === 'success' ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-rose-50 border-rose-200 text-rose-800'
            }`}>
              <Info className="h-4 w-4 shrink-0" />
              <span className="font-semibold">{teamNotice.message}</span>
            </div>
          )}

          {/* Section 1: Waiting for Members */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-100 pb-3 gap-2">
              <div className="flex items-center space-x-2">
                <Users className="h-5 w-5 text-amber-500" />
                <h3 className="text-base font-bold text-slate-900">Waiting for Members</h3>
              </div>

              {/* Live WebSockets Status Badge */}
              <div className="flex items-center space-x-2 px-3 py-1 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-full text-xs font-semibold">
                <Radio className="h-3.5 w-3.5 text-emerald-600 animate-pulse" />
                <span>Live Socket • Waiting for users entering code <strong className="font-mono text-emerald-800">{project.projectCode}</strong></span>
              </div>
            </div>

            {pendingRequests.length === 0 ? (
              <div className="py-8 text-center space-y-3 bg-slate-50 rounded-xl border border-slate-200">
                <div className="relative flex items-center justify-center">
                  <div className="animate-ping absolute inline-flex h-10 w-10 rounded-full bg-emerald-500 opacity-20"></div>
                  <div className="h-8 w-8 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center">
                    <Radio className="h-4 w-4" />
                  </div>
                </div>
                <div>
                  <h4 className="text-sm font-bold text-slate-900">Waiting for team members to enter code...</h4>
                  <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
                    Share Project Code <strong className="text-indigo-600 font-mono tracking-wider">{project.projectCode}</strong> with your team. When they enter it, their profiles will instantly pop up live right here for approval!
                  </p>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {pendingRequests.map(reqItem => {
                  const reqUser = reqItem.user || {};
                  const isPendingLoading = actionLoading === (reqItem.id || reqItem.requestId);

                  return (
                    <div 
                      key={reqItem.id || reqItem.requestId} 
                      className="p-4 rounded-xl bg-slate-50 border border-amber-300 flex items-center justify-between gap-3 shadow-sm animate-fadeIn relative overflow-hidden"
                    >
                      <div className="absolute top-0 left-0 w-1 h-full bg-amber-500"></div>

                      <div className="pl-2">
                        <div className="flex items-center space-x-2">
                          <p className="text-sm font-bold text-slate-900">{reqUser.fullName || reqUser.name || 'Unknown User'}</p>
                          <span className="text-[9px] font-extrabold uppercase px-1.5 py-0.2 rounded bg-amber-100 text-amber-800 border border-amber-200">
                            Waiting Approval
                          </span>
                        </div>
                        <p className="text-xs text-slate-500">{reqUser.email}</p>
                        <div className="mt-1 flex items-center space-x-2">
                          <span className="text-[10px] font-semibold text-indigo-700 px-2 py-0.5 rounded bg-indigo-50 border border-indigo-100">
                            {reqUser.workspaceRole || reqUser.role || 'Developer'}
                          </span>
                          <span className="text-[10px] text-slate-500">
                            {reqUser.experienceLevel || reqUser.experience_level || 'Mid'}
                          </span>
                        </div>
                      </div>

                      {isOwner ? (
                        <div className="flex items-center space-x-2">
                          <button
                            onClick={() => handleRespondRequest(reqItem.id || reqItem.requestId, 'accept')}
                            disabled={isPendingLoading}
                            className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-lg flex items-center space-x-1 shadow-sm transition-all active:scale-[0.98]"
                          >
                            <UserCheck className="h-3.5 w-3.5" />
                            <span>Accept</span>
                          </button>
                          <button
                            onClick={() => handleRespondRequest(reqItem.id || reqItem.requestId, 'reject')}
                            disabled={isPendingLoading}
                            className="px-3 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-semibold rounded-lg flex items-center space-x-1 transition-all"
                          >
                            <UserX className="h-3.5 w-3.5" />
                            <span>Reject</span>
                          </button>
                        </div>
                      ) : (
                        <span className="text-xs text-amber-600 italic font-medium">Pending Owner Review</span>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Section 2: Project Team */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center space-x-2">
                <ShieldCheck className="h-5 w-5 text-indigo-600" />
                <h3 className="text-base font-bold text-slate-900">Project Team</h3>
              </div>
              <span className="text-xs text-slate-500">
                Total Members: <strong className="text-indigo-600">{members.length}</strong>
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {members.map(m => {
                const uObj = m.userId || {};
                const mUserIdStr = uObj._id || uObj.id || uObj;
                const isMemberOwner = mUserIdStr.toString() === ownerIdStr.toString() || m.projectRole === 'Project Owner';

                return (
                  <div key={mUserIdStr.toString()} className="p-4 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between gap-3">
                    <div>
                      <div className="flex items-center space-x-2">
                        <p className="text-sm font-bold text-slate-900">{uObj.fullName || uObj.name || 'Project Member'}</p>
                        {isMemberOwner && (
                          <span className="text-[9px] font-extrabold uppercase px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-700 border border-indigo-200">
                            Owner
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-500 mt-0.5">{uObj.email}</p>
                      <span className="text-[10px] text-slate-500 block mt-1">
                        Role: <strong className="text-slate-700">{m.projectRole || uObj.workspaceRole || 'Developer'}</strong>
                      </span>
                    </div>

                    {isOwner && !isMemberOwner && (
                      <button
                        onClick={() => handleRemoveMember(mUserIdStr)}
                        disabled={actionLoading === mUserIdStr}
                        className="px-2.5 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-semibold rounded-lg transition-colors"
                      >
                        Remove
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      ) : activeTab === 'files' ? (
        /* Project Files Panel */
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm h-fit space-y-4">
            <h3 className="text-base font-bold text-slate-900">Upload Project File</h3>
            <p className="text-xs text-slate-500 leading-relaxed">
              Add sprint plans, project requirement specifications, or database schema designs to keep your team aligned. Max file size: 20MB.
            </p>
            
            <div className="relative border-2 border-dashed border-slate-300 hover:border-indigo-500 rounded-2xl p-6 transition-all bg-slate-50 text-center group cursor-pointer">
              <input
                type="file"
                onChange={handleFileUpload}
                disabled={fileUploading}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              />
              <div className="space-y-2.5">
                <div className="h-10 w-10 bg-indigo-50 text-indigo-600 border border-indigo-100 rounded-full flex items-center justify-center mx-auto group-hover:scale-110 transition-transform">
                  {fileUploading ? (
                    <div className="animate-spin rounded-full h-5 w-5 border-t-2 border-indigo-600"></div>
                  ) : (
                    <Upload className="h-5 w-5" />
                  )}
                </div>
                <div>
                  <p className="text-xs font-semibold text-slate-700">
                    {fileUploading ? 'Uploading file...' : 'Click to select or drag file here'}
                  </p>
                  <p className="text-[10px] text-slate-400 mt-1">PDF, Excel, Word, Images, Zip, or Code</p>
                </div>
              </div>
            </div>

            {fileError && (
              <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 text-[11px] rounded-xl flex items-center space-x-2">
                <AlertTriangle className="h-4 w-4 shrink-0 text-rose-600" />
                <span>{fileError}</span>
              </div>
            )}
          </div>

          <div className="lg:col-span-2 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-bold text-slate-900">Files Registry</h3>
              <span className="text-xs text-slate-500">{files.length} active attachments</span>
            </div>

            {files.length === 0 ? (
              <div className="py-16 text-center space-y-2">
                <File className="h-10 w-10 text-slate-300 mx-auto" />
                <p className="text-xs text-slate-500">No project files have been uploaded yet.</p>
              </div>
            ) : (
              <div className="space-y-3.5 max-h-[60vh] overflow-y-auto pr-1">
                {files.map(file => {
                  let FileIcon = File;
                  if (file.mime_type.startsWith('image/')) FileIcon = Image;
                  else if (file.mime_type.includes('pdf')) FileIcon = FileText;
                  else if (file.mime_type.includes('zip') || file.mime_type.includes('tar') || file.mime_type.includes('rar')) FileIcon = FileArchive;
                  else if (file.mime_type.includes('javascript') || file.mime_type.includes('html') || file.mime_type.includes('css') || file.mime_type.includes('json')) FileIcon = FileCode2;

                  const formattedSize = file.file_size > 1024 * 1024
                    ? (file.file_size / (1024 * 1024)).toFixed(2) + ' MB'
                    : (file.file_size / 1024).toFixed(2) + ' KB';

                  const canDelete = isOwner || file.uploaded_by_user_id === user?.id;

                  return (
                    <div 
                      key={file.id} 
                      className="p-4 rounded-xl bg-slate-50 border border-slate-200 hover:border-slate-300 transition-colors flex items-center justify-between gap-4"
                    >
                      <div className="flex items-center space-x-3.5 min-w-0">
                        <div className="h-10 w-10 bg-indigo-50 text-indigo-600 border border-indigo-100 rounded-xl flex items-center justify-center shrink-0">
                          <FileIcon className="h-5 w-5" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-semibold text-slate-900 truncate" title={file.original_name}>
                            {file.original_name}
                          </p>
                          <div className="flex items-center space-x-2 text-[10px] text-slate-500 mt-1 flex-wrap gap-y-1">
                            <span className="bg-slate-200/80 px-1.5 py-0.5 rounded text-[9px] font-bold text-slate-700 shrink-0">
                              {formattedSize}
                            </span>
                            <span>•</span>
                            <span>by {file.Uploader?.name || 'User'}</span>
                            <span>•</span>
                            <span>{new Date(file.createdAt).toLocaleDateString()}</span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center space-x-1.5 shrink-0">
                        <button
                          onClick={() => handleFileDownload(file)}
                          title="Download File"
                          className="p-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-lg transition-colors border border-indigo-200"
                        >
                          <Download className="h-4 w-4" />
                        </button>
                        {canDelete && (
                          <button
                            onClick={() => handleFileDelete(file.id)}
                            title="Delete File"
                            className="p-2 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-lg transition-colors border border-rose-200"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      ) : (
        /* GitHub & Codebase Panel */
        <div className="space-y-6 animate-fadeIn">
          {(!project.githubIntegration?.connected && !project.githubRepository?.githubRepositoryId) ? (
            /* NOT LINKED TO A REPOSITORY - WORKFLOW STEPS */
            <div className="space-y-6">
              {!githubStatus.connected ? (
                /* Step 1: Initial state - Connect GitHub */
                <div className="bg-white p-10 md:p-12 rounded-3xl border border-slate-200 shadow-sm text-center max-w-2xl mx-auto space-y-6 animate-fadeIn">
                  <div className="mx-auto bg-gradient-to-tr from-slate-900 via-indigo-950 to-slate-800 p-5 rounded-2xl w-fit text-white shadow-lg shadow-indigo-100 flex items-center justify-center">
                    <Github className="h-12 w-12 text-white" />
                  </div>
                  <div className="space-y-2">
                    <div className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full bg-indigo-50 border border-indigo-100 text-indigo-700 text-xs font-semibold">
                      <FolderGit2 className="h-3.5 w-3.5 text-indigo-600" />
                      <span>Project Codebase Integration</span>
                    </div>
                    <h3 className="text-2xl font-extrabold text-slate-900">GitHub Integration</h3>
                    <p className="text-xs text-slate-500 max-w-lg mx-auto leading-relaxed">
                      Connect your GitHub account to manage this project's repository, stream real-time commits, and configure automatic webhooks.
                    </p>
                  </div>

                  <div className="pt-2">
                    <button
                      onClick={handleInitiateOAuth}
                      disabled={isConnectingOAuth}
                      className="px-8 py-3.5 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl shadow-md hover:shadow-lg transition-all inline-flex items-center space-x-2 active:scale-[0.98] disabled:opacity-50"
                    >
                      <Github className="h-4 w-4" />
                      <span>{isConnectingOAuth ? 'Redirecting to GitHub Authorization...' : 'Connect GitHub'}</span>
                    </button>
                  </div>
                </div>
              ) : connectWorkflowStep === 'intro' ? (
                /* Step 2: GitHub Account Connected Banner */
                <div className="bg-white p-8 md:p-10 rounded-3xl border border-slate-200 shadow-sm text-center max-w-lg mx-auto space-y-6 animate-fadeIn">
                  <div className="mx-auto relative w-fit">
                    <img
                      src={githubStatus.avatar || `https://avatars.githubusercontent.com/${githubStatus.username}`}
                      alt={githubStatus.username}
                      className="h-20 w-20 rounded-full border-4 border-emerald-100 shadow-md mx-auto"
                    />
                    <div className="absolute bottom-0 right-0 bg-emerald-500 text-white p-1.5 rounded-full border-2 border-white">
                      <Check className="h-3.5 w-3.5" />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                      <CheckCircle className="h-3.5 w-3.5 text-emerald-600" />
                      <span>GitHub Connected ✓</span>
                    </span>
                    <h3 className="text-xl font-bold text-slate-900 mt-2">Account: @{githubStatus.username}</h3>
                    <p className="text-xs text-slate-500">Your GitHub account is verified and ready to link with this project.</p>
                  </div>

                  <button
                    onClick={() => {
                      setConnectWorkflowStep('choice');
                      setCreateRepoName(project.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''));
                      setCreateRepoDesc(project.description || '');
                    }}
                    className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-md transition-all flex items-center justify-center space-x-2"
                  >
                    <span>Continue</span>
                    <ArrowRight className="h-4 w-4" />
                  </button>
                </div>
              ) : connectWorkflowStep === 'choice' ? (
                /* Step 3: What do you want to do? */
                <div className="bg-white p-8 md:p-10 rounded-3xl border border-slate-200 shadow-sm max-w-2xl mx-auto space-y-6 animate-fadeIn">
                  <div className="text-center space-y-1">
                    <div className="inline-flex items-center space-x-1.5 text-xs text-slate-500">
                      <span>Connected as</span>
                      <strong className="text-slate-800 font-mono">@{githubStatus.username}</strong>
                    </div>
                    <h3 className="text-2xl font-extrabold text-slate-900">What do you want to do?</h3>
                    <p className="text-xs text-slate-500">Choose how you want to configure a GitHub repository for "{project.name}".</p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                    {/* Option A Card */}
                    <button
                      onClick={() => {
                        setCreateRepoName(project.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''));
                        setCreateRepoDesc(project.description || '');
                        setConnectWorkflowStep('create_repo');
                      }}
                      className="p-6 rounded-2xl bg-gradient-to-br from-indigo-50/70 to-slate-50 border border-indigo-100 hover:border-indigo-400 text-left hover:shadow-md transition-all group flex flex-col justify-between space-y-4"
                    >
                      <div className="space-y-2">
                        <div className="p-3 bg-indigo-600 text-white rounded-xl w-fit shadow-sm group-hover:scale-105 transition-transform">
                          <Plus className="h-6 w-6" />
                        </div>
                        <h4 className="text-base font-bold text-slate-900">🆕 Create New Repository</h4>
                        <p className="text-xs text-slate-600 leading-relaxed">
                          Create a new repository under @{githubStatus.username} on GitHub and automatically connect it to this DevPilot project.
                        </p>
                      </div>
                      <div className="text-xs font-bold text-indigo-600 flex items-center space-x-1">
                        <span>Configure & Create</span>
                        <ArrowRight className="h-3.5 w-3.5 group-hover:translate-x-1 transition-transform" />
                      </div>
                    </button>

                    {/* Option B Card */}
                    <button
                      onClick={() => {
                        setConnectWorkflowStep('import_repo');
                        fetchAvailableRepos();
                      }}
                      className="p-6 rounded-2xl bg-gradient-to-br from-slate-50 to-indigo-50/40 border border-slate-200 hover:border-indigo-400 text-left hover:shadow-md transition-all group flex flex-col justify-between space-y-4"
                    >
                      <div className="space-y-2">
                        <div className="p-3 bg-slate-900 text-white rounded-xl w-fit shadow-sm group-hover:scale-105 transition-transform">
                          <FolderGit2 className="h-6 w-6" />
                        </div>
                        <h4 className="text-base font-bold text-slate-900">📦 Import Existing Repository</h4>
                        <p className="text-xs text-slate-600 leading-relaxed">
                          Browse and link an existing repository accessible to your GitHub account with verified access.
                        </p>
                      </div>
                      <div className="text-xs font-bold text-slate-900 group-hover:text-indigo-600 flex items-center space-x-1">
                        <span>Browse Repositories</span>
                        <ArrowRight className="h-3.5 w-3.5 group-hover:translate-x-1 transition-transform" />
                      </div>
                    </button>
                  </div>
                </div>
              ) : connectWorkflowStep === 'create_repo' ? (
                /* Option A: Create New Repository Form */
                <div className="bg-white p-8 md:p-10 rounded-3xl border border-slate-200 shadow-sm max-w-xl mx-auto space-y-6 animate-fadeIn">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                    <div className="flex items-center space-x-2.5">
                      <div className="p-2.5 bg-indigo-600 text-white rounded-xl shadow-xs">
                        <Plus className="h-5 w-5" />
                      </div>
                      <div>
                        <h3 className="text-lg font-bold text-slate-900">Create New GitHub Repository</h3>
                        <p className="text-xs text-slate-500">Creating under <strong className="text-slate-800">@{githubStatus.username}</strong></p>
                      </div>
                    </div>
                    <button
                      onClick={() => setConnectWorkflowStep('choice')}
                      className="text-xs text-slate-400 hover:text-slate-700 px-2.5 py-1.5 rounded-lg hover:bg-slate-100"
                    >
                      Back
                    </button>
                  </div>

                  <form onSubmit={handleCreateNewRepo} className="space-y-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1.5">Repository Name *</label>
                      <div className="flex items-center bg-slate-50 border border-slate-300 rounded-xl overflow-hidden focus-within:border-indigo-600 focus-within:bg-white focus-within:ring-2 focus-within:ring-indigo-500/20">
                        <span className="px-3 text-xs text-slate-400 font-mono bg-slate-100/80 border-r border-slate-200 py-2.5">
                          @{githubStatus.username}/
                        </span>
                        <input
                          type="text"
                          required
                          value={createRepoName}
                          onChange={(e) => setCreateRepoName(e.target.value.toLowerCase().replace(/[^a-z0-9-_]/g, '-'))}
                          placeholder="online-book-store"
                          className="flex-1 px-3 py-2.5 bg-transparent text-xs font-mono text-slate-900 outline-none"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1.5">Description (Optional)</label>
                      <textarea
                        rows={2}
                        value={createRepoDesc}
                        onChange={(e) => setCreateRepoDesc(e.target.value)}
                        placeholder="Online Book Store Application"
                        className="w-full p-3 rounded-xl bg-slate-50 border border-slate-300 text-slate-900 text-xs focus:outline-none focus:border-indigo-600 focus:bg-white resize-none"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1.5">Visibility</label>
                      <div className="grid grid-cols-2 gap-3">
                        <label className={`flex items-center space-x-2.5 p-3 rounded-xl border cursor-pointer transition-all ${
                          createRepoVisibility === 'public' ? 'border-indigo-600 bg-indigo-50/50 text-indigo-900 font-semibold' : 'border-slate-200 bg-slate-50 text-slate-700'
                        }`}>
                          <input
                            type="radio"
                            name="visibility"
                            value="public"
                            checked={createRepoVisibility === 'public'}
                            onChange={() => setCreateRepoVisibility('public')}
                            className="text-indigo-600 focus:ring-indigo-500"
                          />
                          <Globe className="h-4 w-4 text-slate-500" />
                          <span className="text-xs">Public</span>
                        </label>

                        <label className={`flex items-center space-x-2.5 p-3 rounded-xl border cursor-pointer transition-all ${
                          createRepoVisibility === 'private' ? 'border-indigo-600 bg-indigo-50/50 text-indigo-900 font-semibold' : 'border-slate-200 bg-slate-50 text-slate-700'
                        }`}>
                          <input
                            type="radio"
                            name="visibility"
                            value="private"
                            checked={createRepoVisibility === 'private'}
                            onChange={() => setCreateRepoVisibility('private')}
                            className="text-indigo-600 focus:ring-indigo-500"
                          />
                          <Lock className="h-4 w-4 text-slate-500" />
                          <span className="text-xs">Private</span>
                        </label>
                      </div>
                    </div>

                    <div className="pt-3 flex items-center justify-end space-x-3">
                      <button
                        type="button"
                        onClick={() => setConnectWorkflowStep('choice')}
                        className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        disabled={isCreatingRepo}
                        className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-md transition-all disabled:opacity-50 flex items-center space-x-2"
                      >
                        {isCreatingRepo ? (
                          <>
                            <RefreshCw className="h-4 w-4 animate-spin" />
                            <span>Creating on GitHub...</span>
                          </>
                        ) : (
                          <span>Create Repository</span>
                        )}
                      </button>
                    </div>
                  </form>
                </div>
              ) : (
                /* Option B: Import Existing Repository Form */
                <div className="bg-white p-8 md:p-10 rounded-3xl border border-slate-200 shadow-sm max-w-2xl mx-auto space-y-5 animate-fadeIn">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                    <div className="flex items-center space-x-2.5">
                      <div className="p-2.5 bg-slate-900 text-white rounded-xl shadow-xs">
                        <FolderGit2 className="h-5 w-5" />
                      </div>
                      <div>
                        <h3 className="text-lg font-bold text-slate-900">Import Existing Repository</h3>
                        <p className="text-xs text-slate-500">Accessible to <strong className="text-slate-800">@{githubStatus.username}</strong></p>
                      </div>
                    </div>
                    <button
                      onClick={() => setConnectWorkflowStep('choice')}
                      className="text-xs text-slate-400 hover:text-slate-700 px-2.5 py-1.5 rounded-lg hover:bg-slate-100"
                    >
                      Back
                    </button>
                  </div>

                  {/* Search and Filters */}
                  <div className="flex flex-col sm:flex-row items-center gap-3">
                    <div className="relative flex-1 w-full">
                      <Search className="h-4 w-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input
                        type="text"
                        placeholder="Search repositories..."
                        value={repoSearchQuery}
                        onChange={(e) => {
                          setRepoSearchQuery(e.target.value);
                          fetchAvailableRepos(e.target.value, repoVisibilityFilter);
                        }}
                        className="w-full pl-9 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none"
                      />
                    </div>

                    <div className="flex items-center space-x-1 bg-slate-100 p-1 rounded-xl shrink-0">
                      {['all', 'public', 'private'].map((vis) => (
                        <button
                          key={vis}
                          type="button"
                          onClick={() => {
                            setRepoVisibilityFilter(vis);
                            fetchAvailableRepos(repoSearchQuery, vis);
                          }}
                          className={`px-3 py-1.5 rounded-lg text-xs font-semibold capitalize transition-colors ${
                            repoVisibilityFilter === vis ? 'bg-white text-indigo-700 shadow-xs' : 'text-slate-600'
                          }`}
                        >
                          {vis}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Repositories List */}
                  <div className="max-h-[360px] overflow-y-auto space-y-2.5 pr-1">
                    {loadingRepos ? (
                      <div className="py-12 text-center">
                        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-indigo-600 mx-auto"></div>
                        <p className="text-xs text-slate-500 mt-3">Loading accessible repositories from GitHub API...</p>
                      </div>
                    ) : availableRepos.length === 0 ? (
                      <div className="py-8 text-center text-slate-500 text-xs">
                        <p>No repositories found for this account/search query.</p>
                      </div>
                    ) : (
                      availableRepos.map((repo) => (
                        <div
                          key={repo.id}
                          onClick={() => setSelectedImportRepo(repo)}
                          className={`p-4 rounded-2xl border transition-all cursor-pointer flex items-center justify-between gap-3 ${
                            selectedImportRepo?.id === repo.id
                              ? 'bg-indigo-50/70 border-indigo-500 shadow-xs'
                              : 'bg-slate-50/60 border-slate-200 hover:border-indigo-300 hover:bg-slate-50'
                          }`}
                        >
                          <div className="min-w-0">
                            <div className="flex items-center space-x-2">
                              <h4 className="text-xs font-bold text-slate-900 truncate font-mono">{repo.name}</h4>
                              <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold ${
                                repo.private ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'
                              }`}>
                                {repo.private ? 'Private' : 'Public'}
                              </span>
                              <span className="text-[10px] text-slate-400 font-mono">branch: {repo.default_branch || 'main'}</span>
                            </div>
                            {repo.description && (
                              <p className="text-[11px] text-slate-600 mt-1 line-clamp-1">{repo.description}</p>
                            )}
                            <div className="flex items-center space-x-3 text-[10px] text-slate-400 mt-1.5">
                              <span>Owner: <strong>{repo.owner}</strong></span>
                              <span>•</span>
                              <span>Updated {formatTimeAgo(repo.updated_at)}</span>
                            </div>
                          </div>

                          <div className="shrink-0">
                            <div className={`h-5 w-5 rounded-full border flex items-center justify-center ${
                              selectedImportRepo?.id === repo.id
                                ? 'border-indigo-600 bg-indigo-600 text-white'
                                : 'border-slate-300 bg-white'
                            }`}>
                              {selectedImportRepo?.id === repo.id && <Check className="h-3 w-3" />}
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>

                  <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                    <span className="text-xs text-slate-500">
                      {selectedImportRepo ? `Selected: ${selectedImportRepo.full_name}` : 'Select a repository above'}
                    </span>

                    <button
                      onClick={handleImportSelectedRepo}
                      disabled={!selectedImportRepo || isImportingRepo}
                      className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-md transition-all disabled:opacity-40 flex items-center space-x-2"
                    >
                      {isImportingRepo ? (
                        <>
                          <RefreshCw className="h-4 w-4 animate-spin" />
                          <span>Verifying & Connecting...</span>
                        </>
                      ) : (
                        <span>Connect Repository</span>
                      )}
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            /* Connected State */
            <div className="space-y-6">
              {/* Repository Header & Webhook Status Card */}
              <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-5">
                <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 border-b border-slate-100 pb-5">
                  <div className="flex items-start space-x-4">
                    <div className="p-3.5 bg-slate-900 text-white rounded-2xl shadow-inner mt-0.5">
                      <Github className="h-7 w-7" />
                    </div>
                    <div>
                      <div className="flex items-center space-x-2 flex-wrap gap-y-1">
                        <h2 className="text-lg font-mono font-extrabold text-slate-900">
                          {project.githubIntegration?.repositoryOwner || project.githubRepository?.owner}/
                          <span className="text-indigo-600">{project.githubIntegration?.repositoryName || project.githubRepository?.name}</span>
                        </h2>
                        <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                          <CheckCircle className="h-3.5 w-3.5 text-emerald-600" />
                          <span>Connected ✓</span>
                        </span>
                        <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-slate-100 text-slate-700 border border-slate-200">
                          <Globe className="h-3.5 w-3.5 text-slate-500" />
                          <span className="capitalize">{project.githubIntegration?.visibility || (project.githubRepository?.isPrivate ? 'Private' : 'Public')}</span>
                        </span>
                        <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-md text-xs font-mono font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                          <GitBranch className="h-3.5 w-3.5 text-indigo-500" />
                          <span>{project.githubIntegration?.defaultBranch || project.githubRepository?.defaultBranch || 'main'}</span>
                        </span>
                      </div>

                      <p className="text-xs text-slate-500 mt-1">
                        {project.githubIntegration?.description || project.githubRepository?.description || 'Connected project repository'}
                      </p>

                      <div className="flex items-center space-x-4 text-xs text-slate-500 mt-2 flex-wrap gap-y-1">
                        <span className="flex items-center space-x-1">
                          <Clock className="h-3.5 w-3.5 text-slate-400" />
                          <span>Last Synced: <strong>{formatTimeAgo(project.githubIntegration?.lastSyncedAt || project.githubRepository?.lastSyncedAt)}</strong></span>
                        </span>
                        <span className="flex items-center space-x-1 text-emerald-600 font-semibold">
                          <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse"></span>
                          <span>GitHub Webhooks Active</span>
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Action buttons */}
                  <div className="flex items-center space-x-2 shrink-0 flex-wrap gap-y-2">
                    <a
                      href={project.githubIntegration?.repositoryUrl || project.githubRepository?.htmlUrl || `https://github.com/${project.githubRepository?.fullName || project.githubRepository?.name}`}
                      target="_blank"
                      rel="noreferrer"
                      className="px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs rounded-xl shadow-sm transition-all flex items-center space-x-1.5"
                    >
                      <Github className="h-3.5 w-3.5" />
                      <span>View on GitHub</span>
                      <ExternalLink className="h-3 w-3 text-slate-400" />
                    </a>

                    <button
                      onClick={handleSyncProjectRepo}
                      disabled={syncingRepo}
                      className="px-4 py-2.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 font-semibold text-xs rounded-xl transition-all flex items-center space-x-1.5"
                    >
                      <RefreshCw className={`h-3.5 w-3.5 text-indigo-600 ${syncingRepo ? 'animate-spin' : ''}`} />
                      <span>{syncingRepo ? 'Syncing...' : 'Sync Now'}</span>
                    </button>

                    {isOwner && (
                      <>
                        <button
                          onClick={() => setShowDisconnectConfirmModal(true)}
                          className="px-3.5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 text-xs font-semibold rounded-xl transition-colors"
                        >
                          Change Repo
                        </button>
                        <button
                          onClick={() => setShowDisconnectConfirmModal(true)}
                          className="px-3.5 py-2.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-semibold rounded-xl transition-colors"
                        >
                          Disconnect
                        </button>
                      </>
                    )}
                  </div>
                </div>

                {/* Latest Commit Hero Banner */}
                {(project.githubIntegration?.latestCommit?.message || project.githubRepository?.lastCommit?.message) && (
                  <div className="p-4 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 rounded-2xl text-white shadow-md flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                    <div className="space-y-1.5">
                      <div className="flex items-center space-x-2 text-xs font-bold text-indigo-300">
                        <GitCommit className="h-4 w-4 text-indigo-400" />
                        <span className="uppercase tracking-wider">Latest Repository Commit</span>
                        <span className="px-1.5 py-0.5 rounded bg-indigo-900/80 text-indigo-200 font-mono text-[10px]">
                          #{(project.githubIntegration?.latestCommit?.sha || project.githubRepository?.lastCommit?.sha || 'head').substring(0, 7)}
                        </span>
                      </div>
                      <h4 className="text-base font-extrabold text-white">
                        "{project.githubIntegration?.latestCommit?.message || project.githubRepository?.lastCommit?.message}"
                      </h4>
                      <div className="flex items-center space-x-3 text-xs text-slate-300">
                        <span>by <strong className="text-white">@{project.githubIntegration?.latestCommit?.author || project.githubRepository?.lastCommit?.author || 'developer'}</strong></span>
                        <span>•</span>
                        <span className="flex items-center space-x-1 font-mono text-indigo-200">
                          <GitBranch className="h-3 w-3" />
                          <span>{project.githubIntegration?.latestCommit?.branch || project.githubIntegration?.defaultBranch || project.githubRepository?.defaultBranch || 'main'}</span>
                        </span>
                        <span>•</span>
                        <span>{formatTimeAgo(project.githubIntegration?.latestCommit?.date || project.githubRepository?.lastCommit?.date)}</span>
                      </div>
                    </div>

                    {(project.githubIntegration?.latestCommit?.url || project.githubRepository?.lastCommit?.url) && (
                      <a
                        href={project.githubIntegration?.latestCommit?.url || project.githubRepository?.lastCommit?.url}
                        target="_blank"
                        rel="noreferrer"
                        className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-xl text-xs font-semibold border border-white/20 shrink-0 inline-flex items-center space-x-1.5 transition-colors"
                      >
                        <span>View Commit Diff</span>
                        <ExternalLink className="h-3 w-3 text-indigo-200" />
                      </a>
                    )}
                  </div>
                )}
              </div>

              {/* Multi-Column Activity Grid */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Recent Commits Stream (2 Cols) */}
                <div className="lg:col-span-2 bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-4">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                    <div className="flex items-center space-x-2">
                      <GitCommit className="h-5 w-5 text-indigo-600" />
                      <h3 className="text-base font-bold text-slate-900">Recent Commits Stream</h3>
                    </div>
                    <span className="text-xs text-slate-400 font-mono">
                      {(project.githubIntegration?.recentCommits?.length || 0)} commits listed
                    </span>
                  </div>

                  {(!project.githubIntegration?.recentCommits || project.githubIntegration.recentCommits.length === 0) ? (
                    <div className="py-12 text-center text-slate-400 text-xs">
                      <GitCommit className="h-8 w-8 mx-auto text-slate-300 mb-2" />
                      <p>No commits recorded yet. Push changes to GitHub to view live stream.</p>
                    </div>
                  ) : (
                    <div className="space-y-3 max-h-[600px] overflow-y-auto pr-1">
                      {project.githubIntegration.recentCommits.map((c, idx) => (
                        <div
                          key={c.sha || idx}
                          className="p-4 rounded-2xl bg-slate-50 hover:bg-indigo-50/40 border border-slate-200 hover:border-indigo-200 transition-all flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3"
                        >
                          <div className="space-y-1 min-w-0">
                            <div className="flex items-center space-x-2 flex-wrap gap-y-1">
                              <span className="font-mono text-[10px] font-bold text-indigo-700 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded-md">
                                #{c.sha?.substring(0, 7) || 'head'}
                              </span>
                              <span className="text-xs font-bold text-slate-900 truncate">
                                {c.message}
                              </span>
                            </div>
                            <div className="flex items-center space-x-3 text-[11px] text-slate-500">
                              <span>by <strong className="text-slate-700">@{c.author}</strong></span>
                              <span>•</span>
                              <span className="font-mono text-slate-600 flex items-center space-x-1">
                                <GitBranch className="h-3 w-3 text-slate-400" />
                                <span>{c.branch || 'main'}</span>
                              </span>
                              <span>•</span>
                              <span>{formatTimeAgo(c.date)}</span>
                            </div>
                          </div>

                          {c.url && (
                            <a
                              href={c.url}
                              target="_blank"
                              rel="noreferrer"
                              className="px-3 py-1.5 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-lg text-xs font-semibold inline-flex items-center space-x-1 shrink-0 shadow-xs"
                            >
                              <span>Commit</span>
                              <ExternalLink className="h-3 w-3 text-slate-400" />
                            </a>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Right Sidebar: Pull Requests & Repository Stats */}
                <div className="space-y-6">
                  {/* Pull Requests Card */}
                  <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm space-y-4">
                    <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
                      <div className="flex items-center space-x-2">
                        <GitPullRequest className="h-4 w-4 text-purple-600" />
                        <h4 className="text-sm font-bold text-slate-900">Pull Requests</h4>
                      </div>
                      <span className="text-[11px] text-slate-400">
                        {project.githubIntegration?.pullRequests?.length || 0} active
                      </span>
                    </div>

                    {(!project.githubIntegration?.pullRequests || project.githubIntegration.pullRequests.length === 0) ? (
                      <div className="py-6 text-center text-slate-400 text-xs">
                        <GitPullRequest className="h-6 w-6 mx-auto text-slate-300 mb-1" />
                        <p>No pull requests found.</p>
                      </div>
                    ) : (
                      <div className="space-y-2.5">
                        {project.githubIntegration.pullRequests.map((pr, pidx) => (
                          <a
                            key={pr.number || pidx}
                            href={pr.url}
                            target="_blank"
                            rel="noreferrer"
                            className="p-3 bg-slate-50 hover:bg-purple-50/50 border border-slate-200 hover:border-purple-200 rounded-xl block transition-all"
                          >
                            <div className="flex items-center justify-between">
                              <span className="font-bold text-xs text-slate-900 truncate max-w-[180px]">
                                #{pr.number} {pr.title}
                              </span>
                              <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold ${
                                pr.state === 'merged' ? 'bg-purple-100 text-purple-800' :
                                pr.state === 'open' ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-700'
                              }`}>
                                {pr.state}
                              </span>
                            </div>
                            <div className="flex items-center space-x-2 text-[10px] text-slate-400 mt-1">
                              <span>by @{pr.author}</span>
                              <span>•</span>
                              <span>{formatTimeAgo(pr.createdAt)}</span>
                            </div>
                          </a>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Branches Card */}
                  <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm space-y-3">
                    <div className="flex items-center space-x-2 border-b border-slate-100 pb-2.5">
                      <GitBranch className="h-4 w-4 text-indigo-600" />
                      <h4 className="text-sm font-bold text-slate-900">Active Branches</h4>
                    </div>

                    <div className="flex flex-wrap gap-2 pt-1">
                      {(project.githubIntegration?.branches || [{ name: 'main', isDefault: true }]).map((b, bidx) => (
                        <span
                          key={b.name || bidx}
                          className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-700 rounded-lg text-xs font-mono flex items-center space-x-1.5"
                        >
                          <GitBranch className="h-3 w-3 text-slate-400" />
                          <span>{b.name}</span>
                          {b.isDefault && (
                            <span className="text-[9px] bg-indigo-100 text-indigo-700 font-bold px-1 rounded">default</span>
                          )}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Codebase Metrics Card */}
                  <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm space-y-3">
                    <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">Repository Metrics</h4>
                    <div className="grid grid-cols-3 gap-2 text-center">
                      <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                        <span className="block text-sm font-extrabold text-slate-900">{project.githubIntegration?.stars || project.githubRepository?.stars || 0}</span>
                        <span className="text-[10px] text-slate-500">Stars ⭐</span>
                      </div>
                      <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                        <span className="block text-sm font-extrabold text-slate-900">{project.githubIntegration?.forks || project.githubRepository?.forks || 0}</span>
                        <span className="text-[10px] text-slate-500">Forks 🍴</span>
                      </div>
                      <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                        <span className="block text-sm font-extrabold text-slate-900">{project.githubIntegration?.openIssuesCount || project.githubRepository?.openIssuesCount || 0}</span>
                        <span className="text-[10px] text-slate-500">Issues 🐞</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Task Details Modal */}
      {selectedTask && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-4xl max-h-[85vh] rounded-2xl border border-slate-200 shadow-2xl flex flex-col overflow-hidden">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between">
              <div>
                <span className="text-[10px] uppercase font-bold text-indigo-600">{selectedTask.module}</span>
                <h3 className="text-lg font-bold text-slate-900 mt-1">Task #{selectedTask.id}: {selectedTask.title}</h3>
              </div>
              <button 
                onClick={() => setSelectedTask(null)}
                className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="md:col-span-2 space-y-5">
                {taskError && (
                  <div className="p-3.5 bg-rose-50 border border-rose-200 text-rose-800 text-xs rounded-xl flex items-center space-x-2">
                    <AlertTriangle className="h-4 w-4 shrink-0 text-rose-600" />
                    <span>{taskError}</span>
                  </div>
                )}

                <div>
                  <h4 className="text-xs uppercase font-bold text-slate-500 pl-1 mb-1.5">Description</h4>
                  <p className="text-xs text-slate-700 bg-slate-50 border border-slate-200 rounded-xl p-3.5 leading-relaxed">
                    {selectedTask.description || 'No description provided.'}
                  </p>
                </div>

                <div className="space-y-3">
                  <h4 className="text-xs uppercase font-bold text-slate-500 pl-1">Linked GitHub Code Activity</h4>
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-start space-x-2.5">
                      <FileCode2 className="h-4 w-4 text-indigo-600 shrink-0 mt-0.5" />
                      <div>
                        <p className="text-xs text-slate-900 font-semibold">commit: Implemented module task (#{selectedTask.id})</p>
                        <span className="text-[10px] text-slate-400 mt-0.5 block">developer • 3 hours ago</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="space-y-3">
                  <h4 className="text-xs uppercase font-bold text-slate-500 pl-1">Discussion Comments ({modalComments.length})</h4>
                  <form onSubmit={handleAddComment} className="flex gap-2">
                    <input
                      type="text"
                      value={newComment}
                      onChange={(e) => setNewComment(e.target.value)}
                      placeholder="Ask a question or post update details..."
                      className="flex-1 p-2 rounded-lg bg-slate-50 border border-slate-300 text-slate-900 text-xs focus:outline-none focus:border-indigo-600 focus:bg-white"
                    />
                    <button 
                      type="submit" 
                      className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-xs text-white font-semibold rounded-lg shadow-sm"
                    >
                      Comment
                    </button>
                  </form>

                  <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                    {modalComments.map(c => (
                      <div key={c.id} className="p-2.5 bg-slate-50 rounded-lg border border-slate-200">
                        <div className="flex items-center justify-between text-[10px] text-slate-500 mb-1">
                          <span className="font-semibold text-indigo-700">{c.User?.name}</span>
                          <span>{new Date(c.createdAt).toLocaleDateString()}</span>
                        </div>
                        <p className="text-xs text-slate-700">{c.content}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="space-y-5 bg-slate-50 border border-slate-200 rounded-2xl p-4 h-fit">
                <div>
                  <label className="block text-[10px] uppercase font-bold text-slate-500 mb-1">Task Status</label>
                  <select
                    value={selectedTask.status}
                    onChange={(e) => handleStatusChange(selectedTask.id, e.target.value)}
                    className="w-full p-2.5 rounded-xl bg-white border border-slate-300 text-slate-900 text-xs focus:outline-none focus:border-indigo-600"
                  >
                    {columns.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] uppercase font-bold text-slate-500 mb-1">Assigned Developer</label>
                  <select
                    value={selectedTask.assigned_user_id || ''}
                    onChange={(e) => handleAssigneeChange(selectedTask.id, e.target.value)}
                    className="w-full p-2.5 rounded-xl bg-white border border-slate-300 text-slate-900 text-xs focus:outline-none focus:border-indigo-600"
                  >
                    <option value="">Unassigned</option>
                    {members.map(m => {
                      const u = m.userId || {};
                      return <option key={u._id || u.id} value={u._id || u.id}>{u.fullName || u.name} ({m.projectRole})</option>;
                    })}
                  </select>
                </div>

                <div className="border-t border-slate-200 pt-3 space-y-2 text-[10px] text-slate-500">
                  <div className="flex justify-between">
                    <span>Priority:</span>
                    <span className="font-semibold text-slate-900">{selectedTask.priority}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Complexity:</span>
                    <span className="font-semibold text-slate-900">{selectedTask.complexity}</span>
                  </div>
                </div>

                <div className="border-t border-slate-200 pt-4">
                  <div className="flex items-center space-x-1 text-rose-600 mb-2">
                    <Bug className="h-4.5 w-4.5" />
                    <span className="text-[11px] font-bold uppercase tracking-wider">Report Task Issue</span>
                  </div>
                  <form onSubmit={handleReportIssue} className="space-y-2">
                    <textarea
                      rows={2}
                      value={newIssueDesc}
                      onChange={(e) => setNewIssueDesc(e.target.value)}
                      placeholder="e.g. Page crashes when loading dataset..."
                      className="w-full p-2 rounded-lg bg-white border border-slate-300 text-slate-900 text-xs resize-none focus:outline-none focus:border-indigo-600"
                    />
                    <button
                      type="submit"
                      className="w-full py-2 bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-700 text-xs font-semibold rounded-lg transition-colors"
                    >
                      Block Task & Report Bug
                    </button>
                  </form>
                </div>

                {modalIssues.length > 0 && (
                  <div className="border-t border-slate-200 pt-4 space-y-3">
                    <h4 className="text-[10px] uppercase font-bold text-slate-500">Active Task Issues</h4>
                    <div className="space-y-2.5 max-h-40 overflow-y-auto">
                      {modalIssues.map(issue => (
                        <div key={issue.id} className="p-2.5 bg-rose-50 border border-rose-200 rounded-xl space-y-2">
                          <p className="text-xs text-rose-800 leading-relaxed font-medium">{issue.description}</p>
                          
                          {issue.ai_category ? (
                            <div className="p-2 rounded bg-white border border-slate-200 text-[9px] space-y-1 text-slate-600">
                              <span className="font-bold text-indigo-600 block">AI Analysis:</span>
                              <div><span className="text-slate-500">Category:</span> {issue.ai_category}</div>
                              <div><span className="text-slate-500">Priority:</span> {issue.ai_priority}</div>
                            </div>
                          ) : (
                            <button
                              onClick={() => handleAITriage(issue.id)}
                              className="px-2 py-1 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 text-indigo-700 text-[10px] font-bold rounded-lg transition-colors flex items-center space-x-1"
                            >
                              <Cpu className="h-3 w-3" />
                              <span>AI Root Cause Triage</span>
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* AI Recommendations Drawer/Modal */}
      {showAssignModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-end">
          <div className="bg-white w-full max-w-md h-screen p-6 border-l border-slate-200 shadow-2xl flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center space-x-2 text-indigo-600">
                  <Cpu className="h-6 w-6 animate-pulse" />
                  <h3 className="text-lg font-bold text-slate-900">AI Task Recommender</h3>
                </div>
                <button onClick={() => setShowAssignModal(false)} className="p-1 text-slate-400 hover:text-slate-700">
                  <X className="h-5 w-5" />
                </button>
              </div>

              {recLoading ? (
                <div className="py-20 text-center space-y-3">
                  <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-indigo-600 mx-auto"></div>
                  <p className="text-xs text-slate-500">Running workload balancing algorithms...</p>
                </div>
              ) : recommendations.length === 0 ? (
                <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl text-center text-xs text-slate-500">
                  No pending tasks requiring assignment recommendations.
                </div>
              ) : (
                <div className="space-y-4 max-h-[75vh] overflow-y-auto pr-1">
                  {recommendations.map(rec => {
                    const recTask = tasks.find(t => t.id === rec.taskId);
                    const recDev = members.find(m => (m.userId?._id || m.userId?.id || m.userId) === rec.recommendedUserId);
                    if (!recTask) return null;
                    return (
                      <div key={rec.taskId} className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
                        <div>
                          <span className="text-[9px] uppercase font-bold px-1.5 py-0.5 bg-indigo-50 text-indigo-700 border border-indigo-100 rounded">
                            {recTask.module}
                          </span>
                          <h4 className="text-xs font-semibold text-slate-900 mt-2">{recTask.title}</h4>
                        </div>

                        <div className="p-2.5 rounded-lg bg-white border border-slate-200 text-[11px] text-slate-700 leading-relaxed">
                          <span className="font-bold text-indigo-700 block mb-1">Recommended Developer: {recDev?.userId?.fullName || recDev?.userId?.name || 'Developer'}</span>
                          {rec.reason}
                        </div>

                        <button
                          onClick={() => handleApplyRecommendation(rec.taskId, recDev?.userId?._id || recDev?.userId?.id)}
                          className="w-full py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-[10px] font-bold rounded-lg transition-colors flex items-center justify-center space-x-1 shadow-sm"
                        >
                          <CheckCircle className="h-3.5 w-3.5" />
                          <span>Approve Assignment</span>
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <button
              onClick={() => setShowAssignModal(false)}
              className="w-full py-3 bg-slate-100 hover:bg-slate-200 rounded-xl text-xs text-slate-700 font-semibold transition-colors"
            >
              Close Panel
            </button>
          </div>
        </div>
      )}

      {/* Manual Task Add Modal */}
      {showAddTaskModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-lg rounded-2xl border border-slate-200 p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-bold text-slate-900">Add Task Manually</h3>
              <button onClick={() => setShowAddTaskModal(false)} className="p-1 text-slate-400 hover:text-slate-700">
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleAddTask} className="space-y-4">
              <div>
                <label className="block text-[10px] uppercase font-bold text-slate-500 mb-1">Task Title</label>
                <input
                  type="text"
                  required
                  value={newTaskTitle}
                  onChange={(e) => setNewTaskTitle(e.target.value)}
                  placeholder="e.g. Create Book Search API"
                  className="w-full p-2.5 rounded-xl bg-slate-50 border border-slate-300 text-slate-900 text-xs focus:outline-none focus:border-indigo-600 focus:bg-white"
                />
              </div>

              <div>
                <label className="block text-[10px] uppercase font-bold text-slate-500 mb-1">Module Name</label>
                <input
                  type="text"
                  required
                  value={newTaskModule}
                  onChange={(e) => setNewTaskModule(e.target.value)}
                  placeholder="e.g. Search Engine"
                  className="w-full p-2.5 rounded-xl bg-slate-50 border border-slate-300 text-slate-900 text-xs focus:outline-none focus:border-indigo-600 focus:bg-white"
                />
              </div>

              <div>
                <label className="block text-[10px] uppercase font-bold text-slate-500 mb-1">Description</label>
                <textarea
                  rows={2}
                  value={newTaskDesc}
                  onChange={(e) => setNewTaskDesc(e.target.value)}
                  placeholder="Explain details of the task..."
                  className="w-full p-2.5 rounded-xl bg-slate-50 border border-slate-300 text-slate-900 text-xs resize-none focus:outline-none focus:border-indigo-600 focus:bg-white"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] uppercase font-bold text-slate-500 mb-1">Priority</label>
                  <select
                    value={newTaskPriority}
                    onChange={(e) => setNewTaskPriority(e.target.value)}
                    className="w-full p-2.5 rounded-xl bg-slate-50 border border-slate-300 text-slate-900 text-xs focus:outline-none focus:border-indigo-600"
                  >
                    <option value="Low">Low</option>
                    <option value="Medium">Medium</option>
                    <option value="High">High</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] uppercase font-bold text-slate-500 mb-1">Complexity</label>
                  <select
                    value={newTaskComplexity}
                    onChange={(e) => setNewTaskComplexity(e.target.value)}
                    className="w-full p-2.5 rounded-xl bg-slate-50 border border-slate-300 text-slate-900 text-xs focus:outline-none focus:border-indigo-600"
                  >
                    <option value="Low">Low</option>
                    <option value="Medium">Medium</option>
                    <option value="High">High</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] uppercase font-bold text-slate-500 mb-1">Required Skills (comma-sep)</label>
                  <input
                    type="text"
                    value={newTaskSkills}
                    onChange={(e) => setNewTaskSkills(e.target.value)}
                    placeholder="React, Node.js"
                    className="w-full p-2.5 rounded-xl bg-slate-50 border border-slate-300 text-slate-900 text-xs focus:outline-none focus:border-indigo-600 focus:bg-white"
                  />
                </div>

                <div>
                  <label className="block text-[10px] uppercase font-bold text-slate-500 mb-1">Target Deadline</label>
                  <input
                    type="date"
                    value={newTaskDeadline}
                    onChange={(e) => setNewTaskDeadline(e.target.value)}
                    className="w-full p-2.5 rounded-xl bg-slate-50 border border-slate-300 text-slate-900 text-xs focus:outline-none focus:border-indigo-600 focus:bg-white"
                  />
                </div>
              </div>

              <button
                type="submit"
                className="w-full py-3 mt-4 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-xl shadow-sm"
              >
                Create Task
              </button>
            </form>
          </div>
        </div>
      )}



      {/* Disconnect Confirmation Modal */}
      {showDisconnectConfirmModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-white w-full max-w-md rounded-2xl border border-slate-200 p-6 space-y-4 shadow-2xl">
            <div className="flex items-start space-x-3">
              <div className="p-3 bg-rose-50 text-rose-600 rounded-xl">
                <AlertTriangle className="h-6 w-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">Disconnect Repository?</h3>
                <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                  Are you sure you want to disconnect <strong>{project.githubIntegration?.repositoryName || project.githubRepository?.name}</strong> from this project?
                </p>
                <p className="text-[11px] text-slate-400 mt-1">
                  GitHub webhooks and commit tracking will be detached. The GitHub repository itself will not be deleted or modified.
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end space-x-2 pt-2 border-t border-slate-100">
              <button
                onClick={() => setShowDisconnectConfirmModal(false)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleDisconnectRepo}
                disabled={disconnectingRepo}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold rounded-xl shadow-xs transition-colors disabled:opacity-50"
              >
                {disconnectingRepo ? 'Disconnecting...' : 'Yes, Disconnect Repository'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProjectDetail;
