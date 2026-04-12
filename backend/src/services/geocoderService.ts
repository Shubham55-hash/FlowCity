import axios from 'axios';

export interface Coordinates {
  lat: number;
  lng: number;
}

/**
 * Greater Mumbai bounding box.
 * Anything outside this region is rejected as an invalid suggestion.
 * Covers: Colaba in the south → Virar/Dahanu in the north
 *          Bandra/Versova in the west → Navi Mumbai/Thane/Kalyan in the east
 */
const MUMBAI_BOUNDS = {
  latMin: 18.85,
  latMax: 19.60,
  lngMin: 72.70,
  lngMax: 73.25,
};

function isWithinMumbai(lat: number, lng: number): boolean {
  return (
    lat >= MUMBAI_BOUNDS.latMin && lat <= MUMBAI_BOUNDS.latMax &&
    lng >= MUMBAI_BOUNDS.lngMin && lng <= MUMBAI_BOUNDS.lngMax
  );
}

/** Keywords that indicate a highway/road/infrastructure result — reject these */
const REJECT_KEYWORDS = [
  'expressway', 'highway', 'nh ', 'national highway', 'sh ', 'state highway',
  'junction', 'toll plaza', 'bypass', 'flyover', 'overpass', 'interchange',
  'gujarat', 'valsad', 'vapi', 'surat', 'pune', 'nashik', 'nagpur',
  'rajasthan', 'delhi', 'bangalore', 'hyderbad', 'chennai',
];

function isRejectedSuggestion(name: string): boolean {
  const lower = name.toLowerCase();
  return REJECT_KEYWORDS.some(kw => lower.includes(kw));
}

class GeocoderService {

