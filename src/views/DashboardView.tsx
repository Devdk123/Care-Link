import React, { useMemo } from 'react';
import { Patient, Appointment, ActivityItem, DoctorProfile } from '../types';
import { tierColor } from '../lib/api';
import {
  Users,
  Calendar,
  Clock,
  CheckCircle2,
  Plus,
  TrendingUp,
  Activity,
  Heart,
  ChevronRight,
  FileText,
  Stethoscope,
  AlertTriangle,
  BrainCircuit,
  ShieldCheck,
} from 'lucide-react';

interface DashboardViewProps {
  doctor: DoctorProfile;
  patients: Patient[];
  appointments: Appointment[];
  activities: ActivityItem[];
  onOpenScheduleModal: () => void;
  onSelectPatient: (patient: Patient) => void;
  onNavigateTab: (tab: 'patients' | 'calendar' | 'analytics') => void;
}

function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return 'Good Morning';
  if (h < 17) return 'Good Afternoon';
  return 'Good Evening';
}

function formatDate(): string {
  return new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  doctor,
  patients,
  appointments,
  activities,
  onOpenScheduleModal,
  onSelectPatient,
  onNavigateTab,
}) => {
  // ── Risk Distribution ──
  const riskStats = useMemo(() => {
    const high = patients.filter(p => p.risk_tier === 'High').length;
    const medium = patients.filter(p => p.risk_tier === 'Medium').length;
    const low = patients.filter(p => p.risk_tier === 'Low').length;
    const unscored = patients.filter(p => p.risk_tier == null).length;
    const avgProb = patients.reduce((sum, p) => sum + (p.probability ?? 0), 0) / (patients.length || 1);
    return { high, medium, low, unscored, avgProb, total: patients.length };
  }, [patients]);

  // ── Top high-risk patients ──
  const highRiskPatients = useMemo(() =>
    patients
      .filter(p => p.risk_tier === 'High')
      .sort((a, b) => (b.probability ?? 0) - (a.probability ?? 0))
      .slice(0, 6),
    [patients]
  );

  // ── Upcoming appointments (next 4) ──
  const todaysAppointmentsCount = appointments.length;
  const pendingReviewsCount = appointments.filter((a) => a.status === 'Waiting').length;
  const completedTodayCount = appointments.filter((a) => a.status === 'Completed').length;
  const upcomingAppointments = appointments
    .filter((a) => a.status !== 'Completed' && a.status !== 'Canceled')
    .slice(0, 4);

  return (
    <div className="space-y-6 pb-12">
      <div className="space-y-6">
        {/* ═══ High Risk Alert Banner ═══ */}
        {riskStats.high > 0 && (
          <div className="bg-[#ba1a1a]/10 border border-[#ba1a1a]/20 rounded-2xl p-4 flex flex-col md:flex-row md:items-center gap-4">
            <div className="w-10 h-10 shrink-0 bg-[#ba1a1a]/20 rounded-full flex items-center justify-center text-[#ba1a1a]">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div className="flex-1">
              <h3 className="text-sm font-bold text-[#ba1a1a]">
                {riskStats.high} High-Risk Patients Flagged
              </h3>
              <p className="text-xs text-[#ba1a1a]/80">
                The federated ML model has identified patients with &gt;66% readmission probability. Review recommended.
              </p>
            </div>
            <button
              onClick={() => onNavigateTab('patients')}
              className="px-4 py-2 bg-[#ba1a1a] text-white text-xs font-bold rounded-xl hover:bg-[#93000a] transition-colors flex items-center gap-2 shrink-0"
            >
              <BrainCircuit className="w-4 h-4" />
              Review Risk Panel
            </button>
          </div>
        )}

        {/* ═══ Welcome Header ═══ */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-[#022448] via-[#1e3a5f] to-[#022448] text-white p-6 md:p-8 shadow-xl">
          <div className="absolute inset-0 opacity-10 bg-[radial-gradient(#316bf3_1px,transparent_1px)] [background-size:16px_16px]" />
          <div className="relative z-10 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
            <div className="space-y-2 max-w-2xl">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 backdrop-blur-md text-xs font-semibold text-[#adc8f5]">
                <span className="w-2 h-2 rounded-full bg-[#10b981] animate-pulse" />
                Federated ML System Active • {riskStats.total} Patients Monitored
              </div>
              <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
                {getGreeting()}, {doctor.name}
              </h1>
              <p className="text-xs text-[#adc8f5]">{formatDate()}</p>
              <p className="text-sm text-[#adc8f5] leading-relaxed">
                You have{' '}
                <span className="font-semibold text-white">
                  {todaysAppointmentsCount} scheduled consultations
                </span>{' '}
                today with {pendingReviewsCount} pending review
                {pendingReviewsCount !== 1 ? 's' : ''}.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3 shrink-0">
              <button
                onClick={onOpenScheduleModal}
                className="px-4 py-2.5 rounded-xl bg-[#316bf3] hover:bg-[#0051d5] text-white font-semibold text-sm shadow-lg shadow-[#316bf3]/30 transition-all flex items-center gap-2"
              >
                <Plus className="w-4 h-4" />
                <span>Schedule Appointment</span>
              </button>
              <button
                onClick={() => onNavigateTab('analytics')}
                className="px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white font-semibold text-sm backdrop-blur-md border border-white/20 transition-all flex items-center gap-2"
              >
                <Activity className="w-4 h-4" />
                <span>View Analytics</span>
              </button>
            </div>
          </div>
        </div>

        {/* ═══ Risk Distribution + Appointment Stats ═══ */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Total Patients */}
          <div
            onClick={() => onNavigateTab('patients')}
            className="p-5 bg-white rounded-2xl border border-[#e0e3e5] shadow-sm hover:border-[#316bf3]/50 cursor-pointer transition-all group"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-[#74777f] uppercase tracking-wider">
                Total Patients
              </span>
              <div className="w-10 h-10 rounded-xl bg-[#316bf3]/10 text-[#316bf3] flex items-center justify-center group-hover:scale-110 transition-transform">
                <Users className="w-5 h-5" />
              </div>
            </div>
            <div className="mt-3">
              <p className="text-2xl font-extrabold text-[#191c1e]">{riskStats.total}</p>
              <div className="flex items-center gap-2 mt-1 text-xs font-semibold">
                <span className="text-[#ef4444]">{riskStats.high} High</span>
                <span className="text-[#74777f]">•</span>
                <span className="text-[#f59e0b]">{riskStats.medium} Med</span>
                <span className="text-[#74777f]">•</span>
                <span className="text-[#10b981]">{riskStats.low} Low</span>
              </div>
            </div>
          </div>

          {/* High Risk */}
          <div
            onClick={() => onNavigateTab('patients')}
            className="p-5 bg-white rounded-2xl border border-[#e0e3e5] shadow-sm hover:border-[#ef4444]/50 cursor-pointer transition-all group"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-[#74777f] uppercase tracking-wider">
                High Risk Patients
              </span>
              <div className="w-10 h-10 rounded-xl bg-[#ef4444]/10 text-[#ef4444] flex items-center justify-center group-hover:scale-110 transition-transform">
                <AlertTriangle className="w-5 h-5" />
              </div>
            </div>
            <div className="mt-3">
              <p className="text-2xl font-extrabold text-[#ef4444]">{riskStats.high}</p>
              <p className="text-xs text-[#74777f] mt-1 font-medium">
                ≥66% readmission probability
              </p>
            </div>
          </div>

          {/* Today's Appointments */}
          <div
            onClick={() => onNavigateTab('calendar')}
            className="p-5 bg-white rounded-2xl border border-[#e0e3e5] shadow-sm hover:border-[#316bf3]/50 cursor-pointer transition-all group"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-[#74777f] uppercase tracking-wider">
                Today's Appointments
              </span>
              <div className="w-10 h-10 rounded-xl bg-[#0051d5]/10 text-[#0051d5] flex items-center justify-center group-hover:scale-110 transition-transform">
                <Calendar className="w-5 h-5" />
              </div>
            </div>
            <div className="mt-3">
              <p className="text-2xl font-extrabold text-[#191c1e]">{todaysAppointmentsCount}</p>
              <p className="text-xs text-[#74777f] mt-1 font-medium">
                {completedTodayCount} completed • {pendingReviewsCount} waiting
              </p>
            </div>
          </div>

          {/* Avg Risk Score */}
          <div className="p-5 bg-white rounded-2xl border border-[#e0e3e5] shadow-sm group">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-[#74777f] uppercase tracking-wider">
                Avg Risk Score
              </span>
              <div className="w-10 h-10 rounded-xl bg-[#f59e0b]/10 text-[#f59e0b] flex items-center justify-center">
                <BrainCircuit className="w-5 h-5" />
              </div>
            </div>
            <div className="mt-3">
              <p className="text-2xl font-extrabold text-[#191c1e]">
                {Math.round(riskStats.avgProb * 100)}%
              </p>
              <p className="text-xs text-[#74777f] mt-1 font-medium">
                Across {riskStats.total} patients
              </p>
            </div>
          </div>
        </div>

        {/* ═══ Two Column Layout ═══ */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* LEFT: High-Risk Patients + Telemetry */}
          <div className="lg:col-span-2 space-y-6">
            {/* Live Telemetry Monitor */}
            <div className="bg-white rounded-2xl border border-[#e0e3e5] p-6 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-[#ba1a1a]/10 text-[#ba1a1a] flex items-center justify-center">
                    <Heart className="w-5 h-5 animate-pulse" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-[#191c1e]">
                      Real-Time Telemetry Monitor
                    </h3>
                    <p className="text-xs text-[#74777f]">Ward 4A • Bed 12 (M. Sterling)</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 text-xs">
                  <span className="font-mono bg-[#10b981]/10 text-[#10b981] px-2.5 py-1 rounded-lg font-bold">
                    BPM: 74
                  </span>
                  <span className="font-mono bg-[#316bf3]/10 text-[#316bf3] px-2.5 py-1 rounded-lg font-bold">
                    SpO2: 98%
                  </span>
                </div>
              </div>
              <div className="relative h-28 bg-[#022448] rounded-xl overflow-hidden p-2 flex items-center">
                <div className="absolute inset-0 bg-[linear-gradient(to_right,#ffffff0a_1px,transparent_1px),linear-gradient(to_bottom,#ffffff0a_1px,transparent_1px)] bg-[size:16px_16px]" />
                <svg className="w-full h-full text-[#10b981]" viewBox="0 0 500 100" preserveAspectRatio="none">
                  <path
                    d="M 0 50 L 80 50 L 90 20 L 100 80 L 110 10 L 120 90 L 130 50 L 220 50 L 230 15 L 240 85 L 250 5 L 260 95 L 270 50 L 360 50 L 370 25 L 380 75 L 390 10 L 400 90 L 410 50 L 500 50"
                    fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
                  />
                </svg>
                <div className="absolute top-2 right-3 text-[10px] font-mono text-[#adc8f5] flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-[#10b981] animate-ping" />
                  SWEEP: 25mm/s
                </div>
              </div>
            </div>

            {/* High-Risk Patient Cards */}
            <div className="bg-white rounded-2xl border border-[#e0e3e5] p-6 shadow-sm">
              <div className="flex items-center justify-between mb-5">
                <div>
                  <h3 className="text-lg font-bold text-[#191c1e]">High-Risk Patients</h3>
                  <p className="text-xs text-[#74777f]">
                    Patients flagged by the federated readmission model
                  </p>
                </div>
                <button
                  onClick={() => onNavigateTab('patients')}
                  className="text-xs font-bold text-[#316bf3] hover:underline flex items-center gap-1"
                >
                  <span>View All Patients</span>
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>

              {highRiskPatients.length === 0 ? (
                <div className="py-6 text-center flex flex-col items-center gap-2">
                  <ShieldCheck className="w-8 h-8 text-[#10b981]" />
                  <p className="text-sm font-semibold text-[#10b981]">All Clear!</p>
                  <p className="text-xs text-[#74777f]">No high-risk patients at this time.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {highRiskPatients.map((patient) => {
                    const tc = tierColor(patient.risk_tier);
                    const prob = Math.round((patient.probability ?? 0) * 100);
                    return (
                      <div
                        key={patient.patient_id}
                        className="p-4 rounded-xl border border-[#e0e3e5] hover:border-[#ef4444]/40 transition-all cursor-pointer group"
                        onClick={() => onSelectPatient(patient)}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <div className="w-9 h-9 rounded-full bg-[#316bf3]/10 text-[#316bf3] font-bold text-xs flex items-center justify-center border border-[#316bf3]/20">
                              {patient.external_ref.slice(0, 2)}
                            </div>
                            <div>
                              <p className="text-sm font-bold text-[#191c1e] group-hover:text-[#316bf3] transition-colors">
                                {patient.external_ref}
                              </p>
                              <p className="text-[10px] text-[#74777f]">
                                {patient.age ? `${patient.age} yrs` : '—'} • {patient.gender || '—'}
                              </p>
                            </div>
                          </div>
                          <span
                            className="text-xl font-black"
                            style={{ color: tc.ring }}
                          >
                            {prob}%
                          </span>
                        </div>
                        <div className="flex items-center justify-between text-[10px]">
                          <span className="text-[#74777f] font-medium truncate">
                            {patient.admission_type || 'Unknown'}
                          </span>
                          <span
                            className={`px-2 py-0.5 rounded-full font-bold uppercase tracking-wider ${tc.bg} ${tc.text}`}
                          >
                            {patient.risk_tier}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* RIGHT: Activity Feed + Quick Actions */}
          <div className="space-y-6">
            {/* Upcoming Appointments */}
            <div className="bg-white rounded-2xl border border-[#e0e3e5] p-6 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-base font-bold text-[#191c1e]">Upcoming Appointments</h3>
                <button
                  onClick={() => onNavigateTab('calendar')}
                  className="text-xs font-bold text-[#316bf3] hover:underline flex items-center gap-1"
                >
                  View All <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
              <div className="divide-y divide-[#f2f4f6]">
                {upcomingAppointments.map((apt) => (
                  <div key={apt.id} className="py-2.5 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5">
                      <div className="w-10 text-center shrink-0">
                        <p className="text-xs font-bold text-[#191c1e]">{apt.time}</p>
                      </div>
                      {apt.patientAvatar ? (
                        <img src={apt.patientAvatar} alt={apt.patientName} className="w-8 h-8 rounded-full object-cover shrink-0" />
                      ) : (
                        <div className="w-8 h-8 rounded-full bg-[#1e3a5f] text-white font-bold text-[10px] flex items-center justify-center shrink-0">
                          {apt.patientInitials}
                        </div>
                      )}
                      <div>
                        <p className="text-xs font-bold text-[#191c1e]">{apt.patientName}</p>
                        <p className="text-[10px] text-[#74777f]">{apt.type}</p>
                      </div>
                    </div>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${
                      apt.status === 'In Progress' ? 'bg-[#316bf3]/15 text-[#316bf3] animate-pulse' :
                      apt.status === 'Waiting' ? 'bg-[#ff9800]/15 text-[#ff9800]' :
                      'bg-[#74777f]/15 text-[#74777f]'
                    }`}>
                      {apt.status}
                    </span>
                  </div>
                ))}
                {upcomingAppointments.length === 0 && (
                  <p className="py-4 text-center text-xs text-[#74777f]">No upcoming appointments.</p>
                )}
              </div>
            </div>

            {/* Activity Feed */}
            <div className="bg-white rounded-2xl border border-[#e0e3e5] p-6 shadow-sm">
              <h3 className="text-base font-bold text-[#191c1e] mb-4 flex items-center justify-between">
                <span>Activity Feed</span>
                <span className="text-xs font-semibold text-[#316bf3]">Live Updates</span>
              </h3>
              <div className="space-y-4">
                {activities.map((act) => (
                  <div key={act.id} className="flex items-start gap-3 text-xs">
                    <div className={`w-2.5 h-2.5 rounded-full mt-1 shrink-0 ${act.statusColor || 'bg-[#316bf3]'}`} />
                    <div>
                      <p className="font-semibold text-[#191c1e]">{act.description}</p>
                      <p className="text-[11px] text-[#74777f] mt-0.5">{act.timestamp}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Quick Actions */}
            <div className="bg-white rounded-2xl p-6 border border-[#e0e3e5] shadow-sm space-y-4">
              <h3 className="text-xs font-bold uppercase tracking-wider text-[#74777f]">
                Quick Clinical Actions
              </h3>
              <div className="space-y-2">
                <button
                  onClick={onOpenScheduleModal}
                  className="w-full text-left p-3 rounded-xl bg-[#f7f9fb] hover:bg-[#f2f4f6] border border-[#e0e3e5] transition-all flex items-center gap-3 text-xs font-bold text-[#191c1e] hover:border-[#316bf3]"
                >
                  <div className="w-7 h-7 rounded-lg bg-[#316bf3]/10 text-[#316bf3] flex items-center justify-center">
                    <Calendar className="w-4 h-4" />
                  </div>
                  <span>Book New Consultation</span>
                </button>
                <button
                  onClick={() => onNavigateTab('patients')}
                  className="w-full text-left p-3 rounded-xl bg-[#f7f9fb] hover:bg-[#f2f4f6] border border-[#e0e3e5] transition-all flex items-center gap-3 text-xs font-bold text-[#191c1e] hover:border-[#10b981]"
                >
                  <div className="w-7 h-7 rounded-lg bg-emerald-50 text-[#10b981] flex items-center justify-center">
                    <BrainCircuit className="w-4 h-4" />
                  </div>
                  <span>Review Risk Panel</span>
                </button>
                <button
                  onClick={() => onNavigateTab('analytics')}
                  className="w-full text-left p-3 rounded-xl bg-[#f7f9fb] hover:bg-[#f2f4f6] border border-[#e0e3e5] transition-all flex items-center gap-3 text-xs font-bold text-[#191c1e] hover:border-[#ff9800]"
                >
                  <div className="w-7 h-7 rounded-lg bg-amber-50 text-[#ff9800] flex items-center justify-center">
                    <Activity className="w-4 h-4" />
                  </div>
                  <span>View Analytics Dashboard</span>
                </button>
                <button
                  onClick={() => window.print()}
                  className="w-full text-left p-3 rounded-xl bg-[#f7f9fb] hover:bg-[#f2f4f6] border border-[#e0e3e5] transition-all flex items-center gap-3 text-xs font-bold text-[#191c1e] hover:border-[#316bf3]"
                >
                  <div className="w-7 h-7 rounded-lg bg-blue-50 text-[#316bf3] flex items-center justify-center">
                    <FileText className="w-4 h-4" />
                  </div>
                  <span>Download EOD Report (PDF)</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
