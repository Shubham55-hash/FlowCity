import { useCallback, useEffect, useState } from 'react';
import axios from 'axios';
import { useDispatch, useSelector } from 'react-redux';
import { motion } from 'motion/react';
import { io } from 'socket.io-client';
import {
  LifeBuoy,
  RefreshCw,
  Shield,
  Train,
  Clock,
  AlertTriangle,
  Zap,
  Radio,
  FlaskConical,
  ChevronRight,
} from 'lucide-react';
import {
  AppDispatch,
  RootState,
  mapSimulationToRoute,
  switchActiveRoute,
  setAlert,
} from '../store/journeySlice';

const apiBase = () => import.meta.env.VITE_API_URL || 'http://localhost:5000';
const socketBase = () => import.meta.env.VITE_SOCKET_URL || import.meta.env.VITE_API_URL || 'http://localhost:5000';

type AltApi = {
  id: string;
  label: string;
  rank: number;
  timeImpactMin: number;
  safetyScore: number;
  totalPredictedCost: number;
  costDiff: number;
  route: Record<string, unknown>;
};

export default function RescueShieldView() {
  const dispatch = useDispatch<AppDispatch>();
  const { selectedRoute, searchParams } = useSelector((s: RootState) => s.journey);

  const [alts, setAlts] = useState<AltApi[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [triggerMsg, setTriggerMsg] = useState<string | null>(null);

  const from = searchParams.from || selectedRoute?.from || '';
  const to = searchParams.to || selectedRoute?.to || '';
  const journeyId = selectedRoute?.id || null;
  const monitored = !!journeyId;

  const loadAlternatives = useCallback(async () => {
    if (!from.trim() || !to.trim()) {
      setError('Set origin and destination in Plan first.');
      setAlts([]);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const { data } = await axios.post<{
        status: string;
        data?: { alternatives: AltApi[]; monitoring?: boolean };
        message?: string;
      }>(`${apiBase()}/api/rescue/alternatives`, {
        from: from.trim(),
        to: to.trim(),
        time: searchParams.time || selectedRoute?.departureTimeIso || undefined,
        journeyId,
      });
      if (data.status !== 'success' || !data.data?.alternatives) {
        throw new Error(data.message || 'No alternatives returned');
      }
      setAlts(data.data.alternatives);
    } catch (e: unknown) {
      const msg = axios.isAxiosError(e)
        ? e.response?.data?.message || e.message
        : e instanceof Error
          ? e.message
          : 'Request failed';
      setError(String(msg));
      setAlts([]);
    } finally {
      setLoading(false);
    }
  }, [from, to, searchParams.time, selectedRoute?.departureTimeIso, journeyId]);

  useEffect(() => {
    loadAlternatives();
  }, [loadAlternatives]);

  useEffect(() => {
    if (!journeyId) return;
    const socket = io(socketBase());
    socket.emit('join_journey', journeyId);
    socket.on('RES_MODE_ALERT', (payload: unknown) => {
      dispatch(setAlert(payload));
    });
    return () => {
      socket.disconnect();
    };
  }, [journeyId, dispatch]);

  const applyOption = async (opt: AltApi) => {
    const newId = `${journeyId ?? 'JRN'}-shield-${opt.id}`;
    const route = mapSimulationToRoute(opt.route, newId, from.trim(), to.trim());
    route.departureTimeIso = searchParams.time || selectedRoute?.departureTimeIso;

    try {
      await axios.post(`${apiBase()}/api/rescue/switch`, {
        journeyId,
        optionId: opt.id,
        simulation: opt.route,
      });
    } catch {
      /* still apply locally */
    }

    dispatch(switchActiveRoute(route));
  };

  const testDisruption = async () => {
    setTriggerMsg(null);
    if (!journeyId) {
      setTriggerMsg('Plan a journey first so a journey id exists.');
      return;
    }
    try {
      const { data } = await axios.post<{ status: string; message?: string }>(
        `${apiBase()}/api/rescue/trigger-test`,
        { journeyId }
      );
      if (data.status === 'success') {
        setTriggerMsg(data.message || 'Sent. Open Ghost Commute view to see the alert modal.');
      }
    } catch (e: unknown) {
      const msg = axios.isAxiosError(e)
        ? e.response?.data?.message || e.message
        : 'Trigger failed';
      setTriggerMsg(String(msg));
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      className="mx-auto max-w-3xl space-y-8 pb-24 pt-2 md:max-w-4xl"
    >
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <div className="mb-2 flex items-center gap-2 text-primary">
            <LifeBuoy className="h-6 w-6" />
            <span className="font-headline text-xs font-black uppercase tracking-[0.35em]">
              Rescue Shield
            </span>
          </div>
          <h2 className="font-headline text-3xl font-black uppercase tracking-tighter md:text-4xl">
            Smart backup routes
          </h2>
          <p className="mt-2 max-w-xl text-sm leading-relaxed text-white/50">
            Live rerank by time, safety, and cost from the same engines as Ghost Commute. After you plan a trip,
            the server watches that journey id and can push a rescue alert over the socket.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={loadAlternatives}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-2xl border border-white/15 bg-white/5 px-4 py-3 text-xs font-black uppercase tracking-widest text-white/80 transition-colors hover:border-primary/40 hover:text-primary disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          <button
            type="button"
            onClick={testDisruption}
            className="inline-flex items-center gap-2 rounded-2xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-xs font-black uppercase tracking-widest text-amber-200/90 transition-colors hover:bg-amber-500/20"
          >
            <FlaskConical className="h-4 w-4" />
            Test socket alert
          </button>
        </div>
      </div>

      <div className="glass-card grid gap-4 rounded-3xl border border-white/10 p-6 md:grid-cols-2">
        <div className="flex items-start gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-secondary/15">
            <Shield className="h-6 w-6 text-secondary" />
          </div>
          <div>
            <p className="font-headline text-xs font-black uppercase tracking-widest text-white/40">
              Monitoring
            </p>
            <p className="mt-1 font-semibold text-white/90">
              {monitored ? 'Active for current plan' : 'Inactive — plan a route in Plan tab'}
            </p>
            {journeyId && (
              <p className="mt-1 font-mono text-[11px] text-white/35">
                Journey <span className="text-primary/90">{journeyId}</span>
              </p>
            )}
          </div>
        </div>
        <div className="flex items-start gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/15">
            <Radio className="h-6 w-6 text-primary" />
          </div>
          <div>
            <p className="font-headline text-xs font-black uppercase tracking-widest text-white/40">Trip</p>
            <p className="mt-1 text-sm text-white/80">
              {from && to ? (
                <>
                  {from} <span className="text-white/30">→</span> {to}
                </>
              ) : (
                <span className="text-white/40">No corridor selected</span>
              )}
            </p>
          </div>
        </div>
      </div>

      {triggerMsg && (
        <div className="rounded-2xl border border-amber-500/25 bg-amber-500/10 px-4 py-3 text-sm text-amber-100/90">
          {triggerMsg}
        </div>
      )}

      {error && (
        <div className="rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200/90">
          {error}
        </div>
      )}

      <div className="space-y-4">
        <h3 className="flex items-center gap-2 font-headline text-xs font-black uppercase tracking-[0.3em] text-white/35">
          <Zap className="h-4 w-4 text-primary" />
          Backup corridors
        </h3>
        <div className="space-y-3">
          {alts.length === 0 && !loading && (
            <p className="text-sm text-white/35">No routes yet. Check backend and addresses, then refresh.</p>
          )}
          {alts.map((opt) => (
            <motion.div
              layout
              key={opt.id}
              className="glass-card group flex flex-col gap-4 rounded-2xl border border-white/10 p-5 transition-colors hover:border-primary/30 md:flex-row md:items-center md:justify-between"
            >
              <div className="flex items-start gap-4">
                <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-surface-bright/50 text-primary">
                  <Train className="h-7 w-7" />
                </div>
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-headline text-lg font-black">{opt.label}</span>
                    <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-white/50">
                      Rank {opt.rank}
                    </span>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-4 text-xs text-white/45">
                    <span className="flex items-center gap-1">
                      <Clock className="h-3.5 w-3.5" />
                      {opt.timeImpactMin > 0 ? `+${opt.timeImpactMin}` : opt.timeImpactMin} min vs baseline
                    </span>
                    <span className="flex items-center gap-1 text-secondary">
                      <Shield className="h-3.5 w-3.5" />
                      {opt.safetyScore}% safety
                    </span>
                    <span>
                      ₹{Math.round(opt.totalPredictedCost)}
                      {opt.costDiff !== 0 && (
                        <span className={opt.costDiff > 0 ? 'text-amber-300' : 'text-secondary'}>
                          {' '}
                          ({opt.costDiff > 0 ? '+' : ''}
                          {opt.costDiff})
                        </span>
                      )}
                    </span>
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => applyOption(opt)}
                className="inline-flex w-full shrink-0 items-center justify-center gap-2 rounded-xl bg-primary py-3 font-headline text-xs font-black uppercase tracking-widest text-surface transition-transform hover:scale-[1.02] md:w-auto md:px-6"
              >
                Apply route
                <ChevronRight className="h-4 w-4" />
              </button>
            </motion.div>
          ))}
        </div>
      </div>

      <div className="rounded-3xl border border-white/5 bg-surface-container/80 p-6">
        <h4 className="mb-2 flex items-center gap-2 font-headline text-xs font-black uppercase tracking-widest text-white/40">
          <AlertTriangle className="h-4 w-4 text-white/30" />
          City pulse
        </h4>
        <p className="text-sm leading-relaxed text-white/55">
          Humidity and local incidents still post here in a future feed. Rescue Shield focuses on actionable
          reroutes tied to your current journey id.
        </p>
      </div>
    </motion.div>
  );
}
