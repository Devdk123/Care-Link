import React, { useState, useRef } from 'react';
import html2canvas from 'html2canvas';
import { 
  ChevronDown, FileText, Image as ImageIcon, Download, 
  TrendingUp, TrendingDown, Minus, Shield, Brain, Activity, Users, Info, Network
} from 'lucide-react';
import { 
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, 
  CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, Legend,
  RadialBarChart, RadialBar, PolarAngleAxis
} from 'recharts';
import { PrivacyDashboard } from '../components/PrivacyDashboard';

// --- Existing Data ---
const admissionsData = [
  { month: 'May', Cardiology: 120, Neurology: 80, 'General Practice': 95 },
  { month: 'Jun', Cardiology: 135, Neurology: 75, 'General Practice': 110 },
  { month: 'Jul', Cardiology: 148, Neurology: 92, 'General Practice': 105 },
  { month: 'Aug', Cardiology: 142, Neurology: 88, 'General Practice': 118 },
  { month: 'Sep', Cardiology: 158, Neurology: 95, 'General Practice': 125 },
  { month: 'Oct', Cardiology: 165, Neurology: 102, 'General Practice': 130 },
];

const patientFlowData = Array.from({ length: 30 }, (_, i) => ({
  day: `Day ${i + 1}`,
  patients: Math.floor(Math.random() * (70 - 30 + 1) + 30)
}));

const demographicsData = [
  { name: 'Male 18-45', value: 28, color: '#316bf3' },
  { name: 'Male 45+', value: 22, color: '#0051d5' },
  { name: 'Female 18-45', value: 30, color: '#10b981' },
  { name: 'Female 45+', value: 15, color: '#ff9800' },
  { name: 'Pediatric', value: 5, color: '#74777f' },
];

const labData = [
  { test: 'CBC', hours: 1.2 },
  { test: 'BMP', hours: 2.1 },
  { test: 'Lipid Panel', hours: 3.4 },
  { test: 'TSH', hours: 4.8 },
  { test: 'Urinalysis', hours: 0.8 },
  { test: 'HbA1c', hours: 2.6 },
];

// --- New Federated ML Data ---
const getMetricColor = (val: number) => {
  if (val > 0.7) return '#10b981'; // emerald
  if (val >= 0.5) return '#f59e0b'; // amber
  return '#ef4444'; // red
};

const getMetricBgClass = (val: number) => {
  if (val > 0.7) return 'bg-emerald-500';
  if (val >= 0.5) return 'bg-amber-500';
  return 'bg-red-500';
};

const getMetricTextClass = (val: number) => {
  if (val > 0.7) return 'text-emerald-600';
  if (val >= 0.5) return 'text-amber-600';
  return 'text-red-600';
};

const aucValue = 0.727;
const aucData = [{ name: 'AUC', value: aucValue, fill: getMetricColor(aucValue) }];

const shapData = [
  { feature: 'Length of Stay', importance: 0.85 },
  { feature: 'Prior Admissions', importance: 0.72 },
  { feature: 'Age', importance: 0.58 },
  { feature: 'Num Diagnoses', importance: 0.45 },
  { feature: 'Has Heart Failure', importance: 0.38 },
];

const hospitalNodes = [
  { name: 'Node 1 (Central)', auc: 0.714 },
  { name: 'Node 2 (East Wing)', auc: 0.698 },
  { name: 'Node 3 (West Clinic)', auc: 0.719 },
];

