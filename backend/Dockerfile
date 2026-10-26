# Stage 1: Build & Dependencies
FROM node:22-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev

# Stage 2: Production Minimal Image
FROM node:22-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=5002

COPY --from=builder /app/node_modules ./node_modules
COPY . .

# Ensure uploads directory exists and is fully accessible by node user
RUN mkdir -p /app/uploads && chown -R node:node /app && chmod -R 777 /app/uploads

# Non-root user for security
USER node

EXPOSE 5002

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:5002/api/v1/health || exit 1

CMD ["node", "server.js"]

