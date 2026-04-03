import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import { useDispatch, useSelector } from "react-redux";
import { io, Socket } from "socket.io-client";
import { 
  EyeOff, LifeBuoy, History, Zap, 
  Bell, Clock, GitBranch, Map
} from "lucide-react";
import JourneyPlanner from "./components/JourneyPlanner";
import GhostCommuteView from "./components/GhostCommuteView";
import CommuteReplayDashboard from "./components/CommuteReplayDashboard";
import RouteHeatmap from "./components/RouteHeatmap";
import RescueShieldView from "./components/RescueShieldView";
import RescueAlertOverlay from "./components/RescueAlertOverlay";
import { RootState, AppDispatch, setAlert } from "./store/journeySlice";

type View = 'flow' | 'routes' | 'alerts' | 'profile' | 'ghost' | 'plan' | 'history' | 'heatmap';

const ActionTile = ({ icon: Icon, title, subtitle, active = false, onClick }: any) => (
  <motion.div 
    whileHover={{ scale: 1.02 }}
    whileTap={{ scale: 0.98 }}
    onClick={onClick}
    className={`relative aspect-square rounded-2xl p-5 flex flex-col justify-between cursor-pointer group transition-all overflow-hidden border ${active ? 'border-primary/60' : 'border-primary/40'}`}
  >
    {/* Background gradient - Yellow themed */}
    <div className={`absolute inset-0 transition-all ${active ? 'bg-gradient-to-br from-primary/50 via-primary/20 to-primary/30' : 'bg-gradient-to-br from-primary/30 via-primary/15 to-primary/20'}`} />
    
    {/* Icon background */}
    <div className="absolute inset-0 flex items-center justify-center opacity-15 group-hover:opacity-25 transition-opacity">
      <Icon className="w-32 h-32 text-white" strokeWidth={0.5} />
    </div>
    
    {/* Content */}
    <div className="relative z-10" />
    <div className="relative z-10">
      <span className="block font-headline text-sm font-bold tracking-tight text-white">{title}</span>
      <span className="text-[10px] text-white/70 uppercase tracking-tighter">{subtitle}</span>
    </div>

    {/* Small icon in corner */}
    <div className="absolute top-4 right-4 z-10">
      <div className={`w-10 h-10 rounded-lg flex items-center justify-center backdrop-blur-sm ${active ? 'bg-white/30 border border-white/40' : 'bg-white/20 border border-white/30'}`}>
        <Icon className="w-5 h-5 text-surface" strokeWidth={1.5} />
      </div>
    </div>
  </motion.div>
);

const FlowView = ({ selectedRoute, onGhostClick, onRescueClick, onHistoryClick, onHeatmapClick }: any) => (
  <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} className="space-y-8">
    <section className="flex flex-col items-center justify-center pt-4">
      <div className="w-full max-w-sm rounded-3xl border border-white/10 bg-white/5 px-8 py-6 text-center backdrop-blur-sm">
        <p className="font-headline text-[10px] font-black uppercase tracking-[0.35em] text-white/35">Next commute</p>
        {selectedRoute ? (
          <>
            <p className="mt-2 font-headline text-4xl font-black tracking-tight text-primary">{selectedRoute.eta} min</p>
            <p className="mt-1 text-sm font-medium text-white/55">{selectedRoute.summary}</p>
            <p className="mt-2 text-[11px] text-white/40">
              ₹{selectedRoute.cost} · {selectedRoute.from} → {selectedRoute.to}
            </p>
          </>
        ) : (
          <p className="mt-3 text-sm text-white/55">Plan a route to unlock simulation, replay, and heatmaps.</p>
        )}
      </div>
      <p className="mt-4 max-w-[280px] text-center text-sm font-medium text-white/50">
        Commute Replay saves your trip history and surfaces personalized suggestions from it.
      </p>
    </section>

    <section>
      <div className="glass-card rounded-3xl p-6 shadow-2xl relative overflow-hidden border border-white/5">
        <div className="flex justify-between items-start mb-6">
          <div>
            <h2 className="font-headline text-2xl font-bold tracking-tight mb-1">{selectedRoute?.summary || 'Select a Route'}</h2>
            <div className="flex items-center gap-3 text-white/40 text-[10px] uppercase font-black tracking-widest">
              <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {selectedRoute?.eta || '--'} min</span>
              <span className="w-1 h-1 bg-white/20 rounded-full" />
              <span className="flex items-center gap-1">₹ {selectedRoute?.cost || '--'}</span>
            </div>
          </div>
          {selectedRoute && (
             <div className="bg-secondary/10 border border-secondary/30 px-3 py-1 rounded-full">
                <span className="text-[10px] font-black uppercase tracking-widest text-secondary">Optimized</span>
             </div>
          )}
        </div>
        <button 
          onClick={onGhostClick}
          className={`w-full py-5 font-headline font-black uppercase tracking-[0.2em] rounded-2xl transition-all
            ${selectedRoute ? 'bg-primary text-surface shadow-[0_0_30px_#ffbf0044] hover:scale-[1.02]' : 'bg-white/5 text-white/20 cursor-not-allowed'}`}
        >
          {selectedRoute ? 'Initiate Pulse Simulation' : 'Enter Departure Plan'}
        </button>
      </div>
    </section>

    <section className="grid grid-cols-2 gap-4 pb-8">
      <ActionTile icon={EyeOff} title="Ghost Commute" subtitle="Stimulate Flow" onClick={onGhostClick} active={!!selectedRoute} />
      <ActionTile icon={LifeBuoy} title="Rescue Shield" subtitle="Smart Backup" onClick={onRescueClick} />
      <ActionTile icon={History} title="Commute Replay" subtitle="History & tips" onClick={onHistoryClick} />
      <ActionTile icon={Map} title="Route Heatmap" subtitle="Traffic View" onClick={onHeatmapClick} />
    </section>
  </motion.div>
);

