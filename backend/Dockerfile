# ============================================================
# SupportFlow Backend — Dockerfile
# Multi-stage build: builder → production
# ============================================================

# Stage 1: Build
FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
# Dummy DATABASE_URL for prisma generate — config falls back to this when DATABASE_URL is unset
ENV DATABASE_URL="postgresql://dummy:dummy@localhost:5432/dummy"
RUN npx prisma generate
RUN npm run build

# Stage 2: Production image
FROM node:20-alpine AS production

WORKDIR /app

ENV NODE_ENV=production

# Copy only what's needed at runtime
COPY package*.json ./
RUN npm ci --omit=dev

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma
COPY prisma/schema.prisma ./prisma/schema.prisma

EXPOSE 3001

# Run migrations then start — safe for VPS single-container deploys
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/main"]
