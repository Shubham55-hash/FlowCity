
import React, { useMemo, useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { motion, AnimatePresence } from 'motion/react';
import { io } from 'socket.io-client';
import { 
  Clock, Zap, Shield, AlertTriangle, ChevronDown, 
  MapPin, Info, ArrowUpRight, CheckCircle2,
  Train, Car, Footprints, Bus, X, RefreshCw
} from 'lucide-react';
import { 
  RootState, 
  AppDispatch, 
  tickSimulation, 
  switchActiveRoute,
  setAlert,
  clearAlert
} from '../store/journeySlice';

const GhostCommuteView: React.FC = () => {
  const dispatch = useDispatch<AppDispatch>();
  const { 
    selectedRoute, 
    results, 
    activeJourneyProgress, 
    isSimulationRunning,
    activeAlert 
  } = useSelector((state: RootState) => state.journey);

  // Socket.io Connection
  useEffect(() => {
    if (!selectedRoute?.id) return;

    const socket = io('http://localhost:5000');
    
    socket.emit('join_journey', selectedRoute.id);
    console.log(`🔌 Connected to socket for journey: ${selectedRoute.id}`);

    socket.on('RES_MODE_ALERT', (alert) => {
      console.log('🚨 Rescue Alert Received:', alert);
      dispatch(setAlert(alert));
    });

    socket.on('PLAN_UPDATED', (data) => {
       console.log('✅ Plan Update Confirmed:', data);
    });

    return () => {
      socket.disconnect();
    };
  }, [selectedRoute?.id, dispatch]);

  // Simulation Ticker
  useEffect(() => {
    if (isSimulationRunning && activeJourneyProgress < 100 && !activeAlert) {
      const timer = setInterval(() => dispatch(tickSimulation()), 1000);
      return () => clearInterval(timer);
    }
  }, [isSimulationRunning, activeJourneyProgress, activeAlert, dispatch]);

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

  const handleRescueSwitch = (option: any) => {
    // Map the backend option.route to the frontend Route type
    const mappedRoute = {
        id: option.id,
        mode: 'Multi-Modal',
        from: selectedRoute?.from || '',
        to: selectedRoute?.to || '',
        trustScore: option.safetyScore,
        status: option.safetyScore > 80 ? 'Safe' : 'Moderate',
        eta: option.route.totalTimeMin,
        cost: option.costDiff > 0 ? 300 : 20,
        safetyRating: option.safetyScore,
        summary: option.label,
        segments: option.route.segments.map((s: any) => ({
            mode: s.type === 'walk' ? 'Walk' : s.type === 'local_train' ? 'Train' : 'Car',
            duration: s.predictedDurationMin,
            instructions: `${s.from} to ${s.to}`
        }))
    };
    dispatch(switchActiveRoute(mappedRoute));
  };

  if (!selectedRoute) return null;

  return (
    <div className="max-w-4xl mx-auto p-4 md:p-8 space-y-10 min-h-screen relative">
      {/* Rescue Alert Overlay */}
      <AnimatePresence>
        {activeAlert && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md"
          >
            <motion.div 
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              className="bg-surface-bright/90 border-2 border-red-500/50 rounded-[2.5rem] p-8 max-w-2xl w-full shadow-2xl relative overflow-hidden"
            >
              <div className="absolute top-0 left-0 w-full h-1 bg-red-500/20">
                 <motion.div 
                    initial={{ width: "100%" }}
                    animate={{ width: "0%" }}
                    transition={{ duration: 60, ease: "linear" }}
                    className="h-full bg-red-500"
                 />
              </div>

              <div className="flex justify-between items-start mb-8">
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 rounded-2xl bg-red-500/20 flex items-center justify-center border border-red-500/30">
                    <AlertTriangle className="w-8 h-8 text-red-500 animate-pulse" />
                  </div>
                  <div>
                    <h2 className="text-3xl font-black font-headline uppercase tracking-tighter text-red-500">Rescue Mode Engaged</h2>
                    <p className="text-white/60 text-sm font-medium">{activeAlert.disruption.description}</p>
                  </div>
                </div>
                <button 
                    onClick={() => dispatch(clearAlert())}
                    className="p-2 hover:bg-white/5 rounded-full transition-colors"
                >
                    <X className="w-6 h-6 text-white/20" />
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
                {activeAlert.options.map((opt: any) => (
                  <motion.div 
                    key={opt.id}
                    whileHover={{ scale: 1.02 }}
                    className={`p-6 rounded-3xl border-2 transition-all cursor-pointer ${opt.rank === 1 ? 'border-primary bg-primary/5' : 'border-white/5 bg-white/5'}`}
                    onClick={() => handleRescueSwitch(opt)}
                  >
                    <div className="flex flex-col h-full justify-between">
                      <div>
                        <span className="block text-[10px] font-black uppercase tracking-widest text-white/30 mb-2">Option 0{opt.rank}</span>
                        <h3 className="font-headline font-black text-xl mb-1 leading-tight">{opt.label}</h3>
                        <p className="text-[10px] text-white/40 font-bold uppercase tracking-widest">
                           {opt.timeImpactMin > 0 ? `+${opt.timeImpactMin}min` : `${opt.timeImpactMin}min`} vs Current
                        </p>
                      </div>
                      
                      <div className="mt-6 space-y-2">
                        <div className="flex justify-between text-[9px] uppercase font-black">
                           <span className="text-white/40">Reliability</span>
                           <span className={opt.safetyScore > 80 ? 'text-secondary' : 'text-primary'}>{opt.safetyScore}%</span>
                        </div>
                        <div className="flex justify-between text-[9px] uppercase font-black">
                           <span className="text-white/40">Est. Cost</span>
                           <span className="text-secondary">₹{Math.round(opt.totalPredictedCost)}</span>
                        </div>
                        <div className="flex justify-between text-[7px] uppercase font-black">
                           <span className={opt.costDiff < 0 ? 'text-secondary' : 'text-primary/60'}>
                             {opt.costDiff > 0 ? `+₹${Math.round(opt.costDiff)} hike` : `₹${Math.abs(Math.round(opt.costDiff))} saved`}
                           </span>
                        </div>
                      </div>
                      
                      <button className="w-full mt-6 py-3 bg-white/5 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-primary hover:text-surface transition-all">
                        Select Path
                      </button>
                    </div>
                  </motion.div>
                ))}
              </div>

              <p className="text-center text-[10px] font-black uppercase tracking-[0.3em] text-white/20">
                Automatic fallback in 60s • Decision required immediately
              </p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

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
                   {seg.mode === 'Metro' ? <Train className="w-5 h-5 text-surface" /> : seg.mode === 'Wait' ? <Clock className="w-5 h-5 text-surface" /> : seg.mode === 'Walk' ? <Footprints className="w-5 h-5 text-surface" /> : seg.mode === 'Train' ? <Train className="w-5 h-5 text-surface" /> : seg.mode === 'Bus' ? <Bus className="w-5 h-5 text-surface" /> : <Car className="w-5 h-5 text-surface" />}
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

        {/* Alternatives & Disruption Status */}
        <div className="space-y-4">
           <h3 className="font-headline text-xs font-black uppercase tracking-[0.4em] text-red-400/60 px-2 flex items-center gap-2">
            <Shield className="w-4 h-4 text-red-500 fill-red-500" /> Active Rescue Shield
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
                     <span className="text-xs text-white/40">Sync impact: <span className={alt.eta < selectedRoute.eta ? 'text-secondary font-bold' : 'text-white/60'}>{alt.eta} min journey</span></span>
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
                  Reroute Option
                </button>
              </div>
            ))}
          </div>

          <motion.div 
            animate={{ opacity: [0.5, 1, 0.5] }}
            transition={{ duration: 4, repeat: Infinity }}
            className="bg-red-500/10 border border-red-500/20 p-5 rounded-3xl mt-6 relative overflow-hidden"
          >
             <div className="flex items-start gap-4 relative z-10">
                <Shield className="w-6 h-6 text-red-500 shrink-0" />
                <div>
                   <span className="block text-red-500 font-headline font-black text-xs uppercase tracking-widest mb-1">Rescue Protocol Active</span>
                   <p className="text-xs text-red-200/60 leading-relaxed font-medium">
                     Monitoring your flow for real-time disruptions. Rescue Mode will engage automatically if a delay spike is detected.
                   </p>
                </div>
             </div>
             <div className="absolute top-0 right-0 w-24 h-24 bg-red-500/5 blur-3xl rounded-full" />
          </motion.div>
        </div>
      </div>
    </div>
  );
};

export default GhostCommuteView;
