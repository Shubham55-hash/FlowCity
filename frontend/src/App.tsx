import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import { useDispatch, useSelector } from "react-redux";
import { io, Socket } from "socket.io-client";
import { 
  Ghost, LifeBuoy, History, Zap, 
  Bell, GitBranch, Map
} from "lucide-react";
import JourneyPlanner from "./components/JourneyPlanner";
import GhostCommuteView from "./components/GhostCommuteView";
import CommuteReplayDashboard from "./components/CommuteReplayDashboard";
import RouteHeatmap from "./components/RouteHeatmap";
import RescueShieldView from "./components/RescueShieldView";
import RescueAlertOverlay from "./components/RescueAlertOverlay";
import { RootState, AppDispatch, setAlert } from "./store/journeySlice";
import { formatRouteHeadline } from "./utils/formatLegInstructions";

type View = 'flow' | 'routes' | 'alerts' | 'profile' | 'ghost' | 'plan' | 'history' | 'heatmap';

/** Tall amber-glass panel inspired by showcase tiles: center hero glyph, corner badge, copy anchored low. */
const FeaturePanel = ({ icon: Icon, title, subtitle, active = false, onClick }: any) => (
  <motion.button
    type="button"
    whileHover={{ scale: 1.012 }}
    whileTap={{ scale: 0.992 }}
    onClick={onClick}
    className={`group relative flex min-h-[11.5rem] w-full shrink-0 snap-center flex-col justify-end overflow-hidden rounded-[1.85rem] p-5 text-left shadow-[0_20px_50px_rgba(0,0,0,0.35)] outline-none transition-[box-shadow] focus-visible:ring-2 focus-visible:ring-primary/50 sm:min-h-[13rem] ${
      active
        ? 'border border-primary/35 ring-1 ring-primary/20'
        : 'border border-amber-200/10 hover:border-amber-200/18'
    }`}
  >
    <div
      className={`absolute inset-0 bg-gradient-to-b transition-opacity ${
        active
          ? 'from-primary/25 via-amber-950/40 to-black/70'
          : 'from-amber-950/55 via-amber-900/28 to-black/65 group-hover:from-amber-900/50'
      }`}
    />
    <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_85%_55%_at_50%_32%,rgba(255,191,0,0.14),transparent_58%)]" />
    <div className="pointer-events-none absolute inset-0 backdrop-blur-[2px]" />

    <div className="pointer-events-none absolute inset-0 flex items-center justify-center pb-8">
      <Icon
        className={`h-[4.25rem] w-[4.25rem] transition-colors sm:h-[4.75rem] sm:w-[4.75rem] ${
          active ? 'text-white/35' : 'text-white/22 group-hover:text-white/30'
        }`}
        strokeWidth={0.85}
        aria-hidden
      />
    </div>

    <div className="absolute right-3.5 top-3.5 z-10 rounded-xl border border-white/12 bg-black/30 p-2 backdrop-blur-md">
      <Icon className="h-4 w-4 text-primary" strokeWidth={1.65} aria-hidden />
    </div>

    <div className="relative z-10">
      <span className="font-headline block text-[15px] font-bold leading-snug tracking-tight text-white">{title}</span>
      <span className="mt-1 block text-[10px] font-bold uppercase tracking-[0.18em] text-white/45">{subtitle}</span>
    </div>
  </motion.button>
);

