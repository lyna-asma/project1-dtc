import { Router } from 'express';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { merchantTopUp } from '../services/wallet.js';
import { createPaymentRequest } from '../services/payment.js';

const router = Router();

// Protect all merchant routes: must be authenticated and have role 'merchant'
router.use(requireAuth);
router.use(requireRole('merchant'));

/**
 * POST /api/merchant/payment-requests
 * Generate a single-use payment code
 */
router.post('/payment-requests', async (req, res) => {
  try {
    const result = await createPaymentRequest({
      merchantId: req.user.id,
      body: req.body,
    });

    return res.status(201).json(result);
  } catch (error) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({ error: error.message });
    }
    console.error('Error generating payment request:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/merchant/top-up
 * Top up a customer's wallet from merchant shop balance
 */
router.post('/top-up', async (req, res) => {
  try {
    const { _testFailureAfterBalanceUpdate, ...body } = req.body || {};

    const result = await merchantTopUp({
      merchantUserId: req.user.id,
      body,
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
    console.error('Error during merchant top-up:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
