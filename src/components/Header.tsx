import React, { useState } from 'react';
import { Bell, Search, Settings, User, LogOut } from 'lucide-react';

interface HeaderProps {
  title: string;
  subtitle: string;
  color: string;
  onLogout: () => void;
  userEmail: string;
}

const Header: React.FC<HeaderProps> = ({ title, subtitle, color, onLogout, userEmail }) => {
  const [showNotif, setShowNotif] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);

  return (
    <header className="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-6 sticky top-0 z-40 shadow-sm">
      <div>
        <h1 className="text-xl font-bold text-gray-800" style={{ color }}>
          {title}
        </h1>
        <p className="text-xs text-gray-500">{subtitle}</p>
      </div>

      <div className="flex items-center gap-3">
        {/* Search */}
        <div className="relative hidden md:block">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search..."
            className="pl-9 pr-4 py-2 bg-gray-100 rounded-xl text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-purple-300 w-52"
          />
        </div>

        {/* Notification */}
        <div className="relative">
          <button
            onClick={() => { setShowNotif(!showNotif); setShowUserMenu(false); }}
            className="relative w-9 h-9 rounded-xl bg-gray-100 hover:bg-gray-200 flex items-center justify-center transition-colors"
          >
            <Bell size={17} className="text-gray-600" />
            <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full"></span>
          </button>
          {showNotif && (
            <div className="absolute right-0 top-12 w-72 bg-white shadow-xl rounded-2xl border border-gray-100 overflow-hidden z-50">
              <div className="px-4 py-3 border-b border-gray-100 font-semibold text-gray-700 text-sm">Notifications</div>
              {[
                { msg: '3 new purchase orders pending approval', time: '2m ago', dot: 'bg-blue-500' },
                { msg: 'Low stock alert: Product SKU-1042', time: '15m ago', dot: 'bg-orange-500' },
                { msg: 'New employee onboarding request', time: '1h ago', dot: 'bg-green-500' },
                { msg: 'Invoice #INV-2024-089 overdue', time: '3h ago', dot: 'bg-red-500' },
              ].map((n, i) => (
                <div key={i} className="px-4 py-3 hover:bg-gray-50 flex items-start gap-3 cursor-pointer border-b border-gray-50">
                  <span className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${n.dot}`}></span>
                  <div>
                    <p className="text-xs text-gray-700">{n.msg}</p>
                    <p className="text-[10px] text-gray-400 mt-0.5">{n.time}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Settings */}
        <button className="w-9 h-9 rounded-xl bg-gray-100 hover:bg-gray-200 flex items-center justify-center transition-colors">
          <Settings size={17} className="text-gray-600" />
        </button>

        {/* User + Logout dropdown */}
        <div className="relative">
          <button
            onClick={() => { setShowUserMenu(!showUserMenu); setShowNotif(false); }}
            className="flex items-center gap-2 cursor-pointer ml-1 hover:opacity-80 transition-opacity"
          >
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center">
              <User size={17} className="text-white" />
            </div>
            <div className="hidden md:block text-left">
              <p className="text-sm font-semibold text-gray-700 leading-none">Punjab Hitech</p>
              <p className="text-xs text-gray-400 mt-0.5 max-w-[140px] truncate">{userEmail}</p>
            </div>
          </button>

          {showUserMenu && (
            <div className="absolute right-0 top-12 w-56 bg-white shadow-xl rounded-2xl border border-gray-100 overflow-hidden z-50">
              <div className="px-4 py-3 border-b border-gray-100">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Signed in as</p>
                <p className="text-sm text-gray-700 mt-0.5 truncate">{userEmail}</p>
              </div>
              <button
                onClick={onLogout}
                className="w-full flex items-center gap-3 px-4 py-3 text-sm text-red-600 hover:bg-red-50 transition-colors"
              >
                <LogOut size={15} />
                Sign Out
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};

export default Header;
