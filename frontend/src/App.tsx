import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import { useDispatch, useSelector } from "react-redux";
import { io, Socket } from "socket.io-client";
import { 
  EyeOff, LifeBuoy, ShieldCheck, History, Zap, 
  Bell, User, Clock, GitBranch, 
  CloudSun, ChevronRight, AlertTriangle, CheckCircle2
} from "lucide-react";
import JourneyPlanner from "./components/JourneyPlanner";
import GhostCommuteView from "./components/GhostCommuteView";
import CommuteReplayDashboard from "./components/CommuteReplayDashboard";
import { RootState, AppDispatch } from "./store/journeySlice";

type View = 'flow' | 'routes' | 'alerts' | 'profile' | 'ghost' | 'safety-map' | 'plan' | 'history';

const TrustScore = ({ score }: { score: number }) => {
  const radius = 110;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;

  return (
    <div className="relative flex items-center justify-center w-64 h-64">
      <svg className="absolute inset-0 w-full h-full -rotate-90">
        <circle className="text-white/5" cx="128" cy="128" fill="transparent" r={radius} stroke="currentColor" strokeWidth="4" />
        <motion.circle
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 1.5, ease: "easeOut" }}
          className="drop-shadow-[0_0_12px_#ffbf0088]"
          cx="128" cy="128" fill="transparent" r={radius} stroke="#FFBF00" strokeDasharray={circumference} strokeLinecap="round" strokeWidth="12"
        />
      </svg>
      <div className="text-center">
        <motion.span initial={{ opacity: 0, scale: 0.5 }} animate={{ opacity: 1, scale: 1 }} className="block font-headline text-7xl font-black text-primary tracking-tighter">{score}</motion.span>
        <span className="block font-headline text-xs uppercase tracking-[0.3em] text-white/40">TrustScore</span>
      </div>
      <div className="absolute top-4 left-1/2 -translate-x-1/2 w-2 h-2 bg-secondary rounded-full animate-pulse shadow-[0_0_8px_#13FF43]" />
    </div>
  );
};

const ActionTile = ({ icon: Icon, title, subtitle, active = false, onClick }: any) => (
  <motion.div 
    whileHover={{ scale: 1.02 }}
    whileTap={{ scale: 0.98 }}
    onClick={onClick}
    className={`bg-surface-container aspect-square rounded-2xl p-5 flex flex-col justify-between cursor-pointer group transition-all hover:bg-surface-bright border border-white/5 ${active ? 'border-primary/40' : ''}`}
  >
    <Icon className={`w-8 h-8 ${active ? 'text-primary' : 'text-white/40'}`} />
    <div>
      <span className="block font-headline text-sm font-bold tracking-tight">{title}</span>
      <span className="text-[10px] text-white/40 uppercase tracking-tighter">{subtitle}</span>
    </div>
  </motion.div>
);

const FlowView = ({ score, selectedRoute, onGhostClick, onSafetyMapClick, onRescueClick, onHistoryClick }: any) => (
  <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} className="space-y-8">
    <section className="flex flex-col items-center justify-center pt-4">
      <TrustScore score={score} />
      <p className="mt-4 text-center text-white/60 font-medium text-sm max-w-[240px]">Your kinetic flow is optimized for peak efficiency tonight.</p>
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
      <ActionTile icon={ShieldCheck} title="Safety Map" subtitle="Secure Zones" onClick={onSafetyMapClick} />
      <ActionTile icon={History} title="Commute Replay" subtitle="Audit Archive" onClick={onHistoryClick} />
    </section>
  </motion.div>
);

const AlertsView = () => (
  <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
    <h2 className="font-headline text-3xl font-bold tracking-tight mb-8 uppercase tracking-tighter">City Pulse</h2>
    <div className="bg-surface-container rounded-2xl p-6 border border-white/5">
      <p className="text-sm text-white/60 leading-relaxed font-medium">Humidity levels rising in Lower Parel. Transit visibility remains optimal.</p>
    </div>
  </motion.div>
);

