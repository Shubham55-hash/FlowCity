import React, { useMemo, useEffect, useState, useCallback } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { motion } from 'motion/react';
import { io } from 'socket.io-client';
import {
  Clock,
  Zap,
  Shield,
  AlertTriangle,
  ChevronDown,
  ArrowUpRight,
  CheckCircle2,
  Train,
  Car,
  Footprints,
  Bus,
  ArrowLeft,
  Sparkles,
} from 'lucide-react';
import GhostRouteMap from './GhostRouteMap';
<<<<<<< HEAD
import { splitLegInstruction, formatRouteHeadline } from '../utils/formatLegInstructions';
import { getRouteCoordinates } from '../utils/stationCoordinates';
=======
import { splitLegInstruction } from '../utils/formatLegInstructions';
>>>>>>> 1a205e81c276580b1f69d326e146e88397c22de3
import {
  RootState,
  AppDispatch,
  tickSimulation,
  resetSimulationProgress,
  switchActiveRoute,
  type Route,
} from '../store/journeySlice';

/** Prefer full geometry; else segment endpoints; else straight line from journey endpoints. */
function resolveRoutePathForMap(route: Route): Array<{ lat: number; lng: number }> {
  const geom = route.routeGeometry;
  if (geom && geom.length >= 2) return geom;

  const pts: Array<{ lat: number; lng: number }> = [];
  for (const s of route.segments ?? []) {
    if (s.fromLatLng) pts.push(s.fromLatLng);
    if (s.toLatLng) pts.push(s.toLatLng);
  }
  const dedup: typeof pts = [];
  for (const p of pts) {
    const prev = dedup[dedup.length - 1];
    if (!prev || prev.lat !== p.lat || prev.lng !== p.lng) dedup.push(p);
  }
  if (dedup.length >= 2) return dedup;

  if (route.fromCoords && route.toCoords) {
    return [route.fromCoords, route.toCoords];
  }
<<<<<<< HEAD
  if (route.from?.trim() && route.to?.trim()) {
    const { from, to } = getRouteCoordinates(route.from, route.to);
    return [from, to];
  }
=======
>>>>>>> 1a205e81c276580b1f69d326e146e88397c22de3
  return [];
}

const socketBase = () => import.meta.env.VITE_SOCKET_URL || import.meta.env.VITE_API_URL || 'http://localhost:5000';

function formatClock(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
  } catch {
    return iso;
  }
}

type GhostCommuteViewProps = {
  onBack?: () => void;
};

