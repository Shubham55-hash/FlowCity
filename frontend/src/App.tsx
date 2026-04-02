import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { 
  EyeOff, 
  LifeBuoy, 
  ShieldCheck, 
  History, 
  Zap, 
  Map as MapIcon, 
  Bell, 
  User, 
  Clock, 
  GitBranch, 
  CloudSun,
  ChevronRight,
  AlertTriangle,
  CheckCircle2,
  Settings,
  LogOut,
  CreditCard,
  Shield
} from "lucide-react";

type View = 'flow' | 'routes' | 'alerts' | 'profile';

const TrustScore = ({ score }: { score: number }) => {
  const radius = 110;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;

  return (
    <div className="relative flex items-center justify-center w-64 h-64">
      <svg className="absolute inset-0 w-full h-full -rotate-90">
        <circle
          className="text-white/5"
          cx="128"
          cy="128"
          fill="transparent"
          r={radius}
          stroke="currentColor"
          strokeWidth="4"
        />
        <motion.circle
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 1.5, ease: "easeOut" }}
          className="drop-shadow-[0_0_12px_rgba(255,191,0,0.6)]"
          cx="128"
          cy="128"
          fill="transparent"
          r={radius}
          stroke="#FFBF00"
          strokeDasharray={circumference}
          strokeLinecap="round"
          strokeWidth="12"
        />
      </svg>
      <div className="text-center">
        <motion.span 
          initial={{ opacity: 0, scale: 0.5 }}
          animate={{ opacity: 1, scale: 1 }}
          className="block font-headline text-7xl font-black text-primary tracking-tighter"
        >
          {score}
        </motion.span>
        <span className="block font-headline text-xs uppercase tracking-[0.3em] text-white/40">
          TrustScore
        </span>
      </div>
      <div className="absolute top-4 left-1/2 -translate-x-1/2 w-2 h-2 bg-secondary rounded-full animate-pulse shadow-[0_0_8px_#13FF43]" />
    </div>
  );
};

const ActionTile = ({ icon: Icon, title, subtitle, active = false }: any) => (
  <motion.div 
    whileHover={{ scale: 1.02 }}
    whileTap={{ scale: 0.98 }}
    className="bg-surface-container aspect-square rounded-2xl p-5 flex flex-col justify-between cursor-pointer group neon-border transition-colors hover:bg-surface-bright"
  >
    <Icon className={`w-8 h-8 ${active ? 'text-primary fill-primary/20' : 'text-primary'}`} />
    <div>
      <span className="block font-headline text-sm font-bold tracking-tight">{title}</span>
      <span className="text-[10px] text-white/40 uppercase tracking-tighter">{subtitle}</span>
    </div>
  </motion.div>
);

const FlowView = ({ score, selectedRoute }: { score: number, selectedRoute: string, [key: string]: any }) => (
  <motion.div 
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    exit={{ opacity: 0, y: -20 }}
    className="space-y-12"
  >
    <section className="flex flex-col items-center justify-center">
      <TrustScore score={score} />
      <motion.p 
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
        className="mt-6 text-center text-white/60 font-medium max-w-[280px]"
      >
        Your kinetic flow is optimized for peak efficiency tonight.
      </motion.p>
    </section>

    <section>
      <div className="glass-card rounded-3xl p-6 shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 blur-3xl rounded-full -mr-16 -mt-16" />
        <div className="flex justify-between items-start mb-6">
          <div>
            <h2 className="font-headline text-2xl font-bold tracking-tight mb-1">{selectedRoute.replace('-', ' → ')}</h2>
            <div className="flex items-center gap-3 text-white/40 text-sm">
              <span className="flex items-center gap-1"><Clock className="w-4 h-4" /> 42 min</span>
              <span className="w-1 h-1 bg-white/20 rounded-full" />
              <span className="flex items-center gap-1"><GitBranch className="w-4 h-4" /> 3 connections</span>
            </div>
          </div>
          <div className="bg-secondary/10 border border-secondary/30 px-3 py-1 rounded-full">
            <span className="text-[10px] font-bold text-secondary uppercase tracking-widest">Active</span>
          </div>
        </div>
        <div className="h-1.5 w-full bg-white/10 rounded-full flex gap-1 mb-8 overflow-hidden">
          <div className="h-full w-[33%] bg-primary rounded-full" />
          <div className="h-full w-[25%] bg-primary/40 rounded-full" />
          <div className="h-full flex-1 bg-white/5 rounded-full" />
        </div>
        <button className="w-full py-4 bg-primary text-surface font-headline font-bold uppercase tracking-widest rounded-xl transition-all shadow-[0_0_20px_rgba(255,191,0,0.3)]">
          View Live Pulse
        </button>
      </div>
    </section>

    <section className="grid grid-cols-2 gap-4">
      <ActionTile icon={EyeOff} title="Ghost Commute" subtitle="Stealth Mode" active={true} />
      <ActionTile icon={LifeBuoy} title="Rescue Mode" subtitle="Emergency Prep" />
      <ActionTile icon={ShieldCheck} title="Safety Map" subtitle="Secure Zones" />
      <ActionTile icon={History} title="Commute Replay" subtitle="History Log" />
    </section>
  </motion.div>
);

