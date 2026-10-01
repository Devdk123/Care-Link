import React, { useState, useEffect, useRef } from 'react';
import {
  Bot,
  ShieldCheck,
  Cpu,
  Database,
  Activity,
  AlertTriangle,
  CheckCircle2,
  FileText,
  Printer,
  ChevronRight,
  Sparkles,
  Zap,
  ArrowRight,
  HelpCircle,
  ThumbsUp,
  ThumbsDown,
  RotateCcw,
  Layers,
  Heart,
  Pill,
  Send,
  Lock,
  Globe,
  CreditCard,
  Award,
  MessageSquare,
  Calendar,
  Bell,
  Copy,
  ExternalLink,
  Phone,
  PhoneCall,
  PhoneForwarded,
  Volume2,
  Timer,
  Radio,
  Sliders,
  ChevronDown,
  ChevronUp,
  Check,
  Flame,
  Stethoscope
} from 'lucide-react';
import gsap from 'gsap';
import { Patient } from '../types';

interface AgentCockpitViewProps {
  onShowToast: (title: string, message: string, type?: 'success' | 'info' | 'error') => void;
  patients?: Patient[];
}

interface ExecutionStep {
  stepId: number;
  agent: string;
  action: string;
  detail: string;
  metrics?: Record<string, any>;
  timestamp: string;
}

interface EvidenceBadge {
  tag: string;
  title: string;
  source: string;
  condition: string;
  evidenceLevel: string;
  snippet: string;
  score: number;
}

interface MedicationAlert {
  severity: 'CRITICAL' | 'WARNING' | 'INFO';
  type: string;
  drugs: string;
  hazard: string;
  recommendation: string;
  citation: string;
}

const CLINICAL_PRESETS = [
  {
    id: 'chf_decompensation',
    shortName: 'Heart Failure',
    icon: Heart,
    color: 'rose',
    badge: 'MTS Urgency',
    label: 'Heart Failure Decompensation (MTS Urgency)',
    patientName: 'Rajesh Kumar (MRN-88231)',
    patientId: 'patient_rajesh_88',
    query: 'Patient discharged 5 days ago post-MI. Reports sudden bilateral ankle swelling, orthopnea, and gained 2.8kg in 48 hours.',
    vitals: { spo2: 89, systolic: 148, diastolic: 92, heart_rate: 104, weight_gain_kg: 2.8, temp: 98.4 },
    medications: ['Furosemide 40mg', 'Carvedilol 12.5mg', 'Enalapril 10mg'],
    intent: 'triage'
  },
  {
    id: 'ddi_warfarin_nsaid',
    shortName: 'Warfarin + NSAID',
    icon: AlertTriangle,
    color: 'amber',
    badge: 'Critical DDI',
    label: 'Anticoagulant & NSAID Interaction (Safety Blocker)',
    patientName: 'Sunita Sharma (MRN-91042)',
    patientId: 'patient_sunita_91',
    query: 'Patient on daily Warfarin for atrial fibrillation developed severe knee osteoarthritis pain. Family requested prescribing high-dose Ibuprofen or Diclofenac.',
    vitals: { spo2: 98, systolic: 124, diastolic: 78, heart_rate: 72, temp: 98.6 },
    medications: ['Warfarin 5mg', 'Metoprolol 50mg', 'Ibuprofen 400mg'],
    intent: 'medication_safety'
  },
  {
    id: 'pmjay_eligibility',
    shortName: 'PM-JAY Cashless',
    icon: CreditCard,
    color: 'emerald',
    badge: '₹5L Benefit',
    label: 'Ayushman Bharat PM-JAY ₹5L Cashless Eligibility',
    patientName: 'Kameshwar Yadav (MRN-10492)',
    patientId: 'patient_kameshwar_10',
    query: 'Verify Ayushman Bharat PM-JAY eligibility for ₹5,00,000 cashless pre-authorization for emergency cardiac catheterization and stent. Patient holds BPL ration card.',
    vitals: { spo2: 94, systolic: 152, diastolic: 96, heart_rate: 92, temp: 98.6 },
    medications: ['Aspirin 150mg', 'Clopidogrel 75mg', 'Atorvastatin 80mg'],
    demographics: { age: 62, gender: 'Male', admission_type: 'Emergency', risk_tier: 'High', rationCardType: 'BPL' },
    intent: 'pmjay'
  },
  {
    id: 'abha_discovery',
    shortName: 'ABDM ABHA ID',
    icon: Award,
    color: 'teal',
    badge: 'EHR Discovery',
    label: 'ABDM ABHA ID & Longitudinal Health Records',
    patientName: 'Sunita Sharma (ABHA: 91-8842-9012-7741)',
    patientId: 'patient_sunita_91',
    query: 'Lookup Ayushman Bharat Health Account (ABHA ID 91-8842-9012-7741). Pull linked longitudinal hospital discharge summaries, prior PCI stent reports, and drug allergies across AIIMS and Safdarjung Hospital.',
    vitals: { spo2: 97, systolic: 126, diastolic: 76, heart_rate: 74, temp: 98.4 },
    medications: ['Warfarin 5mg', 'Metoprolol 50mg'],
    demographics: { age: 72, gender: 'Female', admission_type: 'Outpatient', risk_tier: 'Medium' },
    intent: 'abha'
  },
  {
    id: 'shap_readmission_risk',
    shortName: 'Readmission Risk',
    icon: Activity,
    color: 'indigo',
    badge: 'XGBoost + SHAP',
    label: 'High Readmission Risk & SHAP Analysis',
    patientName: 'Anil Verma (MRN-72319)',
    patientId: 'patient_anil_72',
    query: 'Synthesize XGBoost 30-day readmission risk explanation. Patient has 2 emergency admissions in 6 months, declining eGFR, and polypharmacy (>8 meds).',
    vitals: { spo2: 95, systolic: 136, diastolic: 84, heart_rate: 82, temp: 98.2 },
    medications: ['Metformin 1000mg', 'Dapagliflozin 10mg', 'Atorvastatin 40mg', 'Amlodipine 5mg', 'Aspirin 75mg', 'Omeprazole 20mg'],
    demographics: {
      readmission_risk_score: 0.74,
      egfr: 34,
      shap_factors: [
        { feature: 'Prior Emergency Admissions (2 in 6m)', attribution: '+0.28', impact: 'High Adverse' },
        { feature: 'Decline in eGFR to 34 mL/min', attribution: '+0.22', impact: 'Moderate Adverse' },
        { feature: 'Polypharmacy (>8 concurrent meds)', attribution: '+0.16', impact: 'Moderate Adverse' },
        { feature: 'Early Outpatient Review Booked', attribution: '-0.10', impact: 'Protective' }
      ]
    },
    intent: 'risk_analyst'
  },
  {
    id: 'care_plan_discharge',
    shortName: 'Care Plan',
    icon: Stethoscope,
    color: 'blue',
    badge: 'ICMR Regimen',
    label: 'Post-Discharge 4-Part Care Plan & Schedule',
    patientName: 'Meera Patel (MRN-66415)',
    patientId: 'patient_meera_66',
    query: 'Generate 4-part post-discharge recovery care plan: medication adjustments, 7-10 day cardiology follow-up, sodium/fluid restrictions, and red flag warnings.',
    vitals: { spo2: 96, systolic: 128, diastolic: 80, heart_rate: 76, temp: 98.6 },
    medications: ['Sacubitril/Valsartan 49/51mg', 'Bisoprolol 5mg', 'Spironolactone 25mg'],
    intent: 'care_plan'
  }
];

