const crypto = require('crypto');
const paymentService = require('../services/paymentService');
const Order = require('../models/Order');
const PaymentWebhookEvent = require('../models/PaymentWebhookEvent');

exports.handleWebhook = async (req, res) => {
  const signature = req.headers['x-razorpay-signature'];
  
  // Use raw bytes captured during request stream intake
  const rawBody = req.rawBody || Buffer.from(JSON.stringify(req.body || {}));

  // Verify HMAC-SHA256 signature
  const isValid = paymentService.verifyWebhookSignature(rawBody, signature);
  if (!isValid) {
    return res.status(400).json({ 
      status: 'error', 
      error: { code: 'INVALID_WEBHOOK_SIGNATURE', message: 'Webhook cryptographic signature verification failed' } 
    });
  }

  const event = req.body;
  if (!event || !event.event) {
    return res.status(400).json({ 
      status: 'error', 
      error: { code: 'MALFORMED_WEBHOOK', message: 'Missing webhook event payload' } 
    });
  }

  const provider = paymentService.getProviderName();
  const eventId = event.id || `${event.event}_${Date.now()}`;
  const payloadHash = crypto.createHash('sha256').update(rawBody).digest('hex');

  // Persistent deduplication across processes and restarts
  let webhookRecord;
  try {
    webhookRecord = await PaymentWebhookEvent.findOne({ provider, eventId });
    if (webhookRecord && webhookRecord.status === 'PROCESSED') {
      return res.status(200).json({ 
        status: 'success', 
        message: 'Webhook event already processed (idempotent acknowledgement)' 
      });
    }

    if (!webhookRecord) {
      webhookRecord = await PaymentWebhookEvent.create({
        provider,
        eventId,
        eventType: event.event,
        status: 'RECEIVED',
        payloadHash
      });
    }
  } catch (err) {
    if (err.code === 11000) {
      return res.status(200).json({ status: 'success', message: 'Webhook event currently in processing' });
    }
    console.error('[WEBHOOK] Deduplication store error:', err.message);
  }

  try {
    if (event.event === 'payment.captured') {
      const paymentEntity = event.payload?.payment?.entity;
      const providerOrderId = paymentEntity?.order_id;
      const internalOrderId = paymentEntity?.notes?.orderId;

      const filter = internalOrderId 
        ? { _id: internalOrderId }
        : { 'paymentDetails.providerOrderId': providerOrderId };

      const order = await Order.findOne(filter);

      if (order && order.paymentStatus !== 'PAID') {
        order.paymentStatus = 'PAID';
        order.orderStatus = 'CONFIRMED';
        order.paymentDetails.providerPaymentId = paymentEntity.id;
        order.paymentDetails.paidAt = new Date();
        order.orderItems.forEach(i => {
          if (i.status === 'PENDING') i.status = 'CONFIRMED';
        });

        order.timeline.push({
          status: 'CONFIRMED',
          timestamp: new Date(),
          note: `Payment captured via Razorpay Webhook (${paymentEntity.id})`
        });

        await order.save();
      }
    } else if (event.event === 'payment.failed') {
      const paymentEntity = event.payload?.payment?.entity;
      const providerOrderId = paymentEntity?.order_id;
      const internalOrderId = paymentEntity?.notes?.orderId;

      const filter = internalOrderId 
        ? { _id: internalOrderId }
        : { 'paymentDetails.providerOrderId': providerOrderId };

      await Order.findOneAndUpdate(filter, {
        paymentStatus: 'FAILED',
        $push: {
          timeline: {
            status: 'PAYMENT_FAILED',
            timestamp: new Date(),
            note: `Payment failed via Webhook: ${paymentEntity?.error_description || 'Gateway failure'}`
          }
        }
      });
    } else if (event.event === 'refund.processed') {
      const refundEntity = event.payload?.refund?.entity;
      const paymentId = refundEntity?.payment_id;

      if (paymentId) {
        await Order.findOneAndUpdate(
          { 'paymentDetails.providerPaymentId': paymentId },
          {
            paymentStatus: 'REFUNDED',
            'paymentDetails.refundId': refundEntity.id,
            'paymentDetails.refundedAt': new Date(),
            $push: {
              timeline: {
                status: 'REFUNDED',
                timestamp: new Date(),
                note: `Refund processed via Webhook (${refundEntity.id})`
              }
            }
          }
        );
      }
    } else if (event.event === 'refund.failed') {
      const refundEntity = event.payload?.refund?.entity;
      const paymentId = refundEntity?.payment_id;

      if (paymentId) {
        await Order.findOneAndUpdate(
          { 'paymentDetails.providerPaymentId': paymentId },
          {
            paymentStatus: 'REFUND_FAILED',
            $push: {
              timeline: {
                status: 'REFUND_FAILED',
                timestamp: new Date(),
                note: `Refund execution failed at gateway for payment ${paymentId}`
              }
            }
          }
        );
      }
    }

    // Mark event as successfully processed
    if (webhookRecord) {
      await PaymentWebhookEvent.updateOne(
        { _id: webhookRecord._id },
        { status: 'PROCESSED', processedAt: new Date() }
      );
    }

    return res.status(200).json({ status: 'success', message: 'Webhook processed successfully' });
  } catch (err) {
    console.error('[WEBHOOK] Error processing webhook event:', err.message);
    if (webhookRecord) {
      await PaymentWebhookEvent.updateOne(
        { _id: webhookRecord._id },
        { status: 'FAILED', processingError: err.message }
      );
    }
    return res.status(500).json({ status: 'error', message: 'Internal error processing webhook' });
  }
};
