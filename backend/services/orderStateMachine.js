/**
 * Centralized Order & Payment State Machine
 * Strictly enforces valid state transitions and rejects illegal status hops.
 */

const ORDER_TRANSITIONS = {
  PENDING_PAYMENT: ['CONFIRMED', 'CANCELLED', 'PAID'],
  PAID: ['CONFIRMED', 'PROCESSING', 'CANCELLED'],
  CONFIRMED: ['PROCESSING', 'CANCELLED'],
  PROCESSING: ['SHIPPED', 'CANCELLED'],
  SHIPPED: ['OUT_FOR_DELIVERY'],
  OUT_FOR_DELIVERY: ['DELIVERED'],
  DELIVERED: ['COMPLETED', 'RETURN_REQUESTED'],
  RETURN_REQUESTED: ['RETURN_APPROVED', 'RETURN_REJECTED', 'DELIVERED'],
  RETURN_APPROVED: ['RETURNED'],
  RETURNED: ['REFUNDED', 'COMPLETED'],
  CANCELLED: [],
  COMPLETED: [],
  REFUNDED: []
};

const PAYMENT_TRANSITIONS = {
  PENDING: ['PAID', 'FAILED', 'AUTHORIZED', 'PENDING_SELLER_CONFIRMATION'],
  AUTHORIZED: ['PAID', 'FAILED'],
  PENDING_SELLER_CONFIRMATION: ['PAID', 'FAILED', 'PENDING'],
  PAID: ['REFUND_PENDING', 'PARTIALLY_REFUNDED', 'REFUNDED'],
  FAILED: ['PENDING', 'PAID', 'PENDING_SELLER_CONFIRMATION'], // Retrying or webhook confirmation
  REFUND_PENDING: ['REFUNDED', 'REFUND_FAILED', 'PARTIALLY_REFUNDED'],
  REFUND_FAILED: ['REFUND_PENDING', 'REFUNDED'], // Manual admin retry
  PARTIALLY_REFUNDED: ['REFUNDED'],
  REFUNDED: []
};

function canTransitionOrder(currentStatus, newStatus) {
  if (currentStatus === newStatus) return true;
  const allowed = ORDER_TRANSITIONS[currentStatus];
  if (!allowed) return false;
  return allowed.includes(newStatus);
}

function canTransitionPayment(currentStatus, newStatus) {
  if (currentStatus === newStatus) return true;
  const allowed = PAYMENT_TRANSITIONS[currentStatus];
  if (!allowed) return false;
  return allowed.includes(newStatus);
}

function assertValidOrderTransition(currentStatus, newStatus) {
  if (!canTransitionOrder(currentStatus, newStatus)) {
    throw new Error(`Invalid order state transition: Cannot change from "${currentStatus}" to "${newStatus}"`);
  }
}

function assertValidPaymentTransition(currentStatus, newStatus) {
  if (!canTransitionPayment(currentStatus, newStatus)) {
    throw new Error(`Invalid payment state transition: Cannot change from "${currentStatus}" to "${newStatus}"`);
  }
}

module.exports = {
  ORDER_TRANSITIONS,
  PAYMENT_TRANSITIONS,
  canTransitionOrder,
  canTransitionPayment,
  assertValidOrderTransition,
  assertValidPaymentTransition
};
