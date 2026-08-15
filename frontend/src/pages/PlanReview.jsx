import React, { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import api from '../utils/api';
import { Check, Edit, Trash, Plus, ShieldCheck, RefreshCw } from 'lucide-react';

const PlanReview = () => {
  const location = useLocation();
  const navigate = useNavigate();

  // If page loaded directly without navigation state, redirect to projects creation
  if (!location.state || !location.state.plan) {
    React.useEffect(() => {
      navigate('/projects/new');
    }, [navigate]);
    return null;
  }

  const { project, plan } = location.state;
  const [tasks, setTasks] = useState(plan.tasks || []);
  const [modules, setModules] = useState(plan.modules || []);
  const [editingIndex, setEditingIndex] = useState(null);
  const [editTaskData, setEditTaskData] = useState({});
  const [importing, setImporting] = useState(false);

  const handleEditClick = (index) => {
    setEditingIndex(index);
    setEditTaskData({ ...tasks[index] });
  };

  const handleSaveEdit = () => {
    const updated = [...tasks];
    updated[editingIndex] = {
      ...editTaskData,
      required_skills: typeof editTaskData.required_skills === 'string'
        ? editTaskData.required_skills.split(',').map(s => s.trim())
        : editTaskData.required_skills
    };
    setTasks(updated);
    setEditingIndex(null);
  };

  const handleDeleteTask = (index) => {
    setTasks(tasks.filter((_, idx) => idx !== index));
  };

  const handleAddTask = () => {
    const newTask = {
      title: `New Task ${tasks.length + 1}`,
      description: 'Describe task objectives.',
      module: modules.length > 0 ? modules[0].name : 'General',
      required_skills: ['React'],
      priority: 'Medium',
      complexity: 'Medium',
      dependencies: []
    };
    setTasks([...tasks, newTask]);
    handleEditClick(tasks.length);
  };

  const handleApprove = async () => {
    setImporting(true);
    const targetProjectId = project.id || project._id;
    try {
      await api.post('/api/ai/import-plan', {
        projectId: targetProjectId,
        tasks
      });
      navigate(`/projects/${targetProjectId}`);
    } catch (error) {
      console.error('Import plan error:', error);
      alert(error.response?.data?.error || 'Failed to import plan. Please verify task details.');
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold text-slate-900">AI Plan Review</h1>
          <p className="text-slate-500 text-sm mt-1">
            Review and customize the generated modules & tasks for project <span className="text-indigo-600 font-semibold">"{project.name}"</span>
          </p>
        </div>

        <div className="flex items-center space-x-3">
          <button
            onClick={() => navigate('/projects/new')}
            className="px-4 py-2.5 bg-white hover:bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700 font-semibold transition-colors flex items-center space-x-2 shadow-sm"
          >
            <RefreshCw className="h-4 w-4 text-slate-500" />
            <span>Regenerate</span>
          </button>

          <button
            onClick={handleApprove}
            disabled={importing}
            className="px-5 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 font-semibold text-xs text-white rounded-xl shadow-md shadow-emerald-600/20 active:scale-[0.98] transition-all flex items-center space-x-2 disabled:opacity-50"
          >
            <ShieldCheck className="h-4.5 w-4.5" />
            <span>{importing ? 'Importing...' : 'Approve & Import Plan'}</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Modules summary */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm h-fit">
          <h3 className="text-base font-bold text-slate-900 mb-4">Identified Modules</h3>
          <div className="space-y-3">
            {modules.map((mod, idx) => (
              <div key={idx} className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
                <h4 className="text-xs font-semibold text-indigo-700">{mod.name}</h4>
                <p className="text-[11px] text-slate-600 mt-1 leading-relaxed">{mod.description}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Tasks review */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-bold text-slate-900">Generated Task List ({tasks.length})</h3>
            <button
              onClick={handleAddTask}
              className="px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 text-indigo-700 text-xs font-semibold rounded-xl flex items-center space-x-1.5 transition-colors"
            >
              <Plus className="h-4 w-4" />
              <span>Add Task</span>
            </button>
          </div>

          <div className="space-y-3">
            {tasks.map((task, idx) => (
              <div key={idx} className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm relative group">
                {editingIndex === idx ? (
                  /* Edit Task View */
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[10px] uppercase font-bold text-slate-500 mb-1">Task Title</label>
                        <input
                          type="text"
                          value={editTaskData.title}
                          onChange={(e) => setEditTaskData({ ...editTaskData, title: e.target.value })}
                          className="w-full p-2 rounded-lg bg-slate-50 border border-slate-300 text-slate-900 text-xs focus:outline-none focus:border-indigo-600 focus:bg-white"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] uppercase font-bold text-slate-500 mb-1">Module</label>
                        <select
                          value={editTaskData.module}
                          onChange={(e) => setEditTaskData({ ...editTaskData, module: e.target.value })}
                          className="w-full p-2 rounded-lg bg-slate-50 border border-slate-300 text-slate-900 text-xs focus:outline-none focus:border-indigo-600 focus:bg-white"
                        >
                          {modules.map((m, mIdx) => (
                            <option key={mIdx} value={m.name}>{m.name}</option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div>
                      <label className="block text-[10px] uppercase font-bold text-slate-500 mb-1">Description</label>
                      <textarea
                        rows={2}
                        value={editTaskData.description}
                        onChange={(e) => setEditTaskData({ ...editTaskData, description: e.target.value })}
                        className="w-full p-2 rounded-lg bg-slate-50 border border-slate-300 text-slate-900 text-xs resize-none focus:outline-none focus:border-indigo-600 focus:bg-white"
                      />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div>
                        <label className="block text-[10px] uppercase font-bold text-slate-500 mb-1">Priority</label>
                        <select
                          value={editTaskData.priority}
                          onChange={(e) => setEditTaskData({ ...editTaskData, priority: e.target.value })}
                          className="w-full p-2 rounded-lg bg-slate-50 border border-slate-300 text-slate-900 text-xs focus:outline-none focus:border-indigo-600 focus:bg-white"
                        >
                          <option value="Low">Low</option>
                          <option value="Medium">Medium</option>
                          <option value="High">High</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-[10px] uppercase font-bold text-slate-500 mb-1">Complexity</label>
                        <select
                          value={editTaskData.complexity}
                          onChange={(e) => setEditTaskData({ ...editTaskData, complexity: e.target.value })}
                          className="w-full p-2 rounded-lg bg-slate-50 border border-slate-300 text-slate-900 text-xs focus:outline-none focus:border-indigo-600 focus:bg-white"
                        >
                          <option value="Low">Low</option>
                          <option value="Medium">Medium</option>
                          <option value="High">High</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-[10px] uppercase font-bold text-slate-500 mb-1">Skills (comma-separated)</label>
                        <input
                          type="text"
                          value={Array.isArray(editTaskData.required_skills) ? editTaskData.required_skills.join(', ') : editTaskData.required_skills}
                          onChange={(e) => setEditTaskData({ ...editTaskData, required_skills: e.target.value })}
                          className="w-full p-2 rounded-lg bg-slate-50 border border-slate-300 text-slate-900 text-xs focus:outline-none focus:border-indigo-600 focus:bg-white"
                        />
                      </div>
                    </div>

                    <div className="flex justify-end space-x-2 pt-2">
                      <button
                        onClick={() => setEditingIndex(null)}
                        className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={handleSaveEdit}
                        className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-lg shadow-sm"
                      >
                        Save Edits
                      </button>
                    </div>
                  </div>
                ) : (
                  /* Standard Task Card View */
                  <div>
                    <div className="flex items-start justify-between">
                      <div>
                        <span className="text-[9px] uppercase font-bold px-2 py-0.5 bg-indigo-50 text-indigo-700 border border-indigo-100 rounded-full">
                          {task.module}
                        </span>
                        <h4 className="text-sm font-semibold text-slate-900 mt-2">{task.title}</h4>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => handleEditClick(idx)}
                          className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-slate-100 rounded-lg transition-colors"
                          title="Edit Task"
                        >
                          <Edit className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteTask(idx)}
                          className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-slate-100 rounded-lg transition-colors"
                          title="Delete Task"
                        >
                          <Trash className="h-4 w-4" />
                        </button>
                      </div>
                    </div>

                    <p className="text-xs text-slate-600 mt-2 leading-relaxed">{task.description}</p>

                    <div className="flex flex-wrap gap-4 mt-4 text-[10px] border-t border-slate-100 pt-3">
                      <div>
                        <span className="text-slate-400">Skills: </span>
                        <span className="text-slate-700 font-semibold">
                          {Array.isArray(task.required_skills) ? task.required_skills.join(', ') : task.required_skills}
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-400">Priority: </span>
                        <span className={`font-semibold ${
                          task.priority === 'High' ? 'text-rose-600' :
                          task.priority === 'Medium' ? 'text-amber-600' : 'text-slate-600'
                        }`}>{task.priority}</span>
                      </div>
                      <div>
                        <span className="text-slate-400">Complexity: </span>
                        <span className="text-slate-700 font-semibold">{task.complexity}</span>
                      </div>
                      {task.dependencies && task.dependencies.length > 0 && (
                        <div className="w-full mt-1">
                          <span className="text-slate-400">Depends on: </span>
                          <span className="text-indigo-600 font-semibold">{task.dependencies.join(', ')}</span>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default PlanReview;
