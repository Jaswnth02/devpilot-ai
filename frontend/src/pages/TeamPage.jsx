import React, { useState, useEffect, useContext } from 'react';
import api from '../utils/api';
import { AuthContext } from '../context/AuthContext';
import { Users, Edit, Award, Calendar, CheckSquare, Mail } from 'lucide-react';

const TeamPage = () => {
  const { user, refreshUser } = useContext(AuthContext);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingUser, setEditingUser] = useState(null);
  
  // Form states
  const [editName, setEditName] = useState('');
  const [editRole, setEditRole] = useState('Developer');
  const [editExperience, setEditExperience] = useState('Mid');
  const [editAvailability, setEditAvailability] = useState(true);
  const [editSkills, setEditSkills] = useState('');

  const fetchUsers = async () => {
    try {
      const res = await api.get('/api/users');
      setUsers(res.data);
    } catch (err) {
      console.error('Failed to fetch team list:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleEditClick = (u) => {
    setEditingUser(u);
    setEditName(u.fullName || u.name || '');
    setEditRole(u.workspaceRole || u.role || 'Developer');
    setEditExperience(u.experienceLevel || u.experience_level || 'Mid');
    setEditAvailability(u.availability !== undefined ? u.availability : true);
    
    const userSkills = u.skills || (u.Skills || []).map(s => s.name || s);
    setEditSkills(userSkills.join(', '));
  };

  const handleSave = async (e) => {
    e.preventDefault();
    try {
      const skillsArray = editSkills
        .split(',')
        .map(s => s.trim())
        .filter(s => s.length > 0);

      await api.put(`/api/users/${editingUser.id || editingUser._id}`, {
        fullName: editName,
        name: editName,
        workspaceRole: editRole,
        role: editRole,
        experienceLevel: editExperience,
        experience_level: editExperience,
        availability: editAvailability,
        skills: skillsArray
      });

      setEditingUser(null);
      fetchUsers();
      if (user && (editingUser.id === user.id || editingUser._id === user.id)) {
        refreshUser();
      }
    } catch (err) {
      console.error('Failed to update profile:', err);
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
        <h1 className="text-3xl font-extrabold text-white">Team Directory</h1>
        <p className="text-slate-400 text-sm mt-1">Manage developer allocations, skill profiles, and capacity workloads</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {users.map((u) => {
          const displayName = u.fullName || u.name || u.email;
          const displayRole = u.workspaceRole || u.role || 'Developer';
          const displayExp = u.experienceLevel || u.experience_level || 'Mid';
          const userSkills = u.skills && u.skills.length > 0
            ? u.skills
            : (u.Skills || []).map(s => s.name || s);

          return (
            <div key={u.id || u._id} className="glass p-6 rounded-2xl border border-white/5 flex flex-col justify-between hover:border-white/10 transition-all duration-300">
              <div>
                <div className="flex items-start justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="h-10 w-10 rounded-full bg-gradient-to-tr from-indigo-500 to-purple-500 flex items-center justify-center font-bold text-white text-base shadow-md">
                      {displayName.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-slate-200 leading-tight">{displayName}</h3>
                      <p className="text-[11px] text-slate-400 flex items-center space-x-1 mt-0.5">
                        <Mail className="h-3 w-3 text-slate-500 shrink-0" />
                        <span className="truncate max-w-[170px]">{u.email}</span>
                      </p>
                    </div>
                  </div>

                  {/* Edit Action */}
                  {user && (user.id === u.id || user.id === u._id || user.role === 'Admin' || user.workspaceRole === 'Project Owner') && (
                    <button
                      onClick={() => handleEditClick(u)}
                      className="p-1.5 text-slate-400 hover:text-indigo-400 hover:bg-white/5 rounded-lg transition-colors"
                      title="Edit Profile"
                    >
                      <Edit className="h-4 w-4" />
                    </button>
                  )}
                </div>

                <div className="mt-3 inline-block">
                  <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-indigo-500/10 text-indigo-300 border border-indigo-500/20">
                    {displayRole}
                  </span>
                </div>

                {/* Skill set tags */}
                <div className="mt-4 space-y-3">
                  <div className="flex items-start space-x-1.5">
                    <Award className="h-4 w-4 text-indigo-400 shrink-0 mt-0.5" />
                    <div className="flex flex-wrap gap-1">
                      {userSkills.length > 0 ? (
                        userSkills.map((skillName, idx) => (
                          <span key={idx} className="px-2 py-0.5 bg-white/5 border border-white/5 rounded text-[10px] text-slate-300 font-medium">
                            {skillName}
                          </span>
                        ))
                      ) : (
                        <span className="text-[10px] text-slate-500">No skills listed</span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center space-x-2 text-xs text-slate-400">
                    <Calendar className="h-4 w-4 text-slate-500" />
                    <span>Seniority: <span className="font-semibold text-slate-200">{displayExp}</span></span>
                  </div>
                </div>
              </div>

              {/* Capacity status block */}
              <div className="border-t border-white/5 pt-4 mt-6 flex items-center justify-between">
                <div className="flex items-center space-x-1.5">
                  <span className={`h-2 w-2 rounded-full ${u.availability ? 'bg-emerald-500' : 'bg-rose-500'}`}></span>
                  <span className="text-xs text-slate-400">{u.availability ? 'Available' : 'Busy'}</span>
                </div>

                <div className="flex items-center space-x-1 text-xs">
                  <CheckSquare className="h-4 w-4 text-slate-500" />
                  <span>Workload: <span className="font-bold text-indigo-400">{u.current_workload || 0} active tasks</span></span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Edit Drawer/Modal */}
      {editingUser && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="glass w-full max-w-md rounded-2xl border border-white/10 p-6 space-y-4">
            <h3 className="text-base font-bold text-slate-200 border-b border-white/5 pb-3">
              Edit Profile: {editingUser.fullName || editingUser.name}
            </h3>

            <form onSubmit={handleSave} className="space-y-4">
              <div>
                <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1">Full Name</label>
                <input
                  type="text"
                  required
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full p-2.5 rounded-xl glass-input text-xs text-white"
                />
              </div>

              {/* Roles change */}
              <div>
                <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1">Role</label>
                <select
                  value={editRole}
                  onChange={(e) => setEditRole(e.target.value)}
                  className="w-full p-2.5 rounded-xl glass-input text-xs text-white bg-[#0c1220]"
                >
                  <option value="Developer / Engineer">Developer / Engineer</option>
                  <option value="Project Manager">Project Manager</option>
                  <option value="Designer">Designer</option>
                  <option value="Product Manager">Product Manager</option>
                  <option value="Student">Student</option>
                  <option value="Other">Other</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1">Seniority</label>
                  <select
                    value={editExperience}
                    onChange={(e) => setEditExperience(e.target.value)}
                    className="w-full p-2.5 rounded-xl glass-input text-xs text-white bg-[#0c1220]"
                  >
                    <option value="Beginner">Beginner</option>
                    <option value="Entry-Level">Entry-Level</option>
                    <option value="Mid-Level">Mid-Level</option>
                    <option value="Senior">Senior</option>
                    <option value="Expert">Expert</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1">Availability</label>
                  <select
                    value={editAvailability ? 'true' : 'false'}
                    onChange={(e) => setEditAvailability(e.target.value === 'true')}
                    className="w-full p-2.5 rounded-xl glass-input text-xs text-white bg-[#0c1220]"
                  >
                    <option value="true">Available</option>
                    <option value="false">Busy / Away</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1">
                  Skills (comma-separated)
                </label>
                <input
                  type="text"
                  value={editSkills}
                  onChange={(e) => setEditSkills(e.target.value)}
                  placeholder="React, Node.js, Express, MongoDB"
                  className="w-full p-2.5 rounded-xl glass-input text-xs text-white"
                />
              </div>

              <div className="flex justify-end space-x-2 pt-4">
                <button
                  type="button"
                  onClick={() => setEditingUser(null)}
                  className="px-4 py-2 bg-white/5 hover:bg-white/10 text-slate-400 text-xs font-semibold rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded-xl"
                >
                  Save Profile
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default TeamPage;
