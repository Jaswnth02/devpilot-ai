import React, { useContext, useState } from 'react';
import { AuthContext } from '../context/AuthContext';
import { SocketContext } from '../context/SocketContext';
import { Bell, LogOut, Activity } from 'lucide-react';

const Navbar = () => {
  const { user, logout } = useContext(AuthContext);
  const { notifications, clearNotifications } = useContext(SocketContext);
  const [showNotifications, setShowNotifications] = useState(false);

  return (
    <nav className="bg-white/90 backdrop-blur-md sticky top-0 z-50 px-6 py-4 flex items-center justify-between border-b border-slate-200 shadow-sm">
      {/* Brand logo */}
      <div className="flex items-center space-x-3">
        <div className="bg-gradient-to-tr from-indigo-600 to-purple-600 p-2.5 rounded-xl shadow-md shadow-indigo-500/20">
          <Activity className="h-6 w-6 text-white" />
        </div>
        <div>
          <span className="text-xl font-bold tracking-tight text-slate-900 font-sans">
            DevPilot <span className="text-gradient">AI</span>
          </span>
          <span className="text-xs block text-slate-500 font-medium">Intelligent Planning Platform</span>
        </div>
      </div>

      {/* User profile + Notifications */}
      <div className="flex items-center space-x-4">
        {/* Notifications Icon */}
        <div className="relative">
          <button 
            onClick={() => setShowNotifications(!showNotifications)}
            className="p-2 text-slate-500 hover:text-slate-800 rounded-lg hover:bg-slate-100 transition-colors relative"
          >
            <Bell className="h-5 w-5" />
            {notifications.length > 0 && (
              <span className="absolute top-1 right-1 flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-rose-500"></span>
              </span>
            )}
          </button>

          {/* Notifications Dropdown */}
          {showNotifications && (
            <div className="absolute right-0 mt-3 w-80 bg-white rounded-xl shadow-xl border border-slate-200 p-4 z-50 max-h-96 overflow-y-auto">
              <div className="flex items-center justify-between mb-3 border-b border-slate-100 pb-2">
                <h4 className="font-semibold text-sm text-slate-800">Alerts & Notifications</h4>
                {notifications.length > 0 && (
                  <button 
                    onClick={clearNotifications}
                    className="text-xs text-indigo-600 hover:text-indigo-700 font-medium"
                  >
                    Clear all
                  </button>
                )}
              </div>
              
              {notifications.length === 0 ? (
                <p className="text-xs text-slate-500 py-6 text-center">No new notifications</p>
              ) : (
                <div className="space-y-3">
                  {notifications.map((notif, index) => (
                    <div key={index} className="p-2.5 rounded-lg bg-slate-50 border border-slate-100 hover:bg-slate-100 transition-colors">
                      <p className="text-xs font-semibold text-indigo-600">{notif.title}</p>
                      <p className="text-xs text-slate-600 mt-1">{notif.message}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* User Card */}
        {user && (
          <div className="flex items-center space-x-3 border-l border-slate-200 pl-4">
            <div className="text-right hidden sm:block">
              <p className="text-sm font-semibold text-slate-800">{user.name}</p>
              <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">
                {user.role}
              </span>
            </div>
            <div className="h-9 w-9 rounded-full bg-gradient-to-tr from-indigo-600 to-purple-600 flex items-center justify-center font-bold text-white text-sm shadow-md">
              {user.name ? user.name.charAt(0).toUpperCase() : 'U'}
            </div>
            
            <button 
              onClick={logout}
              title="Logout"
              className="p-2 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-slate-100 transition-colors"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>
    </nav>
  );
};

export default Navbar;
