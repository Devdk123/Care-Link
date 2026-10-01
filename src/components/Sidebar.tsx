import React from 'react';
import { TabType, DoctorProfile } from '../types';
import {
  LayoutDashboard,
  Users,
  Calendar,
  BarChart3,
  LogOut,
  BookOpen,
  Globe,
  ShieldCheck,
  Bot
} from 'lucide-react';

interface SidebarProps {
  activeTab: TabType;
  setActiveTab: (tab: TabType) => void;
  doctor: DoctorProfile;
  onSignOut: () => void;
  isOpenMobile?: boolean;
  setIsOpenMobile?: (open: boolean) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  setActiveTab,
  doctor,
  onSignOut,
  isOpenMobile,
  setIsOpenMobile
}) => {
  const mainNavItems = [
    { id: 'home' as TabType, label: 'Dashboard', icon: LayoutDashboard },
    { id: 'cockpit' as TabType, label: 'Agent Cockpit', icon: Bot, badge: 'AI' },
    { id: 'patients' as TabType, label: 'Patients', icon: Users, badge: '247' },
    { id: 'calendar' as TabType, label: 'Calendar', icon: Calendar, badge: '6' },
    { id: 'analytics' as TabType, label: 'Analytics', icon: BarChart3 }
  ];

  const subNavItems = [
    { id: 'landing' as TabType, label: 'Public Site & ML Simulator', icon: Globe },
    { id: 'settings' as TabType, label: 'Settings & Themes', icon: BookOpen }
  ];

  const handleSelect = (tab: TabType) => {
    setActiveTab(tab);
    if (setIsOpenMobile) setIsOpenMobile(false);
  };

  return (
    <>
      {/* Mobile Backdrop */}
      {isOpenMobile && (
        <div
          className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40 lg:hidden"
          onClick={() => setIsOpenMobile && setIsOpenMobile(false)}
        />
      )}

      <aside
        className={`fixed top-0 left-0 bottom-0 z-50 w-64 bg-white border-r border-[#e2e8f0] text-[#0f172a] flex flex-col justify-between transition-transform duration-300 ease-in-out lg:translate-x-0 ${
          isOpenMobile ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div>
          {/* Brand Header */}
          <div className="p-6 flex items-center gap-3 border-b border-[#f1f5f9]">
            <img
              src="/carelink.png"
              alt="CareLink Logo"
              className="w-10 h-10 rounded-xl object-contain shadow-md shadow-sky-500/10 border border-slate-100 bg-white p-0.5"
            />
            <div>
              <h1 className="text-lg font-bold tracking-tight text-[#0f172a] flex items-center gap-1.5">
                CareLink
                <span className="text-[10px] font-bold uppercase tracking-wider bg-[#e0f2fe] text-[#0284c7] border border-[#bae6fd] px-1.5 py-0.5 rounded">
                  v2.4
                </span>
              </h1>
              <p className="text-xs text-[#64748b]">Clinical Management</p>
            </div>
          </div>

          {/* Primary Navigation */}
          <div className="px-3 py-6">
            <p className="px-3 text-[11px] font-bold text-[#94a3b8] uppercase tracking-wider mb-2">
              Main Menu
            </p>
            <nav className="space-y-1">
              {mainNavItems.map((item) => {
                const Icon = item.icon;
                const isActive = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => handleSelect(item.id)}
                    className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 cursor-pointer ${
                      isActive
                        ? 'bg-[#0284c7] text-white shadow-md shadow-[#0284c7]/25 font-bold'
                        : 'text-[#475569] hover:bg-[#f8fafc] hover:text-[#0f172a]'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <Icon className={`w-5 h-5 ${isActive ? 'text-white' : 'text-[#64748b]'}`} />
                      <span>{item.label}</span>
                    </div>
                    {item.badge && (
                      <span
                        className={`text-xs px-2 py-0.5 rounded-full font-semibold ${
                          isActive
                            ? 'bg-white/25 text-white'
                            : 'bg-[#f1f5f9] text-[#64748b]'
                        }`}
                      >
                        {item.badge}
                      </span>
                    )}
                  </button>
                );
              })}
            </nav>

            {/* Design System & System Demo Navigation */}
            <p className="px-3 text-[11px] font-bold text-[#94a3b8] uppercase tracking-wider mt-6 mb-2">
              System & Demos
            </p>
            <nav className="space-y-1">
              {subNavItems.map((item) => {
                const Icon = item.icon;
                const isActive = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => handleSelect(item.id)}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 cursor-pointer ${
                      isActive
                        ? 'bg-[#0284c7] text-white shadow-md shadow-[#0284c7]/25 font-bold'
                        : 'text-[#475569] hover:bg-[#f8fafc] hover:text-[#0f172a]'
                    }`}
                  >
                    <Icon className={`w-5 h-5 ${isActive ? 'text-white' : 'text-[#64748b]'}`} />
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </nav>

            {/* Federated Node Status Pill (Light clinical indicator) */}
            <div className="mx-1 mt-6 p-3 rounded-xl bg-[#f0fdf4] border border-[#bbf7d0] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-[#16a34a] animate-pulse" />
                <div>
                  <span className="text-xs font-bold text-[#166534] block">Federated Node 01</span>
                  <span className="text-[10px] text-[#15803d]">Privacy Budget 100% OK</span>
                </div>
              </div>
              <ShieldCheck className="w-4 h-4 text-[#16a34a]" />
            </div>
          </div>
        </div>

        {/* Footer Profile & Signout */}
        <div className="p-4 border-t border-[#f1f5f9] bg-[#f8fafc]">
          <div className="flex items-center gap-3 p-2 rounded-xl">
            <div className="relative">
              <img
                src={doctor.avatarUrl}
                alt={doctor.name}
                className="w-10 h-10 rounded-full object-cover border-2 border-[#0284c7]"
              />
              <span className="absolute bottom-0 right-0 w-3 h-3 bg-[#16a34a] border-2 border-white rounded-full" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-[#0f172a] truncate">{doctor.name}</p>
              <p className="text-xs text-[#64748b] truncate">{doctor.title}</p>
            </div>
            <button
              onClick={onSignOut}
              title="Sign Out"
              className="p-1.5 text-[#94a3b8] hover:text-[#dc2626] hover:bg-[#fee2e2] rounded-lg transition-colors cursor-pointer"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>
    </>
  );
};
