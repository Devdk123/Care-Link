/**
 * Mock data for frontend-only features (appointments, activities).
 * These are NOT part of the ML backend and exist purely for demo purposes.
 */
import { Appointment, ActivityItem, DoctorProfile } from '../types';

export const CURRENT_DOCTOR: DoctorProfile = {
  name: 'Dr. Smith',
  title: 'Clinical Director',
  department: 'Cardiology',
  email: 'smith@carelink.health',
  avatarUrl: 'https://lh3.googleusercontent.com/aida-public/AB6AXuDmwiFrOKDn0G-I6stYZ-AU5N6ZOYvbHhW5zM1nJbrigkWPXFAu-v3pWXxmnQuZy6MXDC5GLgu3JAyq_ZwrxXkUpz8F1wk7TvqQf43OpCWLzLNC2MydlCqIRiAHrTVmWzF0CFpg_L1LPxMlvl1bDPsITc5osPSDiaJ6iN--DywxJH3Dtvyz6htv00-zoqsmn4z5ObtMskIvKfm6TqyRW_msDUtdeSdEri1JgE5nKSM5VQ4olOFKe7ph'
};

const TODAY = new Date().toISOString().split('T')[0];

export const INITIAL_APPOINTMENTS: Appointment[] = [
  {
    id: 'APT-101',
    time: '09:00 AM',
    date: TODAY,
    patientName: 'Sarah Jenkins',
    patientInitials: 'SJ',
    department: 'Cardiology',
    doctor: 'Dr. Smith',
    type: 'Annual Physical',
    status: 'Completed',
    urgency: 'Low',
    notes: 'Vitals stable. BP 120/80.'
  },
  {
    id: 'APT-102',
    time: '09:30 AM',
    date: TODAY,
    patientName: 'Eleanor James',
    patientInitials: 'EJ',
    department: 'Cardiology',
    doctor: 'Dr. Smith',
    type: 'Follow-up Consultation',
    status: 'Upcoming',
    urgency: 'Medium',
    notes: 'Review ECG test results.'
  },
  {
    id: 'APT-103',
    time: '10:30 AM',
    date: TODAY,
    patientName: 'Marcus Sterling',
    patientInitials: 'MS',
    patientAvatar: 'https://lh3.googleusercontent.com/aida-public/AB6AXuAClsVR_HrEV0B7n9tzO_2cpu5aRg1jjth75zVi9hI81KjNJDythkejM2dQgEb0xAQYuaHBQ648DIsGBf_zTAAXcjvEQYzkOXWixgjbYoNIs2KpCLdkvUa5v3Yss_uRKISWzZELOl24iGJKOKzNIhP53PtC7YEbD1OBDKaYOjyptiUXFGLr6Xx1PfBRK2_bZOMJHB6jvzC5tVjdbzYGyEAxN9J7KJgx7oKo0kpV787ClReNx4T8f8h5',
    department: 'General Practice',
    doctor: 'Dr. Adams',
    type: 'General Checkup',
    status: 'In Progress',
    urgency: 'Low',
    notes: 'Comprehensive senior wellness check.'
  },
  {
    id: 'APT-104',
    time: '11:15 AM',
    date: TODAY,
    patientName: 'Thomas Reed',
    patientInitials: 'TR',
    department: 'Neurology',
    doctor: 'Dr. Vance',
    type: 'Neurology Follow-up',
    status: 'Waiting',
    urgency: 'High',
    notes: 'Seizure monitoring follow up.'
  },
  {
    id: 'APT-105',
    time: '11:15 AM',
    date: TODAY,
    patientName: 'Emily Davis',
    patientInitials: 'ED',
    department: 'Cardiology',
    doctor: 'Dr. Smith',
    type: 'Medication Review',
    status: 'Canceled',
    urgency: 'Medium',
    notes: 'Rescheduled due to emergency.'
  },
  {
    id: 'APT-106',
    time: '01:00 PM',
    date: TODAY,
    patientName: 'Robert Chen',
    patientInitials: 'RC',
    department: 'Cardiology',
    doctor: 'Dr. Smith',
    type: 'Medication Review',
    status: 'Upcoming',
    urgency: 'Low',
    notes: 'Statins dosage adjustment.'
  }
];

export const INITIAL_ACTIVITIES: ActivityItem[] = [
  {
    id: 'ACT-1',
    type: 'lab',
    patientName: 'M. Johnson',
    description: 'Lab results for M. Johnson are ready.',
    timestamp: '10 mins ago',
    statusColor: 'bg-[#10b981]'
  },
  {
    id: 'ACT-2',
    type: 'referral',
    patientName: 'Dr. Adams',
    description: 'New referral received from Dr. Adams.',
    timestamp: '1 hour ago',
    statusColor: 'bg-[#0051d5]'
  },
  {
    id: 'ACT-3',
    type: 'prescription',
    patientName: 'L. Martinez',
    description: 'Prescription refill approved for L. Martinez.',
    timestamp: 'Yesterday at 4:30 PM',
    statusColor: 'bg-[#74777f]'
  },
  {
    id: 'ACT-4',
    type: 'appointment',
    patientName: 'Eleanor Shellstrop',
    description: 'Appointment confirmed for tomorrow at 09:00 AM.',
    timestamp: '2 hours ago',
    statusColor: 'bg-[#316bf3]'
  }
];
