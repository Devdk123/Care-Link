import React, { useState, useEffect } from 'react';
import { User, Mail, Building2, Stethoscope, Bell, BellOff, Shield, Lock, Info, ExternalLink, Palette, CheckCircle2, Save } from 'lucide-react';

interface SettingsViewProps {
  onShowToast?: (title: string, message: string, type?: 'success' | 'info' | 'error') => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({ onShowToast }) => {
  // Profile state
  const [displayName, setDisplayName] = useState('Dr. Aisha Patel');
  const [email, setEmail] = useState('dr.patel@carelink.med');
  const [department, setDepartment] = useState('Cardiology');
  const [specialty, setSpecialty] = useState('Interventional Cardiology');
  const [isSaved, setIsSaved] = useState(false);

  // Notifications state
  const [emailAlerts, setEmailAlerts] = useState(true);
  const [smsAlerts, setSmsAlerts] = useState(false);
  const [urgentAlerts, setUrgentAlerts] = useState(true);

  // Theme state
  const [activeTheme, setActiveTheme] = useState('blue');
  const [twoFactor, setTwoFactor] = useState(false);

  useEffect(() => {
    const savedTheme = localStorage.getItem('carelink-theme');
    if (savedTheme) {
      setActiveTheme(savedTheme);
      document.documentElement.classList.remove('theme-blue', 'theme-slate', 'theme-contrast');
      document.documentElement.classList.add(`theme-${savedTheme}`);
    }
  }, []);

  const handleThemeChange = (theme: string) => {
    setActiveTheme(theme);
    localStorage.setItem('carelink-theme', theme);
    document.documentElement.classList.remove('theme-blue', 'theme-slate', 'theme-contrast');
    document.documentElement.classList.add(`theme-${theme}`);
    onShowToast?.('Theme Updated', `Active theme changed to ${theme}.`, 'info');
  };

  const handleSaveProfile = () => {
    setIsSaved(true);
    onShowToast?.('Profile Saved', 'Clinician credentials updated successfully.', 'success');
    setTimeout(() => setIsSaved(false), 3000);
  };

  const handleChangePassword = () => {
    onShowToast?.('Password Reset', `Password reset instructions sent to ${email}.`, 'info');
  };

  const Toggle = ({ value, setter }: { value: boolean, setter: (val: boolean) => void }) => (
    <button
      onClick={() => setter(!value)}
      className={`relative inline-flex h-6 w-11 rounded-full transition-colors ${value ? 'bg-[#316bf3]' : 'bg-[#c4c6cf]'}`}
    >
      <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-md transition-transform mt-0.5 ${value ? 'translate-x-5 ml-0.5' : 'translate-x-0.5'}`} />
    </button>
  );

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* 1. CLEAN LIGHT HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-2 border-b border-[#e0e3e5]">
        <div>
          <h1 className="text-2xl font-black text-[#191c1e] tracking-tight">Portal Settings & Preferences</h1>
          <p className="text-xs text-[#74777f] mt-1 font-medium">Manage clinician profile, automated clinical notifications, and display themes.</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 text-xs font-semibold border border-emerald-200">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            Online & Synced
          </span>
        </div>
      </div>
        {/* 2. PROFILE SETTINGS */}
        <div className="bg-white rounded-2xl border border-[#e0e3e5] shadow-sm p-6">
          <div className="flex items-center gap-3 mb-6">
            <User className="text-[#316bf3]" size={24} />
            <h2 className="text-xl font-semibold text-gray-800">Profile Settings</h2>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium text-gray-700">Display Name</label>
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className="bg-[#f7f9fb] border border-[#c4c6cf] rounded-xl px-4 py-2.5 text-sm outline-none focus:border-[#316bf3] focus:ring-1 focus:ring-[#316bf3]"
              />
            </div>
            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium text-gray-700">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="bg-[#f7f9fb] border border-[#c4c6cf] rounded-xl px-4 py-2.5 text-sm outline-none focus:border-[#316bf3] focus:ring-1 focus:ring-[#316bf3]"
              />
            </div>
            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium text-gray-700">Department</label>
              <input
                type="text"
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
                className="bg-[#f7f9fb] border border-[#c4c6cf] rounded-xl px-4 py-2.5 text-sm outline-none focus:border-[#316bf3] focus:ring-1 focus:ring-[#316bf3]"
              />
            </div>
            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium text-gray-700">Specialty</label>
              <input
                type="text"
                value={specialty}
                onChange={(e) => setSpecialty(e.target.value)}
                className="bg-[#f7f9fb] border border-[#c4c6cf] rounded-xl px-4 py-2.5 text-sm outline-none focus:border-[#316bf3] focus:ring-1 focus:ring-[#316bf3]"
              />
            </div>
          </div>
          <div className="flex justify-end items-center gap-4">
            {isSaved && <span className="text-green-600 text-sm flex items-center gap-1"><CheckCircle2 size={16} /> Saved</span>}
            <button
              onClick={handleSaveProfile}
              className="bg-[#316bf3] hover:bg-blue-700 text-white px-6 py-2.5 rounded-xl font-medium transition-colors flex items-center gap-2"
            >
              <Save size={18} /> Save Changes
            </button>
          </div>
        </div>

        {/* 3. NOTIFICATION PREFERENCES */}
        <div className="bg-white rounded-2xl border border-[#e0e3e5] shadow-sm p-6">
          <div className="flex items-center gap-3 mb-6">
            <Bell className="text-[#316bf3]" size={24} />
            <h2 className="text-xl font-semibold text-gray-800">Notification Preferences</h2>
          </div>
          
          <div className="space-y-4">
            <div className="flex items-center justify-between py-3 border-b border-gray-100 last:border-0">
              <div>
                <h3 className="font-medium text-gray-800">Email Alerts</h3>
                <p className="text-sm text-gray-500">Receive email notifications for appointment updates</p>
              </div>
              <Toggle value={emailAlerts} setter={setEmailAlerts} />
            </div>
            <div className="flex items-center justify-between py-3 border-b border-gray-100 last:border-0">
              <div>
                <h3 className="font-medium text-gray-800">SMS Alerts</h3>
                <p className="text-sm text-gray-500">Get text messages for urgent notifications</p>
              </div>
              <Toggle value={smsAlerts} setter={setSmsAlerts} />
            </div>
            <div className="flex items-center justify-between py-3 border-b border-gray-100 last:border-0">
              <div>
                <h3 className="font-medium text-gray-800">Urgent Notifications</h3>
                <p className="text-sm text-gray-500">Critical vitals and emergency alerts</p>
              </div>
              <Toggle value={urgentAlerts} setter={setUrgentAlerts} />
            </div>
          </div>
        </div>

        {/* 4. COLOR THEME PREFERENCES */}
        <div className="bg-white rounded-2xl border border-[#e0e3e5] shadow-sm p-6">
          <div className="flex items-center gap-3 mb-6">
            <Palette className="text-[#316bf3]" size={24} />
            <h2 className="text-xl font-semibold text-gray-800">Color Theme</h2>
          </div>
          
          <div className="flex flex-wrap gap-4">
            <button
              onClick={() => handleThemeChange('blue')}
              className={`flex items-center gap-2 px-5 py-3 rounded-xl border ${activeTheme === 'blue' ? 'border-[#316bf3] bg-blue-50' : 'border-gray-200'} transition-all`}
            >
              <div className="w-5 h-5 rounded-full bg-[#316bf3]"></div>
              <span className="font-medium">Clinical Blue</span>
              {activeTheme === 'blue' && <CheckCircle2 size={18} className="text-[#316bf3] ml-2" />}
            </button>
            
            <button
              onClick={() => handleThemeChange('slate')}
              className={`flex items-center gap-2 px-5 py-3 rounded-xl border ${activeTheme === 'slate' ? 'border-[#475569] bg-slate-50' : 'border-gray-200'} transition-all`}
            >
              <div className="w-5 h-5 rounded-full bg-[#475569]"></div>
              <span className="font-medium">Neutral Slate</span>
              {activeTheme === 'slate' && <CheckCircle2 size={18} className="text-[#475569] ml-2" />}
            </button>
            
            <button
              onClick={() => handleThemeChange('contrast')}
              className={`flex items-center gap-2 px-5 py-3 rounded-xl border ${activeTheme === 'contrast' ? 'border-black bg-gray-50' : 'border-gray-200'} transition-all`}
            >
              <div className="w-5 h-5 rounded-full bg-[#000000]"></div>
              <span className="font-medium">High Contrast</span>
              {activeTheme === 'contrast' && <CheckCircle2 size={18} className="text-black ml-2" />}
            </button>
          </div>
        </div>

        {/* 5. SECURITY & PRIVACY */}
        <div className="bg-white rounded-2xl border border-[#e0e3e5] shadow-sm p-6">
          <div className="flex items-center gap-3 mb-4">
            <Shield className="text-[#316bf3]" size={24} />
            <h2 className="text-xl font-semibold text-gray-800">Security & Privacy</h2>
          </div>
          
          <p className="text-sm text-gray-500 mb-6">Manage your clinical portal security settings</p>
          
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 py-3">
              <div>
                <h3 className="font-medium text-gray-800">Password</h3>
                <p className="text-sm text-gray-500">Update your account password</p>
              </div>
              <button
                onClick={handleChangePassword}
                className="px-5 py-2 border border-[#c4c6cf] rounded-xl font-medium text-gray-700 hover:bg-gray-50 transition-colors text-xs active:scale-95"
              >
                Change Password
              </button>
            </div>
            
            <div className="flex items-center justify-between py-3">
              <div>
                <h3 className="font-medium text-gray-800 flex items-center gap-2">Two-factor Authentication <Lock size={14} className="text-gray-400" /></h3>
                <p className="text-sm text-gray-500">Add an extra layer of security to your account</p>
              </div>
              <Toggle value={twoFactor} setter={setTwoFactor} />
            </div>
          </div>
        </div>

        {/* 6. ABOUT CARELINK */}
        <div className="bg-white rounded-2xl border border-[#e0e3e5] shadow-sm p-6">
          <div className="flex items-center gap-3 mb-6">
            <Info className="text-[#316bf3]" size={24} />
            <h2 className="text-xl font-semibold text-gray-800">About CareLink</h2>
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mb-8 text-sm">
            <div>
              <span className="text-gray-500 block mb-1">App Version</span>
              <span className="font-medium text-gray-800">2.4.0</span>
            </div>
            <div>
              <span className="text-gray-500 block mb-1">Build Date</span>
              <span className="font-medium text-gray-800">2026-08-01</span>
            </div>
            <div>
              <span className="text-gray-500 block mb-1">Environment</span>
              <span className="font-medium text-gray-800">Production</span>
            </div>
          </div>
          
          <div className="flex flex-col gap-3 border-t border-gray-100 pt-6 mb-6">
            <a href="#" className="flex items-center gap-2 text-[#316bf3] hover:underline w-fit">
              Privacy Policy <ExternalLink size={14} />
            </a>
            <a href="#" className="flex items-center gap-2 text-[#316bf3] hover:underline w-fit">
              Terms of Service <ExternalLink size={14} />
            </a>
            <a href="#" className="flex items-center gap-2 text-[#316bf3] hover:underline w-fit">
              HIPAA Compliance Documentation <ExternalLink size={14} />
            </a>
          </div>
          
          <div className="text-xs text-gray-400">
            © 2026 CareLink Healthcare Systems
          </div>
        </div>
      </div>
  );
};
