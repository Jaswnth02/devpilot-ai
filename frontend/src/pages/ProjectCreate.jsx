import React, { useState, useEffect, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../utils/api';
import { SocketContext } from '../context/SocketContext';
import { Users, Cpu, Calendar, Code, KeyRound, Copy, Check, Radio, UserCheck, Mail, Sparkles } from 'lucide-react';

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

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // 1. Fetch pre-generated unique Project Code on page mount
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
    fetchCode();
  }, []);

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

      // Step 2: Trigger AI Plan decomposition with owner permission
      const aiResponse = await api.post('/api/ai/generate-plan', {
        projectId: newProject.id || newProject._id,
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
        <h1 className="text-3xl font-extrabold text-white">Create New Project</h1>
        <p className="text-slate-400 text-sm mt-1">Initiate intelligent software planning workflows using Gemini AI</p>
      </div>

      {error && (
        <div className="p-4 bg-rose-500/15 border border-rose-500/30 text-rose-300 text-sm rounded-xl">
          {error}
        </div>
      )}

      {loading ? (
        <div className="glass p-10 rounded-2xl border border-indigo-500/20 text-center space-y-6 flex flex-col items-center">
          <div className="relative flex items-center justify-center">
            <div className="animate-ping absolute inline-flex h-16 w-16 rounded-full bg-indigo-500 opacity-20"></div>
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-indigo-500"></div>
          </div>
          <div>
            <h3 className="text-xl font-bold text-slate-200">Decomposing Project Requirements...</h3>
            <p className="text-xs text-slate-400 mt-2 max-w-md mx-auto leading-relaxed">
              Gemini AI is analyzing your project description to identify modules, generate tasks, identify required skills, and establish dependency mappings.
            </p>
          </div>
        </div>
      ) : (
        <form onSubmit={handleGeneratePlan} className="space-y-6">
          <div className="glass p-6 rounded-2xl border border-white/5 space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5 pl-1">Project Name</label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Online Book Store"
                className="w-full py-3 px-4 rounded-xl glass-input text-sm text-white"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5 pl-1">Project Description</label>
              <textarea
                rows={5}
                required
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Describe your project idea in detail: target audience, core features, auth logic, payment gates, catalog list items..."
                className="w-full py-3 px-4 rounded-xl glass-input text-sm text-white resize-none"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5 pl-1">Technology Stack</label>
                <div className="relative">
                  <Code className="absolute left-3.5 top-3.5 h-4 w-4 text-slate-500" />
                  <input
                    type="text"
                    value={techStack}
                    onChange={(e) => setTechStack(e.target.value)}
                    placeholder="React, Node.js, Express, MongoDB"
                    className="w-full py-3 pl-10 pr-4 rounded-xl glass-input text-sm text-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5 pl-1">Target Deadline</label>
                <div className="relative">
                  <Calendar className="absolute left-3.5 top-3.5 h-4 w-4 text-slate-500" />
                  <input
                    type="date"
                    value={deadline}
                    onChange={(e) => setDeadline(e.target.value)}
                    className="w-full py-3 pl-10 pr-4 rounded-xl glass-input text-sm text-white"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Project Access Code & Live Allocate Team Members Section */}
          <div className="glass p-6 rounded-2xl border border-white/5 space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-white/5 pb-4 gap-3">
              <div className="flex items-center space-x-2">
                <Users className="h-5 w-5 text-indigo-400" />
                <h3 className="text-base font-bold text-slate-200">Allocate Team Members</h3>
              </div>

              {/* Generated Project Code Display */}
              {projectCode && (
                <div className="flex items-center space-x-2 bg-indigo-500/15 border border-indigo-500/30 px-3.5 py-1.5 rounded-xl">
                  <KeyRound className="h-4 w-4 text-indigo-400" />
                  <span className="text-xs text-slate-300 font-medium">Project Code:</span>
                  <strong className="text-sm font-mono font-extrabold text-indigo-300 tracking-wider">{projectCode}</strong>
                  <button
                    type="button"
                    onClick={handleCopyCode}
                    title="Copy Project Code to Share"
                    className="p-1 hover:bg-indigo-500/20 text-indigo-400 rounded-md transition-colors"
                  >
                    {copiedCode ? <Check className="h-4 w-4 text-emerald-400" /> : <Copy className="h-4 w-4" />}
                  </button>
                </div>
              )}
            </div>

            {/* Live Socket Queue Header */}
            <div className="flex items-center space-x-2 px-3.5 py-2 bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 rounded-xl text-xs font-medium">
              <Radio className="h-4 w-4 text-emerald-400 animate-pulse shrink-0" />
              <span>Share code <strong className="font-mono text-emerald-200">{projectCode}</strong> with your team. Users entering this code will pop up here live!</span>
            </div>

            {/* Live Incoming Users Queue */}
            {liveMembersQueue.length === 0 ? (
              <div className="py-10 text-center space-y-3 bg-slate-950/20 rounded-xl border border-white/5">
                <div className="relative flex items-center justify-center">
                  <div className="animate-ping absolute inline-flex h-12 w-12 rounded-full bg-emerald-500 opacity-20"></div>
                  <div className="h-10 w-10 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
                    <Radio className="h-5 w-5" />
                  </div>
                </div>
                <div>
                  <h4 className="text-sm font-bold text-slate-200">Waiting for team members to enter code...</h4>
                  <p className="text-xs text-slate-400 mt-1 max-w-md mx-auto">
                    When developers enter <strong className="text-indigo-300 font-mono">{projectCode}</strong>, their profiles will pop up right here live for you to select and allocate!
                  </p>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex items-center justify-between text-xs text-slate-400">
                  <span>Joined via Code:</span>
                  <span>Allocated: <strong className="text-indigo-400">{selectedMemberIds.length}</strong> / {liveMembersQueue.length}</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-72 overflow-y-auto pr-1">
                  {liveMembersQueue.map(member => {
                    const isSelected = selectedMemberIds.includes(member.id);
                    return (
                      <div 
                        key={member.id}
                        onClick={() => handleToggleMember(member.id)}
                        className={`p-3.5 rounded-xl border cursor-pointer transition-all flex flex-col justify-between space-y-2 relative overflow-hidden ${
                          isSelected
                            ? 'bg-indigo-600/15 border-indigo-500/50 text-white shadow-lg shadow-indigo-600/10'
                            : 'bg-white/5 border-white/5 hover:bg-white/10 text-slate-300'
                        }`}
                      >
                        <div className="flex items-start justify-between">
                          <div>
                            <p className="text-sm font-bold text-white flex items-center space-x-1.5">
                              <span>{member.fullName || member.name}</span>
                              <span className="text-[9px] font-extrabold uppercase px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                                Live Code
                              </span>
                            </p>
                            <p className="text-[11px] text-slate-400 flex items-center space-x-1 mt-0.5">
                              <Mail className="h-3 w-3 text-slate-500 shrink-0" />
                              <span className="truncate max-w-[170px]">{member.email}</span>
                            </p>
                          </div>

                          <div className={`w-5 h-5 rounded-md flex items-center justify-center border transition-all ${
                            isSelected
                              ? 'bg-indigo-600 border-indigo-500 text-white'
                              : 'border-slate-600 bg-slate-800/50'
                          }`}>
                            {isSelected && <Check className="h-3.5 w-3.5 text-white" />}
                          </div>
                        </div>

                        <div className="flex items-center justify-between pt-1 border-t border-white/5">
                          <span className="text-[10px] font-semibold text-indigo-300 px-2 py-0.5 rounded-md bg-indigo-500/10 border border-indigo-500/20">
                            {member.workspaceRole || member.role}
                          </span>
                          <span className="text-[10px] font-medium text-slate-400">
                            {member.experienceLevel}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          <button
            type="submit"
            className="w-full py-4 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 font-semibold text-sm text-white flex items-center justify-center space-x-2 shadow-lg shadow-indigo-600/25 active:scale-[0.98] transition-all"
          >
            <Cpu className="h-5 w-5" />
            <span>Generate AI Development Plan</span>
          </button>
        </form>
      )}
    </div>
  );
};

export default ProjectCreate;
