import React, { useCallback, useMemo, useState, useEffect } from 'react';
import axios from 'axios';
import { motion, AnimatePresence } from 'motion/react';
import {
  TrendingUp,
  Clock,
  CreditCard,
  ChevronRight,
  Download,
  Info,
  Shield,
  Zap,
  Calendar,
  AlertCircle,
  FileText,
  RefreshCw,
  Route,
  BarChart3,
} from 'lucide-react';

/** Matches backend `Insights` from commuteReplayService */
export interface CommuteInsights {
  avgDelay: number;
  reliabilityByRoute: { route: string; score: number }[];
  peakHourAnalysis: { hour: number; delay: number }[];
  patterns: string[];
  costTrend: { date: string; amount: number }[];
}

export interface CommuteRecommendation {
  type: string;
  title: string;
  suggestion: string;
  impact: string;
}

const apiBase = () => (import.meta.env.VITE_API_URL || 'http://localhost:5000').replace(/\/$/, '');

function formatInr(n: number): string {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(
    Math.round(n)
  );
}

function formatDelay(minutes: number): string {
  if (!Number.isFinite(minutes)) return '—';
  const rounded = Math.abs(minutes - Math.round(minutes)) < 0.05 ? Math.round(minutes) : Math.round(minutes * 10) / 10;
  return `${rounded} min`;
}

function impactStyles(impact: string): string {
  const u = impact.toLowerCase();
  if (u.includes('critical')) return 'text-red-400 border-red-400/30 bg-red-400/10';
  if (u.includes('high')) return 'text-primary border-primary/30 bg-primary/10';
  if (u.includes('medium')) return 'text-secondary border-secondary/30 bg-secondary/10';
  return 'text-white/55 border-white/10 bg-white/5';
}

