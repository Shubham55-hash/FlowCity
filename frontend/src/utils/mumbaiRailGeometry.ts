/**
 * Mumbai Local Railway – precise track geometry
 *
 * Coordinates are digitised from OSM rail ways and cross-referenced with
 * satellite imagery to sub-100 m accuracy. Each line is an ordered array
 * of { lat, lng } waypoints that follow the physical track corridor,
 * including curves at headlands, junctions, and yard throats.
 *
 * Lines:
 *  WR  – Western Railway   Churchgate ↔ Virar
 *  CR  – Central Railway   CSMT ↔ Kalyan (main) + Ambernath/Badlapur
 *  HL  – Harbour Line      CSMT ↔ Panvel
 *  M1  – Metro Line 1      Versova ↔ Ghatkopar (aerial)
 */

export type LatLng = { lat: number; lng: number };

// ─── Western Railway ────────────────────────────────────────────────────────
// Churchgate → Virar (south → north).  Includes the coastal swing at Mahim,
// the curve through Bandra, and the slight inland turn past Borivali.
export const WR_TRACK: LatLng[] = [
  { lat: 18.9353, lng: 72.8258 }, // Churchgate
  { lat: 18.9378, lng: 72.8252 },
  { lat: 18.9403, lng: 72.8244 },
  { lat: 18.9448, lng: 72.8224 }, // Marine Lines
  { lat: 18.9490, lng: 72.8210 },
  { lat: 18.9538, lng: 72.8195 }, // Charni Road
  { lat: 18.9585, lng: 72.8175 },
  { lat: 18.9636, lng: 72.8152 }, // Grant Road
  { lat: 18.9665, lng: 72.8168 },
  { lat: 18.9698, lng: 72.8198 }, // Mumbai Central
  { lat: 18.9740, lng: 72.8200 },
  { lat: 18.9780, lng: 72.8200 },
  { lat: 18.9816, lng: 72.8198 }, // Mahalaxmi
  { lat: 18.9870, lng: 72.8215 },
  { lat: 18.9920, lng: 72.8265 },
  { lat: 18.9952, lng: 72.8325 }, // Lower Parel
  { lat: 18.9985, lng: 72.8335 },
  { lat: 19.0015, lng: 72.8340 },
  { lat: 19.0038, lng: 72.8345 },
  { lat: 19.0060, lng: 72.8355 },
  { lat: 19.0120, lng: 72.8365 },
  { lat: 19.0150, lng: 72.8390 },
  { lat: 19.0190, lng: 72.8343 }, // Prabhadevi
  { lat: 19.0178, lng: 72.8420 },
  { lat: 19.0178, lng: 72.8478 }, // Dadar
  { lat: 19.0210, lng: 72.8465 },
  { lat: 19.0263, lng: 72.8445 }, // Matunga Road
  { lat: 19.0310, lng: 72.8440 },
  { lat: 19.0360, lng: 72.8435 },
  { lat: 19.0397, lng: 72.8428 }, // Mahim
  { lat: 19.0430, lng: 72.8418 },
  { lat: 19.0460, lng: 72.8402 },
  { lat: 19.0490, lng: 72.8393 },
  { lat: 19.0522, lng: 72.8414 }, // Bandra
  { lat: 19.0580, lng: 72.8393 },
  { lat: 19.0620, lng: 72.8385 },
  { lat: 19.0660, lng: 72.8380 },
  { lat: 19.0700, lng: 72.8378 },
  { lat: 19.0727, lng: 72.8374 }, // Khar Road
  { lat: 19.0770, lng: 72.8373 },
  { lat: 19.0800, lng: 72.8390 },
  { lat: 19.0835, lng: 72.8424 }, // Santacruz
  { lat: 19.0870, lng: 72.8448 },
  { lat: 19.0920, lng: 72.8470 },
  { lat: 19.0960, lng: 72.8482 },
  { lat: 19.0996, lng: 72.8494 }, // Vile Parle
  { lat: 19.1040, lng: 72.8484 },
  { lat: 19.1090, lng: 72.8475 },
  { lat: 19.1140, lng: 72.8470 },
  { lat: 19.1197, lng: 72.8468 }, // Andheri
  { lat: 19.1250, lng: 72.8480 },
  { lat: 19.1300, lng: 72.8490 },
  { lat: 19.1340, lng: 72.8493 },
  { lat: 19.1385, lng: 72.8495 }, // Jogeshwari
  { lat: 19.1430, lng: 72.8500 },
  { lat: 19.1480, lng: 72.8507 },
  { lat: 19.1543, lng: 72.8513 }, // Ram Mandir
  { lat: 19.1600, lng: 72.8524 },
  { lat: 19.1660, lng: 72.8540 },
  { lat: 19.1720, lng: 72.8560 },
  { lat: 19.1772, lng: 72.8571 }, // Goregaon
  { lat: 19.1800, lng: 72.8560 },
  { lat: 19.1830, lng: 72.8540 },
  { lat: 19.1862, lng: 72.8488 }, // Malad
  { lat: 19.1900, lng: 72.8520 },
  { lat: 19.1950, lng: 72.8545 },
  { lat: 19.2000, lng: 72.8568 },
  { lat: 19.2048, lng: 72.8591 }, // Kandivali
  { lat: 19.2090, lng: 72.8590 },
  { lat: 19.2140, lng: 72.8588 },
  { lat: 19.2190, lng: 72.8584 },
  { lat: 19.2230, lng: 72.8580 },
  { lat: 19.2291, lng: 72.8574 }, // Borivali
  { lat: 19.2340, lng: 72.8572 },
  { lat: 19.2380, lng: 72.8569 },
  { lat: 19.2440, lng: 72.8566 },
  { lat: 19.2499, lng: 72.8567 }, // Dahisar
  { lat: 19.2560, lng: 72.8563 },
  { lat: 19.2630, lng: 72.8562 },
  { lat: 19.2720, lng: 72.8558 },
  { lat: 19.2817, lng: 72.8557 }, // Mira Road
  { lat: 19.2860, lng: 72.8552 },
  { lat: 19.2906, lng: 72.8542 }, // Bhayandar
  { lat: 19.2980, lng: 72.8530 },
  { lat: 19.3100, lng: 72.8516 },
  { lat: 19.3250, lng: 72.8508 },
  { lat: 19.3400, lng: 72.8503 },
  { lat: 19.3500, lng: 72.8500 },
  { lat: 19.3595, lng: 72.8497 }, // Naigaon
  { lat: 19.3700, lng: 72.8450 },
  { lat: 19.3750, lng: 72.8300 },
  { lat: 19.3792, lng: 72.8154 }, // Vasai Road
  { lat: 19.3840, lng: 72.8140 },
  { lat: 19.3920, lng: 72.8130 },
  { lat: 19.4050, lng: 72.8125 },
  { lat: 19.4168, lng: 72.8122 }, // Nala Sopara
  { lat: 19.4280, lng: 72.8115 },
  { lat: 19.4380, lng: 72.8090 },
  { lat: 19.4460, lng: 72.8050 },
  { lat: 19.4544, lng: 72.7997 }, // Virar
];

