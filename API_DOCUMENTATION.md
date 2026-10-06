# MarketSphere - Complete REST API Documentation

**Base URL:** `http://localhost:5002/api/v1`  
**Authentication Scheme:** `Bearer <JWT_TOKEN>` in `Authorization` header  
**Content-Type:** `application/json`

---

## 1. Authentication Endpoints (`/auth`)

### 1.1 Register Customer
- **Endpoint:** `POST /auth/register`
- **Access:** Public
- **Description:** Registers a new user. Always assigns role `CUSTOMER`.
- **Request Body:**
  ```json
  {
    "firstName": "Rahul",
    "lastName": "Sharma",
    "email": "rahul@example.com",
    "password": "Password123!"
  }
  ```
- **Response (201 Created):**
  ```json
  {
    "status": "success",
    "data": {
      "_id": "6702...",
      "firstName": "Rahul",
      "lastName": "Sharma",
      "email": "rahul@example.com",
      "role": "CUSTOMER",
      "token": "eyJhbGciOi..."
    }
  }
  ```

### 1.2 Login User
- **Endpoint:** `POST /auth/login`
- **Access:** Public
- **Request Body:**
  ```json
  {
    "email": "rahul@example.com",
    "password": "Password123!"
  }
  ```
- **Response (200 OK):** Returns user details, assigned role, and Bearer JWT token.

---

## 2. Catalog & Products (`/products`)

### 2.1 Public Search & Catalog Exploration
- **Endpoint:** `GET /products`
- **Access:** Public
- **Query Parameters:** `search`, `category`, `minPrice`, `maxPrice`, `sortBy`, `sortOrder`, `page`, `limit`
- **Security Constraint:** Returns ONLY products with `status: 'PUBLISHED'`.

### 2.2 Product Details
- **Endpoint:** `GET /products/:id`
- **Access:** Public (Optional auth allows owning seller or admin to preview drafts)
- **Response:** Complete product details, authentic averageRating, reviews, attributes, and seller store profile.

### 2.3 Create Product
- **Endpoint:** `POST /products`
- **Access:** Authenticated (`SELLER` with `status: 'APPROVED'`)
- **Note:** Products are automatically assigned status `PENDING_MODERATION`.

### 2.4 Update Product
- **Endpoint:** `PUT /products/:id`
- **Access:** Authenticated (Owning `SELLER` with `status: 'APPROVED'`)
- **Protected Fields:** Cannot mutate `sellerId`, `status`, `sku`, or `averageRating`.

---

## 3. Cart & Wishlist (`/cart`, `/wishlist`)

### 3.1 Get Cart
- **Endpoint:** `GET /cart`
- **Access:** Authenticated (`CUSTOMER` or `SELLER`)
- **Response (200 OK):** User's cart populated with current DB product prices and stock.

### 3.2 Add Item to Cart
- **Endpoint:** `POST /cart/items`
- **Access:** Authenticated (`CUSTOMER` or `SELLER`)
- **Request Body:** `{ "productId": "6702...", "quantity": 2 }`

### 3.3 Clear Cart
- **Endpoint:** `DELETE /cart`
- **Access:** Authenticated (`CUSTOMER` or `SELLER`)

---

## 4. Checkout, Orders & Payment (`/orders`, `/payments`)

### 4.1 Checkout Order
- **Endpoint:** `POST /orders/checkout`
- **Access:** Authenticated (`CUSTOMER` or `SELLER`)
- **Headers:** `Idempotency-Key: <unique-uuid>` (Mandatory for replay protection)
- **Request Body:**
  ```json
  {
    "paymentMethod": "RAZORPAY",
    "couponCode": "SAVE20",
    "shippingAddress": {
      "fullName": "Rahul Sharma",
      "phone": "+91 98765 43210",
      "street": "123 MG Road",
      "city": "Bengaluru",
      "state": "Karnataka",
      "zipCode": "560038"
    }
  }
  ```
