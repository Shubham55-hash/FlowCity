import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { motion } from "motion/react";
import { generateRoutePoints, STATION_COORDINATES } from "../utils/stationCoordinates";
import { formatRouteHeadline } from "../utils/formatLegInstructions";

interface RouteHeatmapProps {
  routes: any[];
  selectedRoute?: any;
}

function trafficLoadLabel(trustScore: number): string {
  if (trustScore > 70) return 'Light';
  if (trustScore > 50) return 'Moderate';
  return 'Heavy';
}

/** Creates a round icon with emoji + label tag — used for source/dest markers */
function makePinIcon(emoji: string, color: string, label: string): L.DivIcon {
  return L.divIcon({
    className: '',
    iconSize: [42, 54],
    iconAnchor: [21, 54],
    popupAnchor: [0, -56],
    html: `
      <div style="position:relative;width:42px;height:54px;display:flex;flex-direction:column;align-items:center;">
        <div style="
          width:42px;height:42px;border-radius:50%;
          background:${color};
          border:3px solid #fff;
          box-shadow:0 0 14px ${color}99,0 3px 10px rgba(0,0,0,0.55);
          display:flex;align-items:center;justify-content:center;
          font-size:20px;
        ">${emoji}</div>
        <div style="width:4px;height:12px;background:linear-gradient(to bottom,${color},transparent);border-radius:0 0 3px 3px;"></div>
        <div style="
          position:absolute;bottom:-16px;left:50%;transform:translateX(-50%);
          background:rgba(0,0,0,0.88);color:#fff;
          font:700 9px/13px system-ui;
          padding:2px 6px;border-radius:3px;
          white-space:nowrap;max-width:90px;overflow:hidden;text-overflow:ellipsis;
          border:1px solid ${color}66;
        ">${label}</div>
      </div>`,
  });
}

