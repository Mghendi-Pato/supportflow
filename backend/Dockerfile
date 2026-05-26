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
# Dummy DATABASE_URL so prisma generate can read the schema without a real DB
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
# Remove prisma.config.js from dist — production reads DATABASE_URL from environment via schema.prisma
RUN rm -f ./dist/prisma.config.js ./dist/prisma.config.js.map ./dist/prisma.config.d.ts
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma
COPY prisma/schema.prisma ./prisma/schema.prisma

EXPOSE 3001

# Run migrations then start — safe for VPS single-container deploys
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/main"]
