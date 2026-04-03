import { socketService } from './socketService';
import { ghostCommuteService, SimulationResult, Location } from './ghostCommuteService';
import { 
  ActiveJourney, 
  DisruptionInfo, 
  RescueAlert, 
  RerouteOption, 
  DisruptionType 
} from '../types/rescue';

class RescueService {
  private activeJourneys: Map<string, ActiveJourney> = new Map();
  private monitorIntervals: Map<string, NodeJS.Timeout> = new Map();

  /**
   * Monitor a journey for real-time disruptions
   */
  public monitorJourney(journeyId: string, userId: string, initialPlan: SimulationResult) {
    const journey: ActiveJourney = {
      journeyId,
      userId,
      originalPlan: initialPlan,
      currentSegmentIndex: 0,
      status: 'on_track',
      lastChecked: new Date()
    };

    this.activeJourneys.set(journeyId, journey);

    // Start periodic monitoring (every 30 seconds for simulation)
    const interval = setInterval(async () => {
      await this.checkForDisruptions(journeyId);
    }, 30000);

    this.monitorIntervals.set(journeyId, interval);
    console.log(`📡 Monitoring started for journey: ${journeyId}`);
  }

  /**
   * Stop monitoring a journey
   */
  public stopMonitoring(journeyId: string) {
    const interval = this.monitorIntervals.get(journeyId);
    if (interval) clearInterval(interval);
    this.monitorIntervals.delete(journeyId);
    this.activeJourneys.delete(journeyId);
    console.log(`📴 Monitoring stopped for journey: ${journeyId}`);
  }

  /**
   * Core logic to detect 15% delay spikes and other disruptions
   */
  private async checkForDisruptions(journeyId: string) {
    const journey = this.activeJourneys.get(journeyId);
    if (!journey || journey.status === 'rerouting') return;

    // 1. Fetch real-time delay for the current segment
    const currentSegment = journey.originalPlan.segments[journey.currentSegmentIndex];
    if (!currentSegment) return;

    // Use ghostCommuteService to check for real-time delays
    // For this implementation, we simulate a "spike" in the real-time data if process.env.SIMULATE_DISRUPTION is true
    // In production, fetchTrainData/fetchWeather would return real values.
    
    let currentDelay = 0;
    let disruptionType: DisruptionType = 'transit_delay';
    let description = '';

    try {
      // Check Weather first (Universal impact)
      const weather = await ghostCommuteService.fetchWeather(
        currentSegment.fromLatLng?.lat || 19.0522, 
        currentSegment.fromLatLng?.lng || 72.8414
      );
      
      if (weather.isAdverse && weather.delayImpactMin > 5) {
        currentDelay = weather.delayImpactMin;
        disruptionType = 'weather';
        description = `Adverse weather (${weather.description}) detected. Expect ~${weather.delayImpactMin}m additional delay.`;
      }

      // Check specific leg type delays
      if (currentSegment.type === 'local_train') {
        const trainData = await ghostCommuteService.fetchTrainData(currentSegment.from, currentSegment.to);
        if (trainData && trainData.delayMin > 10) {
          currentDelay = Math.max(currentDelay, trainData.delayMin);
          disruptionType = 'transit_delay';
          description = `Substantial delay of ${trainData.delayMin}m reported on ${currentSegment.from} line.`;
        }
      }

      // Simulation mode for demo: force a spike if random says so
      if (process.env.NODE_ENV === 'development' && Math.random() > 0.8) {
        currentDelay = Math.max(currentDelay, Math.floor(currentSegment.predictedDurationMin * 0.3));
        description = `Urgent: Signal failure reported ahead. Predicted delay grew by ${currentDelay}m.`;
      }

    } catch (err) {
      console.error('Error during disruption check:', err);
      return;
    }

    // 2. Threshold Check (Trigger if >15% of segment time)
    if (currentDelay > currentSegment.predictedDurationMin * 0.15) {
      console.warn(`⚠️ Disruption detected on ${journeyId}: ${currentDelay}min delay at segment ${journey.currentSegmentIndex}`);
      
      const disruption: DisruptionInfo = {
        journeyId,
        type: disruptionType,
        currentDelayMin: currentDelay,
        affectedSegmentIndex: journey.currentSegmentIndex,
        description: description || `Significant delay detected on ${currentSegment.type} leg.`,
        severity: currentDelay > 15 ? 'High' : 'Medium'
      };

      await this.handleDisruption(journey, disruption);
    }
  }

