
import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useDispatch, useSelector } from 'react-redux';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Search, MapPin, Calendar, Clock, ChevronRight, 
  Shield, Zap, Leaf, AlertTriangle, Play,
  Train, Car, Info
} from 'lucide-react';
import { RootState, AppDispatch, fetchRoutes, selectRoute, updateSearchParams } from '../store/journeySlice';

const JourneyPlanner: React.FC<{ onNavigate?: () => void }> = ({ onNavigate }) => {
  const dispatch = useDispatch<AppDispatch>();
  const { results, selectedRoute, loading, searchParams } = useSelector((state: RootState) => state.journey);
  const [isExpanded, setIsExpanded] = useState<string | null>(null);
  const [fromSuggestions, setFromSuggestions] = useState<Array<{name:string;lat:number;lng:number}>>([]);
  const [toSuggestions, setToSuggestions] = useState<Array<{name:string;lat:number;lng:number}>>([]);
  const [showFromSuggestions, setShowFromSuggestions] = useState(false);
  const [showToSuggestions, setShowToSuggestions] = useState(false);

  const fetchAutocomplete = async (query: string, type: 'from' | 'to') => {
    const trimmed = query.trim();
    if (!trimmed) {
      if (type === 'from') setFromSuggestions([]); else setToSuggestions([]);
      return;
    }

    try {
      const res = await axios.get('http://localhost:5000/api/geocode/autocomplete', { params: { q: trimmed } });
      const suggestions = (res.data?.data?.suggestions || []).slice(0, 8);
      if (type === 'from') setFromSuggestions(suggestions); else setToSuggestions(suggestions);
    } catch (err) {
      console.warn('Autocomplete fetch error:', err);
      if (type === 'from') setFromSuggestions([]); else setToSuggestions([]);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => fetchAutocomplete(searchParams.from || '', 'from'), 250);
    return () => clearTimeout(timer);
  }, [searchParams.from]);

  useEffect(() => {
    const timer = setTimeout(() => fetchAutocomplete(searchParams.to || '', 'to'), 250);
    return () => clearTimeout(timer);
  }, [searchParams.to]);

  const handleSearch = () => {
    dispatch(fetchRoutes(searchParams));
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-secondary border-secondary/20 bg-secondary/10';
    if (score >= 60) return 'text-yellow-400 border-yellow-400/20 bg-yellow-400/10';
    return 'text-red-500 border-red-500/20 bg-red-500/10';
  };

  const getScoreGlow = (score: number) => {
    if (score >= 80) return 'shadow-[0_0_20px_rgba(19,255,67,0.2)]';
    if (score >= 60) return 'shadow-[0_0_20px_rgba(250,204,21,0.2)]';
    return 'shadow-[0_0_20px_rgba(239,68,68,0.2)]';
  };

  return (
    <div className="max-w-4xl mx-auto p-4 md:p-8 space-y-8 min-h-screen">
      {/* Search Header */}
      <motion.div 
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass-card p-6 rounded-3xl amber-glow"
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="relative group">
            <MapPin className="absolute left-4 top-12 -translate-y-1/2 text-primary w-5 h-5 group-hover:drop-shadow-[0_0_8px_rgba(255,191,0,0.4)] transition-all" />
            <label className="text-xs font-headline tracking-widest text-white/40 mb-2 block px-4 uppercase">Departure</label>
            <input 
              type="text" 
              placeholder="e.g. Bandra West"
              className="w-full bg-surface-bright/30 border border-white/5 rounded-2xl py-4 pl-12 pr-4 focus:outline-none focus:border-primary/50 transition-all font-medium"
              value={searchParams.from}
              onChange={(e) => dispatch(updateSearchParams({ from: e.target.value }))}
              onFocus={() => setShowFromSuggestions(true)}
              onBlur={() => setTimeout(() => setShowFromSuggestions(false), 150)}
            />
            {showFromSuggestions && fromSuggestions.length > 0 && (
              <div className="absolute left-0 right-0 mt-1 bg-surface/95 border border-white/10 shadow-xl z-20 rounded-xl max-h-64 overflow-y-auto">
                {fromSuggestions.map((item) => (
                  <button
                    key={item.name}
                    onMouseDown={(e) => { e.preventDefault(); dispatch(updateSearchParams({ from: item.name })); setShowFromSuggestions(false); }}
                    className="w-full text-left px-3 py-2 hover:bg-white/10 transition-colors"
                  >
                    <span className="font-semibold">{item.name}</span>
                    <span className="block text-xs text-white/50">{item.lat.toFixed(4)}, {item.lng.toFixed(4)}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className="relative group">
            <Search className="absolute left-4 top-12 -translate-y-1/2 text-white/20 w-5 h-5" />
            <label className="text-xs font-headline tracking-widest text-white/40 mb-2 block px-4 uppercase">Destination</label>
            <input 
              type="text" 
              placeholder="e.g. World Trade Centre"
              className="w-full bg-surface-bright/30 border border-white/5 rounded-2xl py-4 pl-12 pr-4 focus:outline-none focus:border-primary/50 transition-all font-medium"
              value={searchParams.to}
              onChange={(e) => dispatch(updateSearchParams({ to: e.target.value }))}
              onFocus={() => setShowToSuggestions(true)}
              onBlur={() => setTimeout(() => setShowToSuggestions(false), 150)}
            />
            {showToSuggestions && toSuggestions.length > 0 && (
              <div className="absolute left-0 right-0 mt-1 bg-surface/95 border border-white/10 shadow-xl z-20 rounded-xl max-h-64 overflow-y-auto">
                {toSuggestions.map((item) => (
                  <button
                    key={item.name}
                    onMouseDown={(e) => { e.preventDefault(); dispatch(updateSearchParams({ to: item.name })); setShowToSuggestions(false); }}
                    className="w-full text-left px-3 py-2 hover:bg-white/10 transition-colors"
                  >
                    <span className="font-semibold">{item.name}</span>
                    <span className="block text-xs text-white/50">{item.lat.toFixed(4)}, {item.lng.toFixed(4)}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6">
           <div className="flex items-center gap-3 bg-surface-bright/20 rounded-xl p-3 border border-white/5 cursor-pointer" onClick={() => {
             const now = new Date();
             dispatch(updateSearchParams({ time: now.toISOString() }));
           }}>
             <Calendar className="w-4 h-4 text-primary" />
             <span className="text-sm font-medium">Set Now</span>
           </div>
           <div className="flex items-center gap-3 bg-surface-bright/20 rounded-xl p-3 border border-white/5 cursor-pointer" onClick={() => {
             const today = new Date();
             today.setHours(9,0,0,0);
             dispatch(updateSearchParams({ time: today.toISOString() }));
           }}>
             <Clock className="w-4 h-4 text-primary" />
             <span className="text-sm font-medium">Set 09:00</span>
           </div>
         </div>

         <div className="grid grid-cols-2 gap-4 mt-4">
           <div className="flex flex-col gap-2">
             <label className="text-xs font-headline tracking-widest text-white/40 uppercase">Travel Date</label>
             <input
               type="date"
               className="w-full bg-surface-bright/30 border border-white/5 rounded-lg p-2 focus:outline-none focus:border-primary/50"
               value={searchParams.time ? new Date(searchParams.time).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10)}
               onChange={(e) => {
                 const d = e.target.value;
                 const current = searchParams.time ? new Date(searchParams.time) : new Date();
                 const [h, m] = [current.getHours(), current.getMinutes()];
                 const updated = new Date(`${d}T${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:00`);
                 dispatch(updateSearchParams({ time: updated.toISOString() }));
               }}
             />
           </div>

           <div className="flex flex-col gap-2">
             <label className="text-xs font-headline tracking-widest text-white/40 uppercase">Travel Time</label>
             <input
               type="time"
               className="w-full bg-surface-bright/30 border border-white/5 rounded-lg p-2 focus:outline-none focus:border-primary/50"
               value={searchParams.time ? new Date(searchParams.time).toTimeString().slice(0, 5) : new Date().toTimeString().slice(0, 5)}
               onChange={(e) => {
                 const t = e.target.value;
                 const current = searchParams.time ? new Date(searchParams.time) : new Date();
                 const [h, m] = t.split(':').map(Number);
                 const updated = new Date(current);
                 updated.setHours(h, m, 0, 0);
                 dispatch(updateSearchParams({ time: updated.toISOString() }));
               }}
             />
           </div>
         </div>

         <div className="col-span-full flex flex-wrap gap-2 mt-4">
           {['Safety', 'Time', 'Cost'].map((pref) => (
             <button
               key={pref}
               onClick={() => dispatch(updateSearchParams({ preference: pref }))}
               className={`py-2 px-3 rounded-lg text-xs font-bold transition-all ${
                 searchParams.preference === pref 
                   ? 'bg-primary text-surface shadow-lg' 
                   : 'text-white/40 hover:text-white/70'
               }`}
             >
               {pref}
             </button>
           ))}
         </div>

        <button 
          onClick={handleSearch}
          disabled={loading}
          className="w-full mt-6 bg-primary hover:bg-yellow-400 text-surface font-headline font-bold py-4 rounded-2xl flex items-center justify-center gap-3 transition-all active:scale-[0.98] disabled:opacity-50"
        >
          {loading ? 'CALCULATING TRUST...' : 'FIND OPTIMAL ROUTES'}
          {!loading && <ChevronRight className="w-5 h-5" />}
        </button>
      </motion.div>

      {/* Results Feed */}
      <AnimatePresence mode="popLayout">
        <div className="space-y-4">
          {results.map((route, idx) => (
            <motion.div
              layout
              key={route.id}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ delay: idx * 0.1 }}
              onClick={() => dispatch(selectRoute(route))}
              className={`glass-card p-5 rounded-3xl cursor-pointer transition-all border ${
                selectedRoute?.id === route.id ? 'border-primary shadow-[0_0_40px_rgba(255,191,0,0.1)]' : 'border-white/5'
              } hover:bg-surface-bright/20`}
            >
              <div className="flex items-start justify-between">
                <div className="flex gap-4">
                  <div className={`p-4 rounded-2xl bg-surface-bright/40 ${selectedRoute?.id === route.id ? 'text-primary' : 'text-white/40'}`}>
                    {route.mode === 'Metro' ? <Train className="w-6 h-6" /> : <Car className="w-6 h-6" />}
                  </div>
                  <div>
                    <h3 className="font-headline font-bold text-lg mb-1">{route.summary}</h3>
                    <div className="flex items-center gap-4 text-sm text-white/40 font-medium">
                      <span className="flex items-center gap-1"><Clock className="w-4 h-4" /> {route.eta} min</span>
                      <span className="flex items-center gap-1">₹ {route.cost}</span>
                      <span className="flex items-center gap-1 text-secondary"><Shield className="w-4 h-4" /> {route.safetyRating}% Solid</span>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-2 text-[10px]">
                      {route.dataSources?.map((source) => (
                        <span key={`${route.id}-${source}`} className="px-2 py-1 rounded-full bg-white/10 text-white/80 border border-white/20">
                          {source.includes('fallback') ? 'Fallback' : source.includes('OpenRoute') ? 'Live ORS' : source}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>

                <div className={`w-16 h-16 rounded-full border-2 flex flex-col items-center justify-center ${getScoreColor(route.trustScore)} ${getScoreGlow(route.trustScore)}`}>
                  <span className="text-xl font-bold leading-none">{route.trustScore}</span>
                  <span className="text-[8px] font-black uppercase tracking-tighter">TRUST</span>
                </div>
              </div>

              {/* Simulation Expansion */}
              <AnimatePresence>
                {selectedRoute?.id === route.id && (
                  <motion.div 
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="overflow-hidden mt-6 pt-6 border-t border-white/5"
                  >
                    <div className="space-y-6">
                      <div className="flex items-center justify-between">
                        <label className="text-[10px] font-headline font-black tracking-widest text-white/30 uppercase flex items-center gap-2">
                          <Play className="w-3 h-3 text-primary fill-primary" /> Ghost Commute Prediction Band
                        </label>
                        <div className="flex gap-2">
                           <div className="px-2 py-1 rounded-md bg-secondary/10 border border-secondary/20 text-[10px] text-secondary font-bold">RELIABLE</div>
                           <div className="px-2 py-1 rounded-md bg-white/5 text-[10px] text-white/40 font-bold">ETA RANGE: ±{Math.floor(route.eta * 0.1)}m</div>
                        </div>
                      </div>

                      {/* Prediction Timeline */}
                      <div className="relative h-20 bg-surface-bright/20 rounded-2xl overflow-hidden p-4">
                        <div className="absolute inset-0 bg-gradient-to-r from-primary/5 via-primary/20 to-primary/5 opacity-50" />
                        <motion.div 
                          initial={{ width: '0%' }}
                          animate={{ width: '100%' }}
                          transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                          className="absolute bottom-0 left-0 h-[2px] bg-primary/40"
                        />
                        <div className="flex items-center justify-between relative z-10 h-full px-4">
                          {[20, 40, 60, 80, 100].map(p => (
                            <div key={p} className="flex flex-col items-center gap-2">
                              <div className={`w-1 h-3 rounded-full ${p < 80 ? 'bg-primary' : 'bg-primary/20'}`} />
                              <span className="text-[9px] font-headline font-bold text-white/20">{p}%</span>
                            </div>
                          ))}
                        </div>
                        {/* Uncertainty Band UI Overlay */}
                        <motion.div 
                          animate={{ opacity: [0.1, 0.4, 0.1], scaleY: [1, 1.2, 1] }}
                          transition={{ duration: 3, repeat: Infinity }}
                          className="absolute top-1/2 left-[40%] -translate-y-1/2 w-[30%] h-12 bg-primary/20 blur-xl rounded-full"
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div className="bg-white/5 p-4 rounded-2xl">
                           <div className="flex items-center gap-2 text-primary mb-2">
                              <Info className="w-4 h-4" />
                              <span className="text-[10px] font-bold uppercase tracking-widest text-white/60">Risk Factors</span>
                           </div>
                           <p className="text-xs text-white/40 leading-relaxed">
                             Platform 1 crowd density expected at 85%. Minor track signaling delay reported near Parel.
                           </p>
                        </div>
                        <button 
                          onClick={(e) => { e.stopPropagation(); if(onNavigate) onNavigate(); }}
                          className="bg-secondary text-surface font-headline font-black py-4 rounded-2xl flex items-center justify-center gap-2 hover:scale-[1.02] transition-transform"
                        >
                          NAVIGATE NOW <Zap className="w-5 h-5 fill-surface" />
                        </button>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          ))}
        </div>
      </AnimatePresence>
    </div>
  );
};

export default JourneyPlanner;
