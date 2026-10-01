import React, { useState } from 'react';
import { TabType, DoctorProfile, ActivityItem } from '../types';
import {
  Search,
  Bell,
  Menu,
  Plus,
  CalendarPlus,
  UserPlus,
  ShieldAlert,
  ChevronDown,
  CheckCircle2,
  SlidersHorizontal,
  X
} from 'lucide-react';

interface HeaderProps {
  activeTab: TabType;
  setActiveTab: (tab: TabType) => void;
  doctor: DoctorProfile;
  activities: ActivityItem[];
  onOpenScheduleModal: () => void;
  onToggleMobileMenu: () => void;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  isOnCall?: boolean;
  setIsOnCall?: (val: boolean) => void;
  onSignOut?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  setActiveTab,
  doctor,
  activities,
  onOpenScheduleModal,
  onToggleMobileMenu,
  searchQuery,
  setSearchQuery,
  isOnCall = false,
  setIsOnCall = (_: boolean) => {},
  onSignOut
}) => {
  const [showNotifications, setShowNotifications] = useState(false);
  const [showQuickActions, setShowQuickActions] = useState(false);
  const [showProfileMenu, setShowProfileMenu] = useState(false);

  const getTitle = () => {
    switch (activeTab) {
      case 'home':
        return 'Clinical Dashboard';
      case 'patients':
        return 'Patient Directory';
      case 'calendar':
        return 'Appointments & Schedule';
      case 'analytics':
        return 'Clinical Analytics';
      case 'settings':
        return 'Settings & Themes';
      default:
        return 'Clinical Portal';
    }
  };

  return (
    <header className="sticky top-0 z-30 bg-[#ffffff] border-b border-[#e0e3e5] px-4 lg:px-8 py-3.5 flex items-center justify-between gap-4">
      {/* Left: Mobile Menu Toggle & Title */}
      <div className="flex items-center gap-3">
        <button
          onClick={onToggleMobileMenu}
          className="lg:hidden p-2 text-[#43474e] hover:text-[#191c1e] hover:bg-[#f2f4f6] rounded-lg transition-colors"
        >
          <Menu className="w-5 h-5" />
        </button>
        <img
          src="/carelink.png"
          alt="CareLink Logo"
          className="w-8 h-8 rounded-lg object-contain lg:hidden border border-slate-200 p-0.5 shadow-sm"
        />
        <div>
          <h1 className="text-xl font-bold text-[#191c1e] tracking-tight">{getTitle()}</h1>
          <p className="text-xs text-[#74777f] hidden sm:block">CareLink Hospital Network • Cardiology Division</p>
        </div>
      </div>

      {/* Middle: Universal Search */}
      <div className="flex-1 max-w-md hidden md:block">
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-[#74777f]" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search patients by name, ID, or condition (e.g. PT-8472, Eleanor)..."
            className="w-full pl-10 pr-4 py-2 bg-[#f2f4f6] border border-transparent rounded-xl text-sm text-[#191c1e] placeholder-[#74777f] focus:outline-none focus:bg-white focus:border-[#316bf3] focus:ring-2 focus:ring-[#316bf3]/20 transition-all"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-[#74777f] hover:text-[#191c1e]"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Right: Quick Actions & Alerts */}
      <div className="flex items-center gap-2 sm:gap-3">
        {/* On-Call Toggle */}
        <div className="hidden lg:flex items-center gap-2 mr-2">
          <span className={`text-xs font-bold ${isOnCall ? 'text-[#ba1a1a]' : 'text-[#74777f]'}`}>
            On-Call
          </span>
          <button
            onClick={() => setIsOnCall(!isOnCall)}
            className={`w-10 h-5 rounded-full p-0.5 transition-colors ${isOnCall ? 'bg-[#ba1a1a]' : 'bg-[#e0e3e5]'}`}
          >
            <div className={`w-4 h-4 rounded-full bg-white transition-transform ${isOnCall ? 'translate-x-5' : 'translate-x-0'}`} />
          </button>
        </div>

        {/* Quick Action Dropdown */}
        <div className="relative">
          <button
            onClick={() => setShowQuickActions(!showQuickActions)}
            className="flex items-center gap-2 bg-[#316bf3] text-white px-3.5 py-2 rounded-xl text-sm font-semibold shadow-md shadow-[#316bf3]/20 hover:bg-[#0051d5] transition-all active:scale-95"
          >
            <Plus className="w-4 h-4" />
            <span className="hidden sm:inline">Quick Action</span>
            <ChevronDown className="w-3.5 h-3.5" />
          </button>

          {showQuickActions && (
            <div className="absolute right-0 mt-2 w-56 bg-white border border-[#e0e3e5] rounded-xl shadow-xl py-2 z-50 animate-in fade-in slide-in-from-top-2">
              <button
                onClick={() => {
                  setShowQuickActions(false);
                  onOpenScheduleModal();
                }}
                className="w-full text-left px-4 py-2.5 text-sm text-[#191c1e] hover:bg-[#f2f4f6] flex items-center gap-2.5 font-medium"
              >
                <CalendarPlus className="w-4 h-4 text-[#316bf3]" />
                <span>Schedule Appointment</span>
              </button>
            </div>
          )}
        </div>

        {/* Notifications Popover */}
        <div className="relative">
          <button
            onClick={() => setShowNotifications(!showNotifications)}
            className="relative p-2 text-[#43474e] hover:text-[#191c1e] hover:bg-[#f2f4f6] rounded-xl transition-colors"
            title="Notifications"
          >
            <Bell className="w-5 h-5" />
            <span className="absolute top-1.5 right-1.5 w-2.5 h-2.5 bg-[#ba1a1a] rounded-full ring-2 ring-white" />
          </button>

          {showNotifications && (
            <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white border border-[#e0e3e5] rounded-2xl shadow-2xl py-3 z-50 animate-in fade-in slide-in-from-top-2">
              <div className="px-4 pb-2 border-b border-[#e0e3e5] flex items-center justify-between">
                <h3 className="font-bold text-[#191c1e] text-sm flex items-center gap-2">
                  Notifications
                  <span className="bg-[#316bf3] text-white text-[10px] px-2 py-0.5 rounded-full font-semibold">
                    {activities.length} New
                  </span>
                </h3>
                <button
                  onClick={() => setShowNotifications(false)}
                  className="text-xs text-[#316bf3] hover:underline font-semibold"
                >
                  Mark all as read
                </button>
              </div>

              <div className="max-h-72 overflow-y-auto divide-y divide-[#f2f4f6]">
                {activities.slice(0, 5).map((act) => (
                  <div key={act.id} className="p-3 hover:bg-[#f7f9fb] transition-colors flex items-start gap-3">
                    <span className={`w-2 h-2 rounded-full mt-2 shrink-0 ${act.statusColor || 'bg-[#316bf3]'}`} />
                    <div className="flex-1">
                      <p className="text-xs font-semibold text-[#191c1e]">{act.description}</p>
                      <p className="text-[11px] text-[#74777f] mt-0.5">{act.timestamp}</p>
                    </div>
                  </div>
                ))}
              </div>

              <div className="pt-2 px-4 border-t border-[#e0e3e5] text-center">
                <button
                  onClick={() => {
                    setShowNotifications(false);
                    setActiveTab('home');
                  }}
                  className="text-xs font-semibold text-[#316bf3] hover:underline"
                >
                  View All Activity Feed
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Doctor Avatar Header Button */}
        <div className="relative pl-2 border-l border-[#e0e3e5]">
          <button
            onClick={() => setShowProfileMenu(!showProfileMenu)}
            className="flex items-center gap-2.5 p-1 rounded-xl hover:bg-[#f2f4f6] transition-colors"
          >
            <img
              src={doctor.avatarUrl}
              alt={doctor.name}
              className="w-8 h-8 rounded-full object-cover ring-2 ring-[#316bf3]/30"
            />
            <div className="text-left hidden xl:block">
              <p className="text-xs font-bold text-[#191c1e] leading-tight">{doctor.name}</p>
              <p className="text-[10px] text-[#74777f]">{doctor.department}</p>
            </div>
          </button>

          {showProfileMenu && (
            <div className="absolute right-0 mt-2 w-60 bg-white border border-[#e0e3e5] rounded-xl shadow-xl py-2 z-50">
              <div className="px-4 py-2 border-b border-[#e0e3e5]">
                <p className="text-xs font-bold text-[#191c1e]">{doctor.name}</p>
                <p className="text-[11px] text-[#74777f]">{doctor.email}</p>
              </div>
              <button
                onClick={() => {
                  setShowProfileMenu(false);
                  setActiveTab('settings');
                }}
                className="w-full text-left px-4 py-2 text-xs text-[#191c1e] hover:bg-[#f2f4f6]"
              >
                Settings & Themes
              </button>
              <button
                onClick={() => {
                  setShowProfileMenu(false);
                  if (onSignOut) {
                    onSignOut();
                  } else {
                    setActiveTab('login');
                  }
                }}
                className="w-full text-left px-4 py-2 text-xs text-[#ba1a1a] hover:bg-[#ffdad6]/40 font-semibold"
              >
                Sign Out
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
