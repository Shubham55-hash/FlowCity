import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { motion } from "motion/react";
import { generateRoutePoints, STATION_COORDINATES } from "../utils/stationCoordinates";
<<<<<<< HEAD
import { formatRouteHeadline } from "../utils/formatLegInstructions";
=======
>>>>>>> 1a205e81c276580b1f69d326e146e88397c22de3

interface RouteHeatmapProps {
  routes: any[];
  selectedRoute?: any;
}

function trafficLoadLabel(trustScore: number): string {
  if (trustScore > 70) return 'Light';
  if (trustScore > 50) return 'Moderate';
  return 'Heavy';
}

const RouteHeatmap = ({ routes, selectedRoute }: RouteHeatmapProps) => {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);

  // Mumbai coordinates
  const MUMBAI_CENTER: [number, number] = [19.0760, 72.8777];

  // Generate realistic traffic heatmap data for Mumbai routes
  const generateHeatmapData = () => {
    const data: [number, number, number][] = [];

    // Add traffic hotspots at all major stations
    Object.entries(STATION_COORDINATES).forEach(([stationName, coords]) => {
      // Add main hotspot at station
      data.push([coords.lat, coords.lng, 0.6 + Math.random() * 0.4]);
      
      // Add surrounding congestion points
      for (let i = 0; i < 3; i++) {
        const offsetLat = coords.lat + (Math.random() - 0.5) * 0.03;
        const offsetLng = coords.lng + (Math.random() - 0.5) * 0.03;
        data.push([offsetLat, offsetLng, (0.4 + Math.random() * 0.3)]);
      }
    });

    // Add congestion along each route
    routes.forEach((route) => {
      const fromCoords = route.fromCoords || { lat: 19.076, lng: 72.8776 };
      const toCoords = route.toCoords || { lat: 19.2183, lng: 72.9781 };
      const congestionLevel = 1 - (route.trustScore / 100);

      let routePoints: Array<{ lat: number; lng: number }> = [];
      if (route.routeGeometry && route.routeGeometry.length > 2) {
        routePoints = route.routeGeometry;
      } else if (route.segments && route.segments.length > 0) {
        const segmentsPath: Array<{ lat: number; lng: number }> = [];
        route.segments.forEach((seg: any) => {
          if (seg.fromLatLng && segmentsPath.length === 0) segmentsPath.push(seg.fromLatLng);
          if (seg.toLatLng) segmentsPath.push(seg.toLatLng);
        });
        if (segmentsPath.length > 1) routePoints = segmentsPath;
      }

      if (!routePoints.length) {
        routePoints = generateRoutePoints(fromCoords.lat, fromCoords.lng, toCoords.lat, toCoords.lng, 15);
      }

      routePoints.forEach((point) => {
        const value = Math.max(0.2, Math.min(1, 0.3 + congestionLevel * 0.6 + (Math.random() - 0.5) * 0.25));
        data.push([point.lat, point.lng, value]);
      });
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

    // Clear existing heatmap layer
    map.eachLayer((layer) => {
      if (layer instanceof L.Circle || (layer as any)._heatmap) {
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
        radius: 5,
        fillColor: color,
        color: color,
        weight: 0,
        opacity: 0.6,
        fillOpacity: 0.6,
      }).addTo(map);
    });

    // Add route markers
    const allBounds: Array<[number, number]> = [];
    routes.forEach((route, index) => {
      const fromCoords = route.fromCoords || { lat: 19.076, lng: 72.8776 };
      const toCoords = route.toCoords || { lat: 19.2183, lng: 72.9781 };
      
      const routeLineColor = route.trustScore > 70 ? "#22c55e" : route.trustScore > 50 ? "#eab308" : "#ef4444";
      
      // From marker
      L.circleMarker([fromCoords.lat, fromCoords.lng], {
        radius: 8,
        fillColor: "#3b82f6",
        color: "#1e40af",
        weight: 2,
        opacity: 1,
        fillOpacity: 0.8,
      })
        .bindPopup(`<div class="text-xs"><strong>Start</strong><br/>${route.from}</div>`)
        .addTo(map);

      // Build route line (use precise server geometry if available)
      const routeLinePath: Array<[number, number]> =
        route.routeGeometry && route.routeGeometry.length > 1
          ? route.routeGeometry.map((pt: any) => [pt.lat, pt.lng])
          : route.segments && route.segments.length > 0
            ? route.segments.reduce((points: Array<[number, number]>, seg: any) => {
                if (seg.fromLatLng && points.length === 0) {
                  points.push([seg.fromLatLng.lat, seg.fromLatLng.lng]);
                }
                if (seg.toLatLng) {
                  points.push([seg.toLatLng.lat, seg.toLatLng.lng]);
                }
                return points;
              }, [] as Array<[number, number]>)
            : [[fromCoords.lat, fromCoords.lng], [toCoords.lat, toCoords.lng]];

      L.polyline(routeLinePath, {
        color: routeLineColor,
        weight: 3,
        opacity: 0.8,
        dashArray: selectedRoute?.id === route.id ? "0" : "5,5",
      })
        .bindPopup(
          `<div class="text-xs">
            <strong>${route.from} → ${route.to}</strong><br/>
            ETA: ${route.eta} min | Cost: ₹${route.cost}<br/>
            Traffic load: ${trafficLoadLabel(route.trustScore)}
          </div>`
        )
        .addTo(map);

      // To marker
      L.circleMarker([toCoords.lat, toCoords.lng], {
        radius: 8,
        fillColor: routeLineColor,
        color: routeLineColor,
        weight: 2,
        opacity: 1,
        fillOpacity: 0.8,
      })
        .bindPopup(`<div class="text-xs"><strong>Destination</strong><br/>${route.to}</div>`)
        .addTo(map);

      // Add to bounds
      allBounds.push([fromCoords.lat, fromCoords.lng]);
      allBounds.push([toCoords.lat, toCoords.lng]);
    });

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
<<<<<<< HEAD
                  <p className="text-xs text-white/50 mt-1">{formatRouteHeadline(route.from, route.to)}</p>
=======
                  <p className="text-xs text-white/50 mt-1">{route.summary}</p>
>>>>>>> 1a205e81c276580b1f69d326e146e88397c22de3
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
