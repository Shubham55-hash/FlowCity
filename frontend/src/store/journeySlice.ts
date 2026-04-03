import { configureStore, createSlice, PayloadAction, createAsyncThunk } from '@reduxjs/toolkit';
import axios from 'axios';

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
}

interface JourneyState {
  results: Route[];
  selectedRoute: Route | null;
  activeJourneyProgress: number; // 0-100 percentage
  isSimulationRunning: boolean;
  loading: boolean;
  error: string | null;
  searchParams: { from: string; to: string; time: string; preference: string };
}

const initialState: JourneyState = {
  results: [],
  selectedRoute: null,
  activeJourneyProgress: 0,
  isSimulationRunning: false,
  loading: false,
  error: null,
  searchParams: { from: '', to: '', time: '', preference: 'Safety' }
};

export const fetchRoutes = createAsyncThunk(
  'journey/fetchRoutes',
  async (params: any) => {
    const defaultApiUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
    try {
      const response = await axios.post(`${defaultApiUrl}/ghost-commute/simulate`, {
        startLocation: { name: params.from, lat: 0, lng: 0 },
        endLocation: { name: params.to, lat: 0, lng: 0 },
        departureTime: new Date().toISOString(),
        preferences: {
          priority: params.preference ? params.preference.toLowerCase() : 'time',
        }
      });
      
      const sim = response.data;
      
      const optRoute = {
        id: 'primary',
        mode: sim.segments?.[0]?.type || 'Transit',
        from: params.from || 'Origin',
        to: params.to || 'Destination',
        trustScore: sim.overallRisk === 'Low' ? 92 : sim.overallRisk === 'High' ? 45 : 75,
        status: sim.overallRisk === 'Low' ? 'Safe' : sim.overallRisk === 'High' ? 'Risky' : 'Moderate',
        eta: sim.totalTimeMin || 0,
        cost: Math.round((sim.totalTimeMin || 30) * 1.5), 
        safetyRating: sim.overallSafetyScore || 80,
        summary: sim.summary || (sim.segments && sim.segments.map((s: any) => s.type).join(' + ')),
        segments: sim.segments ? sim.segments.map((s: any) => ({
          mode: s.type,
          duration: s.predictedDurationMin,
          instructions: `${s.from} to ${s.to}`
        })) : []
      };

      const alts = (sim.alternatives || []).map((alt: any, i: number) => ({
        id: `alt-${i}`,
        mode: alt.label?.includes('Cab') ? 'Cab' : 'Bus',
        from: params.from,
        to: params.to,
        trustScore: alt.confidence || 70,
        status: (alt.safetyScore || 0) >= 80 ? 'Safe' : 'Moderate',
        eta: alt.totalTimeMin || 0,
        cost: alt.costScore || 50,
        safetyRating: alt.safetyScore || 80,
        summary: alt.label || 'Alternative',
        segments: alt.legs ? alt.legs.map((l: string) => ({ mode: 'Transit', duration: alt.totalTimeMin, instructions: l })) : []
      }));

      return [optRoute, ...alts] as Route[];
    } catch (error) {
      console.error("Ghost Commute API Error:", error);
      throw error;
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
    },
    tickSimulation: (state) => {
      if (state.isSimulationRunning && state.activeJourneyProgress < 100) {
        state.activeJourneyProgress += 1;
      }
    },
    switchActiveRoute: (state, action: PayloadAction<string>) => {
      const newRoute = state.results.find(r => r.id === action.payload);
      if (newRoute) {
        state.selectedRoute = newRoute;
        state.activeJourneyProgress = Math.min(state.activeJourneyProgress, 80);
      }
    },
    updateSearchParams: (state, action: PayloadAction<any>) => {
      state.searchParams = { ...state.searchParams, ...action.payload };
    }
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchRoutes.pending, (state) => { state.loading = true; })
      .addCase(fetchRoutes.fulfilled, (state, action) => {
        state.loading = false;
        state.results = action.payload;
      })
      .addCase(fetchRoutes.rejected, (state) => {
        state.loading = false;
        state.error = 'Failed to fetch routes';
      });
  }
});

export const { selectRoute, updateSearchParams, tickSimulation, switchActiveRoute } = journeySlice.actions;

export const store = configureStore({
  reducer: {
    journey: journeySlice.reducer
  }
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
