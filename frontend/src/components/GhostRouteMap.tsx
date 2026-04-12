import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { MapPin } from 'lucide-react';
import { RAIL_LINES } from '../utils/mumbaiRailGeometry';

type LatLng = { lat: number; lng: number };

type SegmentPath = {
  mode: string;
  points: LatLng[];
  label?: string;
};

type GhostRouteMapProps = {
  path?: LatLng[];
  segments?: SegmentPath[];
  fromLabel?: string;
  toLabel?: string;
  progress?: number;
};

// ─── Color palette ────────────────────────────────────────────────────────────
const MODE_COLORS: Record<string, { stroke: string; glow: string }> = {
  walk:        { stroke: '#4ade80', glow: 'rgba(74,222,128,0.35)' },
  local_train: { stroke: '#38bdf8', glow: 'rgba(56,189,248,0.35)' },
  train:       { stroke: '#38bdf8', glow: 'rgba(56,189,248,0.35)' },
  metro:       { stroke: '#a78bfa', glow: 'rgba(167,139,250,0.35)' },
  bus:         { stroke: '#fb923c', glow: 'rgba(251,146,60,0.35)'  },
  cab:         { stroke: '#fbbf24', glow: 'rgba(251,191,36,0.35)'  },
  uber:        { stroke: '#e2e8f0', glow: 'rgba(226,232,240,0.25)' },
  ola:         { stroke: '#3cd070', glow: 'rgba(60,208,112,0.30)'  },
  rapido:      { stroke: '#ffcf00', glow: 'rgba(255,207,0,0.30)'   },
  default:     { stroke: '#ffbf00', glow: 'rgba(255,191,0,0.30)'   },
};

function getModeColor(mode: string) {
  const m = (mode ?? '').toLowerCase();
  for (const [key, val] of Object.entries(MODE_COLORS)) {
    if (m.includes(key)) return val;
  }
  return MODE_COLORS.default;
}

// ─── SVG icon generator ───────────────────────────────────────────────────────
function makeDivIcon(svgContent: string, size = 36, color = '#ffbf00'): L.DivIcon {
  return L.divIcon({
    className: '',
    iconSize:  [size, size],
    iconAnchor: [size / 2, size / 2],
    popupAnchor: [0, -(size / 2)],
    html: `
      <div style="
        width:${size}px;height:${size}px;
        border-radius:50%;
        background:${color};
        border:3px solid rgba(255,255,255,0.9);
        box-shadow:0 0 12px ${color}88, 0 2px 8px rgba(0,0,0,0.6);
        display:flex;align-items:center;justify-content:center;
        overflow:hidden;
      ">
        ${svgContent}
      </div>`,
  });
}

// Source pin — gradient gold with a location needle
function sourceIcon(label: string): L.DivIcon {
  return L.divIcon({
    className: '',
    iconSize: [44, 56],
    iconAnchor: [22, 56],
    popupAnchor: [0, -58],
    html: `
      <div style="position:relative;width:44px;height:56px;display:flex;flex-direction:column;align-items:center;">
        <div style="
          width:44px;height:44px;border-radius:50%;
          background:linear-gradient(135deg,#ffbf00,#ff8c00);
          border:3px solid #fff;
          box-shadow:0 0 18px rgba(255,191,0,0.7),0 3px 12px rgba(0,0,0,0.5);
          display:flex;align-items:center;justify-content:center;
          font-size:20px;
        ">🔴</div>
        <div style="
          width:4px;height:14px;
          background:linear-gradient(to bottom,#ffbf00,transparent);
          border-radius:0 0 4px 4px;
        "></div>
        <div style="
          position:absolute;bottom:-18px;left:50%;transform:translateX(-50%);
          background:rgba(0,0,0,0.85);color:#ffbf00;
          font:700 10px/14px system-ui;
          padding:2px 6px;border-radius:4px;
          white-space:nowrap;max-width:100px;overflow:hidden;text-overflow:ellipsis;
          border:1px solid rgba(255,191,0,0.4);
        ">${label}</div>
      </div>`,
  });
}

