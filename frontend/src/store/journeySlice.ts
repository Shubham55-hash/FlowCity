import { configureStore, createSlice, PayloadAction, createAsyncThunk } from '@reduxjs/toolkit';
import axios from 'axios';
import { getRouteCoordinates } from '../utils/stationCoordinates';

interface Location {
  name: string;
  lat: number;
  lng: number;
}

interface Route {
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
  segments: { mode: string; duration: number; instructions: string }[];
  fromCoords?: { lat: number; lng: number };
  toCoords?: { lat: number; lng: number };
  routeGeometry?: Array<{ lat: number; lng: number }>;
  dataSources?: string[];
}


interface JourneyState {
  results: Route[];
  selectedRoute: Route | null;
  activeJourneyProgress: number; // 0-100 percentage
  isSimulationRunning: boolean;
  loading: boolean;
  error: string | null;
  searchParams: { from: string; to: string; time: string; preference: string };
  activeAlert: any | null;
}

const initialState: JourneyState = {
  results: [],
  selectedRoute: null,
  activeJourneyProgress: 0,
  isSimulationRunning: false,
  loading: false,
  error: null,
  searchParams: { from: '', to: '', time: '', preference: 'Safety' },
  activeAlert: null
};

export const fetchRoutes = createAsyncThunk(
  'journey/fetchRoutes',
  async (params: any) => {
    // MOCK: In production, call /api/journey/plan
    await new Promise(res => setTimeout(res, 1000));
    return [
      {
        id: 'R1', mode: 'Metro', from: params.from, to: params.to,
        trustScore: 92, status: 'Safe', eta: 32, cost: 20, safetyRating: 95,
        summary: 'Metro Line 1 + 5 min walk',
        segments: [{ mode: 'Walk', duration: 5, instructions: 'Walk to Azad Nagar' }, { mode: 'Metro', duration: 27, instructions: 'Line 1 towards Ghatkopar' }]
      },
      {
        id: 'R2', mode: 'Cab', from: params.from, to: params.to,
        trustScore: 74, status: 'Moderate', eta: 45, cost: 250, safetyRating: 82,
        summary: 'Direct Cab via Sea Link',
        segments: [{ mode: 'Cab', duration: 45, instructions: 'Via Bandra-Worli Sea Link' }]
      },
      {
        id: 'R3', mode: 'Bus', from: params.from, to: params.to,
        trustScore: 55, status: 'Risky', eta: 70, cost: 15, safetyRating: 65,
        summary: 'BEST Bus 202',
        segments: [{ mode: 'Bus', duration: 70, instructions: 'Take 202 from Bus Depot' }]
      }
    ] as Route[];
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
    switchActiveRoute: (state, action: PayloadAction<any>) => {
      // action.payload can be a string (ID) or a full route object from rescue alert
      if (typeof action.payload === 'string') {
        const newRoute = state.results.find(r => r.id === action.payload);
        if (newRoute) {
          state.selectedRoute = newRoute;
        }
      } else {
        // From Rescue Mode Option
        state.selectedRoute = action.payload;
      }
      
      // When switching due to rescue, we usually drop progress slightly to account for the new leg
      state.activeJourneyProgress = Math.max(0, Math.min(state.activeJourneyProgress, 85));
      state.activeAlert = null;
    },
    updateSearchParams: (state, action: PayloadAction<any>) => {
      state.searchParams = { ...state.searchParams, ...action.payload };
    },
    setAlert: (state, action: PayloadAction<any>) => {
      state.activeAlert = action.payload;
    },
    clearAlert: (state) => {
      state.activeAlert = null;
    }
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchRoutes.pending, (state) => { state.loading = true; })
      .addCase(fetchRoutes.fulfilled, (state, action) => {
        state.loading = false;
        state.results = action.payload;
        if (action.payload.length > 0) {
          state.selectedRoute = action.payload[0];
          state.activeJourneyProgress = 0;
          state.isSimulationRunning = true;
        }
      })
      .addCase(fetchRoutes.rejected, (state) => {
        state.loading = false;
        state.error = 'Failed to fetch routes';
      });
  }
});

export const { selectRoute, updateSearchParams, tickSimulation, switchActiveRoute, setAlert, clearAlert } = journeySlice.actions;

export const store = configureStore({
  reducer: {
    journey: journeySlice.reducer
  }
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
