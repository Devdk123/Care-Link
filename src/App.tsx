import React, { useState, useEffect } from 'react';
import { useAuth } from './context/AuthContext';
import { TabType, Patient, Appointment, ActivityItem, ToastMessage, DoctorProfile, AppointmentStatus } from './types';
import { usePatients } from './hooks/usePatients';
import { CURRENT_DOCTOR, INITIAL_APPOINTMENTS, INITIAL_ACTIVITIES } from './data/mockData';
import { Sidebar } from './components/Sidebar';
import { Header } from './components/Header';
import { Toast } from './components/Toast';
import { ScheduleAppointmentModal } from './components/Modals/ScheduleAppointmentModal';
import { ViewPatientModal } from './components/Modals/ViewPatientModal';

import { DashboardView } from './views/DashboardView';
import { PatientsView } from './views/PatientsView';
import { AppointmentsView } from './views/AppointmentsView';
import { AnalyticsView } from './views/AnalyticsView';
import { SettingsView } from './views/SettingsView';
import { LoginView } from './views/LoginView';
import { ResetPasswordView } from './views/ResetPasswordView';
import { NotFoundView } from './views/NotFoundView';
import { LandingView } from './views/LandingView';
import { AgentCockpitView } from './views/AgentCockpitView';

export function App() {
  const { user, loading, signOut } = useAuth();
  const [activeTab, setActiveTab] = useState<TabType>('landing');
  const [doctor, setDoctor] = useState<DoctorProfile>({
    ...CURRENT_DOCTOR,
    email: user?.email || CURRENT_DOCTOR.email,
    name: user?.user_metadata?.full_name || user?.email?.split('@')[0] || CURRENT_DOCTOR.name,
  });

  // Patient data from backend API (or demo fallback)
  const { patients, refetchPatients } = usePatients();

  // Frontend-only state (appointments, activities)
  const [appointments, setAppointments] = useState<Appointment[]>(INITIAL_APPOINTMENTS);
  const [activities, setActivities] = useState<ActivityItem[]>(INITIAL_ACTIVITIES);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [isOnCall, setIsOnCall] = useState(false);
  const [isDemoMode, setIsDemoMode] = useState(false);

  // Search
  const [searchQuery, setSearchQuery] = useState('');

  // Modals
  const [isScheduleModalOpen, setIsScheduleModalOpen] = useState(false);
  const [selectedPatientForView, setSelectedPatientForView] = useState<Patient | null>(null);

  // Mobile Drawer
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // Toast Helpers
  const addToast = (title: string, message: string, type: 'success' | 'info' | 'error' = 'success') => {
    const id = Date.now().toString();
    setToasts((prev) => [...prev, { id, title, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  };

  useEffect(() => {
    if (!loading) {
      if (user && ['login','landing','reset-password'].includes(activeTab)) {
        setActiveTab('home');
      } else if (!user && !isDemoMode && !['login','landing','reset-password'].includes(activeTab)) {
        setActiveTab('landing');
      }
    }
  }, [user, loading, activeTab, isDemoMode]);

  useEffect(() => {
    if (user) {
      setDoctor(prev => ({
        ...prev,
        email: user.email || prev.email,
        name: user.user_metadata?.full_name || user.email?.split('@')[0] || prev.name,
      }));
    }
  }, [user]);

  const dismissToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  // Handlers
  const handleScheduleAppointment = async (newAptData: Omit<Appointment, 'id'>) => {
    const newId = `APT-${appointments.length + 101}`;
    const newApt: Appointment = {
      ...newAptData,
      id: newId,
      urgency: isOnCall ? 'High' : (newAptData.urgency || 'Medium')
    };

    setAppointments(prev => [newApt, ...prev]);

    const newAct: ActivityItem = {
      id: `ACT-${activities.length + 1}`,
      type: 'appointment',
      patientName: newApt.patientName,
      description: `New consultation booked for ${newApt.patientName} at ${newApt.time}.`,
      timestamp: 'Just now',
      statusColor: 'bg-[#316bf3]'
    };
    setActivities((prev) => [newAct, ...prev]);

    addToast('Appointment Scheduled', `Booked consultation for ${newApt.patientName} at ${newApt.time}.`, 'success');
  };

  const handleUpdateAppointmentStatus = async (id: string, newStatus: AppointmentStatus) => {
    setAppointments(prev => prev.map(a => a.id === id ? { ...a, status: newStatus } : a));
    addToast('Status Updated', `Appointment ${id} status set to ${newStatus}.`, 'info');
  };

  // Auth Layouts
  if (loading) {
    return (
      <div className="min-h-screen bg-[#f7f9fb] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <img
            src="/carelink.png"
            alt="CareLink Logo"
            className="w-14 h-14 rounded-2xl object-contain shadow-lg shadow-sky-500/20 animate-pulse border border-slate-200 bg-white p-1"
          />
          <p className="text-sm font-bold text-[#0284c7]">CareLink</p>
          <p className="text-xs text-[#74777f]">Loading clinical portal...</p>
        </div>
      </div>
    );
  }

  if (activeTab === 'landing') {
    return (
      <LandingView
        onLogin={() => setActiveTab('login')}
        onExploreDemo={() => {
          setIsDemoMode(true);
          setActiveTab('home');
          addToast('Demo Mode Active', 'Welcome to CareLink Clinical Portal as Dr. Sarah Jenkins.', 'info');
        }}
      />
    );
  }

  if (activeTab === 'login') {
    return (
      <LoginView
        onLoginSuccess={() => {
          setActiveTab('home');
          addToast('Welcome Back', `Logged in as ${doctor.name} (${doctor.department}).`, 'success');
        }}
        onNavigateToReset={() => setActiveTab('reset-password')}
        onBackToHome={() => setActiveTab('landing')}
      />
    );
  }

  if (activeTab === 'reset-password') {
    return <ResetPasswordView onBackToLogin={() => setActiveTab('login')} />;
  }

  if (activeTab === '404') {
    return <NotFoundView onGoHome={() => setActiveTab('home')} />;
  }

  const handleSignOut = async () => {
    setIsDemoMode(false);
    await signOut();
    setActiveTab('landing');
    addToast('Signed Out', 'You have been logged out safely.', 'info');
  };

  return (
    <div className="min-h-screen bg-[#f7f9fb] text-[#191c1e] flex flex-col antialiased">
      {/* Toast Overlay */}
      <Toast toasts={toasts} onDismiss={dismissToast} />

      {/* Main Sidebar */}
      <Sidebar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        doctor={{...doctor, status: isOnCall ? 'On-Call' : doctor.status}}
        onSignOut={handleSignOut}
        isOpenMobile={isMobileMenuOpen}
        setIsOpenMobile={setIsMobileMenuOpen}
      />

      {/* Main Body Content */}
      <div className="lg:pl-64 flex flex-col flex-1 min-w-0 transition-all">
        {/* Top Header */}
        <Header
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          doctor={{...doctor, status: isOnCall ? 'On-Call' : doctor.status}}
          activities={activities}
          onOpenScheduleModal={() => setIsScheduleModalOpen(true)}
          onToggleMobileMenu={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          isOnCall={isOnCall}
          setIsOnCall={setIsOnCall}
          onSignOut={handleSignOut}
        />

        {/* View Router */}
        <main className="flex-1 p-4 lg:p-8 max-w-7xl w-full mx-auto">
          {activeTab === 'home' && (
            <DashboardView
              doctor={doctor}
              patients={patients}
              appointments={appointments}
              activities={activities}
              onOpenScheduleModal={() => setIsScheduleModalOpen(true)}
              onSelectPatient={(p) => setSelectedPatientForView(p)}
              onNavigateTab={(tab) => setActiveTab(tab)}
            />
          )}

          {activeTab === 'patients' && (
            <PatientsView
              patients={patients}
              onSelectPatient={(p) => setSelectedPatientForView(p)}
              searchQuery={searchQuery}
              setSearchQuery={setSearchQuery}
              onShowToast={addToast}
              onRefetch={refetchPatients}
            />
          )}

          {activeTab === 'calendar' && (
            <AppointmentsView
              appointments={appointments}
              onOpenScheduleModal={() => setIsScheduleModalOpen(true)}
              onUpdateStatus={handleUpdateAppointmentStatus}
              onShowToast={addToast}
            />
          )}

          {activeTab === 'analytics' && <AnalyticsView />}

          {activeTab === 'cockpit' && (
            <AgentCockpitView
              patients={patients}
              onShowToast={addToast}
            />
          )}

          {activeTab === 'settings' && <SettingsView onShowToast={addToast} />}
        </main>
      </div>

      {/* Global Modals */}
      <ScheduleAppointmentModal
        isOpen={isScheduleModalOpen}
        onClose={() => setIsScheduleModalOpen(false)}
        onSchedule={handleScheduleAppointment}
        patients={patients}
      />

      <ViewPatientModal
        patient={selectedPatientForView}
        onClose={() => setSelectedPatientForView(null)}
        onShowToast={addToast}
      />
    </div>
  );
}

export default App;
