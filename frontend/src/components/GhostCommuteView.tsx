
import React, { useMemo, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Clock, Zap, Shield, AlertTriangle, ChevronDown, 
  MapPin, Info, ArrowUpRight, CheckCircle2,
  Train, Car, Footprints
} from 'lucide-react';
import { RootState, AppDispatch, tickSimulation, switchActiveRoute } from '../store/journeySlice';

const GhostCommuteView: React.FC = () => {
  const dispatch = useDispatch<AppDispatch>();
  const { selectedRoute, results, activeJourneyProgress, isSimulationRunning } = useSelector((state: RootState) => state.journey);

  // Simulation Ticker
  useEffect(() => {
    if (isSimulationRunning && activeJourneyProgress < 100) {
      const timer = setInterval(() => dispatch(tickSimulation()), 1000);
      return () => clearInterval(timer);
    }
  }, [isSimulationRunning, activeJourneyProgress, dispatch]);

  const timelineData = useMemo(() => {
    if (!selectedRoute) return [];
    let currentTime = 0;
    return selectedRoute.segments.map(seg => {
      const start = currentTime;
      currentTime += seg.duration;
      return { ...seg, start, end: currentTime };
    });
  }, [selectedRoute]);

  const totalTime = selectedRoute?.eta || 60;
  const alternatives = results.filter(r => r.id !== selectedRoute?.id).slice(0, 2);

  const getStatusColor = (progress: number, start: number, end: number) => {
    if (progress >= (end / totalTime) * 100) return 'bg-secondary shadow-[0_0_12px_#13FF43]';
    if (progress >= (start / totalTime) * 100) return 'bg-primary animate-pulse shadow-[0_0_15px_#ffbf00]';
    return 'bg-white/10';
  };

  if (!selectedRoute) return null;

  return (
    <div className="max-w-4xl mx-auto p-4 md:p-8 space-y-10 min-h-screen">
      {/* Simulation Master Header */}
      <motion.div 
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass-card p-6 rounded-3xl border-2 border-primary/20 relative overflow-hidden amber-glow"
      >
        <div className="flex justify-between items-center relative z-10">
          <div>
            <div className="flex items-center gap-2 mb-1">
               <span className="flex items-center gap-1.5 text-secondary text-[10px] font-black uppercase tracking-[0.3em]">
                 <CheckCircle2 className="w-3 h-3" /> Live Simulation Active
               </span>
            </div>
            <h2 className="font-headline text-4xl font-black tracking-tight uppercase tracking-tighter">
              {selectedRoute.summary}
            </h2>
          </div>
          <div className="text-right">
             <span className="text-[10px] font-bold text-white/30 uppercase tracking-widest block">Flow Progress</span>
             <span className="text-3xl font-black text-primary">{activeJourneyProgress}%</span>
          </div>
        </div>

        {/* Timeline Visualization System */}
        <div className="mt-12 relative pb-10">
          <svg className="w-full h-24 overflow-visible">
            {/* Uncertainty Band (±σ) */}
            <path
              d={`M 0,40 
                  ${timelineData.map(seg => `L ${(seg.end / totalTime) * 100}%,${35 + (seg.trustScore || 10) / 10}`).join(' ')} 
                  ${timelineData.reverse().map(seg => `L ${(seg.end / totalTime) * 100}%,${45 - (seg.trustScore || 10) / 10}`).join(' ')} Z`}
              className="fill-primary/5 stroke-none blur-sm"
              style={{ filter: 'drop-shadow(0 0 8px rgba(255,191,0,0.1))' }}
            />
            
            {/* Base Timeline Track */}
            <line x1="0" y1="40" x2="100%" y2="40" stroke="rgba(255,255,255,0.05)" strokeWidth="4" strokeLinecap="round" />
            
            {/* Progress Fill */}
            <motion.line 
              x1="0" y1="40" 
              x2={`${activeJourneyProgress}%`} 
              y2="40" 
              className="stroke-primary shadow-glow" 
              strokeWidth="4" 
              strokeLinecap="round" 
            />

            {/* Segment Junctions & Markers */}
            {timelineData.map((seg, i) => (
              <g key={i}>
                <circle 
                  cx={`${(seg.end / totalTime) * 100}%`} 
                  cy="40" 
                  r="6" 
                  className={activeJourneyProgress >= (seg.end / totalTime) * 100 ? 'fill-secondary' : 'fill-surface-bright stroke-white/20'}
                  strokeWidth="2"
                />
                {seg.duration > 15 && (
                  <text 
                    x={`${(seg.start / totalTime + seg.duration / (2 * totalTime)) * 100}%`} 
                    y="65" 
                    textAnchor="middle" 
                    className="fill-white/20 text-[8px] font-black uppercase tracking-widest"
                  >
                    {seg.mode}
                  </text>
                )}
              </g>
            ))}

            {/* Progress Head */}
            <motion.g animate={{ x: `${activeJourneyProgress}%` }}>
               <circle r="12" cy="40" className="fill-primary animate-pulse blur-md opacity-40" />
               <circle r="6" cy="40" className="fill-surface stroke-primary" strokeWidth="3" />
            </motion.g>
          </svg>

          {/* Time axis text */}
          <div className="flex justify-between mt-2 px-1">
             <span className="text-[10px] font-bold text-white/30 uppercase tracking-widest">0m</span>
             <span className="text-[10px] font-bold text-white/30 uppercase tracking-widest">30m</span>
             <span className="text-[10px] font-bold text-white/30 uppercase tracking-widest">{totalTime}m</span>
          </div>
        </div>
      </motion.div>

      {/* Segment Intensity & Details */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-4">
          <h3 className="font-headline text-xs font-black uppercase tracking-[0.4em] text-white/30 px-2 flex items-center gap-2">
            <Zap className="w-4 h-4 text-primary fill-primary" /> Multi-Leg Breakdown
          </h3>
          {timelineData.map((seg, i) => (
            <motion.div 
              key={i}
              className="glass-card p-4 rounded-2xl flex items-center justify-between border border-white/5 hover:bg-surface-bright/20 transition-all cursor-pointer group"
            >
              <div className="flex items-center gap-4">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${getStatusColor(activeJourneyProgress, seg.start, seg.end)}`}>
                   {seg.mode === 'Metro' ? <Train className="w-5 h-5 text-surface" /> : seg.mode === 'Walk' ? <Footprints className="w-5 h-5 text-surface" /> : <Car className="w-5 h-5 text-surface" />}
                </div>
                <div>
                   <p className="font-headline font-bold text-sm tracking-tight">{seg.instructions}</p>
                   <span className="text-[10px] text-white/40 uppercase font-black tracking-widest">{seg.duration} min • {seg.mode}</span>
                </div>
              </div>
              <ChevronDown className="w-4 h-4 text-white/10 group-hover:text-primary" />
            </motion.div>
          ))}
        </div>

        {/* Rescue Shield: Alternatives */}
        <div className="space-y-4">
           <h3 className="font-headline text-xs font-black uppercase tracking-[0.4em] text-red-400/60 px-2 flex items-center gap-2">
            <Shield className="w-4 h-4 text-red-500 fill-red-500" /> Rescue Alternatives
          </h3>
          <div className="space-y-3">
            {alternatives.map((alt) => (
              <div 
                key={alt.id}
                className="glass-card p-5 rounded-2xl border-2 border-white/5 hover:border-primary/40 transition-all group"
              >
                <div className="flex justify-between mb-4">
                   <div>
                     <span className="block text-lg font-headline font-black">{alt.summary}</span>
                     <span className="text-xs text-white/40">Switch impact: <span className={alt.eta < selectedRoute.eta ? 'text-secondary font-bold' : 'text-white/60'}>{alt.eta - activeJourneyProgress}m left</span></span>
                   </div>
                   <div className="text-right">
                      <span className="block text-lg font-headline font-black text-primary">₹ {alt.cost}</span>
                      <div className="flex items-center gap-1 text-[9px] text-white/20 uppercase font-black tracking-tighter">
                        <AlertTriangle className="w-3 h-3 text-red-500" /> High Reliability
                      </div>
                   </div>
                </div>
                <button 
                  onClick={() => dispatch(switchActiveRoute(alt.id))}
                  className="w-full bg-white/5 group-hover:bg-primary group-hover:text-surface font-headline font-black text-[10px] uppercase py-3 rounded-xl transition-all tracking-[0.2em]"
                >
                  Switch Connection Now
                </button>
              </div>
            ))}
          </div>

          {/* Quick Context Card */}
          <div className="bg-red-500/10 border border-red-500/20 p-5 rounded-3xl mt-6 relative overflow-hidden">
             <div className="flex items-start gap-4 relative z-10">
                <AlertTriangle className="w-6 h-6 text-red-500 animate-pulse shrink-0" />
                <div>
                   <span className="block text-red-500 font-headline font-black text-xs uppercase tracking-widest mb-1">Delay Hazard Zone</span>
                   <p className="text-xs text-red-200/60 leading-relaxed font-medium">
                     Track signaling disruption reported near Lower Parel. Probability of missing next transit connection at Dadar Junction is <span className="text-red-400 font-black">24%</span>.
                   </p>
                </div>
             </div>
             <div className="absolute top-0 right-0 w-24 h-24 bg-red-500/5 blur-3xl rounded-full" />
          </div>
        </div>
      </div>
    </div>
  );
};

export default GhostCommuteView;
