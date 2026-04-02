
import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  BarChart3, TrendingUp, Clock, CreditCard, 
  ChevronRight, Download, Info, Shield, 
  Zap, Calendar, AlertCircle, FileText
} from 'lucide-react';

interface Stats {
  avgDelay: number;
  reliabilityByRoute: { route: string; score: number }[];
  peakHourAnalysis: { hour: number; delay: number }[];
  patterns: string[];
  costTrend: { date: string; amount: number }[];
}

interface Recommendation {
  type: string;
  title: string;
  suggestion: string;
  impact: string;
}

const CommuteReplayDashboard: React.FC = () => {
  const [stats, setStats] = useState<Stats | null>(null);
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // MOCK: In production, fetch from /api/history/stats & /api/history/insights
    setTimeout(() => {
      setStats({
        avgDelay: 8.5,
        reliabilityByRoute: [
          { route: 'Borivali → BKC', score: 85 },
          { route: 'Andheri → Dadar', score: 91 },
          { route: 'Colaba → Worli', score: 64 }
        ],
        peakHourAnalysis: [
          { hour: 8, delay: 5 }, { hour: 9, delay: 12 }, { hour: 10, delay: 8 },
          { hour: 17, delay: 15 }, { hour: 18, delay: 20 }, { hour: 19, delay: 10 }
        ],
        patterns: ['Always late on Fridays (avg +15m)', 'Morning commutes are 30% more reliable than evening.'],
        costTrend: [
          { date: 'Mar 27', amount: 120 }, { date: 'Mar 28', amount: 150 },
          { date: 'Mar 29', amount: 95 }, { date: 'Mar 30', amount: 110 }
        ]
      });
      setRecommendations([
        { type: 'Time', title: 'Optimal Departure', suggestion: 'Leaving at 8:15 AM reduces your expected delay by 40%.', impact: 'High' },
        { type: 'Cost', title: 'Eco-Efficiency', suggestion: 'Switching to Metro on Tuesdays saves ₹450 monthly.', impact: 'Medium' }
      ]);
      setLoading(false);
    }, 1500);
  }, []);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-32 space-y-4">
        <motion.div animate={{ rotate: 360 }} transition={{ duration: 2, repeat: Infinity, ease: "linear" }}>
           <Zap className="w-12 h-12 text-primary" />
        </motion.div>
        <span className="text-xs font-headline font-black uppercase tracking-[0.4em] text-white/40">Analyzing City Pulse...</span>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-4 md:p-8 space-y-10">
      {/* Header & Export */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div>
           <h2 className="font-headline text-4xl font-black tracking-tight uppercase tracking-tighter">Commute Audit</h2>
           <p className="text-white/40 text-sm font-medium">90-Day kinetic flow performance report.</p>
        </div>
        <button className="bg-primary text-surface font-headline font-black px-6 py-3 rounded-2xl flex items-center gap-3 transition-all hover:scale-[1.02] shadow-[0_0_30px_rgba(255,191,0,0.3)]">
           <Download className="w-5 h-5" /> EXPORT PDF REPORT
        </button>
      </div>

      {/* KPI Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
         {[
           { icon: Clock, label: 'Avg Delay', value: `${stats?.avgDelay}m`, trend: '-12%', color: 'text-primary' },
           { icon: Zap, label: 'Efficiency', value: '84%', trend: '+4%', color: 'text-secondary' },
           { icon: CreditCard, label: 'Total Spent', value: '₹4,820', trend: '+₹210', color: 'text-white' },
           { icon: Calendar, label: 'Trips', value: '42', trend: 'Last 30d', color: 'text-white/60' }
         ].map((kpi, idx) => (
           <motion.div 
             key={idx}
             initial={{ opacity: 0, y: 20 }}
             animate={{ opacity: 1, y: 0 }}
             transition={{ delay: idx * 0.1 }}
             className="glass-card p-5 rounded-3xl border border-white/5"
           >
              <kpi.icon className={`w-5 h-5 mb-4 ${kpi.color}`} />
              <span className="block text-[10px] uppercase font-black tracking-widest text-white/30 mb-1">{kpi.label}</span>
              <div className="flex items-end justify-between">
                 <span className="text-2xl font-black">{kpi.value}</span>
                 <span className={`text-[10px] font-bold ${kpi.trend.includes('-') ? 'text-secondary' : 'text-primary'}`}>{kpi.trend}</span>
              </div>
           </motion.div>
         ))}
      </div>

      {/* Main Insights Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Reliability Chart */}
        <div className="lg:col-span-2 space-y-6">
           <div className="flex items-center justify-between px-2">
              <h3 className="font-headline text-xs font-black uppercase tracking-widest text-white/40 flex items-center gap-2">
                 <TrendingUp className="w-4 h-4 text-primary" /> Route Reliability Trends
              </h3>
              <div className="flex gap-4">
                 <div className="flex items-center gap-1.5"><div className="w-1.5 h-1.5 bg-primary rounded-full" /><span className="text-[9px] font-bold text-white/40">PREDICTED</span></div>
                 <div className="flex items-center gap-1.5"><div className="w-1.5 h-1.5 bg-secondary rounded-full" /><span className="text-[9px] font-bold text-white/40">ACTUAL</span></div>
              </div>
           </div>
           
           <div className="glass-card p-6 rounded-3xl min-h-[300px] relative overflow-hidden border border-white/10 shadow-2xl">
              <svg className="w-full h-48 overflow-visible mt-10">
                 {/* Reliability Line Chart */}
                 <path 
                   d={`M 0,100 L 100,20 L 200,80 L 300,30 L 400,60 L 500,40`}
                   className="fill-none stroke-primary/20" 
                   strokeWidth="2" 
                   strokeDasharray="5,5" 
                   vectorEffect="non-scaling-stroke"
                 />
                 <path 
                   d={`M 0,110 L 100,50 L 200,90 L 300,45 L 400,70 L 500,55`}
                   className="fill-none stroke-secondary" 
                   strokeWidth="3" 
                   strokeLinecap="round"
                   vectorEffect="non-scaling-stroke"
                 />
                 {/* Data Points */}
                 {[0, 100, 200, 300, 400, 500].map((x, i) => (
                    <circle key={i} cx={x} cy={110 - Math.random()*50} r="4" className="fill-surface stroke-secondary" strokeWidth="2" />
                 ))}
                 
                 {/* X Axis labels */}
                 <g className="text-[10px] font-bold fill-white/10 uppercase tracking-tighter">
                    <text x="0" y="160">MAR 24</text>
                    <text x="250" y="160">MAR 27</text>
                    <text x="500" y="160">TODAY</text>
                 </g>
              </svg>
              <div className="absolute inset-0 bg-gradient-to-t from-surface via-transparent to-transparent opacity-40" />
           </div>
           
           <div className="space-y-3">
              <h4 className="text-[10px] font-black tracking-widest text-white/20 uppercase px-2">Identified Performance Patterns</h4>
              {stats?.patterns.map((p, i) => (
                 <div key={i} className="flex items-center gap-4 bg-white/5 p-4 rounded-2xl border border-white/5">
                    <Info className="w-5 h-5 text-primary shrink-0" />
                    <p className="text-sm text-white/60 font-medium">{p}</p>
                 </div>
              ))}
           </div>
        </div>

        {/* Actionable Recommendations */}
        <div className="space-y-6">
           <h3 className="font-headline text-xs font-black uppercase tracking-widest text-red-400/60 flex items-center gap-2">
              <AlertCircle className="w-4 h-4" /> Personal Recommendations
           </h3>
           <div className="space-y-4">
              {recommendations.map((rec, i) => (
                 <motion.div 
                   key={i}
                   whileHover={{ scale: 1.02 }}
                   className="glass-card p-6 rounded-3xl border-2 border-white/5 relative overflow-hidden"
                 >
                    <div className="flex items-center justify-between mb-4">
                       <span className={`text-[10px] font-black uppercase px-2 py-1 rounded bg-white/5 ${rec.impact === 'High' ? 'text-primary' : 'text-secondary'}`}>
                          {rec.impact} Priority
                       </span>
                       {rec.type === 'Time' ? <Clock className="w-4 h-4 text-white/20" /> : <Shield className="w-4 h-4 text-white/20" />}
                    </div>
                    <h4 className="font-headline font-bold text-lg mb-2">{rec.title}</h4>
                    <p className="text-sm text-white/40 leading-relaxed font-medium mb-6">{rec.suggestion}</p>
                    <button className="w-full py-4 bg-surface-bright/40 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-white/5 transition-all">
                       Optimize Flow <ChevronRight className="w-4 h-4 inline" />
                    </button>
                 </motion.div>
              ))}
           </div>

           <div className="bg-primary/10 border border-primary/20 p-6 rounded-3xl space-y-4">
              <div className="flex items-center gap-3">
                 <FileText className="w-6 h-6 text-primary" />
                 <div>
                    <span className="block text-primary font-headline font-black text-xs uppercase tracking-widest">Master Audit</span>
                    <span className="text-[10px] text-white/40">MAR 2026</span>
                 </div>
              </div>
              <p className="text-xs text-white/40 leading-relaxed">
                 Your kinetic scoring has improved by <span className="text-primary font-bold">14%</span> compared to the average Mumbai commuter this month.
              </p>
           </div>
        </div>
      </div>
    </div>
  );
};

export default CommuteReplayDashboard;
