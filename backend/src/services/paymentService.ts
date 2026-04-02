
import pool from '../db/index';
import crypto from 'crypto';
import { Queue } from 'bull';

const ENCRYPTION_KEY = process.env.PAYMENT_ENCRYPTION_KEY || 'v-8-point-4-commute-flow-city-99'; // 32 chars
const IV_LENGTH = 16;

class PaymentService {
  private rechargeQueue: any;

  constructor() {
    // Initialized in a real app with Redis
    // this.rechargeQueue = new Queue('auto-recharge');
  }

  /**
   * Encrypts sensitive payment data (linked cards/UPI) before storage.
   */
  private encrypt(text: string): string {
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv('aes-256-cbc', Buffer.from(ENCRYPTION_KEY), iv);
    let encrypted = cipher.update(text);
    encrypted = Buffer.concat([encrypted, cipher.final()]);
    return iv.toString('hex') + ':' + encrypted.toString('hex');
  }

  /**
   * Deducts fare from user wallet and records the transaction.
   */
  async processFare(userId: string, amount: number, mode: string) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      
      // 1. Validate Balance
      const userRes = await client.query('SELECT balance FROM users WHERE id = $1 FOR UPDATE', [userId]);
      const balance = Number(userRes.rows[0].balance);
      
      if (balance < amount) {
        throw new Error('Insufficient balance for journey start.');
      }

      // 2. Deduct Fare
      await client.query('UPDATE users SET balance = balance - $1 WHERE id = $2', [amount, userId]);

      // 3. Record Transaction
      const transId = await client.query(`
        INSERT INTO transaction_log (user_id, amount, transport_mode, status, metadata)
        VALUES ($1, $2, $3, $4, $5) RETURNING id
      `, [userId, amount, mode, 'success', JSON.stringify({ timestamp: new Date(), type: 'debit' })]);

      // 4. Award Loyalty Points (5% of fare)
      const points = Math.floor(amount * 0.05);
      if (points > 0) {
        await client.query('UPDATE users SET loyalty_points = loyalty_points + $1 WHERE id = $2', [points, userId]);
      }

      await client.query('COMMIT');

      // 5. Check for Auto-Recharge Threshold (e.g. < ₹100)
      if (balance - amount < 100) {
        this.triggerAutoRecharge(userId);
      }

      return { success: true, transactionId: transId.rows[0].id, pointsAwarded: points };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Triggers the background auto-recharge logic.
   */
  async triggerAutoRecharge(userId: string) {
    const userRes = await pool.query('SELECT linked_methods, preferences FROM users WHERE id = $1', [userId]);
    const { linked_methods, preferences } = userRes.rows[0];

    if (preferences?.autoRecharge && linked_methods.length > 0) {
      console.log(`[AutoRecharge] Queuing top-up for user ${userId}`);
      // In a real app: this.rechargeQueue.add({ userId, amount: preferences.rechargeAmount });
    }
  }

  /**
   * Mock Razorpay integration for wallet top-ups.
   */
  async createTopupOrder(userId: string, amount: number) {
    // MOCK: Integration with Razorpay SDK
    const orderId = `order_${Math.random().toString(36).substring(7)}`;
    
    await pool.query(`
      INSERT INTO transaction_log (user_id, amount, transport_mode, status, metadata)
      VALUES ($1, $2, $3, $4, $5)
    `, [userId, amount, 'wallet', 'pending', JSON.stringify({ orderId, type: 'credit' })]);

    return { orderId, amount, currency: 'INR' };
  }

  /**
   * Handles weekly loyalty reward calculations.
   */
  async processWeeklyRewards() {
    // Logic for identifying 5+ on-time journeys in a week
    console.log('Processing weekly FlowCity reward bonuses...');
  }
}

export default new PaymentService();
