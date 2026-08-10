import React, { useState, useEffect, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../utils/api';
import { AuthContext } from '../context/AuthContext';
import { FolderKanban, Plus, Clock, Users, ArrowRight, KeyRound, Copy, Check } from 'lucide-react';
import JoinProjectModal from '../components/JoinProjectModal';

const Projects = () => {
  const { user } = useContext(AuthContext);
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isJoinModalOpen, setIsJoinModalOpen] = useState(false);
  const [copiedCode, setCopiedCode] = useState('');
  const navigate = useNavigate();

  const fetchProjects = async () => {
    try {
      const res = await api.get('/api/projects');
      setProjects(res.data);
    } catch (err) {
      console.error('Failed to load projects:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProjects();
  }, []);

  const handleCopyCode = (code, e) => {
    e.stopPropagation();
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(''), 2000);
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
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold text-white">Project Workspaces</h1>
          <p className="text-slate-400 text-sm mt-1">Manage, plan, and assign developer roles across active initiatives</p>
        </div>

        <div className="flex items-center space-x-3">
          <button
            onClick={() => setIsJoinModalOpen(true)}
            className="px-4 py-3 bg-white/5 hover:bg-white/10 border border-white/10 font-semibold text-sm text-slate-200 rounded-xl transition-all flex items-center space-x-2 shadow-sm"
          >
            <KeyRound className="h-4 w-4 text-indigo-400" />
            <span>Join Project</span>
          </button>

          <button
            onClick={() => navigate('/projects/new')}
            className="px-5 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 font-semibold text-sm text-white rounded-xl shadow-lg shadow-indigo-600/25 active:scale-[0.98] transition-all flex items-center space-x-2"
          >
            <Plus className="h-4.5 w-4.5" />
            <span>Create Project</span>
          </button>
        </div>
      </div>

      {projects.length === 0 ? (
        <div className="glass p-12 text-center border border-white/5 rounded-2xl max-w-xl mx-auto space-y-4">
          <div className="mx-auto bg-indigo-500/10 p-4 rounded-full w-fit text-indigo-400">
            <FolderKanban className="h-10 w-10" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-slate-200">No projects found</h3>
            <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
              Get started by creating a project workspace or enter a Project Code to join an existing project.
            </p>
          </div>
          <div className="flex justify-center space-x-3 pt-2">
            <button
              onClick={() => setIsJoinModalOpen(true)}
              className="px-4 py-2.5 bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-semibold rounded-xl text-slate-300 transition-all"
            >
              Enter Project Code
            </button>
            <button
              onClick={() => navigate('/projects/new')}
              className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-xs font-semibold rounded-xl text-white transition-all shadow-md shadow-indigo-600/15"
            >
              Create Project
            </button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {projects.map((proj) => (
            <div 
              key={proj.id || proj._id} 
              className="glass p-6 rounded-2xl border border-white/5 flex flex-col justify-between hover:border-white/10 transition-all duration-300 group relative"
            >
              <div>
                <div className="flex items-center justify-between">
                  <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold tracking-wide uppercase ${
                    proj.status === 'Completed' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/10' :
                    proj.status === 'Active' ? 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/10' :
                    'bg-slate-500/10 text-slate-400 border border-slate-500/10'
                  }`}>
                    {proj.status}
                  </span>

                  {/* Project Code Pill */}
                  {proj.projectCode && (
                    <button
                      type="button"
                      onClick={(e) => handleCopyCode(proj.projectCode, e)}
                      title="Click to copy Project Code"
                      className="inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-lg bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 text-xs font-mono font-bold hover:bg-indigo-500/20 transition-all"
                    >
                      <KeyRound className="h-3 w-3 text-indigo-400" />
                      <span>{proj.projectCode}</span>
                      {copiedCode === proj.projectCode ? (
                        <Check className="h-3 w-3 text-emerald-400" />
                      ) : (
                        <Copy className="h-3 w-3 text-indigo-400 opacity-60 group-hover:opacity-100" />
                      )}
                    </button>
                  )}
                </div>

                <h3 className="text-lg font-bold text-slate-200 mt-4 leading-tight group-hover:text-indigo-400 transition-colors">
                  {proj.name}
                </h3>
                
                <p className="text-xs text-slate-400 mt-2 line-clamp-3 leading-relaxed">
                  {proj.description || 'No description provided.'}
                </p>

                {(proj.tech_stack || proj.technologyStack) && (
                  <div className="mt-4 flex flex-wrap gap-1.5">
                    {(proj.tech_stack || proj.technologyStack).split(',').map((tech, idx) => (
                      <span key={idx} className="px-2 py-0.5 bg-white/5 border border-white/5 rounded text-[10px] text-slate-400">
                        {tech.trim()}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              <div className="border-t border-white/5 pt-4 mt-6 flex items-center justify-between">
                <div className="flex items-center space-x-1 text-slate-400 text-xs">
                  <Users className="h-4 w-4 text-slate-500" />
                  <span>{(proj.members || proj.Users || []).length} members</span>
                </div>

                <button
                  onClick={() => navigate(`/projects/${proj.id || proj._id}`)}
                  className="text-xs text-indigo-400 hover:text-indigo-300 font-semibold flex items-center space-x-1 group-hover:translate-x-1 transition-transform"
                >
                  <span>Open board</span>
                  <ArrowRight className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Join Project Modal */}
      <JoinProjectModal
        isOpen={isJoinModalOpen}
        onClose={() => setIsJoinModalOpen(false)}
        onSuccess={() => fetchProjects()}
      />
    </div>
  );
};

export default Projects;
