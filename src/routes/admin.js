import { Router } from 'express';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { adminLoadShopBalance } from '../services/wallet.js';

const router = Router();

// Protect all admin routes: must be authenticated and have role 'admin'
router.use(requireAuth);
router.use(requireRole('admin'));

/**
 * POST /api/admin/shops/:merchantId/load
 * Load money into a merchant's shop balance
 */
router.post('/shops/:merchantId/load', async (req, res) => {
  try {
    const { merchantId } = req.params;
    const { amountDinars, description, _testFailureAfterBalanceUpdate } = req.body || {};

    const result = await adminLoadShopBalance({
      merchantId,
      amountDinars,
      description,
      _testFailureAfterBalanceUpdate:
        process.env.NODE_ENV !== 'production' ? Boolean(_testFailureAfterBalanceUpdate) : false,
    });

    return res.status(200).json(result);
  } catch (error) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({ error: error.message });
    }
    console.error('Error loading shop balance:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
