import { Router } from 'express';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { getCustomerBalance, getCustomerTransactions } from '../services/wallet.js';

const router = Router();

// Protect all customer routes: must be authenticated and have role 'customer'
router.use(requireAuth);
router.use(requireRole('customer'));

/**
 * GET /api/customer/balance
 * Returns { balanceDinars, balanceCentimes }
 */
router.get('/balance', async (req, res) => {
  try {
    const balance = await getCustomerBalance(req.user.id);
    return res.status(200).json(balance);
  } catch (error) {
    console.error('Error fetching customer balance:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/customer/transactions
 * Returns array of transactions for the customer
 */
router.get('/transactions', async (req, res) => {
  try {
    const transactionsList = await getCustomerTransactions(req.user.id);
    return res.status(200).json(transactionsList);
  } catch (error) {
    console.error('Error fetching customer transactions:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