// Destination pin — green flag
function destIcon(label: string): L.DivIcon {
  return L.divIcon({
    className: '',
    iconSize: [44, 56],
    iconAnchor: [22, 56],
    popupAnchor: [0, -58],
    html: `
      <div style="position:relative;width:44px;height:56px;display:flex;flex-direction:column;align-items:center;">
        <div style="
          width:44px;height:44px;border-radius:50%;
          background:linear-gradient(135deg,#13ff43,#00c830);
          border:3px solid #fff;
          box-shadow:0 0 18px rgba(19,255,67,0.6),0 3px 12px rgba(0,0,0,0.5);
          display:flex;align-items:center;justify-content:center;
          font-size:20px;
        ">🏁</div>
        <div style="
          width:4px;height:14px;
          background:linear-gradient(to bottom,#13ff43,transparent);
          border-radius:0 0 4px 4px;
        "></div>
        <div style="
          position:absolute;bottom:-18px;left:50%;transform:translateX(-50%);
          background:rgba(0,0,0,0.85);color:#13ff43;
          font:700 10px/14px system-ui;
          padding:2px 6px;border-radius:4px;
          white-space:nowrap;max-width:100px;overflow:hidden;text-overflow:ellipsis;
          border:1px solid rgba(19,255,67,0.4);
        ">${label}</div>
      </div>`,
  });
}

// Mode-specific waypoint icons
const MODE_ICONS: Record<string, { emoji: string; color: string }> = {
  walk:        { emoji: '🚶', color: '#4ade80' },
  local_train: { emoji: '🚂', color: '#38bdf8' },
  train:       { emoji: '🚂', color: '#38bdf8' },
  metro:       { emoji: '🚇', color: '#a78bfa' },
  bus:         { emoji: '🚌', color: '#fb923c' },
  cab:         { emoji: '🚕', color: '#fbbf24' },
  uber:        { emoji: '🚗', color: '#e2e8f0' },
  ola:         { emoji: '🟢', color: '#3cd070' },
  rapido:      { emoji: '🛵', color: '#ffcf00' },
  default:     { emoji: '📍', color: '#ffbf00' },
};

function getModeEmoji(mode: string) {
  const m = (mode ?? '').toLowerCase();
  for (const [key, val] of Object.entries(MODE_ICONS)) {
    if (m.includes(key)) return val;
  }
  return MODE_ICONS.default;
}

function waypointIcon(mode: string, label: string): L.DivIcon {
  const { emoji, color } = getModeEmoji(mode);
  return L.divIcon({
    className: '',
    iconSize: [34, 34],
    iconAnchor: [17, 17],
    popupAnchor: [0, -20],
    html: `
      <div title="${label || ''}" style="
        width:34px;height:34px;border-radius:50%;
        background:${color};
        border:2.5px solid rgba(255,255,255,0.85);
        box-shadow:0 0 10px ${color}99,0 2px 6px rgba(0,0,0,0.5);
        display:flex;align-items:center;justify-content:center;
        font-size:16px;cursor:pointer;
      ">${emoji}</div>`,
  });
}

// ─── OSRM fetchers ────────────────────────────────────────────────────────────
async function fetchOSRMPolyline(from: LatLng, to: LatLng): Promise<LatLng[]> {
  try {
    const url = `https://router.project-osrm.org/route/v1/driving/${from.lng},${from.lat};${to.lng},${to.lat}?overview=full&geometries=geojson`;
    const res  = await fetch(url, { signal: AbortSignal.timeout(4000) });
    const data = await res.json();
    const coords: [number, number][] = data?.routes?.[0]?.geometry?.coordinates ?? [];
    return coords.map(([lng, lat]) => ({ lat, lng }));
  } catch {
    return [from, to];
  }
}

