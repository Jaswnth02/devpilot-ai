import React, { useState, useEffect, useContext } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../utils/api';
import { AuthContext } from '../context/AuthContext';
import { SocketContext } from '../context/SocketContext';
import { 
  Plus, Users, AlertTriangle, ShieldCheck, Cpu, 
  MessageSquare, Bug, CheckCircle, FileCode2, GitPullRequest, ArrowRightLeft, Info, X, Clock, HelpCircle,
  FileText, FileArchive, Image, File, Download, Trash2, Upload, KeyRound, Copy, Check, UserCheck, UserX, Lock, Sparkles, Radio
} from 'lucide-react';

const ProjectDetail = () => {
  const { id } = useParams();
  const { user } = useContext(AuthContext);
  const { joinProjectRoom, latestActivity } = useContext(SocketContext);
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

  // Project Files & Team Tabs
  const [activeTab, setActiveTab] = useState('board'); // 'board' | 'team' | 'files'
  const [files, setFiles] = useState([]);
  const [fileUploading, setFileUploading] = useState(false);
  const [fileError, setFileError] = useState(null);

  // Pending requests and members state
  const [pendingRequests, setPendingRequests] = useState([]);
  const [actionLoading, setActionLoading] = useState(null);
  const [teamNotice, setTeamNotice] = useState(null);

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

  // Listen for socket events
  const { socket } = useContext(SocketContext);
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
    
    try {
      const [commentsRes, issuesRes] = await Promise.all([
        api.get(`/api/tasks/${task.id}/comments`),
        api.get(`/api/tasks/${task.id}/issues`)
      ]);
      setModalComments(commentsRes.data);
      setModalIssues(issuesRes.data);
    } catch (err) {
      console.error('Failed to load comments/issues:', err);
    }
  };

  const handleAssigneeChange = async (taskId, userId) => {
    try {
      setTaskError(null);
      const res = await api.put(`/api/tasks/${taskId}`, {
        assigned_user_id: userId || null
      });
      setSelectedTask(res.data);
      fetchProject();
    } catch (err) {
      setTaskError(err.response?.data?.error || 'Failed to assign task.');
    }
  };

  const handleStatusChange = async (taskId, newStatus) => {
    try {
      setTaskError(null);
      const res = await api.put(`/api/tasks/${taskId}`, {
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
    try {
      const res = await api.post(`/api/tasks/${selectedTask.id}/comments`, {
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
    try {
      const res = await api.post(`/api/tasks/${selectedTask.id}/issues`, {
        description: newIssueDesc
      });
      setModalIssues(prev => [res.data, ...prev]);
      setNewIssueDesc('');
      handleStatusChange(selectedTask.id, 'Blocked');
    } catch (err) {
      console.error('Report issue error:', err);
    }
  };

  const handleAITriage = async (issueId) => {
    try {
      const updatedIssues = modalIssues.map(iss => 
        iss.id === issueId ? { ...iss, ai_category: 'Analyzing...' } : iss
      );
      setModalIssues(updatedIssues);

      const res = await api.post(`/api/ai/analyze-issue/${issueId}`);
      setModalIssues(prev => prev.map(iss => iss.id === issueId ? res.data : iss));
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
      <div className="glass p-6 rounded-2xl border border-white/5 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
        <div>
          <div className="flex items-center space-x-3 flex-wrap gap-y-2">
            <span className="text-[10px] uppercase font-bold text-indigo-400 tracking-wider">Project Workspace</span>
            
            {/* Prominent Project Code Display */}
            {project.projectCode && (
              <div className="flex items-center space-x-2 bg-indigo-500/10 border border-indigo-500/20 px-3 py-1 rounded-xl">
                <KeyRound className="h-3.5 w-3.5 text-indigo-400" />
                <span className="text-xs text-slate-400">Project Code:</span>
                <strong className="text-xs font-mono font-bold text-indigo-300 tracking-wider">{project.projectCode}</strong>
                <button
                  type="button"
                  onClick={handleCopyCode}
                  title="Copy Project Code"
                  className="p-1 hover:bg-indigo-500/20 text-indigo-400 rounded-md transition-colors"
                >
                  {copiedCode ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                </button>
              </div>
            )}
          </div>

          <h1 className="text-3xl font-extrabold text-white mt-2">{project.name}</h1>
          <p className="text-slate-400 text-xs mt-1.5 max-w-xl leading-relaxed">{project.description}</p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* AI Plan Button with Strict Owner Authorization */}
          {isOwner ? (
            <button
              onClick={handleGeneratePlanClick}
              className="px-4 py-2.5 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 font-semibold text-xs text-white rounded-xl shadow-lg shadow-indigo-600/25 flex items-center space-x-2 transition-all active:scale-[0.98]"
            >
              <Cpu className="h-4 w-4" />
              <span>Generate AI Development Plan</span>
            </button>
          ) : (
            <div className="p-3 rounded-xl bg-slate-900/80 border border-white/10 flex items-center space-x-2 text-slate-400 text-xs" title="Only project owner can generate plan">
              <Lock className="h-4 w-4 text-amber-400 shrink-0" />
              <span>Only the project owner can generate the development plan.</span>
            </div>
          )}

          <button
            onClick={handleGetRecommendations}
            className="px-4 py-2.5 bg-indigo-600/20 hover:bg-indigo-600/30 border border-indigo-500/20 text-indigo-300 text-xs font-semibold rounded-xl flex items-center space-x-2 transition-colors"
          >
            <Cpu className="h-4 w-4" />
            <span>Recommend Assignments</span>
          </button>

          <button
            onClick={() => setShowAddTaskModal(true)}
            className="px-4 py-2.5 bg-white/5 hover:bg-white/10 border border-white/5 text-slate-300 text-xs font-semibold rounded-xl flex items-center space-x-2 transition-colors"
          >
            <Plus className="h-4 w-4" />
            <span>Add Task</span>
          </button>
        </div>
      </div>

      {/* Tab Selector */}
      <div className="flex items-center space-x-6 border-b border-white/5 pb-2">
        <button
          onClick={() => setActiveTab('board')}
          className={`pb-2 text-sm font-bold uppercase tracking-wider transition-all relative ${
            activeTab === 'board' 
              ? 'text-indigo-400 font-extrabold' 
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          Kanban Board
          {activeTab === 'board' && (
            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-indigo-500 rounded-full"></div>
          )}
        </button>

        <button
          onClick={() => setActiveTab('team')}
          className={`pb-2 text-sm font-bold uppercase tracking-wider transition-all relative flex items-center space-x-2 ${
            activeTab === 'team' 
              ? 'text-indigo-400 font-extrabold' 
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <span>Allocate Team Members</span>
          {pendingRequests.length > 0 ? (
            <span className="px-2 py-0.5 bg-amber-500 text-slate-950 font-extrabold text-[10px] rounded-full animate-pulse">
              {pendingRequests.length} Waiting
            </span>
          ) : (
            <span className="h-2 w-2 rounded-full bg-emerald-500 animate-ping" title="Live queue active"></span>
          )}
          {activeTab === 'team' && (
            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-indigo-500 rounded-full"></div>
          )}
        </button>

        <button
          onClick={() => setActiveTab('files')}
          className={`pb-2 text-sm font-bold uppercase tracking-wider transition-all relative ${
            activeTab === 'files' 
              ? 'text-indigo-400 font-extrabold' 
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          Project Files ({files.length})
          {activeTab === 'files' && (
            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-indigo-500 rounded-full"></div>
          )}
        </button>
      </div>

      {activeTab === 'board' ? (
        /* Kanban Board Columns */
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4 overflow-x-auto pb-4">
          {columns.map(col => {
            const colTasks = tasks.filter(t => t.status === col);
            return (
              <div key={col} className="bg-slate-950/20 rounded-2xl p-4 border border-white/5 min-w-[220px] flex flex-col h-[calc(100vh-320px)]">
                <div className="flex items-center justify-between mb-3 border-b border-white/5 pb-2">
                  <span className="text-xs font-bold text-slate-300 uppercase tracking-wider">{col}</span>
                  <span className="text-[10px] px-2 py-0.5 bg-white/5 rounded-full font-bold text-slate-400">{colTasks.length}</span>
                </div>

                <div className="flex-1 space-y-3 overflow-y-auto pr-1">
                  {colTasks.map(task => (
                    <div
                      key={task.id}
                      onClick={() => handleTaskClick(task)}
                      className="p-4 rounded-xl bg-slate-900/60 border border-white/5 hover:border-white/10 transition-all hover:bg-slate-900 cursor-pointer shadow-sm shadow-black/10 hover:shadow-md"
                    >
                      <span className="text-[9px] uppercase font-bold px-1.5 py-0.5 bg-indigo-500/10 text-indigo-400 border border-indigo-500/5 rounded">
                        {task.module}
                      </span>
                      <h4 className="text-xs font-semibold text-slate-200 mt-2 line-clamp-1">{task.title}</h4>
                      <p className="text-[11px] text-slate-400 mt-1 line-clamp-2 leading-relaxed">{task.description}</p>
                      
                      <div className="flex items-center justify-between mt-3 pt-2.5 border-t border-white/5">
                        <div className="flex items-center space-x-1.5">
                          <span className={`h-1.5 w-1.5 rounded-full ${
                            task.priority === 'High' ? 'bg-rose-500' :
                            task.priority === 'Medium' ? 'bg-amber-500' : 'bg-slate-500'
                          }`}></span>
                          <span className="text-[9px] text-slate-500 font-bold uppercase">{task.priority}</span>
                        </div>
                        
                        {task.Assignee ? (
                          <div className="h-5 w-5 rounded-full bg-indigo-600 text-white font-bold text-[9px] flex items-center justify-center" title={task.Assignee.name}>
                            {task.Assignee.name.charAt(0)}
                          </div>
                        ) : (
                          <span className="text-[9px] text-slate-600 font-medium">Unassigned</span>
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
              teamNotice.type === 'success' ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-300' : 'bg-rose-500/15 border-rose-500/30 text-rose-300'
            }`}>
              <Info className="h-4 w-4 shrink-0" />
              <span className="font-semibold">{teamNotice.message}</span>
            </div>
          )}

          {/* Section 1: Waiting for Members (Live WebSockets Queue) */}
          <div className="glass p-6 rounded-2xl border border-white/5 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-white/5 pb-3 gap-2">
              <div className="flex items-center space-x-2">
                <Users className="h-5 w-5 text-amber-400" />
                <h3 className="text-base font-bold text-slate-200">Waiting for Members</h3>
              </div>

              {/* Live WebSockets Status Badge */}
              <div className="flex items-center space-x-2 px-3 py-1 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-full text-xs font-semibold">
                <Radio className="h-3.5 w-3.5 text-emerald-400 animate-pulse" />
                <span>Live Socket • Waiting for users entering code <strong className="font-mono text-emerald-300">{project.projectCode}</strong></span>
              </div>
            </div>

            {pendingRequests.length === 0 ? (
              <div className="py-8 text-center space-y-3 bg-slate-950/20 rounded-xl border border-white/5">
                <div className="relative flex items-center justify-center">
                  <div className="animate-ping absolute inline-flex h-10 w-10 rounded-full bg-emerald-500 opacity-20"></div>
                  <div className="h-8 w-8 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
                    <Radio className="h-4 w-4" />
                  </div>
                </div>
                <div>
                  <h4 className="text-sm font-bold text-slate-200">Waiting for team members to enter code...</h4>
                  <p className="text-xs text-slate-400 mt-1 max-w-md mx-auto">
                    Share Project Code <strong className="text-indigo-300 font-mono tracking-wider">{project.projectCode}</strong> with your team. When they enter it, their profiles will instantly pop up live right here for approval!
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
                      className="p-4 rounded-xl bg-slate-900/80 border border-amber-500/30 flex items-center justify-between gap-3 shadow-lg shadow-amber-950/10 animate-fadeIn relative overflow-hidden"
                    >
                      <div className="absolute top-0 left-0 w-1 h-full bg-amber-500"></div>

                      <div className="pl-2">
                        <div className="flex items-center space-x-2">
                          <p className="text-sm font-bold text-white">{reqUser.fullName || reqUser.name || 'Unknown User'}</p>
                          <span className="text-[9px] font-extrabold uppercase px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
                            Waiting Approval
                          </span>
                        </div>
                        <p className="text-xs text-slate-400">{reqUser.email}</p>
                        <div className="mt-1 flex items-center space-x-2">
                          <span className="text-[10px] font-semibold text-indigo-300 px-2 py-0.5 rounded bg-indigo-500/10">
                            {reqUser.workspaceRole || reqUser.role || 'Developer'}
                          </span>
                          <span className="text-[10px] text-slate-400">
                            {reqUser.experienceLevel || reqUser.experience_level || 'Mid'}
                          </span>
                        </div>
                      </div>

                      {isOwner ? (
                        <div className="flex items-center space-x-2">
                          <button
                            onClick={() => handleRespondRequest(reqItem.id || reqItem.requestId, 'accept')}
                            disabled={isPendingLoading}
                            className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold rounded-lg flex items-center space-x-1 shadow-md shadow-emerald-950/20 transition-all active:scale-[0.98]"
                          >
                            <UserCheck className="h-3.5 w-3.5" />
                            <span>Accept</span>
                          </button>
                          <button
                            onClick={() => handleRespondRequest(reqItem.id || reqItem.requestId, 'reject')}
                            disabled={isPendingLoading}
                            className="px-3 py-2 bg-rose-600/20 hover:bg-rose-600/30 text-rose-300 border border-rose-500/20 text-xs font-semibold rounded-lg flex items-center space-x-1 transition-all"
                          >
                            <UserX className="h-3.5 w-3.5" />
                            <span>Reject</span>
                          </button>
                        </div>
                      ) : (
                        <span className="text-xs text-amber-400 italic">Pending Owner Review</span>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Section 2: Project Team */}
          <div className="glass p-6 rounded-2xl border border-white/5 space-y-4">
            <div className="flex items-center justify-between border-b border-white/5 pb-3">
              <div className="flex items-center space-x-2">
                <ShieldCheck className="h-5 w-5 text-indigo-400" />
                <h3 className="text-base font-bold text-slate-200">Project Team</h3>
              </div>
              <span className="text-xs text-slate-400">
                Total Members: <strong className="text-indigo-400">{members.length}</strong>
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {members.map(m => {
                const uObj = m.userId || {};
                const mUserIdStr = uObj._id || uObj.id || uObj;
                const isMemberOwner = mUserIdStr.toString() === ownerIdStr.toString() || m.projectRole === 'Project Owner';

                return (
                  <div key={mUserIdStr.toString()} className="p-4 rounded-xl bg-slate-900/60 border border-white/5 flex items-center justify-between gap-3">
                    <div>
                      <div className="flex items-center space-x-2">
                        <p className="text-sm font-bold text-white">{uObj.fullName || uObj.name || 'Project Member'}</p>
                        {isMemberOwner && (
                          <span className="text-[9px] font-extrabold uppercase px-1.5 py-0.5 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                            Owner
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-400 mt-0.5">{uObj.email}</p>
                      <span className="text-[10px] text-slate-400 block mt-1">
                        Role: <strong className="text-slate-300">{m.projectRole || uObj.workspaceRole || 'Developer'}</strong>
                      </span>
                    </div>

                    {isOwner && !isMemberOwner && (
                      <button
                        onClick={() => handleRemoveMember(mUserIdStr)}
                        disabled={actionLoading === mUserIdStr}
                        className="px-2.5 py-1.5 bg-rose-600/15 hover:bg-rose-600/30 text-rose-300 border border-rose-500/15 text-xs font-semibold rounded-lg transition-colors"
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
      ) : (
        /* Project Files Panel */
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="glass p-6 rounded-2xl border border-white/5 h-fit space-y-4">
            <h3 className="text-base font-bold text-slate-200">Upload Project File</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Add sprint plans, project requirement specifications, or database schema designs to keep your team aligned. Max file size: 20MB.
            </p>
            
            <div className="relative border-2 border-dashed border-white/10 hover:border-indigo-500/50 rounded-2xl p-6 transition-all bg-slate-950/20 text-center group cursor-pointer">
              <input
                type="file"
                onChange={handleFileUpload}
                disabled={fileUploading}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              />
              <div className="space-y-2.5">
                <div className="h-10 w-10 bg-indigo-500/10 text-indigo-400 border border-indigo-500/10 rounded-full flex items-center justify-center mx-auto group-hover:scale-110 transition-transform">
                  {fileUploading ? (
                    <div className="animate-spin rounded-full h-5 w-5 border-t-2 border-indigo-500"></div>
                  ) : (
                    <Upload className="h-5 w-5" />
                  )}
                </div>
                <div>
                  <p className="text-xs font-semibold text-slate-300">
                    {fileUploading ? 'Uploading file...' : 'Click to select or drag file here'}
                  </p>
                  <p className="text-[10px] text-slate-500 mt-1">PDF, Excel, Word, Images, Zip, or Code</p>
                </div>
              </div>
            </div>

            {fileError && (
              <div className="p-3 bg-rose-500/10 border border-rose-500/20 text-rose-300 text-[11px] rounded-xl flex items-center space-x-2">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                <span>{fileError}</span>
              </div>
            )}
          </div>

          <div className="lg:col-span-2 glass p-6 rounded-2xl border border-white/5 space-y-4">
            <div className="flex items-center justify-between border-b border-white/5 pb-3">
              <h3 className="text-base font-bold text-slate-200">Files Registry</h3>
              <span className="text-xs text-slate-400">{files.length} active attachments</span>
            </div>

            {files.length === 0 ? (
              <div className="py-16 text-center space-y-2">
                <File className="h-10 w-10 text-slate-600 mx-auto" />
                <p className="text-xs text-slate-400">No project files have been uploaded yet.</p>
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
                      className="p-4 rounded-xl bg-slate-900/40 border border-white/5 hover:border-white/10 transition-colors flex items-center justify-between gap-4"
                    >
                      <div className="flex items-center space-x-3.5 min-w-0">
                        <div className="h-10 w-10 bg-indigo-500/10 text-indigo-400 border border-indigo-500/5 rounded-xl flex items-center justify-center shrink-0">
                          <FileIcon className="h-5 w-5" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-semibold text-slate-200 truncate" title={file.original_name}>
                            {file.original_name}
                          </p>
                          <div className="flex items-center space-x-2 text-[10px] text-slate-500 mt-1 flex-wrap gap-y-1">
                            <span className="bg-white/5 px-1.5 py-0.5 rounded text-[9px] font-bold text-slate-400 shrink-0">
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
                          className="p-2 bg-indigo-600/15 hover:bg-indigo-600/30 text-indigo-300 rounded-lg transition-colors border border-indigo-500/10"
                        >
                          <Download className="h-4 w-4" />
                        </button>
                        {canDelete && (
                          <button
                            onClick={() => handleFileDelete(file.id)}
                            title="Delete File"
                            className="p-2 bg-rose-600/15 hover:bg-rose-600/30 text-rose-300 rounded-lg transition-colors border border-rose-500/10"
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
      )}

      {/* Task Details Modal */}
      {selectedTask && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="glass w-full max-w-4xl max-h-[85vh] rounded-2xl border border-white/10 flex flex-col overflow-hidden">
            <div className="p-5 border-b border-white/5 flex items-center justify-between">
              <div>
                <span className="text-[10px] uppercase font-bold text-indigo-400">{selectedTask.module}</span>
                <h3 className="text-lg font-bold text-slate-200 mt-1">Task #{selectedTask.id}: {selectedTask.title}</h3>
              </div>
              <button 
                onClick={() => setSelectedTask(null)}
                className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-white/5 rounded-lg transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="md:col-span-2 space-y-5">
                {taskError && (
                  <div className="p-3.5 bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs rounded-xl flex items-center space-x-2">
                    <AlertTriangle className="h-4 w-4 shrink-0" />
                    <span>{taskError}</span>
                  </div>
                )}

                <div>
                  <h4 className="text-xs uppercase font-bold text-slate-500 pl-1 mb-1.5">Description</h4>
                  <p className="text-xs text-slate-300 bg-white/5 border border-white/5 rounded-xl p-3.5 leading-relaxed">
                    {selectedTask.description || 'No description provided.'}
                  </p>
                </div>

                <div className="space-y-3">
                  <h4 className="text-xs uppercase font-bold text-slate-500 pl-1">Linked GitHub Code Activity</h4>
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    <div className="p-3 bg-slate-900/60 border border-white/5 rounded-xl flex items-start space-x-2.5">
                      <FileCode2 className="h-4 w-4 text-indigo-400 shrink-0 mt-0.5" />
                      <div>
                        <p className="text-xs text-slate-200 font-semibold">commit: Implemented module task (#{selectedTask.id})</p>
                        <span className="text-[10px] text-slate-500 mt-0.5 block">developer • 3 hours ago</span>
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
                      className="flex-1 p-2 rounded-lg glass-input text-xs"
                    />
                    <button 
                      type="submit" 
                      className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-xs text-white font-semibold rounded-lg"
                    >
                      Comment
                    </button>
                  </form>

                  <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                    {modalComments.map(c => (
                      <div key={c.id} className="p-2.5 bg-white/5 rounded-lg border border-white/5">
                        <div className="flex items-center justify-between text-[10px] text-slate-400 mb-1">
                          <span className="font-semibold text-indigo-300">{c.User?.name}</span>
                          <span>{new Date(c.createdAt).toLocaleDateString()}</span>
                        </div>
                        <p className="text-xs text-slate-300">{c.content}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="space-y-5 bg-white/5 border border-white/5 rounded-2xl p-4 h-fit">
                <div>
                  <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1">Task Status</label>
                  <select
                    value={selectedTask.status}
                    onChange={(e) => handleStatusChange(selectedTask.id, e.target.value)}
                    className="w-full p-2.5 rounded-xl glass-input text-xs"
                  >
                    {columns.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1">Assigned Developer</label>
                  <select
                    value={selectedTask.assigned_user_id || ''}
                    onChange={(e) => handleAssigneeChange(selectedTask.id, e.target.value)}
                    className="w-full p-2.5 rounded-xl glass-input text-xs"
                  >
                    <option value="">Unassigned</option>
                    {members.map(m => {
                      const u = m.userId || {};
                      return <option key={u._id || u.id} value={u._id || u.id}>{u.fullName || u.name} ({m.projectRole})</option>;
                    })}
                  </select>
                </div>

                <div className="border-t border-white/5 pt-3 space-y-2 text-[10px] text-slate-400">
                  <div className="flex justify-between">
                    <span>Priority:</span>
                    <span className="font-semibold text-slate-200">{selectedTask.priority}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Complexity:</span>
                    <span className="font-semibold text-slate-200">{selectedTask.complexity}</span>
                  </div>
                </div>

                <div className="border-t border-white/5 pt-4">
                  <div className="flex items-center space-x-1 text-rose-400 mb-2">
                    <Bug className="h-4.5 w-4.5" />
                    <span className="text-[11px] font-bold uppercase tracking-wider">Report Task Issue</span>
                  </div>
                  <form onSubmit={handleReportIssue} className="space-y-2">
                    <textarea
                      rows={2}
                      value={newIssueDesc}
                      onChange={(e) => setNewIssueDesc(e.target.value)}
                      placeholder="e.g. Page crashes when loading dataset..."
                      className="w-full p-2 rounded-lg glass-input text-xs resize-none"
                    />
                    <button
                      type="submit"
                      className="w-full py-2 bg-rose-600/20 hover:bg-rose-600/30 border border-rose-500/20 text-rose-300 text-xs font-semibold rounded-lg transition-colors"
                    >
                      Block Task & Report Bug
                    </button>
                  </form>
                </div>

                {modalIssues.length > 0 && (
                  <div className="border-t border-white/5 pt-4 space-y-3">
                    <h4 className="text-[10px] uppercase font-bold text-slate-400">Active Task Issues</h4>
                    <div className="space-y-2.5 max-h-40 overflow-y-auto">
                      {modalIssues.map(issue => (
                        <div key={issue.id} className="p-2.5 bg-rose-950/15 border border-rose-500/20 rounded-xl space-y-2">
                          <p className="text-xs text-rose-200 leading-relaxed font-medium">{issue.description}</p>
                          
                          {issue.ai_category ? (
                            <div className="p-2 rounded bg-slate-900/80 border border-white/5 text-[9px] space-y-1 text-slate-400">
                              <span className="font-bold text-indigo-400 block">AI Analysis:</span>
                              <div><span className="text-slate-500">Category:</span> {issue.ai_category}</div>
                              <div><span className="text-slate-500">Priority:</span> {issue.ai_priority}</div>
                            </div>
                          ) : (
                            <button
                              onClick={() => handleAITriage(issue.id)}
                              className="px-2 py-1 bg-indigo-600/20 hover:bg-indigo-600/30 border border-indigo-500/20 text-indigo-300 text-[10px] font-bold rounded-lg transition-colors flex items-center space-x-1"
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
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-end">
          <div className="glass w-full max-w-md h-screen p-6 border-l border-white/10 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center space-x-2 text-indigo-400">
                  <Cpu className="h-6 w-6 animate-pulse" />
                  <h3 className="text-lg font-bold text-slate-200">AI Task Recommender</h3>
                </div>
                <button onClick={() => setShowAssignModal(false)} className="p-1 text-slate-400 hover:text-slate-200">
                  <X className="h-5 w-5" />
                </button>
              </div>

              {recLoading ? (
                <div className="py-20 text-center space-y-3">
                  <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-indigo-500 mx-auto"></div>
                  <p className="text-xs text-slate-400">Running workload balancing algorithms...</p>
                </div>
              ) : recommendations.length === 0 ? (
                <div className="p-4 bg-white/5 border border-white/5 rounded-xl text-center text-xs text-slate-400">
                  No pending tasks requiring assignment recommendations.
                </div>
              ) : (
                <div className="space-y-4 max-h-[75vh] overflow-y-auto pr-1">
                  {recommendations.map(rec => {
                    const recTask = tasks.find(t => t.id === rec.taskId);
                    const recDev = members.find(m => (m.userId?._id || m.userId?.id || m.userId) === rec.recommendedUserId);
                    if (!recTask) return null;
                    return (
                      <div key={rec.taskId} className="p-4 rounded-xl bg-slate-900 border border-white/5 space-y-3">
                        <div>
                          <span className="text-[9px] uppercase font-bold px-1.5 py-0.5 bg-indigo-500/10 text-indigo-400 rounded">
                            {recTask.module}
                          </span>
                          <h4 className="text-xs font-semibold text-slate-200 mt-2">{recTask.title}</h4>
                        </div>

                        <div className="p-2.5 rounded-lg bg-indigo-950/20 border border-indigo-500/10 text-[11px] text-slate-300 leading-relaxed">
                          <span className="font-bold text-indigo-300 block mb-1">Recommended Developer: {recDev?.userId?.fullName || recDev?.userId?.name || 'Developer'}</span>
                          {rec.reason}
                        </div>

                        <button
                          onClick={() => handleApplyRecommendation(rec.taskId, recDev?.userId?._id || recDev?.userId?.id)}
                          className="w-full py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-[10px] font-bold rounded-lg transition-colors flex items-center justify-center space-x-1"
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
              className="w-full py-3 bg-white/5 hover:bg-white/10 rounded-xl text-xs text-slate-300 font-semibold"
            >
              Close Panel
            </button>
          </div>
        </div>
      )}

      {/* Manual Task Add Modal */}
      {showAddTaskModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="glass w-full max-w-lg rounded-2xl border border-white/10 p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-white/5 pb-3">
              <h3 className="text-base font-bold text-slate-200">Add Task Manually</h3>
              <button onClick={() => setShowAddTaskModal(false)} className="p-1 text-slate-400 hover:text-slate-200">
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
                  className="w-full p-2.5 rounded-xl glass-input text-xs"
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
                  className="w-full p-2.5 rounded-xl glass-input text-xs"
                />
              </div>

              <div>
                <label className="block text-[10px] uppercase font-bold text-slate-500 mb-1">Description</label>
                <textarea
                  rows={2}
                  value={newTaskDesc}
                  onChange={(e) => setNewTaskDesc(e.target.value)}
                  placeholder="Explain details of the task..."
                  className="w-full p-2.5 rounded-xl glass-input text-xs resize-none"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] uppercase font-bold text-slate-500 mb-1">Priority</label>
                  <select
                    value={newTaskPriority}
                    onChange={(e) => setNewTaskPriority(e.target.value)}
                    className="w-full p-2.5 rounded-xl glass-input text-xs"
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
                    className="w-full p-2.5 rounded-xl glass-input text-xs"
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
                    className="w-full p-2.5 rounded-xl glass-input text-xs"
                  />
                </div>

                <div>
                  <label className="block text-[10px] uppercase font-bold text-slate-500 mb-1">Target Deadline</label>
                  <input
                    type="date"
                    value={newTaskDeadline}
                    onChange={(e) => setNewTaskDeadline(e.target.value)}
                    className="w-full p-2.5 rounded-xl glass-input text-xs"
                  />
                </div>
              </div>

              <button
                type="submit"
                className="w-full py-3 mt-4 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded-xl"
              >
                Create Task
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProjectDetail;