export default function App() {
  const dispatch = useDispatch<AppDispatch>();
  const { selectedRoute, results: allRoutes } = useSelector((state: RootState) => state.journey);
  
  const [view, setView] = useState<View>('flow');
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    const socketUrl = import.meta.env.VITE_SOCKET_URL || 'http://localhost:5000';
    const socket = io(socketUrl);
    socketRef.current = socket;
    return () => { socket.disconnect(); };
  }, []);

  useEffect(() => {
    const s = socketRef.current;
    if (!s) return;
    const jid = selectedRoute?.id;
    const join = () => {
      if (jid) s.emit("join_journey", jid);
    };
    join();
    s.on("connect", join);
    const onRescue = (payload: unknown) => dispatch(setAlert(payload));
    s.on("RES_MODE_ALERT", onRescue);
    return () => {
      s.off("connect", join);
      s.off("RES_MODE_ALERT", onRescue);
    };
  }, [selectedRoute?.id, dispatch]);

  const handleStartSimulation = () => {
    if (selectedRoute) {
      setView('ghost');
    } else {
      setView('plan');
    }
  };

  const NavButton = ({ active, onClick, icon: Icon, label, isMain = false }: any) => (
    <button
      type="button"
      onClick={onClick}
      className={`flex w-full flex-col items-center gap-1 transition-all lg:flex-row lg:items-center lg:justify-start lg:gap-3 lg:rounded-2xl lg:px-3 lg:py-2.5 lg:hover:bg-white/5 ${
        active ? 'text-primary lg:bg-primary/10' : 'text-white/70'
      }`}
    >
      <div
        className={`flex shrink-0 items-center justify-center ${
          isMain
            ? 'mb-1 rounded-full bg-primary p-3 text-surface shadow-[0_0_25px_#ffbf0088] lg:mb-0 lg:p-2.5'
            : 'lg:rounded-lg lg:bg-white/5 lg:p-2'
        }`}
      >
        <Icon size={isMain ? 26 : 22} className="lg:h-[22px] lg:w-[22px]" />
      </div>
      <span className="text-[10px] font-black uppercase leading-none tracking-widest lg:text-xs">{label}</span>
    </button>
  );

  return (
    <div className="min-h-screen font-sans text-white overflow-x-hidden selection:bg-primary/30 relative">
      <RescueAlertOverlay />
      <div className="fixed inset-0 -z-10 bg-surface" />
      <div className="fixed inset-0 -z-10 opacity-30 pointer-events-none grayscale contrast-125">
        <img className="w-full h-full object-cover" src="https://lh3.googleusercontent.com/aida-public/AB6AXuD8DHc3I2QiURDjUJHdCXDERSUaGwNroZWuw1yNm2pjEMoUgiXa9CuOR5H-1bGOciXmqudM9HkVKxLT5wQiEENIHTx-AIcVfiBZBv2bRGweDN8WWauj5QJbJayYEwwfsPx4_gFn-ORqFT2EQz0Z1tmjGTlzMbd7NrKiE5weBNqNAkxjHdMkLqeTUohT5fcGPt9SIk2bqLJyi884t8H0vPtPkQA20dOYIWyknQrHoxL2BmJPPZnWYVCHgsUnDQtBb0l85rPJbAfMHD8" alt="BG" />
        <div className="absolute inset-0 bg-gradient-to-b from-surface/60 via-surface/40 to-surface" />
      </div>

      <header className="fixed top-0 w-full z-50 flex justify-between items-center px-6 py-5 bg-surface/80 backdrop-blur-2xl border-b border-white/5">
        <div className="flex items-center gap-3 cursor-pointer hover:opacity-80 transition-opacity" onClick={() => setView('flow')}>
           <Zap className="text-primary w-5 h-5" />
           <h1 className="font-headline text-xs font-black uppercase tracking-[0.4em]">FlowCity Central</h1>
        </div>
        <div className="w-9 h-9 rounded-full overflow-hidden border border-white/10 p-0.5">
           <img src="https://lh3.googleusercontent.com/aida-public/AB6AXuBeJbicdu7M_jSdtCMYxqW3QBDtI13J1xuiExO7yNjZ4e-hgXZh73kCn_LrfWhMxmDyFtEVhR_A1si1tiuZlyg7uqhK4lvfUsHi-Q_BEM3PF6EByf1_Zt43utDSPjzk7efmSQvx1ng_cF8gmvm4ZMMVS8ZzTOfJ_pEsFq-QSfADSi2MPNGu43XD4cvquRXS2OkaqYwvb8c6YqWd3yQJzJ_40DO-aktnyHAIuWsqY7WJ18qErUkSQFsf6rybbru6h7z4ZVEEaGZfZH8" className="w-full h-full object-cover rounded-full" alt="Profile" />
        </div>
      </header>

      <main className="relative z-10 mx-auto w-full max-w-lg px-4 pb-40 pt-24 md:max-w-3xl md:px-8 md:pb-28 md:pt-28 lg:ml-52 lg:mr-auto lg:max-w-[1180px] lg:px-10 xl:max-w-[1280px]">
        <AnimatePresence mode="wait">
          {view === 'flow' && (
            <FlowView 
              key="flow"
              selectedRoute={selectedRoute} 
              onGhostClick={handleStartSimulation} 
              onRescueClick={() => setView('alerts')}
              onHistoryClick={() => setView('history')}
              onHeatmapClick={() => setView('heatmap')}
            />
          )}
          {view === 'ghost' && (
            <GhostCommuteView key="ghost" onBack={() => setView('flow')} />
          )}
          {view === 'plan' && <JourneyPlanner key="plan" onNavigate={() => setView('flow')} />}
          {view === 'history' && <CommuteReplayDashboard key="history" />}
          {view === 'alerts' && <RescueShieldView key="alerts" />}
          {view === 'heatmap' && (
            <div key="heatmap" className="w-full">
              <RouteHeatmap routes={allRoutes && allRoutes.length > 0 ? allRoutes : selectedRoute ? [selectedRoute] : []} selectedRoute={selectedRoute} />
            </div>
          )}
        </AnimatePresence>
      </main>

      <nav
        className="fixed bottom-8 left-1/2 z-50 flex w-[90%] max-w-md -translate-x-1/2 items-center justify-around rounded-full border border-white/10 bg-surface/60 p-3.5 shadow-[0_20px_50px_rgba(0,0,0,0.5)] backdrop-blur-3xl lg:bottom-auto lg:left-6 lg:top-28 lg:h-auto lg:max-h-none lg:w-48 lg:translate-x-0 lg:flex-col lg:items-stretch lg:gap-1 lg:rounded-3xl lg:p-3"
        aria-label="Primary"
      >
        <NavButton active={view === 'flow'} onClick={() => setView('flow')} icon={Zap} label="Flow" isMain />
        <NavButton active={view === 'plan'} onClick={() => setView('plan')} icon={GitBranch} label="Plan" />
        <NavButton active={view === 'alerts'} onClick={() => setView('alerts')} icon={Bell} label="Alerts" />
        <NavButton active={view === 'history'} onClick={() => setView('history')} icon={History} label="Replay" />
      </nav>
    </div>
  );
}
