
import { Request, Response } from 'express';
import { safetyService } from '../services/safetyService';

export class SafetyController {
  public static async getHeatmap(req: Request, res: Response) {
    const lat = parseFloat(req.query.lat as string) || 19.0760;
    const lng = parseFloat(req.query.lng as string) || 72.8777;
    const radius = parseFloat(req.query.radius as string) || 5;
    const heatmap = await safetyService.generateHeatmap({ lat, lng }, radius);
    res.json(heatmap);
  }

  public static async evaluatePath(req: Request, res: Response) {
    const path = req.body.path || [];
    const evaluation = await safetyService.evaluatePathSafety(path);
    res.json({ status: 'success', data: evaluation });
  }

  public static async reportIncident(req: Request, res: Response) {
    safetyService.addReport(req.body);
    res.status(201).json({ status: 'success', message: 'Safety incident reported.' });
  }
}

export class AlertController {
  public static async getActive(req: Request, res: Response) {
    const alerts = [
      { id: 'A1', type: 'Delay', message: 'Heavy rain causing 15 min delay on Central Line.', severity: 'medium' },
      { id: 'A2', type: 'Safety', message: 'High crowd density at Dadar Platform 1.', severity: 'high' }
    ];
    res.json({ status: 'success', data: { alerts } });
  }

  public static async dismiss(req: Request, res: Response) {
    res.json({ status: 'success', message: `Alert ${req.params.id} dismissed.` });
  }
}
