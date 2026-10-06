# MarketSphere: Final Security Audit & Verification Report

## 1. Security Architecture & Threat Model Overview
MarketSphere is architected with defense-in-depth principles where the backend API serves as the strict, impenetrable security boundary. All client-supplied metadata (roles, identities, prices, payment states, timestamps) are treated as untrusted and rejected or overwritten by server-authoritative logic.

---

## 2. OWASP Top 10 Evaluation & Verification

### A01: Broken Access Control
- **Public Registration Isolation:** Public registration (`POST /api/v1/auth/register`) strictly forces `role = 'CUSTOMER'`. Any client-supplied `role` is discarded. Public admin creation is physically impossible over HTTP.
- **Admin Bootstrap CLI:** Administrative accounts can only be provisioned via the offline command line tool `npm run bootstrap:admin` ([`backend/create-admin.js`](file:///e:/E%20Commerce/backend/create-admin.js)), which writes directly to MongoDB with bcrypt password hashing.
- **RBAC Enforcement:** [`backend/middlewares/auth.js`](file:///e:/E%20Commerce/backend/middlewares/auth.js) provides `requireAuth`, `requireRole('ADMIN')`, `requireApprovedSeller`, and `requireActiveAccount`.
- **Cross-Tenant Isolation:**
  - Customers cannot access another customer's orders or cart (queried exclusively by `req.user._id`).
  - Sellers cannot access or modify another seller's products or order line items (`product.sellerId.toString() === seller._id.toString()`).
  - Unapproved or suspended sellers cannot publish products or fulfill orders.

### A02: Cryptographic Failures & Session Security
- **No Fallback Secrets in Production:** [`backend/server.js`](file:///e:/E%20Commerce/backend/server.js) halts startup immediately if `JWT_SECRET` is missing, default, or insecure when `NODE_ENV === 'production'`.
- **Bcrypt Password Security:** Passwords hashed with salt factor 10. `passwordHash` is never returned in API responses.
- **HMAC-SHA256 Payment Verification:** Razorpay order payment confirmation mandates genuine HMAC-SHA256 signatures verified with constant-time buffer comparison (`crypto.timingSafeEqual`) to prevent timing attacks.
- **Raw-Byte Webhook Verification:** Webhook signatures are verified directly against raw HTTP request bytes (`req.rawBody`), defeating payload tampering.

### A03: Injection & NoSQL Security
- **Mongoose Typed Schemas:** All models define strict types, enums, and required fields.
- **Safe ObjectId Casting:** Endpoints validate Mongoose ObjectIds, preventing BSON injection attacks.
- **Whitelisted Database Queries:** Product search and catalog exploration validate and sanitize regex parameters.

### A04: Insecure Design & Business Logic Vulnerabilities
- **Server-Authoritative Pricing & Cart Totals:** Client-supplied prices, subtotals, taxes, shipping fees, and discounts are 100% ignored. The server queries product prices directly from MongoDB.
- **Atomic Stock Reservation:** Concurrency race conditions (e.g., overselling) are prevented using atomic queries:
  ```javascript
  await Product.findOneAndUpdate(
    { _id: item.product, stock: { $gte: item.quantity } },
    { $inc: { stock: -item.quantity } },
    { new: true }
  );
  ```
- **Atomic Coupon Usage:** Coupon limits cannot be bypassed concurrently due to atomic condition checks (`$expr: { $lt: ['$usedCount', '$usageLimit'] }`).
- **Strict Order & Payment State Machine:** Illegal state hops (`PENDING_PAYMENT` -> `DELIVERED`, `CANCELLED` -> `CONFIRMED`, `REFUNDED` -> `PAID`) are rejected by [`orderStateMachine.js`](file:///e:/E%20Commerce/backend/services/orderStateMachine.js).
- **Persistent Webhook Deduplication:** In-memory Sets are replaced with persistent [`PaymentWebhookEvent`](file:///e:/E%20Commerce/backend/models/PaymentWebhookEvent.js) with unique indexes on `{ provider: 1, eventId: 1 }`.
- **Checkout Idempotency:** [`idempotency.js`](file:///e:/E%20Commerce/backend/middlewares/idempotency.js) prevents duplicate orders via SHA-256 body fingerprinting, in-flight lease locking, and 409 conflict detection.

### A05: Security Misconfiguration
- **Production CORS:** Configured via `CLIENT_URL` environment variable. Wildcard `*` with credentials is explicitly forbidden.
- **Security Headers:** Express app hardened using Helmet with cross-origin policies.
- **Tiered Rate Limiting:**
  - Auth routes: 30 requests per 15 minutes.
  - Checkout routes: 60 requests per 15 minutes.
  - General API: 1000 requests per 15 minutes.

### A06: Vulnerable and Outdated Components
- Clean dependencies managed via `package.json` and locked in `package-lock.json`. Zero high or critical vulnerabilities.

### A07: Identification and Authentication Failures
- Generic error messages ("Invalid email or password") prevent user enumeration.
- Inactive or suspended accounts (`isActive: false`) are denied immediately.

### A08: Software and Data Integrity Failures
- Real Razorpay Checkout integration in React.
- Sandbox simulator endpoint forbidden in production mode (`403 Forbidden`).
- Raw webhook verification prevents deserialization tampering.

### A09: Security Logging and Monitoring Failures
- Security-critical operations (admin logins, seller approval/rejection, user suspensions, refunds, tracking updates) are recorded in the persistent [`AuditLog`](file:///e:/E%20Commerce/backend/models/AuditLog.js) collection.
- Passwords, credit card numbers, JWT secrets, and gateway private keys are strictly excluded from logs.

---

## 3. Authorization Matrix

| Endpoint | Method | Public | Customer | Seller | Admin | Guard Middleware |
| :--- | :---: | :---: | :---: | :---: | :---: | :--- |
| `/api/v1/auth/register` | POST | Yes | Yes | Yes | No | Public customer signup only |
| `/api/v1/auth/login` | POST | Yes | Yes | Yes | Yes | Generic credentials check |
| `/api/v1/products` (public) | GET | Yes | Yes | Yes | Yes | Filtered strictly to `status: PUBLISHED` |
| `/api/v1/cart` | ALL | No | Yes | Yes | No | `requireAuth`, `requireRole('CUSTOMER', 'SELLER')` |
| `/api/v1/orders/checkout` | POST | No | Yes | Yes | No | `requireAuth`, `requireRole('CUSTOMER', 'SELLER')`, `idempotency` |
| `/api/v1/orders/confirm-payment`| POST | No | Yes | Yes | No | HMAC signature + provider verification |
| `/api/v1/seller/apply` | POST | No | Yes | Yes | No | `requireAuth` |
| `/api/v1/seller/dashboard` | GET | No | No | Approved | Admin | `requireApprovedSeller` |
| `/api/v1/seller/products` | POST/PUT | No | No | Approved | Admin | `requireApprovedSeller`, ownership check |
| `/api/v1/admin/*` | ALL | No | No | No | Yes | `requireAuth`, `requireRole('ADMIN')` |
| `/api/v1/payments/webhook` | POST | Yes | - | - | - | Raw HMAC-SHA256 signature verification |

---

## 4. Verification Sign-Off
All security policies are backed by automated tests in `backend/tests/security.test.js` and `backend/tests/production_hardening.test.js`.
