import React from 'react';
import { Stethoscope, ArrowLeft, Home, HelpCircle, AlertTriangle } from 'lucide-react';

interface NotFoundViewProps {
  onGoHome: () => void;
}

export const NotFoundView: React.FC<NotFoundViewProps> = ({ onGoHome }) => {
  return (
    <div className="min-h-screen bg-[#f7f9fb] flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl border border-[#e0e3e5] shadow-2xl max-w-lg w-full p-8 text-center space-y-6">
        {/* 3D Stethoscope Visual Icon */}
        <div className="w-24 h-24 rounded-3xl bg-gradient-to-br from-[#022448] to-[#1e3a5f] text-white mx-auto flex items-center justify-center shadow-2xl shadow-[#022448]/30 relative">
          <Stethoscope className="w-12 h-12 text-[#adc8f5]" />
          <span className="absolute -top-2 -right-2 w-8 h-8 rounded-full bg-[#ba1a1a] text-white text-xs font-bold flex items-center justify-center border-2 border-white">
            404
          </span>
        </div>

        <div className="space-y-2">
          <h1 className="text-3xl font-extrabold text-[#191c1e] tracking-tight">404 Page Not Found</h1>
          <p className="text-xs text-[#74777f] max-w-sm mx-auto leading-relaxed">
            The clinical route or patient file requested could not be located in the CareLink hospital directory.
          </p>
        </div>

        <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
          <button
            onClick={onGoHome}
            className="w-full sm:w-auto px-6 py-3 bg-[#316bf3] hover:bg-[#0051d5] text-white text-xs font-bold rounded-xl shadow-lg shadow-[#316bf3]/20 flex items-center justify-center gap-2 transition-all"
          >
            <Home className="w-4 h-4" />
            <span>Return to Dashboard</span>
          </button>

          <a
            href="#support"
            className="w-full sm:w-auto px-6 py-3 bg-[#f2f4f6] hover:bg-[#e0e3e5] text-[#191c1e] text-xs font-bold rounded-xl flex items-center justify-center gap-2 transition-colors"
          >
            <HelpCircle className="w-4 h-4" />
            <span>Clinical IT Helpdesk</span>
          </a>
        </div>
      </div>
    </div>
  );
};
