# MarketSphere: Automated Test Execution Report

## 1. Summary
All test suites run in an isolated in-memory MongoDB environment (`mongodb-memory-server`) to guarantee reproducible, zero-leak testing.

| Metric | Result |
| :--- | :--- |
| **Total Test Suites** | **8 / 8 Passed (100%)** |
| **Total Executable Tests** | **35 / 35 Passed (100%)** |
| **Total Snapshots** | 0 |
| **Execution Duration** | ~7.3 seconds |
| **Failures / Regressions** | **0** |

---

## 2. Test Suite Breakdown

### Suite 1: `tests/commerce.test.js` (PASS)
- Validates atomic cart item addition, quantity updates, and cart clearing.
- Validates server-side inventory stock checks before cart addition.
- Verifies server-calculated subtotals and discounts.

### Suite 2: `tests/wishlist.test.js` (PASS)
- Verifies customer and seller wishlist item toggling.
- Enforces user isolation (preventing cross-user wishlist access).
- Verifies idempotent wishlist toggle operations.

### Suite 3: `tests/product.test.js` (PASS)
- Rejects product creation attempts by unapproved or pending sellers (`403`).
- Sets default product status to `PENDING_MODERATION` upon creation by approved sellers.
- Strictly enforces product ownership (seller cannot mutate another seller's catalog item).
- Verifies public search returns only `PUBLISHED` products.

### Suite 4: `tests/seller.test.js` (PASS)
- Verifies customer seller application onboarding flow (`PENDING` state).
- Prevents seller self-approval and rejects unauthorized status mutations.
- Enforces administrative approval lifecycle (`PENDING` -> `APPROVED` / `REJECTED`).

### Suite 5: `tests/dashboard.test.js` (PASS)
- Verifies seller metrics (orders, gross revenue, items) are isolated strictly to the authenticated seller.
- Verifies line-item fulfillment status updates.
- Verifies unapproved sellers cannot access dashboard metrics (`403`).

### Suite 6: `tests/order.test.js` (PASS)
- Verifies multi-seller order line-item splitting.
- Verifies address structure validation (street, city, zipCode).
- Verifies order timeline event creation on checkout and fulfillment.

### Suite 7: `tests/security.test.js` (PASS)
- **Authentication & Inactive States:** Rejects unauthenticated requests (`401`) and deactivated/suspended accounts (`403`).
- **RBAC Boundaries:** Rejects `CUSTOMER` attempting `ADMIN` routes (`403`). Rejects `SELLER` attempting `ADMIN` routes (`403`).
- **Mass Assignment:** Attempts to inject `role: 'ADMIN'`, `sellerId`, or `status: 'PUBLISHED'` during profile or product updates are discarded.
- **Cryptographic Signatures:** Validates authentic HMAC-SHA256 signatures; rejects forged or tampered signatures.
- **Idempotency Storage:** Confirms idempotent key storage and caching.

### Suite 8: `tests/production_hardening.test.js` (PASS)
- **Centralized State Machine:** Confirms valid forward transitions and strictly throws errors on illegal state hops (`PENDING_PAYMENT` -> `DELIVERED`, `CANCELLED` -> `CONFIRMED`, `REFUNDED` -> `PAID`).
- **Persistent Webhook Deduplication:** Confirms MongoDB unique index prevents duplicate processing of identical webhook event IDs across processes.
- **Raw Webhook Verification:** Verifies HMAC-SHA256 signature against verbatim raw request buffer.
- **Financial Refund Integrity:** Verifies that when provider refund fails, `paymentStatus` is set to `REFUND_PENDING` / `REFUND_FAILED`, never falsely claiming `REFUNDED`.
- **Idempotency Fingerprint:** Verifies SHA-256 request payload hashing and in-flight lease tracking.
- **Seller Commerce Access:** Confirms seller accounts retain customer shopping privileges (cart, checkout, orders).

---

## 3. How to Run the Tests
```bash
cd backend
npm test
```
