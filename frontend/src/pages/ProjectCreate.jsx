import React, { useState, useEffect, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../utils/api';
import { SocketContext } from '../context/SocketContext';
import { Users, Cpu, Calendar, Code, KeyRound, Copy, Check, Radio, UserCheck, Mail, Sparkles, Github, FolderGit2 } from 'lucide-react';

const ProjectCreate = () => {
  const { socket } = useContext(SocketContext);
  const navigate = useNavigate();

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [techStack, setTechStack] = useState('React, Node.js, Express, MongoDB');
  const [deadline, setDeadline] = useState('');
  const [projectCode, setProjectCode] = useState('');
  const [copiedCode, setCopiedCode] = useState(false);
  
  // Real-time live team allocation state
  const [liveMembersQueue, setLiveMembersQueue] = useState([]);
  const [selectedMemberIds, setSelectedMemberIds] = useState([]);

  // GitHub Repositories for initial linkage
  const [availableRepos, setAvailableRepos] = useState([]);
  const [selectedRepoId, setSelectedRepoId] = useState('');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // 1. Fetch pre-generated unique Project Code & GitHub Repos on page mount
  useEffect(() => {
    const fetchCode = async () => {
      try {
        const res = await api.get('/api/projects/generate-code');
        if (res.data.projectCode) {
          setProjectCode(res.data.projectCode);
        }
      } catch (err) {
        console.error('Failed to generate project code:', err);
      }
    };

    const fetchRepos = async () => {
      try {
        const res = await api.get('/api/github/repos');
        setAvailableRepos(res.data?.repositories || []);
      } catch (err) {
        console.warn('GitHub repos not loaded for project create:', err.message);
      }
    };

    fetchCode();
    fetchRepos();
  }, []);

  // Handle repository selection to auto-fill form
  const handleSelectRepo = (e) => {
    const repoId = e.target.value;
    setSelectedRepoId(repoId);
    if (!repoId) return;

    const chosen = availableRepos.find(r => String(r.id) === String(repoId));
    if (chosen) {
      if (!name) setName(chosen.name);
      if (!description && chosen.description) setDescription(chosen.description);
      if (chosen.language) {
        setTechStack(`${chosen.language}, Node.js, Express`);
      }
    }
  };

  // 2. Join Socket code room & listen for live incoming join requests
  useEffect(() => {
    if (!socket || !projectCode) return;

    socket.emit('join_code_room', projectCode);

    const handleLiveJoinRequest = (data) => {
      if (data.projectCode === projectCode) {
        const userObj = data.user || {};
        const userId = data.userId || userObj._id || userObj.id;

        setLiveMembersQueue(prev => {
          if (prev.some(m => (m.userId || m.id) === userId)) return prev;
          return [{
            id: userId,
            userId,
            fullName: userObj.fullName || userObj.name,
            name: userObj.name || userObj.fullName,
            email: userObj.email,
            workspaceRole: userObj.workspaceRole || userObj.role || 'Developer',
            experienceLevel: userObj.experienceLevel || userObj.experience_level || 'Mid',
            skills: userObj.skills || []
          }, ...prev];
        });

        // Auto-select user by default
        setSelectedMemberIds(prev => prev.includes(userId) ? prev : [...prev, userId]);
      }
    };

    socket.on('join_request_created', handleLiveJoinRequest);

    return () => {
      socket.off('join_request_created', handleLiveJoinRequest);
    };
  }, [socket, projectCode]);

  const handleCopyCode = () => {
    if (!projectCode) return;
    navigator.clipboard.writeText(projectCode);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const handleToggleMember = (userId) => {
    setSelectedMemberIds(prev => 
      prev.includes(userId) ? prev.filter(id => id !== userId) : [...prev, userId]
    );
  };

  const handleGeneratePlan = async (e) => {
    e.preventDefault();
    if (!name || !description) {
      setError('Project name and description are required.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Step 1: Create the Project with pre-generated code and allocated members
      const projResponse = await api.post('/api/projects', {
        name,
        description,
        tech_stack: techStack,
        deadline,
        projectCode,
        memberIds: selectedMemberIds
      });

      const newProject = projResponse.data;
      const newProjectId = newProject.id || newProject._id;

      // Optional: Connect chosen GitHub Repository if selected
      if (selectedRepoId) {
        const chosenRepo = availableRepos.find(r => String(r.id) === String(selectedRepoId));
        if (chosenRepo) {
          try {
            await api.post(`/api/github/repos/${chosenRepo.id}/connect`, {
              projectId: newProjectId,
              repositoryName: chosenRepo.name,
              repositoryOwner: chosenRepo.owner,
              repositoryUrl: chosenRepo.html_url,
              description: chosenRepo.description,
              isPrivate: chosenRepo.private,
              language: chosenRepo.language,
              stars: chosenRepo.stargazers_count,
              forks: chosenRepo.forks_count,
              defaultBranch: chosenRepo.default_branch
            });
          } catch (repoErr) {
            console.warn('Optional repo connection notice:', repoErr.message);
          }
        }
      }

      // Step 2: Trigger AI Plan decomposition with owner permission
      const aiResponse = await api.post('/api/ai/generate-plan', {
        projectId: newProjectId,
        name,
        description
      });

      const aiPlan = aiResponse.data;

      // Navigate to Plan Review page passing project info and AI generated plan
      navigate(`/projects/review`, {
        state: {
          project: newProject,
          plan: aiPlan
        }
      });
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.error || 'AI plan generation failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-8 max-w-3xl mx-auto">
      <div>
        <h1 className="text-3xl font-extrabold text-slate-900">Create New Project</h1>
        <p className="text-slate-500 text-sm mt-1">Initiate intelligent software planning workflows using Gemini AI</p>
      </div>

      {error && (
        <div className="p-4 bg-rose-50 border border-rose-200 text-rose-800 text-sm rounded-xl">
          {error}
        </div>
      )}

      {loading ? (
        <div className="bg-white p-10 rounded-2xl border border-indigo-100 shadow-sm text-center space-y-6 flex flex-col items-center">
          <div className="relative flex items-center justify-center">
            <div className="animate-ping absolute inline-flex h-16 w-16 rounded-full bg-indigo-500 opacity-20"></div>
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-indigo-600"></div>
          </div>
          <div>
            <h3 className="text-xl font-bold text-slate-900">Decomposing Project Requirements...</h3>
            <p className="text-xs text-slate-500 mt-2 max-w-md mx-auto leading-relaxed">
              Gemini AI is analyzing your project description to identify modules, generate tasks, identify required skills, and establish dependency mappings.
            </p>
          </div>
        </div>
      ) : (
        <form onSubmit={handleGeneratePlan} className="space-y-6">
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
            {/* Optional GitHub Repository Link */}
            {availableRepos.length > 0 && (
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5 pl-1">
                  Connect GitHub Repository (Optional)
                </label>
                <div className="relative">
                  <select
                    value={selectedRepoId}
                    onChange={handleSelectRepo}
                    className="w-full py-3 px-4 rounded-xl bg-slate-50 border border-slate-300 text-xs text-slate-900 focus:outline-none focus:border-indigo-600 focus:bg-white"
                  >
                    <option value="">-- No Repository Linked --</option>
                    {availableRepos.map((repo) => (
                      <option key={repo.id} value={repo.id}>
                        {repo.full_name} ({repo.language || 'Code'}) {repo.private ? '🔒 Private' : '🌐 Public'}
                      </option>
                    ))}
                  </select>
                </div>
                <p className="text-[11px] text-slate-400 mt-1 pl-1">
                  Selecting a repository auto-fills project details and prepares it for AI Development Plan generation.
                </p>
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5 pl-1">Project Name</label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Online Book Store"
                className="w-full py-3 px-4 rounded-xl bg-slate-50 border border-slate-300 text-sm text-slate-900 focus:outline-none focus:border-indigo-600 focus:bg-white"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5 pl-1">Project Description</label>
              <textarea
                rows={5}
                required
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Describe your project idea in detail: target audience, core features, auth logic, payment gates, catalog list items..."
                className="w-full py-3 px-4 rounded-xl bg-slate-50 border border-slate-300 text-sm text-slate-900 resize-none focus:outline-none focus:border-indigo-600 focus:bg-white"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5 pl-1">Technology Stack</label>
                <div className="relative">
                  <Code className="absolute left-3.5 top-3.5 h-4 w-4 text-slate-400" />
                  <input
                    type="text"
                    value={techStack}
                    onChange={(e) => setTechStack(e.target.value)}
                    placeholder="React, Node.js, Express, MongoDB"
                    className="w-full py-3 pl-10 pr-4 rounded-xl bg-slate-50 border border-slate-300 text-sm text-slate-900 focus:outline-none focus:border-indigo-600 focus:bg-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5 pl-1">Target Deadline</label>
                <div className="relative">
                  <Calendar className="absolute left-3.5 top-3.5 h-4 w-4 text-slate-400" />
                  <input
                    type="date"
                    value={deadline}
                    onChange={(e) => setDeadline(e.target.value)}
                    className="w-full py-3 pl-10 pr-4 rounded-xl bg-slate-50 border border-slate-300 text-sm text-slate-900 focus:outline-none focus:border-indigo-600 focus:bg-white"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Project Access Code & Live Allocate Team Members Section */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-5">
            <div>
              <div className="flex items-center space-x-2">
                <Users className="h-5 w-5 text-indigo-600" />
                <h3 className="text-base font-bold text-slate-900">Project Code & Team Allocation</h3>
              </div>
              <p className="text-xs text-slate-500 mt-1">
                Share this unique project access code with your team members. As they enter it on their devices, they will appear live in the queue below.
              </p>
            </div>

            {/* Generated Code Display Box */}
            <div className="p-4 bg-indigo-50/60 border border-indigo-200 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center space-x-3">
                <div className="p-2.5 bg-indigo-600 text-white rounded-xl shadow-xs">
                  <KeyRound className="h-5 w-5" />
                </div>
                <div>
                  <span className="text-[10px] uppercase font-bold text-indigo-600 tracking-wider">Unique Join Code</span>
                  <div className="text-2xl font-mono font-extrabold text-slate-900 tracking-widest">
                    {projectCode || 'GENERATING...'}
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={handleCopyCode}
                className="px-4 py-2.5 bg-white hover:bg-slate-50 text-indigo-700 border border-indigo-200 font-semibold text-xs rounded-xl shadow-xs flex items-center justify-center space-x-1.5 transition-colors"
              >
                {copiedCode ? (
                  <>
                    <Check className="h-4 w-4 text-emerald-600" />
                    <span>Copied!</span>
                  </>
                ) : (
                  <>
                    <Copy className="h-4 w-4" />
                    <span>Copy Code</span>
                  </>
                )}
              </button>
            </div>

            {/* Live WebSockets Waiting Room Queue */}
            <div className="space-y-3 pt-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-800 flex items-center space-x-2">
                  <span>Incoming Team Members Queue</span>
                  <span className="h-2 w-2 rounded-full bg-emerald-500 animate-ping" title="Live listener active"></span>
                </span>
                <span className="text-[11px] text-indigo-700 font-semibold">
                  {selectedMemberIds.length} Selected
                </span>
              </div>

              {liveMembersQueue.length === 0 ? (
                <div className="p-8 border border-dashed border-slate-300 rounded-2xl text-center space-y-2 bg-slate-50/50">
                  <div className="p-3 bg-white border border-slate-200 rounded-full w-fit mx-auto text-slate-400">
                    <Radio className="h-5 w-5 text-indigo-600 animate-pulse" />
                  </div>
                  <h4 className="text-xs font-bold text-slate-700">Waiting for members to join using code...</h4>
                  <p className="text-[11px] text-slate-500 max-w-sm mx-auto">
                    Tell developers to click "Join Project" on their Dashboard and enter code <strong className="font-mono text-indigo-700">{projectCode}</strong>.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {liveMembersQueue.map((member) => {
                    const isSelected = selectedMemberIds.includes(member.id);
                    return (
                      <div
                        key={member.id}
                        onClick={() => handleToggleMember(member.id)}
                        className={`p-3.5 rounded-xl border cursor-pointer transition-all flex items-start justify-between ${
                          isSelected
                            ? 'bg-indigo-50/80 border-indigo-400 shadow-xs'
                            : 'bg-slate-50 border-slate-200 opacity-60 hover:opacity-100'
                        }`}
                      >
                        <div className="space-y-1 pr-2">
                          <div className="flex items-center space-x-1.5">
                            <span className="text-xs font-bold text-slate-900">{member.fullName || member.name}</span>
                            <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-slate-200 text-slate-700">
                              {member.workspaceRole}
                            </span>
                          </div>
                          <p className="text-[10px] text-slate-500 flex items-center space-x-1">
                            <Mail className="h-3 w-3" />
                            <span>{member.email}</span>
                          </p>
                          {member.skills && member.skills.length > 0 && (
                            <div className="flex flex-wrap gap-1 pt-1">
                              {member.skills.slice(0, 3).map((sk, idx) => (
                                <span key={idx} className="px-1.5 py-0.5 rounded text-[8px] bg-indigo-100/70 text-indigo-800 font-medium">
                                  {sk}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>

                        <div className={`p-1.5 rounded-lg shrink-0 mt-0.5 ${
                          isSelected ? 'bg-indigo-600 text-white' : 'bg-slate-200 text-slate-400'
                        }`}>
                          <UserCheck className="h-4 w-4" />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          <button
            type="submit"
            className="w-full py-4 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 font-semibold text-sm text-white rounded-xl shadow-md shadow-indigo-600/20 active:scale-[0.98] transition-all flex items-center justify-center space-x-2"
          >
            <Sparkles className="h-4 w-4" />
            <span>Generate AI Development Plan</span>
          </button>
        </form>
      )}
    </div>
  );
};

export default ProjectCreate;
