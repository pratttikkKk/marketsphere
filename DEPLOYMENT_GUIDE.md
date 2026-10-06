# MarketSphere: Production Deployment & Operations Guide

## 1. Prerequisites
- **Node.js**: >= 18.0.0 (LTS recommended)
- **MongoDB**: >= 6.0.0 (MongoDB Atlas with TLS recommended for production)
- **Docker**: Optional, for containerized deployments

---

## 2. Environment Variables Specification

### Backend (`backend/.env`)
| Variable | Description | Required in Production | Example / Default |
| :--- | :--- | :---: | :--- |
| `NODE_ENV` | Runtime environment | Yes | `production` |
| `PORT` | HTTP port to bind | Yes | `5002` (or provider assigned) |
| `MONGO_URI` | MongoDB Atlas Connection String | Yes | `mongodb+srv://user:pass@cluster.mongodb.net/marketsphere?retryWrites=true&w=majority` |
| `JWT_SECRET` | Strong cryptographic secret for auth | Yes | `min-32-char-random-cryptographic-secret` |
| `CLIENT_URL` | Allowed frontend origin for CORS | Yes | `https://marketsphere.example.com` |
| `PAYMENT_PROVIDER`| Payment gateway provider | Yes | `RAZORPAY` |
| `RAZORPAY_KEY_ID` | Razorpay Merchant Public Key | Yes | `rzp_live_xxxxxxxxxxxxxxxx` |
| `RAZORPAY_KEY_SECRET` | Razorpay Merchant Secret Key | Yes | `yyyyyyyyyyyyyyyyyyyyyyyy` |
| `RAZORPAY_WEBHOOK_SECRET` | Secret configured on Razorpay Webhook dashboard | Yes | `zzzzzzzzzzzzzzzzzzzzzzzz` |
| `CLOUDINARY_CLOUD_NAME` | Cloudinary persistent object storage | Optional (Fallback to local) | `marketsphere-prod` |
| `CLOUDINARY_API_KEY` | Cloudinary API Key | Optional | `123456789012345` |
| `CLOUDINARY_API_SECRET` | Cloudinary API Secret | Optional | `secret_key` |
| `SMTP_HOST` | Email provider SMTP host | Optional (Console log dev fallback) | `smtp.resend.com` |
| `SMTP_PORT` | Email provider SMTP port | Optional | `587` |
| `SMTP_USER` | SMTP Username | Optional | `resend` |
| `SMTP_PASS` | SMTP Password | Optional | `re_xxxxxxxxxxxx` |

### Frontend (`frontend/.env`)
| Variable | Description | Required in Production | Example / Default |
| :--- | :--- | :---: | :--- |
| `VITE_API_URL` | Backend API base URL | Yes | `https://api.marketsphere.example.com/api/v1` |

---

## 3. Step-by-Step Deployment Procedure

### Step 3.1: Database Setup
1. Provision a MongoDB Atlas cluster (M0 sandbox for staging or M10+ for production).
2. Create a dedicated database user with readWrite privileges on `marketsphere`.
3. Whitelist the IP addresses of your backend servers (or allow access from anywhere `0.0.0.0/0` with strong authentication).

### Step 3.2: Bootstrap Administrator Account
Execute the direct CLI bootstrap tool in a secure shell:
```bash
cd backend
ADMIN_EMAIL="admin@yourdomain.com" ADMIN_PASSWORD="YourStrongPassword2026!" npm run bootstrap:admin
```
> [!NOTE]
> The admin bootstrap runs strictly via local CLI directly into MongoDB. There is NO public HTTP admin registration endpoint.

### Step 3.3: Deploy Backend (Render / Railway / AWS ECS)
1. Set the build command:
   ```bash
   npm ci
   ```
2. Set the start command:
   ```bash
   node server.js
   ```
3. Configure all required backend environment variables.
4. Set health check probe to:
   - **Liveness:** `GET /api/v1/health`
   - **Readiness:** `GET /api/v1/ready`

### Step 3.4: Deploy Frontend (Vercel / Netlify / Cloudflare Pages)
1. Set framework to **Vite**.
2. Root directory: `frontend`.
3. Build command:
   ```bash
   npm ci && npm run build
   ```
4. Output directory: `dist`.
5. Configure `VITE_API_URL` to point to your deployed backend.
6. Configure SPA fallback rewrite in `vercel.json`:
   ```json
   {
     "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }]
   }
   ```

### Step 3.5: Razorpay Webhook Configuration
1. Open Razorpay Merchant Dashboard -> Settings -> Webhooks.
2. Click **Add New Webhook**.
3. **Webhook URL**: `https://api.yourdomain.com/api/v1/payments/webhook`.
4. **Secret**: Enter the value used in `RAZORPAY_WEBHOOK_SECRET`.
5. **Active Events**: Check:
   - `payment.captured`
   - `payment.failed`
   - `refund.processed`
   - `refund.failed`
6. Click **Create Webhook**.

---

## 4. Docker Deployment

### Building and Running the Backend Container
```bash
cd backend
docker build -t marketsphere-backend:latest .
docker run -d \
  -p 5002:5002 \
  --env-file .env \
  --name marketsphere-api \
  marketsphere-backend:latest
```

### Full Stack Local Development with Docker Compose
```bash
docker-compose up --build
```
This runs MongoDB, Backend API, and Seed scripts in an orchestrated local environment.
