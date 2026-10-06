# MarketSphere - System Architecture & Engineering Blueprint

## 1. Architectural Philosophy

MarketSphere is structured as a **High-Cohesion, Low-Coupling Modular Monolith**. It avoids premature microservice distributed complexity while enforcing clean domain boundaries across:
- **Identity & Access Management (IAM):** Users, Roles, Sessions.
- **Vendor Lifecycle Management:** Seller Onboarding, Store Profiling, Admin Moderation.
- **Catalog & Inventory Engine:** Product Lifecycle, SKU Integrity, Atomic Concurrency.
- **Checkout & Financial Calculations:** Pricing, Coupons, Dynamic Shipping, Tax.
- **Payment & Cryptographic Verification:** Razorpay Gateway, Webhook Handlers, HMAC Signatures.
- **Order State Machine & Fulfillment:** Multi-Seller Orders, Item Milestones, Tracking.
- **Customer Account & Community:** Reviews, Invoices, Wishlists, Notifications.

```
+-----------------------------------------------------------------------+
|                             React SPA                                 |
|      (Customer Portal, Seller Hub, Admin Operations Center)           |
+-----------------------------------------------------------------------+
                                   | (HTTPS / REST)
                                   v
+-----------------------------------------------------------------------+
|                          Express.js Gateway                           |
|  - Helmet, Strict CORS, Tiered Rate Limiters, Request Parsers         |
|  - JWT Session Validation, Active Account Verification, RBAC Guards   |
+-----------------------------------------------------------------------+
        |                  |                    |                  |
        v                  v                    v                  v
+---------------+  +---------------+  +------------------+  +-----------+
| Auth & Seller |  | Product & Cat |  | Order & Checkout |  | Payments  |
| Services      |  | Services      |  | Services         |  | Gateway   |
+---------------+  +---------------+  +------------------+  +-----------+
        |                  |                    |                  |
        +------------------+--------------------+------------------+
                                   |
                                   v
+-----------------------------------------------------------------------+
|                            MongoDB Atlas                              |
|           (Compound Indexes, Unique Constraints, TTL Indexes)         |
+-----------------------------------------------------------------------+
```

---

## 2. Core Workflows & State Machines

### 2.1 Seller Onboarding & Moderation
```
CUSTOMER ---> POST /seller/apply ---> Seller Document (status: 'PENDING')
                                             |
                                    ADMIN REVIEW (/admin/sellers/:id/status)
                                             |
                     +-----------------------+-----------------------+
                     |                                               |
                     v                                               v
          status: 'APPROVED'                              status: 'REJECTED'
          Role: 'SELLER'                                  Role remains 'CUSTOMER'
          Access granted to Seller Hub                     Store inactive
```

### 2.2 Product Moderation Lifecycle
```
APPROVED SELLER ---> POST /products ---> Product Document (status: 'PENDING_MODERATION')
                                                        |
                                          ADMIN REVIEW (/admin/products/:id/moderate)
                                                        |
                                +-----------------------+-----------------------+
                                |                                               |
                                v                                               v
                     status: 'PUBLISHED'                             status: 'REJECTED'
                     Visible in Public Catalog                       Hidden from Catalog
                                                                     Seller can edit & re-submit
```

### 2.3 Atomic Inventory Reservation & Checkout Flow
```
Customer Clicks "Place Order" (with Idempotency-Key)
           |
           v
Validate Cart Items from Database
           |
           +---> For each item: Product.findOneAndUpdate(
           |       { _id: item.productId, stock: { $gte: item.quantity } },
           |       { $inc: { stock: -item.quantity } },
           |       { new: true }
           |     )
           |
   [Are all items secured?]
      /                \
    YES                 NO
     |                   |
     v                   v
Calculate Totals    Rollback Secured Items ($inc: stock +qty)
(Subtotal - Coupon  Throw "Insufficient Stock"
 + Tax + Shipping)  Order Aborted
     |
     v
Create Order Document
Clear Customer Cart
Create Payment Intent
```

### 2.4 Cryptographic Payment Verification Flow
```
Client Checkout ---> Order created in 'PENDING_PAYMENT' status
         |
         v
Payment Provider (Razorpay / Cryptographic Sandbox)
Customer Authorizes Payment
Gateway returns: providerOrderId, providerPaymentId, providerSignature
         |
         v
Client POST /orders/confirm-payment
Backend calculates:
  expectedSignature = HMAC_SHA256(secret, providerOrderId + "|" + providerPaymentId)
Backend compares with providerSignature using crypto.timingSafeEqual
         |
    [Signature Valid?]
       /          \
     YES           NO
      |             |
      v             v
Mark Order 'PAID'   Mark Order 'FAILED'
Set Status 'CONFIRMED'  Reject request (400)
Notify Customer & Sellers
```

---

## 3. Order & Item Lifecycle State Transition Matrix

```
       +--------------------+
       |  PENDING_PAYMENT   |
       +--------------------+
                 |
                 +-----> (Payment Success) -----> CONFIRMED
                 |                                   |
                 +-----> (Cancellation) -----------> CANCELLED
                 |
                 v
            CONFIRMED
                 |
                 v
            PROCESSING
                 |
                 v
              SHIPPED
                 |
                 v
             DELIVERED
                 |
                 +-----> (Customer Return Request) ---> RETURN_REQUESTED
                 |                                            |
                 |                                            v
                 |                                     RETURN_APPROVED
                 |                                            |
                 |                                            v
                 |                                         RETURNED (Refunded)
                 v
             COMPLETED
```

---

## 4. Security Defense in Depth

1. **Identity & Authentication:**
   - Password hashing via bcrypt (salt rounds = 10).
   - Strict JWT issuance without fallback secrets.
   - Database checks on every authenticated request verifying user existence and active status (`isActive === true`).
2. **Access Control:**
   - Server-side RBAC middleware (`requireRole`, `requireApprovedSeller`, `requireActiveAccount`).
   - Strict resource ownership checks in services.
3. **Parameter Tampering & Mass Assignment:**
   - Whitelist mutation properties on Product, Seller, and User updates.
   - Client-supplied roles and prices are ignored.
4. **Idempotency:**
   - `Idempotency-Key` header prevents duplicate deductions and orders.
5. **Rate Limiting:**
   - Tiered limits isolate authentication abuse, checkout flooding, and general API requests.
