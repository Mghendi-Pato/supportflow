ssh deploy@178.105.206.117ssh root@178.105.206.117 ---root
---deploy

# SupportFlow — Production Deployment & CI/CD Guide

> **Project:** SupportFlow (NubianNetworks)  
> **Stack:** Next.js 14 (frontend) · NestJS (backend) · PostgreSQL 16 · Docker · Nginx · GitHub Actions  
> **Target domain:** `support.nubiannetworks.com` (frontend) · `api.support.nubiannetworks.com` (backend)

---

## Table of Contents

1. [How the Whole System Works](#1-how-the-whole-system-works)
2. [Project Architecture Analysis](#2-project-architecture-analysis)
3. [Docker Setup](#3-docker-setup)
4. [Server Setup (Ubuntu VPS)](#4-server-setup-ubuntu-vps)
5. [Nginx Reverse Proxy & SSL](#5-nginx-reverse-proxy--ssl)
6. [Environment Variables](#6-environment-variables)
7. [GitHub Actions CI/CD Pipeline](#7-github-actions-cicd-pipeline)
8. [Deployment Scripts](#8-deployment-scripts)
9. [Database Migration Strategy](#9-database-migration-strategy)
10. [Safe Deployment & Rollback](#10-safe-deployment--rollback)
11. [Monitoring & Logging](#11-monitoring--logging)
12. [First-Time Production Setup Checklist](#12-first-time-production-setup-checklist)
13. [Common Mistakes & How to Avoid Them](#13-common-mistakes--how-to-avoid-them)

---

## 1. How the Whole System Works

Here is the complete journey of code from your laptop to live production:

```
Your laptop  →  git push  →  GitHub
                                ↓
                         GitHub Actions
                         (runs on every push to main)
                                ↓
                    1. Runs tests (if any)
                    2. Builds Docker images
                    3. SSHs into your VPS
                    4. Pulls new images
                    5. Runs DB migrations
                    6. Swaps containers (zero downtime)
                                ↓
                           Your VPS
                    ┌──────────────────────┐
                    │  Nginx (port 80/443) │
                    │    ↓          ↓      │
                    │ Frontend    Backend  │
                    │ :3000       :3001    │
                    │    ↓          ↓      │
                    │        PostgreSQL    │
                    │         :5432        │
                    └──────────────────────┘
                                ↓
                    Users see support.nubiannetworks.com
```

**Why each tool is needed:**

- **Docker** — packages your app with all its dependencies so it runs identically everywhere
- **Docker Compose** — manages multiple containers (frontend, backend, database) as one unit
- **Nginx** — sits in front of everything, handles HTTPS, routes requests to the right container
- **GitHub Actions** — automatically runs your deployment whenever you push to `main`
- **Let's Encrypt** — free SSL certificates so your site runs on HTTPS
- **Certbot** — the tool that fetches and renews Let's Encrypt certificates automatically

---

## 2. Project Architecture Analysis

| Layer        | Technology                         | Package Manager | Port |
| ------------ | ---------------------------------- | --------------- | ---- |
| Frontend     | Next.js 14 (App Router)            | npm             | 3000 |
| Backend      | NestJS + GraphQL                   | npm             | 3001 |
| Database     | PostgreSQL 16                      | —               | 5432 |
| ORM          | Prisma 7 (pg driver adapter)       | —               | —    |
| File uploads | Cloudinary                         | —               | —    |
| Email        | Resend                             | —               | —    |
| Real-time    | GraphQL Subscriptions (graphql-ws) | —               | —    |

**Environment variables needed (backend):**

```
NODE_ENV, PORT, DATABASE_URL,
JWT_ACCESS_SECRET, JWT_REFRESH_SECRET, JWT_EXPIRES_IN, JWT_REFRESH_EXPIRES_IN,
CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET,
RESEND_API_KEY, RESEND_FROM_EMAIL,
FRONTEND_URL
```

**Environment variables needed (frontend):**

```
NEXT_PUBLIC_API_URL, NEXT_PUBLIC_WS_URL
```

**Docker status:** Backend Dockerfile exists. Frontend Dockerfile does not exist yet — created below.

---

## 3. Docker Setup

### 3.1 Frontend Dockerfile

Create this file at `frontend/Dockerfile`:

```dockerfile
# ============================================================
# SupportFlow Frontend — Dockerfile
# Multi-stage: deps → builder → production runner
# ============================================================

# Stage 1: Install dependencies
FROM node:20-alpine AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci

# Stage 2: Build the Next.js app
FROM node:20-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Build-time env vars (these get baked into the JS bundle)
ARG NEXT_PUBLIC_API_URL
ARG NEXT_PUBLIC_WS_URL
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_WS_URL=$NEXT_PUBLIC_WS_URL

RUN npm run build

# Stage 3: Minimal production image
FROM node:20-alpine AS production
WORKDIR /app

ENV NODE_ENV=production

# Next.js standalone output mode — copies only what's needed
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public

EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

CMD ["node", "server.js"]
```

> **Important:** Next.js standalone mode must be enabled. Add this to `frontend/next.config.js`:
>
> ```js
> /** @type {import('next').NextConfig} */
> const nextConfig = {
>   output: 'standalone',
>   // ... your existing config
> };
> module.exports = nextConfig;
> ```

### 3.2 Backend Dockerfile (already exists — improved version)

Replace `backend/Dockerfile` with this improved version:

```dockerfile
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
RUN npx prisma generate
RUN npm run build

# Stage 2: Lean production image
FROM node:20-alpine AS production
WORKDIR /app

ENV NODE_ENV=production

RUN addgroup -g 1001 -S nodejs && adduser -S nestjs -u 1001

COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma
COPY prisma/schema.prisma ./prisma/schema.prisma
COPY prisma/migrations ./prisma/migrations

USER nestjs

EXPOSE 3001

HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
  CMD wget -qO- http://localhost:3001/api/v1/health || exit 1

# Migrations run first, then app starts
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/main"]
```

### 3.3 Production docker-compose.yml

Replace the root `docker-compose.yml` with this production version:

```yaml
version: '3.9'

services:
  # ── PostgreSQL Database ─────────────────────────────────────
  # Why: Stores all application data. Named volume persists data
  # across container restarts and deployments.
  postgres:
    image: postgres:16-alpine
    container_name: supportflow_db
    restart: unless-stopped
    environment:
      POSTGRES_USER: ${POSTGRES_USER}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
      POSTGRES_DB: ${POSTGRES_DB}
    volumes:
      - postgres_data:/var/lib/postgresql/data
    # NOT exposed to host — only accessible inside Docker network
    expose:
      - '5432'
    healthcheck:
      test: ['CMD-SHELL', 'pg_isready -U ${POSTGRES_USER}']
      interval: 10s
      timeout: 5s
      retries: 5
      start_period: 10s
    networks:
      - supportflow_net

  # ── NestJS Backend API ──────────────────────────────────────
  # Why: Serves REST API + GraphQL. Runs migrations on startup.
  # Only port 3001 is exposed — Nginx handles external traffic.
  backend:
    image: ghcr.io/${GITHUB_REPOSITORY}/backend:${IMAGE_TAG:-latest}
    container_name: supportflow_api
    restart: unless-stopped
    expose:
      - '3001'
    env_file:
      - ./backend/.env.production
    environment:
      DATABASE_URL: postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@postgres:5432/${POSTGRES_DB}
      NODE_ENV: production
    depends_on:
      postgres:
        condition: service_healthy
    healthcheck:
      test:
        ['CMD-SHELL', 'wget -qO- http://localhost:3001/api/v1/health || exit 1']
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s
    networks:
      - supportflow_net

  # ── Next.js Frontend ────────────────────────────────────────
  # Why: Serves the React application. NEXT_PUBLIC_* vars are
  # baked in at build time, so they must be set during docker build.
  frontend:
    image: ghcr.io/${GITHUB_REPOSITORY}/frontend:${IMAGE_TAG:-latest}
    container_name: supportflow_web
    restart: unless-stopped
    expose:
      - '3000'
    environment:
      NODE_ENV: production
    depends_on:
      backend:
        condition: service_healthy
    networks:
      - supportflow_net

networks:
  supportflow_net:
    driver: bridge

volumes:
  postgres_data:
    driver: local
```

> **Note on `GITHUB_REPOSITORY`:** This is automatically set by GitHub Actions and looks like `mwamburi/nubian_support`. The image names become `ghcr.io/mwamburi/nubian_support/backend:abc1234`.

---

## 4. Server Setup (Ubuntu VPS)

### 4.1 Choose a VPS

Recommended providers and minimum specs for this project:

- **DigitalOcean Droplet** — $12/month, 2 vCPU, 2GB RAM (smallest that runs comfortably)
- **Hetzner Cloud** — €5/month, same specs (best value in Europe/Africa)
- **Linode / Akamai** — $12/month

**Operating System:** Ubuntu 22.04 LTS

### 4.2 Initial Server Configuration

SSH into your new server as root:

```bash
ssh root@YOUR_SERVER_IP
```

**Step 1 — Update the system:**

```bash
apt update && apt upgrade -y
```

**Step 2 — Create a deploy user (never run apps as root):**

```bash
useradd -m -s /bin/bash deploy
usermod -aG sudo deploy
# Set a strong password
passwd deploy
```

**Step 3 — Configure SSH key access for the deploy user:**

```bash
# On your LOCAL machine, generate a deploy key pair (if you don't have one)
ssh-keygen -t ed25519 -C "deploy@nubiannetworks" -f ~/.ssh/nubian_deploy

# Copy public key to server
ssh-copy-id -i ~/.ssh/nubian_deploy.pub deploy@YOUR_SERVER_IP
```

**Step 4 — Harden SSH (disable root login and password auth):**

```bash
# On the server
nano /etc/ssh/sshd_config
```

Change these values:

```
PermitRootLogin no
PasswordAuthentication no
PubkeyAuthentication yes
```

```bash
systemctl restart sshd
```

**Step 5 — Configure UFW firewall:**

```bash
ufw default deny incoming
ufw default allow outgoing
ufw allow ssh          # port 22
ufw allow 80/tcp       # HTTP (for Let's Encrypt challenge)
ufw allow 443/tcp      # HTTPS
ufw enable
ufw status
```

> ⚠️ **Do NOT open ports 3000, 3001, or 5432 to the internet.** Only Nginx handles external traffic. Everything else communicates through the internal Docker network.

### 4.3 Install Docker and Docker Compose

```bash
# Switch to deploy user
su - deploy

# Install Docker using the official script
curl -fsSL https://get.docker.com | sh

# Add deploy user to docker group (avoids needing sudo for docker commands)
sudo usermod -aG docker deploy

# Log out and back in for group change to take effect
exit
su - deploy

# Verify Docker works
docker --version
docker compose version
```

### 4.4 Set Up Project Directory Structure

```bash
# Create the application directory
sudo mkdir -p /opt/supportflow
sudo chown deploy:deploy /opt/supportflow
cd /opt/supportflow

# Create environment file directories
mkdir -p backend frontend secrets

# This is where your production .env files will live (never in Git)
# You will create these manually — see Section 6
touch backend/.env.production
touch .env  # root-level for docker-compose postgres vars
```

Your server directory structure will look like:

```
/opt/supportflow/
├── docker-compose.yml          ← pulled from GitHub on each deploy
├── .env                        ← postgres credentials (manual, never in Git)
├── backend/
│   └── .env.production         ← backend secrets (manual, never in Git)
└── scripts/
    └── deploy.sh               ← deployment script (created below)
```

### 4.5 Install Nginx and Certbot

```bash
sudo apt install -y nginx certbot python3-certbot-nginx

# Enable and start Nginx
sudo systemctl enable nginx
sudo systemctl start nginx
```

---

## 5. Nginx Reverse Proxy & SSL

### 5.1 How Requests Flow

```
Internet
    │
    ▼
Nginx (port 443 / HTTPS)
    │
    ├──  support.nubiannetworks.com  →  Docker: frontend:3000
    │
    └──  api.support.nubiannetworks.com  →  Docker: backend:3001
                                              (also handles /graphql WebSocket upgrades)
```

### 5.2 Create Nginx Configuration

Create the config file:

```bash
sudo nano /etc/nginx/sites-available/supportflow
```

Paste this full configuration:

```nginx
# ── Backend API + GraphQL ────────────────────────────────────
server {
    listen 80;
    server_name api.support.nubiannetworks.com;

    # Let's Encrypt challenge — must be HTTP
    location /.well-known/acme-challenge/ {
        root /var/www/certbot;
    }

    # Redirect all other HTTP to HTTPS
    location / {
        return 301 https://$host$request_uri;
    }
}

server {
    listen 443 ssl http2;
    server_name api.support.nubiannetworks.com;

    ssl_certificate     /etc/letsencrypt/live/api.support.nubiannetworks.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/api.support.nubiannetworks.com/privkey.pem;
    ssl_protocols       TLSv1.2 TLSv1.3;
    ssl_ciphers         HIGH:!aNULL:!MD5;

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN";
    add_header X-Content-Type-Options "nosniff";
    add_header Referrer-Policy "strict-origin-when-cross-origin";

    # Request size limit (for file uploads)
    client_max_body_size 15M;

    # REST API
    location /api/ {
        proxy_pass         http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header   Host $host;
        proxy_set_header   X-Real-IP $remote_addr;
        proxy_set_header   X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header   X-Forwarded-Proto $scheme;
    }

    # GraphQL HTTP
    location /graphql {
        proxy_pass         http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header   Host $host;
        proxy_set_header   X-Real-IP $remote_addr;
        proxy_set_header   X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header   X-Forwarded-Proto $scheme;

        # WebSocket upgrade — required for GraphQL subscriptions
        proxy_set_header   Upgrade $http_upgrade;
        proxy_set_header   Connection "upgrade";
        proxy_read_timeout 3600s;
        proxy_send_timeout 3600s;
    }
}

# ── Frontend ─────────────────────────────────────────────────
server {
    listen 80;
    server_name support.nubiannetworks.com;

    location /.well-known/acme-challenge/ {
        root /var/www/certbot;
    }

    location / {
        return 301 https://$host$request_uri;
    }
}

server {
    listen 443 ssl http2;
    server_name support.nubiannetworks.com;

    ssl_certificate     /etc/letsencrypt/live/support.nubiannetworks.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/support.nubiannetworks.com/privkey.pem;
    ssl_protocols       TLSv1.2 TLSv1.3;
    ssl_ciphers         HIGH:!aNULL:!MD5;

    add_header X-Frame-Options "SAMEORIGIN";
    add_header X-Content-Type-Options "nosniff";
    add_header Referrer-Policy "strict-origin-when-cross-origin";

    # Cache static Next.js assets aggressively
    location /_next/static/ {
        proxy_pass http://localhost:3000;
        proxy_cache_valid 200 1y;
        add_header Cache-Control "public, max-age=31536000, immutable";
    }

    location / {
        proxy_pass         http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header   Host $host;
        proxy_set_header   X-Real-IP $remote_addr;
        proxy_set_header   X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header   X-Forwarded-Proto $scheme;
        proxy_set_header   Upgrade $http_upgrade;
        proxy_set_header   Connection "upgrade";
    }
}
```

Enable the config:

```bash
sudo ln -s /etc/nginx/sites-available/supportflow /etc/nginx/sites-enabled/
sudo nginx -t          # test config — must say "syntax is ok"
sudo systemctl reload nginx
```

### 5.3 Obtain SSL Certificates

**Important:** Your DNS must already point to your VPS IP before running this.

```bash
# Get certificates for both domains
sudo certbot --nginx -d support.nubiannetworks.com -d api.support.nubiannetworks.com

# Follow the prompts:
# - Enter your email for renewal notices
# - Agree to terms
# - Choose whether to share email with EFF (optional)

# Certbot auto-configures Nginx for SSL. Reload to apply:
sudo systemctl reload nginx
```

**Auto-renewal:** Certbot installs a cron job automatically. Test it:

```bash
sudo certbot renew --dry-run
```

---

## 6. Environment Variables

### 6.1 Root `.env` (Docker Compose postgres vars)

On the server at `/opt/supportflow/.env`:

```env
# PostgreSQL credentials — used by docker-compose.yml
POSTGRES_USER=supportflow
POSTGRES_PASSWORD=CHANGE_THIS_STRONG_PASSWORD_32_CHARS
POSTGRES_DB=supportflow_production

# Used to pull images from GitHub Container Registry
GITHUB_REPOSITORY=mwamburi/nubian_support
IMAGE_TAG=latest
```

### 6.2 Backend `/opt/supportflow/backend/.env.production`

```env
NODE_ENV=production
PORT=3001

# DATABASE_URL is injected by docker-compose via environment block
# (overrides this if set in compose — leave blank or set for local testing)
DATABASE_URL=postgresql://supportflow:YOUR_PASSWORD@postgres:5432/supportflow_production

# JWT — generate with: openssl rand -hex 64
JWT_ACCESS_SECRET=GENERATE_WITH_OPENSSL_64_BYTES
JWT_REFRESH_SECRET=GENERATE_WITH_OPENSSL_64_BYTES_DIFFERENT
JWT_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d

# Cloudinary
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret

# Resend
RESEND_API_KEY=re_xxxxxxxxxxxxxxxxxxxx
RESEND_FROM_EMAIL=support@nubiannetworks.com

# URLs
FRONTEND_URL=https://support.nubiannetworks.com
```

Generate strong secrets:

```bash
openssl rand -hex 64   # run twice — one for each JWT secret
```

### 6.3 GitHub Secrets (for CI/CD)

Go to: **GitHub repo → Settings → Secrets and variables → Actions → New repository secret**

| Secret Name           | Value                                            | Why needed                                      |
| --------------------- | ------------------------------------------------ | ----------------------------------------------- |
| `VPS_HOST`            | `YOUR_SERVER_IP`                                 | SSH target                                      |
| `VPS_USER`            | `deploy`                                         | SSH user                                        |
| `VPS_SSH_KEY`         | Contents of `~/.ssh/nubian_deploy` (private key) | SSH auth from GitHub to server                  |
| `VPS_PORT`            | `22`                                             | SSH port                                        |
| `GHCR_TOKEN`          | GitHub Personal Access Token (write:packages)    | Push Docker images to GitHub Container Registry |
| `NEXT_PUBLIC_API_URL` | `https://api.support.nubiannetworks.com/api/v1`  | Baked into frontend build                       |
| `NEXT_PUBLIC_WS_URL`  | `wss://api.support.nubiannetworks.com/graphql`   | WebSocket URL for chat                          |

---

## 7. GitHub Actions CI/CD Pipeline

Create this file at `.github/workflows/deploy.yml` in your repository root:

```yaml
name: Deploy to Production

# Trigger: only on pushes to main branch
on:
  push:
    branches: [main]

# Permissions needed to push to GitHub Container Registry
permissions:
  contents: read
  packages: write

env:
  REGISTRY: ghcr.io
  # GitHub automatically sets GITHUB_REPOSITORY = "username/repo"
  BACKEND_IMAGE: ghcr.io/${{ github.repository }}/backend
  FRONTEND_IMAGE: ghcr.io/${{ github.repository }}/frontend

jobs:
  # ── Job 1: Build and push Docker images ──────────────────────
  build:
    name: Build & Push Docker Images
    runs-on: ubuntu-latest

    steps:
      # Step 1: Check out the code
      # Why: GitHub Actions runs on a clean VM — it needs your code first
      - name: Checkout code
        uses: actions/checkout@v4

      # Step 2: Log in to GitHub Container Registry
      # Why: We push images here so the server can pull them
      - name: Log in to GitHub Container Registry
        uses: docker/login-action@v3
        with:
          registry: ${{ env.REGISTRY }}
          username: ${{ github.actor }}
          password: ${{ secrets.GHCR_TOKEN }}

      # Step 3: Set up Docker Buildx
      # Why: Enables advanced build features like layer caching
      - name: Set up Docker Buildx
        uses: docker/setup-buildx-action@v3

      # Step 4: Build and push the backend image
      # The short SHA (e.g. "a3f9b2c") is used as the image tag
      # so you can always roll back to a specific commit's image
      - name: Build and push backend
        uses: docker/build-push-action@v5
        with:
          context: ./backend
          file: ./backend/Dockerfile
          target: production
          push: true
          tags: |
            ${{ env.BACKEND_IMAGE }}:latest
            ${{ env.BACKEND_IMAGE }}:${{ github.sha }}
          cache-from: type=gha
          cache-to: type=gha,mode=max

      # Step 5: Build and push the frontend image
      # NEXT_PUBLIC_* vars must be passed at BUILD TIME — they get baked
      # into the JavaScript bundle and cannot be changed at runtime
      - name: Build and push frontend
        uses: docker/build-push-action@v5
        with:
          context: ./frontend
          file: ./frontend/Dockerfile
          push: true
          tags: |
            ${{ env.FRONTEND_IMAGE }}:latest
            ${{ env.FRONTEND_IMAGE }}:${{ github.sha }}
          build-args: |
            NEXT_PUBLIC_API_URL=${{ secrets.NEXT_PUBLIC_API_URL }}
            NEXT_PUBLIC_WS_URL=${{ secrets.NEXT_PUBLIC_WS_URL }}
          cache-from: type=gha
          cache-to: type=gha,mode=max

  # ── Job 2: Deploy to VPS ─────────────────────────────────────
  deploy:
    name: Deploy to VPS
    runs-on: ubuntu-latest
    needs: build # only runs if build job succeeds
    environment: production # requires manual approval if configured

    steps:
      # Step 1: SSH into server and run deployment script
      # Why: appleboy/ssh-action opens a secure SSH connection and
      # runs commands exactly as if you typed them in a terminal
      - name: Deploy via SSH
        uses: appleboy/ssh-action@v1.0.3
        with:
          host: ${{ secrets.VPS_HOST }}
          username: ${{ secrets.VPS_USER }}
          key: ${{ secrets.VPS_SSH_KEY }}
          port: ${{ secrets.VPS_PORT }}
          script: |
            # Export the specific image tag for this commit
            export IMAGE_TAG=${{ github.sha }}
            export GITHUB_REPOSITORY=${{ github.repository }}

            # Run the deployment script on the server
            cd /opt/supportflow
            bash scripts/deploy.sh $IMAGE_TAG
```

---

## 8. Deployment Scripts

### 8.1 Create the deploy script on the server

```bash
mkdir -p /opt/supportflow/scripts
nano /opt/supportflow/scripts/deploy.sh
```

Paste this content:

```bash
#!/bin/bash
# deploy.sh — called by GitHub Actions on every push to main
# Usage: bash deploy.sh <IMAGE_TAG>
# ============================================================
set -e   # Exit immediately if any command fails

IMAGE_TAG=${1:-latest}
APP_DIR="/opt/supportflow"
COMPOSE_FILE="$APP_DIR/docker-compose.yml"

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🚀 Starting deployment — image tag: $IMAGE_TAG"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

cd $APP_DIR

# Step 1: Log in to GitHub Container Registry
# Why: The server needs auth to pull private images
echo "📦 Logging into GitHub Container Registry..."
echo $GHCR_TOKEN | docker login ghcr.io -u $GITHUB_ACTOR --password-stdin

# Step 2: Pull the new images
# We pull before stopping the old containers to minimise downtime
echo "📥 Pulling new images..."
IMAGE_TAG=$IMAGE_TAG docker compose pull backend frontend

# Step 3: Store the currently running image tag for rollback
PREVIOUS_TAG=$(docker inspect --format='{{index .Config.Labels "org.opencontainers.image.revision"}}' supportflow_api 2>/dev/null || echo "latest")
echo "📌 Previous tag for rollback: $PREVIOUS_TAG"

# Step 4: Bring up the new containers
# docker compose up -d --no-deps prevents restarting postgres
# --remove-orphans cleans up any old containers not in compose file
echo "🔄 Swapping containers..."
IMAGE_TAG=$IMAGE_TAG docker compose up -d --no-deps --remove-orphans backend frontend

# Step 5: Wait for backend health check
echo "⏳ Waiting for backend health check..."
for i in $(seq 1 12); do
  if docker inspect --format='{{.State.Health.Status}}' supportflow_api 2>/dev/null | grep -q "healthy"; then
    echo "✅ Backend is healthy!"
    break
  fi
  if [ $i -eq 12 ]; then
    echo "❌ Backend failed health check after 60s — rolling back..."
    IMAGE_TAG=$PREVIOUS_TAG docker compose up -d --no-deps backend frontend
    echo "⏮️  Rolled back to: $PREVIOUS_TAG"
    exit 1
  fi
  echo "   Attempt $i/12 — waiting 5s..."
  sleep 5
done

# Step 6: Clean up old unused images to save disk space
echo "🧹 Cleaning up old images..."
docker image prune -f --filter "until=24h"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ Deployment complete! Tag: $IMAGE_TAG"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
```

Make it executable:

```bash
chmod +x /opt/supportflow/scripts/deploy.sh
```

### 8.2 Add GHCR credentials to server environment

The deploy script needs `GHCR_TOKEN` and `GITHUB_ACTOR`. Add them to the deploy user's environment:

```bash
nano /home/deploy/.bashrc
```

Add at the bottom:

```bash
export GHCR_TOKEN="your_github_personal_access_token"
export GITHUB_ACTOR="mwamburi"
```

---

## 9. Database Migration Strategy

### How it works in this project

The backend `CMD` in the Dockerfile runs:

```sh
npx prisma migrate deploy && node dist/main
```

This means **every time the backend container starts, it runs pending migrations first.** This is safe because:

- `prisma migrate deploy` is idempotent — it skips already-applied migrations
- It only applies migrations in order — never re-runs completed ones
- The app only starts listening for requests after migrations succeed

### Rollback considerations

**Prisma does not support automatic migration rollback.** If a migration causes a problem, you must:

1. Roll back the application code (re-deploy the previous image tag — see Section 10)
2. The old code will work because the migration is forward-compatible
3. If you must undo the schema change, write a new migration that reverses it

**Safe migration rules:**

- ✅ Adding a new nullable column — always safe
- ✅ Adding a new table — always safe
- ✅ Adding an index — safe (runs in the background in Postgres)
- ⚠️ Renaming a column — dangerous, do it in two deploys (add new, migrate data, remove old)
- ❌ Dropping a column used by running code — always dangerous

### Running seed on production (first deploy only)

```bash
# SSH into server
ssh deploy@YOUR_SERVER_IP

# Run seed inside the backend container
docker exec supportflow_api npx ts-node -r tsconfig-paths/register prisma/seed.js

# Or if dist/prisma/seed.js exists:
docker exec supportflow_api node dist/prisma/seed.js
```

> ⚠️ Run the seed **once** on first deploy only. Re-running it is safe because all inserts use `upsert`, but it is unnecessary.

---

## 10. Safe Deployment & Rollback

### Zero-downtime deployment strategy

The deploy script uses `--no-deps` to restart only the app containers (not postgres), and pulls new images before stopping old ones. Docker handles the swap — there is typically less than 2 seconds of downtime.

For true zero-downtime you would need a load balancer with multiple replicas, which is overkill for a single-tenant VPS.

### Rolling back to a previous version

Every deployment tags images with the Git SHA (e.g. `a3f9b2c`). To roll back:

```bash
# SSH into server
ssh deploy@YOUR_SERVER_IP
cd /opt/supportflow

# Roll back to a specific commit SHA
IMAGE_TAG=a3f9b2c docker compose up -d --no-deps backend frontend

# Or roll back to whatever was tagged "latest" before the bad deploy
IMAGE_TAG=latest docker compose up -d --no-deps backend frontend
```

To find available image tags (previous deploys):

```bash
docker images | grep supportflow
```

### Health check endpoint

Add a health endpoint to the NestJS backend so Docker and Nginx can verify it's alive. Create `backend/src/health/health.controller.ts`:

```typescript
import { Controller, Get } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';

@ApiTags('Health')
@Controller('health')
export class HealthController {
  @Get()
  check() {
    return { status: 'ok', timestamp: new Date().toISOString() };
  }
}
```

Register it in `app.module.ts` and it becomes available at `GET /api/v1/health`.

---

## 11. Monitoring & Logging

### View live logs

```bash
# All containers
docker compose -f /opt/supportflow/docker-compose.yml logs -f

# Backend only (most useful)
docker compose -f /opt/supportflow/docker-compose.yml logs -f backend

# Frontend only
docker compose -f /opt/supportflow/docker-compose.yml logs -f frontend

# Last 100 lines
docker compose -f /opt/supportflow/docker-compose.yml logs --tail=100 backend
```

### Monitor container health and resources

```bash
# Live CPU/memory stats for all containers
docker stats

# Check container status and health
docker ps -a

# Inspect a specific container
docker inspect supportflow_api
```

### Check Nginx access and error logs

```bash
sudo tail -f /var/log/nginx/access.log
sudo tail -f /var/log/nginx/error.log
```

### Check GitHub Actions deployment status

Go to: **GitHub repo → Actions tab** — every push to `main` creates a workflow run. Click any run to see detailed logs for each step.

### Detect deployment failures

If a deployment fails, GitHub Actions will:

1. Mark the workflow run as ❌ Failed
2. Send an email notification to the committer
3. The deploy script's health check will trigger a rollback automatically

To get Slack/Discord notifications, add this step to the deploy job in `deploy.yml`:

```yaml
- name: Notify on failure
  if: failure()
  uses: slackapi/slack-github-action@v1.24.0
  with:
    payload: '{"text":"❌ SupportFlow deployment FAILED on commit ${{ github.sha }}"}'
  env:
    SLACK_WEBHOOK_URL: ${{ secrets.SLACK_WEBHOOK_URL }}
```

---

## 12. First-Time Production Setup Checklist

Run through these steps in order on your first deployment:

```
□ 1.  VPS created (Ubuntu 22.04, 2GB+ RAM)
□ 2.  DNS records created:
         support.nubiannetworks.com    →  A record → VPS IP
         api.support.nubiannetworks.com → A record → VPS IP
□ 3.  SSH into server, run all commands in Section 4
□ 4.  Docker and Docker Compose installed and verified
□ 5.  /opt/supportflow directory structure created
□ 6.  backend/.env.production created with real secrets
□ 7.  .env created with postgres credentials
□ 8.  scripts/deploy.sh created and chmod +x
□ 9.  GHCR_TOKEN and GITHUB_ACTOR added to ~/.bashrc
□ 10. Nginx installed and config file created (Section 5.2)
□ 11. SSL certificates obtained with certbot (Section 5.3)
□ 12. GitHub Secrets added (Section 6.3)
□ 13. frontend/Dockerfile created (Section 3.1)
□ 14. next.config.js updated with output: 'standalone'
□ 15. .github/workflows/deploy.yml committed and pushed to main
□ 16. Watch first GitHub Actions run succeed
□ 17. SSH into server, run prisma seed (Section 9)
□ 18. Open https://support.nubiannetworks.com and log in
□ 19. Change both default passwords immediately
□ 20. Celebrate 🎉
```

---

## 13. Common Mistakes & How to Avoid Them

**1. Forgetting `output: 'standalone'` in next.config.js**
The frontend Dockerfile uses Next.js standalone mode. Without this config, the build won't produce `server.js` and the container will fail to start.

**2. Exposing database port 5432 to the internet**
Never add `ports: - '5432:5432'` in production docker-compose. Only use `expose:` (internal Docker network only). Exposing it lets anyone on the internet attempt to connect to your database.

**3. NEXT*PUBLIC*\* vars not set at build time**
These vars are baked into the JavaScript bundle during `next build`. Setting them as Docker runtime environment variables does nothing. They must be passed as `--build-arg` during `docker build` (which the GitHub Actions workflow handles automatically via `build-args`).

**4. Not setting CORS `FRONTEND_URL` correctly in production**
The NestJS backend rejects requests from unknown origins. Make sure `FRONTEND_URL=https://support.nubiannetworks.com` in the backend production env file.

**5. Running `prisma migrate dev` on production**
`migrate dev` creates migration files and resets the database in interactive mode. Always use `prisma migrate deploy` in production — it only applies pending migrations safely.

**6. Committing `.env` files to Git**
Add these to `.gitignore` immediately if not already done:

```
backend/.env
backend/.env.production
frontend/.env.local
.env
```

**7. Not waiting for the database health check**
The backend container starts and runs migrations before the app accepts requests. If postgres is still starting when the backend tries to connect, it will crash. The `depends_on: condition: service_healthy` in docker-compose handles this, but only if the healthcheck is defined on postgres.

**8. WebSocket connections failing**
GraphQL subscriptions use WebSocket (`wss://`). Nginx must have the `Upgrade` and `Connection` headers proxied (included in the config above). Also ensure `NEXT_PUBLIC_WS_URL` uses `wss://` not `https://`.

---

_Document version 1.0 — SupportFlow / NubianNetworks_
