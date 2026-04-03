import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { MapPin } from 'lucide-react';

type LatLng = { lat: number; lng: number };

type GhostRouteMapProps = {
  path: LatLng[];
  fromLabel?: string;
  toLabel?: string;
  accentColor?: string;
};

/**
 * Ghost route map using Leaflet + CARTO dark tiles (no API key).
 * Works offline from a coordinate path; no Google Maps dependency.
 */
export default function GhostRouteMap({
  path,
  fromLabel = 'Start',
  toLabel = 'End',
  accentColor = '#ffbf00',
}: GhostRouteMapProps) {
  const elRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);

  // Stable key: parent often passes a new `path` array each render (simulation tick) with identical coords.
  const pathKey = JSON.stringify(
    path
      .map((p) => ({ lat: Number(p.lat), lng: Number(p.lng) }))
      .filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lng))
      .map((p) => [Math.round(p.lat * 1e6) / 1e6, Math.round(p.lng * 1e6) / 1e6])
  );

  useEffect(() => {
    const el = elRef.current;
    if (!el) return;

    let valid: LatLng[] = [];
    try {
      const pairs = JSON.parse(pathKey) as [number, number][];
      valid = pairs.map(([lat, lng]) => ({ lat, lng })).filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lng));
    } catch {
      return;
    }
    if (valid.length < 1) return;

    if (mapRef.current) {
      mapRef.current.remove();
      mapRef.current = null;
    }

    const map = L.map(el, {
      zoomControl: true,
      attributionControl: true,
    });

    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/">CARTO</a>',
      subdomains: 'abcd',
      maxZoom: 20,
    }).addTo(map);

    const latlngs = valid.map((p) => [p.lat, p.lng] as L.LatLngTuple);

    if (valid.length >= 2) {
      L.polyline(latlngs, {
        color: accentColor,
        weight: 4,
        opacity: 0.95,
        lineJoin: 'round',
      }).addTo(map);
    }

    const startStyle = {
      radius: 9,
      color: accentColor,
      fillColor: accentColor,
      fillOpacity: 1,
      weight: 2,
    };
    const endStyle = {
      radius: 9,
      color: '#13ff43',
      fillColor: '#13ff43',
      fillOpacity: 1,
      weight: 2,
    };

    L.circleMarker(latlngs[0], startStyle).addTo(map).bindTooltip(fromLabel, { direction: 'top' });

    if (valid.length >= 2) {
      L.circleMarker(latlngs[latlngs.length - 1], endStyle).addTo(map).bindTooltip(toLabel, { direction: 'top' });
    }

    if (valid.length >= 2) {
      map.fitBounds(L.latLngBounds(latlngs), { padding: [44, 44], maxZoom: 16 });
    } else {
      map.setView(latlngs[0], 14);
    }

    mapRef.current = map;

    let raf = 0;
    const ro = new ResizeObserver(() => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        map.invalidateSize();
      });
    });
    ro.observe(el);
    const t = window.setTimeout(() => map.invalidateSize(), 120);

    return () => {
      window.clearTimeout(t);
      cancelAnimationFrame(raf);
      ro.disconnect();
      map.remove();
      mapRef.current = null;
    };
  }, [pathKey, fromLabel, toLabel, accentColor]);

  if (path.length < 1) {
    return (
      <div className="flex h-full min-h-[280px] items-center justify-center rounded-2xl border border-white/10 bg-surface-container/80 px-4 text-center text-sm text-white/45">
        <span className="flex max-w-sm flex-col items-center gap-2">
          <MapPin className="h-4 w-4 shrink-0 text-primary/60" />
          <span>No coordinates for this route yet. Plan a journey that returns a path from OpenRoute or Google.</span>
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
