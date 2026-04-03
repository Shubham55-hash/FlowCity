import { useEffect, useRef, useState } from 'react';
import { MapPin } from 'lucide-react';
import { loadGoogleMaps } from '../utils/loadGoogleMaps';

type LatLng = { lat: number; lng: number };

type GhostRouteMapProps = {
  path: LatLng[];
  fromLabel?: string;
  toLabel?: string;
  accentColor?: string;
};

type MapRefs = {
  map: unknown;
  line: { setMap: (m: null) => void };
  markers: Array<{ setMap: (m: null) => void }>;
};

export default function GhostRouteMap({
  path,
  fromLabel = 'Start',
  toLabel = 'End',
  accentColor = '#ffbf00',
}: GhostRouteMapProps) {
  const elRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<MapRefs | null>(null);
  const [error, setError] = useState<string | null>(null);
  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '';

  useEffect(() => {
    const el = elRef.current;
    if (!el || path.length < 1) return;

    let cancelled = false;

    const run = async () => {
      try {
        if (!apiKey) {
          setError('Set VITE_GOOGLE_MAPS_API_KEY for the live map.');
          return;
        }
        setError(null);
        await loadGoogleMaps(apiKey);
        if (cancelled || !el) return;

        const maps = (window as unknown as { google: { maps: Record<string, unknown> } }).google.maps;
        const MapConstructor = maps.Map as new (e: HTMLElement, o: Record<string, unknown>) => unknown;
        const PolylineConstructor = maps.Polyline as new (o: Record<string, unknown>) => { setMap: (m: unknown) => void };
        const LatLngBoundsConstructor = maps.LatLngBounds as new () => { extend: (p: LatLng) => void };
        const MarkerConstructor = maps.Marker as new (o: Record<string, unknown>) => { setMap: (m: unknown) => void };

        const valid = path.filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lng));
        if (valid.length === 0) return;

        const center = valid[Math.floor(valid.length / 2)];

        if (mapInstanceRef.current) {
          const prev = mapInstanceRef.current;
          prev.line.setMap(null);
          prev.markers.forEach((m) => m.setMap(null));
          mapInstanceRef.current = null;
        }

        const map = new MapConstructor(el, {
          center,
          zoom: 12,
          disableDefaultUI: false,
          styles: [
            { elementType: 'geometry', stylers: [{ color: '#242424' }] },
            { elementType: 'labels.text.stroke', stylers: [{ color: '#131313' }] },
            { elementType: 'labels.text.fill', stylers: [{ color: '#a8a29e' }] },
            { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#1a1a1a' }] },
            { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#2d2d2c' }] },
          ],
        });

        const line = new PolylineConstructor({
          path: valid,
          geodesic: true,
          strokeColor: accentColor,
          strokeOpacity: 0.95,
          strokeWeight: 4,
          map,
        });

        const mA = new MarkerConstructor({
          position: valid[0],
          map,
          label: { text: 'A', color: '#131313', fontWeight: '700' },
          title: fromLabel,
        });
        const markers: Array<{ setMap: (m: unknown) => void }> = [mA];
        if (valid.length > 1) {
          markers.push(
            new MarkerConstructor({
              position: valid[valid.length - 1],
              map,
              label: { text: 'B', color: '#131313', fontWeight: '700' },
              title: toLabel,
            }),
          );
        }

        const bounds = new LatLngBoundsConstructor();
        valid.forEach((p) => bounds.extend(p));
        (map as { fitBounds: (b: unknown, pad?: Record<string, number>) => void }).fitBounds(bounds, {
          top: 48,
          right: 48,
          bottom: 48,
          left: 48,
        });

        mapInstanceRef.current = { map, line, markers };
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Map error');
      }
    };

    run();

    return () => {
      cancelled = true;
      if (mapInstanceRef.current) {
        const prev = mapInstanceRef.current;
        try {
          prev.line.setMap(null);
          prev.markers.forEach((m) => m.setMap(null));
        } catch {
          /* ignore */
        }
        mapInstanceRef.current = null;
      }
    };
  }, [path, fromLabel, toLabel, accentColor, apiKey]);

  if (path.length < 2) {
    return (
      <div className="flex h-full min-h-[280px] items-center justify-center rounded-2xl border border-white/10 bg-surface-container/80 text-center text-sm text-white/45">
        <span className="flex items-center gap-2 px-6">
          <MapPin className="h-4 w-4 shrink-0 text-primary/60" />
          Route geometry appears once planning returns a path from Google or OpenRoute.
        </span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-[280px] items-center justify-center rounded-2xl border border-amber-500/25 bg-amber-500/5 p-6 text-center text-sm text-amber-200/80">
        {error}
      </div>
    );
  }

  return <div ref={elRef} className="h-full min-h-[320px] w-full overflow-hidden rounded-2xl border border-white/10 shadow-[0_0_40px_rgba(0,0,0,0.4)]" />;
}
