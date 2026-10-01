import React, { useState, useMemo } from 'react';
import { Appointment, AppointmentStatus } from '../types';
import { 
  Calendar, Clock, User, Plus, Filter, Bell, 
  ChevronLeft, ChevronRight, Activity, Info, 
  CheckCircle2, AlertCircle, XCircle, MapPin
} from 'lucide-react';

interface AppointmentsViewProps {
  appointments: Appointment[];
  onOpenScheduleModal: () => void;
  onUpdateStatus: (id: string, newStatus: AppointmentStatus) => void;
  onShowToast?: (title: string, message: string, type?: 'success' | 'info' | 'error') => void;
}

const DEPARTMENTS = ['All', 'Cardiology', 'Neurology', 'General Practice'];
const URGENCIES = ['All', 'High', 'Medium', 'Low'];

const STATUS_IMPLICATIONS = {
  Upcoming: {
    scheduling: 'Slot locked in physician calendar. Prior-authorization validated.',
    billing: 'Pre-visit verification complete. Copay required at check-in.',
    icon: Calendar,
    color: 'bg-blue-100 text-blue-700',
    dot: 'bg-blue-500'
  },
  'In Progress': {
    scheduling: 'Consultation active. Real-time CPT encounter code tracking.',
    billing: 'Active encounter. E/M level being calculated.',
    icon: Activity,
    color: 'bg-green-100 text-green-700',
    dot: 'bg-green-500 animate-pulse'
  },
  Waiting: {
    scheduling: 'Patient arrived. Estimated wait: 15 min. Room allocation pending.',
    billing: 'Copay collected. Patient ready for clinical intake.',
    icon: Clock,
    color: 'bg-amber-100 text-amber-700',
    dot: 'bg-amber-500'
  },
  Completed: {
    scheduling: 'Encounter closed. Clinical notes can now be finalized.',
    billing: 'Superbill ready for coding review and claim submission.',
    icon: CheckCircle2,
    color: 'bg-gray-100 text-gray-700',
    dot: 'bg-gray-500'
  },
  Canceled: {
    scheduling: 'Slot released. Patient notified via portal. Rebooking suggested.',
    billing: 'No-show or late cancel fee may apply depending on policy.',
    icon: XCircle,
    color: 'bg-red-100 text-red-700',
    dot: 'bg-red-500'
  }
};