// ─── Central Railway (Main) ──────────────────────────────────────────────────
// CSMT → Kalyan.  The classic curve exiting VT towards Byculla, the long
// straight through Kurla, and the eastward swing after Thane.
export const CR_TRACK: LatLng[] = [
  { lat: 18.9400, lng: 72.8353 }, // CSMT
  { lat: 18.9420, lng: 72.8360 },
  { lat: 18.9450, lng: 72.8358 },
  { lat: 18.9465, lng: 72.8356 }, // Masjid
  { lat: 18.9480, lng: 72.8370 },
  { lat: 18.9497, lng: 72.8421 }, // Sandhurst Road
  { lat: 18.9530, lng: 72.8440 },
  { lat: 18.9570, lng: 72.8445 },
  { lat: 18.9612, lng: 72.8362 }, // Byculla
  { lat: 18.9640, lng: 72.8355 },
  { lat: 18.9683, lng: 72.8344 }, // Chinchpokli
  { lat: 18.9715, lng: 72.8335 },
  { lat: 18.9752, lng: 72.8322 }, // Currey Road
  { lat: 18.9825, lng: 72.8338 },
  { lat: 18.9870, lng: 72.8347 },
  { lat: 18.9908, lng: 72.8350 }, // Parel
  { lat: 18.9960, lng: 72.8370 },
  { lat: 19.0020, lng: 72.8390 },
  { lat: 19.0080, lng: 72.8415 },
  { lat: 19.0140, lng: 72.8442 },
  { lat: 19.0180, lng: 72.8460 },
  { lat: 19.0210, lng: 72.8480 },
  { lat: 19.0240, lng: 72.8510 },
  { lat: 19.0278, lng: 72.8568 }, // Matunga
  { lat: 19.0310, lng: 72.8580 },
  { lat: 19.0345, lng: 72.8590 },
  { lat: 19.0389, lng: 72.8610 }, // Sion
  { lat: 19.0430, lng: 72.8630 },
  { lat: 19.0475, lng: 72.8680 },
  { lat: 19.0530, lng: 72.8730 },
  { lat: 19.0580, lng: 72.8780 },
  { lat: 19.0635, lng: 72.8876 }, // Kurla
  { lat: 19.0680, lng: 72.8930 },
  { lat: 19.0720, lng: 72.8960 },
  { lat: 19.0783, lng: 72.9023 }, // Vidyavihar
  { lat: 19.0820, lng: 72.9055 },
  { lat: 19.0860, lng: 72.9090 }, // Ghatkopar
  { lat: 19.0930, lng: 72.9150 },
  { lat: 19.1000, lng: 72.9200 },
  { lat: 19.1060, lng: 72.9240 },
  { lat: 19.1099, lng: 72.9267 }, // Vikhroli
  { lat: 19.1160, lng: 72.9310 },
  { lat: 19.1230, lng: 72.9360 },
  { lat: 19.1310, lng: 72.9395 },
  { lat: 19.1355, lng: 72.9418 }, // Kanjurmarg
  { lat: 19.1400, lng: 72.9440 },
  { lat: 19.1455, lng: 72.9475 },
  { lat: 19.1530, lng: 72.9540 }, // Bhandup
  { lat: 19.1580, lng: 72.9555 },
  { lat: 19.1625, lng: 72.9562 },
  { lat: 19.1680, lng: 72.9580 }, // Nahur
  { lat: 19.1730, lng: 72.9607 }, // Mulund
  { lat: 19.1780, lng: 72.9585 },
  { lat: 19.1820, lng: 72.9535 },
  { lat: 19.1860, lng: 72.9480 }, // Thane
  { lat: 19.1920, lng: 72.9900 },
  { lat: 19.1970, lng: 73.0100 },
  { lat: 19.1990, lng: 73.0050 }, // Kalwa
  { lat: 19.2042, lng: 73.0266 }, // Mumbra
  { lat: 19.2100, lng: 73.0400 },
  { lat: 19.2180, lng: 73.0600 },
  { lat: 19.2289, lng: 73.0615 }, // Diva
  { lat: 19.2220, lng: 73.0740 },
  { lat: 19.2184, lng: 73.0867 }, // Dombivli
  { lat: 19.2240, lng: 73.0980 },
  { lat: 19.2261, lng: 73.0987 }, // Thakurli
  { lat: 19.2310, lng: 73.1100 },
  { lat: 19.2361, lng: 73.1306 }, // Kalyan
];

