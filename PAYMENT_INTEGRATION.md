# MarketSphere: Production Payment Integration Architecture (Razorpay)

## 1. Overview & Architectural Principles
MarketSphere implements an authoritative, server-driven **Razorpay payment integration** that guarantees complete financial integrity, non-repudiation, and transactional consistency.

### Core Security Tenets
1. **Zero Client Authority:** The browser client is never trusted for product prices, order subtotals, tax rates, coupon discounts, or payment completion statuses.
2. **Deterministic Amount Mapping:** The provider order amount created on Razorpay is calculated strictly on the backend and equals the internal order total in minor units (paise: ₹1 = 100 paise).
3. **Dual Verification Pipeline:**
   - **Frontend Synchronous Callback:** Verified via cryptographic HMAC-SHA256 signature and live provider API check.
   - **Asynchronous Webhook Reconciliation:** Verified via raw-request HMAC-SHA256 signature against `RAZORPAY_WEBHOOK_SECRET` and persisted in `PaymentWebhookEvent`.
4. **No Simulated Production Behavior:** The sandbox signature generator route (`/orders/simulate-sandbox-signature`) is completely disabled in `NODE_ENV=production` (`403 Forbidden`).

---

## 2. End-to-End Payment Workflow

```
Customer                    Frontend (React)              Backend API (Node.js)             Razorpay Gateway
   │                              │                               │                              │
   │── Click Place Order ────────>│                               │                              │
   │                              │── POST /orders/checkout ─────>│                              │
   │                              │   (Idempotency-Key)           │── Calculate authoritative    │
   │                              │                               │   amounts & reserve stock    │
   │                              │                               │── POST /v1/orders ──────────>│
   │                              │                               │   (amount in paise)          │
   │                              │                               │<─ Return providerOrderId ────│
   │                              │<─ Return order & keyId ───────│                              │
   │                              │                                                              │
   │<─ Open Razorpay Checkout ────│                                                              │
   │   Modal (UPI/Card/NetBank)   │                                                              │
   │                              │                                                              │
   │── Complete Payment ─────────>│                                                              │
   │                              │── Modal Callback ────────────>│                              │
   │                              │   (payment_id, signature)     │                              │
   │                              │                               │                              │
   │                              │── POST /confirm-payment ─────>│                              │
   │                              │                               │── HMAC-SHA256 Verification   │
   │                              │                               │── GET /v1/payments/:id ─────>│
   │                              │                               │   (Validate amount, state)   │
   │                              │                               │<─ Verified Captured ─────────│
   │                              │                               │── Mark PAID & CONFIRMED      │
   │                              │<─ Return Confirmed Order ─────│                              │
   │<─ Show Verified Invoice ─────│                                                              │
   │                              │                                                              │
   │                              │                               │<─ Webhook: payment.captured ─│
   │                              │                               │   (Raw HMAC check + dedup)   │
   │                              │                               │── Idempotent Acknowledge ────│
```

---

## 3. Configuration & Environment Variables

### Backend Configuration (`backend/.env`)
```ini
NODE_ENV=production
PORT=5002

# Payment Provider Configuration
PAYMENT_PROVIDER=RAZORPAY
RAZORPAY_KEY_ID=rzp_live_xxxxxxxxxxxxxxxxxxxx
RAZORPAY_KEY_SECRET=yyyyyyyyyyyyyyyyyyyyyyyy
RAZORPAY_WEBHOOK_SECRET=zzzzzzzzzzzzzzzzzzzzzzzz

# Frontend Origin for CORS
CLIENT_URL=https://marketsphere.example.com
```

> [!IMPORTANT]
> - For local testing or staging, configure Razorpay Test Credentials (`rzp_test_...`).
> - The backend never exposes `RAZORPAY_KEY_SECRET` or `RAZORPAY_WEBHOOK_SECRET` to the client.
> - Only the public `RAZORPAY_KEY_ID` is provided to the client for rendering the checkout modal.

---

## 4. Cryptographic Verification Details

### 4.1 Payment Signature Verification
The official Razorpay signature specification dictates:
$$\text{Signature} = \text{HMAC-SHA256}(\text{providerOrderId} + "|" + \text{providerPaymentId}, \text{RAZORPAY\_KEY\_SECRET})$$

Implemented in [`backend/services/paymentService.js`](file:///e:/E%20Commerce/backend/services/paymentService.js):
```javascript
const payload = `${providerOrderId}|${providerPaymentId}`;
const expectedSignature = crypto
  .createHmac('sha256', this.keySecret)
  .update(payload)
  .digest('hex');

const expectedBuffer = Buffer.from(expectedSignature, 'utf8');
const providedBuffer = Buffer.from(providerSignature, 'utf8');

return crypto.timingSafeEqual(expectedBuffer, providedBuffer);
```

### 4.2 Webhook Signature & Raw Body Integrity
Razorpay signs the **verbatim byte stream** of the webhook payload. Parsing JSON and re-serializing via `JSON.stringify` breaks signature verification if whitespace or key orders differ.

In [`backend/app.js`](file:///e:/E%20Commerce/backend/app.js), raw request bytes are captured during stream intake:
```javascript
app.use(express.json({ 
  limit: '10mb',
  verify: (req, res, buf) => {
    req.rawBody = buf;
  }
}));
```

Webhook signature verification computes:
```javascript
crypto
  .createHmac('sha256', this.webhookSecret)
  .update(req.rawBody)
  .digest('hex');
```

---

## 5. Persistent Webhook Deduplication
In-memory deduplication (`new Set()`) is insufficient for production. MarketSphere persists webhook events in MongoDB using [`PaymentWebhookEvent`](file:///e:/E%20Commerce/backend/models/PaymentWebhookEvent.js):

- **Unique Compound Index:** `{ provider: 1, eventId: 1 }`
- **Supported Events:**
  - `payment.captured`: Confirms order payment and sets status to `PAID` / `CONFIRMED`.
  - `payment.failed`: Records failure in order timeline and marks `PAYMENT_FAILED`.
  - `refund.processed`: Marks order as `REFUNDED` and saves `refundId`.
  - `refund.failed`: Marks order as `REFUND_FAILED` for administrative review.

---

## 6. Real Refund Flow
When an administrator approves a return or cancellation for an order paid via Razorpay:
1. `paymentService.processRefund({ paymentId, amountInRupees })` calls `POST https://api.razorpay.com/v1/payments/:id/refund`.
2. If the provider approves the refund, `order.paymentStatus` is updated to `REFUNDED` and the refund ID is stored.
3. If the gateway rejects or times out:
   - `order.paymentStatus` is updated to `REFUND_FAILED` (or `REFUND_PENDING`).
   - The error is recorded in the order timeline.
   - **Under no circumstances is a failed refund marked as REFUNDED.**