const RoutesView = ({ onSelectRoute, ...props }: { onSelectRoute: (from: string, to: string) => void, [key: string]: any }) => (
  <motion.div 
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    exit={{ opacity: 0, y: -20 }}
    className="space-y-6"
  >
    <h2 className="font-headline text-3xl font-bold tracking-tight mb-8">Kinetic Routes</h2>
    {[
      { from: "Colaba", to: "Worli", time: "24 min", status: "Optimal", color: "text-secondary" },
      { from: "Bandra", to: "Juhu", time: "18 min", status: "Moderate", color: "text-primary" },
      { from: "Churchgate", to: "Virar", time: "72 min", status: "Congested", color: "text-red-400" },
      { from: "Dadar", to: "Lower Parel", time: "12 min", status: "Optimal", color: "text-secondary" },
      { from: "Andheri", to: "BKC", time: "42 min", status: "Active", color: "text-secondary" },
    ].map((route, i) => (
      <motion.div 
        key={i}
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: i * 0.1 }}
        onClick={() => onSelectRoute(route.from, route.to)}
        className="glass-card rounded-2xl p-5 flex items-center justify-between group cursor-pointer hover:bg-surface-bright transition-colors"
      >
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
            <GitBranch className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h3 className="font-headline font-bold text-lg">{route.from} → {route.to}</h3>
            <div className="flex items-center gap-2 text-xs text-white/40">
              <Clock className="w-3 h-3" /> {route.time}
              <span className="w-1 h-1 bg-white/20 rounded-full" />
              <span className={route.color}>{route.status}</span>
            </div>
          </div>
        </div>
        <ChevronRight className="w-5 h-5 text-white/20 group-hover:text-primary transition-colors" />
      </motion.div>
    ))}
  </motion.div>
);

const AlertsView = () => (
  <motion.div 
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    exit={{ opacity: 0, y: -20 }}
    className="space-y-6"
  >
    <h2 className="font-headline text-3xl font-bold tracking-tight mb-8">City Pulse Alerts</h2>
    {[
      { type: "Safety", msg: "High kinetic activity detected in BKC Sector 4.", time: "2m ago", icon: ShieldCheck, color: "text-secondary" },
      { type: "Congestion", msg: "Western Express Highway experiencing 15% surge.", time: "12m ago", icon: AlertTriangle, color: "text-primary" },
      { type: "Weather", msg: "Humidity levels rising. Visibility remains optimal.", time: "45m ago", icon: CloudSun, color: "text-blue-400" },
      { type: "System", msg: "TrustScore algorithm updated for night flow.", time: "2h ago", icon: CheckCircle2, color: "text-secondary" },
    ].map((alert, i) => (
      <motion.div 
        key={i}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: i * 0.1 }}
        className="bg-surface-container rounded-2xl p-5 border border-white/5"
      >
        <div className="flex items-start gap-4">
          <div className={`mt-1 ${alert.color}`}>
            <alert.icon className="w-5 h-5" />
          </div>
          <div className="flex-1">
            <div className="flex justify-between items-center mb-1">
              <span className={`text-[10px] font-bold uppercase tracking-widest ${alert.color}`}>{alert.type}</span>
              <span className="text-[10px] text-white/20">{alert.time}</span>
            </div>
            <p className="text-sm text-white/80 leading-relaxed">{alert.msg}</p>
          </div>
        </div>
      </motion.div>
    ))}
  </motion.div>
);

