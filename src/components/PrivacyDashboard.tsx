import React from 'react';
import { 
  ShieldCheck, 
  Lock, 
  EyeOff, 
  Cloud, 
  Shield, 
  Info, 
  CheckCircle 
} from 'lucide-react';
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, 
  Tooltip as RechartsTooltip, ResponsiveContainer, ReferenceDot
} from 'recharts';

const tradeOffData = [
  { epsilon: 0.1, auc: 0.65 },
  { epsilon: 0.5, auc: 0.69 },
  { epsilon: 1.0, auc: 0.727 }, // Our chosen point
  { epsilon: 2.0, auc: 0.731 },
  { epsilon: 5.0, auc: 0.735 },
  { epsilon: 10.0, auc: 0.738 },
];

export const PrivacyDashboard: React.FC = () => {
  return (
    <div className="bg-white rounded-2xl border border-[#e0e3e5] shadow-sm overflow-hidden mt-6">
      {/* Header */}
      <div className="bg-[#0F2A4A] p-6 text-white flex items-center gap-3">
        <ShieldCheck className="w-8 h-8 text-[#0E7C7B]" />
        <div>
          <h2 className="text-xl font-bold">Privacy Shield: Federated Differential Privacy</h2>
          <p className="text-sm text-blue-200 mt-1">Mathematical guarantees protecting patient confidentiality across the federation.</p>
        </div>
      </div>

      <div className="p-6 space-y-8">
        {/* Metric Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Epsilon */}
          <div className="group relative bg-[#f8f9fa] border border-[#e0e3e5] rounded-xl p-5 hover:border-[#0E7C7B] transition-colors">
            <div className="flex justify-between items-start mb-2">
              <span className="text-xs font-bold text-[#74777f] uppercase tracking-wider">Privacy Budget (ε)</span>
              <Info className="w-4 h-4 text-[#0E7C7B]" />
            </div>
            <div className="text-3xl font-black text-[#0F2A4A]">1.0</div>
            
            {/* Tooltip */}
            <div className="absolute bottom-full left-0 mb-2 hidden group-hover:block w-64 bg-[#0F2A4A] text-xs text-white p-3 rounded-lg shadow-xl z-10">
              Lower epsilon = stronger privacy. 1.0 is considered a medical-grade strict privacy budget.
            </div>
          </div>

          {/* Delta */}
          <div className="group relative bg-[#f8f9fa] border border-[#e0e3e5] rounded-xl p-5 hover:border-[#0E7C7B] transition-colors">
            <div className="flex justify-between items-start mb-2">
              <span className="text-xs font-bold text-[#74777f] uppercase tracking-wider">Delta (δ)</span>
              <Info className="w-4 h-4 text-[#0E7C7B]" />
            </div>
            <div className="text-3xl font-black text-[#0F2A4A]">1e-5</div>
            
            {/* Tooltip */}
            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block w-64 bg-[#0F2A4A] text-xs text-white p-3 rounded-lg shadow-xl z-10">
              Probability of a privacy breach. Statistically lower than winning the lottery.
            </div>
          </div>

          {/* Data Shared */}
          <div className="group relative bg-[#f8f9fa] border border-[#e0e3e5] rounded-xl p-5 hover:border-[#0E7C7B] transition-colors">
            <div className="flex justify-between items-start mb-2">
              <span className="text-xs font-bold text-[#74777f] uppercase tracking-wider">Raw Data Shared</span>
              <Info className="w-4 h-4 text-[#0E7C7B]" />
            </div>
            <div className="text-3xl font-black text-[#10b981]">0 <span className="text-lg font-bold text-[#10b981]/70">records</span></div>
            
            {/* Tooltip */}
            <div className="absolute bottom-full right-0 mb-2 hidden group-hover:block w-64 bg-[#0F2A4A] text-xs text-white p-3 rounded-lg shadow-xl z-10">
              Zero raw patient records are transmitted. Only mathematically noised model gradients leave the hospital firewall.
            </div>
          </div>
        </div>

        <hr className="border-[#e0e3e5]" />

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* How It Works */}
          <div>
            <h3 className="text-base font-bold text-[#0F2A4A] mb-6">How It Works: Secure Federation</h3>
            <div className="space-y-6">
              {/* Step 1 */}
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-full bg-[#0F2A4A]/5 flex items-center justify-center shrink-0 border border-[#0F2A4A]/10">
                  <Lock className="w-5 h-5 text-[#0F2A4A]" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-[#0F2A4A]">Step 1: Local Training</h4>
                  <p className="text-xs text-[#74777f] mt-1">Each hospital trains the AI exclusively on its own internal, highly-secured database. Data never moves.</p>
                </div>
              </div>
              
              {/* Step 2 */}
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-full bg-[#0E7C7B]/10 flex items-center justify-center shrink-0 border border-[#0E7C7B]/20">
                  <EyeOff className="w-5 h-5 text-[#0E7C7B]" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-[#0F2A4A]">Step 2: DP Noise Injection</h4>
                  <p className="text-xs text-[#74777f] mt-1">Gaussian mathematical noise is applied to the model weights to mask any individual patient's contribution to the algorithm.</p>
                </div>
              </div>

              {/* Step 3 */}
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-full bg-blue-500/10 flex items-center justify-center shrink-0 border border-blue-500/20">
                  <Cloud className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-[#0F2A4A]">Step 3: Encrypted Transport</h4>
                  <p className="text-xs text-[#74777f] mt-1">Only the noised, aggregated model gradients are sent to the central Flower federation server via end-to-end encryption.</p>
                </div>
              </div>

              {/* Step 4 */}
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-full bg-[#10b981]/10 flex items-center justify-center shrink-0 border border-[#10b981]/20">
                  <Shield className="w-5 h-5 text-[#10b981]" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-[#0F2A4A]">Step 4: Global Intelligence</h4>
                  <p className="text-xs text-[#74777f] mt-1">The global AI model improves for all hospitals without any facility ever exposing a single patient's private health information.</p>
                </div>
              </div>
            </div>
          </div>

          {/* Trade-off Chart & Compliance */}
          <div className="flex flex-col justify-between">
            <div>
              <h3 className="text-base font-bold text-[#0F2A4A] mb-2">Privacy vs Utility Trade-off</h3>
              <p className="text-xs text-[#74777f] mb-4">Finding the optimal balance between high clinical accuracy (AUC) and strict privacy guarantees.</p>
              
              <div className="h-[220px] bg-[#f8f9fa] rounded-xl border border-[#e0e3e5] p-4">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={tradeOffData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e0e3e5" />
                    <XAxis dataKey="epsilon" type="number" domain={[0, 10]} ticks={[0.1, 1, 5, 10]} axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#74777f' }} />
                    <YAxis domain={[0.6, 0.75]} axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#74777f' }} />
                    <RechartsTooltip 
                      contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} 
                      formatter={(value: number) => [value, 'AUC']}
                      labelFormatter={(label) => `Epsilon: ${label}`}
                    />
                    <Line type="monotone" dataKey="auc" stroke="#0F2A4A" strokeWidth={3} dot={false} />
                    <ReferenceDot x={1.0} y={0.727} r={6} fill="#ef4444" stroke="#fff" strokeWidth={2} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="mt-6 pt-6 border-t border-[#e0e3e5]">
              <h3 className="text-xs font-bold text-[#74777f] uppercase tracking-wider mb-3">Enterprise Compliance Ready</h3>
              <div className="flex flex-wrap gap-3">
                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#0E7C7B]/10 text-[#0E7C7B] text-xs font-bold rounded-full">
                  <CheckCircle className="w-3.5 h-3.5" /> HIPAA
                </span>
                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#0E7C7B]/10 text-[#0E7C7B] text-xs font-bold rounded-full">
                  <CheckCircle className="w-3.5 h-3.5" /> GDPR Art. 25
                </span>
                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#0E7C7B]/10 text-[#0E7C7B] text-xs font-bold rounded-full">
                  <CheckCircle className="w-3.5 h-3.5" /> ISO 27001
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
