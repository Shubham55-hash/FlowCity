/**
 * NavigationView.tsx  — Multi-modal route navigator
 *
 * Architecture:
 *  • Fetches a real OSRM road/walk polyline PER SEGMENT (not one big driving route).
 *  • Draws each segment in its mode color with glow.
 *  • Places prominent "TRANSFER HERE" markers at every mode-switch boundary.
 *  • Shows a step-by-step bottom sheet that highlights the active leg and
 *    calls out exact transfer stations with wait times.
 */

import React, { useEffect, useRef, useState, useCallback } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { motion, AnimatePresence } from 'motion/react';
import {
  ArrowLeft, Navigation, Clock, MapPin, ChevronRight,
  ChevronLeft, Zap, RotateCcw, Car, Train, Bus,
  PersonStanding, Bike, AlertTriangle, ArrowRightLeft
} from 'lucide-react';
import { Route, RouteSegment } from '../store/journeySlice';

// ─── Types ─────────────────────────────────────────────────────────────────────
type LatLng = { lat: number; lng: number };

interface DrawnSegment {
  seg: RouteSegment;
  polyline: LatLng[];
  color: string;
  isTransfer: boolean;   // true = previous segment had different mode
  transferLabel: string; // "Board Local Train at Virar Station"
}

// ─── OSRM ──────────────────────────────────────────────────────────────────────
async function fetchOSRMPolyline(
  from: LatLng,
  to: LatLng,
  profile: 'driving' | 'foot' = 'driving'
): Promise<LatLng[]> {
  try {
    const url = `https://router.project-osrm.org/route/v1/${profile}/${from.lng},${from.lat};${to.lng},${to.lat}?overview=full&geometries=geojson`;
    const res  = await fetch(url, { signal: AbortSignal.timeout(6000) });
    const data = await res.json();
    const coords: [number, number][] = data?.routes?.[0]?.geometry?.coordinates ?? [];
    if (coords.length < 2) return [from, to];
    return coords.map(([lng, lat]) => ({ lat, lng }));
  } catch {
    return [from, to];
  }
}

// ─── Colour / mode helpers ─────────────────────────────────────────────────────
const MODE_META: Record<string, { color: string; emoji: string; label: string; profile: 'driving' | 'foot' }> = {
  walk:        { color: '#4ade80', emoji: '🚶', label: 'Walk',        profile: 'foot'    },
  local_train: { color: '#38bdf8', emoji: '🚂', label: 'Local Train', profile: 'driving' },
  train:       { color: '#38bdf8', emoji: '🚂', label: 'Local Train', profile: 'driving' },
  metro:       { color: '#a78bfa', emoji: '🚇', label: 'Metro',       profile: 'driving' },
  bus:         { color: '#fb923c', emoji: '🚌', label: 'Bus',         profile: 'driving' },
  uber:        { color: '#e2e8f0', emoji: '🚗', label: 'Uber Go',     profile: 'driving' },
  ola:         { color: '#3cd070', emoji: '🚕', label: 'Ola Mini',    profile: 'driving' },
  rapido:      { color: '#ffcf00', emoji: '🛵', label: 'Rapido',      profile: 'driving' },
  cab:         { color: '#fbbf24', emoji: '🚖', label: 'Cab',         profile: 'driving' },
};
const DEFAULT_META = { color: '#ffbf00', emoji: '📍', label: 'Transit', profile: 'driving' as const };

function getMeta(mode: string) {
  const m = (mode ?? '').toLowerCase();
  for (const [k, v] of Object.entries(MODE_META)) {
    if (m.includes(k)) return v;
  }
  return DEFAULT_META;
}