const ProfileView = () => (
  <motion.div 
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    exit={{ opacity: 0, y: -20 }}
    className="space-y-8"
  >
    <div className="flex flex-col items-center text-center space-y-4 mb-8">
      <div className="relative">
        <div className="w-24 h-24 rounded-full overflow-hidden border-2 border-primary p-1">
          <img 
            className="w-full h-full rounded-full object-cover" 
            src="https://lh3.googleusercontent.com/aida-public/AB6AXuBeJbicdu7M_jSdtCMYxqW3QBDtI13J1xuiExO7yNjZ4e-hgXZh73kCn_LrfWhMxmDyFtEVhR_A1si1tiuZlyg7uqhK4lvfUsHi-Q_BEM3PF6EByf1_Zt43utDSPjzk7efmSQvx1ng_cF8gmvm4ZMMVS8ZzTOfJ_pEsFq-QSfADSi2MPNGu43XD4cvquRXS2OkaqYwvb8c6YqWd3yQJzJ_40DO-aktnyHAIuWsqY7WJ18qErUkSQFsf6rybbru6h7z4ZVEEaGZfZH8" 
            alt="User"
            referrerPolicy="no-referrer"
          />
        </div>
        <div className="absolute bottom-0 right-0 w-6 h-6 bg-secondary rounded-full border-2 border-surface flex items-center justify-center">
          <CheckCircle2 className="w-3 h-3 text-surface" />
        </div>
      </div>
      <div>
        <h2 className="font-headline text-2xl font-bold">Citizen #4829</h2>
        <p className="text-white/40 text-sm">Verified Kinetic Flow Member</p>
      </div>
    </div>

    <div className="grid grid-cols-3 gap-4">
      {[
        { label: "Flows", val: "128" },
        { label: "Hours", val: "42.5" },
        { label: "Rank", val: "Elite" },
      ].map((stat, i) => (
        <div key={i} className="bg-surface-container rounded-2xl p-4 text-center border border-white/5">
          <span className="block text-xl font-headline font-bold text-primary">{stat.val}</span>
          <span className="text-[10px] text-white/40 uppercase tracking-widest">{stat.label}</span>
        </div>
      ))}
    </div>

    <div className="space-y-3">
      {[
        { icon: CreditCard, label: "Kinetic Credits", val: "4,200 ₭" },
        { icon: Shield, label: "Security Level", val: "Tier 4" },
        { icon: Settings, label: "Preferences", val: "" },
        { icon: LogOut, label: "De-authenticate", val: "", color: "text-red-400" },
      ].map((item, i) => (
        <div key={i} className="glass-card rounded-2xl p-4 flex items-center justify-between cursor-pointer hover:bg-surface-bright transition-colors">
          <div className="flex items-center gap-4">
            <item.icon className={`w-5 h-5 ${item.color || 'text-white/60'}`} />
            <span className={`font-medium ${item.color || 'text-white/90'}`}>{item.label}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-white/40">{item.val}</span>
            <ChevronRight className="w-4 h-4 text-white/20" />
          </div>
        </div>
      ))}
    </div>
  </motion.div>
);

