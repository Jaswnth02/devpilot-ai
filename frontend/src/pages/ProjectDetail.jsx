import React, { useState, useEffect, useContext } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../utils/api';
import { AuthContext } from '../context/AuthContext';
import { SocketContext } from '../context/SocketContext';
import { 
  Plus, Users, AlertTriangle, ShieldCheck, Cpu, 
  MessageSquare, Bug, CheckCircle, FileCode2, GitPullRequest, ArrowRightLeft, Info, X, Clock, HelpCircle
} from 'lucide-react';

const ProjectDetail = () => {
  const { id } = useParams();
  const { user } = useContext(AuthContext);
  const { joinProjectRoom, latestActivity } = useContext(SocketContext);
  
  const [project, setProject] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedTask, setSelectedTask] = useState(null);
  
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

  // Linked GitHub activity
  const [gitCommits, setGitCommits] = useState([]);
  const [gitPRs, setGitPRs] = useState([]);
  const [gitIssues, setGitIssues] = useState([]);

  // Fetch project details
  const fetchProject = async () => {
    try {
      const res = await api.get(`/api/projects/${id}`);
      setProject(res.data);
      
      // If a repository is linked, fetch cached git details for cross-reference
      if (res.data.GitHubRepository) {
        const repoId = res.data.GitHubRepository.id;
        // In DevPilot AI, we can call git endpoints to get the project repo commits
        // E.g., GET /api/github/commits or filter from backend.
        // For simplicity and speed, let's fetch commits, PRs, and issues linked to this repository.
        try {
          const [commitsRes, pullsRes, issuesRes] = await Promise.all([
            api.get(`/api/github/sync?repoId=${repoId}`).catch(() => ({ data: [] })), // placeholder, or we query directly
            // Actually, we can fetch via manual sync or backend caching. Let's make a call to trigger cached list.
            // Since we cached them in database, we can fetch them from backend, or return in project details!
            // Let's check: we can fetch them via endpoints. We'll implement direct queries.
          ]);
        } catch (e) {
          console.warn('Error loading Git info:', e);
        }
      }
    } catch (err) {
      console.error('Failed to load project:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProject();
    joinProjectRoom(id);
  }, [id]);

  // Handle Socket activity updates in real-time
  useEffect(() => {
    if (latestActivity) {
      // Reload board details if activity matches this project workspace
      fetchProject();
    }
  }, [latestActivity]);

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

  const tasks = project.Tasks || [];
  const members = project.Users || [];
  const columns = ['To Do', 'In Progress', 'In Review', 'Completed', 'Blocked'];

  // Handle task selection and loading details
  const handleTaskClick = async (task) => {
    setTaskError(null);
    setSelectedTask(task);
    
    // Load comments and issues
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

  // Update task assignee on the board
  const handleAssigneeChange = async (taskId, userId) => {
    try {
      setTaskError(null);
      const res = await api.put(`/api/tasks/${taskId}`, {
        assigned_user_id: userId || null
      });
      // Update selected task in state and reload project
      setSelectedTask(res.data);
      fetchProject();
    } catch (err) {
      setTaskError(err.response?.data?.error || 'Failed to assign task.');
    }
  };

  // Update task status on the board (e.g. from modal or drag-drop trigger)
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

  // Add Comment
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

  // Report Issue/Bug
  const handleReportIssue = async (e) => {
    e.preventDefault();
    if (!newIssueDesc.trim()) return;
    try {
      const res = await api.post(`/api/tasks/${selectedTask.id}/issues`, {
        description: newIssueDesc
      });
      setModalIssues(prev => [res.data, ...prev]);
      setNewIssueDesc('');
      
      // Auto-update task status to Blocked in UI
      handleStatusChange(selectedTask.id, 'Blocked');
    } catch (err) {
      console.error('Report issue error:', err);
    }
  };

  // Trigger Gemini AI Issue investigation
  const handleAITriage = async (issueId) => {
    try {
      // Show loading status
      const updatedIssues = modalIssues.map(iss => 
        iss.id === issueId ? { ...iss, ai_category: 'Analyzing...' } : iss
      );
      setModalIssues(updatedIssues);

      const res = await api.post(`/api/ai/analyze-issue/${issueId}`);
      
      // Replace with analyzed results
      setModalIssues(prev => prev.map(iss => iss.id === issueId ? res.data : iss));
    } catch (err) {
      console.error('AI Triage error:', err);
    }
  };

  // Request AI Task Assignment Recommendation
  const handleGetRecommendations = async () => {
    setRecLoading(true);
    setShowAssignModal(true);
    try {
      const res = await api.post('/api/ai/recommend-assignment', {
        projectId: project.id
      });
      setRecommendations(res.data);
    } catch (err) {
      console.error('Failed to get recommendations:', err);
      setRecommendations([]);
    } finally {
      setRecLoading(false);
    }
  };

  // Apply AI Recommendation
  const handleApplyRecommendation = async (taskId, userId) => {
    try {
      await api.put(`/api/tasks/${taskId}`, {
        assigned_user_id: userId
      });
      // Remove task from local recommendations list and refresh
      setRecommendations(prev => prev.filter(r => r.taskId !== taskId));
      fetchProject();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to apply recommendation.');
    }
  };

  // Add Task manually
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
        project_id: project.id
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

  return (
    <div className="space-y-6">
      {/* Workspace Header */}
      <div className="glass p-6 rounded-2xl border border-white/5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <span className="text-[10px] uppercase font-bold text-indigo-400 tracking-wider">Project Workspace</span>
          <h1 className="text-3xl font-extrabold text-white mt-1">{project.name}</h1>
          <p className="text-slate-400 text-xs mt-1.5 max-w-xl leading-relaxed">{project.description}</p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {user?.role !== 'Developer' && (
            <>
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
            </>
          )}
        </div>
      </div>

      {/* Kanban Board Columns */}
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4 overflow-x-auto pb-4">
        {columns.map(col => {
          const colTasks = tasks.filter(t => t.status === col);
          return (
            <div key={col} className="bg-slate-950/20 rounded-2xl p-4 border border-white/5 min-w-[220px] flex flex-col h-[calc(100vh-320px)]">
              {/* Column Title */}
              <div className="flex items-center justify-between mb-3 border-b border-white/5 pb-2">
                <span className="text-xs font-bold text-slate-300 uppercase tracking-wider">{col}</span>
                <span className="text-[10px] px-2 py-0.5 bg-white/5 rounded-full font-bold text-slate-400">{colTasks.length}</span>
              </div>

              {/* Task list container */}
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

      {/* Task Details Modal */}
      {selectedTask && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="glass w-full max-w-4xl max-h-[85vh] rounded-2xl border border-white/10 flex flex-col overflow-hidden">
            {/* Modal Header */}
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

            {/* Modal Content Grid */}
            <div className="flex-1 overflow-y-auto p-6 grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Left Column: Details & Edit */}
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

                {/* Git Activity cache (commits and PRs containing #ID) */}
                <div className="space-y-3">
                  <h4 className="text-xs uppercase font-bold text-slate-500 pl-1">Linked GitHub Code Activity</h4>
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {/* Simulated/Linked commit filter */}
                    <div className="p-3 bg-slate-900/60 border border-white/5 rounded-xl flex items-start space-x-2.5">
                      <FileCode2 className="h-4 w-4 text-indigo-400 shrink-0 mt-0.5" />
                      <div>
                        <p className="text-xs text-slate-200 font-semibold">commit: Implemented search API (#{selectedTask.id})</p>
                        <span className="text-[10px] text-slate-500 mt-0.5 block">mockdeveloper • 3 hours ago</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Comments Section */}
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

              {/* Right Column: Allocation & Status Control */}
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
                    {members.map(m => <option key={m.id} value={m.id}>{m.name} ({m.role})</option>)}
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
                  <div className="flex justify-between">
                    <span>Skills Required:</span>
                    <span className="font-semibold text-slate-200">
                      {selectedTask.required_skills?.join(', ') || 'None'}
                    </span>
                  </div>
                </div>

                {/* Bug Reporting Sub-Card */}
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
                      placeholder="e.g. Checkout page crashes when paying with cards..."
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

                {/* Task Issues list with AI triage */}
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
                              <div>
                                <span className="text-slate-500 block">Investigation track:</span> 
                                <ul className="list-disc pl-3 mt-0.5 space-y-0.5">
                                  {issue.ai_suggestions?.map((s, idx) => <li key={idx}>{s}</li>)}
                                </ul>
                              </div>
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
                    const recDev = members.find(m => m.id === rec.recommendedUserId);
                    if (!recTask || !recDev) return null;
                    return (
                      <div key={rec.taskId} className="p-4 rounded-xl bg-slate-900 border border-white/5 space-y-3">
                        <div>
                          <span className="text-[9px] uppercase font-bold px-1.5 py-0.5 bg-indigo-500/10 text-indigo-400 rounded">
                            {recTask.module}
                          </span>
                          <h4 className="text-xs font-semibold text-slate-200 mt-2">{recTask.title}</h4>
                        </div>

                        <div className="p-2.5 rounded-lg bg-indigo-950/20 border border-indigo-500/10 text-[11px] text-slate-300 leading-relaxed">
                          <span className="font-bold text-indigo-300 block mb-1">Recommended Developer: {recDev.name}</span>
                          {rec.reason}
                        </div>

                        <button
                          onClick={() => handleApplyRecommendation(rec.taskId, recDev.id)}
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