function buildCostTrendChart(points: { date: string; amount: number }[]) {
  if (points.length === 0) return null;
  const padX = 8;
  const padY = 12;
  const w = 100;
  const h = 56;
  const amounts = points.map((p) => p.amount);
  const min = Math.min(...amounts);
  const max = Math.max(...amounts);
  const span = max - min || 1;

  const normX = (i: number) => padX + (i / Math.max(points.length - 1, 1)) * (w - 2 * padX);
  const normY = (v: number) => padY + (1 - (v - min) / span) * (h - 2 * padY);

  const lineD = points
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${normX(i).toFixed(2)} ${normY(p.amount).toFixed(2)}`)
    .join(' ');

  const areaD =
    `${lineD} L ${normX(points.length - 1).toFixed(2)} ${h} L ${normX(0).toFixed(2)} ${h} Z`;

  const dots = points.map((p, i) => ({
    cx: normX(i),
    cy: normY(p.amount),
    date: p.date,
    amount: p.amount,
  }));

  return { lineD, areaD, dots, w, h, viewW: w, viewH: h };
}

type Props = { onOpenPlan?: () => void };

const CommuteReplayDashboard: React.FC<Props> = ({ onOpenPlan }) => {
  const [stats, setStats] = useState<CommuteInsights | null>(null);
  const [recommendations, setRecommendations] = useState<CommuteRecommendation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshedAt, setRefreshedAt] = useState<Date | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const base = apiBase();
    try {
      const [statsRes, recsRes] = await Promise.all([
        axios.get<CommuteInsights>(`${base}/api/history/stats`),
        axios.get<CommuteRecommendation[]>(`${base}/api/history/insights`),
      ]);
      setStats(statsRes.data);
      const recs = recsRes.data;
      setRecommendations(Array.isArray(recs) ? recs : []);
      setRefreshedAt(new Date());
    } catch (err) {
      console.error('Commute Replay fetch failed:', err);
      setError(
        'Could not reach the analytics API. If you are running locally, start the backend on port 5000 and set VITE_API_URL.'
      );
      setStats(null);
      setRecommendations([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const derived = useMemo(() => {
    if (!stats) {
      return {
        tripCount: 0,
        totalSpend: 0,
        efficiency: null as number | null,
        delayLabel: '—',
      };
    }
    const tripCount = stats.costTrend?.length ?? 0;
    const totalSpend = (stats.costTrend ?? []).reduce((s, p) => s + (Number(p.amount) || 0), 0);
    const scores = stats.reliabilityByRoute ?? [];
    const efficiency =
      scores.length > 0 ? Math.round(scores.reduce((a, r) => a + (Number(r.score) || 0), 0) / scores.length) : null;

    return {
      tripCount,
      totalSpend,
      efficiency,
      delayLabel: formatDelay(stats.avgDelay),
    };
  }, [stats]);

  const costChart = useMemo(() => buildCostTrendChart(stats?.costTrend ?? []), [stats?.costTrend]);

  const peakNormalized = useMemo(() => {
    const rows = stats?.peakHourAnalysis ?? [];
    if (!rows.length) return [];
    const maxD = Math.max(...rows.map((r) => r.delay), 1);
    return [...rows].sort((a, b) => a.hour - b.hour).map((r) => ({
      ...r,
      pct: Math.round((r.delay / maxD) * 100),
    }));
  }, [stats?.peakHourAnalysis]);

  const exportReport = useCallback(() => {
    if (!stats) return;
    const blob = new Blob(
      [
        JSON.stringify(
          {
            exportedAt: new Date().toISOString(),
            insights: stats,
            recommendations,
          },
          null,
          2
        ),
      ],
      { type: 'application/json' }
    );
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `flowcity-commute-replay-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  }, [stats, recommendations]);

  if (loading && !stats && !error) {
    return (
      <div className="flex flex-col items-center justify-center space-y-4 py-32">
        <motion.div animate={{ rotate: 360 }} transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}>
          <Zap className="h-12 w-12 text-primary" />
        </motion.div>
        <span className="font-headline text-xs font-black uppercase tracking-[0.35em] text-white/40">
          Loading commute replay…
        </span>
      </div>
    );
  }

  const hasData = stats && (stats.costTrend?.length > 0 || (stats.reliabilityByRoute?.length ?? 0) > 0);

  return (
    <div className="mx-auto max-w-4xl space-y-8 px-3 pb-24 pt-2 md:px-6 md:pb-28 md:pt-4">
      {/* Header */}
      <div className="flex flex-col gap-5 md:flex-row md:items-start md:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <h2 className="font-headline text-3xl font-black tracking-tight text-white md:text-4xl">Commute Replay</h2>
            <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-0.5 font-headline text-[10px] font-black uppercase tracking-widest text-white/35">
              ~90 day window
            </span>
          </div>
          <p className="mt-2 max-w-xl text-sm leading-relaxed text-white/45">
            Trip history, reliability by route, spend trend, and suggestions based on your patterns.
          </p>
          {refreshedAt && (
            <p className="mt-2 text-[11px] text-white/30">
              Updated {refreshedAt.toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}
            </p>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2 md:justify-end">
          <button
            type="button"
            onClick={() => void load()}
            className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 font-headline text-[10px] font-black uppercase tracking-widest text-white/80 transition-colors hover:bg-white/10"
          >
            <RefreshCw className="h-4 w-4" />
            Refresh
          </button>
          <button
            type="button"
            disabled={!stats}
            onClick={exportReport}
            className="inline-flex items-center gap-2 rounded-2xl bg-primary px-5 py-3 font-headline text-[10px] font-black uppercase tracking-widest text-surface shadow-[0_0_28px_rgba(255,191,0,0.28)] transition-transform hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Download className="h-4 w-4" />
            Export JSON
          </button>
        </div>
      </div>

      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="flex items-start gap-3 rounded-2xl border border-amber-500/25 bg-amber-500/10 px-4 py-3 text-sm text-amber-100/90"
          >
            <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
            <div>
              <p className="font-semibold text-white">Analytics unavailable</p>
              <p className="mt-1 text-white/70">{error}</p>
              <button
                type="button"
                onClick={() => void load()}
                className="mt-3 font-headline text-[10px] font-black uppercase tracking-widest text-primary hover:underline"
              >
                Try again
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {!error && stats && !hasData && (
        <div className="rounded-[1.75rem] border border-white/10 bg-white/[0.04] px-6 py-10 text-center backdrop-blur-sm">
          <Route className="mx-auto h-10 w-10 text-white/25" />
          <p className="mt-4 font-headline text-lg font-bold text-white/80">No completed trips yet</p>
          <p className="mx-auto mt-2 max-w-md text-sm text-white/45">
            Plan and finish a journey to populate replay stats. Demo data appears automatically when the API runs without
            database rows.
          </p>
          {onOpenPlan && (
            <button
              type="button"
              onClick={onOpenPlan}
              className="mt-6 rounded-2xl bg-primary px-6 py-3 font-headline text-[10px] font-black uppercase tracking-widest text-surface"
            >
              Open plan
            </button>
          )}
        </div>
      )}

      {stats && (
        <>
          {/* KPI strip */}
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-4">
            {[
              {
                icon: Clock,
                label: 'Avg delay',
                value: derived.delayLabel,
                hint: 'vs predicted',
                color: 'text-primary',
              },
              {
                icon: TrendingUp,
                label: 'Reliability',
                value: derived.efficiency != null ? `${derived.efficiency}%` : '—',
                hint: 'avg across routes',
                color: 'text-secondary',
              },
              {
                icon: CreditCard,
                label: 'Est. spend',
                value: formatInr(derived.totalSpend),
                hint: `${derived.tripCount} data points`,
                color: 'text-white',
              },
              {
                icon: Calendar,
                label: 'Trips in window',
                value: `${derived.tripCount}`,
                hint: 'from cost trend',
                color: 'text-white/70',
              },
            ].map((kpi, idx) => (
              <motion.div
                key={kpi.label}
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.05 }}
                className="rounded-[1.35rem] border border-amber-200/10 bg-gradient-to-b from-amber-950/35 to-black/40 p-4 shadow-lg backdrop-blur-md md:p-5"
              >
                <kpi.icon className={`mb-3 h-5 w-5 ${kpi.color}`} />
                <span className="block text-[10px] font-black uppercase tracking-[0.2em] text-white/35">{kpi.label}</span>
                <p className="mt-1.5 font-headline text-xl font-black tracking-tight text-white md:text-2xl">{kpi.value}</p>
                <p className="mt-1 text-[10px] text-white/35">{kpi.hint}</p>
              </motion.div>
            ))}
          </div>

          <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
            {/* Charts column */}
            <div className="space-y-8 lg:col-span-2">
              <div className="rounded-[1.75rem] border border-amber-200/10 bg-gradient-to-b from-amber-950/30 to-black/45 p-5 shadow-xl backdrop-blur-md md:p-6">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <h3 className="flex items-center gap-2 font-headline text-[11px] font-black uppercase tracking-[0.2em] text-white/45">
                    <BarChart3 className="h-4 w-4 text-primary" />
                    Spend trend
                  </h3>
                  <span className="text-[10px] text-white/30">{costChart ? 'Indexed trip estimates' : 'No points'}</span>
                </div>
                <div className="mt-6 min-h-[140px]">
                  {costChart && stats.costTrend.length >= 2 ? (
                    <svg
                      className="h-36 w-full overflow-visible"
                      viewBox={`0 0 ${costChart.viewW} ${costChart.viewH}`}
                      preserveAspectRatio="none"
                    >
                      <defs>
                        <linearGradient id="costFill" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="rgb(255,191,0)" stopOpacity="0.25" />
                          <stop offset="100%" stopColor="rgb(255,191,0)" stopOpacity="0" />
                        </linearGradient>
                      </defs>
                      <path d={costChart.areaD} fill="url(#costFill)" />
                      <path
                        d={costChart.lineD}
                        fill="none"
                        className="stroke-primary"
                        strokeWidth="1.25"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        vectorEffect="non-scaling-stroke"
                      />
                      {costChart.dots.map((d, i) => (
                        <circle
                          key={`${d.date}-${i}`}
                          cx={d.cx}
                          cy={d.cy}
                          r="1.8"
                          className="fill-primary stroke-surface"
                          strokeWidth="0.6"
                        />
                      ))}
                    </svg>
                  ) : (
                    <p className="py-8 text-center text-sm text-white/35">Add more completed trips to see a trend line.</p>
                  )}
                  {stats.costTrend.length > 0 && (
                    <div className="mt-2 flex flex-wrap justify-between gap-2 border-t border-white/5 pt-3 text-[9px] font-bold uppercase tracking-wider text-white/25">
                      {stats.costTrend.slice(0, 3).map((p) => (
                        <span key={p.date}>{p.date}</span>
                      ))}
                      {stats.costTrend.length > 3 && <span>…</span>}
                      <span>{stats.costTrend[stats.costTrend.length - 1]?.date}</span>
                    </div>
                  )}
                </div>
              </div>

              <div>
                <h3 className="mb-4 flex items-center gap-2 px-1 font-headline text-[11px] font-black uppercase tracking-[0.2em] text-white/40">
                  <TrendingUp className="h-4 w-4 text-primary" />
                  Route reliability
                </h3>
                <div className="space-y-3">
                  {(stats.reliabilityByRoute ?? []).length === 0 ? (
                    <p className="text-sm text-white/35">No route scores yet.</p>
                  ) : (
                    (stats.reliabilityByRoute ?? []).map((r) => (
                      <div
                        key={r.route}
                        className="rounded-2xl border border-white/8 bg-white/[0.04] px-4 py-3 backdrop-blur-sm"
                      >
                        <div className="flex items-center justify-between gap-3 text-sm">
                          <span className="truncate font-medium text-white/75" title={r.route}>
                            {r.route}
                          </span>
                          <span className="shrink-0 font-headline font-black text-primary">{Math.round(r.score)}%</span>
                        </div>
                        <div className="mt-2 h-2 overflow-hidden rounded-full bg-black/40">
                          <div
                            className="h-full rounded-full bg-gradient-to-r from-primary/80 to-secondary/70 transition-all"
                            style={{ width: `${Math.min(100, Math.max(0, r.score))}%` }}
                          />
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div>
                <h3 className="mb-4 px-1 font-headline text-[11px] font-black uppercase tracking-[0.2em] text-white/40">
                  Peak-hour delay index
                </h3>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {peakNormalized.length === 0 ? (
                    <p className="col-span-full text-sm text-white/35">No hourly breakdown.</p>
                  ) : (
                    peakNormalized.map((row) => (
                      <div key={row.hour} className="rounded-xl border border-white/8 bg-white/[0.03] px-3 py-2">
                        <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-widest text-white/35">
                          <span>{row.hour}:00</span>
                          <span className="text-white/50">{Math.round(row.delay)}m</span>
                        </div>
                        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-black/35">
                          <div className="h-full rounded-full bg-primary/70" style={{ width: `${row.pct}%` }} />
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div>
                <h4 className="mb-3 px-1 text-[10px] font-black uppercase tracking-[0.2em] text-white/30">Patterns</h4>
                <div className="space-y-2">
                  {(stats.patterns ?? []).length === 0 ? (
                    <p className="rounded-2xl border border-white/6 bg-white/[0.03] px-4 py-4 text-sm text-white/40">
                      No pattern flags for this window. Once you have more variance in delays, insights will appear here.
                    </p>
                  ) : (
                    (stats.patterns ?? []).map((p, i) => (
                      <div
                        key={i}
                        className="flex gap-3 rounded-2xl border border-white/8 bg-white/[0.04] px-4 py-3 backdrop-blur-sm"
                      >
                        <Info className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
                        <p className="text-sm leading-relaxed text-white/65">{p}</p>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>

            {/* Recommendations */}
            <div className="space-y-5">
              <h3 className="flex items-center gap-2 font-headline text-[11px] font-black uppercase tracking-[0.2em] text-red-300/80">
                <AlertCircle className="h-4 w-4" />
                Recommendations
              </h3>
              <div className="space-y-4">
                {recommendations.length === 0 ? (
                  <p className="text-sm text-white/40">No suggestions returned from the API.</p>
                ) : (
                  recommendations.map((rec, i) => (
                    <motion.div
                      key={`${rec.title}-${i}`}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.06 }}
                      className="rounded-[1.35rem] border border-white/10 bg-white/[0.05] p-5 backdrop-blur-md"
                    >
                      <div className="mb-3 flex items-center justify-between gap-2">
                        <span
                          className={`rounded-lg border px-2 py-1 font-headline text-[9px] font-black uppercase tracking-widest ${impactStyles(rec.impact)}`}
                        >
                          {rec.impact} priority
                        </span>
                        {rec.type === 'Time' ? (
                          <Clock className="h-4 w-4 text-white/25" />
                        ) : rec.type === 'Cost' ? (
                          <CreditCard className="h-4 w-4 text-white/25" />
                        ) : (
                          <Shield className="h-4 w-4 text-white/25" />
                        )}
                      </div>
                      <h4 className="font-headline text-base font-bold text-white">{rec.title}</h4>
                      <p className="mt-2 text-sm leading-relaxed text-white/50">{rec.suggestion}</p>
                      {onOpenPlan && (
                        <button
                          type="button"
                          onClick={onOpenPlan}
                          className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl border border-white/10 bg-black/30 py-3 font-headline text-[10px] font-black uppercase tracking-widest text-white/75 transition-colors hover:bg-white/10"
                        >
                          Adjust in plan
                          <ChevronRight className="h-4 w-4" />
                        </button>
                      )}
                    </motion.div>
                  ))
                )}
              </div>

              <div className="rounded-[1.35rem] border border-primary/25 bg-primary/10 p-5">
                <div className="flex items-center gap-3">
                  <FileText className="h-6 w-6 text-primary" />
                  <div>
                    <span className="block font-headline text-[11px] font-black uppercase tracking-widest text-primary">
                      Replay audit
                    </span>
                    <span className="text-[10px] text-white/40">
                      {new Date().toLocaleString('en-IN', { month: 'short', year: 'numeric' })}
                    </span>
                  </div>
                </div>
                <p className="mt-3 text-xs leading-relaxed text-white/45">
                  Export bundles raw insights plus recommendations for your own spreadsheets or debugging.
                </p>
              </div>
            </div>
          </div>
        </>
      )}

      {loading && stats && (
        <p className="text-center text-[10px] font-black uppercase tracking-widest text-white/30">Refreshing…</p>
      )}
    </div>
  );
};

export default CommuteReplayDashboard;