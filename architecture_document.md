# MarketSphere - Architecture & Design Document

## 1. Requirements Analysis & Feature Prioritization

MarketSphere is a multi-vendor e-commerce platform. The system will be built as a **Modular Monolith** using Node.js/Express for the backend and React/Vite for the frontend. This approach ensures high cohesion, ease of deployment, and a straightforward path for onboarding new developers, while avoiding the operational overhead of microservices.

### Feature Classification
**Essential (Phase 1 - MVP):**
* User Authentication & Authorization (JWT based).
* Roles: Customer, Seller, Admin.
* Seller onboarding and Admin approval flow.
* Product management (CRUD by Sellers).
* Catalog browsing, search, and category filtering (Customers).
* Shopping cart and basic checkout (including multi-seller orders).
* Order management & lifecycle (Customer & Seller views).

**Enhancements (Phase 2):**
* Reviews and Ratings.
* Coupons & Discounts.
* Advanced inventory management & low-stock alerts.
* Seller Analytics & Dashboard.
* Admin dashboard, user management, and moderation.

**Deferred (Phase 3 & Beyond):**
* AI-powered shopping assistant.
* Advanced logistics integrations.
* Real-time chat between customers and sellers.

---

## 2. User Roles and Permissions

* **Customer:** Can browse products, add to cart, checkout, view order history, leave reviews, and manage their profile/wishlist.
* **Seller:** Can manage store profile, create/edit/delete their own products, view/process orders containing their products, and view store analytics. *Must be approved by Admin before their products are visible.*
* **Admin:** Overarching platform control. Can approve/reject sellers, moderate products/reviews, manage categories, view system-wide analytics, and audit logs. Created via a secure seed script.

---

## 3. MongoDB Schemas and Relationships

To ensure performance and maintainability, we will use a mix of normalized and denormalized data structures suitable for a NoSQL document database.

* **User Schema:** Stores auth credentials and profile info. 
  * Fields: `firstName`, `lastName`, `email`, `passwordHash`, `role` (Enum), `address`, `isActive`.
* **SellerProfile Schema:** Linked to the User.
  * Fields: `userId` (Ref), `storeName`, `description`, `logoUrl`, `verificationStatus` (Pending, Approved, Rejected).
* **Product Schema:** 
  * Fields: `sellerId` (Ref), `title`, `description`, `price`, `stockQuantity`, `category` (Ref), `images`, `ratingsAverage`, `isActive`.
* **Category Schema:** Hierarchical or flat categories managed by Admins.
  * Fields: `name`, `slug`, `parentCategory` (Ref, optional).
* **Order Schema:** Represents a customer's purchase.
  * Fields: `customerId` (Ref), `totalAmount`, `shippingAddress`, `paymentStatus`.
  * We will embed or reference an **OrderItem** structure. Since a single checkout can have items from *multiple sellers*, the order will contain a list of items, each identifying the `sellerId`, `productId`, `quantity`, `priceAtPurchase`, and `fulfillmentStatus`.
* **Review Schema:** 
  * Fields: `productId` (Ref), `customerId` (Ref), `rating`, `comment`.

---

## 4. REST API Outline

We will group endpoints by modular domains.

**Auth & Users (`/api/v1/auth`, `/api/v1/users`)**
* `POST /auth/register` (Customer/Seller)
* `POST /auth/login`
* `GET /users/me` (Profile fetch)

**Products (`/api/v1/products`)**
* `GET /products` (Search, filter, paginate)
* `GET /products/:id` 
* `POST /products` (Seller only)
* `PUT /products/:id` (Seller only)

**Sellers (`/api/v1/sellers`)**
* `GET /sellers/:id` (Public store view)
* `GET /sellers` (Admin view for approvals)
* `PATCH /sellers/:id/approve` (Admin only)

**Orders (`/api/v1/orders`)**
* `POST /orders` (Checkout process)
* `GET /orders` (Customer: their orders; Seller: their received orders)
* `PATCH /orders/:id/items/:itemId/status` (Seller updates shipping status)

**Admin (`/api/v1/admin`)**
* `GET /admin/stats` (Platform analytics)
* `GET /admin/audit-logs`

---

## 5. Lifecycles