export default function App() {
  const dispatch = useDispatch<AppDispatch>();
  const { selectedRoute } = useSelector((state: RootState) => state.journey);
  
  const [view, setView] = useState<View>('flow');
  const [score] = useState<number>(88);
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    const socketUrl = import.meta.env.VITE_SOCKET_URL || 'http://localhost:5000';
    const socket = io(socketUrl);
    socketRef.current = socket;
    return () => { socket.disconnect(); };
  }, []);

  const handleStartSimulation = () => {
    if (selectedRoute) {
      setView('ghost');
    } else {
      setView('plan');
    }
  };

  const NavButton = ({ active, onClick, icon: Icon, label, isMain = false }: any) => (
    <button onClick={onClick} className={`flex flex-col items-center gap-1 transition-all ${active ? 'text-primary' : 'text-white/40'}`}>
      <div className={`${isMain ? 'bg-primary text-surface p-3 rounded-full shadow-[0_0_25px_#ffbf0088] mb-1' : ''}`}>
        <Icon size={isMain ? 26 : 22} />
      </div>
      <span className="text-[10px] font-black uppercase tracking-widest leading-none">{label}</span>
    </button>
  );

  return (
    <div className="min-h-screen font-sans text-white overflow-x-hidden selection:bg-primary/30 relative">
      <div className="fixed inset-0 -z-10 bg-surface" />
      <div className="fixed inset-0 -z-10 opacity-30 pointer-events-none grayscale contrast-125">
        <img className="w-full h-full object-cover" src="https://lh3.googleusercontent.com/aida-public/AB6AXuD8DHc3I2QiURDjUJHdCXDERSUaGwNroZWuw1yNm2pjEMoUgiXa9CuOR5H-1bGOciXmqudM9HkVKxLT5wQiEENIHTx-AIcVfiBZBv2bRGweDN8WWauj5QJbJayYEwwfsPx4_gFn-ORqFT2EQz0Z1tmjGTlzMbd7NrKiE5weBNqNAkxjHdMkLqeTUohT5fcGPt9SIk2bqLJyi884t8H0vPtPkQA20dOYIWyknQrHoxL2BmJPPZnWYVCHgsUnDQtBb0l85rPJbAfMHD8" alt="BG" />
        <div className="absolute inset-0 bg-gradient-to-b from-surface/60 via-surface/40 to-surface" />
      </div>

      <header className="fixed top-0 w-full z-50 flex justify-between items-center px-6 py-5 bg-surface/80 backdrop-blur-2xl border-b border-white/5">
        <div className="flex items-center gap-3">
           <Zap className="text-primary w-5 h-5" />
           <h1 className="font-headline text-xs font-black uppercase tracking-[0.4em]">FlowCity Central</h1>
        </div>
        <div className="w-9 h-9 rounded-full overflow-hidden border border-white/10 p-0.5">
           <img src="https://lh3.googleusercontent.com/aida-public/AB6AXuBeJbicdu7M_jSdtCMYxqW3QBDtI13J1xuiExO7yNjZ4e-hgXZh73kCn_LrfWhMxmDyFtEVhR_A1si1tiuZlyg7uqhK4lvfUsHi-Q_BEM3PF6EByf1_Zt43utDSPjzk7efmSQvx1ng_cF8gmvm4ZMMVS8ZzTOfJ_pEsFq-QSfADSi2MPNGu43XD4cvquRXS2OkaqYwvb8c6YqWd3yQJzJ_40DO-aktnyHAIuWsqY7WJ18qErUkSQFsf6rybbru6h7z4ZVEEaGZfZH8" className="w-full h-full object-cover rounded-full" alt="Profile" />
        </div>
      </header>

      <main className="relative z-10 pt-28 pb-36 px-6 max-w-lg mx-auto">
        <AnimatePresence mode="wait">
          {view === 'flow' && (
            <FlowView 
              key="flow"
              score={score} 
              selectedRoute={selectedRoute} 
              onGhostClick={handleStartSimulation} 
              onSafetyMapClick={() => setView('safety-map')}
              onRescueClick={() => setView('alerts')}
              onHistoryClick={() => setView('history')}
            />
          )}
          {view === 'ghost' && <GhostCommuteView key="ghost" />}
          {view === 'safety-map' && <div className="py-20 text-center uppercase tracking-widest text-white/20">Safety Grid Analysis Active</div>}
          {view === 'plan' && <JourneyPlanner key="plan" />}
          {view === 'history' && <CommuteReplayDashboard key="history" />}
          {view === 'alerts' && <AlertsView key="alerts" />}
        </AnimatePresence>
      </main>

      <nav className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50 flex justify-around items-center p-3.5 bg-surface/60 backdrop-blur-3xl rounded-full w-[90%] max-w-md border border-white/10 shadow-[0_20px_50px_rgba(0,0,0,0.5)]">
        <NavButton active={view === 'flow'} onClick={() => setView('flow')} icon={Zap} label="Flow" isMain />
        <NavButton active={view === 'plan'} onClick={() => setView('plan')} icon={GitBranch} label="Plan" />
        <NavButton active={view === 'alerts'} onClick={() => setView('alerts')} icon={Bell} label="Alerts" />
        <NavButton active={view === 'history'} onClick={() => setView('history')} icon={History} label="Audit" />
      </nav>
    </div>
  );
}