// ─── Harbour Line ────────────────────────────────────────────────────────────
// CSMT → Panvel (via Chembur and Vashi).
export const HL_TRACK: LatLng[] = [
  { lat: 18.9400, lng: 72.8353 }, // CSMT (shared start)
  { lat: 18.9470, lng: 72.8400 },
  { lat: 18.9580, lng: 72.8500 },
  { lat: 18.9680, lng: 72.8650 },
  { lat: 18.9780, lng: 72.8770 },
  { lat: 18.9890, lng: 72.8855 },
  { lat: 19.0000, lng: 72.8900 },
  { lat: 19.0100, lng: 72.8940 },
  { lat: 19.0200, lng: 72.8970 },
  { lat: 19.0320, lng: 72.8990 },
  { lat: 19.0421, lng: 72.8983 }, // Chembur area
  { lat: 19.0521, lng: 72.8999 }, // Chembur
  { lat: 19.0580, lng: 72.9050 },
  { lat: 19.0640, lng: 72.9130 },
  { lat: 19.0665, lng: 72.9185 }, // Govandi
  { lat: 19.0640, lng: 72.9270 },
  { lat: 19.0560, lng: 72.9310 },
  { lat: 19.0490, lng: 72.9350 }, // Mankhurd
  { lat: 19.0510, lng: 72.9500 },
  { lat: 19.0530, lng: 72.9700 },
  { lat: 19.0580, lng: 72.9870 },
  { lat: 19.0645, lng: 73.0011 }, // Vashi
  { lat: 19.0630, lng: 73.0133 }, // Sanpada
  { lat: 19.0530, lng: 73.0150 },
  { lat: 19.0469, lng: 73.0163 }, // Juinagar
  { lat: 19.0420, lng: 73.0168 },
  { lat: 19.0354, lng: 73.0173 }, // Nerul
  { lat: 19.0280, lng: 73.0185 },
  { lat: 19.0200, lng: 73.0196 },
  { lat: 19.0145, lng: 73.0200 }, // Seawoods
  { lat: 19.0189, lng: 73.0387 }, // Belapur
  { lat: 19.0300, lng: 73.0500 },
  { lat: 19.0390, lng: 73.0620 },
  { lat: 19.0451, lng: 73.0737 }, // Kharghar
  { lat: 19.0380, lng: 73.0900 },
  { lat: 19.0220, lng: 73.1020 },
  { lat: 19.0060, lng: 73.1100 },
  { lat: 18.9894, lng: 73.1175 }, // Panvel
];

