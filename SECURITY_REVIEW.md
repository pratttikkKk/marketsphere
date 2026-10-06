# MarketSphere - Application Security Review & Threat Model

**Author:** Application Security & Systems Architecture  
**Standards Grounding:** OWASP Top 10 (2021/2025), CWE, NIST SP 800-63B  
**Target System:** MarketSphere Multi-Vendor E-Commerce Platform

---

## 1. Executive Security Assessment

The existing codebase demonstrates fundamental security controls (bcrypt password hashing, JWT issuance, and Mongoose schema definitions) but suffers from high-severity architectural vulnerabilities typical of early-stage prototypes. The most pressing risks include **Privilege Escalation** (public admin registration), **Bypass of Seller Moderation** (automatic approval), **Mass Assignment** (direct `Object.assign` on products and sellers), **Insecure Payment Flow** (trusting unverified client callbacks and mocked states), and **Weak Secret Management** (fallback JWT secrets).

---

## 2. Threat Modeling & OWASP Top 10 Deep Dive

### 2.1 A01:2021 – Broken Access Control (CRITICAL)
- **Vulnerability 1: Public Admin Registration**
  - *Location:* `backend/controllers/authController.js` (lines 24-32)
  - *Mechanism:* `const assignedRole = ['SELLER', 'ADMIN'].includes(role) ? role : 'CUSTOMER';` allowed any unauthenticated user to pass `role: 'ADMIN'` in the registration body and obtain full administrator privileges.
  - *Remediation:* Public registration must hardcode `role: 'CUSTOMER'`. Any client-submitted `role` field must be ignored. Administrators must only be created via a dedicated server-side CLI bootstrap script.
- **Vulnerability 2: Seller Self-Approval & Automatic Moderation Bypass**
  - *Location:* `backend/controllers/authController.js` (line 43), `backend/services/productService.js` (lines 13-17), `backend/services/sellerDashboardService.js` (lines 10-15)
  - *Mechanism:* Registering as a seller or accessing seller endpoints automatically set `seller.status = 'APPROVED'`, nullifying the platform's vendor vetting and compliance process.
  - *Remediation:* Enforce a strict state lifecycle: `PENDING -> APPROVED / REJECTED`. Remove all auto-approval code paths. Enforce `requireApprovedSeller` middleware on all seller operations.
- **Vulnerability 3: Public Exposure of Unmoderated Products**
  - *Location:* `backend/services/productService.js` (`getProductDetails`)
  - *Mechanism:* Direct lookup by ID did not verify that `product.status === 'PUBLISHED'`. Users could access unapproved, rejected, or draft products.
  - *Remediation:* Public product endpoints must strictly require `{ status: 'PUBLISHED' }`. Only the owning seller or an admin may inspect non-published items.
- **Vulnerability 4: Insecure Direct Object Reference (IDOR)**
  - *Locations:* Order inspection (`/orders/:id`), Seller item fulfillment (`/seller/orders/:orderId/items/:itemId`).
  - *Remediation:* Ensure that order queries explicitly include `customerId: req.user.id` for customers, and that seller updates verify that `item.sellerId.toString() === seller._id.toString()`.

### 2.2 A02:2021 – Cryptographic Failures (HIGH)
- **Vulnerability: Hardcoded Default JWT Secret**
  - *Location:* `backend/middlewares/auth.js` (`process.env.JWT_SECRET || 'your_jwt_secret_here'`)
  - *Risk:* If `JWT_SECRET` is unset in production, attackers can forge arbitrary tokens using the known default secret.
  - *Remediation:* In production, backend startup must immediately crash (`process.exit(1)`) if `JWT_SECRET` is missing or matches known insecure defaults.

### 2.3 A03:2021 – Injection & Parameter Tampering (MEDIUM-HIGH)
- **Vulnerability 1: Mass Assignment via `Object.assign`**
  - *Location:* `backend/services/productService.js` (`updateProduct`)
  - *Risk:* A malicious seller can pass `{ sellerId: 'anotherSeller', status: 'PUBLISHED', averageRating: 5 }` to overwrite critical business properties.
  - *Remediation:* Implement strict field whitelisting:
    - *Allowed:* `name`, `description`, `price`, `stock`, `category`, `attributes`, `variants`, `images`.
    - *Protected:* `sellerId`, `status`, `sku`, `averageRating`, `numReviews`, `createdAt`, `updatedAt`.
- **Vulnerability 2: NoSQL Query Injection**
  - *Risk:* Passing unvalidated query parameters (e.g. `{ $ne: null }`) in MongoDB queries.
  - *Remediation:* Sanitize inputs, enforce string typing, and use express input validation schemas.

### 2.4 A04:2021 – Insecure Design (HIGH)
- **Vulnerability 1: Mocked Payment Trust**
  - *Location:* `backend/services/paymentService.js` & `orderService.js`
  - *Risk:* Mock service returns `status: 'PAID'` for any arbitrary request without communicating with a genuine payment provider or verifying cryptographic signatures.
  - *Remediation:* Integrate Razorpay / sandbox payment gateway. Require server-side order generation, client checkout, server HMAC SHA256 signature verification, and webhook reconciliation.
- **Vulnerability 2: Race Conditions in Inventory / Overselling**
  - *Risk:* High-concurrency checkout of the last item in stock.
  - *Remediation:* Atomic decrement using `{ _id: productId, stock: { $gte: quantity } }, { $inc: { stock: -quantity } }` with compensation rollbacks and idempotency keys to prevent duplicate deductions.

