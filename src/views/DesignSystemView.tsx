import React from 'react';
import {
  Palette,
  Type,
  Square,
  AlertCircle,
  CheckCircle2,
  Info,
  AlertTriangle,
  Send,
  Plus,
  Trash2,
  Search,
  Lock
} from 'lucide-react';

export const DesignSystemView: React.FC = () => {
  return (
    <div className="space-y-8 pb-12">
      {/* Design System Header Banner */}
      <div className="bg-[#022448] text-white p-8 rounded-2xl shadow-xl space-y-2">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#316bf3] text-xs font-semibold text-white">
          CareLink Design Tokens v2.4
        </div>
        <h1 className="text-2xl font-extrabold tracking-tight">CareLink Clinical UI Design System</h1>
        <p className="text-xs text-[#adc8f5] max-w-2xl leading-relaxed">
          Comprehensive visual language and component specifications built for clinical precision, accessibility, and high visual contrast.
        </p>
      </div>

      {/* 1. Typography Section */}
      <div className="bg-white rounded-2xl border border-[#e0e3e5] p-6 card-shadow space-y-4">
        <div className="flex items-center gap-2 border-b border-[#e0e3e5] pb-3">
          <Type className="w-5 h-5 text-[#316bf3]" />
          <h2 className="text-lg font-bold text-[#191c1e]">Typography Hierarchy</h2>
        </div>

        <div className="space-y-4">
          <div className="p-4 bg-[#f7f9fb] rounded-xl border border-[#e0e3e5] flex flex-col md:flex-row md:items-center justify-between gap-2">
            <div>
              <p className="text-2xl font-extrabold text-[#191c1e]">Display Heading 1 (24px / 1.5)</p>
              <p className="text-xs text-[#74777f]">Inter Bold • Used for primary page titles & hero headers</p>
            </div>
            <span className="font-mono text-xs text-[#316bf3] bg-white px-2.5 py-1 rounded border">.text-2xl .font-extrabold</span>
          </div>

          <div className="p-4 bg-[#f7f9fb] rounded-xl border border-[#e0e3e5] flex flex-col md:flex-row md:items-center justify-between gap-2">
            <div>
              <p className="text-lg font-bold text-[#191c1e]">Section Heading 2 (18px / 1.5)</p>
              <p className="text-xs text-[#74777f]">Inter SemiBold • Used for card titles & modal headers</p>
            </div>
            <span className="font-mono text-xs text-[#316bf3] bg-white px-2.5 py-1 rounded border">.text-lg .font-bold</span>
          </div>

          <div className="p-4 bg-[#f7f9fb] rounded-xl border border-[#e0e3e5] flex flex-col md:flex-row md:items-center justify-between gap-2">
            <div>
              <p className="text-sm font-semibold text-[#191c1e]">Subheading / Title (14px / 1.5)</p>
              <p className="text-xs text-[#74777f]">Inter Medium • Used for patient names & table headers</p>
            </div>
            <span className="font-mono text-xs text-[#316bf3] bg-white px-2.5 py-1 rounded border">.text-sm .font-semibold</span>
          </div>

          <div className="p-4 bg-[#f7f9fb] rounded-xl border border-[#e0e3e5] flex flex-col md:flex-row md:items-center justify-between gap-2">
            <div>
              <p className="text-xs text-[#43474e]">Body Text Standard (12px / 1.5)</p>
              <p className="text-[10px] text-[#74777f]">Inter Regular • Used for EHR notes & description text</p>
            </div>
            <span className="font-mono text-xs text-[#316bf3] bg-white px-2.5 py-1 rounded border">.text-xs .text-[#43474e]</span>
          </div>
        </div>
      </div>

      {/* 2. Color Tokens Palette */}
      <div className="bg-white rounded-2xl border border-[#e0e3e5] p-6 card-shadow space-y-4">
        <div className="flex items-center gap-2 border-b border-[#e0e3e5] pb-3">
          <Palette className="w-5 h-5 text-[#316bf3]" />
          <h2 className="text-lg font-bold text-[#191c1e]">Core Palette Swatches</h2>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <div className="p-3 bg-[#022448] text-white rounded-xl space-y-2">
            <p className="text-xs font-bold">Primary Navy</p>
            <p className="font-mono text-[10px] text-[#adc8f5]">#022448</p>
          </div>

          <div className="p-3 bg-[#1e3a5f] text-white rounded-xl space-y-2">
            <p className="text-xs font-bold">Primary Container</p>
            <p className="font-mono text-[10px] text-[#adc8f5]">#1e3a5f</p>
          </div>

          <div className="p-3 bg-[#316bf3] text-white rounded-xl space-y-2">
            <p className="text-xs font-bold">Secondary Blue</p>
            <p className="font-mono text-[10px] text-white/80">#316bf3</p>
          </div>

          <div className="p-3 bg-[#10b981] text-white rounded-xl space-y-2">
            <p className="text-xs font-bold">Tertiary Emerald</p>
            <p className="font-mono text-[10px] text-white/80">#10b981</p>
          </div>

          <div className="p-3 bg-[#ba1a1a] text-white rounded-xl space-y-2">
            <p className="text-xs font-bold">Error Red</p>
            <p className="font-mono text-[10px] text-white/80">#ba1a1a</p>
          </div>

          <div className="p-3 bg-[#f7f9fb] text-[#191c1e] rounded-xl border border-[#e0e3e5] space-y-2">
            <p className="text-xs font-bold">Surface Canvas</p>
            <p className="font-mono text-[10px] text-[#74777f]">#f7f9fb</p>
          </div>
        </div>
      </div>

      {/* 3. Buttons & Interactive Controls */}
      <div className="bg-white rounded-2xl border border-[#e0e3e5] p-6 card-shadow space-y-4">
        <div className="flex items-center gap-2 border-b border-[#e0e3e5] pb-3">
          <Square className="w-5 h-5 text-[#316bf3]" />
          <h2 className="text-lg font-bold text-[#191c1e]">Buttons & Action Controls</h2>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button className="px-5 py-2.5 bg-[#316bf3] hover:bg-[#0051d5] text-white text-xs font-bold rounded-xl shadow-md shadow-[#316bf3]/20 flex items-center gap-2 transition-all">
            <Plus className="w-4 h-4" />
            <span>Primary Button</span>
          </button>

          <button className="px-5 py-2.5 bg-[#10b981] hover:bg-[#059669] text-white text-xs font-bold rounded-xl shadow-md shadow-[#10b981]/20 flex items-center gap-2 transition-all">
            <CheckCircle2 className="w-4 h-4" />
            <span>Success Action</span>
          </button>

          <button className="px-5 py-2.5 bg-[#f2f4f6] hover:bg-[#e0e3e5] text-[#191c1e] text-xs font-bold rounded-xl transition-colors">
            Secondary Button
          </button>

          <button className="px-5 py-2.5 border border-[#c4c6cf] hover:bg-[#f2f4f6] text-[#43474e] text-xs font-bold rounded-xl transition-colors">
            Outline Control
          </button>

          <button className="px-5 py-2.5 bg-[#ba1a1a] hover:bg-[#991212] text-white text-xs font-bold rounded-xl flex items-center gap-2 transition-colors">
            <Trash2 className="w-4 h-4" />
            <span>Destructive</span>
          </button>
        </div>
      </div>

      {/* 4. Alerts & Banners */}
      <div className="bg-white rounded-2xl border border-[#e0e3e5] p-6 card-shadow space-y-4">
        <h2 className="text-lg font-bold text-[#191c1e] border-b border-[#e0e3e5] pb-3">
          Alert Banners & Notifications
        </h2>

        <div className="space-y-3">
          <div className="p-4 bg-[#10b981]/10 border border-[#10b981]/30 rounded-xl flex items-start gap-3">
            <CheckCircle2 className="w-5 h-5 text-[#10b981] shrink-0 mt-0.5" />
            <div>
              <h4 className="text-xs font-bold text-[#10b981]">Patient Record Saved</h4>
              <p className="text-xs text-[#191c1e] mt-0.5">EHR update confirmed for PT-8472 (Eleanor Shellstrop).</p>
            </div>
          </div>

          <div className="p-4 bg-[#ff9800]/10 border border-[#ff9800]/30 rounded-xl flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-[#ff9800] shrink-0 mt-0.5" />
            <div>
              <h4 className="text-xs font-bold text-[#ff9800]">Pending Lab Results Warning</h4>
              <p className="text-xs text-[#191c1e] mt-0.5">Blood panel awaiting review for Chidi Anagonye.</p>
            </div>
          </div>

          <div className="p-4 bg-[#ba1a1a]/10 border border-[#ba1a1a]/30 rounded-xl flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-[#ba1a1a] shrink-0 mt-0.5" />
            <div>
              <h4 className="text-xs font-bold text-[#ba1a1a]">Critical Telemetry Alert</h4>
              <p className="text-xs text-[#191c1e] mt-0.5">Telemetry monitor disconnected on Ward 3B.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