const RouteHeatmap = ({ routes, selectedRoute }: RouteHeatmapProps) => {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);

  // Mumbai coordinates
  const MUMBAI_CENTER: [number, number] = [19.0760, 72.8777];

  // Generate realistic traffic heatmap data only for the target route
  const generateHeatmapData = () => {
    const data: [number, number, number][] = [];
    const targetRoute = selectedRoute || routes[0];
    if (!targetRoute) return data;

    const congestionLevel = 1 - ((targetRoute.safetyRating || targetRoute.trustScore || 80) / 100);

    // Get the detailed segments from simulation to extract actual stations and crowd factors
    const simSegments = targetRoute.simulation?.segments || [];
    
    // We add intense hotspots exactly at the transfer stations involved in this route
    simSegments.forEach((seg: any) => {
      // Find crowd factor for this specific segment
      const cf = seg.crowdFactor || 1.0;
      // High crowd factor -> high intensity (red). Low crowd factor -> lower intensity
      const baseIntensity = Math.min(1, Math.max(0.2, (cf - 0.5) / 1.5));
      
      const stnCoords1 = STATION_COORDINATES[seg.from?.replace(/\s+station/i, '').trim()];
      const stnCoords2 = STATION_COORDINATES[seg.to?.replace(/\s+station/i, '').trim()];
      
      // Plot hotspots around the exact stations of this route
      if (stnCoords1) {
        data.push([stnCoords1.lat, stnCoords1.lng, Math.min(1, baseIntensity + 0.3)]);
        for (let i = 0; i < 2; i++) {
          data.push([stnCoords1.lat + (Math.random() - 0.5) * 0.015, stnCoords1.lng + (Math.random() - 0.5) * 0.015, baseIntensity]);
        }
      }
      if (stnCoords2) {
        data.push([stnCoords2.lat, stnCoords2.lng, Math.min(1, baseIntensity + 0.3)]);
        for (let i = 0; i < 2; i++) {
          data.push([stnCoords2.lat + (Math.random() - 0.5) * 0.015, stnCoords2.lng + (Math.random() - 0.5) * 0.015, baseIntensity]);
        }
      }
    });

    // Extract precise route geometry path
    let routePoints: Array<{ lat: number; lng: number }> = [];
    if (targetRoute.routeGeometry && targetRoute.routeGeometry.length > 2) {
      routePoints = targetRoute.routeGeometry;
    } else if (targetRoute.simulation?.routeGeometry) {
      routePoints = targetRoute.simulation.routeGeometry;
    } else {
      const fromCoords = targetRoute.fromCoords || { lat: 19.076, lng: 72.8776 };
      const toCoords = targetRoute.toCoords || { lat: 19.2183, lng: 72.9781 };
      routePoints = generateRoutePoints(fromCoords.lat, fromCoords.lng, toCoords.lat, toCoords.lng, 25);
    }

    // Add continuous congestion heatmap points along the physical route polyline
    routePoints.forEach((point) => {
      // Create a smooth varying intensity along the line
      const value = Math.max(0.2, Math.min(1, 0.2 + congestionLevel * 0.6 + (Math.random() - 0.5) * 0.2));
      data.push([point.lat, point.lng, value]);
    });

    return data;
  };

  useEffect(() => {
    if (!mapRef.current) return;

    // Initialize map
    if (!mapInstanceRef.current) {
      mapInstanceRef.current = L.map(mapRef.current).setView(MUMBAI_CENTER, 11);

      // Add tile layer
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: "© OpenStreetMap contributors",
        maxZoom: 19,
      }).addTo(mapInstanceRef.current);
    }

    const map = mapInstanceRef.current;

    // Clear ALL non-tile layers (markers, polylines, circleMarkers)
    // so stale pins from a previous search never linger.
    map.eachLayer((layer) => {
      if (!(layer instanceof L.TileLayer)) {
        map.removeLayer(layer);
      }
    });

    // Generate and add heatmap data
    const heatmapData = generateHeatmapData();

    // Create heatmap layer using leaflet-heat style visualization
    const maxVal = 1;
    heatmapData.forEach(([lat, lng, intensity]) => {
      const color = getColorForIntensity(intensity);
      L.circleMarker([lat, lng], {
        radius: 8,
        fillColor: color,
        color: color,
        weight: 0,
        opacity: 0.7,
        fillOpacity: 0.7,
      }).addTo(map);
    });

    // Add route markers — only draw ONE source and ONE destination pin total 
    // for the entire search to avoid clutter and overlapping markers from alternatives.
    let drawnSource = false;
    let drawnDest   = false;

    const allBounds: Array<[number, number]> = [];
    
    // Dim the map base layer slightly to make heatmap pop using a pane or CSS filter
    const tilePane = map.getPane('tilePane');
    if (tilePane) {
      tilePane.style.filter = "grayscale(80%) brightness(50%) contrast(120%)";
    }

    // Only draw the target route to keep the map clean
    const localRoutes = [selectedRoute || routes[0]].filter(Boolean);

    localRoutes.forEach((route) => {
      const fromCoords = route.fromCoords || { lat: 19.076,   lng: 72.8776 };
      const toCoords   = route.toCoords   || { lat: 19.2183, lng: 72.9781  };

      const routeLineColor = route.trustScore > 70 ? '#22c55e'
        : route.trustScore > 50 ? '#eab308' : '#ef4444';

      // ── Source pin (once total) ───────────────────────────
      if (!drawnSource) {
        drawnSource = true;
        L.marker([fromCoords.lat, fromCoords.lng], {
          icon: makePinIcon('🔴', 'linear-gradient(135deg,#ffbf00,#ff8c00)', route.from),
          zIndexOffset: 1000,
        })
          .bindPopup(`<div style="font:700 12px system-ui">🔴 Origin<br/><span style="font-weight:400">${route.from}</span></div>`)
          .addTo(map);
      }

      // ── Route polyline (one per route, different dash/color) ────────────
      const routeLinePath: Array<[number, number]> =
        route.routeGeometry && route.routeGeometry.length > 1
          ? route.routeGeometry.map((pt: any) => [pt.lat, pt.lng] as [number, number])
          : route.segments && route.segments.length > 0
            ? route.segments.reduce((pts: Array<[number, number]>, seg: any) => {
                if (seg.fromLatLng && pts.length === 0) pts.push([seg.fromLatLng.lat, seg.fromLatLng.lng]);
                if (seg.toLatLng) pts.push([seg.toLatLng.lat, seg.toLatLng.lng]);
                return pts;
              }, [] as Array<[number, number]>)
            : [[fromCoords.lat, fromCoords.lng], [toCoords.lat, toCoords.lng]];

      if (routeLinePath.length >= 2) {
        L.polyline(routeLinePath, {
          color: routeLineColor,
          weight: selectedRoute?.id === route.id ? 5 : 3,
          opacity: selectedRoute?.id === route.id ? 0.95 : 0.6,
          dashArray: selectedRoute?.id === route.id ? undefined : '6 6',
        })
          .bindPopup(`<div style="font:700 12px system-ui">
            ${route.from} → ${route.to}<br/>
            <span style="font-weight:400">ETA: ${route.eta} min · ₹${route.cost}</span><br/>
            <span style="color:${routeLineColor}">● ${trafficLoadLabel(route.trustScore)} Traffic</span>
          </div>`)
          .addTo(map);
      }

      // ── Destination pin (once total) ───────────────────────
      if (!drawnDest) {
        drawnDest = true;
        // Use green for light traffic, amber for moderate, red for heavy
        const destGrad = route.trustScore > 70
          ? 'linear-gradient(135deg,#13ff43,#00c830)'
          : route.trustScore > 50
            ? 'linear-gradient(135deg,#eab308,#ca8a04)'
            : 'linear-gradient(135deg,#ef4444,#dc2626)';
        L.marker([toCoords.lat, toCoords.lng], {
          icon: makePinIcon('🏁', destGrad, route.to),
          zIndexOffset: 1000,
        })
          .bindPopup(`<div style="font:700 12px system-ui">🏁 Destination<br/><span style="font-weight:400">${route.to}</span></div>`)
          .addTo(map);
      }

    });

    const targetRoute = selectedRoute || routes[0];
    if (targetRoute) {
      allBounds.push([targetRoute.fromCoords?.lat || 19.07, targetRoute.fromCoords?.lng || 72.87]);
      allBounds.push([targetRoute.toCoords?.lat || 19.07, targetRoute.toCoords?.lng || 72.87]);
    }

    // Fit bounds if routes exist
    if (allBounds.length > 0) {
      const bounds = L.latLngBounds(allBounds);
      map.fitBounds(bounds, { padding: [50, 50] });
    }
  }, [routes, selectedRoute]);

  const getColorForIntensity = (intensity: number): string => {
    if (intensity > 0.8) return "#ef4444"; // Red
    if (intensity > 0.6) return "#f97316"; // Orange
    if (intensity > 0.4) return "#eab308"; // Yellow
    return "#22c55e"; // Green
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="space-y-6 pb-8"
    >
      <div className="space-y-4">
        <h2 className="font-headline text-3xl font-bold tracking-tight mb-4 uppercase tracking-tighter">
          Traffic Heatmap
        </h2>

        {/* Map Container */}
        <div
          ref={mapRef}
          className="w-full h-96 rounded-2xl overflow-hidden border border-white/10 shadow-lg"
          style={{ minHeight: "400px" }}
        />

        {/* Legend */}
        <div className="bg-surface-container rounded-2xl p-4 border border-white/5 space-y-3">
          <h3 className="font-headline text-sm font-bold text-white/80">Legend</h3>
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded-full bg-red-500" />
              <span className="text-white/60">High Traffic (80%+)</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded-full bg-orange-500" />
              <span className="text-white/60">Medium Traffic (60-80%)</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded-full bg-yellow-400" />
              <span className="text-white/60">Moderate Traffic (40-60%)</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded-full bg-green-500" />
              <span className="text-white/60">Low Traffic (&lt;40%)</span>
            </div>
          </div>
        </div>

        {/* Routes List */}
        <div className="space-y-3">
          <h3 className="font-headline text-sm font-bold text-white/80">Suggested Routes</h3>
          {routes.map((route, index) => (
            <div
              key={route.id}
              className={`bg-surface-container rounded-xl p-3 border transition-all ${
                selectedRoute?.id === route.id
                  ? "border-primary/60 bg-primary/10"
                  : "border-white/10 hover:border-white/20"
              }`}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <p className="font-headline text-sm font-bold">
                    Route {index + 1}: {route.from} → {route.to}
                  </p>
                  <p className="text-xs text-white/50 mt-1">{formatRouteHeadline(route.from, route.to)}</p>
                </div>
                <div className="text-right">
                  <div className="flex items-center gap-2 justify-end">
                    <div className="text-right">
                      <p className="text-xs font-bold text-primary">{route.eta} min</p>
                      <p className="text-[10px] text-white/40">₹{route.cost}</p>
                    </div>
                    <span
                      className="rounded-lg border border-white/10 px-2.5 py-1.5 text-[10px] font-black uppercase tracking-tighter"
                      style={{
                        backgroundColor:
                          route.trustScore > 70
                            ? "rgba(34, 197, 94, 0.15)"
                            : route.trustScore > 50
                              ? "rgba(234, 179, 8, 0.15)"
                              : "rgba(239, 68, 68, 0.15)",
                        color:
                          route.trustScore > 70
                            ? "#22c55e"
                            : route.trustScore > 50
                              ? "#eab308"
                              : "#ef4444",
                      }}
                    >
                      {trafficLoadLabel(route.trustScore)} traffic
                    </span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </motion.div>
  );
};

export default RouteHeatmap;
