import React, { useState, useEffect } from 'react';
import api from '../utils/api';
import { Cpu, AlertTriangle, ShieldCheck, HelpCircle, Activity, LayoutList } from 'lucide-react';

const AIInsights = () => {
  const [projects, setProjects] = useState([]);
  const [selectedProjectId, setSelectedProjectId] = useState('');
  const [analysis, setAnalysis] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchProjects = async () => {
      try {
        const res = await api.get('/api/projects');
        setProjects(res.data);
        if (res.data.length > 0) {
          setSelectedProjectId(res.data[0].id);
        }
      } catch (err) {
        console.error(err);
      }
    };
    fetchProjects();
  }, []);

  const handleAnalyze = async () => {
    if (!selectedProjectId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await api.post(`/api/ai/analyze-project/${selectedProjectId}`);
      setAnalysis(res.data);
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.error || 'AI analysis failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-extrabold text-white">AI Project Insights</h1>
        <p className="text-slate-400 text-sm mt-1">Audit timeline risks, resource constraints, and receive task schedule recommendations</p>
      </div>

      <div className="glass p-6 rounded-2xl border border-white/5 max-w-xl flex flex-col sm:flex-row sm:items-end gap-4">
        <div className="flex-1">
          <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1.5 pl-1">Project Workspace</label>
          <select
            value={selectedProjectId}
            onChange={(e) => setSelectedProjectId(e.target.value)}
            className="w-full p-3 rounded-xl glass-input text-xs outline-none"
          >
            <option value="">Select project...</option>
            {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>

        <button
          onClick={handleAnalyze}
          disabled={loading || !selectedProjectId}
          className="px-6 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 font-semibold text-xs text-white rounded-xl shadow-lg shadow-indigo-600/20 active:scale-[0.98] transition-all flex items-center justify-center space-x-2 disabled:opacity-50"
        >
          <Cpu className="h-4.5 w-4.5" />
          <span>{loading ? 'Analyzing...' : 'Run Diagnostics'}</span>
        </button>
      </div>

      {error && (
        <div className="p-4 bg-rose-500/15 border border-rose-500/30 text-rose-300 text-sm rounded-xl max-w-xl">
          {error}
        </div>
      )}

      {analysis ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Risk Card */}
          <div className={`glass p-6 rounded-2xl border flex flex-col justify-between ${
            analysis.risk_level === 'High' ? 'border-rose-500/20 bg-rose-950/5' :
            analysis.risk_level === 'Medium' ? 'border-amber-500/20 bg-amber-950/5' :
            'border-emerald-500/20 bg-emerald-950/5'
          }`}>
            <div>
              <span className="text-[10px] uppercase font-bold text-slate-400">Timeline Slip Risk</span>
              <div className="flex items-center space-x-2 mt-2">
                <AlertTriangle className={`h-6 w-6 ${
                  analysis.risk_level === 'High' ? 'text-rose-400' :
                  analysis.risk_level === 'Medium' ? 'text-amber-400' : 'text-emerald-400'
                }`} />
                <h3 className="text-2xl font-extrabold text-white uppercase">{analysis.risk_level} Risk</h3>
              </div>
            </div>

            <p className="text-xs text-slate-300 mt-6 leading-relaxed">
              Diagnostics indicate that current tasks are balancing workloads moderately, but critical path elements should be monitored closely to secure sprint goals.
            </p>
          </div>

          {/* Diagnostic reasoning details */}
          <div className="lg:col-span-2 glass p-6 rounded-2xl border border-white/5 space-y-5">
            <div>
              <h4 className="text-xs font-bold uppercase text-slate-500 tracking-wider">Root Cause Diagnostics</h4>
              <p className="text-xs text-slate-200 mt-2 leading-relaxed bg-white/5 border border-white/5 rounded-xl p-4">
                {analysis.reason}
              </p>
            </div>

            <div>
              <h4 className="text-xs font-bold uppercase text-slate-500 tracking-wider">AI Mitigation Strategy</h4>
              <p className="text-xs text-indigo-300 mt-2 leading-relaxed bg-indigo-950/15 border border-indigo-500/10 rounded-xl p-4">
                {analysis.recommendation}
              </p>
            </div>
          </div>
        </div>
      ) : (
        !loading && (
          <div className="p-10 border border-dashed border-white/5 rounded-2xl text-center text-xs text-slate-500 max-w-xl mx-auto">
            Select a project workspace and execute the diagnostics tool to audit health indexes.
          </div>
        )
      )}
    </div>
  );
};

export default AIInsights;
