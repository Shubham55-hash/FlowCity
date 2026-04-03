import { configureStore, createSlice, PayloadAction, createAsyncThunk } from '@reduxjs/toolkit';
import axios from 'axios';
import { formatLegInstructions } from '../utils/formatLegInstructions';
import { getRouteCoordinates } from '../utils/stationCoordinates';

export interface TimelinePoint {
  timeIso: string;
  label: string;
  isRisk: boolean;
  errorBarMin: number;
  errorBarMax: number;
}

export interface RouteSegment {
  mode: string;
  duration: number;
  instructions: string;
  confidence?: number;
  waitTimeMin?: number;
  crowdLevel?: string;
  connectionRisk?: string;
  fromLatLng?: { lat: number; lng: number };
  toLatLng?: { lat: number; lng: number };
}

export interface Route {
  id: string;
  mode: string;
  from: string;
  to: string;
  trustScore: number;
  status: 'Safe' | 'Moderate' | 'Risky';
  eta: number;
  cost: number;
  safetyRating: number;
  summary: string;
  segments: RouteSegment[];
  fromCoords?: { lat: number; lng: number };
  toCoords?: { lat: number; lng: number };
  routeGeometry?: Array<{ lat: number; lng: number }>;
  dataSources?: string[];
  journeyTimeline?: TimelinePoint[];
  departureTimeIso?: string;
}

const apiBase = () => import.meta.env.VITE_API_URL || 'http://localhost:5000';