// ─── Leaflet icon builders ─────────────────────────────────────────────────────
function originIcon(label: string): L.DivIcon {
  return L.divIcon({
    className: '',
    iconSize: [44, 58], iconAnchor: [22, 58],
    html: `<div style="display:flex;flex-direction:column;align-items:center;">
      <div style="width:44px;height:44px;border-radius:50%;background:linear-gradient(135deg,#ffbf00,#ff8c00);
        border:3px solid #fff;box-shadow:0 0 18px rgba(255,191,0,.7),0 3px 12px rgba(0,0,0,.5);
        display:flex;align-items:center;justify-content:center;font-size:20px;">🔴</div>
      <div style="width:3px;height:14px;background:linear-gradient(to bottom,#ffbf00,transparent);border-radius:0 0 3px 3px;"></div>
      <div style="margin-top:2px;background:rgba(0,0,0,.85);color:#ffbf00;font:700 10px/14px system-ui;
        padding:2px 6px;border-radius:4px;white-space:nowrap;max-width:110px;overflow:hidden;text-overflow:ellipsis;
        border:1px solid rgba(255,191,0,.4);">${label}</div>
    </div>`,
  });
}

function destIcon(label: string): L.DivIcon {
  return L.divIcon({
    className: '',
    iconSize: [44, 58], iconAnchor: [22, 58],
    html: `<div style="display:flex;flex-direction:column;align-items:center;">
      <div style="width:44px;height:44px;border-radius:50%;background:linear-gradient(135deg,#22c55e,#16a34a);
        border:3px solid #fff;box-shadow:0 0 18px rgba(34,197,94,.7),0 3px 12px rgba(0,0,0,.5);
        display:flex;align-items:center;justify-content:center;font-size:20px;">🏁</div>
      <div style="width:3px;height:14px;background:linear-gradient(to bottom,#22c55e,transparent);border-radius:0 0 3px 3px;"></div>
      <div style="margin-top:2px;background:rgba(0,0,0,.85);color:#22c55e;font:700 10px/14px system-ui;
        padding:2px 6px;border-radius:4px;white-space:nowrap;max-width:110px;overflow:hidden;text-overflow:ellipsis;
        border:1px solid rgba(34,197,94,.4);">${label}</div>
    </div>`,
  });
}

function transferIcon(color: string, emoji: string, stationName: string): L.DivIcon {
  return L.divIcon({
    className: '',
    iconSize:  [52, 68], iconAnchor: [26, 68],
    html: `<div style="display:flex;flex-direction:column;align-items:center;">
      <div style="position:relative;width:52px;height:52px;">
        <div style="width:52px;height:52px;border-radius:50%;background:${color};
          border:4px solid #fff;box-shadow:0 0 22px ${color}bb,0 4px 14px rgba(0,0,0,.6);
          display:flex;align-items:center;justify-content:center;font-size:22px;">${emoji}</div>
        <div style="position:absolute;top:-6px;right:-4px;background:#ef4444;color:#fff;
          font:800 8px/12px system-ui;padding:2px 5px;border-radius:99px;border:2px solid #fff;
          white-space:nowrap;letter-spacing:.05em;">SWITCH</div>
      </div>
      <div style="width:3px;height:14px;background:linear-gradient(to bottom,${color},transparent);"></div>
      <div style="margin-top:1px;background:rgba(0,0,0,.9);color:${color};font:700 10px/14px system-ui;
        padding:3px 7px;border-radius:5px;white-space:nowrap;max-width:130px;overflow:hidden;text-overflow:ellipsis;
        border:1px solid ${color}60;text-align:center;">${stationName}</div>
    </div>`,
  });
}

function liveUserIcon(): L.DivIcon {
  return L.divIcon({
    className: '',
    iconSize: [22, 22], iconAnchor: [11, 11],
    html: `<div style="width:22px;height:22px;border-radius:50%;background:#3b82f6;border:3px solid #fff;
      box-shadow:0 0 14px rgba(59,130,246,.8),0 0 0 8px rgba(59,130,246,.15);"></div>`,
  });
}

// ─── Tiny React icon ───────────────────────────────────────────────────────────
function ModeIcon({ mode, style = {} }: { mode: string; style?: React.CSSProperties }) {
  const m = (mode ?? '').toLowerCase();
  const cls = 'w-4 h-4 shrink-0';
  if (m.includes('train') || m.includes('local')) return <Train  className={cls} style={style} />;
  if (m.includes('metro'))  return <Train         className={cls} style={style} />;
  if (m.includes('bus'))    return <Bus           className={cls} style={style} />;
  if (m.includes('walk'))   return <PersonStanding className={cls} style={style} />;
  if (m.includes('bike') || m.includes('rapido')) return <Bike   className={cls} style={style} />;
  return <Car className={cls} style={style} />;
}

