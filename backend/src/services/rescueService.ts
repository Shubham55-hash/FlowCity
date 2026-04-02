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

    // 1. Fetch real-time delay (Simulated here, in production calls IRCTC/MMRDA)
    const currentSegment = journey.originalPlan.segments[journey.currentSegmentIndex];
    if (!currentSegment) return;

    // Simulate a disruption for demonstration if "simulateDelay" is enabled in env
    const isMockDisruption = process.env.NODE_ENV === 'development' && Math.random() > 0.85;
    
    let currentDelay = 0;
    let type: DisruptionType = 'transit_delay';

    if (isMockDisruption) {
      currentDelay = Math.ceil(currentSegment.predictedDurationMin * 0.25); // 25% delay
    }

    // 2. Threshold Check (>15% of predicted)
    if (currentDelay > currentSegment.predictedDurationMin * 0.15) {
      console.warn(`⚠️ Disruption detected on ${journeyId}: ${currentDelay}min delay!`);
      
      const disruption: DisruptionInfo = {
        journeyId,
        type: 'transit_delay',
        currentDelayMin: currentDelay,
        affectedSegmentIndex: journey.currentSegmentIndex,
        description: `Delay spike of ${currentDelay}m detected on ${currentSegment.type} leg.`,
        severity: currentDelay > 15 ? 'High' : 'Medium'
      };

      await this.handleDisruption(journey, disruption);
    }
  }

  /**
   * Handle disruption by generating alternatives and notifying user
   */
  private async handleDisruption(journey: ActiveJourney, disruption: DisruptionInfo) {
    journey.status = 'disrupted';
    
    // 1. Generate Alternatives
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
   * Generate 2-3 backup routes based on current position
   */
  private async generateAlternatives(journey: ActiveJourney, disruption: DisruptionInfo): Promise<RerouteOption[]> {
    const currentLoc = journey.originalPlan.segments[disruption.affectedSegmentIndex].from;
    const destination = journey.originalPlan.segments[journey.originalPlan.segments.length - 1].to;

    // In a real scenario, we would use geocoder to get coords for currentLoc
    // For now, we simulate alternatives using different priority settings
    
    const priorities: ('time' | 'safety' | 'cost')[] = ['time', 'safety', 'cost'];
    const options: RerouteOption[] = [];

    for (let i = 0; i < priorities.length; i++) {
        options.push({
            id: `alt-${priorities[i]}-${Date.now()}`,
            label: priorities[i] === 'time' ? 'Time-Saver (Express)' : priorities[i] === 'safety' ? 'Safe Path (Low Crowd)' : 'Budget Route (Bus/Auto)',
            route: { ...journey.originalPlan, totalTimeMin: journey.originalPlan.totalTimeMin + (i * 5 - 5) }, // Mocked for speed
            timeImpactMin: i * 5 - 5,
            costDiff: priorities[i] === 'cost' ? -15 : 40,
            safetyScore: priorities[i] === 'safety' ? 95 : 75,
            rank: i + 1
        });
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