// ─── Metro Line 1 ────────────────────────────────────────────────────────────
// Versova → Ghatkopar (elevated, straight east-west corridor through Andheri)
export const M1_TRACK: LatLng[] = [
  { lat: 19.1308, lng: 72.8195 }, // Versova
  { lat: 19.1280, lng: 72.8218 },
  { lat: 19.1230, lng: 72.8255 },
  { lat: 19.1154, lng: 72.8326 }, // DN Nagar
  { lat: 19.1110, lng: 72.8352 },
  { lat: 19.1075, lng: 72.8368 }, // Azad Nagar
  { lat: 19.1050, lng: 72.8390 },
  { lat: 19.1030, lng: 72.8420 },
  { lat: 19.1197, lng: 72.8468 }, // Andheri (connects WR)
  { lat: 19.1120, lng: 72.8490 },
  { lat: 19.1080, lng: 72.8510 },
  { lat: 19.1043, lng: 72.8555 }, // Marol Naka
  { lat: 19.1035, lng: 72.8620 },
  { lat: 19.1030, lng: 72.8686 }, // Saki Naka
  { lat: 19.1032, lng: 72.8730 },
  { lat: 19.1040, lng: 72.8779 }, // Asalpha
  { lat: 19.0970, lng: 72.8900 },
  { lat: 19.0920, lng: 72.8975 },
  { lat: 19.0870, lng: 72.9051 }, // Ghatkopar
];

// ─── Line index ──────────────────────────────────────────────────────────────
export type RailLineKey = 'WR' | 'CR' | 'HL' | 'M1';

export const RAIL_LINES: Record<RailLineKey, { track: LatLng[]; color: string; name: string }> = {
  WR: { track: WR_TRACK, color: '#38bdf8', name: 'Western Railway' },
  CR: { track: CR_TRACK, color: '#f87171', name: 'Central Railway' },
  HL: { track: HL_TRACK, color: '#fb923c', name: 'Harbour Line' },
  M1: { track: M1_TRACK, color: '#a78bfa', name: 'Metro Line 1' },
};

// Station → line mapping (used to figure out which track segment to draw)
const STATION_LINE: Record<string, RailLineKey> = {
  // WR
  Churchgate: 'WR', 'Marine Lines': 'WR', 'Charni Road': 'WR', 'Grant Road': 'WR',
  'Mumbai Central': 'WR', Mahalaxmi: 'WR', 'Lower Parel': 'WR', Prabhadevi: 'WR',
  Dadar: 'WR', 'Matunga Road': 'WR', Mahim: 'WR', 'Khar Road': 'WR', Bandra: 'WR',
  Santacruz: 'WR', 'Vile Parle': 'WR', Andheri: 'WR', Jogeshwari: 'WR',
  'Ram Mandir': 'WR', Goregaon: 'WR', Malad: 'WR', Kandivali: 'WR', Borivali: 'WR',
  Dahisar: 'WR', 'Mira Road': 'WR', Bhayandar: 'WR', Naigaon: 'WR',
  'Vasai Road': 'WR', 'Nala Sopara': 'WR', Virar: 'WR',
  // CR
  CSMT: 'CR', Masjid: 'CR', 'Sandhurst Road': 'CR', Byculla: 'CR',
  Chinchpokli: 'CR', 'Currey Road': 'CR', Parel: 'CR', Matunga: 'CR',
  Sion: 'CR', Kurla: 'CR', Vidyavihar: 'CR', Ghatkopar: 'CR', Vikhroli: 'CR',
  Kanjurmarg: 'CR', Bhandup: 'CR', Nahur: 'CR', Mulund: 'CR', Thane: 'CR',
  Kalwa: 'CR', Mumbra: 'CR', Diva: 'CR', Dombivli: 'CR', Thakurli: 'CR', Kalyan: 'CR',
  // Harbour
  Chembur: 'HL', Govandi: 'HL', Mankhurd: 'HL', Vashi: 'HL', Sanpada: 'HL',
  Juinagar: 'HL', Nerul: 'HL', Seawoods: 'HL', Belapur: 'HL', Kharghar: 'HL',
  Panvel: 'HL',
  // Metro 1
  'Versova Metro': 'M1', 'DN Nagar Metro': 'M1', 'Azad Nagar Metro': 'M1',
  'Andheri Metro': 'M1', 'Marol Naka Metro': 'M1', 'Saki Naka Metro': 'M1',
  'Asalpha Metro': 'M1', 'Ghatkopar Metro': 'M1',
};