/** Coerce API / JSON points (numbers or numeric strings) for Leaflet + map fallbacks */
function normalizePoint(p: unknown): { lat: number; lng: number } | undefined {
  if (!p || typeof p !== 'object') return undefined;
  const o = p as Record<string, unknown>;
  const lat = Number(o.lat ?? o.latitude);
  const lng = Number(o.lng ?? o.longitude ?? o.lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return undefined;
  return { lat, lng };
}

function mapLegType(t: string): string {
  switch (t) {
    case 'walk':
      return 'Walk';
    case 'local_train':
      return 'Train';
    case 'metro':
      return 'Metro';
    case 'bus':
      return 'Bus';
    case 'cab':
      return 'Cab';
    case 'auto':
      return 'Auto';
    default:
      return 'Transit';
  }
}

function routeFromSimulation(
  id: string,
  from: string,
  to: string,
  trustScore: number,
  status: Route['status'],
  eta: number,
  cost: number,
  summary: string,
  simulation: Record<string, unknown>
): Route {
  const segmentsRaw = simulation.segments as Record<string, unknown>[] | undefined;
  const routeGeometryRaw = simulation.routeGeometry;
  const journeyTimeline = simulation.journeyTimeline as TimelinePoint[] | undefined;
  const dataSources = simulation.dataSources as string[] | undefined;

  const segments: RouteSegment[] = (segmentsRaw || []).map((s) => ({
    mode: mapLegType(String(s.type)),
    duration: Number(s.predictedDurationMin) || 0,
    instructions: formatLegInstructions(String(s.from ?? ''), String(s.to ?? '')),
    confidence: typeof s.confidence === 'number' ? s.confidence : undefined,
    waitTimeMin: typeof s.waitTimeMin === 'number' ? s.waitTimeMin : undefined,
    crowdLevel: typeof s.crowdLevel === 'string' ? s.crowdLevel : undefined,
    connectionRisk: typeof s.connectionRisk === 'string' ? s.connectionRisk : undefined,
    fromLatLng: normalizePoint(s.fromLatLng),
    toLatLng: normalizePoint(s.toLatLng),
  }));

  const geomFromApi = Array.isArray(routeGeometryRaw)
    ? (routeGeometryRaw as unknown[]).map(normalizePoint).filter((p): p is NonNullable<typeof p> => p != null)
    : [];

  const fallback = getRouteCoordinates(from, to);

  let fromCoords = geomFromApi[0];
  let toCoords = geomFromApi.length > 1 ? geomFromApi[geomFromApi.length - 1] : undefined;

  if (!fromCoords && segments.length) {
    fromCoords = segments[0].fromLatLng ?? segments[0].toLatLng;
  }
  if (!toCoords && segments.length) {
    const last = segments[segments.length - 1];
    toCoords = last.toLatLng ?? last.fromLatLng;
  }
  fromCoords = fromCoords ?? fallback.from;
  toCoords = toCoords ?? fallback.to;

  const routeGeometry: Route['routeGeometry'] =
    geomFromApi.length >= 2
      ? geomFromApi
      : fromCoords && toCoords
        ? [fromCoords, toCoords]
        : undefined;

  return {
    id,
    mode: mapLegType(String(segmentsRaw?.[0]?.type ?? 'metro')),
    from,
    to,
    trustScore,
    status,
    eta,
    cost,
    safetyRating: trustScore,
    summary,
    segments,
    fromCoords,
    toCoords,
    routeGeometry,
    dataSources,
    journeyTimeline,
  };
}

/** Build a Redux Route from a full ghost / rescue simulation payload */
export function mapSimulationToRoute(
  simulation: Record<string, unknown>,
  routeId: string,
  from: string,
  to: string
): Route {
  const trustScore = Number(simulation.overallSafetyScore ?? 80);
  const risk = String(simulation.overallRisk ?? 'Low');
  const status: Route['status'] =
    risk === 'Low' ? 'Safe' : risk === 'Medium' ? 'Moderate' : 'Risky';
  return routeFromSimulation(
    routeId,
    from,
    to,
    trustScore,
    status,
    Number(simulation.totalTimeMin ?? 0),
    Math.round(Number(simulation.totalPredictedCost ?? 0)),
    String(simulation.summary ?? 'Route'),
    simulation
  );
}

interface JourneyState {
  results: Route[];
  selectedRoute: Route | null;
  activeJourneyProgress: number;
  isSimulationRunning: boolean;
  loading: boolean;
  error: string | null;
  searchParams: { from: string; to: string; time: string; preference: string };
  activeAlert: unknown | null;
}

const initialState: JourneyState = {
  results: [],
  selectedRoute: null,
  activeJourneyProgress: 0,
  isSimulationRunning: false,
  loading: false,
  error: null,
  searchParams: { from: '', to: '', time: '', preference: 'Safety' },
  activeAlert: null,
};

/** Fallback when the API is offline — keeps the UI usable */
function mockRoutes(params: { from: string; to: string }): Route[] {
  const { from: fc, to: tc } = getRouteCoordinates(params.from, params.to);
  return [
    {
      id: 'R1',
      mode: 'Metro',
      from: params.from,
      to: params.to,
      trustScore: 92,
      status: 'Safe',
      eta: 32,
      cost: 20,
      safetyRating: 95,
      summary: 'Offline preview — start backend for live simulation',
      segments: [
        { mode: 'Walk', duration: 5, instructions: 'Walk to station' },
        { mode: 'Metro', duration: 27, instructions: 'Metro towards destination' },
      ],
      fromCoords: fc,
      toCoords: tc,
      routeGeometry: [fc, tc],
    },
  ];
}

export const fetchRoutes = createAsyncThunk(
  'journey/fetchRoutes',
  async (params: { from: string; to: string; time: string; preference: string }, { rejectWithValue }) => {
    const priority =
      params.preference?.toLowerCase() === 'time'
        ? 'time'
        : params.preference?.toLowerCase() === 'cost'
          ? 'cost'
          : 'safety';

    try {
      const { data } = await axios.post<{ status: string; data?: Record<string, unknown>; message?: string }>(
        `${apiBase()}/api/journey/plan`,
        {
          from: params.from.trim(),
          to: params.to.trim(),
          time: params.time || new Date().toISOString(),
          preferences: { priority, avoidCrowds: false },
        },
        { timeout: 120_000 }
      );

      if (data.status !== 'success' || !data.data) {
        return rejectWithValue(data.message || 'Plan failed');
      }

      const d = data.data;
      const sim = d.simulationDetails as Record<string, unknown> | undefined;
      if (!sim) {
        return rejectWithValue('Missing simulation details');
      }

      const statusVal = d.status as string;
      const mappedStatus: Route['status'] =
        statusVal === 'Safe' ? 'Safe' : statusVal === 'Moderate' ? 'Moderate' : 'Risky';

      const primary = routeFromSimulation(
        String(d.id),
        String(d.from),
        String(d.to),
        Number(d.trustScore),
        mappedStatus,
        Number(d.eta),
        Number(d.cost),
        String(sim.summary || d.summary || 'Journey'),
        sim
      );
      primary.departureTimeIso = params.time || new Date().toISOString();

      const alts = (d.alternatives || []) as Record<string, unknown>[];
      const altEndpoints = getRouteCoordinates(String(d.from), String(d.to));
      const altRoutes: Route[] = alts.map((alt) => ({
        id: String(alt.id),
        mode: 'Alt',
        from: String(d.from),
        to: String(d.to),
        trustScore: Number(alt.trustScore),
        status: Number(alt.trustScore) >= 75 ? 'Moderate' : 'Risky',
        eta: Number(alt.eta),
        cost: Number(alt.predictedCost),
        safetyRating: Number(alt.trustScore),
        summary: String(alt.mode),
        segments: [
          {
            mode: 'Transit',
            duration: Number(alt.eta),
            instructions: String(alt.mode),
          },
        ],
        fromCoords: altEndpoints.from,
        toCoords: altEndpoints.to,
        routeGeometry: [altEndpoints.from, altEndpoints.to],
      }));

      return [primary, ...altRoutes];
    } catch (err: unknown) {
      const msg = axios.isAxiosError(err)
        ? err.response?.data?.message || err.message
        : 'Network error';
      console.warn('Journey plan API error, using mock:', msg);
      return mockRoutes(params);
    }
  }
);

const journeySlice = createSlice({
  name: 'journey',
  initialState,
  reducers: {
    selectRoute: (state, action: PayloadAction<Route | null>) => {
      state.selectedRoute = action.payload;
      state.activeJourneyProgress = 0;
      state.isSimulationRunning = !!action.payload;
      state.activeAlert = null;
    },
    tickSimulation: (state) => {
      if (state.isSimulationRunning && state.activeJourneyProgress < 100) {
        state.activeJourneyProgress += 1;
      }
    },
    resetSimulationProgress: (state) => {
      state.activeJourneyProgress = 0;
    },
    switchActiveRoute: (state, action: PayloadAction<string | Route>) => {
      if (typeof action.payload === 'string') {
        const newRoute = state.results.find((r) => r.id === action.payload);
        if (newRoute) {
          state.selectedRoute = newRoute;
        }
      } else {
        state.selectedRoute = action.payload;
      }
      state.activeJourneyProgress = Math.max(0, Math.min(state.activeJourneyProgress, 85));
      state.activeAlert = null;
    },
    updateSearchParams: (state, action: PayloadAction<Partial<JourneyState['searchParams']>>) => {
      state.searchParams = { ...state.searchParams, ...action.payload };
    },
    setAlert: (state, action: PayloadAction<unknown>) => {
      state.activeAlert = action.payload;
    },
    clearAlert: (state) => {
      state.activeAlert = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchRoutes.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchRoutes.fulfilled, (state, action) => {
        state.loading = false;
        state.results = action.payload;
        if (action.payload.length > 0) {
          state.selectedRoute = action.payload[0];
          state.activeJourneyProgress = 0;
          state.isSimulationRunning = true;
        }
      })
      .addCase(fetchRoutes.rejected, (state, action) => {
        state.loading = false;
        state.error = (action.payload as string) || 'Failed to fetch routes';
      });
  },
});

export const {
  selectRoute,
  updateSearchParams,
  tickSimulation,
  resetSimulationProgress,
  switchActiveRoute,
  setAlert,
  clearAlert,
} = journeySlice.actions;

export const store = configureStore({
  reducer: {
    journey: journeySlice.reducer,
  },
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
