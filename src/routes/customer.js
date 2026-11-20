import { Router } from 'express';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { getCustomerBalance, getCustomerTransactions } from '../services/wallet.js';
import { inspectPaymentRequest, confirmPaymentRequest } from '../services/payment.js';

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

/**
 * GET /api/customer/payment-requests/:code
 * Inspect a payment request
 */
router.get('/payment-requests/:code', async (req, res) => {
  try {
    const { code } = req.params;
    const result = await inspectPaymentRequest(code);
    return res.status(200).json(result);
  } catch (error) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({ error: error.message });
    }
    console.error('Error inspecting payment request:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/customer/payment-requests/:code/confirm
 * Confirm a payment request using customer password
 */
router.post('/payment-requests/:code/confirm', async (req, res) => {
  try {
    const { code } = req.params;
    const { password, _testFailureAfterBalanceUpdate } = req.body || {};
    const idempotencyKey =
      (typeof req.headers['idempotency-key'] === 'string' && req.headers['idempotency-key'].trim() !== ''
        ? req.headers['idempotency-key']
        : null) ??
      (typeof req.headers['x-idempotency-key'] === 'string' && req.headers['x-idempotency-key'].trim() !== ''
        ? req.headers['x-idempotency-key']
        : null) ??
      req.body?.idempotencyKey ??
      req.body?.requestId ??
      null;

    const result = await confirmPaymentRequest({
      code,
      customerUserId: req.user.id,
      password,
      idempotencyKey,
      endpoint: 'POST /api/customer/payment-requests/:code/confirm',
      _testFailureAfterBalanceUpdate:
        process.env.NODE_ENV !== 'production'
          ? Boolean(_testFailureAfterBalanceUpdate)
          : false,
    });

    return res.status(200).json(result);
  } catch (error) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({ error: error.message });
    }
    console.error('Error confirming payment request:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