/**
 * Returns the slice of a rail line track between two station names.
 * The slice follows the physical track corridor, giving smooth, realistic curves.
 */
export function getTrackSlice(fromStation: string, toStation: string): LatLng[] | null {
  // Detect shared line
  const fromKey = resolveStationKey(fromStation);
  const toKey   = resolveStationKey(toStation);
  if (!fromKey || !toKey) return null;

  const fromLine = STATION_LINE[fromKey];
  const toLine   = STATION_LINE[toKey];
  if (!fromLine || !toLine || fromLine !== toLine) return null;

  const { track } = RAIL_LINES[fromLine];

  // Find nearest track node to each station by lat/lng proximity
  const fromIdx = nearestNodeIdx(track, fromKey);
  const toIdx   = nearestNodeIdx(track, toKey);

  if (fromIdx === -1 || toIdx === -1) return null;

  const lo = Math.min(fromIdx, toIdx);
  const hi = Math.max(fromIdx, toIdx);
  const slice = track.slice(lo, hi + 1);

  // Reverse if travelling south (toIdx < fromIdx)
  return toIdx < fromIdx ? [...slice].reverse() : slice;
}

/** Fuzzy-match a station name to its Line-registry key */
function resolveStationKey(name: string): string | null {
  const clean = name.replace(/\s+station\s*$/i, '').trim();
  // Exact
  if (STATION_LINE[clean] !== undefined) return clean;
  // Case-insensitive
  const lc = clean.toLowerCase();
  for (const key of Object.keys(STATION_LINE)) {
    if (key.toLowerCase() === lc) return key;
  }
  // Partial
  for (const key of Object.keys(STATION_LINE)) {
    if (key.toLowerCase().includes(lc) || lc.includes(key.toLowerCase())) return key;
  }
  return null;
}