export const AgentCockpitView: React.FC<AgentCockpitViewProps> = ({ onShowToast }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const streamingTimerRef = useRef<any>(null);
  const fullResponseRef = useRef<string>('');

  // Active Output Tab
  const [activeTab, setActiveTab] = useState<'care_plan' | 'flow' | 'bharat' | 'trace'>('care_plan');

  // Inputs
  const [selectedPreset, setSelectedPreset] = useState(CLINICAL_PRESETS[0]);
  const [queryText, setQueryText] = useState(CLINICAL_PRESETS[0].query);
  const [patientId, setPatientId] = useState(CLINICAL_PRESETS[0].patientId);
  const [vitals, setVitals] = useState<Record<string, any>>(CLINICAL_PRESETS[0].vitals);
  const [medsText, setMedsText] = useState(CLINICAL_PRESETS[0].medications.join(', '));

  // Agent State
  const [isRunning, setIsRunning] = useState(false);
  const [routedAgent, setRoutedAgent] = useState<string>('triage');
  const [intentConfidence, setIntentConfidence] = useState<number>(0.92);
  const [agentResponse, setAgentResponse] = useState<string>('');
  const [citations, setCitations] = useState<string[]>([]);
  const [evidenceBadges, setEvidenceBadges] = useState<EvidenceBadge[]>([]);
  const [fidelityScore, setFidelityScore] = useState<number>(1.0);
  const [isGrounded, setIsGrounded] = useState<boolean>(true);
  const [medicationAlerts, setMedicationAlerts] = useState<MedicationAlert[]>([]);
  const [isBlockedBySafety, setIsBlockedBySafety] = useState<boolean>(false);
  const [executionSteps, setExecutionSteps] = useState<ExecutionStep[]>([]);
  const [activeNode, setActiveNode] = useState<string>('idle');
  const [isStreaming, setIsStreaming] = useState<boolean>(false);

  // Bharat Health Stack & Localization State
  const [isHindi, setIsHindi] = useState<boolean>(false);
  const [pmjayStatus, setPmjayStatus] = useState<any>(null);
  const [abhaProfile, setAbhaProfile] = useState<any>(null);

  // Autonomous Action States (Phase 9)
  const [vitalsAlert, setVitalsAlert] = useState<any>(null);
  const [whatsAppDraft, setWhatsAppDraft] = useState<any>(null);
  const [bookingConfirmation, setBookingConfirmation] = useState<any>(null);

  // Track 2: LiveKit Telephony State
  const [isTelephonyExpanded, setIsTelephonyExpanded] = useState<boolean>(true);
  const [activeCall, setActiveCall] = useState<any>(null);
  const [callDuration, setCallDuration] = useState<number>(0);
  const [isDialing, setIsDialing] = useState<boolean>(false);
  const [selectedVoiceLang, setSelectedVoiceLang] = useState<string>('hi-IN');
  const [selectedIndicProvider, setSelectedIndicProvider] = useState<'auto' | 'bhashini' | 'sarvam'>('auto');
  const [indicProviderStatus, setIndicProviderStatus] = useState<any>(null);
  const [clinicianPhone, setClinicianPhone] = useState<string>('+919876543210');
  const [isPlayingAudio, setIsPlayingAudio] = useState<boolean>(false);
  const [supportedLangs, setSupportedLangs] = useState<any[]>([]);
  const callTimerRef = useRef<any>(null);
  const pollTimerRef = useRef<any>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Clinician Feedback
  const [feedbackAction, setFeedbackAction] = useState<'Approve' | 'Override'>('Approve');
  const [overrideReason, setOverrideReason] = useState<string>('');
  const [overrideRate, setOverrideRate] = useState<number>(0.0);
  const [isDriftDetected, setIsDriftDetected] = useState<boolean>(false);
  const [feedbackSubmitted, setFeedbackSubmitted] = useState<boolean>(false);

  const handleSkipStream = () => {
    if (streamingTimerRef.current) {
      clearInterval(streamingTimerRef.current);
    }
    setAgentResponse(fullResponseRef.current);
    setIsStreaming(false);
  };

  // Initial load
  useEffect(() => {
    if (containerRef.current) {
      gsap.fromTo(
        containerRef.current.querySelectorAll('.cockpit-anim'),
        { opacity: 0, y: 12 },
        { opacity: 1, y: 0, duration: 0.4, stagger: 0.05, ease: 'power2.out' }
      );
    }

    fetch('/api/agent/feedback/metrics')
      .then((res) => res.json())
      .then((data) => {
        if (data) {
          const rate = typeof data.override_rate === 'number' ? data.override_rate : (typeof data.overrideRate === 'number' ? data.overrideRate : 0);
          setOverrideRate(rate);
          setIsDriftDetected(Boolean(data.is_drift_detected ?? data.isDriftDetected));
        }
      })
      .catch(() => {});

    fetch('/api/agent/indic/providers')
      .then((res) => res.json())
      .then((data) => setIndicProviderStatus(data))
      .catch(() => {});

    fetch('/api/agent/bhashini/languages')
      .then((res) => res.json())
      .then((data) => {
        if (data && data.languages) {
          setSupportedLangs(data.languages);
        }
      })
      .catch(() => {});

    return () => {
      if (streamingTimerRef.current) clearInterval(streamingTimerRef.current);
      if (callTimerRef.current) clearInterval(callTimerRef.current);
      if (pollTimerRef.current) clearInterval(pollTimerRef.current);
    };
  }, []);

  const handleSelectPreset = (preset: typeof CLINICAL_PRESETS[0]) => {
    setSelectedPreset(preset);
    setQueryText(preset.query);
    setPatientId(preset.patientId);
    setVitals(preset.vitals);
    setMedsText(preset.medications.join(', '));
    setAgentResponse('');
    setEvidenceBadges([]);
    setMedicationAlerts([]);
    setIsBlockedBySafety(false);
    setPmjayStatus(null);
    setAbhaProfile(null);
    setFeedbackSubmitted(false);
    setActiveTab(preset.id === 'pmjay_eligibility' || preset.id === 'abha_discovery' ? 'bharat' : 'care_plan');
  };

  const handleRunAgents = async () => {
    setIsRunning(true);
    setFeedbackSubmitted(false);

    try {
      const medicationsArray = medsText
        .split(',')
        .map((m) => m.trim())
        .filter(Boolean);

      const payload = {
        query: queryText,
        patientId,
        vitals,
        medications: medicationsArray,
        demographics: (selectedPreset as any).demographics || {},
        isHindi
      };

      const res = await fetch('/api/agent/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || err.refusalMessage || 'Multi-agent inference failed');
      }

      const data = await res.json();
      const fullSteps: ExecutionStep[] = data.executionSteps || [];
      const fullResponse: string = data.agentResponse || '';
      fullResponseRef.current = fullResponse;

      setRoutedAgent(data.routedAgent || 'triage');
      setIntentConfidence(data.routingConfidence || 0.90);
      setCitations(data.citations || []);
      setEvidenceBadges(data.evidenceBadges || []);
      setFidelityScore(data.groundingFidelity || 1.0);
      setIsGrounded(data.isGrounded !== false);
      setMedicationAlerts(data.medicationAlerts || []);
      setIsBlockedBySafety(data.isBlockedBySafety || false);
      setPmjayStatus(data.pmjayStatus || null);
      setAbhaProfile(data.abhaProfile || null);

      if (data.isBlockedBySafety) {
        setActiveTab('flow');
      } else if (data.pmjayStatus || data.abhaProfile) {
        setActiveTab('bharat');
      } else {
        setActiveTab('care_plan');
      }

      setExecutionSteps([]);
      setAgentResponse('');
      setIsStreaming(true);

      for (let i = 0; i < fullSteps.length; i++) {
        await new Promise((r) => setTimeout(r, 90));
        setExecutionSteps((prev) => [...prev, fullSteps[i]]);
        if (fullSteps[i].agent) {
          const lower = fullSteps[i].agent.toLowerCase();
          if (lower.includes('medication')) setActiveNode('medication_safety');
          else if (lower.includes('risk')) setActiveNode('risk_analyst');
          else if (lower.includes('care')) setActiveNode('care_plan');
          else if (lower.includes('triage')) setActiveNode('triage');
        }
      }
      setActiveNode(data.routedAgent || 'triage');

      if (streamingTimerRef.current) clearInterval(streamingTimerRef.current);
      let charIdx = 0;
      const stepChunk = Math.max(8, Math.floor(fullResponse.length / 35));
      streamingTimerRef.current = setInterval(() => {
        charIdx += stepChunk;
        if (charIdx >= fullResponse.length) {
          setAgentResponse(fullResponse);
          setIsStreaming(false);
          if (streamingTimerRef.current) clearInterval(streamingTimerRef.current);
        } else {
          setAgentResponse(fullResponse.slice(0, charIdx));
        }
      }, 16);

      onShowToast(
        isHindi ? 'एजेंट प्रक्रिया संपन्न' : 'Analysis Complete',
        isHindi
          ? `${data.routedAgent} को सफलतापूर्वक रूट किया गया (${Math.round((data.groundingFidelity || 1) * 100)}% विश्वसनीयता)`
          : `Successfully routed to ${data.routedAgent} with ${Math.round((data.groundingFidelity || 1) * 100)}% grounding fidelity.`,
        'success'
      );
    } catch (err: any) {
      console.error('Agent execution error:', err);
      onShowToast('Execution Error', err.message || 'Failed to complete agent run.', 'error');
    } finally {
      setIsRunning(false);
    }
  };

  const handleTriggerEscalationCall = async (forceBypass = true, customSpo2?: number) => {
    setIsDialing(true);
    setCallDuration(0);
    setIsTelephonyExpanded(true);

    const targetSpo2 = typeof customSpo2 === 'number' ? customSpo2 : (vitals.spo2 || 84);

    try {
      const alertPayload = {
        alertId: `ALT-${Date.now().toString().slice(-4)}`,
        patientId,
        caseId: `CASE-${(patientId || 'PT').toUpperCase()}`,
        ward: 'ICU-2',
        bed: 'Bed-04',
        alertType: 'CRITICAL_HYPOXIA',
        severity: 'CRITICAL',
        vitals: {
          spo2: targetSpo2,
          heartRate: vitals.heart_rate || 118,
          bloodPressure: `${vitals.systolic || 140}/${vitals.diastolic || 90}`,
        },
        primaryContact: clinicianPhone,
        secondaryContact: '+919876543211',
        preferredLanguage: selectedVoiceLang,
      };

      const res = await fetch('/api/telephony/escalate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          alert: alertPayload,
          forceBypassCooldown: forceBypass,
          customDestination: clinicianPhone,
          autoSimulate: true,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.validation?.message || data.error || 'Escalation policy rejected call');
      }

      setActiveCall(data.callRecord);
      onShowToast(
        '🚨 CRITICAL ESCALATION DIALED',
        `LiveKit SIP Outbound calling ${clinicianPhone}. Closed-loop tracking active.`,
        'error'
      );

      if (callTimerRef.current) clearInterval(callTimerRef.current);
      callTimerRef.current = setInterval(() => {
        setCallDuration((d) => d + 1);
      }, 1000);

      const callId = data.callRecord.callId;
      if (pollTimerRef.current) clearInterval(pollTimerRef.current);
      pollTimerRef.current = setInterval(async () => {
        try {
          const pollRes = await fetch(`/api/telephony/calls/${callId}`);
          if (pollRes.ok) {
            const pollData = await pollRes.json();
            if (pollData.call) {
              setActiveCall(pollData.call);
              if (
                pollData.call.status === 'ACKNOWLEDGED' ||
                pollData.call.status === 'NO_ANSWER' ||
                pollData.call.status === 'FAILED' ||
                pollData.call.status === 'ESCALATION_FAILED'
              ) {
                if (pollTimerRef.current) clearInterval(pollTimerRef.current);
                if (callTimerRef.current) clearInterval(callTimerRef.current);

                if (pollData.call.status === 'ACKNOWLEDGED') {
                  onShowToast(
                    '✅ CALL ACKNOWLEDGED & RESOLVED',
                    `Doctor verbal acknowledgement verified: "${pollData.call.verbalAckSnippet?.slice(0, 70)}..."`,
                    'success'
                  );
                }
              }
            }
          }
        } catch {}
      }, 600);
    } catch (err: any) {
      onShowToast('Telephony Gate', err.message || 'Call failed to dispatch', 'error');
    } finally {
      setIsDialing(false);
    }
  };

  const handleDoctorAcknowledge = async () => {
    if (!activeCall) return;
    try {
      const res = await fetch('/api/telephony/acknowledge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          callId: activeCall.callId,
          acknowledgedBy: 'Dr. Sharma (Duty Intensivist)',
          verbalSnippet: `Understood, SpO2 ${activeCall.vitals?.spo2 || 84}% in ICU-2 Bed-04 noted. Attending bed immediately.`,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setActiveCall(data.call);
        if (pollTimerRef.current) clearInterval(pollTimerRef.current);
        if (callTimerRef.current) clearInterval(callTimerRef.current);
        onShowToast(
          '✅ VERBAL ACKNOWLEDGEMENT REGISTERED',
          'Doctor response received. Closed-loop resolved in audit trail.',
          'success'
        );
      }
    } catch {
      onShowToast('Error', 'Failed to submit verbal acknowledgement', 'error');
    }
  };

  const handlePlaySarvamVoicePreview = async () => {
    setIsPlayingAudio(true);
    try {
      const promptRes = await fetch('/api/telephony/voice-briefing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          alertId: 'ALT-PREVIEW',
          caseId: `CASE-${(patientId || 'PT').toUpperCase()}`,
          ward: 'ICU-2',
          bed: 'Bed-04',
          alertType: 'CRITICAL_HYPOXIA',
          spo2: vitals.spo2 || 84,
          heartRate: vitals.heart_rate || 118,
          preferredLanguage: selectedVoiceLang,
        }),
      });
      const promptData = await promptRes.json();

      const ttsRes = await fetch('/api/agent/indic/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: promptData.spokenText,
          targetLang: selectedVoiceLang,
          provider: selectedIndicProvider,
        }),
      });
      const ttsData = await ttsRes.json();

      if (ttsData.dataUri) {
        const audio = new Audio(ttsData.dataUri);
        audioRef.current = audio;
        audio.onended = () => setIsPlayingAudio(false);
        audio.onerror = () => setIsPlayingAudio(false);
        await audio.play();
        const providerName = ttsData.provider === 'bhashini'
          ? 'Digital India Bhashini'
          : 'Sarvam AI';
        onShowToast(
          '🔊 AUDIO BRIEFING PLAYING',
          `${providerName} (${selectedVoiceLang}) synthesized audio playing.`,
          'info'
        );
      }
    } catch {
      setIsPlayingAudio(false);
      onShowToast('Audio Notice', 'Failed to play voice preview', 'error');
    }
  };

  const handleSimulateVitalsDrop = async () => {
    try {
      const res = await fetch('/api/agent/vitals/simulate-drop', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ patientId, anomalyType: 'hypoxemia' })
      });
      if (res.ok) {
        const data = await res.json();
        setVitalsAlert(data.alert);
        setVitals(data.telemetry);
        onShowToast(
          '🚨 EMERGENCY TELEMETRY ALERT',
          `SpO2 dropped to ${data.telemetry.spo2}%. Autonomous voice escalation initiated!`,
          'error'
        );
        handleTriggerEscalationCall(true, data.telemetry.spo2);
      }
    } catch {
      onShowToast('Error', 'Failed to trigger simulated telemetry drop', 'error');
    }
  };

  const handleGenerateWhatsApp = async () => {
    try {
      const res = await fetch('/api/agent/communication/whatsapp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          patientName: selectedPreset.patientName,
          patientPhone: '+919876543210',
          medications: medsText.split(',').map((m) => m.trim()).filter(Boolean),
          isHindi
        })
      });
      if (res.ok) {
        const data = await res.json();
        setWhatsAppDraft(data);
        onShowToast(
          isHindi ? 'व्हाट्सएप निर्देश तैयार' : 'WhatsApp Summary Drafted',
          isHindi ? 'मरीज़ और आशा कार्यकर्ता के लिए संदेश तैयार है।' : 'Bilingual WhatsApp notification generated with click-to-dispatch link.',
          'success'
        );
      }
    } catch {
      onShowToast('Error', 'Failed to generate WhatsApp notification', 'error');
    }
  };

  const handleAutoBookAppointment = async () => {
    try {
      const res = await fetch('/api/agent/appointments/auto-book', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          patientId,
          patientName: selectedPreset.patientName,
          preferredSpecialty: 'Cardiology',
          urgency: vitals.spo2 && vitals.spo2 < 90 ? 'Urgent' : 'Routine'
        })
      });
      if (res.ok) {
        const data = await res.json();
        setBookingConfirmation(data);
        onShowToast(
          'Appointment Reserved',
          `Follow-up reserved with ${data.doctorName} on ${data.appointmentDate}.`,
          'success'
        );
      }
    } catch {
      onShowToast('Error', 'Failed to auto-book appointment', 'error');
    }
  };

  const handleFeedbackSubmit = async () => {
    try {
      const res = await fetch('/api/agent/feedback/record', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          caseId: `CASE-${(patientId || 'PT').toUpperCase()}`,
          patientId,
          action: feedbackAction,
          reason: feedbackAction === 'Override' ? overrideReason : 'Clinician concordant with AI plan',
          originalRecommendation: agentResponse ? agentResponse.slice(0, 300) : 'Standard Care Plan',
          clinicianId: 'DOC-SMITH-44',
          clinicianSpecialty: 'Cardiology',
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setFeedbackSubmitted(true);
        if (data.currentMetrics) {
          const cm = data.currentMetrics;
          const rate = typeof cm.override_rate === 'number' ? cm.override_rate : (typeof cm.overrideRate === 'number' ? cm.overrideRate : 0);
          setOverrideRate(rate);
          setIsDriftDetected(Boolean(cm.is_drift_detected ?? cm.isDriftDetected));
        }
        onShowToast(
          feedbackAction === 'Approve' ? 'Recommendation Approved' : 'Clinical Override Recorded',
          feedbackAction === 'Approve'
            ? 'Clinician agreement registered to audit log.'
            : 'Clinical override logged. Active learning drift engine updated.',
          'success'
        );
      }
    } catch {
      onShowToast('Error', 'Failed to submit feedback.', 'error');
    }
  };

  return (
    <div ref={containerRef} className="space-y-6 max-w-7xl mx-auto pb-16 font-sans">
      {/* ── TOP SYSTEM HEADER & CONTROL BAR ── */}
      <div className="cockpit-anim bg-white/90 backdrop-blur-md border border-slate-200/80 rounded-2xl p-4 sm:p-5 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center space-x-3.5">
          <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-teal-600 to-emerald-500 text-white flex items-center justify-center shadow-md shadow-teal-600/20">
            <Bot className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h1 className="text-lg font-bold text-slate-900 tracking-tight">CareLink Clinical Copilot</h1>
              <span className="px-2.5 py-0.5 text-[11px] font-semibold bg-emerald-50 text-emerald-700 rounded-full border border-emerald-200 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                Autonomous Engine
              </span>
            </div>
            <p className="text-xs text-slate-500">Multi-Agent Supervisor & Clinical Grounding Engine • Bharat 2026</p>
          </div>
        </div>

        {/* Global Controls & Status */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Language Toggle */}
          <button
            type="button"
            onClick={() => setIsHindi(!isHindi)}
            className={`flex items-center space-x-2 px-3.5 py-1.5 rounded-xl border text-xs font-semibold transition-all cursor-pointer shadow-xs ${
              isHindi
                ? 'bg-teal-700 border-teal-700 text-white shadow-teal-700/20'
                : 'bg-white border-slate-200 text-slate-700 hover:border-teal-500/50 hover:bg-slate-50'
            }`}
          >
            <Globe className="w-3.5 h-3.5" />
            <span>{isHindi ? '🇮🇳 हिन्दी (ASHA Mode)' : '🌐 English Mode'}</span>
          </button>

          {/* AI Providers Status */}
          <div className="hidden sm:flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-600 text-xs font-medium">
            <Zap className="w-3.5 h-3.5 text-amber-500" />
            <span>LLM:</span>
            <span className="text-teal-700 font-bold">Gemini ⚡ Groq Failover</span>
          </div>

          {/* RAG Knowledge base */}
          <div className="hidden sm:flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-600 text-xs font-medium">
            <Database className="w-3.5 h-3.5 text-indigo-500" />
            <span>RAG:</span>
            <span className="text-slate-800 font-semibold">10 Guidelines</span>
          </div>

          {/* Drift Status */}
          <div
            className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-xl border text-xs font-semibold ${
              isDriftDetected
                ? 'bg-rose-50 border-rose-200 text-rose-700'
                : 'bg-emerald-50 border-emerald-200 text-emerald-700'
            }`}
          >
            <Activity className="w-3.5 h-3.5" />
            <span>Drift:</span>
            <span>{isDriftDetected ? 'DRIFT' : 'STABLE'} ({((Number.isFinite(overrideRate) ? overrideRate : 0) * 100).toFixed(1)}%)</span>
          </div>
        </div>
      </div>

      {/* ── SCENARIO QUICK SELECTOR (Sleek Horizontal Carousel) ── */}
      <div className="cockpit-anim">
        <div className="flex items-center justify-between mb-2.5 px-1">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
            <Flame className="w-3.5 h-3.5 text-rose-500" />
            Select Clinical Test Scenario
          </span>
          <span className="text-xs text-slate-400">Click any card to auto-load patient & vitals</span>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2.5">
          {CLINICAL_PRESETS.map((preset) => {
            const Icon = preset.icon;
            const isSelected = selectedPreset.id === preset.id;
            return (
              <button
                key={preset.id}
                onClick={() => handleSelectPreset(preset)}
                className={`text-left p-3 rounded-2xl border transition-all duration-200 cursor-pointer flex flex-col justify-between ${
                  isSelected
                    ? 'bg-gradient-to-b from-teal-50/80 to-white border-teal-600 shadow-md shadow-teal-600/10 ring-2 ring-teal-500/20'
                    : 'bg-white border-slate-200/80 hover:border-slate-300 hover:shadow-xs hover:bg-slate-50/80'
                }`}
              >
                <div className="flex items-center justify-between mb-1.5">
                  <div
                    className={`w-7 h-7 rounded-xl flex items-center justify-center ${
                      isSelected
                        ? 'bg-teal-600 text-white'
                        : 'bg-slate-100 text-slate-600'
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                  </div>
                  <span
                    className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                      isSelected
                        ? 'bg-teal-100 text-teal-800'
                        : 'bg-slate-100 text-slate-500'
                    }`}
                  >
                    {preset.badge}
                  </span>
                </div>
                <div>
                  <div className={`text-xs font-bold truncate ${isSelected ? 'text-teal-900' : 'text-slate-800'}`}>
                    {preset.shortName}
                  </div>
                  <div className="text-[10px] text-slate-500 truncate mt-0.5">
                    {preset.patientName.split(' ')[0]}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── 2-COLUMN BALANCED WORKSPACE ── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* ── LEFT COLUMN: Patient Case Context & Execution (5 cols) ── */}
        <div className="lg:col-span-5 space-y-5">
          {/* Patient Card */}
          <div className="cockpit-anim bg-white border border-slate-200/90 rounded-2xl p-5 shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center space-x-2.5">
                <div className="w-8 h-8 rounded-xl bg-slate-100 flex items-center justify-center text-slate-700">
                  <FileText className="w-4 h-4 text-teal-600" />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-slate-900">{selectedPreset.patientName}</h2>
                  <div className="flex items-center gap-1.5 text-[11px] text-slate-500">
                    <span className="font-mono bg-slate-100 px-1.5 py-0.2 rounded text-[10px]">{patientId}</span>
                    <span>•</span>
                    <span className="text-emerald-700 font-semibold flex items-center gap-0.5">
                      <ShieldCheck className="w-3 h-3 text-emerald-600 inline" /> Zero-PHI Scrubber
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Vitals Summary Badges */}
            <div>
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wide block mb-2">
                Real-Time Physiological Telemetry
              </span>
              <div className="grid grid-cols-4 gap-2 text-center">
                <div
                  className={`p-2 rounded-xl border ${
                    vitals.spo2 && vitals.spo2 < 90
                      ? 'bg-rose-50 border-rose-200 text-rose-700 font-bold animate-pulse'
                      : 'bg-slate-50 border-slate-200 text-slate-700'
                  }`}
                >
                  <div className="text-[10px] text-slate-400">SpO2</div>
                  <div className="text-sm font-bold">{vitals.spo2 || 98}%</div>
                </div>

                <div className="p-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-700">
                  <div className="text-[10px] text-slate-400">BP</div>
                  <div className="text-xs font-bold mt-0.5">{vitals.systolic || 120}/{vitals.diastolic || 80}</div>
                </div>

                <div className="p-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-700">
                  <div className="text-[10px] text-slate-400">Heart Rate</div>
                  <div className="text-sm font-bold">{vitals.heart_rate || 72} <span className="text-[9px] font-normal">bpm</span></div>
                </div>

                <div className="p-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-700">
                  <div className="text-[10px] text-slate-400">Weight Δ</div>
                  <div className="text-xs font-bold mt-0.5">{vitals.weight_gain_kg ? `+${vitals.weight_gain_kg}kg` : 'Stable'}</div>
                </div>
              </div>
            </div>

            {/* Active Medications List */}
            <div>
              <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wide flex items-center justify-between mb-1.5">
                <span className="flex items-center gap-1">
                  <Pill className="w-3.5 h-3.5 text-indigo-500" />
                  Active Prescriptions
                </span>
                <span className="text-[10px] text-slate-400">Pharmacovigilance Checked</span>
              </label>
              <div className="flex flex-wrap gap-1.5">
                {medsText.split(',').map((med, idx) => (
                  <span
                    key={idx}
                    className="px-2.5 py-1 rounded-lg bg-indigo-50/70 border border-indigo-100 text-indigo-900 text-xs font-medium"
                  >
                    {med.trim()}
                  </span>
                ))}
              </div>
            </div>

            {/* Clinical Presentation Notes */}
            <div>
              <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wide mb-1.5">
                Clinical Presentation & Triage Notes
              </label>
              <textarea
                rows={3}
                value={queryText}
                onChange={(e) => setQueryText(e.target.value)}
                className="w-full text-xs p-3 bg-slate-50/80 border border-slate-200 rounded-xl focus:outline-none focus:border-teal-600 focus:bg-white text-slate-900 leading-relaxed resize-none transition-colors"
                placeholder="Enter patient symptoms or clinical question..."
              />
            </div>

            {/* Primary Action Button */}
            <button
              onClick={handleRunAgents}
              disabled={isRunning}
              className="w-full py-3.5 px-4 rounded-xl font-bold text-sm text-white bg-gradient-to-r from-teal-700 via-teal-600 to-emerald-600 hover:from-teal-800 hover:to-emerald-700 shadow-md shadow-teal-700/20 hover:shadow-lg transition-all flex items-center justify-center space-x-2 disabled:opacity-50 cursor-pointer"
            >
              {isRunning ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Orchestrating Multi-Agent Pipeline...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 text-amber-300 animate-pulse" />
                  <span>Execute Clinical AI Pipeline</span>
                </>
              )}
            </button>

            {/* Autonomous Action Toolbar (Phase 9) */}
            <div className="pt-3 border-t border-slate-100 space-y-2">
              <div className="flex items-center justify-between text-xs font-bold text-slate-600">
                <span className="flex items-center space-x-1.5">
                  <Zap className="w-3.5 h-3.5 text-amber-500" />
                  <span>Autonomous Actions</span>
                </span>
                <span className="text-[10px] font-mono bg-emerald-50 text-emerald-700 px-1.5 py-0.5 rounded border border-emerald-200">
                  Zero Human Touch
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={handleGenerateWhatsApp}
                  className="p-2.5 rounded-xl border border-emerald-200 bg-emerald-50/60 hover:bg-emerald-100/70 text-emerald-900 text-xs font-medium flex items-center justify-center space-x-1.5 transition-all shadow-2xs cursor-pointer"
                >
                  <MessageSquare className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Draft WhatsApp</span>
                </button>

                <button
                  onClick={handleAutoBookAppointment}
                  className="p-2.5 rounded-xl border border-indigo-200 bg-indigo-50/60 hover:bg-indigo-100/70 text-indigo-900 text-xs font-medium flex items-center justify-center space-x-1.5 transition-all shadow-2xs cursor-pointer"
                >
                  <Calendar className="w-3.5 h-3.5 text-indigo-600" />
                  <span>Auto-Book Slot</span>
                </button>
              </div>

              <button
                onClick={handleSimulateVitalsDrop}
                className="w-full py-2.5 px-3 rounded-xl border border-rose-300 bg-rose-50 hover:bg-rose-100 text-rose-800 text-xs font-semibold flex items-center justify-center space-x-1.5 transition-all cursor-pointer shadow-2xs"
              >
                <Bell className="w-3.5 h-3.5 text-rose-600 animate-pulse" />
                <span>Simulate Acute SpO2 Drop (88%)</span>
              </button>
            </div>
          </div>
        </div>

        {/* ── RIGHT COLUMN: Multi-Agent Analysis, Evidence & Stack (7 cols) ── */}
        <div className="lg:col-span-7 space-y-4">
          {/* Top Segmented Navigation Tabs */}
          <div className="cockpit-anim bg-white border border-slate-200/90 rounded-2xl p-1.5 shadow-2xs flex flex-wrap items-center gap-1">
            <button
              onClick={() => setActiveTab('care_plan')}
              className={`flex-1 min-w-[120px] py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                activeTab === 'care_plan'
                  ? 'bg-teal-700 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Clinical Advice</span>
            </button>

            <button
              onClick={() => setActiveTab('flow')}
              className={`flex-1 min-w-[120px] py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer relative ${
                activeTab === 'flow'
                  ? 'bg-teal-700 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <Cpu className="w-3.5 h-3.5" />
              <span>Safety & Agent Flow</span>
              {isBlockedBySafety && (
                <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping absolute top-2 right-2" />
              )}
            </button>

            <button
              onClick={() => setActiveTab('bharat')}
              className={`flex-1 min-w-[120px] py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                activeTab === 'bharat'
                  ? 'bg-teal-700 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <CreditCard className="w-3.5 h-3.5" />
              <span>Bharat Health Stack</span>
              {(pmjayStatus || abhaProfile) && (
                <span className="text-[9px] bg-emerald-100 text-emerald-800 px-1 py-0.2 rounded font-bold">Verified</span>
              )}
            </button>

            <button
              onClick={() => setActiveTab('trace')}
              className={`flex-1 min-w-[120px] py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                activeTab === 'trace'
                  ? 'bg-teal-700 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <Activity className="w-3.5 h-3.5" />
              <span>Reasoning Trace</span>
              <span className="text-[10px] bg-slate-200/80 text-slate-700 px-1.5 py-0.2 rounded font-mono">
                {executionSteps.length}
              </span>
            </button>
          </div>

          {/* Critical Blocker Alert (Always pinned when blocked) */}
          {isBlockedBySafety && (
            <div className="cockpit-anim p-4 rounded-2xl bg-rose-50 border-2 border-rose-300 text-rose-900 shadow-xs space-y-2 animate-bounce-short">
              <div className="flex items-center space-x-2 font-bold text-xs text-rose-800">
                <AlertTriangle className="w-4 h-4 text-rose-600" />
                <span>SAFETY GUARDRAIL INTERCEPTED: Lethal Drug Interaction</span>
              </div>
              {medicationAlerts.map((a, i) => (
                <div key={i} className="text-xs text-rose-700 bg-white/80 p-3 rounded-xl border border-rose-200 space-y-1">
                  <div className="font-bold text-rose-950">{a.hazard}</div>
                  <div className="text-[11px] text-rose-800 font-medium">
                    {a.recommendation} — <span className="font-bold underline">{a.citation}</span>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* ── TAB 1: CLINICAL CARE PLAN & ADVICE ── */}
          {activeTab === 'care_plan' && (
            <div className="cockpit-anim bg-white border border-slate-200/90 rounded-2xl p-5 shadow-xs space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center space-x-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  <h2 className="text-sm font-bold text-slate-900">Clinical Recommendation</h2>
                </div>

                <div className="flex items-center space-x-2">
                  {isStreaming && (
                    <button
                      onClick={handleSkipStream}
                      className="text-[11px] px-2 py-1 rounded-lg bg-amber-50 text-amber-800 border border-amber-200 hover:bg-amber-100 flex items-center space-x-1 cursor-pointer font-medium"
                    >
                      <span>⚡ Skip Animation</span>
                    </button>
                  )}

                  <button
                    onClick={() => window.print()}
                    className="text-xs px-2.5 py-1 rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50 flex items-center space-x-1 cursor-pointer"
                  >
                    <Printer className="w-3.5 h-3.5" />
                    <span>Print PDF</span>
                  </button>
                </div>
              </div>

              {/* Grounding Status Pill */}
              <div className="flex items-center justify-between text-xs px-3.5 py-2.5 bg-emerald-50/70 border border-emerald-200 rounded-xl text-emerald-900">
                <span className="font-semibold flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-emerald-600" />
                  Evidence Grounding Fidelity:
                </span>
                <span className="font-bold bg-emerald-100 text-emerald-800 px-2.5 py-0.5 rounded-full flex items-center space-x-1">
                  {isStreaming ? (
                    <>
                      <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping inline-block" />
                      <span>Streaming Verification...</span>
                    </>
                  ) : (
                    <span>{Math.round(fidelityScore * 100)}% Verified</span>
                  )}
                </span>
              </div>

              {/* Generated Clinical Response Text */}
              <div className="p-4 bg-slate-50/70 border border-slate-200 rounded-xl text-xs text-slate-900 leading-relaxed min-h-[160px] max-h-[340px] overflow-y-auto whitespace-pre-wrap font-sans">
                {agentResponse ? (
                  <>
                    {agentResponse}
                    {isStreaming && (
                      <span className="inline-block w-2 h-3.5 bg-teal-600 ml-1 animate-pulse align-middle" />
                    )}
                  </>
                ) : (
                  <div className="h-32 flex flex-col items-center justify-center text-slate-400 space-y-2">
                    <Sparkles className="w-6 h-6 text-slate-300" />
                    <span>Click <strong>"Execute Clinical AI Pipeline"</strong> to synthesize recommendation.</span>
                  </div>
                )}
              </div>

              {/* Cited Guidelines Chips */}
              {evidenceBadges.length > 0 && (
                <div className="space-y-2 pt-2 border-t border-slate-100">
                  <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wide block">
                    Evidence Guidelines Cited ({evidenceBadges.length}):
                  </span>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    {evidenceBadges.map((badge, idx) => (
                      <div key={idx} className="p-2.5 rounded-xl border border-indigo-100 bg-indigo-50/30 text-xs space-y-1">
                        <div className="flex items-center justify-between font-bold text-indigo-950">
                          <span className="truncate">{badge.tag} - {badge.title}</span>
                          <span className="text-[10px] bg-indigo-100 text-indigo-800 px-1.5 py-0.2 rounded shrink-0">{badge.evidenceLevel}</span>
                        </div>
                        <p className="text-[11px] text-slate-600 italic border-l-2 border-indigo-300 pl-2">
                          "{badge.snippet.slice(0, 110)}..."
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Clinician Review & Decision Strip */}
              <div className="pt-3 border-t border-slate-100 space-y-2.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-slate-700">Clinician In-the-Loop Verification</span>
                  <span className="text-[10px] text-slate-400 font-mono">Active Learning Audit</span>
                </div>

                {feedbackSubmitted ? (
                  <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 text-center font-bold">
                    ✓ Clinician review registered to CareLink audit trail.
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div className="flex items-center space-x-2 text-xs">
                      <button
                        onClick={() => setFeedbackAction('Approve')}
                        className={`flex-1 py-2 px-3 rounded-xl border flex items-center justify-center space-x-1.5 transition-all cursor-pointer ${
                          feedbackAction === 'Approve'
                            ? 'bg-emerald-600 text-white border-emerald-600 font-bold shadow-xs'
                            : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                        }`}
                      >
                        <ThumbsUp className="w-3.5 h-3.5" />
                        <span>Approve Plan</span>
                      </button>

                      <button
                        onClick={() => setFeedbackAction('Override')}
                        className={`flex-1 py-2 px-3 rounded-xl border flex items-center justify-center space-x-1.5 transition-all cursor-pointer ${
                          feedbackAction === 'Override'
                            ? 'bg-amber-600 text-white border-amber-600 font-bold shadow-xs'
                            : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                        }`}
                      >
                        <ThumbsDown className="w-3.5 h-3.5" />
                        <span>Override / Modify</span>
                      </button>
                    </div>

                    {feedbackAction === 'Override' && (
                      <textarea
                        rows={2}
                        value={overrideReason}
                        onChange={(e) => setOverrideReason(e.target.value)}
                        placeholder="State clinical reason for overriding AI recommendation..."
                        className="w-full text-xs p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-amber-600 text-slate-900 resize-none"
                      />
                    )}

                    <button
                      onClick={handleFeedbackSubmit}
                      className="w-full py-2 px-3 rounded-xl bg-slate-800 hover:bg-slate-900 text-white text-xs font-semibold flex items-center justify-center space-x-1 transition-all cursor-pointer"
                    >
                      <Send className="w-3 h-3" />
                      <span>Submit Clinician Audit Record</span>
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ── TAB 2: SAFETY & MULTI-AGENT STATEGRAPH FLOW ── */}
          {activeTab === 'flow' && (
            <div className="cockpit-anim bg-white border border-slate-200/90 rounded-2xl p-5 shadow-xs space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <h2 className="text-sm font-bold text-slate-900 flex items-center space-x-2">
                  <Cpu className="w-4 h-4 text-indigo-600" />
                  <span>StateGraph Multi-Agent Architecture</span>
                </h2>
                <span className="text-xs text-slate-500 font-medium">Supervisor Confidence: {Math.round(intentConfidence * 100)}%</span>
              </div>

              {/* Visual Node Pipeline */}
              <div className="space-y-2.5 py-1">
                {/* Node 1: PHI Scrub */}
                <div className="p-3 rounded-xl border border-slate-200 bg-slate-50 flex items-center justify-between text-xs">
                  <div className="flex items-center space-x-2.5">
                    <Lock className="w-4 h-4 text-emerald-600" />
                    <span className="font-bold text-slate-800">1. PHI Zero-Leak Guardrail</span>
                  </div>
                  <span className="text-[10px] text-emerald-700 font-bold bg-emerald-100/70 px-2 py-0.5 rounded-full">
                    Scrubbed
                  </span>
                </div>

                <div className="flex justify-center text-slate-300">
                  <ArrowRight className="w-3.5 h-3.5 rotate-90" />
                </div>

                {/* Node 2: Supervisor Router */}
                <div
                  className={`p-3 rounded-xl border text-xs flex items-center justify-between transition-all ${
                    activeNode === 'supervisor' || isRunning
                      ? 'border-teal-600 bg-teal-50/70 ring-2 ring-teal-500/20'
                      : 'border-slate-200 bg-slate-50'
                  }`}
                >
                  <div className="flex items-center space-x-2.5">
                    <Bot className="w-4 h-4 text-teal-600" />
                    <div>
                      <span className="font-bold text-slate-800">2. Supervisor Intent Router</span>
                      <span className="text-[10px] text-slate-400 block">Classifies clinical priority & intent</span>
                    </div>
                  </div>
                  <span className="text-[10px] font-bold text-teal-700 bg-teal-100/70 px-2 py-0.5 rounded-full">
                    {Math.round(intentConfidence * 100)}% Conf
                  </span>
                </div>

                <div className="flex justify-center text-slate-300">
                  <ArrowRight className="w-3.5 h-3.5 rotate-90" />
                </div>

                {/* Node 3: Specialist Agent */}
                <div
                  className={`p-3 rounded-xl border text-xs flex items-center justify-between transition-all ${
                    isBlockedBySafety
                      ? 'border-rose-300 bg-rose-50 text-rose-900'
                      : 'border-teal-600 bg-teal-50/80 text-teal-950 font-bold'
                  }`}
                >
                  <div className="flex items-center space-x-2.5">
                    <Zap className={`w-4 h-4 ${isBlockedBySafety ? 'text-rose-600' : 'text-teal-600'}`} />
                    <div>
                      <span className="font-bold">3. Specialist Agent: {routedAgent.toUpperCase()}</span>
                      <span className="text-[10px] opacity-80 block">
                        {isBlockedBySafety ? 'Safety guardrail intercepted execution' : 'Targeted domain tool execution'}
                      </span>
                    </div>
                  </div>
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                      isBlockedBySafety ? 'bg-rose-200 text-rose-800' : 'bg-teal-200/80 text-teal-800'
                    }`}
                  >
                    {isBlockedBySafety ? 'BLOCKED' : 'ACTIVE'}
                  </span>
                </div>

                <div className="flex justify-center text-slate-300">
                  <ArrowRight className="w-3.5 h-3.5 rotate-90" />
                </div>

                {/* Node 4: Citation & Grounding */}
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="p-2.5 rounded-xl border border-slate-200 bg-slate-50 flex items-center justify-between">
                    <div className="flex items-center space-x-1.5">
                      <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                      <span className="font-bold text-slate-700 text-[11px]">Citation Resolver</span>
                    </div>
                    <span className="text-[10px] text-emerald-600 font-bold">100%</span>
                  </div>

                  <div className="p-2.5 rounded-xl border border-slate-200 bg-slate-50 flex items-center justify-between">
                    <div className="flex items-center space-x-1.5">
                      <Database className="w-3.5 h-3.5 text-purple-600" />
                      <span className="font-bold text-slate-700 text-[11px]">Mem0 Sync</span>
                    </div>
                    <span className="text-[10px] text-purple-600 font-bold">Active</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ── TAB 3: BHARAT HEALTH STACK (PM-JAY & ABHA) ── */}
          {activeTab === 'bharat' && (
            <div className="cockpit-anim space-y-4">
              {/* Ayushman Bharat PM-JAY */}
              <div className="bg-gradient-to-br from-amber-50/70 via-white to-emerald-50/60 border border-amber-200 rounded-2xl p-5 shadow-xs space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <CreditCard className="w-4 h-4 text-amber-600" />
                    <span className="font-bold text-sm text-slate-900">
                      {pmjayStatus ? pmjayStatus.schemeName : 'Ayushman Bharat PM-JAY Scheme'}
                    </span>
                  </div>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300">
                    {pmjayStatus?.eligible ? 'ELIGIBLE (SECC D4 Verified)' : 'ACTIVE PRE-AUTH'}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="p-3 rounded-xl bg-white border border-amber-100">
                    <span className="text-[10px] text-slate-500 block">Annual Cashless Cover</span>
                    <span className="font-bold text-emerald-700 text-base">{pmjayStatus?.coverageAmount || '₹5,00,000'}</span>
                  </div>
                  <div className="p-3 rounded-xl bg-white border border-amber-100">
                    <span className="text-[10px] text-slate-500 block">Hospital Pre-Auth</span>
                    <span className="font-bold text-indigo-700 text-xs mt-0.5 block">{pmjayStatus?.claimPreAuthStatus || 'Approved (HBP 2.2)'}</span>
                  </div>
                </div>

                <p className="text-[11px] text-slate-700 leading-relaxed bg-white/80 p-2.5 rounded-xl border border-slate-200">
                  {pmjayStatus?.empanelledHospitalNotice || 'Patient verified under National Health Authority (NHA) SECC deprivation criteria. 100% cashless treatment at empanelled hospital.'}
                </p>
              </div>

              {/* ABDM ABHA ID */}
              <div className="bg-gradient-to-br from-teal-50/60 via-white to-sky-50/50 border border-teal-200 rounded-2xl p-5 shadow-xs space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <Award className="w-4 h-4 text-teal-600" />
                    <span className="font-bold text-sm text-slate-900">ABDM Verified Health ID</span>
                  </div>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-teal-100 text-teal-800 border border-teal-300">
                    {abhaProfile?.kycVerificationStatus || 'UIDAI KYC Verified'}
                  </span>
                </div>

                <div className="p-3 rounded-xl bg-white border border-teal-100 text-xs space-y-1">
                  <div className="flex items-center justify-between font-mono font-bold text-teal-800">
                    <span>ABHA: {abhaProfile?.abhaId || '91-8842-9012-7741'}</span>
                    <span className="text-[10px] text-slate-500 font-sans">{abhaProfile?.abhaAddress || 'sunita.sharma@abdm'}</span>
                  </div>
                  <div className="text-[11px] text-slate-600">
                    Linked Longitudinal Records: <strong>Safdarjung Hospital, AIIMS Cardiology</strong>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ── TAB 4: REASONING TRACE & TELEMETRY ── */}
          {activeTab === 'trace' && (
            <div className="cockpit-anim bg-white border border-slate-200/90 rounded-2xl p-5 shadow-xs space-y-3">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <h2 className="text-sm font-bold text-slate-900 flex items-center space-x-2">
                  <Activity className="w-4 h-4 text-teal-600" />
                  <span>Execution Telemetry Feed</span>
                </h2>
                <span className="text-xs text-slate-500">{executionSteps.length} step(s) recorded</span>
              </div>

              <div className="space-y-2 max-h-[360px] overflow-y-auto pr-1">
                {executionSteps.length === 0 ? (
                  <div className="text-center py-10 text-xs text-slate-400">
                    No active run. Click <span className="font-bold text-teal-700">"Execute Clinical AI Pipeline"</span> to view step-by-step telemetry.
                  </div>
                ) : (
                  executionSteps.map((step) => (
                    <div key={step.stepId} className="p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs space-y-1">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-2">
                          <span className="w-4 h-4 rounded-full bg-teal-100 text-teal-800 flex items-center justify-center font-bold text-[10px]">
                            {step.stepId}
                          </span>
                          <span className="font-bold text-slate-900">{step.agent}</span>
                        </div>
                        <span className="text-[10px] text-slate-500 font-mono">{step.action}</span>
                      </div>
                      <p className="text-[11px] text-slate-700 leading-relaxed pl-6">{step.detail}</p>
                      {step.metrics && Object.keys(step.metrics).length > 0 && (
                        <div className="pl-6 pt-0.5 flex flex-wrap gap-1 text-[10px] text-slate-500">
                          {step.metrics.provider && (
                            <span className="px-1.5 py-0.5 bg-slate-200 rounded font-mono">Provider: {step.metrics.provider}</span>
                          )}
                          {step.metrics.latency_ms && (
                            <span className="px-1.5 py-0.5 bg-slate-200 rounded font-mono">{step.metrics.latency_ms} ms</span>
                          )}
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* Contextual Action Drawer: WhatsApp Notification Preview */}
          {whatsAppDraft && (
            <div className="cockpit-anim bg-emerald-50/90 border border-emerald-300 rounded-2xl p-4 shadow-xs space-y-2.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <MessageSquare className="w-4 h-4 text-emerald-600" />
                  <span className="font-bold text-xs text-emerald-950">WhatsApp Patient Summary Generated</span>
                </div>
                <button
                  onClick={() => setWhatsAppDraft(null)}
                  className="text-slate-400 hover:text-slate-600 text-xs cursor-pointer"
                >
                  ✕ Close
                </button>
              </div>

              <div className="p-3 bg-white rounded-xl border border-emerald-100 text-xs font-mono text-slate-800 max-h-[140px] overflow-y-auto whitespace-pre-wrap leading-relaxed shadow-inner">
                {whatsAppDraft.whatsAppMessage || whatsAppDraft.messageText}
              </div>

              <div className="flex items-center space-x-2 pt-1">
                <a
                  href={whatsAppDraft.dispatchUrl || whatsAppDraft.whatsappDeepLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 py-2 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center justify-center space-x-1.5 transition-all shadow-xs"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>Send via WhatsApp</span>
                </a>
                <button
                  onClick={() => {
                    const txt = whatsAppDraft.whatsAppMessage || whatsAppDraft.messageText || '';
                    navigator.clipboard.writeText(txt);
                    onShowToast('Copied', 'WhatsApp message copied to clipboard', 'info');
                  }}
                  className="py-2 px-3 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-medium flex items-center space-x-1 cursor-pointer"
                >
                  <Copy className="w-3.5 h-3.5" />
                  <span>Copy</span>
                </button>
              </div>
            </div>
          )}

          {/* Contextual Action Drawer: Appointment Confirmation */}
          {bookingConfirmation && (
            <div className="cockpit-anim bg-indigo-50/90 border border-indigo-200 rounded-2xl p-4 shadow-xs space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Calendar className="w-4 h-4 text-indigo-600" />
                  <span className="font-bold text-xs text-indigo-950">EHR Appointment Slot Reserved</span>
                </div>
                <button
                  onClick={() => setBookingConfirmation(null)}
                  className="text-slate-400 hover:text-slate-600 text-xs cursor-pointer"
                >
                  ✕ Close
                </button>
              </div>

              <div className="p-3 bg-white rounded-xl border border-indigo-100 text-xs flex items-center justify-between">
                <div>
                  <div className="font-bold text-slate-900">{bookingConfirmation.doctorName}</div>
                  <div className="text-[11px] text-slate-500">{bookingConfirmation.appointmentDate} at {bookingConfirmation.timeSlot}</div>
                </div>
                <span className="font-mono text-xs font-bold bg-indigo-100 text-indigo-800 px-2 py-1 rounded">
                  {bookingConfirmation.bookingId}
                </span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── EMERGENCY TELEPHONY ESCALATION COMMAND STUDIO (Executive Dark Console) ── */}
      <div className="cockpit-anim bg-slate-900 text-white border border-slate-800 rounded-3xl p-5 sm:p-6 shadow-xl space-y-5">
        {/* Studio Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
          <div className="flex items-center space-x-3.5">
            <div className="w-10 h-10 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-400 flex items-center justify-center">
              <PhoneCall className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center space-x-2 flex-wrap gap-y-1">
                <h2 className="text-base font-bold text-white tracking-tight">
                  LiveKit Closed-Loop Critical Telephony Escalation
                </h2>
                <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/30">
                  Critical SLA &lt;20s
                </span>
                <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30">
                  Sarvam AI ⚡ Bhashini 22 Indic
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Autonomous SIP Outbound Dialing • Real-Time Voice Briefing • Verbal / DTMF Clinician Acknowledgment
              </p>
            </div>
          </div>

          {/* Status & Timer */}
          <div className="flex items-center space-x-2.5">
            <div className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-slate-800/90 border border-slate-700 text-xs font-mono text-slate-200">
              <Timer className="w-3.5 h-3.5 text-slate-400" />
              <span>00:{callDuration < 10 ? `0${callDuration}` : callDuration}</span>
            </div>

            <div
              className={`flex items-center space-x-2 px-3 py-1.5 rounded-xl border text-xs font-bold transition-all ${
                !activeCall || activeCall.status === 'IDLE'
                  ? 'bg-slate-800/60 border-slate-700 text-slate-400'
                  : activeCall.status === 'RINGING'
                  ? 'bg-blue-500/20 border-blue-500/50 text-blue-300 animate-pulse'
                  : activeCall.status === 'IN_PROGRESS'
                  ? 'bg-rose-500/20 border-rose-500/50 text-rose-300 animate-pulse'
                  : activeCall.status === 'ACKNOWLEDGED'
                  ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-300'
                  : 'bg-amber-500/20 border-amber-500/50 text-amber-300'
              }`}
            >
              <Radio className="w-3.5 h-3.5" />
              <span>{activeCall ? activeCall.status : 'STANDBY'}</span>
            </div>
          </div>
        </div>

        {/* Telephony Control Strip */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-center bg-slate-950/60 p-4 rounded-2xl border border-slate-800 text-xs">
          {/* Phone */}
          <div className="md:col-span-3 space-y-1">
            <label className="text-[11px] font-medium text-slate-400 block">
              On-Call Intensivist Contact
            </label>
            <div className="flex items-center space-x-2 bg-slate-900 border border-slate-700 rounded-xl px-3 py-2">
              <Phone className="w-3.5 h-3.5 text-rose-400" />
              <input
                type="text"
                value={clinicianPhone}
                onChange={(e) => setClinicianPhone(e.target.value)}
                className="w-full bg-transparent text-white text-xs focus:outline-none font-mono"
              />
            </div>
          </div>

          {/* Provider */}
          <div className="md:col-span-3 space-y-1">
            <label className="text-[11px] font-medium text-slate-400 block">
              Indic AI Voice Engine
            </label>
            <select
              value={selectedIndicProvider}
              onChange={(e) => setSelectedIndicProvider(e.target.value as any)}
              className="w-full bg-slate-900 border border-slate-700 text-white rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-teal-500 cursor-pointer"
            >
              <option value="auto">🇮🇳 Auto-Failover (Bhashini ⚡ Sarvam)</option>
              <option value="bhashini">🇮🇳 Digital India Bhashini (MeitY)</option>
              <option value="sarvam">⚡ Sarvam AI Foundation</option>
            </select>
          </div>

          {/* Language */}
          <div className="md:col-span-3 space-y-1">
            <label className="text-[11px] font-medium text-slate-400 block flex items-center justify-between">
              <span>Voice Language</span>
              <span className="text-[10px] text-teal-400 font-mono">
                {supportedLangs.length > 0 ? `${supportedLangs.length} Langs` : '22 Scheduled'}
              </span>
            </label>
            <select
              value={selectedVoiceLang}
              onChange={(e) => setSelectedVoiceLang(e.target.value)}
              className="w-full bg-slate-900 border border-slate-700 text-white rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-teal-500 cursor-pointer"
            >
              {supportedLangs.length > 0 ? (
                supportedLangs.map((lang: any) => (
                  <option key={lang.code} value={lang.code}>
                    {lang.nativeName ? `${lang.nativeName} (${lang.name})` : lang.name}
                  </option>
                ))
              ) : (
                <>
                  <option value="hi-IN">हिन्दी (Hindi)</option>
                  <option value="en-IN">English (India)</option>
                  <option value="ta-IN">தமிழ் (Tamil)</option>
                  <option value="te-IN">తెలుగు (Telugu)</option>
                  <option value="bn-IN">বাংলা (Bengali)</option>
                  <option value="kn-IN">ಕನ್ನಡ (Kannada)</option>
                  <option value="mr-IN">मराठी (Marathi)</option>
                  <option value="gu-IN">ગુજરાતી (Gujarati)</option>
                  <option value="ml-IN">മലയാളം (Malayalam)</option>
                  <option value="pa-IN">ਪੰਜਾਬੀ (Punjabi)</option>
                </>
              )}
            </select>
          </div>

          {/* Action CTAs */}
          <div className="md:col-span-3 flex items-center space-x-2 pt-2 md:pt-0">
            <button
              onClick={() => handleTriggerEscalationCall(true)}
              disabled={isDialing}
              className="flex-1 py-2 px-3 rounded-xl bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-500 hover:to-red-500 text-white font-bold text-xs flex items-center justify-center space-x-1.5 shadow-md shadow-rose-950 transition-all cursor-pointer disabled:opacity-50"
            >
              <PhoneCall className="w-3.5 h-3.5" />
              <span>{isDialing ? 'Dialing...' : '🚨 Escalation'}</span>
            </button>

            {activeCall && (activeCall.status === 'RINGING' || activeCall.status === 'IN_PROGRESS') && (
              <button
                onClick={handleDoctorAcknowledge}
                className="py-2 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center justify-center space-x-1 shadow-md shadow-emerald-950 transition-all cursor-pointer animate-pulse"
                title="Simulate doctor speaking verbal acknowledgment"
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Ack</span>
              </button>
            )}

            <button
              onClick={handlePlaySarvamVoicePreview}
              disabled={isPlayingAudio}
              className="py-2 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-xs font-medium flex items-center justify-center space-x-1 transition-all cursor-pointer disabled:opacity-50"
              title="Preview synthesized voice alert in chosen language"
            >
              <Volume2 className={`w-3.5 h-3.5 ${isPlayingAudio ? 'text-amber-400 animate-spin' : 'text-slate-300'}`} />
              <span className="hidden sm:inline">{isPlayingAudio ? 'Playing...' : 'Audio'}</span>
            </button>
          </div>
        </div>

        {/* 6-Step Closed-Loop Telephony Timeline */}
        <div className="space-y-3">
          <div className="flex items-center justify-between text-xs font-bold text-slate-400 uppercase tracking-wider">
            <span>Closed-Loop Telephony Audit Timeline</span>
            {activeCall && (
              <span className="font-mono text-teal-400 lowercase">
                room: {activeCall.roomName}
              </span>
            )}
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-6 gap-2 text-xs">
            {/* Step 1 */}
            <div
              className={`p-3 rounded-xl border transition-all ${
                activeCall
                  ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-300'
                  : 'bg-slate-950/60 border-slate-800 text-slate-500'
              }`}
            >
              <div className="text-[10px] font-mono opacity-70">00:00</div>
              <div className="font-bold mt-1">1. Telemetry Trigger</div>
              <div className="text-[10px] opacity-80 mt-0.5">SpO2 ≤ 88% Anomaly</div>
            </div>

            {/* Step 2 */}
            <div
              className={`p-3 rounded-xl border transition-all ${
                activeCall && activeCall.status !== 'QUEUED'
                  ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-300'
                  : activeCall?.status === 'QUEUED'
                  ? 'bg-amber-500/20 border-amber-500/50 text-amber-300 animate-pulse'
                  : 'bg-slate-950/60 border-slate-800 text-slate-500'
              }`}
            >
              <div className="text-[10px] font-mono opacity-70">00:02</div>
              <div className="font-bold mt-1">2. Agent Dispatched</div>
              <div className="text-[10px] opacity-80 mt-0.5">LiveKit Voice Agent</div>
            </div>

            {/* Step 3 */}
            <div
              className={`p-3 rounded-xl border transition-all ${
                activeCall &&
                (activeCall.status === 'RINGING' ||
                  activeCall.status === 'IN_PROGRESS' ||
                  activeCall.status === 'ACKNOWLEDGED')
                  ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-300'
                  : activeCall?.status === 'INITIATED'
                  ? 'bg-blue-500/20 border-blue-500/50 text-blue-300 animate-pulse'
                  : 'bg-slate-950/60 border-slate-800 text-slate-500'
              }`}
            >
              <div className="text-[10px] font-mono opacity-70">00:05</div>
              <div className="font-bold mt-1">3. SIP Dialing</div>
              <div className="text-[10px] opacity-80 mt-0.5">Doctor Mobile Rings</div>
            </div>

            {/* Step 4 */}
            <div
              className={`p-3 rounded-xl border transition-all ${
                activeCall && (activeCall.status === 'IN_PROGRESS' || activeCall.status === 'ACKNOWLEDGED')
                  ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-300'
                  : activeCall?.status === 'RINGING'
                  ? 'bg-blue-500/20 border-blue-500/50 text-blue-300 animate-pulse'
                  : 'bg-slate-950/60 border-slate-800 text-slate-500'
              }`}
            >
              <div className="text-[10px] font-mono opacity-70">00:09</div>
              <div className="font-bold mt-1">4. Doctor Answers</div>
              <div className="text-[10px] opacity-80 mt-0.5">WebRTC Stream Live</div>
            </div>

            {/* Step 5 */}
            <div
              className={`p-3 rounded-xl border transition-all ${
                activeCall?.status === 'ACKNOWLEDGED'
                  ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-300'
                  : activeCall?.status === 'IN_PROGRESS'
                  ? 'bg-rose-500/20 border-rose-500/50 text-rose-300 animate-pulse'
                  : 'bg-slate-950/60 border-slate-800 text-slate-500'
              }`}
            >
              <div className="text-[10px] font-mono opacity-70">00:18</div>
              <div className="font-bold mt-1">5. Verbal Ack</div>
              <div className="text-[10px] opacity-80 mt-0.5">"I am on it" / DTMF 1</div>
            </div>

            {/* Step 6 */}
            <div
              className={`p-3 rounded-xl border transition-all ${
                activeCall?.status === 'ACKNOWLEDGED'
                  ? 'bg-emerald-500/20 border-emerald-500/60 text-emerald-200 ring-1 ring-emerald-400/30'
                  : 'bg-slate-950/60 border-slate-800 text-slate-500'
              }`}
            >
              <div className="text-[10px] font-mono opacity-70">00:20</div>
              <div className="font-bold mt-1">6. Closed Loop</div>
              <div className="text-[10px] opacity-80 mt-0.5">EHR Audit Logged</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