export default function App() {
  const [view, setView] = useState<View>('flow');
  const [score, setScore] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(true);
  const [selectedRoute, setSelectedRoute] = useState<string>("Andheri-BKC");

  useEffect(() => {
    const fetchScore = async () => {
      try {
        setLoading(true);
        // Using the backend port 5000 and passing routeId as query param
        const response = await fetch(`http://localhost:5000/api/trust-score?routeId=${encodeURIComponent(selectedRoute)}`);
        const data = await response.json();
        setScore(data.trustScore);
      } catch (error) {
        console.error("Error fetching TrustScore:", error);
        setScore(75); // Fallback
      } finally {
        setLoading(false);
      }
    };

    fetchScore();
  }, [selectedRoute]);

  const handleSelectRoute = (from: string, to: string) => {
    setSelectedRoute(`${from}-${to}`);
    setView('flow'); // Switch back to flow view to see the new score
  };

  return (
    <div className="min-h-screen bg-surface selection:bg-primary/30">
      {/* Status Bar */}
      <div className="fixed top-0 left-0 right-0 h-1 bg-secondary z-[60] shadow-[0_0_15px_#13FF43]" />

      {/* Background Layer */}
      <div className="fixed inset-0 z-0 opacity-30 pointer-events-none">
        <img 
          className="w-full h-full object-cover" 
          src="https://lh3.googleusercontent.com/aida-public/AB6AXuD8DHc3I2QiURDjUJHdCXDERSUaGwNroZWuw1yNm2pjEMoUgiXa9CuOR5H-1bGOciXmqudM9HkVKxLT5wQiEENIHTx-AIcVfiBZBv2bRGweDN8WWauj5QJbJayYEwwfsPx4_gFn-ORqFT2EQz0Z1tmjGTlzMbd7NrKiE5weBNqNAkxjHdMkLqeTUohT5fcGPt9SIk2bqLJyi884t8H0vPtPkQA20dOYIWyknQrHoxL2BmJPPZnWYVCHgsUnDQtBb0l85rPJbAfMHD8" 
          alt="Mumbai Nightscape"
          referrerPolicy="no-referrer"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-surface/80 via-surface/40 to-surface" />
      </div>

      {/* Header */}
      <header className="fixed top-0 w-full z-50 flex justify-between items-center px-6 py-4 bg-surface/60 backdrop-blur-2xl rounded-b-3xl border-b border-primary/10 shadow-2xl">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full overflow-hidden border border-primary/20">
            <img 
              className="w-full h-full object-cover" 
              src="https://lh3.googleusercontent.com/aida-public/AB6AXuBeJbicdu7M_jSdtCMYxqW3QBDtI13J1xuiExO7yNjZ4e-hgXZh73kCn_LrfWhMxmDyFtEVhR_A1si1tiuZlyg7uqhK4lvfUsHi-Q_BEM3PF6EByf1_Zt43utDSPjzk7efmSQvx1ng_cF8gmvm4ZMMVS8ZzTOfJ_pEsFq-QSfADSi2MPNGu43XD4cvquRXS2OkaqYwvb8c6YqWd3yQJzJ_40DO-aktnyHAIuWsqY7WJ18qErUkSQFsf6rybbru6h7z4ZVEEaGZfZH8" 
              alt="User"
              referrerPolicy="no-referrer"
            />
          </div>
          <h1 className="font-headline text-white uppercase tracking-widest text-xs font-bold">Good Evening, Citizen</h1>
        </div>
        <div className="flex items-center gap-2 bg-surface-container px-4 py-2 rounded-full border border-white/5">
          <CloudSun className="w-4 h-4 text-primary" />
          <span className="font-headline text-xs font-bold tracking-tighter">28°C Optimal</span>
        </div>
      </header>

      <main className="relative z-10 pt-28 pb-32 px-6 max-w-lg mx-auto">
        <AnimatePresence mode="wait">
          {view === 'flow' && <FlowView key="flow" score={score} selectedRoute={selectedRoute} />}
          {view === 'routes' && <RoutesView key="routes" onSelectRoute={handleSelectRoute} />}
          {view === 'alerts' && <AlertsView key="alerts" />}
          {view === 'profile' && <ProfileView key="profile" />}
        </AnimatePresence>
      </main>

      {/* Bottom Navigation */}
      <nav className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex justify-around items-center p-2 bg-surface/40 backdrop-blur-3xl rounded-full w-[92%] max-w-md border border-primary/20 shadow-[0_20px_50px_rgba(255,191,0,0.15)]">
        <NavButton 
          active={view === 'flow'} 
          onClick={() => setView('flow')} 
          icon={Zap} 
          label="Flow" 
          isMain 
        />
        <NavButton 
          active={view === 'routes'} 
          onClick={() => setView('routes')} 
          icon={MapIcon} 
          label="Routes" 
        />
        <NavButton 
          active={view === 'alerts'} 
          onClick={() => setView('alerts')} 
          icon={Bell} 
          label="Alerts" 
        />
        <NavButton 
          active={view === 'profile'} 
          onClick={() => setView('profile')} 
          icon={User} 
          label="Profile" 
        />
      </nav>
    </div>
  );
}

const NavButton = ({ icon: Icon, label, active, onClick, isMain }: any) => (
  <motion.button 
    whileHover={{ y: -2 }}
    whileTap={{ scale: 0.9 }}
    onClick={onClick}
    className={`flex flex-col items-center justify-center transition-all duration-300 ${
      isMain 
        ? active 
          ? "bg-primary text-surface rounded-full w-14 h-14 shadow-[0_0_20px_rgba(255,191,0,0.5)]" 
          : "bg-surface-container text-white/40 rounded-full w-14 h-14"
        : active 
          ? "text-primary w-14 h-14" 
          : "text-white/40 w-14 h-14 hover:text-primary/60"
    }`}
  >
    <Icon className={`w-6 h-6 ${active && isMain ? 'fill-current' : ''}`} />
    <span className="font-headline text-[8px] font-bold uppercase tracking-widest mt-0.5">{label}</span>
  </motion.button>
);