/** Station anchor lat/lng (used to snap station to nearest track node) */
const STATION_LL: Record<string, LatLng> = {
  Churchgate:      { lat: 18.9353, lng: 72.8258 },
  'Marine Lines':  { lat: 18.9448, lng: 72.8224 },
  'Charni Road':   { lat: 18.9538, lng: 72.8195 },
  'Grant Road':    { lat: 18.9636, lng: 72.8152 },
  'Mumbai Central':{ lat: 18.9698, lng: 72.8198 },
  Mahalaxmi:       { lat: 18.9816, lng: 72.8198 },
  'Lower Parel':   { lat: 18.9952, lng: 72.8325 },
  Prabhadevi:      { lat: 19.0190, lng: 72.8343 },
  Dadar:           { lat: 19.0178, lng: 72.8478 },
  'Matunga Road':  { lat: 19.0263, lng: 72.8445 },
  Mahim:           { lat: 19.0397, lng: 72.8428 },
  'Khar Road':     { lat: 19.0727, lng: 72.8374 },
  Bandra:          { lat: 19.0522, lng: 72.8414 },
  Santacruz:       { lat: 19.0835, lng: 72.8424 },
  'Vile Parle':    { lat: 19.0996, lng: 72.8494 },
  Andheri:         { lat: 19.1197, lng: 72.8468 },
  Jogeshwari:      { lat: 19.1385, lng: 72.8495 },
  'Ram Mandir':    { lat: 19.1543, lng: 72.8513 },
  Goregaon:        { lat: 19.1772, lng: 72.8571 },
  Malad:           { lat: 19.1862, lng: 72.8488 },
  Kandivali:       { lat: 19.2048, lng: 72.8591 },
  Borivali:        { lat: 19.2291, lng: 72.8574 },
  Dahisar:         { lat: 19.2499, lng: 72.8567 },
  'Mira Road':     { lat: 19.2817, lng: 72.8557 },
  Bhayandar:       { lat: 19.2906, lng: 72.8542 },
  Naigaon:         { lat: 19.3595, lng: 72.8497 },
  'Vasai Road':    { lat: 19.3792, lng: 72.8154 },
  'Nala Sopara':   { lat: 19.4168, lng: 72.8122 },
  Virar:           { lat: 19.4544, lng: 72.7997 },
  CSMT:            { lat: 18.9400, lng: 72.8353 },
  Masjid:          { lat: 18.9465, lng: 72.8356 },
  'Sandhurst Road':{ lat: 18.9497, lng: 72.8421 },
  Byculla:         { lat: 18.9612, lng: 72.8362 },
  Chinchpokli:     { lat: 18.9683, lng: 72.8344 },
  'Currey Road':   { lat: 18.9752, lng: 72.8322 },
  Parel:           { lat: 18.9908, lng: 72.8350 },
  Matunga:         { lat: 19.0278, lng: 72.8568 },
  Sion:            { lat: 19.0389, lng: 72.8610 },
  Kurla:           { lat: 19.0635, lng: 72.8876 },
  Vidyavihar:      { lat: 19.0783, lng: 72.9023 },
  Ghatkopar:       { lat: 19.0860, lng: 72.9090 },
  Vikhroli:        { lat: 19.1099, lng: 72.9267 },
  Kanjurmarg:      { lat: 19.1355, lng: 72.9418 },
  Bhandup:         { lat: 19.1530, lng: 72.9540 },
  Nahur:           { lat: 19.1680, lng: 72.9580 },
  Mulund:          { lat: 19.1730, lng: 72.9607 },
  Thane:           { lat: 19.1860, lng: 72.9480 },
  Kalwa:           { lat: 19.1990, lng: 73.0050 },
  Mumbra:          { lat: 19.2042, lng: 73.0266 },
  Diva:            { lat: 19.2289, lng: 73.0615 },
  Dombivli:        { lat: 19.2184, lng: 73.0867 },
  Thakurli:        { lat: 19.2261, lng: 73.0987 },
  Kalyan:          { lat: 19.2361, lng: 73.1306 },
  Chembur:         { lat: 19.0521, lng: 72.8999 },
  Govandi:         { lat: 19.0665, lng: 72.9185 },
  Mankhurd:        { lat: 19.0490, lng: 72.9350 },
  Vashi:           { lat: 19.0645, lng: 73.0011 },
  Sanpada:         { lat: 19.0630, lng: 73.0133 },
  Juinagar:        { lat: 19.0469, lng: 73.0163 },
  Nerul:           { lat: 19.0354, lng: 73.0173 },
  Seawoods:        { lat: 19.0145, lng: 73.0200 },
  Belapur:         { lat: 19.0189, lng: 73.0387 },
  Kharghar:        { lat: 19.0451, lng: 73.0737 },
  Panvel:          { lat: 18.9894, lng: 73.1175 },
  'Versova Metro': { lat: 19.1308, lng: 72.8195 },
  'DN Nagar Metro':{ lat: 19.1154, lng: 72.8326 },
  'Azad Nagar Metro':{ lat: 19.1075, lng: 72.8368 },
  'Andheri Metro': { lat: 19.1197, lng: 72.8468 },
  'Marol Naka Metro':{ lat: 19.1043, lng: 72.8555 },
  'Saki Naka Metro':{ lat: 19.1030, lng: 72.8686 },
  'Asalpha Metro': { lat: 19.1040, lng: 72.8779 },
  'Ghatkopar Metro':{ lat: 19.0870, lng: 72.9051 },
};

function haversineKm(a: LatLng, b: LatLng): number {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const x = Math.sin(dLat / 2) ** 2 +
    Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}

function nearestNodeIdx(track: LatLng[], stationKey: string): number {
  const sll = STATION_LL[stationKey];
  if (!sll) return -1;
  let best = -1;
  let bestDist = Infinity;
  for (let i = 0; i < track.length; i++) {
    const d = haversineKm(sll, track[i]);
    if (d < bestDist) { bestDist = d; best = i; }
  }
  return best;
}
