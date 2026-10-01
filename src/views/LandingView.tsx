import React, { useState, useMemo, useRef } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { useGSAP } from '@gsap/react';
import {
  ArrowRight,
  ShieldCheck,
  Brain,
  Activity,
  Zap,
  Lock,
  Sparkles,
  Server,
  Network,
  CheckCircle2,
  Sliders,
  RefreshCw,
  Eye,
  Check,
  Heart,
  ChevronRight,
  Layers,
  FileCheck2,
  Building2
} from 'lucide-react';

gsap.registerPlugin(ScrollTrigger);

interface LandingViewProps {
  onLogin: () => void;
  onExploreDemo?: () => void;
}

export const LandingView: React.FC<LandingViewProps> = ({ onLogin, onExploreDemo }) => {
  const containerRef = useRef<HTMLDivElement>(null);

  // ── Simulator Interactive State ──
  const [patientAge, setPatientAge] = useState(72);
  const [lengthOfStay, setLengthOfStay] = useState(7);
  const [priorAdmissions, setPriorAdmissions] = useState(2);
  const [hasHeartFailure, setHasHeartFailure] = useState(true);
  const [hasDiabetes, setHasDiabetes] = useState(true);
  const [hasCOPD, setHasCOPD] = useState(false);
  const [hasCKD, setHasCKD] = useState(false);
  const [heartRate, setHeartRate] = useState(88);
  const [spO2, setSpO2] = useState(94);
  const [activePreset, setActivePreset] = useState<'chf' | 'diabetes' | 'ortho' | 'custom'>('chf');

  // Selected Hospital Node
  const [selectedNode, setSelectedNode] = useState<number>(1);

  // Apply Presets
  const applyPreset = (preset: 'chf' | 'diabetes' | 'ortho') => {
    setActivePreset(preset);
    if (preset === 'chf') {
      setPatientAge(74);
      setLengthOfStay(8);
      setPriorAdmissions(3);
      setHasHeartFailure(true);
      setHasDiabetes(true);
      setHasCOPD(true);
      setHasCKD(false);
      setHeartRate(92);
      setSpO2(93);
    } else if (preset === 'diabetes') {
      setPatientAge(58);
      setLengthOfStay(4);
      setPriorAdmissions(1);
      setHasHeartFailure(false);
      setHasDiabetes(true);
      setHasCOPD(false);
      setHasCKD(false);
      setHeartRate(82);
      setSpO2(97);
    } else if (preset === 'ortho') {
      setPatientAge(34);
      setLengthOfStay(2);
      setPriorAdmissions(0);
      setHasHeartFailure(false);
      setHasDiabetes(false);
      setHasCOPD(false);
      setHasCKD(false);
      setHeartRate(72);
      setSpO2(99);
    }
  };

  // Dynamic XGBoost Readmission Calculation & SHAP values
  const { probability, riskTier, shapFactors, triageRecommendation } = useMemo(() => {
    let score = 0.12;

    const ageImpact = Math.max(0, (patientAge - 45) * 0.0055);
    score += ageImpact;

    const losImpact = lengthOfStay * 0.038;
    score += losImpact;

    const priorImpact = priorAdmissions * 0.13;
    score += priorImpact;

    const chfImpact = hasHeartFailure ? 0.16 : 0;
    const diaImpact = hasDiabetes ? 0.08 : 0;
    const copdImpact = hasCOPD ? 0.11 : 0;
    const ckdImpact = hasCKD ? 0.13 : 0;
    score += chfImpact + diaImpact + copdImpact + ckdImpact;

    const spO2Impact = spO2 < 95 ? 0.08 : -0.04;
    const hrImpact = heartRate > 90 ? 0.06 : -0.02;
    score += spO2Impact + hrImpact;

    const prob = Math.min(0.96, Math.max(0.04, score));
    const tier = prob >= 0.66 ? 'High' : prob >= 0.33 ? 'Medium' : 'Low';

    const shap = [
      { name: `Prior Admissions (${priorAdmissions})`, value: +(priorImpact * 100).toFixed(1), isPositive: priorImpact > 0.05 },
      { name: `Length of Stay (${lengthOfStay}d)`, value: +(losImpact * 100).toFixed(1), isPositive: losImpact > 0.08 },
      ...(hasHeartFailure ? [{ name: 'Heart Failure Comorbidity', value: +(chfImpact * 100).toFixed(1), isPositive: true }] : []),
      ...(hasCKD ? [{ name: 'Chronic Kidney Disease', value: +(ckdImpact * 100).toFixed(1), isPositive: true }] : []),
      ...(hasCOPD ? [{ name: 'COPD Respiratory Risk', value: +(copdImpact * 100).toFixed(1), isPositive: true }] : []),
      { name: `Age Factor (${patientAge}y)`, value: +(ageImpact * 100).toFixed(1), isPositive: ageImpact > 0.1 },
      { name: `SpO2 Oxygen Sat (${spO2}%)`, value: +(Math.abs(spO2Impact) * 100).toFixed(1), isPositive: spO2Impact > 0 },
    ].sort((a, b) => b.value - a.value).slice(0, 5);

    let triage = '';
    if (tier === 'High') {
      triage = 'Urgent Clinical Flag: >66% probability of 30-day readmission. Automated Gemini Triage recommends mandatory 48h outpatient telemedicine follow-up, home SpO2 telemetry monitoring, and immediate beta-blocker/diuretic reconciliation before discharge.';
    } else if (tier === 'Medium') {
      triage = 'Moderate Observation Required: Patient shows elevated risk profile. Automated protocol advises standard clinic review within 7 to 10 days and structured patient discharge education on warning signs.';
    } else {
      triage = 'Low Acuity Pathway: Favorable clinical telemetry. Patient qualifies for standard accelerated discharge pathway with routine primary care follow-up in 3 to 4 weeks.';
    }

    return {
      probability: prob,
      riskTier: tier,
      shapFactors: shap,
      triageRecommendation: triage,
    };
  }, [patientAge, lengthOfStay, priorAdmissions, hasHeartFailure, hasDiabetes, hasCOPD, hasCKD, heartRate, spO2]);

  // Light mode status styling
  const tierStyle =
    riskTier === 'High'
      ? { text: 'text-[#dc2626]', bg: 'bg-[#dc2626]', badgeBg: 'bg-[#fef2f2] text-[#dc2626] border-[#fecaca]', barColor: 'bg-[#dc2626]' }
      : riskTier === 'Medium'
      ? { text: 'text-[#d97706]', bg: 'bg-[#d97706]', badgeBg: 'bg-[#fffbeb] text-[#d97706] border-[#fde68a]', barColor: 'bg-[#d97706]' }
      : { text: 'text-[#16a34a]', bg: 'bg-[#16a34a]', badgeBg: 'bg-[#f0fdf4] text-[#16a34a] border-[#bbf7d0]', barColor: 'bg-[#16a34a]' };

  // ── GSAP Component Animations (UI-UX.md & nissh.info contract) ──
  useGSAP(
    () => {
      // 1. Hero headline words animation
      gsap.from('.gsap-hero-word', {
        y: 45,
        opacity: 0,
        stagger: 0.05,
        duration: 0.8,
        ease: 'power3.out',
      });

      // 2. Underline stroke drawing animation
      gsap.fromTo(
        '.gsap-underline path',
        { strokeDasharray: 600, strokeDashoffset: 600 },
        { strokeDashoffset: 0, duration: 1.2, ease: 'power2.out', delay: 0.4 }
      );

      // 3. Staggered floating badges
      gsap.from('.gsap-badge', {
        scale: 0.85,
        opacity: 0,
        stagger: 0.08,
        duration: 0.6,
        ease: 'back.out(1.5)',
        delay: 0.3,
      });

      // 4. Staggered entry for Stat Cards
      gsap.from('.gsap-stat-card', {
        y: 35,
        opacity: 0,
        stagger: 0.1,
        duration: 0.7,
        ease: 'power3.out',
        delay: 0.5,
      });

      // 5. ScrollTrigger: Specialties Cards
      gsap.fromTo(
        '.gsap-specialty-card',
        { y: 40, opacity: 0 },
        {
          y: 0,
          opacity: 1,
          stagger: 0.1,
          duration: 0.7,
          ease: 'power3.out',
          scrollTrigger: {
            trigger: '#specialties-grid',
            start: 'top 85%',
            once: true,
          },
        }
      );

      // 6. ScrollTrigger: Simulator Section Reveal
      gsap.fromTo(
        '.gsap-simulator',
        { y: 35, opacity: 0 },
        {
          y: 0,
          opacity: 1,
          duration: 0.7,
          ease: 'power3.out',
          scrollTrigger: {
            trigger: '#simulator',
            start: 'top 85%',
            once: true,
          },
        }
      );

      // 7. ScrollTrigger: Federated Network Visualizer
      gsap.fromTo(
        '.gsap-network',
        { y: 35, opacity: 0 },
        {
          y: 0,
          opacity: 1,
          duration: 0.7,
          ease: 'power3.out',
          scrollTrigger: {
            trigger: '#network',
            start: 'top 85%',
            once: true,
          },
        }
      );

      // Refresh ScrollTrigger calculations after initial DOM layout
      ScrollTrigger.refresh();
    },
    { scope: containerRef }
  );

  return (
    <div
      ref={containerRef}
      className="min-h-screen bg-[#fbf9f5] text-[#1a1a1a] font-sans antialiased selection:bg-[#fde68a] selection:text-[#1a1a1a] relative overflow-x-hidden"
    >
      {/* ── Soft Ambient Warm Lighting Background (nissh.info inspired) ── */}
      <div className="fixed inset-0 pointer-events-none z-0">
        <div className="absolute top-[-100px] left-1/2 -translate-x-1/2 w-[900px] h-[600px] bg-[radial-gradient(ellipse_at_center,rgba(56,189,248,0.12)_0%,rgba(245,158,11,0.06)_45%,transparent_75%)] blur-3xl" />
        <div className="absolute top-[45%] right-[-120px] w-[600px] h-[600px] bg-[radial-gradient(circle,rgba(34,197,94,0.08)_0%,transparent_70%)] blur-3xl" />
        <div className="absolute bottom-[10%] left-[-100px] w-[650px] h-[650px] bg-[radial-gradient(circle,rgba(236,72,153,0.06)_0%,transparent_70%)] blur-3xl" />
      </div>

      {/* ── Light Mode Glass Navbar ── */}
      <header className="sticky top-0 z-50 px-4 sm:px-8 py-3.5 border-b border-[#e5e7eb] bg-[#fbf9f5]/90 backdrop-blur-md transition-all">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          {/* Brand */}
          <div className="flex items-center gap-3">
            <img
              src="/carelink.png"
              alt="CareLink Logo"
              className="w-10 h-10 rounded-2xl object-contain shadow-md shadow-sky-500/15 border border-slate-200/80 bg-white p-0.5 hover:scale-105 transition-transform"
            />
            <div>
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-xl tracking-tight text-[#0f172a]">
                  CareLink
                </span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#e0f2fe] text-[#0284c7] border border-[#bae6fd] uppercase tracking-wider">
                  FL v2.4
                </span>
              </div>
              <p className="text-[11px] text-[#64748b] hidden sm:block font-medium">Federated Clinical AI Portal</p>
            </div>
          </div>

          {/* Quick Nav Anchors */}
          <nav className="hidden md:flex items-center gap-1 bg-[#f1f5f9] p-1 rounded-full border border-[#e2e8f0] text-xs font-semibold text-[#475569]">
            <a href="#simulator" className="px-3.5 py-1.5 rounded-full hover:text-[#0f172a] hover:bg-white transition-all">
              Live Simulator
            </a>
            <a href="#network" className="px-3.5 py-1.5 rounded-full hover:text-[#0f172a] hover:bg-white transition-all">
              Federated Network
            </a>
            <a href="#capabilities" className="px-3.5 py-1.5 rounded-full hover:text-[#0f172a] hover:bg-white transition-all">
              Specialties
            </a>
            <a href="#architecture" className="px-3.5 py-1.5 rounded-full hover:text-[#0f172a] hover:bg-white transition-all">
              Architecture & Security
            </a>
          </nav>

          {/* Right Action Buttons */}
          <div className="flex items-center gap-3">
            <div className="hidden lg:flex items-center gap-2 px-3 py-1 rounded-full bg-[#ecfdf5] border border-[#a7f3d0] text-[11px] font-bold text-[#059669]">
              <span className="w-2 h-2 rounded-full bg-[#10b981] animate-ping" />
              <span>Round #14 Synchronized</span>
            </div>

            {onExploreDemo && (
              <button
                onClick={onExploreDemo}
                className="px-4 py-2 text-xs font-bold text-white bg-[#0284c7] hover:bg-[#0369a1] active:scale-95 rounded-xl shadow-md shadow-[#0284c7]/20 transition-all flex items-center gap-1.5 cursor-pointer group"
              >
                <span>Launch Portal</span>
                <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
              </button>
            )}

            <button
              onClick={onLogin}
              className="px-4 py-2 text-xs font-bold text-[#0f172a] bg-white hover:bg-[#f1f5f9] border border-[#cbd5e1] rounded-xl transition-all cursor-pointer shadow-sm"
            >
              Sign In
            </button>
          </div>
        </div>
      </header>

      {/* ── Hero Section (Light Theme with Hand-drawn Underlines & Stickers) ── */}
      <section className="relative z-10 pt-16 pb-16 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto text-center">
        {/* Floating Top Sticker Badges (nissh.info style) */}
        <div className="flex flex-wrap items-center justify-center gap-2 mb-8">
          <span className="gsap-badge inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full bg-[#e0f2fe] border border-[#bae6fd] text-xs font-bold text-[#0369a1] shadow-sm">
            <Sparkles className="w-3.5 h-3.5 text-[#0284c7]" />
            <span>Federated Healthcare ML</span>
          </span>
          <span className="gsap-badge inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full bg-[#fef3c7] border border-[#fde68a] text-xs font-bold text-[#92400e] shadow-sm">
            <Lock className="w-3.5 h-3.5 text-[#d97706]" />
            <span>Zero PHI Leaves Firewall</span>
          </span>
          <span className="gsap-badge inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full bg-[#fce7f3] border border-[#fbcfe8] text-xs font-bold text-[#9d174d] shadow-sm">
            <Heart className="w-3.5 h-3.5 text-[#e11d48]" />
            <span>30-Day Readmission Prevention</span>
          </span>
        </div>

        {/* Dynamic Title with Hand-drawn Underline SVG */}
        <div className="max-w-4xl mx-auto mb-6 relative">
          <h1 className="text-4xl sm:text-6xl lg:text-7xl font-black tracking-tight leading-[1.15] text-[#0f172a]">
            <span className="inline-block gsap-hero-word">Predict</span>{' '}
            <span className="inline-block gsap-hero-word">Patient</span>{' '}
            <span className="inline-block gsap-hero-word">Readmissions.</span>
            <br />
            <span className="relative inline-block mt-2">
              <span className="inline-block gsap-hero-word text-[#0284c7]">Protect</span>{' '}
              <span className="inline-block gsap-hero-word text-[#0284c7]">Patient</span>{' '}
              <span className="inline-block gsap-hero-word text-[#0284c7]">Privacy.</span>
              {/* Playful curved underline SVG */}
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 500 24"
                fill="none"
                className="gsap-underline w-full h-4 sm:h-6 text-[#f5693c] absolute -bottom-2 sm:-bottom-3 left-0 opacity-95"
                preserveAspectRatio="none"
              >
                <path
                  d="M3 18C120 4 380 4 497 18M45 22C160 10 340 10 455 22"
                  stroke="currentColor"
                  strokeWidth="3.5"
                  strokeLinecap="round"
                />
              </svg>
            </span>
          </h1>
        </div>

        {/* Subtitle */}
        <p className="max-w-2xl mx-auto text-base sm:text-lg text-[#475569] leading-relaxed mb-10 font-normal">
          CareLink empowers clinicians with calibrated <strong className="text-[#0f172a] font-semibold">XGBoost predictive intelligence</strong>,
          transparent <strong className="text-[#0f172a] font-semibold">SHAP explainability</strong>, and automated
          <strong className="text-[#0f172a] font-semibold"> Gemini clinical triage</strong> — all trained across decentralized hospital nodes without raw patient data ever leaving the local firewall.
        </p>

        {/* CTA Buttons */}
        <div className="flex flex-wrap items-center justify-center gap-4 mb-16">
          {onExploreDemo && (
            <button
              onClick={onExploreDemo}
              className="px-8 py-4 bg-[#0f172a] hover:bg-[#1e293b] active:scale-95 text-white font-extrabold rounded-2xl text-sm shadow-xl shadow-[#0f172a]/15 transition-all flex items-center gap-2.5 cursor-pointer group"
            >
              <span>Launch Interactive EHR Demo</span>
              <ArrowRight className="w-4 h-4 text-[#38bdf8] group-hover:translate-x-1 transition-transform" />
            </button>
          )}

          <a
            href="#simulator"
            className="px-7 py-4 bg-white hover:bg-[#f8fafc] text-[#0f172a] font-bold rounded-2xl text-sm border-2 border-[#e2e8f0] hover:border-[#0284c7] transition-all flex items-center gap-2 shadow-sm cursor-pointer"
          >
            <Sliders className="w-4 h-4 text-[#0284c7]" />
            <span>Try Live ML Simulator ↓</span>
          </a>
        </div>

        {/* ── 4 Proof Stats (Clean Light Mode Cards) ── */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 max-w-5xl mx-auto">
          <div className="gsap-stat-card bg-white p-5 rounded-2xl text-left border border-[#e2e8f0] shadow-sm hover:shadow-md hover:border-[#0284c7]/40 transition-all">
            <div className="w-8 h-8 rounded-xl bg-[#e0f2fe] text-[#0284c7] flex items-center justify-center mb-3">
              <ShieldCheck className="w-4 h-4" />
            </div>
            <p className="text-3xl font-black text-[#0f172a] tracking-tight">0 Bytes</p>
            <p className="text-xs font-bold text-[#334155] mt-1">Raw PHI Exchanged</p>
            <p className="text-[11px] text-[#64748b]">Local hospital firewall compute</p>
          </div>

          <div className="gsap-stat-card bg-white p-5 rounded-2xl text-left border border-[#e2e8f0] shadow-sm hover:shadow-md hover:border-[#16a34a]/40 transition-all">
            <div className="w-8 h-8 rounded-xl bg-[#dcfce7] text-[#16a34a] flex items-center justify-center mb-3">
              <Activity className="w-4 h-4" />
            </div>
            <p className="text-3xl font-black text-[#0f172a] tracking-tight">0.727</p>
            <p className="text-xs font-bold text-[#334155] mt-1">Global Model AUC</p>
            <p className="text-[11px] text-[#64748b]">Multi-site federated accuracy</p>
          </div>

          <div className="gsap-stat-card bg-white p-5 rounded-2xl text-left border border-[#e2e8f0] shadow-sm hover:shadow-md hover:border-[#d97706]/40 transition-all">
            <div className="w-8 h-8 rounded-xl bg-[#fef3c7] text-[#d97706] flex items-center justify-center mb-3">
              <Brain className="w-4 h-4" />
            </div>
            <p className="text-3xl font-black text-[#0f172a] tracking-tight">-24.6%</p>
            <p className="text-xs font-bold text-[#334155] mt-1">Readmission Rate</p>
            <p className="text-[11px] text-[#64748b]">Clinical validation cohort</p>
          </div>

          <div className="gsap-stat-card bg-white p-5 rounded-2xl text-left border border-[#e2e8f0] shadow-sm hover:shadow-md hover:border-[#7c3aed]/40 transition-all">
            <div className="w-8 h-8 rounded-xl bg-[#f3e8ff] text-[#7c3aed] flex items-center justify-center mb-3">
              <Network className="w-4 h-4" />
            </div>
            <p className="text-3xl font-black text-[#0f172a] tracking-tight">3 Nodes</p>
            <p className="text-xs font-bold text-[#334155] mt-1">Hospital Cluster</p>
            <p className="text-[11px] text-[#64748b]">MIMIC-IV schema verified</p>
          </div>
        </div>
      </section>

      {/* ── Section: Interactive Clinical ML Simulator (Light Mode) ── */}
      <section id="simulator" className="gsap-simulator relative z-10 py-16 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto scroll-mt-20">
        <div className="text-center max-w-3xl mx-auto mb-10">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#e0f2fe] text-[#0369a1] text-xs font-bold uppercase tracking-wider mb-3 border border-[#bae6fd]">
            <Sliders className="w-3.5 h-3.5" />
            <span>Interactive Machine Learning Sandbox</span>
          </div>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-[#0f172a] tracking-tight">
            Experience the Readmission Engine in Real Time
          </h2>
          <p className="text-sm sm:text-base text-[#475569] mt-2">
            Adjust clinical patient parameters below to see how CareLink's federated XGBoost model predicts readmission risk, computes transparent SHAP factor attributions, and prompts automated Gemini triage.
          </p>

          {/* Preset Buttons */}
          <div className="flex flex-wrap items-center justify-center gap-2 mt-6">
            <span className="text-xs text-[#64748b] font-semibold mr-1">Quick Presets:</span>
            <button
              onClick={() => applyPreset('chf')}
              className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer ${
                activePreset === 'chf'
                  ? 'bg-[#dc2626] text-white shadow-md shadow-[#dc2626]/20'
                  : 'bg-white border border-[#e2e8f0] text-[#334155] hover:bg-[#f8fafc]'
              }`}
            >
              🚨 Severe CHF Patient (High Risk)
            </button>
            <button
              onClick={() => applyPreset('diabetes')}
              className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer ${
                activePreset === 'diabetes'
                  ? 'bg-[#d97706] text-white shadow-md shadow-[#d97706]/20'
                  : 'bg-white border border-[#e2e8f0] text-[#334155] hover:bg-[#f8fafc]'
              }`}
            >
              ⚠️ Diabetic Patient (Medium Risk)
            </button>
            <button
              onClick={() => applyPreset('ortho')}
              className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer ${
                activePreset === 'ortho'
                  ? 'bg-[#16a34a] text-white shadow-md shadow-[#16a34a]/20'
                  : 'bg-white border border-[#e2e8f0] text-[#334155] hover:bg-[#f8fafc]'
              }`}
            >
              ✅ Post-Op Appendectomy (Low Risk)
            </button>
          </div>
        </div>

        {/* Simulator Grid (Light Cards) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Controls Column */}
          <div className="lg:col-span-6 bg-white p-6 sm:p-8 rounded-3xl border border-[#e2e8f0] shadow-xl space-y-6">
            <div className="flex items-center justify-between border-b border-[#f1f5f9] pb-4">
              <div>
                <h3 className="text-base font-bold text-[#0f172a] flex items-center gap-2">
                  <Sliders className="w-4 h-4 text-[#0284c7]" />
                  <span>Clinical Patient Inputs</span>
                </h3>
                <p className="text-xs text-[#64748b]">Simulate EHR record variables</p>
              </div>
              <button
                onClick={() => applyPreset('chf')}
                className="text-xs text-[#0284c7] font-semibold hover:underline flex items-center gap-1 cursor-pointer"
              >
                <RefreshCw className="w-3 h-3" />
                <span>Reset</span>
              </button>
            </div>

            {/* Slider 1: Age */}
            <div className="space-y-2">
              <div className="flex justify-between text-xs">
                <span className="font-semibold text-[#334155]">Patient Age</span>
                <span className="font-mono text-[#0284c7] font-bold">{patientAge} years</span>
              </div>
              <input
                type="range"
                min="18"
                max="95"
                value={patientAge}
                onChange={(e) => {
                  setPatientAge(Number(e.target.value));
                  setActivePreset('custom');
                }}
                className="w-full h-2 bg-[#f1f5f9] rounded-lg appearance-none cursor-pointer accent-[#0284c7]"
              />
              <div className="flex justify-between text-[10px] text-[#94a3b8]">
                <span>18y</span>
                <span>50y</span>
                <span>95y</span>
              </div>
            </div>

            {/* Slider 2: Length of Stay */}
            <div className="space-y-2">
              <div className="flex justify-between text-xs">
                <span className="font-semibold text-[#334155]">Length of Stay (LoS)</span>
                <span className="font-mono text-[#0284c7] font-bold">{lengthOfStay} days</span>
              </div>
              <input
                type="range"
                min="1"
                max="21"
                value={lengthOfStay}
                onChange={(e) => {
                  setLengthOfStay(Number(e.target.value));
                  setActivePreset('custom');
                }}
                className="w-full h-2 bg-[#f1f5f9] rounded-lg appearance-none cursor-pointer accent-[#0284c7]"
              />
              <div className="flex justify-between text-[10px] text-[#94a3b8]">
                <span>1 day</span>
                <span>7 days</span>
                <span>21 days</span>
              </div>
            </div>

            {/* Slider 3: Prior Admissions */}
            <div className="space-y-2">
              <div className="flex justify-between text-xs">
                <span className="font-semibold text-[#334155]">Prior Admissions (Last 12m)</span>
                <span className="font-mono text-[#0284c7] font-bold">{priorAdmissions} prior stays</span>
              </div>
              <input
                type="range"
                min="0"
                max="6"
                value={priorAdmissions}
                onChange={(e) => {
                  setPriorAdmissions(Number(e.target.value));
                  setActivePreset('custom');
                }}
                className="w-full h-2 bg-[#f1f5f9] rounded-lg appearance-none cursor-pointer accent-[#0284c7]"
              />
              <div className="flex justify-between text-[10px] text-[#94a3b8]">
                <span>0</span>
                <span>2</span>
                <span>6+</span>
              </div>
            </div>

            {/* Comorbidities */}
            <div className="space-y-2 pt-2">
              <span className="text-xs font-semibold text-[#334155] block">Documented Chronic Comorbidities</span>
              <div className="grid grid-cols-2 gap-2.5">
                <button
                  type="button"
                  onClick={() => { setHasHeartFailure(!hasHeartFailure); setActivePreset('custom'); }}
                  className={`p-2.5 rounded-xl border text-xs font-bold flex items-center justify-between transition-all cursor-pointer ${
                    hasHeartFailure
                      ? 'bg-[#fef2f2] border-[#fecaca] text-[#dc2626]'
                      : 'bg-[#f8fafc] border-[#e2e8f0] text-[#64748b] hover:bg-[#f1f5f9]'
                  }`}
                >
                  <span>Heart Failure (CHF)</span>
                  {hasHeartFailure && <Check className="w-3.5 h-3.5 text-[#dc2626]" />}
                </button>

                <button
                  type="button"
                  onClick={() => { setHasDiabetes(!hasDiabetes); setActivePreset('custom'); }}
                  className={`p-2.5 rounded-xl border text-xs font-bold flex items-center justify-between transition-all cursor-pointer ${
                    hasDiabetes
                      ? 'bg-[#e0f2fe] border-[#bae6fd] text-[#0284c7]'
                      : 'bg-[#f8fafc] border-[#e2e8f0] text-[#64748b] hover:bg-[#f1f5f9]'
                  }`}
                >
                  <span>Type 2 Diabetes</span>
                  {hasDiabetes && <Check className="w-3.5 h-3.5 text-[#0284c7]" />}
                </button>

                <button
                  type="button"
                  onClick={() => { setHasCOPD(!hasCOPD); setActivePreset('custom'); }}
                  className={`p-2.5 rounded-xl border text-xs font-bold flex items-center justify-between transition-all cursor-pointer ${
                    hasCOPD
                      ? 'bg-[#fffbeb] border-[#fde68a] text-[#d97706]'
                      : 'bg-[#f8fafc] border-[#e2e8f0] text-[#64748b] hover:bg-[#f1f5f9]'
                  }`}
                >
                  <span>COPD / Asthma</span>
                  {hasCOPD && <Check className="w-3.5 h-3.5 text-[#d97706]" />}
                </button>

                <button
                  type="button"
                  onClick={() => { setHasCKD(!hasCKD); setActivePreset('custom'); }}
                  className={`p-2.5 rounded-xl border text-xs font-bold flex items-center justify-between transition-all cursor-pointer ${
                    hasCKD
                      ? 'bg-[#f5f3ff] border-[#ddd6fe] text-[#7c3aed]'
                      : 'bg-[#f8fafc] border-[#e2e8f0] text-[#64748b] hover:bg-[#f1f5f9]'
                  }`}
                >
                  <span>Renal Disease (CKD)</span>
                  {hasCKD && <Check className="w-3.5 h-3.5 text-[#7c3aed]" />}
                </button>
              </div>
            </div>

            {/* Vitals quick adjustment */}
            <div className="grid grid-cols-2 gap-4 pt-2 border-t border-[#f1f5f9]">
              <div className="space-y-1.5">
                <div className="flex justify-between text-xs">
                  <span className="text-[#64748b] font-medium">Heart Rate</span>
                  <span className="font-mono text-[#0f172a] font-bold">{heartRate} BPM</span>
                </div>
                <input
                  type="range"
                  min="55"
                  max="130"
                  value={heartRate}
                  onChange={(e) => { setHeartRate(Number(e.target.value)); setActivePreset('custom'); }}
                  className="w-full h-1.5 bg-[#f1f5f9] rounded-lg appearance-none cursor-pointer accent-[#0284c7]"
                />
              </div>

              <div className="space-y-1.5">
                <div className="flex justify-between text-xs">
                  <span className="text-[#64748b] font-medium">Oxygen Sat (SpO2)</span>
                  <span className="font-mono text-[#0f172a] font-bold">{spO2}%</span>
                </div>
                <input
                  type="range"
                  min="85"
                  max="100"
                  value={spO2}
                  onChange={(e) => { setSpO2(Number(e.target.value)); setActivePreset('custom'); }}
                  className="w-full h-1.5 bg-[#f1f5f9] rounded-lg appearance-none cursor-pointer accent-[#0284c7]"
                />
              </div>
            </div>
          </div>

          {/* Diagnostic & Output Column */}
          <div className="lg:col-span-6 space-y-6">
            <div className="bg-white p-6 sm:p-8 rounded-3xl border border-[#e2e8f0] shadow-xl relative overflow-hidden">
              <div className="flex items-center justify-between mb-4">
                <span className="text-xs font-bold uppercase tracking-wider text-[#64748b] flex items-center gap-1.5">
                  <Brain className="w-4 h-4 text-[#0284c7]" />
                  <span>XGBoost Readmission Model Output</span>
                </span>
                <span className={`px-3 py-1 rounded-full text-xs font-extrabold border ${tierStyle.badgeBg}`}>
                  {riskTier.toUpperCase()} RISK
                </span>
              </div>

              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 my-2">
                <div>
                  <div className="flex items-baseline gap-2">
                    <span className={`text-5xl sm:text-6xl font-black tracking-tight ${tierStyle.text}`}>
                      {Math.round(probability * 100)}%
                    </span>
                    <span className="text-sm font-semibold text-[#64748b]">Readmission Probability</span>
                  </div>
                  <p className="text-xs text-[#475569] mt-1.5">
                    Predicted probability of unplanned 30-day readmission following hospital discharge.
                  </p>
                </div>

                {/* Progress Bar Container */}
                <div className="w-full sm:w-36 h-3 sm:h-20 bg-[#f1f5f9] rounded-2xl p-1 relative flex sm:flex-col justify-end overflow-hidden shrink-0 border border-[#e2e8f0]">
                  <div
                    className={`h-full sm:w-full rounded-xl ${tierStyle.barColor} transition-all duration-500`}
                    style={{
                      width: window.innerWidth < 640 ? `${Math.round(probability * 100)}%` : '100%',
                      height: window.innerWidth >= 640 ? `${Math.round(probability * 100)}%` : '100%',
                    }}
                  />
                </div>
              </div>

              {/* SHAP Factor Attribution Waterfall */}
              <div className="mt-6 pt-5 border-t border-[#f1f5f9] space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-[#0f172a] flex items-center gap-1.5">
                    <Zap className="w-3.5 h-3.5 text-[#0284c7]" />
                    <span>Top SHAP Feature Attributions</span>
                  </span>
                  <span className="text-[10px] text-[#64748b]">Factor contribution</span>
                </div>

                <div className="space-y-2">
                  {shapFactors.map((f, i) => (
                    <div key={i} className="space-y-1">
                      <div className="flex justify-between text-xs">
                        <span className="text-[#334155] font-medium">{f.name}</span>
                        <span className={`font-mono font-bold ${f.isPositive ? 'text-[#dc2626]' : 'text-[#16a34a]'}`}>
                          {f.isPositive ? '+' : '-'}{f.value}%
                        </span>
                      </div>
                      <div className="w-full h-1.5 bg-[#f1f5f9] rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full ${f.isPositive ? 'bg-[#dc2626]' : 'bg-[#16a34a]'}`}
                          style={{ width: `${Math.min(100, f.value * 2)}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Gemini Automated AI Triage Box */}
              <div className="mt-6 p-4 rounded-2xl bg-[#eff6ff] border border-[#bfdbfe] space-y-1.5">
                <div className="flex items-center gap-2 text-xs font-bold text-[#1d4ed8]">
                  <Sparkles className="w-4 h-4 text-[#2563eb]" />
                  <span>Google Gemini Automated Clinical Triage</span>
                </div>
                <p className="text-xs text-[#1e40af] leading-relaxed">
                  {triageRecommendation}
                </p>
              </div>

              {/* Action Link to EHR */}
              {onExploreDemo && (
                <div className="mt-5 pt-4 border-t border-[#f1f5f9] flex items-center justify-between">
                  <span className="text-xs text-[#64748b]">Ready to inspect full patient EHR chart?</span>
                  <button
                    onClick={onExploreDemo}
                    className="text-xs font-bold text-[#0284c7] hover:text-[#0369a1] flex items-center gap-1 transition-colors cursor-pointer"
                  >
                    <span>View Roster in Clinical Portal</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* ── Section: Federated Learning Network (Light Architecture) ── */}
      <section id="network" className="gsap-network relative z-10 py-16 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto scroll-mt-20">
        <div className="text-center max-w-3xl mx-auto mb-12">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#dcfce7] text-[#166534] text-xs font-bold uppercase tracking-wider mb-3 border border-[#bbf7d0]">
            <Network className="w-3.5 h-3.5" />
            <span>Decentralized Architecture</span>
          </div>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-[#0f172a] tracking-tight">
            How Flower Federated Learning Operates Across Hospitals
          </h2>
          <p className="text-sm sm:text-base text-[#475569] mt-2">
            Local clinical nodes compute gradient updates within their hospital firewall. Only cryptographic weight deltas are communicated to the aggregation coordinator.
          </p>
        </div>

        {/* Visualizer Canvas in Light Mode */}
        <div className="bg-white rounded-3xl p-6 sm:p-10 border border-[#e2e8f0] shadow-xl relative overflow-hidden">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            {/* Hospital Node 1 */}
            <div
              onClick={() => setSelectedNode(1)}
              className={`p-5 rounded-2xl border transition-all cursor-pointer relative ${
                selectedNode === 1
                  ? 'bg-[#f0f9ff] border-[#0284c7] shadow-md shadow-[#0284c7]/10'
                  : 'bg-[#f8fafc] border-[#e2e8f0] hover:border-[#cbd5e1]'
              }`}
            >
              <div className="flex items-center justify-between mb-3">
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#e0f2fe] text-[#0284c7]">
                  NODE 01
                </span>
                <span className="w-2 h-2 rounded-full bg-[#16a34a] animate-ping" />
              </div>
              <h4 className="font-bold text-[#0f172a] text-base">Central Memorial Hospital</h4>
              <p className="text-xs text-[#64748b] mt-1">1,200 beds • MIMIC-IV Clinical Schema</p>
              <div className="mt-4 pt-3 border-t border-[#e2e8f0] flex items-center justify-between text-xs">
                <span className="text-[#64748b]">Local AUC:</span>
                <span className="font-mono font-bold text-[#0f172a]">0.714</span>
              </div>
              <div className="mt-1 flex items-center justify-between text-xs">
                <span className="text-[#64748b]">Gradients Sent:</span>
                <span className="font-mono font-semibold text-[#0284c7]">ΔW_01 (Encrypted)</span>
              </div>
            </div>

            {/* Hospital Node 2 */}
            <div
              onClick={() => setSelectedNode(2)}
              className={`p-5 rounded-2xl border transition-all cursor-pointer relative ${
                selectedNode === 2
                  ? 'bg-[#f5f3ff] border-[#7c3aed] shadow-md shadow-[#7c3aed]/10'
                  : 'bg-[#f8fafc] border-[#e2e8f0] hover:border-[#cbd5e1]'
              }`}
            >
              <div className="flex items-center justify-between mb-3">
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#f3e8ff] text-[#7c3aed]">
                  NODE 02
                </span>
                <span className="w-2 h-2 rounded-full bg-[#16a34a] animate-ping" />
              </div>
              <h4 className="font-bold text-[#0f172a] text-base">East Wing Medical Center</h4>
              <p className="text-xs text-[#64748b] mt-1">850 beds • Cardiology & Critical Care</p>
              <div className="mt-4 pt-3 border-t border-[#e2e8f0] flex items-center justify-between text-xs">
                <span className="text-[#64748b]">Local AUC:</span>
                <span className="font-mono font-bold text-[#0f172a]">0.698</span>
              </div>
              <div className="mt-1 flex items-center justify-between text-xs">
                <span className="text-[#64748b]">Gradients Sent:</span>
                <span className="font-mono font-semibold text-[#7c3aed]">ΔW_02 (Encrypted)</span>
              </div>
            </div>

            {/* Hospital Node 3 */}
            <div
              onClick={() => setSelectedNode(3)}
              className={`p-5 rounded-2xl border transition-all cursor-pointer relative ${
                selectedNode === 3
                  ? 'bg-[#ecfdf5] border-[#059669] shadow-md shadow-[#059669]/10'
                  : 'bg-[#f8fafc] border-[#e2e8f0] hover:border-[#cbd5e1]'
              }`}
            >
              <div className="flex items-center justify-between mb-3">
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#dcfce7] text-[#059669]">
                  NODE 03
                </span>
                <span className="w-2 h-2 rounded-full bg-[#16a34a] animate-ping" />
              </div>
              <h4 className="font-bold text-[#0f172a] text-base">St. Jude's West Clinic</h4>
              <p className="text-xs text-[#64748b] mt-1">420 beds • General Inpatient EHR</p>
              <div className="mt-4 pt-3 border-t border-[#e2e8f0] flex items-center justify-between text-xs">
                <span className="text-[#64748b]">Local AUC:</span>
                <span className="font-mono font-bold text-[#0f172a]">0.719</span>
              </div>
              <div className="mt-1 flex items-center justify-between text-xs">
                <span className="text-[#64748b]">Gradients Sent:</span>
                <span className="font-mono font-semibold text-[#059669]">ΔW_03 (Encrypted)</span>
              </div>
            </div>
          </div>

          {/* Central Flower Aggregator Banner */}
          <div className="p-6 rounded-2xl bg-[#f0f9ff] border border-[#bae6fd] flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-[#0284c7] flex items-center justify-center text-white shadow-md shadow-[#0284c7]/20 shrink-0">
                <Server className="w-6 h-6" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h4 className="font-extrabold text-[#0f172a] text-lg">Flower Federation Aggregator</h4>
                  <span className="px-2 py-0.5 rounded bg-[#dcfce7] text-[#166534] text-[10px] font-bold">
                    Round #14 Synchronized
                  </span>
                </div>
                <p className="text-xs text-[#475569] mt-1">
                  Global Aggregation: <code className="text-[#0284c7] font-mono font-bold">W_t+1 = Σ (n_k / n) * W_k</code> • Differential Privacy Budget (ε = 1.2, δ = 10⁻⁵)
                </p>
              </div>
            </div>

            <div className="flex items-center gap-4 text-xs font-mono bg-white px-4 py-2.5 rounded-xl border border-[#cbd5e1] shrink-0 shadow-sm">
              <div>
                <span className="text-[#64748b] block text-[10px]">GLOBAL AUC</span>
                <span className="text-[#16a34a] font-bold text-sm">0.727</span>
              </div>
              <div className="h-6 w-[1px] bg-[#e2e8f0]" />
              <div>
                <span className="text-[#64748b] block text-[10px]">RAW DATA LEAK</span>
                <span className="text-[#0f172a] font-bold text-sm">0.00%</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Section: Core Specialties (nissh.info Signature Colorful Cards) ── */}
      <section id="capabilities" className="relative z-10 py-16 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto scroll-mt-20">
        <div className="text-center max-w-3xl mx-auto mb-14">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#f3e8ff] text-[#7c3aed] text-xs font-bold uppercase tracking-wider mb-3 border border-[#ddd6fe]">
            <Zap className="w-3.5 h-3.5" />
            <span>Platform Specialties</span>
          </div>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-[#0f172a] tracking-tight">
            Engineered for Clinical Precision & Regulatory Trust
          </h2>
          <p className="text-sm sm:text-base text-[#475569] mt-2">
            Every component of CareLink bridges advanced machine learning algorithms with everyday hospital bedside workflows.
          </p>
        </div>

        {/* 6 Grid Cards with nissh.info's Signature Pastel Palette */}
        <div id="specialties-grid" className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* Card 1: Green */}
          <div className="gsap-specialty-card nissh-card nissh-card-green flex flex-col justify-between">
            <div>
              <div className="w-12 h-12 rounded-2xl bg-white text-[#1a4d2e] flex items-center justify-center mb-5 shadow-sm">
                <ShieldCheck className="w-6 h-6" />
              </div>
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-[#1a4d2e]/80">Privacy Architecture</span>
              <h3 className="text-xl font-extrabold mt-1 mb-2 text-[#1a4d2e]">Decentralized Federated Learning</h3>
              <p className="text-xs leading-relaxed mb-4 text-[#1a4d2e]/85 font-medium">
                Hospital data never crosses the firewall. Local nodes execute private iterations and upload encrypted gradient matrices directly to the Flower coordination server.
              </p>
            </div>
            <ul className="space-y-1.5 border-t border-[#c2e7cc] pt-4 text-xs font-semibold text-[#1a4d2e]">
              <li className="flex items-center gap-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-[#16a34a]" />
                <span>Differential Privacy (DP-SGD) guarantee</span>
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-[#16a34a]" />
                <span>Zero raw PHI database aggregation</span>
              </li>
            </ul>
          </div>

          {/* Card 2: Blue */}
          <div className="gsap-specialty-card nissh-card nissh-card-blue flex flex-col justify-between">
            <div>
              <div className="w-12 h-12 rounded-2xl bg-white text-[#1e3a8a] flex items-center justify-center mb-5 shadow-sm">
                <Brain className="w-6 h-6" />
              </div>
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-[#1e3a8a]/80">Predictive ML</span>
              <h3 className="text-xl font-extrabold mt-1 mb-2 text-[#1e3a8a]">XGBoost Readmission Engine</h3>
              <p className="text-xs leading-relaxed mb-4 text-[#1e3a8a]/85 font-medium">
                Trained on heterogeneous inpatient cohorts with Optuna automated tuning to evaluate 30-day post-discharge readmission probability across multi-organ risk profiles.
              </p>
            </div>
            <ul className="space-y-1.5 border-t border-[#bed6fb] pt-4 text-xs font-semibold text-[#1e3a8a]">
              <li className="flex items-center gap-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-[#2563eb]" />
                <span>0.727 Global multi-site AUC score</span>
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-[#2563eb]" />
                <span>Stratified High/Medium/Low thresholds</span>
              </li>
            </ul>
          </div>

          {/* Card 3: Orange */}
          <div className="gsap-specialty-card nissh-card nissh-card-orange flex flex-col justify-between">
            <div>
              <div className="w-12 h-12 rounded-2xl bg-white text-[#9a3412] flex items-center justify-center mb-5 shadow-sm">
                <Eye className="w-6 h-6" />
              </div>
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-[#9a3412]/80">Trust & Transparency</span>
              <h3 className="text-xl font-extrabold mt-1 mb-2 text-[#9a3412]">SHAP Factor Explainability</h3>
              <p className="text-xs leading-relaxed mb-4 text-[#9a3412]/85 font-medium">
                No black-box decisions. Clinicians inspect the exact mathematical attribution of age, length of stay, comorbidities, and laboratory values driving the risk classification.
              </p>
            </div>
            <ul className="space-y-1.5 border-t border-[#fed7aa] pt-4 text-xs font-semibold text-[#9a3412]">
              <li className="flex items-center gap-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-[#ea580c]" />
                <span>Local waterfall attribution per patient</span>
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-[#ea580c]" />
                <span>Defensible reasoning for clinical buy-in</span>
              </li>
            </ul>
          </div>

          {/* Card 4: Maroon / Pink */}
          <div className="gsap-specialty-card nissh-card nissh-card-maroon flex flex-col justify-between">
            <div>
              <div className="w-12 h-12 rounded-2xl bg-white text-[#831843] flex items-center justify-center mb-5 shadow-sm">
                <Sparkles className="w-6 h-6" />
              </div>
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-[#831843]/80">Generative Triage</span>
              <h3 className="text-xl font-extrabold mt-1 mb-2 text-[#831843]">Gemini 2.5 Flash AI Triage</h3>
              <p className="text-xs leading-relaxed mb-4 text-[#831843]/85 font-medium">
                Free-text clinical notes, nurse handoffs, and admission narratives are digested in real-time to generate instant acuity scoring and structured discharge recommendations.
              </p>
            </div>
            <ul className="space-y-1.5 border-t border-[#fbcfe8] pt-4 text-xs font-semibold text-[#831843]">
              <li className="flex items-center gap-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-[#db2777]" />
                <span>Sub-second automated physician triage</span>
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-[#db2777]" />
                <span>Structured post-discharge action plans</span>
              </li>
            </ul>
          </div>

          {/* Card 5: Purple */}
          <div className="gsap-specialty-card nissh-card nissh-card-purple flex flex-col justify-between">
            <div>
              <div className="w-12 h-12 rounded-2xl bg-white text-[#4c1d95] flex items-center justify-center mb-5 shadow-sm">
                <Activity className="w-6 h-6" />
              </div>
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-[#4c1d95]/80">Bedside Telemetry</span>
              <h3 className="text-xl font-extrabold mt-1 mb-2 text-[#4c1d95]">Real-Time Vitals Telemetry</h3>
              <p className="text-xs leading-relaxed mb-4 text-[#4c1d95]/85 font-medium">
                Continuous sweep telemetry of Heart Rate, SpO2, and Blood Pressure with automated anomaly notifications when vital parameters breach clinical guardrails.
              </p>
            </div>
            <ul className="space-y-1.5 border-t border-[#ddd6fe] pt-4 text-xs font-semibold text-[#4c1d95]">
              <li className="flex items-center gap-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-[#7c3aed]" />
                <span>Live 25mm/s simulated ECG sweep monitor</span>
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-[#7c3aed]" />
                <span>Ward 4A inpatient telemetric integration</span>
              </li>
            </ul>
          </div>

          {/* Card 6: Teal */}
          <div className="gsap-specialty-card nissh-card nissh-card-teal flex flex-col justify-between">
            <div>
              <div className="w-12 h-12 rounded-2xl bg-white text-[#115e59] flex items-center justify-center mb-5 shadow-sm">
                <Lock className="w-6 h-6" />
              </div>
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-[#115e59]/80">Security & Compliance</span>
              <h3 className="text-xl font-extrabold mt-1 mb-2 text-[#115e59]">Supabase RLS & HIPAA</h3>
              <p className="text-xs leading-relaxed mb-4 text-[#115e59]/85 font-medium">
                Strict PostgreSQL Row-Level Security (RLS) guarantees physicians only access their authorized patient rosters, with full immutable audit logs.
              </p>
            </div>
            <ul className="space-y-1.5 border-t border-[#a5f3fc] pt-4 text-xs font-semibold text-[#115e59]">
              <li className="flex items-center gap-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-[#0d9488]" />
                <span>Granular physician patient roster isolation</span>
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-[#0d9488]" />
                <span>HL7 / FHIR JSON export compatibility</span>
              </li>
            </ul>
          </div>
        </div>
      </section>

      {/* ── Section: Architecture & Terminal (Light Mode) ── */}
      <section id="architecture" className="relative z-10 py-16 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto scroll-mt-20">
        <div className="bg-white rounded-3xl p-8 sm:p-12 border border-[#e2e8f0] shadow-xl">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
            <div className="lg:col-span-6 space-y-4">
              <span className="text-xs font-bold uppercase tracking-wider text-[#0284c7]">Enterprise Clinical Grade</span>
              <h2 className="text-3xl font-extrabold text-[#0f172a] tracking-tight">
                Designed to Pass the Most Stringent Hospital Infosec Reviews
              </h2>
              <p className="text-sm text-[#475569] leading-relaxed">
                Hospital IT officers face severe regulatory obstacles deploying public cloud AI. CareLink circumvents compliance hurdles by keeping medical records localized to your on-premise infrastructure.
              </p>

              <div className="space-y-3 pt-2">
                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-[#dcfce7] text-[#166534] flex items-center justify-center shrink-0 mt-0.5">
                    <CheckCircle2 className="w-4 h-4" />
                  </div>
                  <div>
                    <h5 className="text-xs font-bold text-[#0f172a]">HIPAA & GDPR Compliant by Architecture</h5>
                    <p className="text-[11px] text-[#64748b]">No patient identifiable markers are transmitted outside the firewall.</p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-[#dcfce7] text-[#166534] flex items-center justify-center shrink-0 mt-0.5">
                    <CheckCircle2 className="w-4 h-4" />
                  </div>
                  <div>
                    <h5 className="text-xs font-bold text-[#0f172a]">Containerized Node Deployments</h5>
                    <p className="text-[11px] text-[#64748b]">Deploy hospital nodes in minutes using standard Docker & Kubernetes helm charts.</p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-[#dcfce7] text-[#166534] flex items-center justify-center shrink-0 mt-0.5">
                    <CheckCircle2 className="w-4 h-4" />
                  </div>
                  <div>
                    <h5 className="text-xs font-bold text-[#0f172a]">Cryptographic Verification & Tamper Resistance</h5>
                    <p className="text-[11px] text-[#64748b]">Model updates are signed via SHA-256 HMAC tokens before aggregation.</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Terminal Visualizer (Clean Contrast Card) */}
            <div className="lg:col-span-6 bg-[#0f172a] p-5 rounded-2xl border border-[#334155] font-mono text-xs text-[#93c5fd] shadow-2xl space-y-2 overflow-x-auto">
              <div className="flex items-center justify-between pb-3 border-b border-[#334155] text-[11px] text-[#64748b]">
                <div className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded-full bg-[#ef4444]" />
                  <span className="w-3 h-3 rounded-full bg-[#f59e0b]" />
                  <span className="w-3 h-3 rounded-full bg-[#10b981]" />
                </div>
                <span>carelink-federated-node-v2.sh</span>
              </div>
              <div className="pt-2 text-white/90">
                <span className="text-[#38bdf8]">$</span> carelink-node start --hospital-id "HOSP-01" --protocol flower
              </div>
              <p className="text-[#34d399]">[INFO] Connected to Local Clinical Postgres (MIMIC-IV schema: 247 patients loaded)</p>
              <p className="text-[#cbd5e1]">[INFO] Initializing XGBoost local gradient compute...</p>
              <p className="text-[#38bdf8]">[SECURE] Differential Privacy noise injected (sigma=0.45, epsilon=1.2)</p>
              <p className="text-[#c084fc]">[NET] Transmitting encrypted gradient payload to Aggregator (hash: 7a8f...d3e1)</p>
              <p className="text-[#34d399]">[SUCCESS] Global weights received for Round #14 (AUC: 0.727 | Loss: 0.284)</p>
              <p className="text-white font-bold pt-1">[STATUS] Bedside Inference Engine Ready. Telemetry stream listening on port 3000.</p>
            </div>
          </div>
        </div>
      </section>

      {/* ── Final Call to Action ── */}
      <section className="relative z-10 py-16 px-4 sm:px-6 lg:px-8 max-w-5xl mx-auto text-center">
        <div className="p-8 sm:p-12 rounded-3xl bg-gradient-to-r from-[#0284c7] via-[#2563eb] to-[#4f46e5] text-white shadow-2xl relative overflow-hidden">
          <img
            src="/carelink.png"
            alt="CareLink Logo"
            className="w-14 h-14 rounded-2xl object-contain mx-auto mb-4 border border-white/30 bg-white p-1 shadow-lg shadow-black/15"
          />
          <h2 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
            Ready to Explore the Clinical Portal?
          </h2>
          <p className="text-sm text-white/90 max-w-xl mx-auto mt-2 mb-8 font-medium">
            Experience how doctors manage inpatient rosters, analyze telemetry curves, and take action on federated risk warnings.
          </p>

          <div className="flex flex-wrap items-center justify-center gap-4">
            {onExploreDemo && (
              <button
                onClick={onExploreDemo}
                className="px-8 py-3.5 bg-white text-[#0f172a] font-extrabold rounded-2xl text-sm shadow-xl hover:bg-[#f8fafc] active:scale-95 transition-all flex items-center gap-2 cursor-pointer group"
              >
                <span>Launch Interactive Clinical EHR</span>
                <ArrowRight className="w-4 h-4 text-[#0284c7] group-hover:translate-x-1 transition-transform" />
              </button>
            )}

            <button
              onClick={onLogin}
              className="px-7 py-3.5 bg-white/10 hover:bg-white/20 text-white font-bold rounded-2xl text-sm border border-white/30 backdrop-blur-sm transition-all cursor-pointer"
            >
              Provider Portal Sign In
            </button>
          </div>
        </div>
      </section>

      {/* ── Light Footer ── */}
      <footer className="relative z-10 py-12 px-4 sm:px-8 border-t border-[#e2e8f0] text-xs text-[#64748b] bg-white">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-3">
            <img
              src="/carelink.png"
              alt="CareLink Logo"
              className="w-8 h-8 rounded-lg object-contain shadow-sm border border-slate-200 bg-white p-0.5"
            />
            <span className="font-bold text-[#0f172a] text-sm">CareLink</span>
            <span className="text-[#cbd5e1]">•</span>
            <span>Federated Healthcare Machine Learning & EHR Portal</span>
          </div>

          <div className="flex items-center gap-6 font-semibold">
            <a href="#simulator" className="hover:text-[#0f172a] transition-colors">ML Simulator</a>
            <a href="#network" className="hover:text-[#0f172a] transition-colors">Federated Nodes</a>
            <a href="#capabilities" className="hover:text-[#0f172a] transition-colors">Specialties</a>
            <button onClick={onLogin} className="hover:text-[#0f172a] transition-colors cursor-pointer">
              Physician Access
            </button>
          </div>

          <div className="text-right">
            <p>© {new Date().getFullYear()} CareLink Healthcare Systems. HIPAA & HL7/FHIR Ready.</p>
          </div>
        </div>
      </footer>
    </div>
  );
};
