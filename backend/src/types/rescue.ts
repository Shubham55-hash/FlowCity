import { SimulationResult, SegmentDetail, Location } from '../services/ghostCommuteService';

export type DisruptionType = 'transit_delay' | 'crowd' | 'accident' | 'weather';

export interface DisruptionInfo {
  journeyId: string;
  type: DisruptionType;
  currentDelayMin: number;
  affectedSegmentIndex: number;
  description: string;
  severity: 'Low' | 'Medium' | 'High';
}

export interface RerouteOption {
  id: string;
  label: string;
  route: SimulationResult;
  timeImpactMin: number; // difference from original
  totalPredictedCost: number;
  costDiff: number;
  safetyScore: number;
  rank: number;
}

export interface ActiveJourney {
  journeyId: string;
  userId: string;
  originalPlan: SimulationResult;
  currentSegmentIndex: number;
  status: 'on_track' | 'delayed' | 'disrupted' | 'rerouting';
  lastChecked: Date;
}

export interface RescueAlert {
  journeyId: string;
  disruption: DisruptionInfo;
  options: RerouteOption[];
  expiresAt: string; // ISO string for the 60s window
}