  // ── Comprehensive local registry — instant, 100% accurate Mumbai locations ──
  private readonly localRegistry: Record<string, Coordinates> = {
    // Western Railway
    'virar': { lat: 19.4544, lng: 72.7997 },
    'vasai road': { lat: 19.3792, lng: 72.8154 },
    'vasai': { lat: 19.3792, lng: 72.8154 },
    'nala sopara': { lat: 19.4168, lng: 72.8122 },
    'nalasopara': { lat: 19.4168, lng: 72.8122 },
    'bhayandar': { lat: 19.2906, lng: 72.8542 },
    'bhayander': { lat: 19.2906, lng: 72.8542 },
    'mira road': { lat: 19.2817, lng: 72.8557 },
    'dahisar': { lat: 19.2499, lng: 72.8567 },
    'borivali': { lat: 19.2291, lng: 72.8574 },
    'kandivali': { lat: 19.2048, lng: 72.8591 },
    'goregaon': { lat: 19.1772, lng: 72.8571 },
    'ram mandir': { lat: 19.1543, lng: 72.8513 },
    'jogeshwari': { lat: 19.1385, lng: 72.8495 },
    'andheri': { lat: 19.1197, lng: 72.8468 },
    'vile parle': { lat: 19.0996, lng: 72.8494 },
    'santacruz': { lat: 19.0835, lng: 72.8424 },
    'khar road': { lat: 19.0727, lng: 72.8374 },
    'bandra': { lat: 19.0522, lng: 72.8414 },
    'mahim': { lat: 19.0397, lng: 72.8428 },
    'matunga road': { lat: 19.0263, lng: 72.8445 },
    'lower parel': { lat: 18.9952, lng: 72.8325 },
    'prabhadevi': { lat: 19.0190, lng: 72.8343 },
    'mahalaxmi': { lat: 18.9816, lng: 72.8198 },
    'grant road': { lat: 18.9636, lng: 72.8152 },
    'charni road': { lat: 18.9538, lng: 72.8195 },
    'marine lines': { lat: 18.9448, lng: 72.8224 },
    'churchgate': { lat: 18.9353, lng: 72.8258 },
    // Central Railway
    'csmt': { lat: 18.9400, lng: 72.8353 },
    'cst': { lat: 18.9400, lng: 72.8353 },
    'chhatrapati shivaji maharaj terminus': { lat: 18.9400, lng: 72.8353 },
    'masjid': { lat: 18.9465, lng: 72.8356 },
    'sandhurst road': { lat: 18.9497, lng: 72.8421 },
    'byculla': { lat: 18.9612, lng: 72.8362 },
    'chinchpokli': { lat: 18.9683, lng: 72.8344 },
    'currey road': { lat: 18.9752, lng: 72.8322 },
    'parel': { lat: 18.9908, lng: 72.8350 },
    'dadar': { lat: 19.0178, lng: 72.8478 },
    'matunga': { lat: 19.0278, lng: 72.8568 },
    'sion': { lat: 19.0389, lng: 72.8610 },
    'kurla': { lat: 19.0635, lng: 72.8876 },
    'vidyavihar': { lat: 19.0783, lng: 72.9023 },
    'ghatkopar': { lat: 19.0860, lng: 72.9090 },
    'vikhroli': { lat: 19.1099, lng: 72.9267 },
    'kanjurmarg': { lat: 19.1355, lng: 72.9418 },
    'bhandup': { lat: 19.1530, lng: 72.9540 },
    'nahur': { lat: 19.1680, lng: 72.9580 },
    'mulund': { lat: 19.1730, lng: 72.9607 },
    'thane': { lat: 19.1860, lng: 72.9480 },
    'kalwa': { lat: 19.1990, lng: 73.0050 },
    'mumbra': { lat: 19.2042, lng: 73.0266 },
    'dombivli': { lat: 19.2184, lng: 73.0867 },
    'kalyan': { lat: 19.2361, lng: 73.1306 },
    'ambernath': { lat: 19.2039, lng: 73.1933 },
    'badlapur': { lat: 19.1594, lng: 73.2293 },
    // Harbour Line
    'vashi': { lat: 19.0645, lng: 73.0011 },
    'sanpada': { lat: 19.0630, lng: 73.0133 },
    'juinagar': { lat: 19.0469, lng: 73.0163 },
    'nerul': { lat: 19.0354, lng: 73.0173 },
    'belapur': { lat: 19.0189, lng: 73.0387 },
    'kharghar': { lat: 19.0451, lng: 73.0737 },
    'panvel': { lat: 18.9894, lng: 73.1175 },
    'chembur': { lat: 19.0521, lng: 72.8999 },
    'govandi': { lat: 19.0665, lng: 72.9185 },
    'mankhurd': { lat: 19.0490, lng: 72.9350 },
    // Key Areas
    'bkc': { lat: 19.0607, lng: 72.8636 },
    'powai': { lat: 19.1196, lng: 72.9060 },
    'colaba': { lat: 18.9067, lng: 72.8147 },
    'fort': { lat: 18.9322, lng: 72.8351 },
    'nariman point': { lat: 18.9255, lng: 72.8236 },
    'worli': { lat: 19.0057, lng: 72.8188 },
    'juhu': { lat: 19.1075, lng: 72.8263 },
    'versova': { lat: 19.1308, lng: 72.8195 },
    'malad': { lat: 19.1862, lng: 72.8488 },
    'kandivali east': { lat: 19.2048, lng: 72.8716 },
    'navi mumbai': { lat: 19.0368, lng: 73.0158 },
    'airoli': { lat: 19.1565, lng: 72.9982 },
    'ghansoli': { lat: 19.1154, lng: 73.0101 },
    'rabale': { lat: 19.1008, lng: 73.0109 },
    'turbhe': { lat: 19.0819, lng: 73.0093 },
    'kopar khairane': { lat: 19.1025, lng: 73.0059 },
    'seawoods': { lat: 19.0145, lng: 73.0200 },
    'airport': { lat: 19.0896, lng: 72.8656 },
    'mumbai airport': { lat: 19.0896, lng: 72.8656 },
    'csia': { lat: 19.0896, lng: 72.8656 },
  };

  /** Check if a normalized key exactly or partially matches the local registry */
  private localLookup(normalized: string): Coordinates | null {
    if (this.localRegistry[normalized]) return this.localRegistry[normalized];
    // Partial match
    for (const [key, coords] of Object.entries(this.localRegistry)) {
      if (key.includes(normalized) || normalized.includes(key)) return coords;
    }
    return null;
  }