async function fetchWalkPolyline(from: LatLng, to: LatLng): Promise<LatLng[]> {
  try {
    const url = `https://router.project-osrm.org/route/v1/foot/${from.lng},${from.lat};${to.lng},${to.lat}?overview=full&geometries=geojson`;
    const res  = await fetch(url, { signal: AbortSignal.timeout(4000) });
    const data = await res.json();
    const coords: [number, number][] = data?.routes?.[0]?.geometry?.coordinates ?? [];
    return coords.map(([lng, lat]) => ({ lat, lng }));
  } catch {
    return [from, to];
  }
}

// ─── Component ────────────────────────────────────────────────────────────────
export default function GhostRouteMap({
  path = [],
  segments = [],
  fromLabel = 'Start',
  toLabel   = 'End',
  progress  = 0,
}: GhostRouteMapProps) {
  const elRef     = useRef<HTMLDivElement>(null);
  const mapRef    = useRef<L.Map | null>(null);
  const layersRef = useRef<L.Layer[]>([]);

  const segKey  = JSON.stringify(segments.map(s => ({ mode: s.mode, pts: s.points.map(p => [p.lat.toFixed(4), p.lng.toFixed(4)]) })));
  const pathKey = JSON.stringify(path.map(p => [p.lat.toFixed(4), p.lng.toFixed(4)]));

  // ── Init map once ──────────────────────────────────────────────────────────
  useEffect(() => {
    const el = elRef.current;
    if (!el || mapRef.current) return;

    const map = L.map(el, { zoomControl: true, attributionControl: true, preferCanvas: true });

    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/">CARTO</a>',
      subdomains: 'abcd',
      maxZoom: 20,
    }).addTo(map);

    mapRef.current = map;
    const ro = new ResizeObserver(() => map.invalidateSize());
    ro.observe(el);
    const t = setTimeout(() => map.invalidateSize(), 150);
    return () => { clearTimeout(t); ro.disconnect(); map.remove(); mapRef.current = null; };
  }, []);

  // ── Draw route on data change ──────────────────────────────────────────────
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    layersRef.current.forEach(l => map.removeLayer(l));
    layersRef.current = [];
    const addLayer = (l: L.Layer) => { l.addTo(map); layersRef.current.push(l); };

    async function drawRoute() {
      if (!map) return;
      const allPoints: LatLng[] = [];

      if (segments.length > 0) {
        // ── 1. Background full rail lines (faint context) ──────────────────
        const drawnLines = new Set<string>();
        for (const seg of segments) {
          const mode = (seg.mode ?? '').toLowerCase();
          if (!mode.includes('train') && !mode.includes('metro')) continue;
          let lineKey: string | null = mode.includes('metro') ? 'M1' : null;
          if (!lineKey) {
            for (const [key, line] of Object.entries(RAIL_LINES)) {
              const first = seg.points[0];
              if (!first) continue;
              const close = line.track.some(t => Math.hypot(t.lat - first.lat, t.lng - first.lng) < 0.05);
              if (close) { lineKey = key; break; }
            }
          }
          if (!lineKey || drawnLines.has(lineKey)) continue;
          drawnLines.add(lineKey);
          const fullLine = RAIL_LINES[lineKey as keyof typeof RAIL_LINES];
          if (!fullLine) continue;
          addLayer(L.polyline(fullLine.track.map(p => [p.lat, p.lng] as L.LatLngTuple), {
            color: fullLine.color, weight: 2, opacity: 0.18, lineJoin: 'round', lineCap: 'round',
          }));
        }

        // ── 2. Per-segment colored polylines ─────────────────────────────
        for (const seg of segments) {
          if (seg.points.length < 2) continue;
          const from = seg.points[0];
          const to   = seg.points[seg.points.length - 1];
          const { stroke, glow } = getModeColor(seg.mode);
          const mode = seg.mode.toLowerCase();
          let pts: LatLng[];

          if (mode.includes('walk'))
            pts = await fetchWalkPolyline(from, to);
          else if (mode.includes('cab') || mode.includes('uber') || mode.includes('ola') || mode.includes('rapido'))
            pts = await fetchOSRMPolyline(from, to);
          else
            pts = seg.points;

          pts = pts.filter(p => Number.isFinite(p.lat) && Number.isFinite(p.lng));
          if (pts.length < 2) continue;
          allPoints.push(...pts);

          const latlngs = pts.map(p => [p.lat, p.lng] as L.LatLngTuple);
          // Glow
          addLayer(L.polyline(latlngs, { color: glow, weight: 12, opacity: 0.4, lineJoin: 'round', lineCap: 'round' }));
          // Line
          addLayer(L.polyline(latlngs, {
            color: stroke, weight: mode.includes('walk') ? 3 : 5, opacity: 0.95,
            lineJoin: 'round', lineCap: 'round',
            dashArray: mode.includes('walk') ? '6 8' : undefined,
          }));

          // ── 3. Waypoint icon at segment START (transfer point) ─────────
          const label = seg.label ?? '';
          addLayer(
            L.marker([from.lat, from.lng], { icon: waypointIcon(seg.mode, label) })
              .bindTooltip(label, { direction: 'top', offset: [0, -18] })
          );
        }

        // ── 4. Source icon ─────────────────────────────────────────────────
        const firstPt = segments[0]?.points?.[0];
        if (firstPt) {
          allPoints.unshift(firstPt);
          addLayer(L.marker([firstPt.lat, firstPt.lng], { icon: sourceIcon(fromLabel), zIndexOffset: 1000 }));
        }

        // ── 5. Destination icon ────────────────────────────────────────────
        const lastSeg = segments[segments.length - 1];
        const lastPt  = lastSeg?.points?.[lastSeg.points.length - 1];
        if (lastPt) {
          allPoints.push(lastPt);
          addLayer(L.marker([lastPt.lat, lastPt.lng], { icon: destIcon(toLabel), zIndexOffset: 1000 }));
        }

      } else if (path.length >= 2) {
        // ── Legacy single-path fallback ───────────────────────────────────
        const valid = path.filter(p => Number.isFinite(p.lat) && Number.isFinite(p.lng));
        if (valid.length < 2) return;
        allPoints.push(...valid);
        const routed  = await fetchOSRMPolyline(valid[0], valid[valid.length - 1]);
        const latlngs = routed.map(p => [p.lat, p.lng] as L.LatLngTuple);
        addLayer(L.polyline(latlngs, { color: 'rgba(255,191,0,0.3)', weight: 12, opacity: 0.4, lineJoin: 'round', lineCap: 'round' }));
        addLayer(L.polyline(latlngs, { color: '#ffbf00', weight: 5, opacity: 0.95, lineJoin: 'round', lineCap: 'round' }));
        addLayer(L.marker(latlngs[0], { icon: sourceIcon(fromLabel), zIndexOffset: 1000 }));
        addLayer(L.marker(latlngs[latlngs.length - 1], { icon: destIcon(toLabel), zIndexOffset: 1000 }));
      }

      // Fit bounds
      const validAll = allPoints.filter(p => Number.isFinite(p.lat) && Number.isFinite(p.lng));
      if (validAll.length >= 2)
        map.fitBounds(L.latLngBounds(validAll.map(p => [p.lat, p.lng] as L.LatLngTuple)), { padding: [50, 50], maxZoom: 15 });
      else if (validAll.length === 1)
        map.setView([validAll[0].lat, validAll[0].lng], 14);
    }

    drawRoute();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [segKey, pathKey, fromLabel, toLabel]);

  if (segments.length === 0 && path.length < 1) {
    return (
      <div className="flex h-full min-h-[280px] items-center justify-center rounded-2xl border border-white/10 bg-surface-container/80 px-4 text-center text-sm text-white/45">
        <span className="flex max-w-sm flex-col items-center gap-2">
          <MapPin className="h-4 w-4 shrink-0 text-primary/60" />
          <span>Plan a journey to see the live route on the map.</span>
        </span>
      </div>
    );
  }

  return (
    <div
      ref={elRef}
      className="h-full min-h-[320px] w-full overflow-hidden rounded-2xl border border-white/10 shadow-[0_0_40px_rgba(0,0,0,0.4)] [&_.leaflet-control-attribution]:text-[10px] [&_.leaflet-control-attribution]:text-white/50"
    />
  );
}
