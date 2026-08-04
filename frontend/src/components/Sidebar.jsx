import React from 'react';
import { NavLink } from 'react-router-dom';
import { LayoutDashboard, FolderKanban, Users, Github, BrainCircuit } from 'lucide-react';

const Sidebar = () => {
  const links = [
    { to: '/', label: 'Dashboard', icon: LayoutDashboard },
    { to: '/projects', label: 'Projects & Kanban', icon: FolderKanban },
    { to: '/team', label: 'Team Directory', icon: Users },
    { to: '/github', label: 'GitHub Sync', icon: Github },
    { to: '/ai-insights', label: 'AI Analytics', icon: BrainCircuit }
  ];

  return (
    <aside className="w-64 glass border-r border-white/5 min-h-[calc(100vh-73px)] p-4 flex flex-col justify-between hidden md:flex">
      <div className="space-y-2">
        <span className="text-[10px] uppercase font-bold text-slate-500 tracking-widest pl-3 block mb-4">
          Navigation Menu
        </span>
        <nav className="space-y-1">
          {links.map((link) => {
            const Icon = link.icon;
            return (
              <NavLink
                key={link.to}
                to={link.to}
                className={({ isActive }) => 
                  `flex items-center space-x-3 px-4 py-3 rounded-xl transition-all duration-200 group ${
                    isActive 
                      ? 'bg-gradient-to-r from-indigo-600/30 to-purple-600/30 border border-indigo-500/20 text-white font-medium shadow-md shadow-indigo-950/20' 
                      : 'text-slate-400 hover:text-slate-200 hover:bg-white/5 border border-transparent'
                  }`
                }
              >
                {({ isActive }) => (
                  <>
                    <Icon className={`h-5 w-5 transition-transform duration-200 group-hover:scale-105 ${isActive ? 'text-indigo-400' : 'text-slate-400 group-hover:text-slate-300'}`} />
                    <span>{link.label}</span>
                  </>
                )}
              </NavLink>
            );
          })}
        </nav>
      </div>

      <div className="p-3 bg-white/5 border border-white/5 rounded-2xl">
        <p className="text-[11px] font-semibold text-slate-400">DevPilot Sandbox Mode</p>
        <span className="text-[10px] block text-slate-500 mt-1">SQLite Fallback active</span>
      </div>
    </aside>
  );
};

export default Sidebar;