  public async geocode(name: string): Promise<Coordinates | null> {
    const normalized = name.toLowerCase().trim();

    // 1. Exact/partial match in local registry (instant, 100% correct)
    const localHit = this.localLookup(normalized);
    if (localHit) return localHit;

    // 2. Google Maps Geocode API (if key valid)
    const googleKey = process.env.GOOGLE_MAPS_API_KEY;
    const googleValid = googleKey && googleKey !== 'CHANGE_ME' && googleKey !== 'your_google_api_key_here';
    if (googleValid) {
      try {
        const gRes = await axios.get('https://maps.googleapis.com/maps/api/geocode/json', {
          params: { address: `${name}, Mumbai, India`, key: googleKey, region: 'in' },
          timeout: 3000,
        });
        if (gRes.data?.status === 'OK' && gRes.data?.results?.length > 0) {
          const loc = gRes.data.results[0].geometry.location;
          if (isWithinMumbai(loc.lat, loc.lng)) return { lat: loc.lat, lng: loc.lng };
        }
      } catch (e) { console.warn('Google Geocode failed:', (e as any)?.message); }
    }

    // 2.5 Geoapify Geocoding API
    const geoapifyKey = process.env.GEOAPIFY_API_KEY;
    const geoValid = geoapifyKey && geoapifyKey !== 'CHANGE_ME';
    if (geoValid) {
      try {
        const geoRes = await axios.get('https://api.geoapify.com/v1/geocode/search', {
          params: { text: `${name}, Mumbai`, format: 'json', apiKey: geoapifyKey, limit: 1 },
          timeout: 4000
        });
        if (geoRes.data?.results?.length > 0) {
          const loc = geoRes.data.results[0];
          if (isWithinMumbai(loc.lat, loc.lon)) return { lat: loc.lat, lng: loc.lon };
        }
      } catch (e) { console.warn('Geoapify geocode failed:', (e as any)?.message); }
    }

    // 3. Nominatim (always restricted to Mumbai bounding box)
    try {
      const nom = await axios.get('https://nominatim.openstreetmap.org/search', {
        params: {
          q: `${name}, Mumbai`,
          format: 'json',
          limit: 5,
          countrycodes: 'in',
          viewbox: `${MUMBAI_BOUNDS.lngMin},${MUMBAI_BOUNDS.latMax},${MUMBAI_BOUNDS.lngMax},${MUMBAI_BOUNDS.latMin}`,
          bounded: 1,
        },
        headers: { 'User-Agent': 'FlowCity/1.0' },
        timeout: 3000,
      });
      for (const item of nom.data || []) {
        const lat = parseFloat(item.lat);
        const lng = parseFloat(item.lon);
        if (isWithinMumbai(lat, lng) && !isRejectedSuggestion(item.display_name ?? '')) {
          return { lat, lng };
        }
      }
    } catch (e) { console.warn('Nominatim geocode failed:', (e as any)?.message); }

    return null;
  }