export const AnalyticsView: React.FC = () => {
  const [showExportMenu, setShowExportMenu] = useState(false);
  const analyticsRef = useRef<HTMLDivElement>(null);

  const exportAsPNG = async () => {
    setShowExportMenu(false);
    if (!analyticsRef.current) return;
    try {
      const canvas = await html2canvas(analyticsRef.current, { scale: 2 });
      const dataUrl = canvas.toDataURL('image/png');
      const link = document.createElement('a');
      link.download = 'CareLink_Analytics.png';
      link.href = dataUrl;
      link.click();
    } catch (err) {
      console.error('Error generating PNG', err);
    }
  };

  const exportAsCSV = () => {
    setShowExportMenu(false);
    const csvContent = "data:text/csv;charset=utf-8," 
      + "Metric,Value,Badge,Subtitle\n"
      + "Monthly Admissions,1428,+18%,Average 46 admissions/day\n"
      + "Avg Consultation Time,22 mins,-3 mins,Target: 20-25 mins\n"
      + "Bed Occupancy Rate,84%,Stable,Within optimal range\n"
      + "Patient Satisfaction,4.8/5.0,+0.2,Based on 842 reviews\n";
    
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', 'CareLink_KPI_Data.csv');
    document.body.appendChild(link);
    link.click();
    link.remove();
  };

  return (
    <div className="p-6 h-full overflow-y-auto bg-[#f8f9fa]">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Analytics Dashboard</h1>
          <p className="text-gray-500 mt-1">Overview of hospital performance & AI metrics</p>
        </div>
        
        <div className="relative">
          <button 
            onClick={() => setShowExportMenu(!showExportMenu)}
            className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-lg shadow-sm hover:bg-gray-50 text-gray-700 font-medium transition-colors"
          >
            <Download size={18} />
            Export Data
            <ChevronDown size={18} />
          </button>
          
          {showExportMenu && (
            <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-gray-200 z-10 py-1">
              <button 
                onClick={exportAsPNG}
                className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
              >
                <ImageIcon size={16} /> Export as PNG
              </button>
              <button 
                onClick={exportAsCSV}
                className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
              >
                <FileText size={16} /> Export as CSV
              </button>
            </div>
          )}
        </div>
      </div>

      <div ref={analyticsRef} className="space-y-6">
        
        {/* ==================================================== */}
        {/* CENTERPIECE: FEDERATED AI MODEL PERFORMANCE SECTION  */}
        {/* ==================================================== */}
        <div className="bg-gradient-to-br from-[#0f172a] to-[#1e293b] rounded-2xl shadow-xl overflow-hidden border border-gray-800 text-white">
          <div className="p-6 border-b border-gray-800 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-black/20">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-blue-500/20 rounded-xl text-blue-400">
                <Network className="w-6 h-6" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-white flex items-center gap-2">
                  Federated Readmission Model
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold tracking-widest uppercase bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">Live</span>
                </h2>
                <p className="text-gray-400 text-sm mt-1">XGBoost distributed across 3 hospital networks</p>
              </div>
            </div>
            
            <div className="flex items-center gap-6">
              <div className="flex flex-col">
                <span className="text-xs text-gray-400 uppercase tracking-wider font-semibold">Training Data</span>
                <span className="text-lg font-bold flex items-center gap-1.5"><Users className="w-4 h-4 text-blue-400"/> 40,847 records</span>
              </div>
              <div className="w-px h-10 bg-gray-700"></div>
              <div className="flex flex-col">
                <span className="text-xs text-gray-400 uppercase tracking-wider font-semibold">Federated Rounds</span>
                <span className="text-lg font-bold flex items-center gap-1.5"><Activity className="w-4 h-4 text-purple-400"/> 5 Rounds</span>
              </div>
            </div>
          </div>

          <div className="p-6 grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Core Metrics & Gauge */}
            <div className="flex flex-col items-center justify-center space-y-4">
              <div className="relative w-[200px] h-[200px]">
                <ResponsiveContainer width="100%" height="100%">
                  <RadialBarChart 
                    cx="50%" cy="50%" 
                    innerRadius="70%" outerRadius="100%" 
                    barSize={15} data={aucData} 
                    startAngle={180} endAngle={0}
                  >
                    <PolarAngleAxis type="number" domain={[0, 1]} angleAxisId={0} tick={false} />
                    <RadialBar background={{ fill: '#334155' }} dataKey="value" cornerRadius={10} />
                  </RadialBarChart>
                </ResponsiveContainer>
                <div className="absolute inset-0 flex flex-col items-center justify-center mt-6">
                  <span className="text-3xl font-black">{aucValue}</span>
                  <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">ROC-AUC</span>
                </div>
              </div>

              <div className="w-full space-y-4 px-4">
                {/* Recall */}
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-gray-300">Recall <span className="text-gray-500 text-xs">(Readmissions Caught)</span></span>
                    <span className="font-bold">0.512</span>
                  </div>
                  <div className="w-full bg-gray-700 rounded-full h-2">
                    <div className={`${getMetricBgClass(0.512)} h-2 rounded-full`} style={{ width: '51.2%' }}></div>
                  </div>
                </div>
                {/* Precision */}
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-gray-300">Precision</span>
                    <span className="font-bold">0.631</span>
                  </div>
                  <div className="w-full bg-gray-700 rounded-full h-2">
                    <div className={`${getMetricBgClass(0.631)} h-2 rounded-full`} style={{ width: '63.1%' }}></div>
                  </div>
                </div>
                {/* Kappa */}
                <div className="group relative cursor-help">
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-gray-300 flex items-center gap-1 border-b border-dashed border-gray-600">
                      Cohen's Kappa <Info className="w-3 h-3 text-gray-500"/>
                    </span>
                    <span className="font-bold">0.318</span>
                  </div>
                  <div className="w-full bg-gray-700 rounded-full h-2">
                    <div className={`${getMetricBgClass(0.318)} h-2 rounded-full`} style={{ width: '31.8%' }}></div>
                  </div>
                  {/* Tooltip */}
                  <div className="absolute bottom-full left-0 mb-2 hidden group-hover:block w-48 bg-gray-800 text-xs text-gray-200 p-2 rounded shadow-xl border border-gray-700 z-10">
                    Agreement beyond random chance. &gt;0.3 indicates fair to good clinical utility.
                  </div>
                </div>
              </div>
            </div>

            {/* Nodes & Privacy */}
            <div className="flex flex-col justify-center space-y-6">
              <div>
                <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-4 flex items-center gap-2">
                  <Network className="w-4 h-4" /> Participating Nodes
                </h3>
                <div className="space-y-3">
                  {hospitalNodes.map((node, i) => (
                    <div key={i} className="flex items-center justify-between p-3 bg-gray-800/50 border border-gray-700 rounded-xl">
                      <div className="flex items-center gap-3">
                        <div className={`w-2 h-2 rounded-full ${getMetricBgClass(node.auc)} shadow-[0_0_8px_currentColor]`} />
                        <span className="text-sm font-medium">{node.name}</span>
                      </div>
                      <span className={`text-sm font-bold ${getMetricTextClass(node.auc)}`}>{node.auc} AUC</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-xl flex items-start gap-3">
                <Shield className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                <div>
                  <h4 className="text-sm font-bold text-emerald-400">Privacy Guarantee</h4>
                  <p className="text-xs text-emerald-200/70 mt-1 leading-relaxed">
                    Zero raw patient data leaves hospital premises. Only encrypted model weight deltas are aggregated globally.
                  </p>
                </div>
              </div>
            </div>

            {/* Model Explainability & Clinical Significance */}
            <div className="flex flex-col justify-between">
              <div>
                <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-2 flex items-center gap-2">
                  <Brain className="w-4 h-4" /> Model Explainability (SHAP)
                </h3>
                <div className="h-[180px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={shapData} layout="vertical" margin={{ top: 10, right: 20, left: 45, bottom: 0 }}>
                      <XAxis type="number" hide />
                      <YAxis dataKey="feature" type="category" axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 11 }} />
                      <RechartsTooltip 
                        cursor={{fill: '#334155'}} 
                        contentStyle={{ backgroundColor: '#1e293b', borderColor: '#334155', borderRadius: '8px', color: '#f8fafc' }}
                        itemStyle={{ color: '#60a5fa' }}
                      />
                      <Bar dataKey="importance" fill="#60a5fa" radius={[0, 4, 4, 0]} barSize={16} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="mt-4 p-4 bg-blue-500/10 border border-blue-500/20 rounded-xl">
                <h4 className="text-xs font-bold text-blue-400 uppercase tracking-wider mb-2">Clinical Significance</h4>
                <p className="text-xs text-blue-200/80 leading-relaxed">
                  A model with AUC 0.727 correctly ranks a high-risk patient above a low-risk patient 72.7% of the time — significantly better than standard clinical intuition. In a 1,000-patient cohort, our federated model flags approximately 140 additional true readmissions compared to legacy protocols.
                </p>
              </div>
            </div>

          </div>
        </div>
        {/* ==================================================== */}

        {/* Existing KPI Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="bg-white rounded-2xl border border-[#e0e3e5] shadow-sm p-6">
            <div className="flex justify-between items-start">
              <p className="text-sm font-medium text-gray-500">Monthly Admissions</p>
              <div className="flex items-center gap-1 text-xs font-medium text-emerald-600 bg-emerald-50 px-2 py-1 rounded-full">
                <TrendingUp size={14} /> +18%
              </div>
            </div>
            <div className="mt-4">
              <h3 className="text-3xl font-bold text-gray-900">1,428</h3>
              <p className="text-sm text-gray-500 mt-1">Average 46 admissions/day</p>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-[#e0e3e5] shadow-sm p-6">
            <div className="flex justify-between items-start">
              <p className="text-sm font-medium text-gray-500">Avg Consultation Time</p>
              <div className="flex items-center gap-1 text-xs font-medium text-blue-600 bg-blue-50 px-2 py-1 rounded-full">
                <TrendingDown size={14} /> -3 mins
              </div>
            </div>
            <div className="mt-4">
              <h3 className="text-3xl font-bold text-gray-900">22 mins</h3>
              <p className="text-sm text-gray-500 mt-1">Target: 20-25 mins</p>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-[#e0e3e5] shadow-sm p-6">
            <div className="flex justify-between items-start">
              <p className="text-sm font-medium text-gray-500">Bed Occupancy Rate</p>
              <div className="flex items-center gap-1 text-xs font-medium text-amber-600 bg-amber-50 px-2 py-1 rounded-full">
                <Minus size={14} /> Stable
              </div>
            </div>
            <div className="mt-4">
              <h3 className="text-3xl font-bold text-gray-900">84%</h3>
              <p className="text-sm text-gray-500 mt-1">Within optimal range</p>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-[#e0e3e5] shadow-sm p-6">
            <div className="flex justify-between items-start">
              <p className="text-sm font-medium text-gray-500">Patient Satisfaction</p>
              <div className="flex items-center gap-1 text-xs font-medium text-emerald-600 bg-emerald-50 px-2 py-1 rounded-full">
                <TrendingUp size={14} /> +0.2
              </div>
            </div>
            <div className="mt-4">
              <h3 className="text-3xl font-bold text-gray-900">4.8<span className="text-lg text-gray-500 font-medium">/5.0</span></h3>
              <p className="text-sm text-gray-500 mt-1">Based on 842 reviews</p>
            </div>
          </div>
        </div>

        {/* Existing Charts Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white rounded-2xl border border-[#e0e3e5] shadow-sm p-6">
            <h3 className="text-lg font-bold text-gray-900 mb-6">Monthly Admissions by Department</h3>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={admissionsData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                  <XAxis dataKey="month" axisLine={false} tickLine={false} />
                  <YAxis axisLine={false} tickLine={false} />
                  <RechartsTooltip cursor={{fill: '#f9fafb'}} contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                  <Legend iconType="circle" wrapperStyle={{ paddingTop: '20px' }} />
                  <Bar dataKey="Cardiology" fill="#316bf3" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="Neurology" fill="#ff9800" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="General Practice" fill="#10b981" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-[#e0e3e5] shadow-sm p-6">
            <h3 className="text-lg font-bold text-gray-900 mb-6">Daily Patient Flow</h3>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={patientFlowData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                  <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fontSize: 12 }} interval="preserveStartEnd" minTickGap={30} />
                  <YAxis axisLine={false} tickLine={false} />
                  <RechartsTooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                  <Line type="monotone" dataKey="patients" stroke="#316bf3" strokeWidth={3} dot={{ r: 4, fill: '#316bf3', strokeWidth: 2, stroke: '#fff' }} activeDot={{ r: 6 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-[#e0e3e5] shadow-sm p-6">
            <h3 className="text-lg font-bold text-gray-900 mb-6">Patient Demographics</h3>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={demographicsData}
                    cx="50%"
                    cy="50%"
                    innerRadius={80}
                    outerRadius={110}
                    paddingAngle={2}
                    dataKey="value"
                  >
                    {demographicsData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <RechartsTooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                  <Legend layout="vertical" verticalAlign="middle" align="right" iconType="circle" />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-[#e0e3e5] shadow-sm p-6">
            <h3 className="text-lg font-bold text-gray-900 mb-6">Lab Turnaround Times (Hours)</h3>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={labData} layout="vertical" margin={{ top: 5, right: 30, left: 40, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f0f0f0" />
                  <XAxis type="number" axisLine={false} tickLine={false} />
                  <YAxis dataKey="test" type="category" axisLine={false} tickLine={false} />
                  <RechartsTooltip cursor={{fill: '#f9fafb'}} contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                  <Bar dataKey="hours" fill="#316bf3" radius={[0, 4, 4, 0]} barSize={20} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        <PrivacyDashboard />
      </div>
    </div>
  );
};
