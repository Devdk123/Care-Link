import React, { useState } from 'react';
import { Patient } from '../../types';
import {
  X,
  BrainCircuit,
  AlertTriangle,
  CheckCircle2,
  ArrowUp,
  ArrowDown,
  Printer,
  Activity,
  Clock,
  ShieldCheck,
  MapPin,
  User,
  Calendar,
  FileText,
  Heart,
  Brain,
  Loader2,
} from 'lucide-react';
import { tierColor, callTriage, getUrgencyColor } from '../../lib/api';
import type { TriageResult } from '../../types';
import { usePrediction } from '../../hooks/usePrediction';
import { humanizeFeature } from '../../lib/demo-data';

interface ViewPatientModalProps {
  patient: Patient | null;
  onClose: () => void;
  onShowToast?: (title: string, message: string, type?: 'success' | 'info' | 'error') => void;
}

export const ViewPatientModal: React.FC<ViewPatientModalProps> = ({
  patient,
  onClose,
  onShowToast,
}) => {
  const [activeTab, setActiveTab] = useState<'overview' | 'risk'>('overview');

  // Risk Analysis
  const { prediction, loading: isLoadingRisk, submitFeedback } = usePrediction(patient?.patient_id);
  const [feedbackMode, setFeedbackMode] = useState<'confirmed' | 'overridden' | null>(null);
  const [feedbackNote, setFeedbackNote] = useState('');
  const [feedbackSent, setFeedbackSent] = useState(false);

  // Triage
  const [triageResult, setTriageResult] = useState<TriageResult | null>(null);
  const [isTriageLoading, setIsTriageLoading] = useState(false);

  const handleSendFeedback = async (mode: 'confirmed' | 'overridden') => {
    if (!prediction) return;

    if (mode === 'overridden' && !feedbackNote && feedbackMode !== 'overridden') {
      setFeedbackMode('overridden');
      return;
    }

    try {
      const success = await submitFeedback(mode, feedbackNote);
      if (success) {
        setFeedbackSent(true);
        setFeedbackMode(null);
        if (onShowToast) onShowToast('Feedback Saved', 'Clinician feedback recorded successfully.', 'success');
      } else {
        if (onShowToast) onShowToast('Error', 'Failed to save feedback.', 'error');
      }
    } catch {
      if (onShowToast) onShowToast('Error', 'Failed to save feedback.', 'error');
    }
  };

  const handleRunTriage = async () => {
    if (!patient) return;
    setIsTriageLoading(true);
    try {
      const result = await callTriage(patient);
      setTriageResult(result);
    } catch (e: any) {
      if (onShowToast) onShowToast('Triage Error', e.message || 'Failed to generate AI triage.', 'error');
    } finally {
      setIsTriageLoading(false);
    }
  };

  if (!patient) return null;

  const tc = tierColor(patient.risk_tier);
  const prob = patient.probability != null ? Math.round(patient.probability * 100) : null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-sm animate-in fade-in overflow-y-auto">
      <div className="bg-white rounded-2xl max-w-3xl w-full border border-[#e0e3e5] shadow-2xl overflow-hidden animate-in zoom-in-95 my-auto max-h-[92vh] flex flex-col">

        {/* ═══ Banner Header ═══ */}
        <div className="bg-[#022448] text-white p-5 sm:p-6 relative shrink-0">
          <div className="absolute top-4 right-4 flex items-center gap-2">
            <button
              onClick={() => window.print()}
              className="bg-white/10 hover:bg-white/20 text-[#adc8f5] hover:text-white px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 border border-white/15"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print</span>
            </button>
            <button
              onClick={onClose}
              className="text-[#adc8f5] hover:text-white hover:bg-white/10 p-1.5 rounded-lg transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="flex items-start gap-4 pr-32">
            <div className="relative shrink-0">
              <div className="w-16 h-16 rounded-2xl bg-[#1e3a5f] text-white font-bold text-2xl flex items-center justify-center ring-4 ring-white/20">
                {patient.external_ref.slice(0, 2)}
              </div>
              {patient.risk_tier && (
                <span
                  className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full border-2 border-[#022448] flex items-center justify-center text-[8px] font-black"
                  style={{ backgroundColor: tc.ring, color: '#fff' }}
                >
                  {patient.risk_tier === 'High' ? '!' : patient.risk_tier === 'Medium' ? '~' : '✓'}
                </span>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-mono font-semibold bg-white/10 px-2 py-0.5 rounded text-[#adc8f5]">
                  ID: {patient.patient_id}
                </span>
                {patient.risk_tier && (
                  <span
                    className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-full"
                    style={{ backgroundColor: tc.ring + '33', color: tc.ring }}
                  >
                    {patient.risk_tier} RISK
                  </span>
                )}
                {prob != null && (
                  <span className="text-[10px] font-mono font-bold bg-white/10 px-2 py-0.5 rounded text-white">
                    {prob}% readmission
                  </span>
                )}
              </div>
              <h2 className="text-xl font-bold mt-1 text-white">{patient.external_ref}</h2>
              <p className="text-xs text-[#adc8f5] mt-0.5 flex items-center gap-2 flex-wrap">
                <span>{patient.age ? `${patient.age} years` : 'Age unknown'}</span>
                <span>•</span>
                <span>{patient.gender === 'M' ? 'Male' : patient.gender === 'F' ? 'Female' : patient.gender || 'Unknown'}</span>
                <span>•</span>
                <span>{patient.admission_type || 'Unknown admission'}</span>
              </p>
            </div>
          </div>

          {/* Tab Controls */}
          <div className="flex items-center gap-2 mt-5 border-t border-white/10 pt-4 overflow-x-auto">
            <button
              onClick={() => setActiveTab('overview')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shrink-0 ${
                activeTab === 'overview'
                  ? 'bg-white text-[#022448] shadow-md'
                  : 'bg-white/10 text-[#adc8f5] hover:text-white hover:bg-white/20'
              }`}
            >
              <FileText className="w-3.5 h-3.5" />
              <span>Overview</span>
            </button>
            <button
              onClick={() => setActiveTab('risk')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shrink-0 ${
                activeTab === 'risk'
                  ? 'bg-white text-[#022448] shadow-md'
                  : 'bg-white/10 text-[#adc8f5] hover:text-white hover:bg-white/20'
              }`}
            >
              <BrainCircuit className="w-3.5 h-3.5" />
              <span>Risk Analysis</span>
            </button>
          </div>
        </div>

        {/* ═══ Modal Body ═══ */}
        <div className="p-5 sm:p-6 space-y-6 overflow-y-auto flex-1 bg-[#f7f9fb]">

          {/* ──────── OVERVIEW TAB ──────── */}
          {activeTab === 'overview' && (
            <div className="space-y-6 animate-in fade-in">
              {/* Quick Metrics */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="p-3.5 bg-white rounded-xl border border-[#e0e3e5]">
                  <p className="text-[10px] font-semibold text-[#74777f] uppercase tracking-wider">Admission Type</p>
                  <p className="text-base font-bold text-[#191c1e] mt-1 flex items-center gap-1.5">
                    <Activity className="w-4 h-4 text-[#316bf3]" />
                    {patient.admission_type || 'Unknown'}
                  </p>
                </div>
                <div className="p-3.5 bg-white rounded-xl border border-[#e0e3e5]">
                  <p className="text-[10px] font-semibold text-[#74777f] uppercase tracking-wider">Discharge Location</p>
                  <p className="text-base font-bold text-[#191c1e] mt-1 flex items-center gap-1.5">
                    <MapPin className="w-4 h-4 text-[#10b981]" />
                    {patient.discharge_location || 'Unknown'}
                  </p>
                </div>
                <div className="p-3.5 bg-white rounded-xl border border-[#e0e3e5]">
                  <p className="text-[10px] font-semibold text-[#74777f] uppercase tracking-wider">Last Prediction</p>
                  <p className="text-base font-bold text-[#191c1e] mt-1 flex items-center gap-1.5">
                    <Clock className="w-4 h-4 text-[#0051d5]" />
                    {patient.predicted_at
                      ? new Date(patient.predicted_at).toLocaleDateString()
                      : 'Never'}
                  </p>
                </div>
              </div>

              {/* Patient Details */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 border-t border-b border-[#e0e3e5] py-4">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-[#316bf3]/10 flex items-center justify-center text-[#316bf3]">
                    <User className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="text-[10px] text-[#74777f] font-medium uppercase">Age</p>
                    <p className="text-xs font-semibold text-[#191c1e]">
                      {patient.age ? `${patient.age} years` : 'Not recorded'}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-[#10b981]/10 flex items-center justify-center text-[#10b981]">
                    <Heart className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="text-[10px] text-[#74777f] font-medium uppercase">Gender</p>
                    <p className="text-xs font-semibold text-[#191c1e]">
                      {patient.gender === 'M' ? 'Male' : patient.gender === 'F' ? 'Female' : patient.gender || 'Not recorded'}
                    </p>
                  </div>
                </div>
              </div>

              {/* Risk Summary (inline) */}
              <div className="pt-2">
                <h4 className="text-xs font-bold text-[#191c1e] uppercase tracking-wider flex items-center gap-1.5 mb-3">
                  <BrainCircuit className="w-4 h-4 text-blue-500" />
                  30-Day Readmission Risk
                </h4>

                {isLoadingRisk ? (
                  <div className="animate-pulse flex space-x-4">
                    <div className="h-16 w-16 bg-gray-200 rounded-full" />
                    <div className="flex-1 space-y-4 py-1">
                      <div className="h-4 bg-gray-200 rounded w-3/4" />
                      <div className="h-4 bg-gray-200 rounded w-5/6" />
                    </div>
                  </div>
                ) : prediction ? (
                  <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
                    <div className="flex flex-col sm:flex-row items-center gap-4">
                      {/* Big Score */}
                      <div className="text-center shrink-0">
                        <div
                          className="text-4xl font-black"
                          style={{ color: tierColor(prediction.risk_tier).ring }}
                        >
                          {Math.round(prediction.probability * 100)}%
                        </div>
                        <span
                          className="inline-block mt-1 px-2.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider"
                          style={{
                            backgroundColor: tierColor(prediction.risk_tier).ring + '22',
                            color: tierColor(prediction.risk_tier).ring,
                          }}
                        >
                          {prediction.risk_tier} Risk
                        </span>
                      </div>

                      <div className="hidden sm:block w-px h-16 bg-gray-200" />

                      {/* SHAP Factors */}
                      <div className="flex-1">
                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">
                          Key Driving Factors (SHAP)
                        </p>
                        <div className="flex flex-wrap gap-2">
                          {prediction.top_factors.slice(0, 6).map((f, idx) => (
                            <div
                              key={idx}
                              className="flex items-center gap-1 bg-gray-50 border border-gray-100 px-2 py-1 rounded text-xs font-medium text-gray-700"
                            >
                              {humanizeFeature(f.feature)}
                              {f.impact > 0 ? (
                                <ArrowUp className="w-3 h-3 text-red-500" />
                              ) : (
                                <ArrowDown className="w-3 h-3 text-green-500" />
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* Feedback Buttons */}
                    {!feedbackSent ? (
                      <div className="mt-4 pt-4 border-t border-gray-100 flex flex-wrap gap-3">
                        {feedbackMode === 'overridden' ? (
                          <div className="w-full space-y-3 bg-orange-50 p-3 rounded-lg border border-orange-100">
                            <p className="text-xs font-bold text-orange-800">Override Prediction</p>
                            <textarea
                              className="w-full p-2 border border-orange-200 rounded text-xs"
                              placeholder="Reason for overriding (e.g., patient has external support structure)..."
                              value={feedbackNote}
                              onChange={(e) => setFeedbackNote(e.target.value)}
                            />
                            <div className="flex gap-2">
                              <button
                                onClick={() => setFeedbackMode(null)}
                                className="px-3 py-1.5 text-xs text-orange-600 font-medium hover:bg-orange-100 rounded"
                              >
                                Cancel
                              </button>
                              <button
                                onClick={() => handleSendFeedback('overridden')}
                                className="px-3 py-1.5 text-xs bg-orange-500 text-white font-bold rounded shadow-sm hover:bg-orange-600"
                              >
                                Submit Override
                              </button>
                            </div>
                          </div>
                        ) : (
                          <>
                            <button
                              onClick={() => handleSendFeedback('confirmed')}
                              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold bg-green-50 text-green-700 border border-green-200 rounded-lg hover:bg-green-100 transition-colors"
                            >
                              <CheckCircle2 className="w-4 h-4" />
                              Confirm Prediction
                            </button>
                            <button
                              onClick={() => setFeedbackMode('overridden')}
                              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold bg-orange-50 text-orange-700 border border-orange-200 rounded-lg hover:bg-orange-100 transition-colors"
                            >
                              <AlertTriangle className="w-4 h-4" />
                              Override Prediction
                            </button>
                          </>
                        )}
                      </div>
                    ) : (
                      <div className="mt-4 pt-4 border-t border-gray-100 flex items-center gap-2 text-sm font-semibold text-green-600">
                        <CheckCircle2 className="w-4 h-4" />
                        Feedback submitted. Thank you!
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-sm text-gray-500">Risk score not available.</div>
                )}
              </div>

              {/* AI Triage */}
              <div className="pt-4 border-t border-[#e0e3e5]">
                <div className="flex items-center justify-between mb-4">
                  <h4 className="text-xs font-bold text-[#191c1e] uppercase tracking-wider flex items-center gap-1.5">
                    <Brain className="w-4 h-4 text-[#8b5cf6]" />
                    AI Triage Assessment
                  </h4>
                  {!triageResult && !isTriageLoading && (
                    <button
                      onClick={handleRunTriage}
                      className="px-3 py-1.5 text-[11px] font-bold bg-[#f3e8ff] text-[#7e22ce] hover:bg-[#e9d5ff] rounded-xl transition-colors flex items-center gap-1.5"
                    >
                      <Brain className="w-3.5 h-3.5" />
                      Run AI Triage
                    </button>
                  )}
                </div>

                {isTriageLoading && (
                  <div className="p-6 bg-[#f7f9fb] border border-[#e0e3e5] rounded-xl flex items-center justify-center">
                    <div className="flex items-center gap-3">
                      <Loader2 className="w-5 h-5 text-[#8b5cf6] animate-spin" />
                      <span className="text-xs font-semibold text-[#43474e]">Generating clinical triage...</span>
                    </div>
                  </div>
                )}

                {triageResult && !isTriageLoading && (
                  <div className="p-4 bg-white border border-[#e0e3e5] rounded-xl shadow-sm space-y-4">
                    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                      <div>
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider ${getUrgencyColor(triageResult.urgencyLevel)}`}>
                          <AlertTriangle className="w-3 h-3" />
                          {triageResult.urgencyLevel}
                        </span>
                        <p className="text-xs text-[#43474e] mt-2 leading-relaxed max-w-2xl">
                          {triageResult.clinicalSummary}
                        </p>
                      </div>
                      <span className="inline-flex items-center gap-1.5 text-[10px] font-bold text-[#74777f] uppercase tracking-wider bg-[#f2f4f6] px-2.5 py-1 rounded-md shrink-0">
                        <Clock className="w-3 h-3" />
                        Wait: {triageResult.estimatedWaitTime}
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 pt-3 border-t border-[#e0e3e5]">
                      <div>
                        <h5 className="text-[10px] font-bold text-[#191c1e] uppercase tracking-wider mb-2">Primary Concerns</h5>
                        <ul className="space-y-1.5">
                          {triageResult.primaryConcerns.map((c, i) => (
                            <li key={i} className="text-[11px] text-[#43474e] flex items-start gap-1.5">
                              <span className="text-[#8b5cf6] mt-0.5">•</span>
                              <span>{c}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                      <div>
                        <h5 className="text-[10px] font-bold text-[#191c1e] uppercase tracking-wider mb-2">Recommended Actions</h5>
                        <ul className="space-y-1.5">
                          {triageResult.recommendedActions.map((a, i) => (
                            <li key={i} className="text-[11px] text-[#43474e] flex items-start gap-1.5">
                              <span className="text-[#316bf3] mt-0.5">•</span>
                              <span>{a}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>

                    {triageResult.redFlags && triageResult.redFlags.length > 0 && (
                      <div className="pt-3 border-t border-[#e0e3e5]">
                        <h5 className="text-[10px] font-bold text-[#ba1a1a] uppercase tracking-wider mb-2 flex items-center gap-1">
                          <AlertTriangle className="w-3 h-3" /> Red Flags
                        </h5>
                        <div className="flex flex-wrap gap-2">
                          {triageResult.redFlags.map((rf, i) => (
                            <span key={i} className="px-2 py-1 bg-[#ba1a1a]/10 text-[#ba1a1a] text-[10px] font-semibold rounded-md">
                              {rf}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ──────── RISK ANALYSIS TAB ──────── */}
          {activeTab === 'risk' && (
            <div className="animate-in fade-in space-y-6">
              {isLoadingRisk ? (
                <div className="py-12 text-center">
                  <Loader2 className="w-8 h-8 text-[#316bf3] animate-spin mx-auto mb-3" />
                  <p className="text-sm font-semibold text-[#43474e]">Loading ML prediction...</p>
                  <p className="text-xs text-[#74777f] mt-1">Running XGBoost + SHAP analysis</p>
                </div>
              ) : prediction ? (
                <>
                  {/* Big Gauge */}
                  <div className="bg-white rounded-2xl border border-[#e0e3e5] p-6 shadow-sm text-center">
                    <div className="relative w-40 h-40 mx-auto mb-4">
                      <svg viewBox="0 0 120 120" className="w-full h-full -rotate-90">
                        <circle
                          cx="60" cy="60" r="50"
                          fill="none"
                          stroke="#f2f4f6"
                          strokeWidth="10"
                        />
                        <circle
                          cx="60" cy="60" r="50"
                          fill="none"
                          stroke={tierColor(prediction.risk_tier).ring}
                          strokeWidth="10"
                          strokeLinecap="round"
                          strokeDasharray={`${Math.round(prediction.probability * 314)} 314`}
                          className="transition-all duration-700"
                        />
                      </svg>
                      <div className="absolute inset-0 flex flex-col items-center justify-center">
                        <span
                          className="text-3xl font-black"
                          style={{ color: tierColor(prediction.risk_tier).ring }}
                        >
                          {Math.round(prediction.probability * 100)}%
                        </span>
                        <span className="text-[10px] font-bold text-[#74777f] uppercase tracking-wider">
                          Readmission Risk
                        </span>
                      </div>
                    </div>
                    <span
                      className="px-4 py-1.5 rounded-full text-sm font-bold uppercase tracking-wider"
                      style={{
                        backgroundColor: tierColor(prediction.risk_tier).ring + '22',
                        color: tierColor(prediction.risk_tier).ring,
                      }}
                    >
                      {prediction.risk_tier} Risk
                    </span>
                    <p className="text-xs text-[#74777f] mt-2">
                      Prediction ID: {prediction.prediction_id} • Model: XGBoost-Federated
                    </p>
                  </div>

                  {/* SHAP Feature Impact */}
                  <div className="bg-white rounded-2xl border border-[#e0e3e5] p-6 shadow-sm">
                    <h3 className="text-sm font-bold text-[#191c1e] mb-4 flex items-center gap-2">
                      <Activity className="w-4 h-4 text-[#316bf3]" />
                      SHAP Feature Impact Analysis
                    </h3>
                    <p className="text-xs text-[#74777f] mb-4">
                      Features contributing to the readmission prediction. Red bars increase risk, green bars decrease risk.
                    </p>
                    <div className="space-y-3">
                      {prediction.top_factors.map((factor, idx) => {
                        const maxImpact = Math.max(...prediction.top_factors.map(f => Math.abs(f.impact)));
                        const barWidth = Math.min(Math.round((Math.abs(factor.impact) / (maxImpact || 1)) * 100), 100);
                        const isPositive = factor.impact > 0;

                        return (
                          <div key={idx} className="flex items-center gap-3">
                            <div className="w-36 shrink-0 text-right">
                              <span className="text-xs font-semibold text-[#191c1e]">
                                {humanizeFeature(factor.feature)}
                              </span>
                            </div>
                            <div className="flex-1 flex items-center gap-2">
                              <div className="flex-1 h-5 bg-[#f2f4f6] rounded-full overflow-hidden relative">
                                <div
                                  className={`h-full rounded-full transition-all duration-500 ${
                                    isPositive ? 'bg-red-400' : 'bg-green-400'
                                  }`}
                                  style={{ width: `${barWidth}%` }}
                                />
                              </div>
                              <span className={`text-xs font-bold tabular-nums w-14 text-right ${
                                isPositive ? 'text-red-500' : 'text-green-500'
                              }`}>
                                {isPositive ? '+' : ''}{factor.impact.toFixed(3)}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Feedback Section */}
                  <div className="bg-white rounded-2xl border border-[#e0e3e5] p-6 shadow-sm">
                    <h3 className="text-sm font-bold text-[#191c1e] mb-1 flex items-center gap-2">
                      <ShieldCheck className="w-4 h-4 text-[#10b981]" />
                      Clinician Feedback
                    </h3>
                    <p className="text-xs text-[#74777f] mb-4">
                      Your feedback improves model accuracy in future federated training rounds.
                    </p>

                    {!feedbackSent ? (
                      <div className="flex flex-wrap gap-3">
                        {feedbackMode === 'overridden' ? (
                          <div className="w-full space-y-3 bg-orange-50 p-4 rounded-xl border border-orange-100">
                            <p className="text-xs font-bold text-orange-800">Why are you overriding this prediction?</p>
                            <textarea
                              className="w-full p-3 border border-orange-200 rounded-xl text-xs"
                              placeholder="e.g., Patient has strong family support structure..."
                              value={feedbackNote}
                              onChange={(e) => setFeedbackNote(e.target.value)}
                              rows={3}
                            />
                            <div className="flex gap-2">
                              <button
                                onClick={() => setFeedbackMode(null)}
                                className="px-4 py-2 text-xs text-orange-600 font-semibold hover:bg-orange-100 rounded-lg"
                              >
                                Cancel
                              </button>
                              <button
                                onClick={() => handleSendFeedback('overridden')}
                                className="px-4 py-2 text-xs bg-orange-500 text-white font-bold rounded-lg shadow-sm hover:bg-orange-600"
                              >
                                Submit Override
                              </button>
                            </div>
                          </div>
                        ) : (
                          <>
                            <button
                              onClick={() => handleSendFeedback('confirmed')}
                              className="flex items-center gap-2 px-4 py-2.5 text-xs font-bold bg-green-50 text-green-700 border border-green-200 rounded-xl hover:bg-green-100 transition-colors"
                            >
                              <CheckCircle2 className="w-4 h-4" />
                              Confirm — Prediction is Accurate
                            </button>
                            <button
                              onClick={() => setFeedbackMode('overridden')}
                              className="flex items-center gap-2 px-4 py-2.5 text-xs font-bold bg-orange-50 text-orange-700 border border-orange-200 rounded-xl hover:bg-orange-100 transition-colors"
                            >
                              <AlertTriangle className="w-4 h-4" />
                              Override — Disagree with Prediction
                            </button>
                          </>
                        )}
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 p-4 bg-green-50 rounded-xl border border-green-200 text-sm font-semibold text-green-700">
                        <CheckCircle2 className="w-5 h-5" />
                        Feedback submitted successfully. This will be used in the next federated training round.
                      </div>
                    )}
                  </div>
                </>
              ) : (
                <div className="py-12 text-center">
                  <BrainCircuit className="w-10 h-10 text-[#74777f] mx-auto mb-3" />
                  <p className="text-sm font-bold text-[#191c1e]">No Prediction Available</p>
                  <p className="text-xs text-[#74777f] mt-1">
                    This patient has not been scored by the readmission model yet.
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
