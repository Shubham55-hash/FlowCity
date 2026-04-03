export const STATION_COORDINATES: Record<string, { lat: number; lng: number }> = {
  "Borivali": { lat: 19.2297, lng: 72.8011 },
  "Andheri": { lat: 19.1136, lng: 72.8697 },
  "Bandra": { lat: 19.0596, lng: 72.8295 },
  "Dadar": { lat: 19.0176, lng: 72.8479 },
  "Churchgate": { lat: 18.9525, lng: 72.8238 },
  "Mumbai Central": { lat: 18.9674, lng: 72.8194 },
  "Virar": { lat: 19.5399, lng: 72.7868 },
  "Mira Road": { lat: 19.2711, lng: 72.8449 },
  "Bhayandar": { lat: 19.3024, lng: 72.8077 },
  "Vasai Road": { lat: 19.4530, lng: 72.7735 },
  "Nala Sopara": { lat: 19.6071, lng: 72.7603 },
  "Malad": { lat: 19.1847, lng: 72.8449 },
  "Kandivali": { lat: 19.2183, lng: 72.8445 },
  "Goregaon": { lat: 19.1644, lng: 72.8450 },
  "Ram Mandir": { lat: 19.1433, lng: 72.8458 },
  "Jogeshwari": { lat: 19.1283, lng: 72.8493 },
  "Vile Parle": { lat: 19.1008, lng: 72.8549 },
  "Santacruz": { lat: 19.0846, lng: 72.8589 },
  "Khar Road": { lat: 19.0745, lng: 72.8350 },
  "Mahim": { lat: 19.0469, lng: 72.8290 },
  "Matunga Road": { lat: 19.0303, lng: 72.8469 },
  "Prabhadevi": { lat: 19.0225, lng: 72.8366 },
  "Lower Parel": { lat: 19.0094, lng: 72.8276 },
  "Mahalaxmi": { lat: 19.0043, lng: 72.8262 },
  "Grant Road": { lat: 18.9891, lng: 72.8282 },
  "Charni Road": { lat: 18.9805, lng: 72.8272 },
  "Marine Lines": { lat: 18.9668, lng: 72.8259 },
  "Dahanu Road": { lat: 19.9159, lng: 72.6806 },
  "CSMT": { lat: 18.9401, lng: 72.8343 },
  "Masjid": { lat: 18.9547, lng: 72.8349 },
  "Sandhurst Road": { lat: 18.9618, lng: 72.8357 },
  "Byculla": { lat: 18.9728, lng: 72.8406 },
  "Chinchpokli": { lat: 18.9889, lng: 72.8367 },
  "Currey Road": { lat: 18.9990, lng: 72.8369 },
  "Parel": { lat: 19.0062, lng: 72.8387 },
  "Matunga": { lat: 19.0316, lng: 72.8412 },
  "Sion": { lat: 19.0426, lng: 72.8565 },
  "Kurla": { lat: 19.0694, lng: 72.8702 },
  "Vidyavihar": { lat: 19.0947, lng: 72.8867 },
  "Ghatkopar": { lat: 19.1056, lng: 72.8981 },
  "Vikhroli": { lat: 19.1255, lng: 72.9102 },
  "Kanjurmarg": { lat: 19.1409, lng: 72.9272 },
  "Bhandup": { lat: 19.1566, lng: 72.9369 },
  "Nahur": { lat: 19.1730, lng: 72.9506 },
  "Mulund": { lat: 19.1932, lng: 72.9629 },
  "Thane": { lat: 19.2183, lng: 72.9781 },
  "Kalva": { lat: 19.2289, lng: 72.9850 },
  "Mumbra": { lat: 19.2453, lng: 73.0066 },
  "Diva": { lat: 19.2656, lng: 73.0398 },
};

export const getStationCoordinates = (stationName: string): { lat: number; lng: number } | null => {
  // Clean the station name
  const cleanName = stationName.trim();
  
  // Try exact match first
  if (STATION_COORDINATES[cleanName]) {
    return STATION_COORDINATES[cleanName];
  }

  // Try partial match
  for (const [key, coords] of Object.entries(STATION_COORDINATES)) {
    if (key.toLowerCase().includes(cleanName.toLowerCase()) || 
        cleanName.toLowerCase().includes(key.toLowerCase())) {
      return coords;
    }
  }

  return null;
};

export const getRouteCoordinates = (fromStation: string, toStation: string) => {
  const fromCoords = getStationCoordinates(fromStation);
  const toCoords = getStationCoordinates(toStation);

  return {
    from: fromCoords || { lat: 19.076, lng: 72.8776 }, // Default to Dadar
    to: toCoords || { lat: 19.2183, lng: 72.9781 },     // Default to Thane
  };
};

// Generate intermediate route points between two coordinates
export const generateRoutePoints = (
  fromLat: number,
  fromLng: number,
  toLat: number,
  toLng: number,
  count: number = 10
): Array<{ lat: number; lng: number; intensity: number }> => {
  const points = [];
  for (let i = 0; i < count; i++) {
    const t = i / count;
    const lat = fromLat + (toLat - fromLat) * t;
    const lng = fromLng + (toLng - fromLng) * t;
    // Add slight randomness for more realistic congestion patterns
    const offsetLat = lat + (Math.random() - 0.5) * 0.01;
    const offsetLng = lng + (Math.random() - 0.5) * 0.01;
    const intensity = 0.3 + Math.random() * 0.6; // Random congestion
    points.push({ lat: offsetLat, lng: offsetLng, intensity });
  }
  return points;
};
