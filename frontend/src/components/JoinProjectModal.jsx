import React, { useState } from 'react';
import api from '../utils/api';
import { KeyRound, X, CheckCircle2, AlertCircle, Sparkles } from 'lucide-react';

const JoinProjectModal = ({ isOpen, onClose, onSuccess }) => {
  const [projectCode, setProjectCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    const code = projectCode.trim().toUpperCase();
    if (!code) {
      setError('Please enter a valid Project Code.');
      return;
    }

    setLoading(true);

    try {
      const res = await api.post('/api/projects/join', { projectCode: code });
      setSuccess(res.data.message || 'Join request sent successfully! Waiting for project owner approval.');
      setProjectCode('');
      
      if (onSuccess) {
        onSuccess(res.data);
      }

      setTimeout(() => {
        setSuccess('');
        onClose();
      }, 2000);
    } catch (err) {
      setError(err.response?.data?.error || 'Invalid project code or failed to send join request.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-md z-50 flex items-center justify-center p-4 animate-fadeIn">
      <div className="glass w-full max-w-md rounded-2xl border border-white/10 p-6 space-y-5 relative z-10 shadow-2xl">
        <div className="flex items-center justify-between border-b border-white/5 pb-4">
          <div className="flex items-center space-x-2.5">
            <div className="p-2 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400">
              <KeyRound className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white tracking-tight">Join a Project</h3>
              <p className="text-xs text-slate-400">Enter a 6-character Project Code</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-white/5 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {error && (
          <div className="p-3.5 bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs rounded-xl flex items-center space-x-2">
            <AlertCircle className="h-4 w-4 shrink-0 text-rose-400" />
            <span>{error}</span>
          </div>
        )}

        {success && (
          <div className="p-3.5 bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs rounded-xl flex items-center space-x-2">
            <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" />
            <span>{success}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5 pl-1">
              Project Code
            </label>
            <div className="relative">
              <input
                type="text"
                required
                value={projectCode}
                onChange={(e) => setProjectCode(e.target.value.toUpperCase())}
                placeholder="e.g. DP-X7K9M2"
                maxLength={10}
                className="w-full py-3.5 px-4 font-mono text-center text-lg font-bold tracking-widest rounded-xl glass-input text-indigo-300 placeholder-slate-600 uppercase"
              />
            </div>
            <span className="text-[11px] text-slate-500 pl-1 mt-1 block">
              Ask your Project Owner for their unique DP-XXXXXX code.
            </span>
          </div>

          <div className="flex justify-end space-x-2.5 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 bg-white/5 hover:bg-white/10 text-slate-400 text-xs font-semibold rounded-xl transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || !projectCode.trim()}
              className="px-5 py-2.5 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 font-semibold text-xs text-white shadow-lg shadow-indigo-600/20 active:scale-[0.98] transition-all disabled:opacity-50 flex items-center space-x-1.5"
            >
              {loading ? (
                <span>Sending Request...</span>
              ) : (
                <>
                  <Sparkles className="h-3.5 w-3.5" />
                  <span>Send Join Request</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default JoinProjectModal;
