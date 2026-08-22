import React, { useState, useEffect, useContext } from 'react';
import api from '../utils/api';
import { AuthContext } from '../context/AuthContext';
import { Users, Edit, Award, Calendar, CheckSquare, Mail, User, X, ExternalLink, ShieldCheck, Briefcase } from 'lucide-react';

const TeamPage = () => {
  const { user, refreshUser } = useContext(AuthContext);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingUser, setEditingUser] = useState(null);
  const [viewingUser, setViewingUser] = useState(null);
  
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
        <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-extrabold text-slate-900">Team Directory</h1>
        <p className="text-slate-500 text-sm mt-1">Manage developer allocations, skill profiles, and capacity workloads</p>
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
            <div key={u.id || u._id} className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between hover:border-indigo-300 hover:shadow-md transition-all duration-300">
              <div>
                <div className="flex items-start justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="h-10 w-10 rounded-full bg-gradient-to-tr from-indigo-600 to-purple-600 flex items-center justify-center font-bold text-white text-base shadow-sm">
                      {displayName.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-slate-900 leading-tight">{displayName}</h3>
                      <p className="text-[11px] text-slate-500 flex items-center space-x-1 mt-0.5">
                        <Mail className="h-3 w-3 text-slate-400 shrink-0" />
                        <span className="truncate max-w-[170px]">{u.email}</span>
                      </p>
                    </div>
                  </div>

                  {/* Edit Action */}
                  {user && (user.id === u.id || user.id === u._id || user.role === 'Admin' || user.workspaceRole === 'Project Owner') && (
                    <button
                      onClick={() => handleEditClick(u)}
                      className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-slate-100 rounded-lg transition-colors"
                      title="Edit Profile"
                    >
                      <Edit className="h-4 w-4" />
                    </button>
                  )}
                </div>

                <div className="mt-3 inline-block">
                  <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-700 border border-indigo-100">
                    {displayRole}
                  </span>
                </div>

                {/* Skill set tags */}
                <div className="mt-4 space-y-3">
                  <div className="flex items-start space-x-1.5">
                    <Award className="h-4 w-4 text-indigo-600 shrink-0 mt-0.5" />
                    <div className="flex flex-wrap gap-1">
                      {userSkills.length > 0 ? (
                        userSkills.map((skillName, idx) => (
                          <span key={idx} className="px-2 py-0.5 bg-slate-100 border border-slate-200 rounded text-[10px] text-slate-700 font-medium">
                            {skillName}
                          </span>
                        ))
                      ) : (
                        <span className="text-[10px] text-slate-400">No skills listed</span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center space-x-2 text-xs text-slate-500">
                    <Calendar className="h-4 w-4 text-slate-400" />
                    <span>Seniority: <span className="font-semibold text-slate-800">{displayExp}</span></span>
                  </div>
                </div>
              </div>

              {/* Capacity status block with View Profile option */}
              <div className="border-t border-slate-100 pt-4 mt-6 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => setViewingUser(u)}
                  className="flex items-center space-x-1.5 text-xs font-semibold text-indigo-600 hover:text-indigo-700 bg-indigo-50/80 hover:bg-indigo-100 px-2.5 py-1.5 rounded-lg border border-indigo-100 transition-all cursor-pointer"
                >
                  <User className="h-3.5 w-3.5" />
                  <span>View Profile</span>
                </button>

                <div className="flex items-center space-x-1 text-xs text-slate-600">
                  <CheckSquare className="h-4 w-4 text-slate-400" />
                  <span>Workload: <span className="font-bold text-indigo-600">{u.current_workload || 0} active tasks</span></span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* View Profile Modal */}
      {viewingUser && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-lg rounded-2xl border border-slate-200 p-6 space-y-6 shadow-2xl">
            <div className="flex items-start justify-between border-b border-slate-100 pb-4">
              <div className="flex items-center space-x-4">
                <div className="h-14 w-14 rounded-2xl bg-gradient-to-tr from-indigo-600 to-purple-600 flex items-center justify-center font-bold text-white text-xl shadow-md">
                  {(viewingUser.fullName || viewingUser.name || viewingUser.email).charAt(0).toUpperCase()}
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-900">
                    {viewingUser.fullName || viewingUser.name}
                  </h3>
                  <p className="text-xs text-slate-500 flex items-center space-x-1.5 mt-0.5">
                    <Mail className="h-3.5 w-3.5 text-slate-400" />
                    <span>{viewingUser.email}</span>
                  </p>
                </div>
              </div>

              <button
                onClick={() => setViewingUser(null)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-4">
              {/* Status Badge */}
              <div className="flex items-center justify-between p-3.5 bg-slate-50 rounded-xl border border-slate-100">
                <span className="text-xs font-semibold text-slate-600">Availability Status</span>
                <div className="flex items-center space-x-1.5">
                  <span className={`h-2.5 w-2.5 rounded-full ${viewingUser.availability ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'}`}></span>
                  <span className={`text-xs font-bold ${viewingUser.availability ? 'text-emerald-700' : 'text-rose-700'}`}>
                    {viewingUser.availability ? 'Available for Projects' : 'Busy / Away'}
                  </span>
                </div>
              </div>

              {/* Role & Experience */}
              <div className="grid grid-cols-2 gap-4">
                <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-100">
                  <div className="flex items-center space-x-1.5 text-slate-400 text-xs mb-1">
                    <Briefcase className="h-3.5 w-3.5" />
                    <span>Role</span>
                  </div>
                  <p className="text-xs font-bold text-slate-900">
                    {viewingUser.workspaceRole || viewingUser.role || 'Developer'}
                  </p>
                </div>

                <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-100">
                  <div className="flex items-center space-x-1.5 text-slate-400 text-xs mb-1">
                    <Calendar className="h-3.5 w-3.5" />
                    <span>Seniority Level</span>
                  </div>
                  <p className="text-xs font-bold text-slate-900">
                    {viewingUser.experienceLevel || viewingUser.experience_level || 'Mid-Level'}
                  </p>
                </div>
              </div>

              {/* Workload */}
              <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-100 flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <CheckSquare className="h-4 w-4 text-indigo-600" />
                  <span className="text-xs font-semibold text-slate-700">Active Workload</span>
                </div>
                <span className="text-xs font-extrabold text-indigo-600 bg-indigo-50 px-2.5 py-1 rounded-lg border border-indigo-100">
                  {viewingUser.current_workload || 0} active tasks
                </span>
              </div>

              {/* Skills Tag List */}
              <div className="space-y-2">
                <div className="flex items-center space-x-1.5 text-xs font-semibold text-slate-700">
                  <Award className="h-4 w-4 text-indigo-600" />
                  <span>Technical Skills</span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {(viewingUser.skills && viewingUser.skills.length > 0 
                    ? viewingUser.skills 
                    : (viewingUser.Skills || []).map(s => s.name || s)
                  ).map((skill, idx) => (
                    <span key={idx} className="px-2.5 py-1 bg-indigo-50 text-indigo-700 border border-indigo-100 rounded-lg text-xs font-medium">
                      {skill}
                    </span>
                  ))}
                  {(!viewingUser.skills || viewingUser.skills.length === 0) && (
                    <span className="text-xs text-slate-400 italic">No skills listed yet</span>
                  )}
                </div>
              </div>
            </div>

            {/* Footer Action buttons */}
            <div className="flex items-center justify-between pt-4 border-t border-slate-100">
              <a
                href={`mailto:${viewingUser.email}`}
                className="flex items-center space-x-1.5 px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl transition-colors"
              >
                <Mail className="h-3.5 w-3.5" />
                <span>Contact Member</span>
              </a>

              <div className="flex items-center space-x-2">
                {user && (user.id === viewingUser.id || user.id === viewingUser._id || user.role === 'Admin' || user.workspaceRole === 'Project Owner') && (
                  <button
                    type="button"
                    onClick={() => {
                      const uToEdit = viewingUser;
                      setViewingUser(null);
                      handleEditClick(uToEdit);
                    }}
                    className="flex items-center space-x-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-xl transition-all shadow-sm"
                  >
                    <Edit className="h-3.5 w-3.5" />
                    <span>Edit Profile</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setViewingUser(null)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl transition-colors"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit Drawer/Modal */}
      {editingUser && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-2xl border border-slate-200 p-6 space-y-4 shadow-2xl">
            <h3 className="text-base font-bold text-slate-900 border-b border-slate-100 pb-3">
              Edit Profile: {editingUser.fullName || editingUser.name}
            </h3>

            <form onSubmit={handleSave} className="space-y-4">
              <div>
                <label className="block text-[10px] uppercase font-bold text-slate-500 mb-1">Full Name</label>
                <input
                  type="text"
                  required
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full p-2.5 rounded-xl bg-slate-50 border border-slate-300 text-xs text-slate-900 focus:outline-none focus:border-indigo-600 focus:bg-white"
                />
              </div>

              {/* Roles change */}
              <div>
                <label className="block text-[10px] uppercase font-bold text-slate-500 mb-1">Role</label>
                <select
                  value={editRole}
                  onChange={(e) => setEditRole(e.target.value)}
                  className="w-full p-2.5 rounded-xl bg-slate-50 border border-slate-300 text-xs text-slate-900 focus:outline-none focus:border-indigo-600 focus:bg-white"
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
                  <label className="block text-[10px] uppercase font-bold text-slate-500 mb-1">Seniority</label>
                  <select
                    value={editExperience}
                    onChange={(e) => setEditExperience(e.target.value)}
                    className="w-full p-2.5 rounded-xl bg-slate-50 border border-slate-300 text-xs text-slate-900 focus:outline-none focus:border-indigo-600 focus:bg-white"
                  >
                    <option value="Beginner">Beginner</option>
                    <option value="Entry-Level">Entry-Level</option>
                    <option value="Mid-Level">Mid-Level</option>
                    <option value="Senior">Senior</option>
                    <option value="Expert">Expert</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] uppercase font-bold text-slate-500 mb-1">Availability</label>
                  <select
                    value={editAvailability ? 'true' : 'false'}
                    onChange={(e) => setEditAvailability(e.target.value === 'true')}
                    className="w-full p-2.5 rounded-xl bg-slate-50 border border-slate-300 text-xs text-slate-900 focus:outline-none focus:border-indigo-600 focus:bg-white"
                  >
                    <option value="true">Available</option>
                    <option value="false">Busy / Away</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[10px] uppercase font-bold text-slate-500 mb-1">
                  Skills (comma-separated)
                </label>
                <input
                  type="text"
                  value={editSkills}
                  onChange={(e) => setEditSkills(e.target.value)}
                  placeholder="React, Node.js, Express, MongoDB"
                  className="w-full p-2.5 rounded-xl bg-slate-50 border border-slate-300 text-xs text-slate-900 focus:outline-none focus:border-indigo-600 focus:bg-white"
                />
              </div>

              <div className="flex justify-end space-x-2 pt-4">
                <button
                  type="button"
                  onClick={() => setEditingUser(null)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-xl shadow-sm"
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