const FlowView = ({ selectedRoute, onGhostClick, onRescueClick, onHistoryClick, onHeatmapClick }: any) => (
  <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} className="space-y-8">
    <section className="relative flex flex-col items-center justify-center pt-2">
      <div className="pointer-events-none absolute inset-x-0 top-1/2 h-48 -translate-y-1/2 bg-[radial-gradient(ellipse_70%_80%_at_50%_50%,rgba(255,191,0,0.07),transparent_72%)]" />
      <div className="relative w-full max-w-md px-2 py-8 text-center">
        <p className="font-headline text-[10px] font-black uppercase tracking-[0.35em] text-white/35">Next commute</p>
        {selectedRoute ? (
          <>
            <p className="mt-3 font-headline text-2xl font-black leading-tight tracking-tight text-white drop-shadow-[0_0_20px_rgba(255,191,0,0.12)] sm:text-3xl">
              {formatRouteHeadline(selectedRoute.from, selectedRoute.to)}
            </p>
            <p className="mt-2 font-headline text-lg font-bold tabular-nums tracking-tight text-white/70 sm:text-xl">
              ~{selectedRoute.eta} min est.
            </p>
            <p className="mt-3 font-headline text-3xl font-black tabular-nums text-primary drop-shadow-[0_0_28px_rgba(255,191,0,0.25)] sm:text-4xl">
              ₹{selectedRoute.cost}
            </p>
          </>
        ) : (
          <>
            <div className="mt-5 flex flex-col items-center gap-3">
              <div className="flex items-center justify-center gap-3">
                <Zap className="h-8 w-8 text-primary drop-shadow-[0_0_14px_rgba(255,191,0,0.45)]" strokeWidth={2} aria-hidden />
                <span className="font-headline text-2xl font-black tracking-tight text-white/92">FlowCity</span>
              </div>
              <p className="max-w-xs text-xs leading-relaxed text-white/42">
                Real-time kinetic flow optimization for city commuting.
              </p>
            </div>
            <p className="mt-5 text-sm text-white/52">Plan a route to unlock simulation, replay, and heatmaps.</p>
          </>
        )}
      </div>
      <p className="relative mt-1 max-w-[19rem] text-center text-xs font-medium leading-relaxed text-white/45">
        Commute Replay saves your trip history and surfaces personalized suggestions from it.
      </p>
    </section>

    <section>
      <div className="relative overflow-hidden rounded-[1.85rem] border border-amber-200/10 bg-gradient-to-br from-amber-950/45 via-black/40 to-black/60 p-6 shadow-[0_24px_60px_rgba(0,0,0,0.4)] backdrop-blur-md">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_90%_70%_at_80%_0%,rgba(255,191,0,0.08),transparent_55%)]" />
        <div className="relative flex items-start justify-between gap-4">
          <div>
            <h2 className="font-headline text-xl font-bold tracking-tight text-white sm:text-2xl">
              {selectedRoute ? formatRouteHeadline(selectedRoute.from, selectedRoute.to) : 'Select a Route'}
            </h2>
            <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] font-black uppercase tracking-widest text-white/38">
              <span>~{selectedRoute?.eta ?? '--'} min</span>
              <span className="h-1 w-1 rounded-full bg-white/25" aria-hidden />
              <span>₹ {selectedRoute?.cost ?? '--'}</span>
            </div>
          </div>
          {selectedRoute && (
            <div className="shrink-0 rounded-full border border-secondary/35 bg-secondary/10 px-3 py-1">
              <span className="text-[10px] font-black uppercase tracking-widest text-secondary">Optimized</span>
            </div>
          )}
        </div>
        <button 
          type="button"
          onClick={onGhostClick}
          className={`relative mt-6 w-full py-4 font-headline text-sm font-black uppercase tracking-[0.2em] transition-all cursor-pointer sm:py-5 sm:text-base ${
            selectedRoute
              ? 'rounded-2xl bg-primary text-surface shadow-[0_0_34px_rgba(255,191,0,0.35)] hover:brightness-105'
              : 'rounded-2xl border border-white/12 bg-white/[0.07] text-white/65 hover:bg-white/[0.11] hover:text-white/85'
          }`}
        >
          {selectedRoute ? 'Initiate Pulse Simulation' : 'Enter Departure Plan'}
        </button>
      </div>
    </section>

    <section className="pb-8">
      <div className="-mx-1 flex snap-x snap-mandatory gap-3 overflow-x-auto pb-2 pt-1 [scrollbar-width:none] md:mx-0 md:grid md:snap-none md:grid-cols-2 md:gap-4 md:overflow-visible [&::-webkit-scrollbar]:hidden">
        <div className="min-w-[48%] max-w-[48%] md:min-w-0 md:max-w-none">
          <FeaturePanel icon={Ghost} title="Ghost Commute" subtitle="Smart invisible routing" onClick={onGhostClick} active={!!selectedRoute} />
        </div>
        <div className="min-w-[48%] max-w-[48%] md:min-w-0 md:max-w-none">
          <FeaturePanel icon={LifeBuoy} title="Rescue Shield" subtitle="Smart backup" onClick={onRescueClick} />
        </div>
        <div className="min-w-[48%] max-w-[48%] md:min-w-0 md:max-w-none">
          <FeaturePanel icon={History} title="Commute Replay" subtitle="History & tips" onClick={onHistoryClick} />
        </div>
        <div className="min-w-[48%] max-w-[48%] md:min-w-0 md:max-w-none">
          <FeaturePanel icon={Map} title="Route Heatmap" subtitle="Traffic view" onClick={onHeatmapClick} />
        </div>
      </div>
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
        <img className="h-full w-full object-cover" src="https://lh3.googleusercontent.com/aida-public/AB6AXuD8DHc3I2QiURDjUJHdCXDERSUaGwNroZWuw1yNm2pjEMoUgiXa9CuOR5H-1bGOciXmqudM9HkVKxLT5wQiEENIHTx-AIcVfiBZBv2bRGweDN8WWauj5QJbJayYEwwfsPx4_gFn-ORqFT2EQz0Z1tmjGTlzMbd7NrKiE5weBNqNAkxjHdMkLqeTUohT5fcGPt9SIk2bqLJyi884t8H0vPtPkQA20dOYIWyknQrHoxL2BmJPPZnWYVCHgsUnDQtBb0l85rPJbAfMHD8" alt="" />
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
          {view === 'history' && <CommuteReplayDashboard key="history" onOpenPlan={() => setView('plan')} />}
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
