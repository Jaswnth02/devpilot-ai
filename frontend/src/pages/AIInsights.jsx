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
        <h1 className="text-3xl font-extrabold text-slate-900">AI Project Insights</h1>
        <p className="text-slate-500 text-sm mt-1">Audit timeline risks, resource constraints, and receive task schedule recommendations</p>
      </div>

      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm max-w-xl flex flex-col sm:flex-row sm:items-end gap-4">
        <div className="flex-1">
          <label className="block text-[10px] uppercase font-bold text-slate-500 mb-1.5 pl-1">Project Workspace</label>
          <select
            value={selectedProjectId}
            onChange={(e) => setSelectedProjectId(e.target.value)}
            className="w-full p-3 rounded-xl bg-slate-50 border border-slate-300 text-slate-900 text-xs focus:outline-none focus:border-indigo-600 focus:bg-white"
          >
            <option value="">Select project...</option>
            {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>

        <button
          onClick={handleAnalyze}
          disabled={loading || !selectedProjectId}
          className="px-6 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 font-semibold text-xs text-white rounded-xl shadow-md shadow-indigo-600/20 active:scale-[0.98] transition-all flex items-center justify-center space-x-2 disabled:opacity-50"
        >
          <Cpu className="h-4.5 w-4.5" />
          <span>{loading ? 'Analyzing...' : 'Run Diagnostics'}</span>
        </button>
      </div>

      {error && (
        <div className="p-4 bg-rose-50 border border-rose-200 text-rose-800 text-sm rounded-xl max-w-xl">
          {error}
        </div>
      )}

      {analysis ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Risk Card */}
          <div className={`bg-white p-6 rounded-2xl border shadow-sm flex flex-col justify-between ${
            analysis.risk_level === 'High' ? 'border-rose-200 bg-rose-50/30' :
            analysis.risk_level === 'Medium' ? 'border-amber-200 bg-amber-50/30' :
            'border-emerald-200 bg-emerald-50/30'
          }`}>
            <div>
              <span className="text-[10px] uppercase font-bold text-slate-500">Timeline Slip Risk</span>
              <div className="flex items-center space-x-2 mt-2">
                <AlertTriangle className={`h-6 w-6 ${
                  analysis.risk_level === 'High' ? 'text-rose-600' :
                  analysis.risk_level === 'Medium' ? 'text-amber-500' : 'text-emerald-600'
                }`} />
                <h3 className="text-2xl font-extrabold text-slate-900 uppercase">{analysis.risk_level} Risk</h3>
              </div>
            </div>

            <p className="text-xs text-slate-600 mt-6 leading-relaxed">
              Diagnostics indicate that current tasks are balancing workloads moderately, but critical path elements should be monitored closely to secure sprint goals.
            </p>
          </div>

          {/* Diagnostic reasoning details */}
          <div className="lg:col-span-2 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-5">
            <div>
              <h4 className="text-xs font-bold uppercase text-slate-500 tracking-wider">Root Cause Diagnostics</h4>
              <p className="text-xs text-slate-800 mt-2 leading-relaxed bg-slate-50 border border-slate-200 rounded-xl p-4">
                {analysis.reason}
              </p>
            </div>

            <div>
              <h4 className="text-xs font-bold uppercase text-slate-500 tracking-wider">AI Mitigation Strategy</h4>
              <p className="text-xs text-indigo-900 mt-2 leading-relaxed bg-indigo-50 border border-indigo-100 rounded-xl p-4">
                {analysis.recommendation}
              </p>
            </div>
          </div>
        </div>
      ) : (
        !loading && (
          <div className="p-10 border border-dashed border-slate-200 rounded-2xl text-center text-xs text-slate-500 max-w-xl mx-auto bg-white">
            Select a project workspace and execute the diagnostics tool to audit health indexes.
          </div>
        )
      )}
    </div>
  );
};

export default AIInsights;