// ─── Derive a short station/place name from segment instructions ────────────────
function deriveStationName(seg: RouteSegment): string {
  const instr = seg.instructions ?? '';
  // Try "at X Station" / "X Station" patterns
  const atMatch = instr.match(/at\s+(.+?)(?:\s+Station|\s+Stop|\s+Metro)?$/i);
  if (atMatch) return atMatch[1].trim();
  const stMatch = instr.match(/^(.+?)\s+(?:Station|Stop|Metro)/i);
  if (stMatch) return stMatch[1].trim();
  // Fall back to first noun phrase
  return instr.split(/\s+to\s+/i)[0]?.trim() || instr;
}

// ─── Component ─────────────────────────────────────────────────────────────────
interface NavigationViewProps {
  route: Route;
  onBack: () => void;
}

export default function NavigationView({ route, onBack }: NavigationViewProps) {
  const elRef         = useRef<HTMLDivElement>(null);
  const mapRef        = useRef<L.Map | null>(null);
  const layersRef     = useRef<L.Layer[]>([]);
  const liveMarkerRef = useRef<L.Marker | null>(null);

  const [drawnSegs, setDrawnSegs]   = useState<DrawnSegment[]>([]);
  const [loading, setLoading]       = useState(true);
  const [activeLeg, setActiveLeg]   = useState(0);
  const [showPanel, setShowPanel]   = useState(true);
  const [liveEta, setLiveEta]       = useState(route.eta);
  const [progress, setProgress]     = useState(0);
  const [totalKm, setTotalKm]       = useState(0);

  const routeFrom = route.fromCoords;
  const routeTo   = route.toCoords;

  // ── Init map ────────────────────────────────────────────────────────────────
  useEffect(() => {
    const el = elRef.current;
    if (!el || mapRef.current) return;
    const map = L.map(el, { zoomControl: false, preferCanvas: true });
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; <a href="https://carto.com/">CARTO</a>',
      subdomains: 'abcd', maxZoom: 20,
    }).addTo(map);
    L.control.zoom({ position: 'topright' }).addTo(map);
    mapRef.current = map;
    const ro = new ResizeObserver(() => map.invalidateSize());
    ro.observe(el);
    const t = setTimeout(() => map.invalidateSize(), 200);
    return () => { clearTimeout(t); ro.disconnect(); map.remove(); mapRef.current = null; };
  }, []);

  // ── Build per-segment OSRM polylines and draw ───────────────────────────────
  const drawRoute = useCallback(async () => {
    const map = mapRef.current;
    if (!map) { setLoading(false); return; }

    setLoading(true);
    layersRef.current.forEach(l => map.removeLayer(l));
    layersRef.current = [];
    const addL = (l: L.Layer) => { l.addTo(map); layersRef.current.push(l); };

    const segs = route.segments ?? [];
    const allBounds: L.LatLngTuple[] = [];
    const drawn: DrawnSegment[] = [];
    let cumDistKm = 0;

    // We need lat/lng per segment. Build them from:
    //  • seg.fromLatLng / seg.toLatLng  (from simulation)
    //  • or fall back to interpolating along the global routeGeometry
    const globalGeom = route.routeGeometry ?? [];
    const totalSegDuration = segs.reduce((s, seg) => s + (seg.duration || 1), 0) || 1;

    // Build endPoints array: one lat/lng per segment boundary (start + all ends)
    const endPoints: (LatLng | null)[] = [];
    let geomOffset = 0;

    for (let i = 0; i < segs.length; i++) {
      const seg = segs[i];
      if (seg.fromLatLng && Number.isFinite(seg.fromLatLng.lat)) {
        endPoints.push(seg.fromLatLng);
      } else if (globalGeom.length > 0) {
        const frac = (segs.slice(0, i).reduce((s, s2) => s + (s2.duration || 1), 0)) / totalSegDuration;
        const idx  = Math.min(Math.floor(frac * (globalGeom.length - 1)), globalGeom.length - 1);
        endPoints.push(globalGeom[idx]);
      } else {
        endPoints.push(i === 0 ? routeFrom ?? null : null);
      }
    }
    // Add final destination
    {
      const lastSeg = segs[segs.length - 1];
      if (lastSeg?.toLatLng && Number.isFinite(lastSeg.toLatLng.lat)) {
        endPoints.push(lastSeg.toLatLng);
      } else if (globalGeom.length > 0) {
        endPoints.push(globalGeom[globalGeom.length - 1]);
      } else {
        endPoints.push(routeTo ?? null);
      }
    }

    // Fetch polyline per segment
    for (let i = 0; i < segs.length; i++) {
      const seg  = segs[i];
      const from = endPoints[i];
      const to   = endPoints[i + 1];
      const meta = getMeta(seg.mode);
      const isTransfer = i > 0 && segs[i - 1].mode.toLowerCase() !== seg.mode.toLowerCase() && !seg.mode.toLowerCase().includes('walk');

      let polyline: LatLng[];
      if (from && to && Number.isFinite(from.lat) && Number.isFinite(to.lat)) {
        polyline = await fetchOSRMPolyline(from, to, meta.profile);
      } else if (globalGeom.length > 0) {
        // slice global geometry
        const fracStart = segs.slice(0, i).reduce((s, s2) => s + (s2.duration || 1), 0) / totalSegDuration;
        const fracEnd   = segs.slice(0, i + 1).reduce((s, s2) => s + (s2.duration || 1), 0) / totalSegDuration;
        const idxStart  = Math.floor(fracStart * (globalGeom.length - 1));
        const idxEnd    = Math.min(Math.ceil(fracEnd * (globalGeom.length - 1)) + 1, globalGeom.length);
        polyline = globalGeom.slice(idxStart, idxEnd);
        if (polyline.length < 2) polyline = globalGeom;
      } else {
        polyline = [routeFrom ?? { lat: 19.07, lng: 72.87 }, routeTo ?? { lat: 19.07, lng: 72.87 }];
      }

      // Approximate distance for this leg
      let segKm = 0;
      for (let j = 1; j < polyline.length; j++) {
        const dLat = (polyline[j].lat - polyline[j-1].lat) * Math.PI / 180;
        const dLng = (polyline[j].lng - polyline[j-1].lng) * Math.PI / 180;
        const a = Math.sin(dLat/2)**2 + Math.cos(polyline[j-1].lat*Math.PI/180) * Math.cos(polyline[j].lat*Math.PI/180) * Math.sin(dLng/2)**2;
        segKm += 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
      }
      cumDistKm += segKm;

      const latlngs = polyline.map(p => [p.lat, p.lng] as L.LatLngTuple);
      allBounds.push(...latlngs);

      // ── Draw glow + line ──
      addL(L.polyline(latlngs, { color: meta.color + '44', weight: 16, lineCap: 'round', lineJoin: 'round' }));
      addL(L.polyline(latlngs, {
        color: meta.color, weight: seg.mode.toLowerCase().includes('walk') ? 3 : 6,
        opacity: 0.95, lineCap: 'round', lineJoin: 'round',
        dashArray: seg.mode.toLowerCase().includes('walk') ? '8 11' : undefined,
      }));

      // ── Transfer marker at START of this leg (if mode changed) ──
      const startPt = latlngs[0];
      if (startPt) {
        if (i === 0) {
          // Origin
          addL(L.marker(startPt, { icon: originIcon(route.from || 'Start'), zIndexOffset: 1000 }));
        } else if (isTransfer) {
          // Transfer station
          const stationName = deriveStationName(seg);
          const prevMeta = getMeta(segs[i - 1].mode);
          const popup = `<div style="font:700 12px system-ui;color:${meta.color};padding:4px 0;">
            🔄 Transfer here<br/>
            <span style="color:#aaa;font-weight:400;font-size:10px;">
              Alight ${prevMeta.emoji} ${prevMeta.label} →
              Board ${meta.emoji} ${meta.label}
            </span>
          </div>`;
          addL(
            L.marker(startPt, { icon: transferIcon(meta.color, meta.emoji, stationName), zIndexOffset: 900 })
              .bindPopup(popup)
          );
        } else {
          // Intermediate waypoint (same mode continuation or walk)
          addL(L.circleMarker(startPt, {
            radius: 5, color: '#fff', weight: 2,
            fillColor: meta.color, fillOpacity: 0.9,
          }).bindTooltip(`${meta.emoji} ${seg.instructions ?? seg.mode}`, { direction: 'top' }));
        }
      }

      drawn.push({
        seg,
        polyline,
        color: meta.color,
        isTransfer,
        transferLabel: isTransfer
          ? `Board ${meta.label} at ${deriveStationName(seg)}`
          : '',
      });
    }

    // Destination marker
    const lastEnd = endPoints[endPoints.length - 1];
    if (lastEnd && Number.isFinite(lastEnd.lat)) {
      addL(L.marker([lastEnd.lat, lastEnd.lng], { icon: destIcon(route.to || 'Destination'), zIndexOffset: 1000 }));
    }

    setDrawnSegs(drawn);
    setTotalKm(Math.round(cumDistKm * 10) / 10);

    if (allBounds.length >= 2)
      map.fitBounds(L.latLngBounds(allBounds), { padding: [70, 70], maxZoom: 14 });
    else if (allBounds.length === 1)
      map.setView(allBounds[0], 13);

    setLoading(false);
  }, [route, routeFrom, routeTo]);

  useEffect(() => { drawRoute(); }, [drawRoute]);

  // ── Simulated GPS dot along first segment's polyline ────────────────────────
  useEffect(() => {
    if (drawnSegs.length === 0) return;
    const allPts: LatLng[] = drawnSegs.flatMap(ds => ds.polyline);
    if (allPts.length < 2) return;
    const total = allPts.length;
    let step = 0;
    const iv = setInterval(() => {
      if (step >= total - 1) { clearInterval(iv); return; }
      step++;
      setProgress(Math.round((step / (total - 1)) * 100));
      const p   = allPts[step];
      const map = mapRef.current;
      if (!map || !p) return;
      if (!liveMarkerRef.current) {
        liveMarkerRef.current = L.marker([p.lat, p.lng], { icon: liveUserIcon(), zIndexOffset: 2000 }).addTo(map);
      } else {
        liveMarkerRef.current.setLatLng([p.lat, p.lng]);
      }
      const pctDone = step / total;
      // Auto-advance active leg as GPS progresses
      const cumFracs = drawnSegs.map((_, i) =>
        drawnSegs.slice(0, i + 1).reduce((s, ds) => s + ds.polyline.length, 0) / total
      );
      const newLeg = cumFracs.findIndex(f => pctDone <= f);
      if (newLeg >= 0 && newLeg !== activeLeg) setActiveLeg(newLeg);
      setLiveEta(Math.max(0, Math.round((1 - pctDone) * route.eta)));
    }, 500);
    return () => clearInterval(iv);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [drawnSegs, route.eta]);

  // ── Pan to active leg on selection ─────────────────────────────────────────
  useEffect(() => {
    const ds = drawnSegs[activeLeg];
    const map = mapRef.current;
    if (!ds || !map) return;
    const midPt = ds.polyline[Math.floor(ds.polyline.length / 2)];
    if (midPt && Number.isFinite(midPt.lat)) {
      map.setView([midPt.lat, midPt.lng], 14, { animate: true });
    }
  }, [activeLeg, drawnSegs]);

  const modeForGmaps = (route.mode ?? '').toLowerCase().includes('walk') ? 'walking'
    : (route.mode ?? '').toLowerCase().match(/train|metro|bus/) ? 'transit'
    : 'driving';

  // Count real transfer points
  const transferCount = drawnSegs.filter(ds => ds.isTransfer).length;

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-surface">

      {/* ── Floating top bar ── */}
      <div className="absolute top-0 left-0 right-0 z-30 flex items-center gap-2.5 px-4 pt-6 pb-4 pointer-events-none">
        <button onClick={onBack}
          className="pointer-events-auto shrink-0 p-2.5 rounded-2xl bg-surface/85 border border-white/10 backdrop-blur-xl text-white/80 hover:text-white transition-colors shadow-xl">
          <ArrowLeft className="w-5 h-5" />
        </button>

        <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
          className="pointer-events-auto flex-1 flex items-center gap-2.5 px-3.5 py-2.5 rounded-2xl bg-surface/90 border border-white/10 backdrop-blur-xl shadow-xl">
          <Navigation className="w-4 h-4 text-primary shrink-0" />
          <div className="min-w-0 flex-1">
            <p className="text-[9px] font-black uppercase tracking-widest text-white/35 leading-none">Navigating to</p>
            <p className="text-sm font-bold text-white truncate mt-0.5">{route.to}</p>
          </div>
          {/* Mode pills */}
          <div className="flex items-center gap-1 shrink-0">
            {(route.segments ?? []).filter((_, i) => i === 0 || (route.segments ?? [])[i].mode !== (route.segments ?? [])[i-1].mode).slice(0,4).map((seg, i) => {
              const meta = getMeta(seg.mode);
              return (
                <span key={i} className="text-sm" title={meta.label}>{meta.emoji}</span>
              );
            })}
          </div>
          <div className="shrink-0 text-right border-l border-white/10 pl-2.5">
            <p className="text-xl font-black text-primary leading-none">{liveEta}</p>
            <p className="text-[8px] text-white/35 font-black uppercase tracking-wider">min</p>
          </div>
        </motion.div>

        <button onClick={drawRoute}
          className="pointer-events-auto shrink-0 p-2.5 rounded-2xl bg-surface/85 border border-white/10 backdrop-blur-xl text-white/60 hover:text-primary transition-colors shadow-xl">
          <RotateCcw className="w-4 h-4" />
        </button>
      </div>

      {/* ── Map ── */}
      <div className="relative flex-1 overflow-hidden">
        <div ref={elRef} className="absolute inset-0" />

        {/* Loading overlay */}
        <AnimatePresence>
          {loading && (
            <motion.div initial={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="absolute inset-0 z-20 flex items-center justify-center bg-surface/70 backdrop-blur-sm">
              <div className="flex flex-col items-center gap-3">
                <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                  className="w-10 h-10 border-2 border-primary/25 border-t-primary rounded-full" />
                <p className="text-[11px] font-black uppercase tracking-widest text-white/45">
                  Plotting {route.segments?.length ?? 1} route legs…
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Progress */}
        {progress > 0 && (
          <div className="absolute top-0 left-0 right-0 z-20 h-[3px] bg-white/5">
            <motion.div className="h-full bg-primary rounded-r-full"
              animate={{ width: `${progress}%` }} transition={{ type: 'spring', damping: 30 }} />
          </div>
        )}

        {/* Info chips */}
        <div className="absolute bottom-36 right-4 z-20 flex flex-col gap-2">
          {totalKm > 0 && (
            <div className="px-3 py-2 rounded-xl bg-surface/85 border border-white/10 backdrop-blur-xl text-center shadow-lg">
              <p className="text-xs font-black text-white/80">{totalKm} km</p>
              <p className="text-[9px] text-white/40 font-bold uppercase tracking-widest">total</p>
            </div>
          )}
          {transferCount > 0 && (
            <div className="px-3 py-2 rounded-xl bg-red-950/70 border border-red-500/30 backdrop-blur-xl text-center shadow-lg">
              <p className="text-xs font-black text-red-400">{transferCount}</p>
              <p className="text-[9px] text-red-400/70 font-bold uppercase tracking-widest">transfers</p>
            </div>
          )}
        </div>

        {/* Steps toggle */}
        <button onClick={() => setShowPanel(v => !v)}
          className="absolute bottom-4 right-4 z-20 flex items-center gap-1.5 px-3 py-2 rounded-xl bg-surface/85 border border-white/10 backdrop-blur-xl text-white/70 hover:text-primary transition-colors text-[11px] font-bold shadow-lg">
          {showPanel ? <ChevronLeft className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
          {showPanel ? 'Hide' : 'Legs'}
        </button>
      </div>

      {/* ── Bottom sheet ── */}
      <AnimatePresence>
        {showPanel && (
          <motion.div
            key="panel"
            initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
            transition={{ type: 'spring', stiffness: 280, damping: 28 }}
            className="relative z-20 bg-surface/96 backdrop-blur-2xl border-t border-white/8 flex flex-col"
            style={{ maxHeight: '46vh' }}
          >
            {/* Summary header */}
            <div className="flex items-center gap-3 px-4 py-3 border-b border-white/5 shrink-0">
              {/* Mode chain */}
              <div className="flex items-center gap-1 flex-wrap">
                {(route.segments ?? []).map((seg, i) => {
                  const meta = getMeta(seg.mode);
                  const prevMode = i > 0 ? (route.segments ?? [])[i-1].mode : seg.mode;
                  const showArrow = i > 0 && seg.mode !== prevMode;
                  return (
                    <span key={i} className="flex items-center gap-0.5">
                      {showArrow && <ChevronRight className="w-3 h-3 text-white/20" />}
                      <button
                        onClick={() => setActiveLeg(i)}
                        className={`px-2 py-1 rounded-lg text-[10px] font-black transition-all ${
                          i === activeLeg
                            ? 'text-surface'
                            : 'text-white/50 bg-white/5 hover:bg-white/10'
                        }`}
                        style={i === activeLeg ? { background: meta.color } : {}}
                      >
                        {meta.emoji} {meta.label}
                      </button>
                    </span>
                  );
                })}
              </div>
              <div className="flex-1" />
              <div className="flex items-center gap-3 text-[11px] font-bold text-white/40 shrink-0">
                <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{route.eta} min</span>
                {totalKm > 0 && <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{totalKm} km</span>}
              </div>
            </div>

            {/* Leg list */}
            <div className="flex-1 overflow-y-auto px-4 py-3 space-y-0">
              {drawnSegs.length === 0 && !loading && (
                <div className="py-6 text-center">
                  <AlertTriangle className="w-5 h-5 text-amber-400 mx-auto mb-1.5" />
                  <p className="text-xs text-white/40">Route leg data unavailable.</p>
                </div>
              )}

              {drawnSegs.map((ds, i) => {
                const meta    = getMeta(ds.seg.mode);
                const isLast  = i === drawnSegs.length - 1;
                const isActive = i === activeLeg;
                const approxSegKm = (() => {
                  let km = 0;
                  const pl = ds.polyline;
                  for (let j = 1; j < pl.length; j++) {
                    const dLat = (pl[j].lat - pl[j-1].lat) * Math.PI / 180;
                    const dLng = (pl[j].lng - pl[j-1].lng) * Math.PI / 180;
                    const a = Math.sin(dLat/2)**2 + Math.cos(pl[j-1].lat*Math.PI/180) * Math.cos(pl[j].lat*Math.PI/180) * Math.sin(dLng/2)**2;
                    km += 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
                  }
                  return Math.round(km * 10) / 10;
                })();

                return (
                  <div key={i}>
                    {/* Transfer callout banner */}
                    {ds.isTransfer && (
                      <div className="flex items-center gap-2 mb-2 px-3 py-2 rounded-xl bg-red-950/40 border border-red-500/25">
                        <ArrowRightLeft className="w-3.5 h-3.5 text-red-400 shrink-0" />
                        <div className="min-w-0">
                          <p className="text-[10px] font-black text-red-400 uppercase tracking-wide">Transfer Point</p>
                          <p className="text-[11px] text-white/60 truncate">{ds.transferLabel}</p>
                        </div>
                        {(ds.seg.waitTimeMin ?? 0) > 0 && (
                          <span className="shrink-0 text-[10px] font-bold text-amber-400 bg-amber-950/50 px-2 py-0.5 rounded-full">
                            {ds.seg.waitTimeMin} min wait
                          </span>
                        )}
                      </div>
                    )}

                    {/* Leg row */}
                    <button
                      onClick={() => setActiveLeg(i)}
                      className={`w-full flex gap-3 text-left rounded-2xl p-3 mb-1 transition-all border ${
                        isActive
                          ? 'border-opacity-40 bg-opacity-10'
                          : 'border-white/5 bg-white/[0.02] hover:bg-white/[0.06]'
                      }`}
                      style={isActive ? { borderColor: meta.color + '60', background: meta.color + '12' } : {}}
                    >
                      {/* Timeline spine */}
                      <div className="flex flex-col items-center shrink-0">
                        <div className="p-2 rounded-xl" style={{ background: meta.color + '22' }}>
                          <ModeIcon mode={ds.seg.mode} style={{ color: meta.color }} />
                        </div>
                        {!isLast && (
                          <div className="w-0.5 flex-1 my-1.5 rounded-full"
                            style={{ background: meta.color + '35', minHeight: '12px' }} />
                        )}
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0 pt-0.5">
                        <div className="flex items-start justify-between gap-2">
                          <p className="text-xs font-bold leading-snug" style={{ color: isActive ? meta.color : undefined }}>
                            {ds.seg.instructions || `${meta.emoji} ${meta.label}`}
                          </p>
                          <span className="shrink-0 text-[10px] font-black text-white/40 tabular-nums">
                            {ds.seg.duration} min
                          </span>
                        </div>
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 mt-1">
                          {approxSegKm > 0 && (
                            <span className="text-[10px] text-white/30">{approxSegKm} km</span>
                          )}
                          {(ds.seg.crowdLevel && ds.seg.crowdLevel !== 'Light') && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded-full font-bold"
                              style={{ background: meta.color + '22', color: meta.color }}>
                              {ds.seg.crowdLevel} crowd
                            </span>
                          )}
                          {(ds.seg.connectionRisk && ds.seg.connectionRisk !== 'None' && ds.seg.connectionRisk !== 'Low') && (
                            <span className="text-[10px] text-amber-400 bg-amber-950/50 px-1.5 py-0.5 rounded-full font-bold">
                              ⚠️ {ds.seg.connectionRisk} risk
                            </span>
                          )}
                        </div>
                      </div>
                    </button>
                  </div>
                );
              })}

              {/* Spacer */}
              <div className="h-2" />
            </div>

            {/* Google Maps & prev/next leg navigation */}
            <div className="px-4 py-3 border-t border-white/5 shrink-0 flex gap-2">
              <div className="flex gap-1.5">
                <button onClick={() => setActiveLeg(l => Math.max(0, l - 1))} disabled={activeLeg === 0}
                  className="p-2.5 rounded-xl bg-white/5 hover:bg-white/10 disabled:opacity-30 transition-all">
                  <ChevronLeft className="w-4 h-4 text-white/70" />
                </button>
                <button onClick={() => setActiveLeg(l => Math.min(drawnSegs.length - 1, l + 1))} disabled={activeLeg >= drawnSegs.length - 1}
                  className="p-2.5 rounded-xl bg-white/5 hover:bg-white/10 disabled:opacity-30 transition-all">
                  <ChevronRight className="w-4 h-4 text-white/70" />
                </button>
              </div>
              <span className="text-[10px] text-white/35 font-bold self-center px-1">
                Leg {activeLeg + 1} of {drawnSegs.length}
              </span>
              <div className="flex-1" />
              {routeFrom && routeTo && (
                <a
                  href={`https://www.google.com/maps/dir/?api=1&origin=${routeFrom.lat},${routeFrom.lng}&destination=${routeTo.lat},${routeTo.lng}&travelmode=${modeForGmaps}`}
                  target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl font-bold text-xs text-white transition-all hover:opacity-90"
                  style={{ background: 'linear-gradient(135deg,#4285F4,#34A853)' }}
                >
                  <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 fill-current"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/></svg>
                  Google Maps
                </a>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