  public async autocomplete(query: string, limit = 12): Promise<Array<{ name: string; lat: number; lng: number }>> {
    const normalized = query.toLowerCase().trim();
    if (!normalized || normalized.length < 2) return [];

    // ── 1. Local registry matches (always first, instant) ─────────────────────
    const localMatches = Object.entries(this.localRegistry)
      .filter(([key]) => key.includes(normalized) || normalized.includes(key))
      .map(([key, coords]) => ({
        name: key.replace(/\b\w/g, c => c.toUpperCase()), // Title Case
        lat: coords.lat,
        lng: coords.lng,
      }))
      .slice(0, limit);

    if (localMatches.length >= limit) return localMatches;

    const placeResults: Array<{ name: string; lat: number; lng: number }> = [];

    // ── 2. Google Places Autocomplete (if key valid) ─────────────────────────
    const googleKey = process.env.GOOGLE_MAPS_API_KEY;
    const googleValid = googleKey && googleKey !== 'CHANGE_ME' && googleKey !== 'your_google_api_key_here';
    if (googleValid) {
      try {
        const autocompleteRes = await axios.get('https://maps.googleapis.com/maps/api/place/autocomplete/json', {
          params: {
            input: query,
            key: googleKey,
            language: 'en',
            components: 'country:in',
            types: 'geocode',
            location: '19.0760,72.8777', // Mumbai center
            radius: 50000,              // 50km radius
            strictbounds: true,
            sessiontoken: `${Date.now()}`,
          },
          timeout: 4000,
        });
        if (autocompleteRes.data?.status === 'OK' && Array.isArray(autocompleteRes.data.predictions)) {
          for (const pred of autocompleteRes.data.predictions.slice(0, limit * 2)) {
            if (isRejectedSuggestion(pred.description ?? '')) continue;
            try {
              const detailsRes = await axios.get('https://maps.googleapis.com/maps/api/place/details/json', {
                params: { place_id: pred.place_id, key: googleKey, fields: 'formatted_address,geometry,name', language: 'en' },
                timeout: 4000,
              });
              const detail = detailsRes.data?.result;
              if (detail?.geometry?.location) {
                const { lat, lng } = detail.geometry.location;
                if (isWithinMumbai(lat, lng)) {
                  placeResults.push({ name: detail.formatted_address || detail.name || pred.description, lat, lng });
                  if (placeResults.length + localMatches.length >= limit) break;
                }
              }
            } catch { /* skip */ }
          }
        }
      } catch (e) { console.warn('Google Places autocomplete failed:', (e as any)?.message); }
    }

    // ── 2.5 Geoapify Autocomplete ───────────────────────────────────────────
    const geoapifyKey = process.env.GEOAPIFY_API_KEY;
    const geoValid = geoapifyKey && geoapifyKey !== 'CHANGE_ME';
    if (geoValid && placeResults.length + localMatches.length < limit) {
      try {
        const geoCtx = `filter=rect:72.70,18.85,73.25,19.60&bias=proximity:72.8777,19.0760`;
        const url = `https://api.geoapify.com/v1/geocode/autocomplete?text=${encodeURIComponent(query + ' Mumbai')}&format=json&${geoCtx}&apiKey=${geoapifyKey}&limit=${limit}`;
        const geoRes = await axios.get(url, { timeout: 4000 });
        for (const item of geoRes.data?.results || []) {
          const name = item.formatted;
          const lat = item.lat;
          const lng = item.lon;
          if (isWithinMumbai(lat, lng) && !isRejectedSuggestion(name)) {
            placeResults.push({ name, lat, lng });
            if (placeResults.length + localMatches.length >= limit) break;
          }
        }
      } catch (e) { console.warn('Geoapify autocomplete error:', (e as any)?.message); }
    }

    // ── 3. Nominatim (strictly bounded to Mumbai, rejects highways) ───────────
    if (placeResults.length + localMatches.length < 3) {
      try {
        const nom = await axios.get('https://nominatim.openstreetmap.org/search', {
          params: {
            q: `${query} Mumbai`,
            format: 'json',
            addressdetails: 1,
            limit: limit,
            countrycodes: 'in',
            // Strict bounding box — NO results from Gujarat/outside Mumbai
            viewbox: `${MUMBAI_BOUNDS.lngMin},${MUMBAI_BOUNDS.latMax},${MUMBAI_BOUNDS.lngMax},${MUMBAI_BOUNDS.latMin}`,
            bounded: 1,
          },
          headers: { 'User-Agent': 'FlowCity/1.0' },
          timeout: 4000,
        });
        for (const item of nom.data || []) {
          const lat = parseFloat(item.lat);
          const lng = parseFloat(item.lon);
          const name = item.display_name as string;
          // Hard reject if outside Mumbai bounds or is a highway
          if (!isWithinMumbai(lat, lng)) continue;
          if (isRejectedSuggestion(name)) continue;
          // Reject if it looks like a road/highway type in OSM
          if (['motorway', 'trunk', 'primary', 'secondary', 'road'].includes(item.type)) continue;
          placeResults.push({ name, lat, lng });
          if (placeResults.length + localMatches.length >= limit) break;
        }
      } catch (e) { console.warn('Nominatim autocomplete error:', (e as any)?.message); }
    }

    // Merge: local registry first (most reliable), then external results
    const merged = [...localMatches, ...placeResults];
    const seen = new Set<string>();
    return merged.filter(item => {
      const key = `${Math.round(item.lat * 100)},${Math.round(item.lng * 100)}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    }).slice(0, limit);
  }
}

export const geocoderService = new GeocoderService();