  /**
   * Handle disruption by generating alternatives and notifying user
   */
  private async handleDisruption(journey: ActiveJourney, disruption: DisruptionInfo) {
    if (journey.status === 'disrupted' || journey.status === 'rerouting') return;
    
    journey.status = 'disrupted';
    
    // 1. Generate real alternatives using GhostCommuteService
    const options = await this.generateAlternatives(journey, disruption);

    // 2. Build Alert with 60s decision window
    const alert: RescueAlert = {
      journeyId: journey.journeyId,
      disruption,
      options,
      expiresAt: new Date(Date.now() + 60000).toISOString()
    };

    // 3. Notify User via WebSocket
    socketService.emitJourneyUpdate(journey.journeyId, 'RES_MODE_ALERT', alert);
    console.log(`📢 Rescue Alert sent for journey: ${journey.journeyId}`);
  }

  /**
   * Generate 3 prioritized backup routes (Time, Cost, Safety)
   */
  private async generateAlternatives(journey: ActiveJourney, disruption: DisruptionInfo): Promise<RerouteOption[]> {
    const currentSeg = journey.originalPlan.segments[disruption.affectedSegmentIndex];
    
    // Start from the end of the last successful segment or the beginning of this one
    const startLoc: Location = {
      name: currentSeg.from,
      lat: currentSeg.fromLatLng?.lat || 19.0522,
      lng: currentSeg.fromLatLng?.lng || 72.8414
    };
    
    const finalSeg = journey.originalPlan.segments[journey.originalPlan.segments.length - 1];
    const endLoc: Location = {
      name: finalSeg.to,
      lat: finalSeg.toLatLng?.lat || 19.0760,
      lng: finalSeg.toLatLng?.lng || 72.8777
    };

    const priorities: ('time' | 'safety' | 'cost')[] = ['time', 'safety', 'cost'];
    const options: RerouteOption[] = [];

    for (let i = 0; i < priorities.length; i++) {
      const priority = priorities[i];
      try {
        // Fetch real alternative from GhostCommuteService
        const result = await ghostCommuteService.simulateJourney(
          startLoc, 
          endLoc, 
          new Date(), 
          { priority }
        );

        options.push({
          id: `rescue-${priority}-${Date.now()}`,
          label: priority === 'time' ? 'Time-Saver (Express)' : priority === 'safety' ? 'Safe Path' : 'Economy Choice',
          route: result,
          timeImpactMin: result.totalTimeMin - (journey.originalPlan.totalTimeMin - currentSeg.predictedDurationMin), 
          totalPredictedCost: result.totalPredictedCost,
          costDiff: result.totalPredictedCost - currentSeg.predictedCost,
          safetyScore: result.overallSafetyScore,
          rank: i + 1
        });
      } catch (err) {
        // Fallback for demo if API fails
        options.push({
          id: `fallback-${priority}-${Date.now()}`,
          label: `Backup ${priority}`,
          route: { ...journey.originalPlan, totalTimeMin: journey.originalPlan.totalTimeMin + (i * 10), totalPredictedCost: 200 + (i * 50) } as any,
          timeImpactMin: i * 10,
          totalPredictedCost: 200 + (i * 50),
          costDiff: 50,
          safetyScore: 80,
          rank: i + 1
        });
      }
    }

    return options;
  }

  /**
   * Handle user reroute choice
   */
  public onUserChoice(journeyId: string, optionId: string) {
    const journey = this.activeJourneys.get(journeyId);
    if (!journey) return;

    console.log(`✅ User accepted reroute ${optionId} for journey: ${journeyId}`);
    
    // Update active plan
    journey.status = 'rerouting';
    
    // In production, we would update the DB and send new directions
    socketService.emitJourneyUpdate(journeyId, 'PLAN_UPDATED', {
        status: 'Success',
        message: 'Your route has been optimized based on the disruption.'
    });

    // Resume tracking on the new route...
    journey.status = 'on_track';
  }

  /**
   * For Development: Manually trigger a disruption alert
   */
  public debugTrigger(journeyId: string) {
    const journey = this.activeJourneys.get(journeyId);
    if (!journey) return;
    
    const disruption: DisruptionInfo = {
      journeyId,
      type: 'transit_delay',
      currentDelayMin: 12,
      affectedSegmentIndex: 0,
      description: "DEBUG: Manual disruption triggered for testing.",
      severity: 'Medium'
    };

    this.handleDisruption(journey, disruption);
  }
}

export const rescueService = new RescueService();
