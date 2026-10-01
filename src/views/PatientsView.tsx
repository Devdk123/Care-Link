import React, { useState, useMemo } from 'react';
import { Patient } from '../types';
import { tierColor } from '../lib/api';
import {
  Search,
  Filter,
  Eye,
  ChevronLeft,
  ChevronRight,
  Download,
  BrainCircuit,
  RefreshCw,
  Users,
  AlertTriangle,
  ShieldCheck,
  Activity,
} from 'lucide-react';

interface PatientsViewProps {
  patients: Patient[];
  onSelectPatient: (patient: Patient) => void;
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  onShowToast?: (title: string, message: string, type?: 'success' | 'info' | 'error') => void;
  onRefetch?: () => void;
}

export const PatientsView: React.FC<PatientsViewProps> = ({
  patients,
  onSelectPatient,
  searchQuery,
  setSearchQuery,
  onShowToast,
  onRefetch,
}) => {
  const [riskFilter, setRiskFilter] = useState<string>('All');
  const [genderFilter, setGenderFilter] = useState<string>('All');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 12;

  // ── CSV Export ──
  const handleExportCSV = () => {
    const listToExport = filteredPatients.length > 0 ? filteredPatients : patients;
    const headers = ['Patient ID', 'External Ref', 'Age', 'Gender', 'Admission Type', 'Discharge Location', 'Probability', 'Risk Tier', 'Predicted At'];
    const escapeCSV = (str: string | number | null | undefined) => {
      if (str == null) return '""';
      return `"${String(str).replace(/"/g, '""')}"`;
    };
    const rows = listToExport.map((p) => [
      escapeCSV(p.patient_id),
      escapeCSV(p.external_ref),
      escapeCSV(p.age),
      escapeCSV(p.gender),
      escapeCSV(p.admission_type),
      escapeCSV(p.discharge_location),
      escapeCSV(p.probability != null ? (p.probability * 100).toFixed(1) + '%' : '—'),
      escapeCSV(p.risk_tier),
      escapeCSV(p.predicted_at ? new Date(p.predicted_at).toLocaleDateString() : '—'),
    ]);
    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `carelink_risk_report_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    if (onShowToast) {
      onShowToast('CSV Export Complete', `Exported ${listToExport.length} patient risk records.`, 'success');
    }
  };

  // ── Search highlight ──
  const HighlightText = ({ text, highlight }: { text: string; highlight: string }) => {
    if (!highlight.trim()) return <>{text}</>;
    const regex = new RegExp(`(${highlight.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
    const parts = text.split(regex);
    return (
      <>
        {parts.map((part, i) =>
          regex.test(part) ? (
            <span key={i} className="bg-[#fff176] text-[#191c1e] font-bold rounded-sm">{part}</span>
          ) : (
            <span key={i}>{part}</span>
          )
        )}
      </>
    );
  };

  // ── Filters ──
  const filteredPatients = useMemo(() => {
    return patients.filter((p) => {
      const q = searchQuery.toLowerCase();
      const matchesSearch =
        p.external_ref.toLowerCase().includes(q) ||
        (p.admission_type && p.admission_type.toLowerCase().includes(q)) ||
        (p.discharge_location && p.discharge_location.toLowerCase().includes(q)) ||
        (p.gender && p.gender.toLowerCase().includes(q)) ||
        String(p.patient_id).includes(q);

      const matchesRisk = riskFilter === 'All' || p.risk_tier === riskFilter;
      const matchesGender = genderFilter === 'All' || p.gender === genderFilter;

      return matchesSearch && matchesRisk && matchesGender;
    });
  }, [patients, searchQuery, riskFilter, genderFilter]);

  const totalPages = Math.ceil(filteredPatients.length / itemsPerPage) || 1;
  const paginatedPatients = filteredPatients.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const riskCounts = useMemo(() => ({
    All: patients.length,
    High: patients.filter((p) => p.risk_tier === 'High').length,
    Medium: patients.filter((p) => p.risk_tier === 'Medium').length,
    Low: patients.filter((p) => p.risk_tier === 'Low').length,
  }), [patients]);

  return (
    <div className="space-y-6 pb-12">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white p-6 rounded-2xl border border-[#e0e3e5] shadow-sm">
        <div className="flex items-center gap-3">
          <div>
            <h2 className="text-xl font-bold text-[#191c1e]">Patient Risk Panel</h2>
            <p className="text-xs text-[#74777f]">Readmission risk scores from the federated XGBoost model</p>
          </div>
          <span className="px-2.5 py-1 bg-[#316bf3]/10 text-[#316bf3] text-xs font-bold rounded-full">
            {patients.length}
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={handleExportCSV}
            className="px-3.5 py-2 bg-white border border-[#c4c6cf] hover:bg-[#f2f4f6] text-[#022448] text-xs font-bold rounded-xl shadow-sm flex items-center gap-2 transition-all"
          >
            <Download className="w-3.5 h-3.5 text-[#316bf3]" />
            <span>Export CSV</span>
          </button>
          {onRefetch && (
            <button
              onClick={onRefetch}
              className="px-3.5 py-2 bg-white border border-[#c4c6cf] hover:bg-[#f2f4f6] text-[#022448] text-xs font-bold rounded-xl shadow-sm flex items-center gap-2 transition-all"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Refresh</span>
            </button>
          )}
        </div>
      </div>

      {/* Risk Filter Tabs + Search */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        {/* Risk Pills */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0">
          {(['All', 'High', 'Medium', 'Low'] as const).map((filter) => {
            const count = riskCounts[filter];
            const isActive = riskFilter === filter;
            const pillColor = filter === 'High' ? 'bg-[#ef4444]' :
              filter === 'Medium' ? 'bg-[#f59e0b]' :
              filter === 'Low' ? 'bg-[#10b981]' : 'bg-[#022448]';

            return (
              <button
                key={filter}
                onClick={() => { setRiskFilter(filter); setCurrentPage(1); }}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition-all shrink-0 flex items-center gap-2 ${
                  isActive
                    ? `${pillColor} text-white shadow-md`
                    : 'bg-white text-[#43474e] border border-[#e0e3e5] hover:bg-[#f2f4f6]'
                }`}
              >
                {filter === 'High' && <AlertTriangle className="w-3.5 h-3.5" />}
                {filter === 'Medium' && <Activity className="w-3.5 h-3.5" />}
                {filter === 'Low' && <ShieldCheck className="w-3.5 h-3.5" />}
                {filter === 'All' && <Users className="w-3.5 h-3.5" />}
                <span>{filter}</span>
                <span className={`text-[10px] px-2 py-0.5 rounded-full ${
                  isActive ? 'bg-white/20 text-white' : 'bg-[#f2f4f6] text-[#74777f]'
                }`}>{count}</span>
              </button>
            );
          })}
        </div>

        {/* Search + Gender Filter */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
          <div className="relative w-full lg:w-72">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-[#74777f]" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search ID, admission type..."
              className="w-full pl-10 pr-4 py-2 bg-white border border-[#c4c6cf] rounded-xl text-xs text-[#191c1e] placeholder-[#74777f] focus:outline-none focus:border-[#316bf3]"
            />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-[#74777f]">Gender:</span>
            <select
              value={genderFilter}
              onChange={(e) => { setGenderFilter(e.target.value); setCurrentPage(1); }}
              className="pl-3 pr-8 py-2 bg-[#f7f9fb] border border-[#c4c6cf] rounded-xl text-xs font-semibold text-[#191c1e] focus:outline-none focus:border-[#316bf3]"
            >
              <option value="All">All</option>
              <option value="M">Male</option>
              <option value="F">Female</option>
            </select>
          </div>
        </div>
      </div>

      {/* Patient Table */}
      <div className="bg-white rounded-2xl border border-[#e0e3e5] shadow-sm overflow-hidden">
        {paginatedPatients.length === 0 ? (
          <div className="p-12 text-center space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-[#f2f4f6] text-[#74777f] mx-auto flex items-center justify-center">
              <Search className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-[#191c1e]">No Patients Found</h3>
            <p className="text-xs text-[#74777f] max-w-sm mx-auto">
              No patient records match your search criteria. Try adjusting filters.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-[#f7f9fb] border-b border-[#e0e3e5] text-[11px] font-bold text-[#74777f] uppercase tracking-wider">
                  <th className="py-3.5 px-6">Patient</th>
                  <th className="py-3.5 px-4">Age</th>
                  <th className="py-3.5 px-4">Gender</th>
                  <th className="py-3.5 px-4">Admission Type</th>
                  <th className="py-3.5 px-4">Discharge To</th>
                  <th className="py-3.5 px-4">Risk Score</th>
                  <th className="py-3.5 px-4">Risk Tier</th>
                  <th className="py-3.5 px-6 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#f2f4f6] text-xs">
                {paginatedPatients.map((patient) => {
                  const tc = tierColor(patient.risk_tier);
                  const prob = patient.probability != null ? Math.round(patient.probability * 100) : null;

                  return (
                    <tr
                      key={patient.patient_id}
                      className="hover:bg-[#f7f9fb] transition-colors group cursor-pointer"
                      onClick={() => onSelectPatient(patient)}
                    >
                      {/* Patient ID */}
                      <td className="py-4 px-6">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-[#022448] text-white font-bold text-xs flex items-center justify-center shrink-0">
                            {patient.external_ref.slice(0, 2)}
                          </div>
                          <div>
                            <p className="font-bold text-[#191c1e] text-sm group-hover:text-[#316bf3] transition-colors">
                              <HighlightText text={patient.external_ref} highlight={searchQuery} />
                            </p>
                            <p className="text-[10px] text-[#74777f] font-mono">
                              ID: {patient.patient_id}
                            </p>
                          </div>
                        </div>
                      </td>

                      {/* Age */}
                      <td className="py-4 px-4 font-semibold text-[#191c1e]">
                        {patient.age ? `${patient.age} yrs` : '—'}
                      </td>

                      {/* Gender */}
                      <td className="py-4 px-4 text-[#43474e]">
                        {patient.gender === 'M' ? 'Male' : patient.gender === 'F' ? 'Female' : patient.gender || '—'}
                      </td>

                      {/* Admission Type */}
                      <td className="py-4 px-4">
                        <span className="bg-[#f2f4f6] px-2.5 py-1 rounded-md border border-[#e0e3e5] font-medium text-[#43474e]">
                          <HighlightText text={patient.admission_type || '—'} highlight={searchQuery} />
                        </span>
                      </td>

                      {/* Discharge Location */}
                      <td className="py-4 px-4 text-[#74777f] font-medium">
                        {patient.discharge_location || '—'}
                      </td>

                      {/* Risk Score */}
                      <td className="py-4 px-4">
                        {prob != null ? (
                          <div className="flex items-center gap-2">
                            <div className="w-16 h-2 bg-[#f2f4f6] rounded-full overflow-hidden">
                              <div
                                className="h-full rounded-full transition-all"
                                style={{
                                  width: `${prob}%`,
                                  backgroundColor: tc.ring,
                                }}
                              />
                            </div>
                            <span className="font-bold tabular-nums" style={{ color: tc.ring }}>
                              {prob}%
                            </span>
                          </div>
                        ) : (
                          <span className="text-[#74777f]">—</span>
                        )}
                      </td>

                      {/* Risk Tier Badge */}
                      <td className="py-4 px-4">
                        {patient.risk_tier ? (
                          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider ${tc.bg} ${tc.text}`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${tc.dot}`} />
                            {patient.risk_tier}
                          </span>
                        ) : (
                          <span className="text-[#74777f]">—</span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="py-4 px-6 text-right">
                        <button
                          onClick={(e) => { e.stopPropagation(); onSelectPatient(patient); }}
                          className="p-2 text-[#316bf3] hover:bg-[#316bf3]/10 rounded-lg transition-colors inline-flex items-center gap-1.5"
                          title="View Risk Analysis"
                        >
                          <BrainCircuit className="w-4 h-4" />
                          <span className="hidden sm:inline text-xs font-bold">Analyze</span>
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        <div className="px-6 py-4 bg-[#f7f9fb] border-t border-[#e0e3e5] flex items-center justify-between text-xs text-[#74777f]">
          <span>
            Showing <span className="font-bold text-[#191c1e]">{paginatedPatients.length}</span> of{' '}
            <span className="font-bold text-[#191c1e]">{filteredPatients.length}</span> patients
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="p-2 rounded-lg border border-[#c4c6cf] disabled:opacity-40 hover:bg-white transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="font-semibold text-[#191c1e]">
              Page {currentPage} of {totalPages}
            </span>
            <button
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="p-2 rounded-lg border border-[#c4c6cf] disabled:opacity-40 hover:bg-white transition-colors"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
