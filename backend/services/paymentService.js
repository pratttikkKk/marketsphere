const crypto = require('crypto');
const axios = require('axios');

class PaymentService {
  constructor() {
    this.keyId = process.env.RAZORPAY_KEY_ID;
    this.keySecret = process.env.RAZORPAY_KEY_SECRET;
    this.webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;

    // Fail-safe provider determination
    this.isRealProvider = Boolean(this.keyId && this.keySecret && !this.keyId.includes('sandbox'));
    
    // In development/test only, allow fallback test secrets if none provided
    if (!this.keyId && process.env.NODE_ENV !== 'production') {
      this.keyId = 'rzp_test_dev_marketsphere';
      this.keySecret = 'marketsphere_dev_secret_2026';
      this.webhookSecret = 'marketsphere_webhook_dev_2026';
    }
  }

  getProviderName() {
    return this.isRealProvider ? 'RAZORPAY' : 'SANDBOX';
  }

  getPublicKey() {
    return this.keyId;
  }

  /**
   * Creates an order with Razorpay (or sandbox in test mode)
   * Amount in INR minor units (paise)
   */
  async createPaymentOrder({ orderId, amountInRupees, currency = 'INR', receipt }) {
    const amountInPaise = Math.round(amountInRupees * 100);

    if (process.env.NODE_ENV === 'production' && !this.isRealProvider) {
      throw new Error('Production payment failure: RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET must be configured.');
    }

    if (this.isRealProvider) {
      try {
        const auth = Buffer.from(`${this.keyId}:${this.keySecret}`).toString('base64');
        const response = await axios.post(
          'https://api.razorpay.com/v1/orders',
          {
            amount: amountInPaise,
            currency,
            receipt: receipt || `rcpt_${orderId.toString().slice(-14)}`,
            payment_capture: 1
          },
          {
            headers: {
              Authorization: `Basic ${auth}`,
              'Content-Type': 'application/json'
            },
            timeout: 10000
          }
        );
        return {
          provider: 'RAZORPAY',
          providerOrderId: response.data.id,
          amount: amountInRupees,
          amountInPaise: response.data.amount,
          currency: response.data.currency,
          keyId: this.keyId
        };
      } catch (err) {
        console.error('[PAYMENT] Error creating Razorpay order:', err.response?.data || err.message);
        throw new Error(`Payment gateway order creation failed: ${err.response?.data?.error?.description || err.message}`);
      }
    }

    // SANDBOX MODE (For test suite and local dev execution)
    const sandboxOrderId = `order_sbx_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    return {
      provider: 'SANDBOX',
      providerOrderId: sandboxOrderId,
      amount: amountInRupees,
      amountInPaise,
      currency,
      keyId: this.keyId || 'rzp_test_dev_marketsphere'
    };
  }

  /**
   * Cryptographically verifies the payment signature using HMAC SHA-256
   */
  verifyPaymentSignature({ providerOrderId, providerPaymentId, providerSignature }) {
    if (!providerOrderId || !providerPaymentId || !providerSignature) {
      return false;
    }

    const payload = `${providerOrderId}|${providerPaymentId}`;
    const secret = this.keySecret || 'marketsphere_dev_secret_2026';
    const expectedSignature = crypto
      .createHmac('sha256', secret)
      .update(payload)
      .digest('hex');

    try {
      const expectedBuffer = Buffer.from(expectedSignature, 'utf8');
      const providedBuffer = Buffer.from(providerSignature, 'utf8');

      if (expectedBuffer.length !== providedBuffer.length) {
        return false;
      }

      return crypto.timingSafeEqual(expectedBuffer, providedBuffer);
    } catch (e) {
      return false;
    }
  }

  /**
   * Fetches payment details directly from Razorpay provider API
   */
  async fetchPaymentDetails(paymentId) {
    if (!this.isRealProvider) {
      return {
        id: paymentId,
        status: 'captured',
        amount: 1000,
        currency: 'INR'
      };
    }

    try {
      const auth = Buffer.from(`${this.keyId}:${this.keySecret}`).toString('base64');
      const response = await axios.get(`https://api.razorpay.com/v1/payments/${paymentId}`, {
        headers: {
          Authorization: `Basic ${auth}`
        },
        timeout: 10000
      });
      return response.data;
    } catch (err) {
      console.error('[PAYMENT] Error fetching payment from Razorpay:', err.response?.data || err.message);
      throw new Error(`Unable to fetch payment details from provider: ${err.response?.data?.error?.description || err.message}`);
    }
  }

  /**
   * Validates provider payment integrity (order ID, amount, currency, status)
   */
  async verifyProviderPaymentState({ paymentId, providerOrderId, expectedAmountInRupees, expectedCurrency = 'INR' }) {
    if (this.isRealProvider) {
      const payment = await this.fetchPaymentDetails(paymentId);
      if (!payment) {
        throw new Error('Payment record not found on payment gateway');
      }

      if (payment.order_id && payment.order_id !== providerOrderId) {
        throw new Error(`Payment order mismatch: payment belongs to ${payment.order_id}, expected ${providerOrderId}`);
      }

      const expectedPaise = Math.round(expectedAmountInRupees * 100);
      if (payment.amount !== expectedPaise) {
        throw new Error(`Payment amount mismatch: gateway received ${payment.amount} paise, order requires ${expectedPaise} paise`);
      }

      if (payment.currency !== expectedCurrency) {
        throw new Error(`Payment currency mismatch: gateway processed ${payment.currency}, expected ${expectedCurrency}`);
      }

      if (!['captured', 'authorized'].includes(payment.status)) {
        throw new Error(`Payment is not in a valid state on gateway. Current status: ${payment.status}`);
      }
    }
    return true;
  }

  /**
   * Generates sandbox signature for automated tests.
   * Strictly forbidden in production.
   */
  generateSandboxSignature(providerOrderId, providerPaymentId) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('Sandbox signature generator is strictly disabled in production');
    }
    const payload = `${providerOrderId}|${providerPaymentId}`;
    const secret = this.keySecret || 'marketsphere_dev_secret_2026';
    return crypto
      .createHmac('sha256', secret)
      .update(payload)
      .digest('hex');
  }

  /**
   * Verifies incoming webhook signature against raw byte payload
   */
  verifyWebhookSignature(rawBody, receivedSignature) {
    if (!rawBody || !receivedSignature) return false;

    const secret = this.webhookSecret || 'marketsphere_webhook_dev_2026';
    const expectedSignature = crypto
      .createHmac('sha256', secret)
      .update(rawBody)
      .digest('hex');

    try {
      const expectedBuffer = Buffer.from(expectedSignature, 'utf8');
      const receivedBuffer = Buffer.from(receivedSignature, 'utf8');

      if (expectedBuffer.length !== receivedBuffer.length) {
        return false;
      }

      return crypto.timingSafeEqual(expectedBuffer, receivedBuffer);
    } catch (e) {
      return false;
    }
  }

  /**
   * Executes a refund with the provider
   */
  async processRefund({ paymentId, amountInRupees, notes = '' }) {
    const amountInPaise = amountInRupees ? Math.round(amountInRupees * 100) : undefined;

    if (this.isRealProvider) {
      try {
        const auth = Buffer.from(`${this.keyId}:${this.keySecret}`).toString('base64');
        const payload = notes ? { notes: { reason: notes } } : {};
        if (amountInPaise) payload.amount = amountInPaise;

        const response = await axios.post(
          `https://api.razorpay.com/v1/payments/${paymentId}/refund`,
          payload,
          {
            headers: {
              Authorization: `Basic ${auth}`,
              'Content-Type': 'application/json'
            },
            timeout: 10000
          }
        );
        return {
          status: 'REFUNDED',
          refundId: response.data.id,
          amount: (response.data.amount / 100),
          provider: 'RAZORPAY'
        };
      } catch (err) {
        console.error('[PAYMENT] Error executing Razorpay refund:', err.response?.data || err.message);
        throw new Error(`Razorpay refund failed: ${err.response?.data?.error?.description || err.message}`);
      }
    }

    // Sandbox Refund Simulation for tests
    const refundId = `rfnd_sbx_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    return {
      status: 'REFUNDED',
      refundId,
      amount: amountInRupees,
      provider: 'SANDBOX'
    };
  }
}

module.exports = new PaymentService();