export const AppointmentsView: React.FC<AppointmentsViewProps> = ({
  appointments,
  onOpenScheduleModal,
  onUpdateStatus,
  onShowToast
}) => {
  const [selectedDept, setSelectedDept] = useState('All');
  const [selectedUrgency, setSelectedUrgency] = useState('All');
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);

  const filteredAppointments = useMemo(() => {
    return appointments.filter(apt => {
      const matchDept = selectedDept === 'All' || apt.department === selectedDept;
      const matchUrgency = selectedUrgency === 'All' || apt.urgency === selectedUrgency;
      const matchDate = apt.date ? apt.date.startsWith(selectedDate) : true;
      
      return matchDept && matchUrgency && matchDate;
    });
  }, [appointments, selectedDept, selectedUrgency, selectedDate]);

  const stats = useMemo(() => {
    return {
      upcoming: filteredAppointments.filter(a => a.status === 'Upcoming').length,
      inProgress: filteredAppointments.filter(a => a.status === 'In Progress').length,
      waiting: filteredAppointments.filter(a => a.status === 'Waiting').length,
      completed: filteredAppointments.filter(a => a.status === 'Completed').length,
    };
  }, [filteredAppointments]);

  const getUrgencyStyles = (urgency?: string) => {
    switch (urgency) {
      case 'High':
        return 'bg-[#ba1a1a]/15 text-[#ba1a1a] border-l-4 border-[#ba1a1a]';
      case 'Medium':
        return 'bg-[#ff9800]/15 text-[#ff9800] border-l-4 border-[#ff9800]';
      case 'Low':
        return 'bg-[#10b981]/15 text-[#10b981] border-l-4 border-[#10b981]';
      default:
        return 'bg-gray-100 text-gray-600 border-l-4 border-gray-400';
    }
  };

  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
  };

  const handleDateChange = (days: number) => {
    const d = new Date(selectedDate);
    d.setDate(d.getDate() + days);
    setSelectedDate(d.toISOString().split('T')[0]);
  };

  return (
    <div className="flex flex-col gap-6 p-6 max-w-7xl mx-auto w-full">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-[#022448]">Clinical Calendar & Schedule</h1>
          <p className="text-gray-500 mt-1">Manage patient encounters, monitor wait times, and track room utilization.</p>
        </div>
        <button 
          onClick={onOpenScheduleModal}
          className="flex items-center gap-2 bg-[#316bf3] hover:bg-[#2552bc] text-white px-5 py-2.5 rounded-lg font-medium transition-colors shadow-sm"
        >
          <Plus size={20} />
          Schedule Appointment
        </button>
      </div>

      {/* Filters & Navigation */}
      <div className="flex flex-col lg:flex-row gap-4 items-stretch lg:items-center justify-between bg-white p-4 rounded-2xl border border-[#e0e3e5] shadow-sm">
        
        {/* Date Navigator */}
        <div className="flex items-center gap-3 bg-[#022448] text-white px-4 py-2 rounded-xl shadow-inner">
          <button onClick={() => handleDateChange(-1)} className="p-1 hover:bg-white/20 rounded-md transition-colors">
            <ChevronLeft size={20} />
          </button>
          <div className="flex items-center gap-2">
            <Calendar size={18} className="text-[#89b4f8]" />
            <input 
              type="date" 
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="bg-transparent border-none text-white focus:outline-none font-medium [&::-webkit-calendar-picker-indicator]:filter [&::-webkit-calendar-picker-indicator]:invert"
            />
          </div>
          <button onClick={() => handleDateChange(1)} className="p-1 hover:bg-white/20 rounded-md transition-colors">
            <ChevronRight size={20} />
          </button>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-4 flex-1 justify-end">
          <div className="flex items-center gap-2 bg-gray-50 p-1 rounded-lg border border-gray-200">
            {DEPARTMENTS.map(dept => (
              <button
                key={dept}
                onClick={() => setSelectedDept(dept)}
                className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
                  selectedDept === dept 
                    ? 'bg-white text-[#316bf3] shadow-sm border border-gray-200' 
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                {dept}
              </button>
            ))}
          </div>
          
          <div className="flex items-center gap-2">
            <Filter size={18} className="text-gray-400" />
            <select 
              value={selectedUrgency}
              onChange={(e) => setSelectedUrgency(e.target.value)}
              className="bg-gray-50 border border-gray-200 text-gray-700 text-sm rounded-lg focus:ring-[#316bf3] focus:border-[#316bf3] block p-2 outline-none"
            >
              {URGENCIES.map(u => (
                <option key={u} value={u}>Urgency: {u}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Status Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Upcoming', count: stats.upcoming, color: 'text-blue-600', bg: 'bg-blue-50' },
          { label: 'In Progress', count: stats.inProgress, color: 'text-green-600', bg: 'bg-green-50' },
          { label: 'Waiting', count: stats.waiting, color: 'text-amber-600', bg: 'bg-amber-50' },
          { label: 'Completed', count: stats.completed, color: 'text-gray-600', bg: 'bg-gray-50' },
        ].map(stat => (
          <div key={stat.label} className={`${stat.bg} rounded-2xl p-5 border border-white/50 shadow-sm flex items-center justify-between`}>
            <span className="font-semibold text-gray-700">{stat.label}</span>
            <span className={`text-2xl font-bold ${stat.color}`}>{stat.count}</span>
          </div>
        ))}
      </div>

      {/* Appointments List */}
      <div className="space-y-4">
        {filteredAppointments.length === 0 ? (
          <div className="bg-white rounded-2xl border border-[#e0e3e5] shadow-sm p-12 text-center">
            <Calendar size={48} className="mx-auto text-gray-300 mb-4" />
            <h3 className="text-xl font-medium text-gray-900 mb-2">No appointments found</h3>
            <p className="text-gray-500">There are no matching appointments for the selected filters and date.</p>
          </div>
        ) : (
          filteredAppointments.map(apt => {
            const statusInfo = STATUS_IMPLICATIONS[apt.status] || STATUS_IMPLICATIONS.Upcoming;
            
            return (
              <div key={apt.id} className="bg-white rounded-2xl border border-[#e0e3e5] shadow-sm p-5 flex flex-col md:flex-row gap-5 items-start md:items-center hover:shadow-md transition-shadow">
                
                {/* Time Badge (Urgency Colored) */}
                <div className={`flex flex-col items-center justify-center py-3 px-4 rounded-xl min-w-[100px] shrink-0 ${getUrgencyStyles(apt.urgency)}`}>
                  <Clock size={20} className="mb-1" />
                  <span className="font-bold text-lg leading-tight">{apt.time}</span>
                  {apt.urgency && <span className="text-xs font-semibold uppercase tracking-wider mt-1 opacity-80">{apt.urgency}</span>}
                </div>

                {/* Main Content */}
                <div className="flex-1 flex flex-col sm:flex-row gap-4 items-start sm:items-center">
                  
                  {/* Patient Info */}
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-full bg-[#022448] text-white flex items-center justify-center font-bold text-lg shrink-0 shadow-sm">
                      {getInitials(apt.patientName)}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-lg font-bold text-gray-900">{apt.patientName}</h3>
                        <span className="text-xs font-mono bg-gray-100 text-gray-500 px-2 py-0.5 rounded-md border border-gray-200">
                          {apt.id}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 text-sm text-gray-500 mt-1">
                        <span className="flex items-center gap-1 font-medium text-[#316bf3]"><Activity size={14}/> {apt.type}</span>
                        <span className="flex items-center gap-1"><User size={14}/> {apt.doctor}</span>
                        <span className="flex items-center gap-1 hidden lg:flex"><MapPin size={14}/> {apt.department}</span>
                      </div>
                    </div>
                  </div>

                </div>

                {/* Notes if any */}
                {apt.notes && (
                  <div className="text-sm text-gray-600 italic bg-gray-50 p-2.5 rounded-lg border border-gray-100 md:max-w-[200px] xl:max-w-[300px]">
                    "{apt.notes}"
                  </div>
                )}

                {/* Actions & Status */}
                <div className="flex items-center gap-3 w-full md:w-auto justify-between md:justify-end border-t md:border-none pt-4 md:pt-0 mt-2 md:mt-0">
                  
                  {/* Status Badge with Tooltip */}
                  <div className="relative group">
                    <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium border border-transparent shadow-sm ${statusInfo.color}`}>
                      <div className={`w-2 h-2 rounded-full ${statusInfo.dot}`}></div>
                      {apt.status}
                    </div>
                    
                    {/* Tooltip */}
                    <div className="absolute bottom-full right-0 md:left-1/2 md:-translate-x-1/2 mb-2 w-72 bg-gray-900 text-white text-xs rounded-lg p-3 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-10 shadow-xl border border-gray-700 pointer-events-none">
                      <div className="font-semibold border-b border-gray-700 pb-1 mb-1.5 text-gray-200">Scheduling Implication</div>
                      <p className="mb-2.5 text-gray-300">{statusInfo.scheduling}</p>
                      <div className="font-semibold border-b border-gray-700 pb-1 mb-1.5 text-gray-200">Billing Implication</div>
                      <p className="text-gray-300">{statusInfo.billing}</p>
                      
                      {/* Triangle */}
                      <div className="absolute -bottom-1 right-4 md:left-1/2 md:-translate-x-1/2 w-2 h-2 bg-gray-900 rotate-45 border-r border-b border-gray-700"></div>
                    </div>
                  </div>

                  {/* Status update dropdown */}
                  <select
                    className="text-sm bg-white border border-gray-200 rounded-lg p-1.5 text-gray-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-[#316bf3]/20 focus:border-[#316bf3]"
                    value={apt.status}
                    onChange={(e) => onUpdateStatus(apt.id, e.target.value as AppointmentStatus)}
                  >
                    <option value="Upcoming">Upcoming</option>
                    <option value="Waiting">Waiting</option>
                    <option value="In Progress">In Progress</option>
                    <option value="Completed">Completed</option>
                    <option value="Canceled">Canceled</option>
                  </select>

                  {/* Reminder Bell */}
                  <button 
                    onClick={() => {
                      if (onShowToast) {
                        onShowToast('Reminder Sent', `Notification sent to ${apt.patientName} for their ${apt.time} appointment.`, 'info');
                      }
                    }}
                    className="p-2 text-gray-400 hover:text-[#316bf3] hover:bg-blue-50 rounded-lg transition-colors border border-transparent hover:border-blue-100"
                    title="Send Reminder"
                  >
                    <Bell size={18} />
                  </button>

                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
