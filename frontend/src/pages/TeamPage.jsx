import React, { useState, useEffect, useContext } from 'react';
import api from '../utils/api';
import { AuthContext } from '../context/AuthContext';
import { Users, Edit, Check, ShieldAlert, Award, Calendar, CheckSquare } from 'lucide-react';

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
    setEditName(u.name);
    setEditRole(u.role);
    setEditExperience(u.experience_level);
    setEditAvailability(u.availability);
    setEditSkills((u.Skills || []).map(s => s.name).join(', '));
  };

  const handleSave = async (e) => {
    e.preventDefault();
    try {
      const skillsArray = editSkills
        .split(',')
        .map(s => s.trim())
        .filter(s => s.length > 0);

      await api.put(`/api/users/${editingUser.id}`, {
        name: editName,
        role: editRole,
        experience_level: editExperience,
        availability: editAvailability,
        skills: skillsArray
      });

      setEditingUser(null);
      fetchUsers();
      // If the user updated their own profile, refresh their context
      if (editingUser.id === user.id) {
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
        {users.map((u) => (
          <div key={u.id} className="glass p-6 rounded-2xl border border-white/5 flex flex-col justify-between hover:border-white/10 transition-all duration-300">
            <div>
              <div className="flex items-start justify-between">
                <div className="flex items-center space-x-3">
                  <div className="h-10 w-10 rounded-full bg-gradient-to-tr from-indigo-500 to-purple-500 flex items-center justify-center font-bold text-white text-base">
                    {u.name.charAt(0)}
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-200 leading-tight">{u.name}</h3>
                    <span className="text-[10px] uppercase font-bold text-slate-400 mt-0.5 block">{u.role}</span>
                  </div>
                </div>

                {/* Edit Action */}
                {(user.id === u.id || user.role === 'Admin' || user.role === 'Project Owner') && (
                  <button
                    onClick={() => handleEditClick(u)}
                    className="p-1.5 text-slate-400 hover:text-indigo-400 hover:bg-white/5 rounded-lg transition-colors"
                    title="Edit Profile"
                  >
                    <Edit className="h-4 w-4" />
                  </button>
                )}
              </div>

              {/* Skill set tags */}
              <div className="mt-5 space-y-3">
                <div className="flex items-start space-x-1.5">
                  <Award className="h-4 w-4 text-indigo-400 shrink-0 mt-0.5" />
                  <div className="flex flex-wrap gap-1">
                    {u.Skills && u.Skills.length > 0 ? (
                      u.Skills.map(skill => (
                        <span key={skill.id} className="px-2 py-0.5 bg-white/5 border border-white/5 rounded text-[10px] text-slate-300 font-medium">
                          {skill.name}
                        </span>
                      ))
                    ) : (
                      <span className="text-[10px] text-slate-500">No skills set</span>
                    )}
                  </div>
                </div>

                <div className="flex items-center space-x-2 text-xs text-slate-400">
                  <Calendar className="h-4 w-4 text-slate-500" />
                  <span>Seniority: <span className="font-semibold text-slate-200">{u.experience_level}</span></span>
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
        ))}
      </div>

      {/* Edit Drawer/Modal */}
      {editingUser && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="glass w-full max-w-md rounded-2xl border border-white/10 p-6 space-y-4">
            <h3 className="text-base font-bold text-slate-200 border-b border-white/5 pb-3">
              Edit Profile: {editingUser.name}
            </h3>

            <form onSubmit={handleSave} className="space-y-4">
              <div>
                <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1">Full Name</label>
                <input
                  type="text"
                  required
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full p-2.5 rounded-xl glass-input text-xs"
                />
              </div>

              {/* Roles change only visible to admin/owners */}
              {(user.role === 'Admin' || user.role === 'Project Owner') && (
                <div>
                  <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1">Role</label>
                  <select
                    value={editRole}
                    onChange={(e) => setEditRole(e.target.value)}
                    className="w-full p-2.5 rounded-xl glass-input text-xs"
                  >
                    <option value="Developer">Developer</option>
                    <option value="Project Owner">Project Owner</option>
                    <option value="Admin">Admin</option>
                  </select>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1">Seniority</label>
                  <select
                    value={editExperience}
                    onChange={(e) => setEditExperience(e.target.value)}
                    className="w-full p-2.5 rounded-xl glass-input text-xs"
                  >
                    <option value="Junior">Junior</option>
                    <option value="Mid">Mid</option>
                    <option value="Senior">Senior</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1">Availability</label>
                  <select
                    value={editAvailability ? 'true' : 'false'}
                    onChange={(e) => setEditAvailability(e.target.value === 'true')}
                    className="w-full p-2.5 rounded-xl glass-input text-xs"
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
                  placeholder="React, Node.js, CSS"
                  className="w-full p-2.5 rounded-xl glass-input text-xs"
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
