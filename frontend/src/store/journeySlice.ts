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
    try {
      const response = await axios.post('http://localhost:5000/api/journey/plan', {
        from: params.from,
        to: params.to,
        time: params.time || new Date().toISOString(),
        preferences: { priority: params.preference?.toLowerCase() || 'safety' }
      });

      const mainData = response.data.data;
      const sim = mainData.simulationDetails;

      const mapMode = (type: string) => {
        if (!type) return 'Car';
        if (type === 'local_train') return 'Train';
        if (type === 'metro') return 'Metro';
        if (type === 'bus') return 'Bus';
        if (type === 'walk') return 'Walk';
        return 'Car';
      };

      const mainRoute: Route = {
        id: mainData.id,
        mode: mainData.mode,
        from: mainData.from,
        to: mainData.to,
        trustScore: mainData.trustScore,
        status: mainData.status,
        eta: mainData.eta,
        cost: mainData.cost || 0,
        safetyRating: sim?.overallSafetyScore || mainData.trustScore,
        summary: sim?.summary || `${mainData.mode} journey`,
        segments: (() => {
          const segs: any[] = [];
          (sim?.segments || []).forEach((s: any) => {
            if (s.waitTimeMin && s.waitTimeMin > 0) {
              segs.push({
                mode: 'Wait',
                duration: s.waitTimeMin,
                instructions: `Wait for ${mapMode(s.type)} at ${s.from}`
              });
            }
            segs.push({
              mode: mapMode(s.type),
              duration: s.predictedDurationMin,
              instructions: `${s.from} to ${s.to}`
            });
          });
          return segs;
        })()
      };

      const alternatives: Route[] = (mainData.alternatives || []).map((alt: any) => ({
        id: alt.id,
        mode: alt.mode || alt.label,
        from: mainData.from,
        to: mainData.to,
        trustScore: alt.trustScore || alt.safetyScore || 80,
        status: (alt.trustScore || alt.safetyScore) > 80 ? 'Safe' : 'Moderate',
        eta: alt.eta || alt.totalTimeMin,
        cost: alt.predictedCost || 0,
        safetyRating: alt.trustScore || alt.safetyScore || 80,
        summary: alt.label || alt.mode,
        segments: Array.isArray(alt.legs) 
          ? alt.legs.map((l: string) => ({ mode: 'Multi', duration: 0, instructions: l }))
          : [{ mode: 'Multi', duration: alt.eta || alt.totalTimeMin, instructions: 'Direct route' }]
      }));

      return [mainRoute, ...alternatives];
    } catch (error) {
      console.error('API Error:', error);
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