### Order & Payment Lifecycle
1. **Cart:** Customer adds items from Seller A and Seller B.
2. **Checkout:** Order is created. `paymentStatus: PENDING`.
3. **Payment:** Customer pays via mock gateway/Stripe. If successful, `paymentStatus: PAID`.
4. **Fulfillment Split:** The system notifies Seller A and Seller B. The order items have individual statuses: `PENDING`.
5. **Shipping:** Seller A ships their item -> Item status `SHIPPED`. Seller B ships -> Item status `SHIPPED`.
6. **Delivery:** Once all items are delivered, the overarching Order status becomes `COMPLETED`.

### Inventory Lifecycle
* **Soft Allocation:** When an item is placed in a cart, it is NOT reserved (to prevent cart hoarding).
* **Hard Deduction:** Stock is atomically decremented using MongoDB `$inc` when the checkout/payment is successfully initiated.
* **Restock:** If the payment fails or the order is cancelled, stock is incremented back.

---

## 6. Security Model

* **Authentication:** Stateless JWTs sent via `HttpOnly` cookies (prevents XSS). Short-lived access tokens with rotating refresh tokens.
* **Authorization:** Role-based access control (RBAC) middleware. For instance, `requireRole('SELLER')` and `checkResourceOwnership` (to ensure a seller only edits their own product).
* **Admin Setup:** Admin accounts cannot be created via the public API. A secure CLI script (e.g., `npm run seed:admin`) will hash a password and insert the Admin directly into the DB.
* **Data Validation:** Joi or Zod middleware to sanitize and validate all incoming request bodies before they reach the controller.
* **Rate Limiting:** IP-based rate limiting on sensitive routes (login, registration) to prevent brute force.

---

## 7. Important Edge Cases & Risks

* **Concurrency (Race Conditions):** Two customers buy the last item simultaneously. *Mitigation:* Use MongoDB's optimistic concurrency control or atomic `$inc` queries with a condition `stock >= requestedQuantity`.
* **Multi-Seller Shipping Calculations:** Shipping costs compound when buying from multiple sellers. *Mitigation:* Explicitly display shipping breakdowns per seller in the cart.
* **Distributed Failures:** Payment succeeds but stock deduction fails. *Mitigation:* Use MongoDB multi-document ACID transactions for the checkout flow.
* **Image Hosting:** Sellers uploading massive images. *Mitigation:* Enforce file size limits and use a cloud bucket (AWS S3) with pre-signed URLs, storing only the URL in the DB.

---

## 8. Phased Implementation Plan

* **Milestone 1: Foundation (Weeks 1-2)**
  * Project setup (Express, Vite, Tailwind).
  * Database connection, Error Handling middleware.
  * Auth system (JWT) & Admin seeding.
* **Milestone 2: Core E-Commerce (Weeks 3-4)**
  * Products API & Seller onboarding.
  * Frontend catalog, product pages, and cart state.
* **Milestone 3: Transactions (Weeks 5-6)**
  * Order creation and multi-seller routing.
  * Inventory atomic operations and MongoDB transactions.
  * Checkout UI.
* **Milestone 4: Polish & Enhancements (Weeks 7-8)**
  * Reviews, Seller Dashboards.
  * Unit/Integration testing (Jest/Supertest).
  * Deployment configurations.

---

## 9. Major Design Decisions & Trade-offs

1. **Modular Monolith vs. Microservices:**
   * *Decision:* Modular Monolith.
   * *Trade-off:* We sacrifice the ability to independently scale a tiny specific service, but we gain massive improvements in developer velocity, simpler transactions, and easier debugging. Ideal for a team starting out.
2. **MongoDB vs. PostgreSQL:**
   * *Decision:* MongoDB.
   * *Trade-off:* We lose strict relational constraints, but we gain schema flexibility for diverse product catalogs. By leveraging Mongoose and multi-document transactions for checkout, we maintain data integrity.
3. **Session vs. JWT:**
   * *Decision:* JWT in `HttpOnly` cookies.
   * *Trade-off:* Harder to invalidate instantly compared to server-side sessions, but allows the API to remain purely stateless, improving response times.

---
**Awaiting Approval:** Please review this architecture document. Once you approve, we can begin initializing the project repository and executing Milestone 1.