### 2.5 A05:2021 – Security Misconfiguration (MEDIUM)
- **Vulnerability 1: Permissive Rate Limiting**
  - *Location:* `backend/app.js` (global limit of 5,000 requests per 15 minutes).
  - *Remediation:* Implement tiered rate limiting:
    - Auth endpoints (`/auth/login`, `/auth/register`): 10 requests per 15 minutes.
    - Password reset: 5 requests per 15 minutes.
    - Checkout & Payment: 30 requests per 15 minutes.
    - General API: 300 requests per 15 minutes.
- **Vulnerability 2: CORS Configuration**
  - *Current:* Static localhost origins.
  - *Remediation:* Dynamically read `CLIENT_URL` from environment; disallow wildcard origins with credentials.

### 2.6 A08:2021 – Software and Data Integrity Failures (HIGH)
- **Vulnerability: Missing Idempotency Control**
  - *Risk:* Network timeouts or double-clicks on "Pay Now" or "Checkout" cause duplicate order creation, double credit card charges, or double inventory deductions.
  - *Remediation:* Implement an `Idempotency-Key` header mechanism backed by MongoDB / cache.

### 2.7 A09:2021 – Security Logging & Monitoring Failures (MEDIUM)
- *Finding:* `AuditLog` model exists and tracks admin actions. However, customer and seller authentication events (e.g., failed logins, password changes, account lockouts) are not audited.
- *Remediation:* Log authentication failures and critical financial operations, ensuring no sensitive credentials (passwords, tokens, payment secrets) appear in logs.

---

## 3. Complete Role-Based Authorization Matrix

| Endpoint | HTTP Method | Allowed Roles | Middleware Required | Ownership Check |
| :--- | :--- | :--- | :--- | :--- |
| `/api/v1/auth/register` | POST | Public | Input Validation | N/A (Forces `CUSTOMER`) |
| `/api/v1/auth/login` | POST | Public | Auth Rate Limiter | N/A |
| `/api/v1/auth/me` | GET | Authenticated | `requireAuth` | Own record |
| `/api/v1/seller/apply` | POST | CUSTOMER | `requireAuth`, `requireActiveAccount` | User ID = `req.user.id` |
| `/api/v1/seller/me` | GET / PUT | SELLER | `requireAuth`, `requireApprovedSeller` | Own seller profile |
| `/api/v1/seller/dashboard` | GET | SELLER | `requireAuth`, `requireApprovedSeller` | Own metrics only |
| `/api/v1/seller/products` | GET / POST | SELLER | `requireAuth`, `requireApprovedSeller` | Own products only |
| `/api/v1/seller/products/:id`| PUT / DELETE | SELLER | `requireAuth`, `requireApprovedSeller` | Verify `product.sellerId == seller._id` |
| `/api/v1/seller/orders` | GET | SELLER | `requireAuth`, `requireApprovedSeller` | Filters items to own `sellerId` |
| `/api/v1/seller/orders/:id/items/:itemId` | PATCH | SELLER | `requireAuth`, `requireApprovedSeller` | Verify `item.sellerId == seller._id` |
| `/api/v1/products` | GET | Public | None | Only `{ status: 'PUBLISHED' }` |
| `/api/v1/products/:id` | GET | Public | None | Only `{ status: 'PUBLISHED' }` (unless owner/admin) |
| `/api/v1/cart` | GET / POST / PUT / DELETE | CUSTOMER | `requireAuth`, `requireRole('CUSTOMER')` | `customerId: req.user.id` |
| `/api/v1/orders/checkout` | POST | CUSTOMER | `requireAuth`, `requireRole('CUSTOMER')`, Idempotency | `customerId: req.user.id` |
| `/api/v1/orders` | GET | CUSTOMER | `requireAuth`, `requireRole('CUSTOMER')` | `customerId: req.user.id` |
| `/api/v1/orders/:id` | GET | CUSTOMER | `requireAuth` | `customerId: req.user.id` or ADMIN |
| `/api/v1/orders/:id/cancel` | POST | CUSTOMER | `requireAuth`, `requireRole('CUSTOMER')` | `customerId: req.user.id` |
| `/api/v1/payments/create-order` | POST | CUSTOMER | `requireAuth`, `requireRole('CUSTOMER')` | Own order |
| `/api/v1/payments/verify` | POST | CUSTOMER | `requireAuth`, `requireRole('CUSTOMER')` | HMAC SHA256 Signature verification |
| `/api/v1/payments/webhook` | POST | Provider (Razorpay) | Webhook Signature Verification | HMAC Webhook secret verification |
| `/api/v1/reviews` | POST | CUSTOMER | `requireAuth`, `requireRole('CUSTOMER')` | Verified delivered purchase check |
| `/api/v1/wishlist` | GET / POST / DELETE | CUSTOMER | `requireAuth`, `requireRole('CUSTOMER')` | `customerId: req.user.id` |
| `/api/v1/admin/*` | ALL | ADMIN | `requireAuth`, `requireRole('ADMIN')` | Full marketplace moderation with AuditLog |

---

## 4. Remediation Checklist

1. [x] Remove `role: 'ADMIN'` acceptance in public registration.
2. [x] Remove automatic seller approval upon registration or dashboard query.
3. [x] Replace HTTP-based `create-admin.js` with secure server-side script `npm run bootstrap:admin`.
4. [x] Make `JWT_SECRET` mandatory; terminate server startup if absent or insecure.
5. [x] Implement field whitelisting on all Product and Seller mutation routes.
6. [x] Implement real cryptographic payment signature verification (Razorpay/sandbox HMAC SHA256).
7. [x] Implement `Idempotency-Key` tracking on checkout, payment, and refund operations.
8. [x] Enforce frontend route guards matching the backend authorization boundaries.
