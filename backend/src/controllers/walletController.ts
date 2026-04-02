
import { Request, Response } from 'express';
import paymentService from '../services/paymentService';
import pool from '../db/index';
import { AuthRequest } from '../types';

export class WalletController {
  /**
   * Retrieves the current balance and loyalty point status for the user.
   */
  public static async getBalance(req: AuthRequest, res: Response) {
    const userId = req.user?.id || 'demo-user';
    const result = await pool.query('SELECT balance, loyalty_points FROM users WHERE id = $1', [userId]);
    const user = result.rows[0] || { balance: 0, loyalty_points: 0 };

    res.json({
      status: 'success',
      data: {
        balance: Number(user.balance),
        loyaltyPoints: user.loyalty_points,
        currency: 'INR'
      }
    });
  }

  /**
   * Generates a new top-up order via the payment gateway wrapper.
   */
  public static async topup(req: AuthRequest, res: Response) {
    const { amount } = req.body;
    const userId = req.user?.id || 'demo-user';
    const order = await paymentService.createTopupOrder(userId, amount);
    res.json({ status: 'success', data: { order } });
  }

  /**
   * Toggles the auto-recharge settings for the user.
   */
  public static async toggleAutoRecharge(req: AuthRequest, res: Response) {
    const { enabled, amount, threshold } = req.body;
    const userId = req.user?.id || 'demo-user';
    await pool.query('UPDATE users SET preferences = preferences || $1 WHERE id = $2', 
      [JSON.stringify({ autoRecharge: enabled, rechargeAmount: amount, threshold }), userId]);
    res.json({ status: 'success', message: 'Auto-recharge settings updated.' });
  }

  /**
   * Retrieves the live transaction ledger from the database.
   */
  public static async getTransactions(req: AuthRequest, res: Response) {
    const userId = req.user?.id || 'demo-user';
    const result = await pool.query(`
      SELECT * FROM transaction_log 
      WHERE user_id = $1 
      ORDER BY timestamp DESC LIMIT 20
    `, [userId]);
    res.json({ status: 'success', data: { transactions: result.rows } });
  }
}