- **Response (201 Created):**
  ```json
  {
    "status": "success",
    "data": {
      "order": { "_id": "6702...", "totalAmount": 2625, "orderStatus": "PENDING_PAYMENT" },
      "clientPaymentData": {
        "provider": "RAZORPAY",
        "providerOrderId": "order_xxxx",
        "amountInPaise": 262500,
        "currency": "INR",
        "keyId": "rzp_test_..."
      }
    }
  }
  ```

### 4.2 Cryptographic Payment Confirmation
- **Endpoint:** `POST /orders/confirm-payment`
- **Access:** Authenticated (`CUSTOMER` or `SELLER`)
- **Headers:** `Idempotency-Key: <unique-uuid>`
- **Request Body:**
  ```json
  {
    "orderId": "6702...",
    "providerOrderId": "order_xxxx",
    "providerPaymentId": "pay_yyyy",
    "providerSignature": "hmac_sha256_hex_digest"
  }
  ```
- **Security Check:** Server calculates expected HMAC-SHA256 signature using `RAZORPAY_KEY_SECRET` and queries gateway API before marking `PAID` and `CONFIRMED`.

### 4.3 Payment Gateway Webhook
- **Endpoint:** `POST /payments/webhook`
- **Access:** Public (Protected via `X-Razorpay-Signature`)
- **Headers:** `X-Razorpay-Signature: <hmac-signature>`
- **Behavior:** Verifies raw request byte stream against `RAZORPAY_WEBHOOK_SECRET`. Persistent deduplication via `PaymentWebhookEvent`.

### 4.4 Cancel Order
- **Endpoint:** `POST /orders/:id/cancel`
- **Access:** Authenticated Customer/Seller owner
- **Behavior:** Validates order state machine (`CONFIRMED`, `PROCESSING`). Restores stock atomically. Triggers provider refund if paid online.

### 4.5 Request Return
- **Endpoint:** `POST /orders/:id/return`
- **Access:** Authenticated Customer/Seller owner
- **Rule:** Permitted only when `orderStatus === 'DELIVERED'`.

### 4.6 Sandbox Signature Simulator (Development Only)
- **Endpoint:** `POST /orders/simulate-sandbox-signature`
- **Access:** Authenticated
- **Security Restriction:** Explicitly returns `403 Forbidden` when `NODE_ENV === 'production'`. Used only in unit/integration testing environments.

---

## 5. Seller Management (`/seller`)

### 5.1 Submit Seller Store Application
- **Endpoint:** `POST /seller/apply`
- **Access:** Authenticated (`CUSTOMER`)
- **Request Body:** `{ "storeName": "Apex Retail", "description": "Electronics", "contactEmail": "apex@store.com" }`
- **Behavior:** Creates seller record in `PENDING` status for Admin review.

### 5.2 Seller Dashboard Analytics
- **Endpoint:** `GET /seller/dashboard`
- **Access:** Authenticated (`SELLER` with `status: 'APPROVED'`)
- **Response:** Isolated seller revenue, total orders, product breakdown, and low-stock alerts.

### 5.3 Update Item Fulfillment
- **Endpoint:** `PATCH /seller/orders/:orderId/items/:itemId`
- **Access:** Authenticated (`SELLER` with `status: 'APPROVED'`)
- **Request Body:** `{ "status": "SHIPPED", "trackingNumber": "TRK987654" }`

---

## 6. Admin Control Center (`/admin`)

- `GET /admin/sellers` (List pending and approved sellers)
- `PATCH /admin/sellers/:id/status` (Approve/Reject seller application)
- `GET /admin/moderation/products` (Product moderation queue)
- `PATCH /admin/moderation/products/:id` (Approve/Publish or Reject product)
- `PATCH /admin/orders/:orderId/returns` (Approve or Reject return and issue refund)
- `PATCH /admin/orders/:orderId/tracking` (Update carrier and tracking details)
- `GET /admin/audit-logs` (View security audit records)
- `GET /admin/analytics` (Marketplace-wide sales and volume metrics)

---

## 7. Health & Diagnostic Probes

- `GET /api/v1/health` (Application liveness probe)
- `GET /api/v1/ready` (Database readiness probe)
