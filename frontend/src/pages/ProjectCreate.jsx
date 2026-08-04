import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../utils/api';
import { Plus, Users, Cpu, Calendar, Code } from 'lucide-react';

const ProjectCreate = () => {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [techStack, setTechStack] = useState('React, Node.js, Express, MySQL');
  const [deadline, setDeadline] = useState('');
  const [team, setTeam] = useState([]);
  const [selectedMembers, setSelectedMembers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  
  const navigate = useNavigate();

  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const res = await api.get('/api/users');
        setTeam(res.data);
      } catch (err) {
        console.error('Failed to load users:', err);
      }
    };
    fetchUsers();
  }, []);

  const handleMemberToggle = (userId) => {
    setSelectedMembers(prev => 
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
      // Step 1: Create the Project first
      const projResponse = await api.post('/api/projects', {
        name,
        description,
        tech_stack: techStack,
        deadline,
        memberIds: selectedMembers
      });

      const newProject = projResponse.data;

      // Step 2: Trigger AI Plan decomposition
      const aiResponse = await api.post('/api/ai/generate-plan', {
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
                className="w-full py-3 px-4 rounded-xl glass-input text-sm"
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
                className="w-full py-3 px-4 rounded-xl glass-input text-sm resize-none"
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
                    placeholder="React, Node.js, Express, MySQL"
                    className="w-full py-3 pl-10 pr-4 rounded-xl glass-input text-sm"
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
                    className="w-full py-3 pl-10 pr-4 rounded-xl glass-input text-sm"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Team Selection */}
          <div className="glass p-6 rounded-2xl border border-white/5 space-y-4">
            <div className="flex items-center space-x-2 text-slate-200">
              <Users className="h-5 w-5 text-indigo-400" />
              <h3 className="text-base font-bold">Allocate Team Members</h3>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-56 overflow-y-auto pr-2">
              {team.map(member => (
                <div 
                  key={member.id}
                  onClick={() => handleMemberToggle(member.id)}
                  className={`p-3 rounded-xl border cursor-pointer transition-all flex items-center justify-between ${
                    selectedMembers.includes(member.id)
                      ? 'bg-indigo-600/10 border-indigo-500/40 text-white'
                      : 'bg-white/5 border-white/5 hover:bg-white/10 text-slate-400'
                  }`}
                >
                  <div>
                    <p className="text-xs font-semibold text-slate-200">{member.name}</p>
                    <span className="text-[10px] uppercase font-bold text-slate-500">{member.role}</span>
                  </div>
                  <input 
                    type="checkbox" 
                    checked={selectedMembers.includes(member.id)}
                    readOnly
                    className="rounded border-white/10 text-indigo-600 focus:ring-indigo-500 h-4 w-4"
                  />
                </div>
              ))}
            </div>
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
