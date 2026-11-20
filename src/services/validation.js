/**
 * Shared financial input validation helpers.
 * Currency inputs are whole Algerian Dinars (DZD) converted to integer centimes (`dinars * 100`).
 */

export const MAX_SAFE_DINARS = Math.floor(Number.MAX_SAFE_INTEGER / 100); // 90071992547409

function createValidationError(message, statusCode = 400) {
  const err = new Error(message);
  err.statusCode = statusCode;
  return err;
}

/**
 * Extract raw dinar amount input from explicit params or request body payload.
 */
export function extractRawAmountInput({
  amountDinars,
  amount,
  body,
  allowAmountFallback = true,
} = {}) {
  const payload = body || {};

  const hasAmountDinars =
    amountDinars !== undefined ||
    (Object.prototype.hasOwnProperty.call(payload, 'amountDinars') &&
      payload.amountDinars !== undefined);

  const hasAmount =
    allowAmountFallback &&
    (amount !== undefined ||
      (Object.prototype.hasOwnProperty.call(payload, 'amount') &&
        payload.amount !== undefined));

  if (!hasAmountDinars && !hasAmount) {
    return { hasValue: false, rawAmount: undefined };
  }

  const rawAmount = hasAmountDinars
    ? amountDinars !== undefined
      ? amountDinars
      : payload.amountDinars
    : amount !== undefined
      ? amount
      : payload.amount;

  return { hasValue: true, rawAmount };
}

/**
 * Validate a whole-dinar monetary amount as a positive integer safe for `dinars * 100` centimes math.
 */
export function parseWholeDinars(
  rawValue,
  {
    fieldLabel = 'amountDinars',
    requiredMessage = `${fieldLabel} must be a positive integer`,
    positiveIntegerMessage = `${fieldLabel} must be a positive integer`,
    overflowMessage = `${fieldLabel} exceeds maximum allowed value`,
    hasValue = rawValue !== undefined,
  } = {}
) {
  if (!hasValue) {
    throw createValidationError(requiredMessage, 400);
  }

  if (
    typeof rawValue !== 'number' ||
    !Number.isFinite(rawValue) ||
    !Number.isInteger(rawValue) ||
    rawValue <= 0
  ) {
    throw createValidationError(positiveIntegerMessage, 400);
  }

  if (rawValue > MAX_SAFE_DINARS) {
    throw createValidationError(overflowMessage, 400);
  }

  return rawValue;
}