const GhostCommuteView: React.FC<GhostCommuteViewProps> = ({ onBack }) => {
  const dispatch = useDispatch<AppDispatch>();
  const { selectedRoute, results, activeJourneyProgress, isSimulationRunning, activeAlert } = useSelector(
    (state: RootState) => state.journey
  );

  const [expandedSeg, setExpandedSeg] = useState<number | null>(null);

  useEffect(() => {
    if (!selectedRoute?.id) return;

    const socket = io(socketBase());

    socket.emit('join_journey', selectedRoute.id);

    socket.on('PLAN_UPDATED', () => {});

    return () => {
      socket.disconnect();
    };
  }, [selectedRoute?.id, dispatch]);

  useEffect(() => {
    if (isSimulationRunning && activeJourneyProgress < 100 && !activeAlert) {
      const timer = setInterval(() => dispatch(tickSimulation()), 1000);
      return () => clearInterval(timer);
    }
  }, [isSimulationRunning, activeJourneyProgress, activeAlert, dispatch]);

  const timelineData = useMemo(() => {
    if (!selectedRoute) return [];
    let currentTime = 0;
    return selectedRoute.segments.map((seg) => {
      const start = currentTime;
      currentTime += seg.duration;
      return { ...seg, start, end: currentTime };
    });
  }, [selectedRoute]);

  const totalTime = useMemo(() => {
    if (!selectedRoute?.segments.length) return selectedRoute?.eta || 60;
    const sum = selectedRoute.segments.reduce((a, s) => a + s.duration, 0);
    return Math.max(sum, selectedRoute.eta || 1);
  }, [selectedRoute]);

  const pctAt = useCallback(
    (minutes: number) => (totalTime > 0 ? (minutes / totalTime) * 100 : 0),
    [totalTime]
  );

  const trustRef = selectedRoute?.trustScore ?? 80;

  const bandPathD = useMemo(() => {
    if (!timelineData.length) return '';
    const upper: string[] = [];
    const lower: Array<{ x: number; y: number }> = [];
    timelineData.forEach((seg, i) => {
      const xEnd = pctAt(seg.end);
      const w = Math.min(6, 1.25 + (100 - (seg.confidence ?? trustRef)) / 22);
      if (i === 0) upper.push(`M 0,${40 - w}`);
      upper.push(`L ${xEnd},${40 - w}`);
      lower.push({ x: xEnd, y: 40 + w });
    });
    const w0 = Math.min(6, 1.25 + (100 - (timelineData[0].confidence ?? trustRef)) / 22);
    const last = lower[lower.length - 1];
    const lowerBack = [...lower]
      .slice(0, -1)
      .reverse()
      .map((p) => `L ${p.x},${p.y}`)
      .join(' ');
    return `${upper.join(' ')} L ${last.x},${last.y} ${lowerBack} L 0,${40 + w0} Z`;
  }, [timelineData, pctAt, trustRef]);

  const tickLabels = useMemo(() => {
    const n = 5;
    return Array.from({ length: n }, (_, i) => {
      const m = Math.round((totalTime * i) / (n - 1));
      return { m, pct: (i / (n - 1)) * 100 };
    });
  }, [totalTime]);

  const alternatives = results.filter((r) => r.id !== selectedRoute?.id).slice(0, 2);

  const getStatusColor = (progress: number, start: number, end: number) => {
    if (progress >= pctAt(end)) return 'bg-secondary shadow-[0_0_12px_#13FF43]';
    if (progress >= pctAt(start)) return 'bg-primary animate-pulse shadow-[0_0_15px_#ffbf00]';
    return 'bg-white/10';
  };

  if (!selectedRoute) return null;

  const timelinePoints = selectedRoute.journeyTimeline;

  return (
    <div className="mx-auto w-full max-w-[1320px] px-4 pb-28 pt-4 md:px-8 md:pt-2 lg:pb-12">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <button
          type="button"
          onClick={() => {
            dispatch(resetSimulationProgress());
            onBack?.();
          }}
          className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs font-bold uppercase tracking-widest text-white/70 transition-colors hover:border-primary/40 hover:text-primary"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to flow
        </button>
        <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-secondary/90">
          <Sparkles className="h-3.5 w-3.5" />
          Ghost commute · Timeline + map
        </div>
      </div>

      <div className="grid grid-cols-1 gap-8 xl:grid-cols-[1fr_minmax(340px,420px)] xl:items-start">
        <div className="space-y-8">
          <motion.div
            initial={{ opacity: 0, y: -16 }}
            animate={{ opacity: 1, y: 0 }}
            className="glass-card relative overflow-hidden rounded-3xl border-2 border-primary/20 p-6 md:p-8 amber-glow"
          >
            <div className="relative z-10 flex flex-col justify-between gap-6 md:flex-row md:items-center">
              <div className="min-w-0 flex-1">
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  <span className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-[0.3em] text-secondary">
                    <CheckCircle2 className="h-3 w-3" /> Live simulation
                  </span>
                  {selectedRoute.dataSources?.slice(0, 3).map((src) => (
                    <span
                      key={src}
                      className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[9px] font-semibold text-white/50"
                    >
                      {src.includes('Google') ? 'Maps' : src.includes('OpenRoute') ? 'ORS' : src.replace(/ API.*/, '')}
                    </span>
                  ))}
                </div>
                <h2 className="font-headline text-base font-black uppercase leading-snug tracking-tight text-white/95 md:text-lg">
<<<<<<< HEAD
                  {formatRouteHeadline(selectedRoute.from, selectedRoute.to)}
                </h2>
                <p className="mt-2 text-sm tabular-nums text-white/55">
                  ~{selectedRoute.eta} min · <span className="text-primary/90">₹{selectedRoute.cost}</span>
=======
                  {selectedRoute.summary}
                </h2>
                <p className="mt-2 text-sm tabular-nums text-white/45">
                  ~{selectedRoute.eta} min · ₹{selectedRoute.cost}
>>>>>>> 1a205e81c276580b1f69d326e146e88397c22de3
                </p>
              </div>
              <div className="text-left md:text-right">
                <span className="mb-1 block text-[10px] font-bold uppercase tracking-widest text-white/30">
                  Progress
                </span>
                <span className="font-headline text-2xl font-black text-primary md:text-3xl">{activeJourneyProgress}%</span>
              </div>
            </div>

            <div className="relative z-10 mt-10 pb-6">
              <p className="mb-3 text-[10px] font-black uppercase tracking-[0.35em] text-white/35">
                Confidence band (by leg)
              </p>
<<<<<<< HEAD
              <div className="relative h-28 w-full">
                <svg className="h-full w-full overflow-visible" viewBox="0 0 100 56" preserveAspectRatio="none">
                  {bandPathD && (
                    <path d={bandPathD} className="fill-primary/10 stroke-none" vectorEffect="non-scaling-stroke" />
                  )}
                  <line x1="0" y1="40" x2="100" y2="40" stroke="rgba(255,255,255,0.08)" strokeWidth="0.35" strokeLinecap="round" />
                  <motion.line
                    x1="0"
                    y1="40"
                    x2={activeJourneyProgress}
                    y2="40"
                    className="stroke-primary"
                    strokeWidth="0.55"
                    strokeLinecap="round"
                    style={{
                      filter: 'drop-shadow(0 0 4px rgba(255,191,0,0.65)) drop-shadow(0 0 10px rgba(255,191,0,0.25))',
                    }}
                  />
                  {timelineData.map((seg, i) => (
                    <g key={i}>
                      <circle
                        cx={pctAt(seg.end)}
                        cy={40}
                        r={1.1}
                        className={
                          activeJourneyProgress >= pctAt(seg.end)
                            ? 'fill-secondary stroke-white/30'
                            : 'fill-[#393939] stroke-white/20'
                        }
                        strokeWidth="0.25"
                        vectorEffect="non-scaling-stroke"
                      />
                    </g>
                  ))}
                </svg>
                {/* HTML cursor stays circular; SVG uses preserveAspectRatio="none" which squashes circles */}
                <motion.div
                  aria-hidden
                  className="pointer-events-none absolute z-10 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-[#ffbf00] shadow-[0_0_0_4px_rgba(255,191,0,0.25),0_0_18px_rgba(255,191,0,0.55)]"
                  style={{ left: `${activeJourneyProgress}%`, top: `${(40 / 56) * 100}%` }}
                />
              </div>
=======
              <svg className="h-28 w-full overflow-visible" viewBox="0 0 100 56" preserveAspectRatio="none">
                {bandPathD && (
                  <path d={bandPathD} className="fill-primary/10 stroke-none" vectorEffect="non-scaling-stroke" />
                )}
                <line x1="0" y1="40" x2="100" y2="40" stroke="rgba(255,255,255,0.08)" strokeWidth="0.35" strokeLinecap="round" />
                <motion.line
                  x1="0"
                  y1="40"
                  x2={activeJourneyProgress}
                  y2="40"
                  className="stroke-primary"
                  strokeWidth="0.45"
                  strokeLinecap="round"
                  style={{ filter: 'drop-shadow(0 0 3px rgba(255,191,0,0.5))' }}
                />
                {timelineData.map((seg, i) => (
                  <g key={i}>
                    <circle
                      cx={pctAt(seg.end)}
                      cy={40}
                      r={1.1}
                      className={
                        activeJourneyProgress >= pctAt(seg.end)
                          ? 'fill-secondary stroke-white/30'
                          : 'fill-[#393939] stroke-white/20'
                      }
                      strokeWidth="0.25"
                      vectorEffect="non-scaling-stroke"
                    />
                  </g>
                ))}
                <g transform={`translate(${activeJourneyProgress}, 40)`}>
                  <circle r={2.2} cy={0} className="fill-primary/35 blur-sm" />
                  <circle r={1.2} cy={0} className="fill-[#131313] stroke-primary" strokeWidth="0.35" />
                </g>
              </svg>
>>>>>>> 1a205e81c276580b1f69d326e146e88397c22de3
              <div className="mt-2 flex justify-between px-0.5">
                {tickLabels.map(({ m, pct }) => (
                  <span key={pct} className="text-[10px] font-bold uppercase tracking-widest text-white/30">
                    {m}m
                  </span>
                ))}
              </div>
            </div>
          </motion.div>

          {timelinePoints && timelinePoints.length > 0 && (
            <div className="glass-card rounded-3xl border border-white/10 p-6 md:p-8">
              <h3 className="mb-6 flex items-center gap-2 font-headline text-xs font-black uppercase tracking-[0.4em] text-white/40">
                <Clock className="h-4 w-4 text-primary" />
                Prediction timeline
              </h3>
              <ul className="relative space-y-0 border-l border-white/10 pl-10 md:pl-12">
                {timelinePoints.map((pt, idx) => (
                  <li key={`${pt.timeIso}-${idx}`} className="relative pb-8 last:pb-0">
                    <span
                      className={`absolute -left-[5px] top-1.5 h-2.5 w-2.5 shrink-0 rounded-full border-2 md:-left-[6px] ${
                        pt.isRisk ? 'border-amber-400 bg-amber-500/40' : 'border-primary/50 bg-surface'
                      }`}
                      aria-hidden
                    />
                    <div className="flex flex-wrap items-baseline justify-between gap-3 pl-1 md:pl-2">
                      <span className="font-headline text-sm font-bold text-white/90">{pt.label}</span>
                      <span className="font-mono text-xs text-primary/90">{formatClock(pt.timeIso)}</span>
                    </div>
                    {(pt.errorBarMin !== 0 || pt.errorBarMax !== 0) && (
                      <p className="mt-1 pl-1 text-[11px] text-white/35 md:pl-2">
                        Uncertainty −{Math.abs(pt.errorBarMin)} / +{pt.errorBarMax} min
                      </p>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <div className="space-y-4">
              <h3 className="flex items-center gap-2 px-1 font-headline text-xs font-black uppercase tracking-[0.4em] text-white/30">
                <Zap className="h-4 w-4 fill-primary text-primary" />
                Multi-leg breakdown
              </h3>
              {timelineData.map((seg, i) => {
                const leg = splitLegInstruction(seg.instructions);
                return (
                <motion.div
                  key={i}
                  layout
                  className="glass-card group flex cursor-pointer items-start justify-between gap-3 rounded-2xl border border-white/5 p-4 transition-all hover:border-primary/25 hover:bg-surface-bright/20"
                  onClick={() => setExpandedSeg(expandedSeg === i ? null : i)}
                >
                  <div className="flex min-w-0 flex-1 items-start gap-3 md:gap-4">
                    <div
                      className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition-all ${getStatusColor(
                        activeJourneyProgress,
                        seg.start,
                        seg.end
                      )}`}
                    >
                      {seg.mode === 'Metro' ? (
                        <Train className="h-5 w-5 text-surface" />
                      ) : seg.mode === 'Wait' ? (
                        <Clock className="h-5 w-5 text-surface" />
                      ) : seg.mode === 'Walk' ? (
                        <Footprints className="h-5 w-5 text-surface" />
                      ) : seg.mode === 'Train' ? (
                        <Train className="h-5 w-5 text-surface" />
                      ) : seg.mode === 'Bus' ? (
                        <Bus className="h-5 w-5 text-surface" />
                      ) : (
                        <Car className="h-5 w-5 text-surface" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="space-y-1.5">
                        <p className="font-headline text-xs font-semibold leading-snug text-white/90 md:text-[13px]">
                          {leg.from}
                        </p>
                        {leg.to && (
                          <p className="border-l-2 border-primary/40 pl-3 font-headline text-xs leading-snug text-white/65 md:text-[13px]">
                            <span className="text-primary/80">To </span>
                            {leg.to}
                          </p>
                        )}
                      </div>
                      <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] font-black uppercase tracking-widest text-white/40">
                        <span>{seg.duration} min</span>
                        <span>{seg.mode}</span>
                        {seg.confidence != null && <span>{seg.confidence}% conf</span>}
                        {seg.waitTimeMin ? <span>{seg.waitTimeMin}m wait</span> : null}
                      </div>
                      {expandedSeg === i && (seg.crowdLevel || seg.connectionRisk) && (
                        <p className="mt-2 text-xs leading-relaxed text-white/45">
                          {seg.crowdLevel ? `Crowd: ${seg.crowdLevel}. ` : ''}
                          {seg.connectionRisk ? `Connection risk: ${seg.connectionRisk}.` : ''}
                        </p>
                      )}
                    </div>
                  </div>
                  <ChevronDown
                    className={`h-4 w-4 shrink-0 text-white/15 transition-transform group-hover:text-primary ${
                      expandedSeg === i ? 'rotate-180' : ''
                    }`}
                  />
                </motion.div>
              );
              })}
            </div>

            <div className="space-y-4">
              <h3 className="flex items-center gap-2 px-1 font-headline text-xs font-black uppercase tracking-[0.4em] text-red-400/60">
                <Shield className="h-4 w-4 fill-red-500 text-red-500" />
                Alternatives
              </h3>
              <div className="space-y-3">
                {alternatives.map((alt) => (
                  <div
                    key={alt.id}
                    className="glass-card group rounded-2xl border-2 border-white/5 p-5 transition-all hover:border-primary/40"
                  >
                    <div className="mb-4 flex justify-between gap-4">
                      <div className="min-w-0">
<<<<<<< HEAD
                        <span className="block font-headline text-lg font-black">
                          {formatRouteHeadline(alt.from, alt.to)}
                        </span>
=======
                        <span className="block font-headline text-lg font-black">{alt.summary}</span>
>>>>>>> 1a205e81c276580b1f69d326e146e88397c22de3
                        <span className="text-xs text-white/40">
                          Journey{' '}
                          <span
                            className={
                              alt.eta < selectedRoute.eta ? 'font-bold text-secondary' : 'text-white/60'
                            }
                          >
                            {alt.eta} min
                          </span>
                        </span>
                      </div>
                      <div className="shrink-0 text-right">
                        <span className="block font-headline text-lg font-black text-primary">₹ {alt.cost}</span>
                        {alt.eta > selectedRoute.eta && (
                          <div className="mt-1 flex items-center justify-end gap-1 text-[9px] font-black uppercase tracking-tighter text-amber-400/90">
                            <AlertTriangle className="h-3 w-3" />
                            +{alt.eta - selectedRoute.eta} min vs current
                          </div>
                        )}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => dispatch(switchActiveRoute(alt.id))}
                      className="w-full rounded-xl bg-white/5 py-3 font-headline text-[10px] font-black uppercase tracking-[0.2em] transition-all group-hover:bg-primary group-hover:text-surface"
                    >
                      Reroute
                    </button>
                  </div>
                ))}
              </div>

              <motion.div
                animate={{ opacity: [0.55, 1, 0.55] }}
                transition={{ duration: 4, repeat: Infinity }}
                className="relative mt-4 overflow-hidden rounded-3xl border border-red-500/20 bg-red-500/10 p-5"
              >
                <div className="relative z-10 flex items-start gap-4">
                  <Shield className="h-6 w-6 shrink-0 text-red-500" />
                  <div>
                    <span className="mb-1 block font-headline text-xs font-black uppercase tracking-widest text-red-500">
                      Rescue protocol
                    </span>
                    <p className="text-xs font-medium leading-relaxed text-red-200/60">
                      Monitoring for real-time disruptions. Rescue mode can engage when delay spikes are detected.
                    </p>
                  </div>
                </div>
                <div className="absolute right-0 top-0 h-24 w-24 rounded-full bg-red-500/5 blur-3xl" />
              </motion.div>
            </div>
          </div>
        </div>

        <aside className="flex flex-col gap-4 xl:sticky xl:top-28">
          <div className="glass-card rounded-3xl border border-white/10 p-4">
            <h3 className="mb-3 flex items-center gap-2 font-headline text-xs font-black uppercase tracking-[0.3em] text-white/40">
              <ArrowUpRight className="h-4 w-4 text-primary" />
              Route on map
            </h3>
            <GhostRouteMap
              path={resolveRoutePathForMap(selectedRoute)}
              fromLabel={selectedRoute.from}
              toLabel={selectedRoute.to}
            />
          </div>
        </aside>
      </div>
    </div>
  );
};

export default GhostCommuteView;
