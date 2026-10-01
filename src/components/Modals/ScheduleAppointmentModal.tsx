import React, { useState } from 'react';
import { Appointment, Patient } from '../../types';
import { X, Calendar, Clock, User, Stethoscope, FileText, CheckCircle2 } from 'lucide-react';

interface ScheduleAppointmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSchedule: (appointment: Omit<Appointment, 'id'>) => void;
  patients: Patient[];
}

export const ScheduleAppointmentModal: React.FC<ScheduleAppointmentModalProps> = ({
  isOpen,
  onClose,
  onSchedule,
  patients
}) => {
  const [patientName, setPatientName] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [time, setTime] = useState('09:00 AM');
  const [department, setDepartment] = useState('Cardiology');
  const [doctor, setDoctor] = useState('Dr. Smith');
  const [type, setType] = useState('Annual Physical');
  const [urgency, setUrgency] = useState<'High' | 'Medium' | 'Low'>('Medium');
  const [notes, setNotes] = useState('');

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!patientName.trim()) return;

    const initials = patientName
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2) || 'PT';

    onSchedule({
      time,
      date,
      patientName,
      patientInitials: initials,
      department,
      doctor,
      type,
      status: 'Upcoming',
      urgency,
      notes
    });

    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
      <div className="bg-white rounded-2xl max-w-lg w-full border border-[#e0e3e5] shadow-2xl overflow-hidden animate-in zoom-in-95">
        {/* Header */}
        <div className="bg-white border-b border-[#e0e3e5] px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-[#316bf3]/10 text-[#316bf3] flex items-center justify-center">
              <Calendar className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-[#191c1e]">Schedule Appointment</h2>
              <p className="text-xs text-[#74777f]">Book a clinical session or consultation</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-[#74777f] hover:text-[#191c1e] hover:bg-[#f2f4f6] p-1.5 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Patient Selection or Manual Entry */}
          <div>
            <label className="block text-xs font-semibold text-[#43474e] uppercase tracking-wider mb-1.5">
              Patient Name *
            </label>
            <div className="relative">
              <User className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-[#74777f]" />
              <input
                type="text"
                required
                list="patient-list"
                value={patientName}
                onChange={(e) => setPatientName(e.target.value)}
                placeholder="Type or select patient name..."
                className="w-full pl-10 pr-4 py-2.5 bg-[#f2f4f6] border border-[#c4c6cf] rounded-xl text-sm text-[#191c1e] focus:outline-none focus:bg-white focus:border-[#316bf3] focus:ring-2 focus:ring-[#316bf3]/20"
              />
              <datalist id="patient-list">
                {patients.map((p, idx) => (
                  <option key={p.id ? `${p.id}-${idx}` : `patient-${idx}`} value={p.name}>
                    {p.id} - {p.department}
                  </option>
                ))}
              </datalist>
            </div>
          </div>

          {/* Date & Time */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-[#43474e] uppercase tracking-wider mb-1.5">
                Date *
              </label>
              <div className="relative">
                <Calendar className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-[#74777f]" />
                <input
                  type="date"
                  required
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="w-full pl-10 pr-3 py-2.5 bg-[#f2f4f6] border border-[#c4c6cf] rounded-xl text-sm text-[#191c1e] focus:outline-none focus:bg-white focus:border-[#316bf3]"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#43474e] uppercase tracking-wider mb-1.5">
                Time Slot *
              </label>
              <div className="relative">
                <Clock className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-[#74777f]" />
                <select
                  value={time}
                  onChange={(e) => setTime(e.target.value)}
                  className="w-full pl-10 pr-3 py-2.5 bg-[#f2f4f6] border border-[#c4c6cf] rounded-xl text-sm text-[#191c1e] focus:outline-none focus:bg-white focus:border-[#316bf3]"
                >
                  <option value="08:30 AM">08:30 AM</option>
                  <option value="09:00 AM">09:00 AM</option>
                  <option value="09:30 AM">09:30 AM</option>
                  <option value="10:15 AM">10:15 AM</option>
                  <option value="11:00 AM">11:00 AM</option>
                  <option value="01:30 PM">01:30 PM</option>
                  <option value="02:30 PM">02:30 PM</option>
                  <option value="03:45 PM">03:45 PM</option>
                </select>
              </div>
            </div>
          </div>

          {/* Department & Doctor */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-[#43474e] uppercase tracking-wider mb-1.5">
                Department
              </label>
              <select
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-[#f2f4f6] border border-[#c4c6cf] rounded-xl text-sm text-[#191c1e] focus:outline-none focus:bg-white focus:border-[#316bf3]"
              >
                <option value="Cardiology">Cardiology</option>
                <option value="Neurology">Neurology</option>
                <option value="General Practice">General Practice</option>
                <option value="Pediatrics">Pediatrics</option>
                <option value="Oncology">Oncology</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#43474e] uppercase tracking-wider mb-1.5">
                Attending Physician
              </label>
              <select
                value={doctor}
                onChange={(e) => setDoctor(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-[#f2f4f6] border border-[#c4c6cf] rounded-xl text-sm text-[#191c1e] focus:outline-none focus:bg-white focus:border-[#316bf3]"
              >
                <option value="Dr. Smith">Dr. Smith (Cardiology)</option>
                <option value="Dr. Adams">Dr. Adams (General Practice)</option>
                <option value="Dr. Vance">Dr. Vance (Neurology)</option>
                <option value="Dr. Chen">Dr. Chen (Pediatrics)</option>
              </select>
            </div>
          </div>

          {/* Appointment Type */}
          <div>
            <label className="block text-xs font-semibold text-[#43474e] uppercase tracking-wider mb-1.5">
              Appointment Type
            </label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-[#f2f4f6] border border-[#c4c6cf] rounded-xl text-sm text-[#191c1e] focus:outline-none focus:bg-white focus:border-[#316bf3]"
            >
              <option value="Annual Physical">Annual Physical</option>
              <option value="Follow-up Consultation">Follow-up</option>
              <option value="Emergency">Emergency</option>
              <option value="Medication Review">Medication Review</option>
              <option value="Specialist Referral">Specialist Referral</option>
            </select>
          </div>

          {/* Urgency */}
          <div>
            <label className="block text-xs font-semibold text-[#43474e] uppercase tracking-wider mb-1.5">
              Urgency Level
            </label>
            <select
              value={urgency}
              onChange={(e) => setUrgency(e.target.value as 'High' | 'Medium' | 'Low')}
              className="w-full px-3.5 py-2.5 bg-[#f2f4f6] border border-[#c4c6cf] rounded-xl text-sm text-[#191c1e] focus:outline-none focus:bg-white focus:border-[#316bf3]"
            >
              <option value="High">🔴 High</option>
              <option value="Medium">🟡 Medium</option>
              <option value="Low">🟢 Low</option>
            </select>
          </div>

          {/* Clinical Notes */}
          <div>
            <label className="block text-xs font-semibold text-[#43474e] uppercase tracking-wider mb-1.5">
              Clinical Notes / Reason for Visit
            </label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Enter preparation notes or special instructions..."
              className="w-full px-3.5 py-2 bg-[#f2f4f6] border border-[#c4c6cf] rounded-xl text-sm text-[#191c1e] focus:outline-none focus:bg-white focus:border-[#316bf3]"
            />
          </div>

          {/* Buttons */}
          <div className="pt-4 flex items-center justify-end gap-3 border-t border-[#e0e3e5]">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl text-sm font-semibold text-[#43474e] hover:bg-[#f2f4f6] transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2.5 rounded-xl text-sm font-semibold bg-[#316bf3] text-white hover:bg-[#0051d5] shadow-md shadow-[#316bf3]/20 transition-all flex items-center gap-2"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>Confirm Appointment</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
